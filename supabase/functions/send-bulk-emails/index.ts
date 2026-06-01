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
    const { campaignId, triggeredByCron } = await req.json();

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

    // Get ALL pending recipients — provider-specific limits applied below
    const { data: allPendingRecipients, error: recipientsError } = await supabaseClient
      .from('email_campaign_recipients')
      .select('*')
      .eq('campaign_id', campaignId)
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(5000);

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
    if (campaign.header_image_url) branding.logoUrl = campaign.header_image_url;
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
    // RESEND — Batch-send all recipients in chunks of 100 via /emails/batch
    // No cron batching needed; Resend handles thousands in seconds.
    // ═══════════════════════════════════════════════════════════════════
    if (emailProvider === 'resend') {
      const resendApiKey = Deno.env.get('RESEND_API_KEY');
      if (!resendApiKey) throw new Error('Resend not configured. Please add RESEND_API_KEY.');

      const senderName = branding.senderName || branding.companyName || userProfile?.full_name || 'CRM';
      const fromEmail = branding.senderEmail || effectiveConnection.from_email || userProfile?.email || 'onboarding@resend.dev';

      console.log(`[Resend] Building ${allPendingRecipients.length} email payloads…`);

      // Build all payloads (template render is CPU-only, no I/O)
      const payloads: Array<{ recipientId: string; personId: string | null; email: any }> = [];
      for (const recipient of allPendingRecipients) {
        if (!recipient.personalized_subject) {
          console.warn(`Skipping recipient ${recipient.id}: missing subject`);
          continue;
        }
        // Guard: skip recipients whose email field is multi-address (comma-separated) — those should have been split at import time
        const emailStr = (recipient.email || '').trim();
        const isValidSingleEmail = /^[^\s@,]+@[^\s@,]+\.[^\s@,]+$/.test(emailStr);
        if (!emailStr || !isValidSingleEmail) {
          console.warn(`Skipping recipient ${recipient.id}: invalid or multi-address email "${emailStr}"`);
          await supabaseClient.from('email_campaign_recipients').update({
            status: 'failed',
            error_message: emailStr.includes(',') ? 'Multiple email addresses in one recipient — re-add this company to split into separate recipients.' : 'Invalid email address',
          }).eq('id', recipient.id);
          failedCount++;
          continue;
        }
        let wrappedHtml: string;
        try {
          wrappedHtml = buildWrappedHtml(recipient, branding, userProfile, senderName, fromEmail);
        } catch (err: any) {
          console.error(`Template render error for ${recipient.email}:`, err);
          wrappedHtml = `<p>${(recipient.personalized_body_html || recipient.personalized_body_text || '').replace(/\n/g, '<br>')}</p>`;
        }
        payloads.push({
          recipientId: recipient.id,
          personId: recipient.person_id ?? null,
          email: {
            from: `${senderName} <${fromEmail}>`,
            to: [recipient.email],
            subject: recipient.personalized_subject,
            text: recipient.personalized_body_text || '',
            html: wrappedHtml,
            reply_to: RESEND_INBOUND_EMAIL,
            headers: { 'X-Priority': '3', Importance: 'normal' },
          },
        });
      }

      console.log(`[Resend] Sending ${payloads.length} emails in batches of ${RESEND_BATCH_SIZE}`);
      const sentAt = new Date().toISOString();

      for (let i = 0; i < payloads.length; i += RESEND_BATCH_SIZE) {
        const chunk = payloads.slice(i, i + RESEND_BATCH_SIZE);
        const chunkNum = Math.floor(i / RESEND_BATCH_SIZE) + 1;
        try {
          const batchRes = await fetch('https://api.resend.com/emails/batch', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${resendApiKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(chunk.map(c => c.email)),
          });

          if (!batchRes.ok) {
            const errText = await batchRes.text();
            const errMsg = parseResendError(batchRes.status, errText);
            console.error(`[Resend] Chunk ${chunkNum} failed:`, errMsg);
            const failUpdates = chunk.map(c => ({ id: c.recipientId, status: 'failed', error_message: errMsg }));
            for (const u of failUpdates) {
              await supabaseClient.from('email_campaign_recipients').update({ status: 'failed', error_message: u.error_message }).eq('id', u.id);
            }
            failedCount += chunk.length;
            continue;
          }

          const batchResult = await batchRes.json();
          // batchResult.data: Array<{ id: string }>
          const messageIds: (string | null)[] = (batchResult.data || []).map((d: any) => d?.id ?? null);

          // Bulk-update recipients (upsert on primary key)
          await supabaseClient.from('email_campaign_recipients').upsert(
            chunk.map((c, idx) => ({
              id: c.recipientId,
              status: 'sent',
              sent_at: sentAt,
              external_message_id: messageIds[idx] ?? null,
            })),
            { onConflict: 'id' }
          );

          // Record A/B history + bulk-insert activities
          const activityRows = [];
          for (let j = 0; j < chunk.length; j++) {
            const item = chunk[j];
            const rec = allPendingRecipients.find((r: any) => r.id === item.recipientId);
            if (!rec) continue;

            // A/B history
            const variantSent = rec.ab_variant === 'A' || rec.ab_variant === 'B' ? rec.ab_variant : null;
            if (variantSent && campaign.ab_test_enabled) {
              await supabaseClient.from('email_campaign_send_history').insert({
                campaign_id: campaignId, recipient_id: rec.id, variant_sent: variantSent, sent_at: sentAt,
              });
            }

            activityRows.push({
              contact_id: item.personId,
              step_number: 0,
              subject: rec.personalized_subject,
              body: rec.personalized_body_text,
              status: 'sent',
              sent_at: sentAt,
              external_message_id: messageIds[j] ?? null,
              metadata: {
                campaign_id: campaignId,
                provider: 'resend',
                sending_method: optimalConnection.sending_method,
                tracking_enabled: optimalConnection.tracking_enabled,
                can_track_opens: optimalConnection.capabilities?.opens || false,
                can_track_clicks: optimalConnection.capabilities?.clicks || false,
                can_track_replies: optimalConnection.capabilities?.replies || false,
                recipient_email: rec.email,
                recipient_name: rec.name,
              },
            });

            // Auto follow-up (fire and forget per recipient)
            await enrollFollowUp(supabaseClient, rec, campaign, campaignId, sentAt, messageIds[j] ?? null);
          }

          if (activityRows.length > 0) {
            await supabaseClient.from('email_activities').insert(activityRows);
          }

          sentCount += chunk.length;
          console.log(`[Resend] Chunk ${chunkNum}: sent ${chunk.length}  |  total so far: ${sentCount}`);
        } catch (chunkErr: any) {
          console.error(`[Resend] Chunk ${chunkNum} exception:`, chunkErr);
          for (const c of chunk) {
            await supabaseClient.from('email_campaign_recipients').update({ status: 'failed', error_message: chunkErr.message }).eq('id', c.recipientId);
          }
          failedCount += chunk.length;
        }
      }

    } else if (emailProvider === 'gmail') {
      // ═══════════════════════════════════════════════════════════════
      // GMAIL — Daily limit of 450 emails. Cron continues the next day.
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

      for (const recipient of recipients) {
        try {
          if (!recipient.personalized_subject) {
            throw new Error(`Missing subject for recipient ${recipient.id}`);
          }
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

          const nangoSecretKey = Deno.env.get('NANGO_SECRET_KEY');
          if (!nangoSecretKey) throw new Error('Gmail not configured');

          const nangoResponse = await fetch('https://api.nango.dev/v1/gmail/messages', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${nangoSecretKey}`,
              'Connection-Id': optimalConnection.connection_id,
              'Provider-Config-Key': 'google-mail',
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              to: [{ email: recipient.email, name: recipient.name }],
              subject: recipient.personalized_subject,
              body: { content: recipient.personalized_body_text, type: 'text/plain' },
            }),
          });

          if (!nangoResponse.ok) throw new Error('Gmail send failed');

          const nangoData = await nangoResponse.json();
          const messageId = nangoData.id || null;
          const sentAt = new Date().toISOString();

          await supabaseClient.from('email_campaign_recipients').update({
            status: 'sent', sent_at: sentAt, external_message_id: messageId,
          }).eq('id', recipient.id);

          const variantSent = recipient.ab_variant === 'A' || recipient.ab_variant === 'B' ? recipient.ab_variant : null;
          if (variantSent && campaign.ab_test_enabled) {
            await supabaseClient.from('email_campaign_send_history').insert({
              campaign_id: campaignId, recipient_id: recipient.id, variant_sent: variantSent, sent_at: sentAt,
            });
          }

          await supabaseClient.from('email_activities').insert({
            contact_id: recipient.person_id, step_number: 0,
            subject: recipient.personalized_subject, body: recipient.personalized_body_text,
            status: 'sent', sent_at: sentAt, external_message_id: messageId,
            metadata: {
              campaign_id: campaignId, provider: 'gmail',
              sending_method: optimalConnection.sending_method,
              tracking_enabled: optimalConnection.tracking_enabled,
              can_track_opens: optimalConnection.capabilities?.opens || false,
              can_track_clicks: optimalConnection.capabilities?.clicks || false,
              can_track_replies: optimalConnection.capabilities?.replies || false,
              recipient_email: recipient.email, recipient_name: recipient.name,
            },
          });

          await enrollFollowUp(supabaseClient, recipient, campaign, campaignId, sentAt, messageId);

          sentCount++;
          // 1-second gap between Gmail sends to stay within rate limits
          await new Promise((resolve) => setTimeout(resolve, 1000));

        } catch (error: any) {
          console.error(`[Gmail] Failed to send to ${recipient.email}:`, error);
          await supabaseClient.from('email_campaign_recipients').update({
            status: 'failed', error_message: error.message,
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
          if (!recipient.personalized_subject) {
            throw new Error(`Missing subject for recipient ${recipient.id}`);
          }
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
          const bodyText = recipient.personalized_body_text || '';
          const bodyHtmlRaw = recipient.personalized_body_html || '';
          if (!bodyText.trim() && !bodyHtmlRaw.trim()) {
            throw new Error(`No body content for recipient ${sgEmailStr}`);
          }

          let messageId: string | null = null;

          if (emailProvider === 'smtp') {
            const senderName = branding.senderName || branding.companyName || userProfile?.full_name || 'Your Business';
            const fromEmail = branding.senderEmail || optimalConnection.from_email || userProfile?.email || 'noreply@yourdomain.com';
            let wrappedHtml: string;
            try {
              wrappedHtml = buildWrappedHtml(recipient, branding, userProfile, senderName, fromEmail);
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
                subject: recipient.personalized_subject,
                content: recipient.personalized_body_text,
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
                  subject: recipient.personalized_subject,
                  text: recipient.personalized_body_text,
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
            let wrappedHtml: string;
            try {
              wrappedHtml = buildWrappedHtml(recipient, branding, userProfile, senderName, fromEmail);
            } catch (templateError: any) {
              throw new Error(`Failed to render email template: ${templateError instanceof Error ? templateError.message : String(templateError)}`);
            }
            const sendgridResponse = await fetch('https://api.sendgrid.com/v3/mail/send', {
              method: 'POST',
              headers: { 'Authorization': `Bearer ${sendgridApiKey}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({
                personalizations: [{ to: [{ email: recipient.email, name: recipient.name }], subject: recipient.personalized_subject }],
                from: { email: fromEmail, name: senderName },
                reply_to: { email: fromEmail, name: senderName },
                content: [
                  { type: 'text/plain', value: recipient.personalized_body_text },
                  { type: 'text/html', value: wrappedHtml },
                ],
              }),
            });
            if (!sendgridResponse.ok) throw new Error('SendGrid send failed');
            messageId = sendgridResponse.headers.get('X-Message-Id') || null;
          } else {
            throw new Error(`Unsupported email provider: ${emailProvider}`);
          }

          const sentAt = new Date().toISOString();
          await supabaseClient.from('email_campaign_recipients').update({
            status: 'sent', sent_at: sentAt, external_message_id: messageId,
          }).eq('id', recipient.id);

          const variantSent = recipient.ab_variant === 'A' || recipient.ab_variant === 'B' ? recipient.ab_variant : null;
          if (variantSent && campaign.ab_test_enabled) {
            await supabaseClient.from('email_campaign_send_history').insert({
              campaign_id: campaignId, recipient_id: recipient.id, variant_sent: variantSent, sent_at: sentAt,
            });
          }

          await supabaseClient.from('email_activities').insert({
            contact_id: recipient.person_id, step_number: 0,
            subject: recipient.personalized_subject, body: recipient.personalized_body_text,
            status: 'sent', sent_at: sentAt, external_message_id: messageId,
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

          await enrollFollowUp(supabaseClient, recipient, campaign, campaignId, sentAt, messageId);

          sentCount++;
          // No artificial delay for API-based providers (SendGrid, SMTP relay)

        } catch (error: any) {
          console.error(`Failed to send to ${recipient.email}:`, error);
          await supabaseClient.from('email_campaign_recipients').update({
            status: 'failed', error_message: error.message,
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
