import { resendFromAddress } from "../_shared/resend-from.ts";
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { renderEmailTemplate } from '../_shared/professional-template.ts';
import { emailRejectReason, loadSuppressedEmails, normalizeEmail, greetingFirstName } from '../_shared/email-quality.ts';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const SENDGRID_API_KEY = Deno.env.get('SENDGRID_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const RESEND_INBOUND_EMAIL = Deno.env.get('RESEND_INBOUND_EMAIL') || 'leadgenie@eldapgraaa.resend.app';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { companySequenceId, stepNumber } = await req.json();

    if (!companySequenceId || stepNumber === undefined) {
      throw new Error('Missing required fields: companySequenceId, stepNumber');
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Fetch company sequence with related data (company.user_id for branding when no auth)
    const { data: companySequence, error: sequenceError } = await supabase
      .from('company_sequences')
      .select(`
        *,
        company:companies(id, name, website, user_id),
        sequence:email_sequences(name, use_email_branding)
      `)
      .eq('id', companySequenceId)
      .single();

    if (sequenceError || !companySequence) {
      throw new Error(`Company sequence not found: ${sequenceError?.message}`);
    }

    // Check if sequence is active
    if (companySequence.status !== 'active') {
      throw new Error('Sequence is not active');
    }

    // Get the email step
    const emailStep = companySequence.personalized_emails?.find(
      (e: any) => e.stepNumber === stepNumber
    );

    if (!emailStep) {
      throw new Error(`Step ${stepNumber} not found`);
    }

    // The campaign enrolment stores step 0 as a '(Campaign)' stub with no body —
    // the campaign email itself already went out. Never send a stub or an empty step.
    const stepBody = String(emailStep.body || '').trim();
    if (!stepBody || emailStep.subject === '(Campaign)') {
      console.warn(`Sequence ${companySequenceId}: step ${stepNumber} has no content (placeholder) — not sending`);
      return new Response(
        JSON.stringify({ success: false, skipped: true, reason: 'empty_or_placeholder_step' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // Fetch contacts for this company. Campaign enrollments often only create
    // `people` rows — ensure a verified contacts row exists so auto-sequence can send.
    let { data: contacts, error: contactsError } = await supabase
      .from('contacts')
      .select('*')
      .eq('company_id', companySequence.company_id)
      .eq('email_verified', true)
      .limit(1);

    if (contactsError) {
      throw new Error(`Failed to load contacts: ${contactsError.message}`);
    }

    if (!contacts || contacts.length === 0) {
      // Prefer person linked via campaign recipient / prior activity metadata
      const { data: people } = await supabase
        .from('people')
        .select('id, email, first_name, last_name, company_id')
        .eq('company_id', companySequence.company_id)
        .not('email', 'is', null)
        .limit(1);

      const person = people?.[0];
      if (!person?.email) {
        throw new Error('No verified contacts found for this company');
      }

      const fullName = [person.first_name, person.last_name].filter(Boolean).join(' ') || person.email;
      const { data: existingContact } = await supabase
        .from('contacts')
        .select('*')
        .eq('company_id', companySequence.company_id)
        .eq('email', person.email)
        .maybeSingle();

      if (existingContact) {
        if (!existingContact.email_verified) {
          await supabase.from('contacts').update({ email_verified: true }).eq('id', existingContact.id);
          existingContact.email_verified = true;
        }
        contacts = [existingContact];
      } else {
        const { data: created, error: createErr } = await supabase
          .from('contacts')
          .insert({
            company_id: companySequence.company_id,
            name: fullName,
            email: person.email,
            email_verified: true,
            is_primary_contact: true,
          })
          .select('*')
          .single();
        if (createErr || !created) {
          throw new Error(`No verified contacts found for this company (${createErr?.message || 'create failed'})`);
        }
        contacts = [created];
      }
    }

    const contact = contacts[0];

    // Resolve user: auth token first, else company owner (for server/cron calls)
    const authHeader = req.headers.get('Authorization');
    const token = authHeader ? authHeader.replace('Bearer ', '') : null;
    const { data: { user: authUser } } = token
      ? await supabase.auth.getUser(token)
      : { data: { user: null } };
    const company = companySequence.company as { id: string; name: string; website?: string; user_id?: string } | null;
    const userId = authUser?.id ?? company?.user_id ?? null;

    // Stop before sending to junk or previously bounced addresses, and pause the
    // sequence so it does not retry every tick.
    {
      const to = normalizeEmail((contact as any).email);
      const junk = emailRejectReason(to);
      const suppressed = !junk && (await loadSuppressedEmails(supabase, userId)).has(to);
      if (junk || suppressed) {
        const reason = junk ? `invalid recipient: ${junk}` : 'recipient previously bounced';
        console.warn(`Sequence ${companySequenceId}: not sending to ${to} (${reason}) — pausing`);
        await supabase.from('contacts').update({ email_verified: false }).eq('id', (contact as any).id);
        await supabase.from('company_sequences')
          .update({ status: 'paused', next_action: 'paused', updated_at: new Date().toISOString() })
          .eq('id', companySequenceId);
        return new Response(
          JSON.stringify({ success: false, skipped: true, reason }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      }
    }

    // Personalize the step's subject/body with the recipient contact's details.
    // The follow-up templates carry {{firstName}} etc. verbatim, so substitute here
    // (send-sequence-email never did, which is why literal {{firstName}} shipped).
    {
      const cname = String((contact as any).name || '').trim();
      const cfirst = greetingFirstName(cname, { company: company?.name, email: (contact as any).email });
      const clast = cname ? cname.split(/\s+/).slice(1).join(' ') : '';
      const cfull = cname || String((contact as any).email || '');
      const ccompany = String(company?.name || '').trim();
      const cemail = String((contact as any).email || '');
      const fill = (tpl: string): string => (tpl || '')
        .replace(/\{\{\s*first[_ ]?name\s*\}\}/gi, cfirst)
        .replace(/\{\{\s*last[_ ]?name\s*\}\}/gi, clast)
        .replace(/\{\{\s*full[_ ]?name\s*\}\}/gi, cfull)
        .replace(/\{\{\s*name\s*\}\}/gi, cfull)
        .replace(/\{\{\s*company([_ ]?name)?\s*\}\}/gi, ccompany)
        .replace(/\{\{\s*email\s*\}\}/gi, cemail);
      emailStep.subject = fill(emailStep.subject);
      emailStep.body = fill(emailStep.body);
    }

    // Get business profile: email provider and optionally full branding for template
    let emailProvider = 'resend';
    let fromEmail = 'noreply@yourdomain.com';
    let senderName = 'Your Company';
    let branding: { companyName: string | null; headerName: string | null; logoUrl: string | null; brandColor: string; footerText: string | null; footerImageUrl: string | null; signature: string | null; templateStyle: string; senderName: string | null; signatureName: string | null; senderEmail: string | null; senderTitle: string | null; senderImageUrl: string | null; websiteUrl: string | null } | null = null;

    if (userId) {
      const { data: userProfile } = await supabase
        .from('profiles')
        .select('email, full_name, job_title, avatar_url')
        .eq('id', userId)
        .maybeSingle();

      const { data: businessProfile } = await supabase
        .from('business_profiles')
        .select('company_name, email_header_name, email_provider, email_template_style, email_logo_url, email_brand_color, email_footer_text, email_footer_image_url, email_footer_logo_url, email_sender_image_url, email_sender_name, email_signature_name, email_sender_title, email_sender_email, email_signature, website')
        .eq('user_id', userId)
        .maybeSingle();

      emailProvider = businessProfile?.email_provider || 'resend';
      senderName = businessProfile?.company_name || 'Your Company';
      fromEmail = (await (async () => {
        // limit(1), not maybeSingle(): with several senders on one provider (e.g. two
        // Resend addresses) maybeSingle() errors and the From fell back to the login email.
        const { data: rows } = await supabase
          .from('crm_connections')
          .select('from_email')
          .eq('user_id', userId)
          .in('provider', [emailProvider, 'smtp'])
          .eq('status', 'active')
          .order('provider', { ascending: emailProvider === 'smtp' })
          .limit(1);
        return rows?.[0]?.from_email || userProfile?.email || 'noreply@yourdomain.com';
      })()) as string;

      // Follow-ups go out through the same account as the campaign that started the
      // sequence. Previously they always used Business Profile → Email Provider, so a
      // campaign sent via Resend had its follow-ups sent from the user's Gmail.
      const campaignId = (companySequence as { campaign_id?: string | null }).campaign_id;
      if (campaignId) {
        const { data: camp } = await supabase
          .from('email_campaigns')
          .select('sender_connection_id')
          .eq('id', campaignId)
          .eq('user_id', userId)
          .maybeSingle();
        let conn: { provider: string; from_email: string | null } | null = null;
        if (camp?.sender_connection_id) {
          const { data } = await supabase
            .from('crm_connections')
            .select('provider, from_email')
            .eq('id', camp.sender_connection_id)
            .eq('user_id', userId)
            .eq('status', 'active')
            .maybeSingle();
          conn = data;
        }
        if (!conn) {
          // Campaign had no explicit sender: send-bulk-emails prefers an active Resend /
          // SendGrid account, so mirror that rather than dropping to Gmail.
          const { data: apiConns } = await supabase
            .from('crm_connections')
            .select('provider, from_email, tracking_enabled')
            .eq('user_id', userId)
            .eq('status', 'active')
            .in('provider', ['resend', 'sendgrid'])
            .order('tracking_enabled', { ascending: false })
            .limit(1);
          conn = apiConns?.[0] ?? null;
        }
        if (conn) {
          emailProvider = conn.provider;
          if (conn.from_email) fromEmail = conn.from_email;
        }
      }

      const useBranding = (companySequence.sequence as { use_email_branding?: boolean } | null)?.use_email_branding !== false;
      if (useBranding && businessProfile) {
        const bp = businessProfile as Record<string, unknown>;
        branding = {
          companyName: (bp.company_name as string) ?? null,
          headerName: (bp.email_header_name as string) ?? null,
          logoUrl: (bp.email_logo_url as string) ?? null,
          brandColor: (bp.email_brand_color as string) || '#8b5cf6',
          footerText: (bp.email_footer_text as string) ?? null,
          footerImageUrl: (bp.email_footer_logo_url as string) ?? (bp.email_logo_url as string) ?? null,
          signature: (bp.email_signature as string) ?? null,
          templateStyle: (bp.email_template_style as string) || 'professional',
          senderName: (bp.email_sender_name as string) ?? null,
          signatureName: (bp.email_signature_name as string) ?? null,
          senderEmail: (bp.email_sender_email as string) ?? null,
          senderTitle: (bp.email_sender_title as string) ?? null,
          senderImageUrl: (bp.email_sender_image_url as string) ?? null,
          websiteUrl: (bp.website as string) ?? null,
        };
        // Overlay sender profile when sequence was enrolled from a campaign with a product (e.g. TALKWEB)
        const senderProfileId = (companySequence as { sender_profile_id?: string | null }).sender_profile_id;
        if (senderProfileId && userId) {
          const { data: senderProfile } = await supabase
            .from('sender_profiles')
            .select('name, display_name, logo_url, brand_color, footer_text, footer_image_url, footer_logo_url, signature, template_style, sender_name, signature_name, sender_email, sender_title, sender_image_url, website_url')
            .eq('id', senderProfileId)
            .eq('user_id', userId)
            .maybeSingle();
          if (senderProfile) {
            branding = {
              companyName: branding!.companyName,
              headerName: senderProfile.display_name ?? branding!.headerName,
              logoUrl: senderProfile.logo_url ?? branding!.logoUrl,
              brandColor: senderProfile.brand_color || branding!.brandColor,
              footerText: senderProfile.footer_text ?? branding!.footerText,
              footerImageUrl: senderProfile.footer_logo_url ?? senderProfile.logo_url ?? branding!.footerImageUrl,
              signature: senderProfile.signature ?? branding!.signature,
              templateStyle: ['professional', 'minimal', 'modern', 'creative', 'corporate', 'bold', 'elegant'].includes(senderProfile.template_style) ? senderProfile.template_style : branding!.templateStyle,
              senderName: senderProfile.sender_name ?? branding!.senderName,
              signatureName: senderProfile.signature_name ?? branding!.signatureName,
              senderEmail: senderProfile.sender_email ?? branding!.senderEmail,
              senderTitle: senderProfile.sender_title ?? branding!.senderTitle,
              senderImageUrl: senderProfile.sender_image_url ?? branding!.senderImageUrl,
              websiteUrl: senderProfile.website_url ?? branding!.websiteUrl,
            };
          }
        }
      }
    }

    console.log(`Sending via ${emailProvider} from ${fromEmail}`);

    // Strip any signature/sign-off from step body to avoid double signature (system adds it via branding)
    let plainBody = (emailStep.body ?? '').trim();
    if (plainBody) {
      const signaturePatterns = [
        /\n\s*Best regards,?\s*[\s\S]*$/i,
        /\n\s*Kind regards,?\s*[\s\S]*$/i,
        /\n\s*Sincerely,?\s*[\s\S]*$/i,
        /\n\s*Regards,?\s*[\s\S]*$/i,
        /\n\s*\[Your Name\][\s\S]*$/i,
        /\n\s*\{\{your_name\}\}[\s\S]*$/i,
        /\n\s*\{\{sender_name\}\}[\s\S]*$/i,
      ];
      for (const p of signaturePatterns) {
        plainBody = plainBody.replace(p, '').trim();
      }
      // Remove trailing newlines and common placeholder signature lines
      plainBody = plainBody.replace(/\n{2,}\s*(\[.*?\]|\{\{.*?\}\}|[A-Z][a-z]+ [A-Z][a-z]+.*)$/gm, '').trim();
    }

    const htmlBody = branding
      ? renderEmailTemplate(branding.templateStyle, {
          body: plainBody,
          senderName: branding.senderName || senderName,
          signatureName: branding.signatureName ?? undefined,
          senderEmail: fromEmail,
          senderTitle: branding.senderTitle || undefined,
          companyName: branding.companyName ?? undefined,
          headerName: branding.headerName ?? undefined,
          logoUrl: branding.logoUrl ?? undefined,
          brandColor: branding.brandColor,
          footerText: branding.footerText ?? undefined,
          footerImageUrl: branding.footerImageUrl ?? undefined,
          signature: branding.signature ?? undefined,
          senderImageUrl: branding.senderImageUrl ?? undefined,
          websiteUrl: branding.websiteUrl ?? undefined,
        })
      : plainBody.replace(/\n/g, '<br>');

    // Send email via configured provider
    let emailResult: any;
    let externalMessageId: string | undefined;

    if (emailProvider === 'sendgrid' && SENDGRID_API_KEY) {
      const sendgridResponse = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${SENDGRID_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          personalizations: [{
            to: [{ email: contact.email, name: contact.name }],
            subject: emailStep.subject,
          }],
          from: {
            email: fromEmail,
            name: senderName,
          },
          reply_to: {
            email: fromEmail,
            name: senderName,
          },
          content: [
            { type: 'text/plain', value: plainBody },
            { type: 'text/html', value: htmlBody },
          ],
          tracking_settings: {
            open_tracking: { enable: true },
            click_tracking: { enable: true, enable_text: true },
          },
          custom_args: {
            company_sequence_id: companySequenceId,
            step_number: stepNumber.toString(),
          },
        }),
      });

      if (!sendgridResponse.ok) {
        const errorText = await sendgridResponse.text();
        throw new Error(`Email send failed via SendGrid: ${errorText}`);
      }

      externalMessageId = sendgridResponse.headers.get('X-Message-Id') || `sendgrid-${crypto.randomUUID()}`;
    } else if (emailProvider === 'gmail' || emailProvider === 'gmail_direct') {
      // GMAIL DIRECT — send the follow-up through the user's connected Gmail (OAuth),
      // mirroring send-bulk-emails. Without this, gmail_direct users fell through to
      // Resend and got a "domain not verified" 403, so follow-ups never sent.
      const { getValidGmailAccessToken, sendGmailMessage, encodeRfc2047 } = await import('../_shared/gmail-utils.ts');
      const { data: gmailConn } = await supabase
        .from('crm_connections')
        .select('*')
        .eq('user_id', userId)
        .in('provider', ['gmail_direct', 'gmail'])
        .eq('status', 'active')
        .order('provider', { ascending: true })
        .limit(1)
        .maybeSingle();
      if (!gmailConn) throw new Error('No active Gmail connection found. Reconnect Gmail in Settings.');
      const gmailFromEmail = (gmailConn.from_email || fromEmail || '').trim();
      if (!gmailFromEmail) throw new Error('Gmail connection has no from_email set. Reconnect Gmail in Settings.');
      try {
        await getValidGmailAccessToken(supabase, gmailConn as any);
      } catch (_e) {
        throw new Error('Failed to refresh Gmail token. Please reconnect Gmail in Settings.');
      }
      const toLine = contact.name ? `${encodeRfc2047(contact.name)} <${contact.email}>` : contact.email;
      const boundary = `seq_${crypto.randomUUID()}`;
      const rawMessage = [
        `From: ${encodeRfc2047(senderName)} <${gmailFromEmail}>`,
        `To: ${toLine}`,
        `Subject: ${encodeRfc2047(emailStep.subject)}`,
        'MIME-Version: 1.0',
        `Content-Type: multipart/alternative; boundary="${boundary}"`,
        '',
        `--${boundary}`,
        'Content-Type: text/plain; charset=UTF-8',
        '',
        plainBody,
        `--${boundary}`,
        'Content-Type: text/html; charset=UTF-8',
        '',
        htmlBody,
        `--${boundary}--`,
      ].join('\r\n');
      const rawB64Url = btoa(unescape(encodeURIComponent(rawMessage)))
        .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
      const gmailData = await sendGmailMessage(supabase, gmailConn as any, rawB64Url);
      externalMessageId = gmailData?.id || `gmail-${crypto.randomUUID()}`;
    } else if (RESEND_API_KEY) {
      const resendFrom = await resendFromAddress(fromEmail);
      if (resendFrom.fallback) console.log(`[send-sequence-email] ${fromEmail || '(no sender address)'} is not on a verified Resend domain; sending from ${resendFrom.email}`);
      fromEmail = resendFrom.email;
      const resendResponse = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: `${senderName} <${fromEmail}>`,
          to: contact.email,
          subject: emailStep.subject,
          html: htmlBody,
          text: plainBody,
          reply_to: RESEND_INBOUND_EMAIL,
          tags: [
            { name: 'company_sequence_id', value: companySequenceId },
            { name: 'step_number', value: stepNumber.toString() },
          ],
        }),
      });

      emailResult = await resendResponse.json();

      if (!resendResponse.ok) {
        throw new Error(`Email send failed: ${JSON.stringify(emailResult)}`);
      }

      externalMessageId = emailResult.id;
    } else {
      console.log('RESEND_API_KEY not configured, simulating email send');
      externalMessageId = `simulated-${crypto.randomUUID()}`;
    }

    // Record email activity — include to_email so inbound matching can find the sequence
    const activityMetadata = {
      to: contact.email,
      to_email: contact.email,
      recipient_email: contact.email,
      from: fromEmail,
      provider: emailProvider,
      sending_method: emailProvider === 'sendgrid' ? 'api' : 'api',
      tracking_enabled: true,
      can_track_opens: true,
      can_track_clicks: true,
      can_track_replies: true,
    };

    const { error: activityError } = await supabase
      .from('email_activities')
      .insert({
        company_sequence_id: companySequenceId,
        contact_id: contact.id,
        step_number: stepNumber,
        subject: emailStep.subject,
        body: emailStep.body,
        status: 'sent',
        sent_at: new Date().toISOString(),
        external_message_id: externalMessageId,
        thread_id: externalMessageId,
        metadata: activityMetadata,
      });

    if (activityError) {
      console.error('Failed to record email activity:', activityError);
    }

    // Also write email_threads so Conversations can show the outbound sequence email
    try {
      const { error: threadError } = await supabase
        .from('email_threads')
        .insert({
          company_sequence_id: companySequenceId,
          from_email: fromEmail,
          to_email: contact.email,
          subject: emailStep.subject,
          body_text: emailStep.body,
          body_html: null,
          direction: 'outbound',
          thread_id: externalMessageId,
          message_id: externalMessageId,
          received_at: new Date().toISOString(),
        });
      if (threadError) {
        console.error('Failed to create email thread for sequence send:', threadError);
      }
    } catch (threadErr) {
      console.error('email_threads insert error:', threadErr);
    }

    // Update company sequence current_step
    const { error: updateError } = await supabase
      .from('company_sequences')
      .update({
        current_step: stepNumber,
        updated_at: new Date().toISOString(),
      })
      .eq('id', companySequenceId);

    if (updateError) {
      console.error('Failed to update company sequence:', updateError);
    }

    // Complete only when this is the last step AND the sequence is not set to repeat.
    // Leaving status=active lets process-sequence-steps schedule restart_after.
    const isLastStep = stepNumber >= (companySequence.personalized_emails?.length || 0) - 1;
    const shouldRepeat = !!(companySequence.metadata as any)?.repeat_sequence;
    if (isLastStep && !shouldRepeat) {
      await supabase
        .from('company_sequences')
        .update({ status: 'completed' })
        .eq('id', companySequenceId);
    }

    console.log(`Email sent successfully for sequence ${companySequenceId}, step ${stepNumber}`);

    return new Response(
      JSON.stringify({
        success: true,
        emailId: externalMessageId,
        recipient: contact.email,
        step: stepNumber,
        isLastStep,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in send-sequence-email:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
