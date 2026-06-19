import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";
import { renderEmailTemplate } from "../_shared/professional-template.ts";
import { stripTrailingDuplicateSignoffHtml } from "../_shared/strip-trailing-signoff.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Reply-To for campaign emails: use Resend inbound so replies are received by Resend and show in Conversations
const RESEND_INBOUND_EMAIL = Deno.env.get('RESEND_INBOUND_EMAIL') || 'leadgenie@eldapgraaa.resend.app';

// Gmail daily send limit (free: 500/day, Workspace: 2000/day). 450 leaves headroom.
const GMAIL_DAILY_LIMIT = 450;

// Resend batch API limit per call
const RESEND_BATCH_SIZE = 100;

/** Personalize a template string with recipient tokens */
function personalizeText(template: string, recipient: any): string {
  if (!template) return '';
  const fullName = recipient.name || recipient.email || '';
  const nameParts = fullName.split(' ');
  const firstName = nameParts[0] || '';
  const lastName = nameParts.slice(1).join(' ') || '';
  return template
    .replace(/\{\{firstName\}\}/gi, firstName)
    .replace(/\{\{lastName\}\}/gi, lastName)
    .replace(/\{\{fullName\}\}/gi, fullName)
    .replace(/\{\{name\}\}/gi, fullName)
    .replace(/\{\{email\}\}/gi, recipient.email || '');
}

/** Resolve subject/body for a recipient, falling back to campaign templates */
function resolveRecipientContent(recipient: any, campaign: any): {
  subject: string;
  bodyText: string;
  bodyHtml: string;
} {
  const subject =
    recipient.personalized_subject ||
    (campaign.subject_template ? personalizeText(campaign.subject_template, recipient) : '') ||
    '(No subject)';

  const bodyText =
    recipient.personalized_body_text ||
    (campaign.body_text_template ? personalizeText(campaign.body_text_template, recipient) : '') ||
    '';

  const bodyHtml =
    recipient.personalized_body_html ||
    (campaign.body_html_template ? personalizeText(campaign.body_html_template, recipient) : '') ||
    bodyText;

  return { subject, bodyText, bodyHtml };
}

function parseResendError(status: number, bodyText: string): string {
  try {
    const j = JSON.parse(bodyText);
    const msg = j?.message || j?.error || bodyText;
    if (status === 403 && typeof msg === 'string' && (msg.includes('not verified') || msg.includes('domain'))) {
      return `${msg} Add and verify your domain at https://resend.com/domains and use that domain in Settings → Email Providers.`;
    }
    return typeof msg === 'string' ? msg : bodyText;
  } catch {
    return bodyText;
  }
}

/**
 * Apply per-row updates to email_campaign_recipients, chunked for concurrency.
 * We must use UPDATE (not upsert): the table has NOT NULL columns without defaults
 * (campaign_id, email, name, personalized_*), so a partial upsert violates NOT NULL
 * and silently fails — the bug that left recipients stuck 'pending'.
 */
async function applyRecipientUpdates(
  supabaseClient: any,
  rows: Array<{ id: string; [k: string]: any }>,
  concurrency = 50,
): Promise<void> {
  for (let i = 0; i < rows.length; i += concurrency) {
    await Promise.allSettled(
      rows.slice(i, i + concurrency).map(({ id, ...fields }) =>
        supabaseClient.from('email_campaign_recipients').update(fields).eq('id', id)
      )
    );
  }
}

/** Render template + strip signoff for a single recipient's body */
function buildWrappedHtml(
  recipient: any,
  branding: any,
  userProfile: any,
  senderName: string,
  fromEmail: string,
): string {
  let bodyHtml = recipient.personalized_body_html || '';
  if (!bodyHtml.trim() && (recipient.personalized_body_text || '').trim()) {
    bodyHtml = recipient.personalized_body_text;
  }
  bodyHtml = stripTrailingDuplicateSignoffHtml(bodyHtml);

  return renderEmailTemplate(branding.templateStyle, {
    body: bodyHtml || '',
    senderName,
    signatureName: branding.signatureName ?? undefined,
    senderEmail: fromEmail,
    senderTitle: branding.senderTitle || userProfile?.job_title,
    companyName: branding.companyName,
    headerName: branding.headerName || undefined,
    logoUrl: branding.logoUrl,
    brandColor: branding.brandColor,
    footerText: branding.footerText,
    footerImageUrl: branding.footerImageUrl,
    signature: branding.signature,
    senderImageUrl: branding.senderImageUrl || userProfile?.avatar_url,
    websiteUrl: branding.websiteUrl ?? undefined,
  });
}

/** Enroll a recipient's company in a follow-up sequence (non-fatal) */
async function enrollFollowUp(
  supabaseClient: any,
  recipient: any,
  campaign: any,
  campaignId: string,
  sentAt: string,
  messageId: string | null,
) {
  if (!campaign.auto_follow_up_enabled || !campaign.follow_up_sequence_id || !recipient.person_id) return;
  try {
    const { data: person } = await supabaseClient.from('people').select('company_id').eq('id', recipient.person_id).single();
    const companyId = person?.company_id;
    if (!companyId) return;
    const { data: existing } = await supabaseClient.from('company_sequences').select('id').eq('campaign_id', campaignId).eq('company_id', companyId).maybeSingle();
    if (existing) return;
    const { data: followUpSequence } = await supabaseClient.from('email_sequences').select('steps, repeat_sequence, repeat_after_days, repeat_only_for').eq('id', campaign.follow_up_sequence_id).single();
    const steps = Array.isArray(followUpSequence?.steps) ? followUpSequence.steps : [];
    const personalizedEmails: any[] = [{ stepNumber: 0, subject: '(Campaign)', body: '', delayDays: 0 }];
    steps.forEach((rawStep: unknown, i: number) => {
      const step = typeof rawStep === 'string' ? (() => { try { return JSON.parse(rawStep); } catch { return {}; } })() : (rawStep as Record<string, unknown>) || {};
      const ar = (step as any)?.automation_rule as { type?: string; wait_hours?: number } | undefined;
      const ruleType = ar?.type && ['no_open', 'opened_not_clicked', 'clicked_not_replied', 'no_reply_after_open', 'time_based', 'wait_for_open', 'wait_for_click'].includes(ar.type) ? ar.type : undefined;
      personalizedEmails.push({
        stepNumber: i + 1,
        subject: (step as any)?.subject ?? `Follow-up ${i + 1}`,
        body: (step as any)?.body ?? '',
        delayDays: typeof (step as any)?.delayDays === 'number' ? (step as any).delayDays : (i === 0 ? 3 : (i + 1) * 2),
        ...(ruleType && ruleType !== 'none' && ruleType !== 'time_based' ? { automation_rule: { type: ruleType, wait_hours: ar?.wait_hours ?? 24 } } : {}),
      });
    });
    const { data: newCs, error: csErr } = await supabaseClient.from('company_sequences').insert({
      company_id: companyId,
      sequence_id: campaign.follow_up_sequence_id,
      campaign_id: campaignId,
      sender_profile_id: campaign.sender_profile_id ?? null,
      current_step: 0,
      personalized_emails: personalizedEmails,
      status: 'active',
      automation_rules: { enabled: true, rules: [{ type: 'no_reply_after_open', wait_hours: 48 }, { type: 'no_open', wait_hours: 72 }] },
      metadata: {
        first_email_sent_at: sentAt,
        campaign_recipient_id: recipient.id,
        repeat_sequence: !!(followUpSequence as any)?.repeat_sequence,
        repeat_after_days: Math.max(1, Math.min(30, (followUpSequence as any)?.repeat_after_days ?? 5)),
        repeat_only_for: (followUpSequence as any)?.repeat_only_for ?? 'no_reply',
      },
    }).select('id').single();
    if (!csErr && newCs?.id) {
      await supabaseClient.from('email_activities').insert({
        company_sequence_id: newCs.id, contact_id: null, step_number: 0,
        subject: recipient.personalized_subject, body: recipient.personalized_body_text,
        status: 'sent', sent_at: sentAt, external_message_id: messageId,
        metadata: { campaign_id: campaignId, campaign_recipient_id: recipient.id },
      });
    }
  } catch (err) {
    console.error('Follow-up enrollment failed (non-fatal):', err);
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { campaignId, triggeredByCron, _retryCount = 0 } = await req.json();

    if (!campaignId) {
      throw new Error('Campaign ID is required');
    }

    console.log(`Processing bulk email campaign: ${campaignId}, triggeredByCron: ${triggeredByCron}`);

    // Check if this is a service role request (from cron-trigger)
    const authHeader = req.headers.get('Authorization') || '';
    const isServiceRole = authHeader.includes(Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || 'invalid');

    let supabaseClient: any;
    let userId: string | null = null;

    if (isServiceRole || triggeredByCron) {
      supabaseClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );
      const { data: campaign, error: campaignError } = await supabaseClient
        .from('email_campaigns').select('user_id').eq('id', campaignId).single();
      if (campaignError || !campaign) throw new Error('Campaign not found');
      userId = campaign.user_id;
      console.log(`[cron] Processing campaign for user: ${userId}`);
    } else {
      supabaseClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_ANON_KEY') ?? '',
        { global: { headers: { Authorization: authHeader } } }
      );
      const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
      if (authError || !user) throw new Error('Unauthorized');
      userId = user.id;
    }

    // Get campaign details
    const { data: campaign, error: campaignError } = await supabaseClient
      .from('email_campaigns').select('*').eq('id', campaignId).single();
    if (campaignError || !campaign) throw new Error('Campaign not found');

    if (!isServiceRole && !triggeredByCron && campaign.user_id !== userId) {
      throw new Error('Unauthorized: Campaign does not belong to user');
    }

    // After auth, use service role for all DB operations
    if (!isServiceRole && !triggeredByCron) {
      supabaseClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );
    }

    // Update campaign status to sending
    await supabaseClient.from('email_campaigns').update({
      status: 'sending',
      started_at: new Date().toISOString()
    }).eq('id', campaignId);

    // Get ALL pending recipients — no limit for Resend (handles thousands instantly)
    const { data: allPendingRecipients, error: recipientsError } = await supabaseClient
      .from('email_campaign_recipients')
      .select('*')
      .eq('campaign_id', campaignId)
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(100000);

    if (recipientsError) throw new Error('Failed to fetch recipients');

    if (!allPendingRecipients || allPendingRecipients.length === 0) {
      await supabaseClient.from('email_campaigns').update({
        status: 'completed',
        completed_at: new Date().toISOString()
      }).eq('id', campaignId);
      return new Response(JSON.stringify({ success: true, message: 'No pending recipients', sent: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── OPTIMISTIC LOCK ────────────────────────────────────────────────────────
    // Mark every pending recipient as 'sent' RIGHT NOW before any email goes out.
    // This means the cron (which queries status='pending') will see 0 results and
    // never fire a second concurrent send. Failures are corrected to 'failed' below.
    // IMPORTANT: use UPDATE, not upsert. The table has NOT NULL columns without
    // defaults (campaign_id, email, name, personalized_*), so a partial upsert
    // ({id,status,sent_at}) violates NOT NULL and silently fails — which left
    // recipients stuck 'pending' and campaigns stuck 'sending' even after Resend
    // had sent everything. A single UPDATE by campaign + status avoids that.
    const lockSentAt = new Date().toISOString();
    const { error: lockErr } = await supabaseClient.from('email_campaign_recipients')
      .update({ status: 'sent', sent_at: lockSentAt })
      .eq('campaign_id', campaignId)
      .eq('status', 'pending');
    if (lockErr) console.error('[Lock] Failed to optimistically mark recipients sent:', lockErr.message);
    else console.log(`[Lock] Optimistically marked ${allPendingRecipients.length} recipients as sent — cron cannot double-send now`);

    let sentCount = 0;
    let failedCount = 0;

    // Resolve branding
    const { data: userProfile } = await supabaseClient.from('profiles')
      .select('full_name, job_title, email, avatar_url').eq('id', userId).maybeSingle();
    const { data: businessProfile } = await supabaseClient.from('business_profiles')
      .select('company_name, email_header_name, email_provider, email_template_style, email_logo_url, email_brand_color, email_footer_text, email_footer_image_url, email_footer_logo_url, email_sender_image_url, email_sender_name, email_signature_name, email_sender_title, email_sender_email, email_signature, website')
      .eq('user_id', userId).maybeSingle();

    let branding: any = {
      companyName: businessProfile?.company_name || null,
      headerName: businessProfile?.email_header_name || null,
      logoUrl: businessProfile?.email_logo_url ?? null,
      brandColor: businessProfile?.email_brand_color || '#8b5cf6',
      footerText: businessProfile?.email_footer_text ?? null,
      footerImageUrl: businessProfile?.email_footer_logo_url ?? businessProfile?.email_logo_url ?? null,
      signature: businessProfile?.email_signature ?? null,
      templateStyle: businessProfile?.email_template_style || 'professional',
      senderName: businessProfile?.email_sender_name ?? null,
      signatureName: businessProfile?.email_signature_name ?? null,
      senderEmail: businessProfile?.email_sender_email ?? null,
      senderTitle: businessProfile?.email_sender_title ?? null,
      senderImageUrl: businessProfile?.email_sender_image_url ?? null,
      websiteUrl: businessProfile?.website ?? null,
    };
    if (campaign.sender_profile_id) {
      const { data: senderProfile } = await supabaseClient.from('sender_profiles')
        .select('name, display_name, logo_url, brand_color, footer_text, footer_image_url, footer_logo_url, signature, template_style, sender_name, signature_name, sender_email, sender_title, sender_image_url, website_url')
        .eq('id', campaign.sender_profile_id).eq('user_id', userId).maybeSingle();
      if (senderProfile) {
        branding = {
          companyName: businessProfile?.company_name ?? null,
          headerName: senderProfile.display_name ?? businessProfile?.email_header_name ?? null,
          logoUrl: senderProfile.logo_url ?? businessProfile?.email_logo_url ?? null,
          brandColor: (senderProfile.brand_color || businessProfile?.email_brand_color) ?? '#8b5cf6',
          footerText: senderProfile.footer_text ?? businessProfile?.email_footer_text ?? null,
          footerImageUrl: senderProfile.footer_logo_url ?? senderProfile.logo_url ?? businessProfile?.email_footer_logo_url ?? businessProfile?.email_logo_url ?? businessProfile?.email_footer_image_url ?? null,
          signature: senderProfile.signature ?? businessProfile?.email_signature ?? null,
          templateStyle: ['professional', 'minimal', 'modern', 'creative', 'corporate', 'bold', 'elegant'].includes(senderProfile.template_style) ? senderProfile.template_style : (businessProfile?.email_template_style || 'professional'),
          senderName: senderProfile.sender_name ?? businessProfile?.email_sender_name ?? null,
          signatureName: senderProfile.signature_name ?? businessProfile?.email_signature_name ?? null,
          senderEmail: senderProfile.sender_email ?? businessProfile?.email_sender_email ?? null,
          senderTitle: senderProfile.sender_title ?? businessProfile?.email_sender_title ?? null,
          senderImageUrl: senderProfile.sender_image_url ?? businessProfile?.email_sender_image_url ?? null,
          websiteUrl: senderProfile.website_url ?? businessProfile?.website ?? null,
        };
      }
    }
    // A campaign's directly-uploaded header image overrides ALL branding images
    // (header logo + footer logo) so no branding image leaks through when applied.
    if (campaign.header_image_url) {
      branding.logoUrl = campaign.header_image_url;
      branding.footerImageUrl = null;
    }
    if (branding.logoUrl && !branding.companyName) branding.companyName = businessProfile?.company_name || 'Company';

    // Resolve connection
    let optimalConnection: any;
    if (campaign.sender_connection_id) {
      const { data: campaignConnection, error: connectionError } = await supabaseClient
        .from('crm_connections').select('*').eq('id', campaign.sender_connection_id)
        .eq('user_id', userId).eq('status', 'active').single();
      if (connectionError || !campaignConnection) {
        console.error('Campaign connection not found, falling back to optimal:', connectionError);
        const { data: connections } = await supabaseClient.from('crm_connections').select('*')
          .eq('user_id', userId).eq('status', 'active').order('tracking_enabled', { ascending: false });
        if (!connections || connections.length === 0) throw new Error('No active email connections found.');
        optimalConnection = connections.find((c: any) => c.tracking_enabled && ['resend', 'sendgrid'].includes(c.provider))
          || connections.find((c: any) => c.tracking_enabled && ['gmail', 'outlook'].includes(c.provider))
          || connections[0];
      } else {
        optimalConnection = campaignConnection;
      }
    } else {
      const { data: connections } = await supabaseClient.from('crm_connections').select('*')
        .eq('user_id', userId).eq('status', 'active').order('tracking_enabled', { ascending: false });
      if (!connections || connections.length === 0) throw new Error('No active email connections found. Please configure an email provider.');
      optimalConnection = connections.find((c: any) => c.tracking_enabled && ['resend', 'sendgrid'].includes(c.provider))
        || connections.find((c: any) => c.tracking_enabled && ['gmail', 'outlook'].includes(c.provider))
        || connections[0];
    }

    const emailProvider = optimalConnection.provider;
    console.log(`Using email provider: ${emailProvider} (connection: ${optimalConnection.id}, tracking: ${optimalConnection.tracking_enabled})`);

    let effectiveConnection = optimalConnection;
    if (!['resend', 'sendgrid'].includes(optimalConnection.provider)) {
      const { data: apiConnection } = await supabaseClient.from('crm_connections').select('from_email')
        .eq('user_id', userId).eq('provider', emailProvider).eq('status', 'active').maybeSingle();
      if (apiConnection?.from_email) effectiveConnection = { ...optimalConnection, from_email: apiConnection.from_email };
    }

    // ═══════════════════════════════════════════════════════════════════
    // RESEND — Batch-send ALL recipients at once via /emails/batch.
    // Strategy:
    //   1. Build payloads (CPU-only, sync)
    //   2. Fire ALL Resend batch calls in parallel (fast, ~1-2s total)
    //   3. Return response to caller IMMEDIATELY
    //   4. Run all DB writes + follow-ups + campaign completion in
    //      EdgeRuntime.waitUntil() so they never race against the
    //      function timeout and the cron never sees pending recipients again.
    // ═══════════════════════════════════════════════════════════════════
    if (emailProvider === 'resend') {
      const resendApiKey = Deno.env.get('RESEND_API_KEY');
      if (!resendApiKey) throw new Error('Resend not configured. Please add RESEND_API_KEY.');

      const senderName = branding.senderName || branding.companyName || userProfile?.full_name || 'CRM';
      const fromEmail = branding.senderEmail || effectiveConnection.from_email || userProfile?.email || 'onboarding@resend.dev';

      console.log(`[Resend] Building ${allPendingRecipients.length} email payloads…`);

      const payloads: Array<{
        recipientId: string; personId: string | null;
        resolvedSubject: string; resolvedBodyText: string; email: any;
      }> = [];
      const invalidEmailRows: any[] = [];

      for (const recipient of allPendingRecipients) {
        const emailStr = (recipient.email || '').trim();
        const isValidSingleEmail = /^[^\s@,]+@[^\s@,]+\.[^\s@,]+$/.test(emailStr);
        if (!emailStr || !isValidSingleEmail) {
          invalidEmailRows.push({
            id: recipient.id, status: 'failed',
            error_message: emailStr.includes(',')
              ? 'Multiple email addresses — re-add to split into separate recipients.'
              : 'Invalid email address',
          });
          failedCount++;
          continue;
        }

        const { subject, bodyText, bodyHtml } = resolveRecipientContent(recipient, campaign);
        const finalSubject = (subject && subject !== '(No subject)') ? subject : (campaign.name || 'Message for you');
        const finalBodyText = bodyText || `Hi ${recipient.name || ''},\n\nPlease see this message.\n\nThank you.`;
        const finalBodyHtml = bodyHtml || finalBodyText;

        const resolvedRecipient = { ...recipient, personalized_body_html: finalBodyHtml, personalized_body_text: finalBodyText };
        let wrappedHtml: string;
        try {
          wrappedHtml = buildWrappedHtml(resolvedRecipient, branding, userProfile, senderName, fromEmail);
        } catch (err: any) {
          console.error(`Template render error for ${recipient.email}:`, err);
          wrappedHtml = `<p>${finalBodyHtml.replace(/\n/g, '<br>')}</p>`;
        }
        payloads.push({
          recipientId: recipient.id, personId: recipient.person_id ?? null,
          resolvedSubject: finalSubject, resolvedBodyText: finalBodyText,
          email: {
            from: `${senderName} <${fromEmail}>`,
            to: [recipient.email],
            subject: finalSubject,
            text: finalBodyText,
            html: wrappedHtml,
            reply_to: RESEND_INBOUND_EMAIL,
            headers: { 'X-Priority': '3', Importance: 'normal' },
          },
        });
      }

      if (payloads.length === 0) {
        // Only invalid emails — nothing to send; return quickly
        await applyRecipientUpdates(supabaseClient, invalidEmailRows.map((r: any) => ({ ...r, sent_at: null })));
        await supabaseClient.from('email_campaigns').update({
          sent_count: campaign.sent_count,
          failed_count: campaign.failed_count + failedCount,
        }).eq('id', campaignId);
        return new Response(JSON.stringify({
          success: true, message: `0 sent — all ${failedCount} recipients had invalid/multi-address emails`,
          sent: 0, failed: failedCount,
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // Split into chunks of 100 (Resend /emails/batch hard limit)
      const DB_CHUNK = 500;
      const chunks: typeof payloads[] = [];
      for (let i = 0; i < payloads.length; i += RESEND_BATCH_SIZE) {
        chunks.push(payloads.slice(i, i + RESEND_BATCH_SIZE));
      }
      console.log(`[Resend] Firing ${payloads.length} emails across ${chunks.length} parallel batch call(s)`);
      const sentAt = new Date().toISOString();
      const recipientLookup = new Map(allPendingRecipients.map((r: any) => [r.id, r]));

      // ── Step 1: Fire ALL chunks to Resend simultaneously ──────────────────
      const chunkResults = await Promise.all(
        chunks.map(async (chunk, chunkIdx) => {
          try {
            const batchRes = await fetch('https://api.resend.com/emails/batch', {
              method: 'POST',
              headers: { 'Authorization': `Bearer ${resendApiKey}`, 'Content-Type': 'application/json' },
              body: JSON.stringify(chunk.map(c => c.email)),
            });
            if (!batchRes.ok) {
              const errText = await batchRes.text();
              const errMsg = parseResendError(batchRes.status, errText);
              console.error(`[Resend] Chunk ${chunkIdx + 1} failed (${batchRes.status}):`, errMsg);
              return { chunk, success: false as const, errMsg, messageIds: [] as (string | null)[] };
            }
            const batchResult = await batchRes.json();
            const messageIds: (string | null)[] = (batchResult.data || []).map((d: any) => d?.id ?? null);
            console.log(`[Resend] Chunk ${chunkIdx + 1}: accepted ${chunk.length} email(s)`);
            return { chunk, success: true as const, errMsg: null, messageIds };
          } catch (err: any) {
            console.error(`[Resend] Chunk ${chunkIdx + 1} exception:`, err);
            return { chunk, success: false as const, errMsg: err.message ?? 'Send error', messageIds: [] as (string | null)[] };
          }
        })
      );

      // ── Step 2: Consolidate what Resend accepted vs rejected ──────────────
      // Invalid emails were never locked (they were skipped before building payloads)
      // so we still need to write their failed status explicitly.
      const successUpsertRows: any[] = []; // just adds message IDs — status already 'sent'
      const activityRows: any[] = [];
      const failedUpsertRows: any[] = [...invalidEmailRows]; // these were never locked

      for (const result of chunkResults) {
        if (!result.success) {
          for (const c of result.chunk) {
            failedUpsertRows.push({ id: c.recipientId, status: 'failed', error_message: result.errMsg });
          }
          failedCount += result.chunk.length;
          continue;
        }
        for (let j = 0; j < result.chunk.length; j++) {
          const item = result.chunk[j];
          const msgId = result.messageIds[j] ?? null;
          successUpsertRows.push({ id: item.recipientId, status: 'sent', sent_at: sentAt, external_message_id: msgId });
          const rec = recipientLookup.get(item.recipientId);
          if (rec) {
            activityRows.push({
              contact_id: item.personId, step_number: 0,
              subject: item.resolvedSubject, body: item.resolvedBodyText,
              status: 'sent', sent_at: sentAt, external_message_id: msgId,
              metadata: {
                campaign_id: campaignId, provider: 'resend',
                sending_method: optimalConnection.sending_method,
                tracking_enabled: optimalConnection.tracking_enabled,
                can_track_opens: optimalConnection.capabilities?.opens || false,
                can_track_clicks: optimalConnection.capabilities?.clicks || false,
                can_track_replies: optimalConnection.capabilities?.replies || false,
                recipient_email: rec.email, recipient_name: rec.name,
              },
            });
          }
        }
        sentCount += result.chunk.length;
      }

      console.log(`[Resend] Accepted by Resend: ${sentCount} sent, ${failedCount} failed. Running DB writes in background…`);

      // ── Step 3: Push ALL DB work into background (EdgeRuntime.waitUntil) ──
      // This prevents the edge-function timeout from racing against DB writes.
      // The cron won't re-trigger because writes complete long before 15 minutes.
      const doBackgroundWrites = async () => {
        try {
          // Attach Resend message IDs to the (already 'sent') recipients so the
          // webhook can match delivered/opened/clicked events back to them.
          await applyRecipientUpdates(
            supabaseClient,
            successUpsertRows.map((r: any) => ({ id: r.id, external_message_id: r.external_message_id ?? null })),
          );
          // Correct the recipients that actually failed (undo the optimistic lock)
          await applyRecipientUpdates(
            supabaseClient,
            failedUpsertRows.map((r: any) => ({ id: r.id, status: 'failed', sent_at: null, error_message: r.error_message ?? null })),
          );
          // A/B history
          for (const result of chunkResults) {
            if (!result.success) continue;
            for (let j = 0; j < result.chunk.length; j++) {
              const item = result.chunk[j];
              const rec = recipientLookup.get(item.recipientId);
              if (rec) {
                const variantSent = rec.ab_variant === 'A' || rec.ab_variant === 'B' ? rec.ab_variant : null;
                if (variantSent && campaign.ab_test_enabled) {
                  await supabaseClient.from('email_campaign_send_history').insert({
                    campaign_id: campaignId, recipient_id: rec.id, variant_sent: variantSent, sent_at: sentAt,
                  });
                }
              }
            }
          }
          // Activity log
          for (let i = 0; i < activityRows.length; i += DB_CHUNK) {
            await supabaseClient.from('email_activities').insert(activityRows.slice(i, i + DB_CHUNK));
          }
          // Follow-up enrollments (non-fatal)
          await Promise.allSettled(
            successUpsertRows.map(row => {
              const rec = recipientLookup.get(row.id);
              return rec ? enrollFollowUp(supabaseClient, rec, campaign, campaignId, sentAt, row.external_message_id) : Promise.resolve();
            })
          );
          console.log(`[Resend BG] DB writes done. ${sentCount} sent, ${failedCount} failed`);
        } catch (bgErr) {
          console.error('[Resend BG] Background write error:', bgErr);
        }
      };

      // ── Finalize campaign status SYNCHRONOUSLY before responding ──────────
      // The optimistic lock already marked every recipient sent/failed, so there
      // are no pending recipients left. We update counts + completion here (not in
      // the background task) so the UI flips from "Sending" to "Completed" even if
      // the slower per-recipient background writes get cut off by the function
      // timeout. This was the cause of campaigns being stuck on "Sending".
      try {
        await supabaseClient.from('email_campaigns').update({
          sent_count: campaign.sent_count + sentCount,
          failed_count: campaign.failed_count + failedCount,
        }).eq('id', campaignId);
        const { count: remainingPending } = await supabaseClient
          .from('email_campaign_recipients')
          .select('*', { count: 'exact', head: true })
          .eq('campaign_id', campaignId).eq('status', 'pending');
        if ((remainingPending ?? 0) === 0) {
          await supabaseClient.from('email_campaigns').update({
            status: 'completed', completed_at: new Date().toISOString(),
          }).eq('id', campaignId);
        }
      } catch (finErr) {
        console.error('[Resend] Campaign finalize error:', finErr);
      }

      // Register with EdgeRuntime so the heavier per-recipient writes survive
      // after the response is sent (message IDs, activity log, A/B, follow-ups).
      try {
        (globalThis as any).EdgeRuntime.waitUntil(doBackgroundWrites());
      } catch {
        // EdgeRuntime not available (local dev) — run inline
        await doBackgroundWrites();
      }

      // ── Step 4: Return immediately — client gets result in seconds ────────
      return new Response(JSON.stringify({
        success: true,
        message: `${sentCount} emails dispatched to Resend — DB updating in background`,
        sent: sentCount,
        failed: failedCount,
        processing: true,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    } else if (emailProvider === 'gmail' || emailProvider === 'gmail_direct') {
      // ═══════════════════════════════════════════════════════════════
      // GMAIL — Daily limit of 450 emails. Cron continues the next day.
      // Sends via Gmail Direct API (OAuth) with pre-emptive token refresh.
      // ═══════════════════════════════════════════════════════════════
      const todayStart = new Date();
      todayStart.setUTCHours(0, 0, 0, 0);

      // Count all campaign emails sent by this user today (via any campaign)
      const { count: todaySentCount } = await supabaseClient
        .from('email_campaign_recipients')
        .select('email_campaigns!inner(user_id)', { count: 'exact', head: true })
        .eq('email_campaigns.user_id', userId!)
        .gte('sent_at', todayStart.toISOString())
        .in('status', ['sent', 'delivered', 'opened', 'clicked']);

      const remainingQuota = Math.max(0, GMAIL_DAILY_LIMIT - (todaySentCount || 0));
      const recipients = allPendingRecipients.slice(0, remainingQuota);

      console.log(`[Gmail] Daily quota: ${todaySentCount || 0} sent today, ${remainingQuota} remaining. Processing ${recipients.length} of ${allPendingRecipients.length} pending.`);

      if (recipients.length === 0) {
        console.log('[Gmail] Daily limit reached (450). Cron will pick up tomorrow.');
      }

      const { getValidGmailAccessToken, sendGmailMessage } = await import('../_shared/gmail-utils.ts');
      const { encodeRfc2047 } = await import('../_shared/gmail-utils.ts');
      const gmailFromEmail = (effectiveConnection.from_email || optimalConnection.from_email || '').trim();
      if (!gmailFromEmail) {
        throw new Error('Gmail connection has no from_email set. Reconnect Gmail in Settings.');
      }
      // Pre-emptively refresh once before the loop so the whole batch shares a fresh token.
      try {
        await getValidGmailAccessToken(supabaseClient, optimalConnection as any);
      } catch (refreshErr) {
        console.error('[Gmail] Pre-loop token refresh failed:', refreshErr);
        throw new Error('Failed to refresh Gmail token. Please reconnect Gmail in Settings.');
      }

      for (const recipient of recipients) {
        try {
          const gmailEmailStr = (recipient.email || '').trim();
          const isValidGmailEmail = /^[^\s@,]+@[^\s@,]+\.[^\s@,]+$/.test(gmailEmailStr);
          if (!gmailEmailStr || !isValidGmailEmail) {
            await supabaseClient.from('email_campaign_recipients').update({
              status: 'failed',
              error_message: gmailEmailStr.includes(',') ? 'Multiple email addresses — re-add this company to split into separate recipients.' : 'Invalid email address',
            }).eq('id', recipient.id);
            failedCount++;
            continue;
          }

          // Resolve subject/body — fall back to campaign templates if personalization is missing
          const { subject: gmailSubject, bodyText: gmailBodyText } = resolveRecipientContent(recipient, campaign);
          if (!gmailSubject || gmailSubject === '(No subject)') {
            await supabaseClient.from('email_campaign_recipients').update({
              status: 'failed',
              error_message: 'Missing email subject — please set a subject template on the campaign.',
            }).eq('id', recipient.id);
            failedCount++;
            continue;
          }

          // Build RFC 2822 message and base64url encode
          const toLine = recipient.name
            ? `${encodeRfc2047(recipient.name)} <${recipient.email}>`
            : recipient.email;
          const rawMessage = [
            `From: ${gmailFromEmail}`,
            `To: ${toLine}`,
            `Subject: ${encodeRfc2047(gmailSubject)}`,
            'MIME-Version: 1.0',
            'Content-Type: text/plain; charset=UTF-8',
            '',
            gmailBodyText,
          ].join('\r\n');
          const rawB64Url = btoa(unescape(encodeURIComponent(rawMessage)))
            .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

          const gmailData = await sendGmailMessage(supabaseClient, optimalConnection as any, rawB64Url);
          const messageId = gmailData?.id || null;

          // Recipient already locked as 'sent' — just add message ID
          await supabaseClient.from('email_campaign_recipients').update({
            external_message_id: messageId,
          }).eq('id', recipient.id);

          const variantSent = recipient.ab_variant === 'A' || recipient.ab_variant === 'B' ? recipient.ab_variant : null;
          if (variantSent && campaign.ab_test_enabled) {
            await supabaseClient.from('email_campaign_send_history').insert({
              campaign_id: campaignId, recipient_id: recipient.id, variant_sent: variantSent, sent_at: lockSentAt,
            });
          }

          await supabaseClient.from('email_activities').insert({
            contact_id: recipient.person_id, step_number: 0,
            subject: gmailSubject, body: gmailBodyText,
            status: 'sent', sent_at: lockSentAt, external_message_id: messageId,
            metadata: {
              campaign_id: campaignId, provider: 'gmail_direct',
              sending_method: optimalConnection.sending_method,
              tracking_enabled: optimalConnection.tracking_enabled,
              can_track_opens: optimalConnection.capabilities?.opens || false,
              can_track_clicks: optimalConnection.capabilities?.clicks || false,
              can_track_replies: optimalConnection.capabilities?.replies || false,
              recipient_email: recipient.email, recipient_name: recipient.name,
            },
          });

          await enrollFollowUp(supabaseClient, recipient, campaign, campaignId, lockSentAt, messageId);

          sentCount++;
          // 1-second gap between Gmail sends to stay within rate limits
          await new Promise((resolve) => setTimeout(resolve, 1000));

        } catch (error: any) {
          console.error(`[Gmail] Failed to send to ${recipient.email}:`, error);
          // Correct the optimistic lock — this recipient actually failed
          await supabaseClient.from('email_campaign_recipients').update({
            status: 'failed', sent_at: null, error_message: error.message,
          }).eq('id', recipient.id);
          failedCount++;
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }

    } else {
      // ═══════════════════════════════════════════════════════════════
      // SENDGRID / SMTP — Individual sends, no artificial delay
      // ═══════════════════════════════════════════════════════════════
      for (const recipient of allPendingRecipients) {
        try {
          const sgEmailStr = (recipient.email || '').trim();
          const isValidSgEmail = /^[^\s@,]+@[^\s@,]+\.[^\s@,]+$/.test(sgEmailStr);
          if (!sgEmailStr || !isValidSgEmail) {
            await supabaseClient.from('email_campaign_recipients').update({
              status: 'failed',
              error_message: sgEmailStr.includes(',') ? 'Multiple email addresses — re-add this company to split into separate recipients.' : 'Invalid email address',
            }).eq('id', recipient.id);
            failedCount++;
            continue;
          }

          // Resolve subject/body — fall back to campaign templates if personalization is missing
          const { subject: sgSubject, bodyText, bodyHtml: bodyHtmlRaw } = resolveRecipientContent(recipient, campaign);
          if (!sgSubject || sgSubject === '(No subject)') {
            await supabaseClient.from('email_campaign_recipients').update({
              status: 'failed',
              error_message: 'Missing email subject — please set a subject template on the campaign.',
            }).eq('id', recipient.id);
            failedCount++;
            continue;
          }
          let messageId: string | null = null;

          if (emailProvider === 'smtp') {
            const senderName = branding.senderName || branding.companyName || userProfile?.full_name || 'Your Business';
            const fromEmail = branding.senderEmail || optimalConnection.from_email || userProfile?.email || 'noreply@yourdomain.com';
            const resolvedRecipientForSmtp = { ...recipient, personalized_body_html: bodyHtmlRaw, personalized_body_text: bodyText };
            let wrappedHtml: string;
            try {
              wrappedHtml = buildWrappedHtml(resolvedRecipientForSmtp, branding, userProfile, senderName, fromEmail);
            } catch (templateError: any) {
              throw new Error(`Failed to render email template: ${templateError instanceof Error ? templateError.message : String(templateError)}`);
            }

            const smtpMode = (optimalConnection.metadata as any)?.smtp_mode || 'direct';
            if (smtpMode === 'direct' && (optimalConnection.metadata as any)?.smtp_host) {
              const smtpConfig = optimalConnection.metadata as any;
              const client = new SMTPClient({
                connection: {
                  hostname: smtpConfig.smtp_host,
                  port: smtpConfig.smtp_port || 587,
                  tls: smtpConfig.smtp_secure !== false,
                  auth: { username: smtpConfig.smtp_username, password: smtpConfig.smtp_password },
                },
              });
              await client.send({
                from: `${senderName} <${optimalConnection.from_email}>`,
                to: recipient.email,
                subject: sgSubject,
                content: bodyText,
                html: wrappedHtml,
              });
              await client.close();
              messageId = `direct-smtp-${Date.now()}`;
            } else {
              // SMTP relay via Resend
              const resendApiKey = Deno.env.get('RESEND_API_KEY');
              if (!resendApiKey) throw new Error('Email service not configured');
              const effectiveFromEmail = effectiveConnection.from_email || userProfile?.email;
              if (!effectiveFromEmail) throw new Error('Business Email not configured.');
              const resendResponse = await fetch('https://api.resend.com/emails', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${resendApiKey}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  from: `${senderName} <${effectiveFromEmail}>`,
                  to: [recipient.email],
                  subject: sgSubject,
                  text: bodyText,
                  html: wrappedHtml,
                }),
              });
              if (!resendResponse.ok) {
                const errorData = await resendResponse.text();
                throw new Error(parseResendError(resendResponse.status, errorData));
              }
              messageId = (await resendResponse.json()).id || null;
            }
          } else if (emailProvider === 'sendgrid') {
            const sendgridApiKey = Deno.env.get('SENDGRID_API_KEY');
            if (!sendgridApiKey) throw new Error('SendGrid not configured');
            const senderName = branding.senderName || branding.companyName || userProfile?.full_name || 'Your Business';
            const fromEmail = branding.senderEmail || effectiveConnection.from_email || userProfile?.email;
            if (!fromEmail) throw new Error('Business Email not configured.');
            const resolvedRecipientForSg = { ...recipient, personalized_body_html: bodyHtmlRaw, personalized_body_text: bodyText };
            let wrappedHtml: string;
            try {
              wrappedHtml = buildWrappedHtml(resolvedRecipientForSg, branding, userProfile, senderName, fromEmail);
            } catch (templateError: any) {
              throw new Error(`Failed to render email template: ${templateError instanceof Error ? templateError.message : String(templateError)}`);
            }
            const sendgridResponse = await fetch('https://api.sendgrid.com/v3/mail/send', {
              method: 'POST',
              headers: { 'Authorization': `Bearer ${sendgridApiKey}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({
                personalizations: [{ to: [{ email: recipient.email, name: recipient.name }], subject: sgSubject }],
                from: { email: fromEmail, name: senderName },
                reply_to: { email: fromEmail, name: senderName },
                content: [
                  { type: 'text/plain', value: bodyText },
                  { type: 'text/html', value: wrappedHtml },
                ],
              }),
            });
            if (!sendgridResponse.ok) throw new Error('SendGrid send failed');
            messageId = sendgridResponse.headers.get('X-Message-Id') || null;
          } else {
            throw new Error(`Unsupported email provider: ${emailProvider}`);
          }

          // Recipient already locked as 'sent' — just add message ID
          await supabaseClient.from('email_campaign_recipients').update({
            external_message_id: messageId,
          }).eq('id', recipient.id);

          const variantSent = recipient.ab_variant === 'A' || recipient.ab_variant === 'B' ? recipient.ab_variant : null;
          if (variantSent && campaign.ab_test_enabled) {
            await supabaseClient.from('email_campaign_send_history').insert({
              campaign_id: campaignId, recipient_id: recipient.id, variant_sent: variantSent, sent_at: lockSentAt,
            });
          }

          await supabaseClient.from('email_activities').insert({
            contact_id: recipient.person_id, step_number: 0,
            subject: sgSubject, body: bodyText,
            status: 'sent', sent_at: lockSentAt, external_message_id: messageId,
            metadata: {
              campaign_id: campaignId, provider: emailProvider,
              sending_method: optimalConnection.sending_method,
              tracking_enabled: optimalConnection.tracking_enabled,
              can_track_opens: optimalConnection.capabilities?.opens || false,
              can_track_clicks: optimalConnection.capabilities?.clicks || false,
              can_track_replies: optimalConnection.capabilities?.replies || false,
              recipient_email: recipient.email, recipient_name: recipient.name,
            },
          });

          await enrollFollowUp(supabaseClient, recipient, campaign, campaignId, lockSentAt, messageId);

          sentCount++;

        } catch (error: any) {
          console.error(`Failed to send to ${recipient.email}:`, error);
          // Correct the optimistic lock — this recipient actually failed
          await supabaseClient.from('email_campaign_recipients').update({
            status: 'failed', sent_at: null, error_message: error.message,
          }).eq('id', recipient.id);
          failedCount++;
        }
      }
    }

    // Update campaign sent/failed counts
    await supabaseClient.from('email_campaigns').update({
      sent_count: campaign.sent_count + sentCount,
      failed_count: campaign.failed_count + failedCount,
    }).eq('id', campaignId);

    // Check remaining pending recipients
    const { count } = await supabaseClient
      .from('email_campaign_recipients')
      .select('*', { count: 'exact', head: true })
      .eq('campaign_id', campaignId)
      .eq('status', 'pending');

    // Mark completed when no pending remain
    if (count === 0) {
      await supabaseClient.from('email_campaigns').update({
        status: 'completed',
        completed_at: new Date().toISOString()
      }).eq('id', campaignId);
    }
    // Gmail with remaining pending: leave as 'sending' — cron picks up tomorrow

    console.log(`Campaign send complete: ${sentCount} sent, ${failedCount} failed, ${count ?? 0} still pending`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Sent ${sentCount} emails, ${failedCount} failed`,
        sent: sentCount,
        failed: failedCount,
        remainingPending: count,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in send-bulk-emails function:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'An error occurred' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
