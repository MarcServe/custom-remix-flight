import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.78.0';
import { corsHeaders } from '../_shared/cors.ts';
import { renderEmailTemplate } from '../_shared/professional-template.ts';
import { encodeRfc2047, getValidGmailAccessToken, sendGmailMessage } from '../_shared/gmail-utils.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const NANGO_SECRET_KEY = Deno.env.get('NANGO_SECRET_KEY')!;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { companySequenceId, startFromStep = 0 } = await req.json();
    
    console.log('Starting to send sequence emails:', { companySequenceId, startFromStep });

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get the company sequence with all related data
    const { data: companySequence, error: seqError } = await supabase
      .from('company_sequences')
      .select(`
        *,
        companies (*),
        email_sequences (*)
      `)
      .eq('id', companySequenceId)
      .single();

    if (seqError || !companySequence) {
      throw new Error('Company sequence not found');
    }

    // Get verified contact — create from people if missing (same as send-sequence-email)
    let { data: contacts } = await supabase
      .from('contacts')
      .select('*')
      .eq('company_id', companySequence.company_id)
      .eq('email_verified', true)
      .order('is_primary_contact', { ascending: false })
      .limit(1);

    if (!contacts || contacts.length === 0) {
      const { data: people } = await supabase
        .from('people')
        .select('id, email, first_name, last_name')
        .eq('company_id', companySequence.company_id)
        .not('email', 'is', null)
        .limit(1);
      const person = people?.[0];
      if (!person?.email) {
        throw new Error('No verified contact found for this company');
      }
      const fullName = [person.first_name, person.last_name].filter(Boolean).join(' ') || person.email;
      const { data: existing } = await supabase
        .from('contacts')
        .select('*')
        .eq('company_id', companySequence.company_id)
        .eq('email', person.email)
        .maybeSingle();
      if (existing) {
        if (!existing.email_verified) {
          await supabase.from('contacts').update({ email_verified: true }).eq('id', existing.id);
          existing.email_verified = true;
        }
        contacts = [existing];
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
          throw new Error('No verified contact found for this company');
        }
        contacts = [created];
      }
    }

    const contact = contacts[0];
    const personalizedEmails = companySequence.personalized_emails || [];
    
    if (personalizedEmails.length === 0) {
      throw new Error('No personalized emails found in this sequence');
    }

    // Get user's Nango connection
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Authorization required');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      throw new Error('Invalid authorization');
    }

    // Get business profile (full branding when sequence uses email branding)
    const sequence = companySequence.email_sequences as { use_email_branding?: boolean } | null;
    const useBranding = sequence?.use_email_branding !== false;
    const { data: businessProfile } = await supabase
      .from('business_profiles')
      .select('company_name, email_header_name, email_provider, email_template_style, email_logo_url, email_brand_color, email_footer_text, email_footer_image_url, email_footer_logo_url, email_sender_image_url, email_sender_name, email_signature_name, email_sender_title, email_sender_email, email_signature, website')
      .eq('user_id', user.id)
      .maybeSingle();

    // Get optimal provider based on tracking capabilities
    const { data: connections } = await supabase
      .from('crm_connections')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .order('tracking_enabled', { ascending: false });

    if (!connections || connections.length === 0) {
      throw new Error('No active email connections found. Please configure an email provider.');
    }

    // Priority: Providers with tracking > Resend/SendGrid > Gmail/Outlook > SMTP Direct
    const connection = connections.find(c => c.tracking_enabled && ['resend', 'sendgrid'].includes(c.provider))
      || connections.find(c => c.tracking_enabled && ['gmail', 'gmail_direct', 'outlook'].includes(c.provider))
      || connections.find(c => ['gmail', 'gmail_direct'].includes(c.provider))
      || connections[0];

    const emailProvider = connection.provider;
    console.log(`Using optimal email provider: ${emailProvider} (tracking: ${connection.tracking_enabled})`);

    const fromEmail = connection?.from_email || 'noreply@yourdomain.com';
    const senderName = businessProfile?.company_name || 'Your Business';
    let branding: {
      templateStyle: string;
      companyName: string | null;
      headerName: string | null;
      logoUrl: string | null;
      brandColor: string;
      footerText: string | null;
      footerImageUrl: string | null;
      signature: string | null;
      senderName: string | null;
      signatureName: string | null;
      senderEmail: string | null;
      senderTitle: string | null;
      senderImageUrl: string | null;
      websiteUrl: string | null;
    } | null = useBranding && businessProfile ? {
      templateStyle: (businessProfile as Record<string, unknown>).email_template_style as string || 'professional',
      companyName: (businessProfile as Record<string, unknown>).company_name as string ?? null,
      headerName: (businessProfile as Record<string, unknown>).email_header_name as string ?? null,
      logoUrl: (businessProfile as Record<string, unknown>).email_logo_url as string ?? null,
      brandColor: ((businessProfile as Record<string, unknown>).email_brand_color as string) || '#8b5cf6',
      footerText: (businessProfile as Record<string, unknown>).email_footer_text as string ?? null,
      footerImageUrl: (businessProfile as Record<string, unknown>).email_footer_logo_url as string ?? (businessProfile as Record<string, unknown>).email_logo_url as string ?? null,
      signature: (businessProfile as Record<string, unknown>).email_signature as string ?? null,
      senderName: (businessProfile as Record<string, unknown>).email_sender_name as string ?? null,
      signatureName: (businessProfile as Record<string, unknown>).email_signature_name as string ?? null,
      senderEmail: (businessProfile as Record<string, unknown>).email_sender_email as string ?? null,
      senderTitle: (businessProfile as Record<string, unknown>).email_sender_title as string ?? null,
      senderImageUrl: (businessProfile as Record<string, unknown>).email_sender_image_url as string ?? null,
      websiteUrl: (businessProfile as Record<string, unknown>).website as string ?? null,
    } : null;

    // Overlay sender profile when sequence was enrolled from a campaign with a product (e.g. TALKWEB)
    const senderProfileId = (companySequence as { sender_profile_id?: string | null }).sender_profile_id;
    if (branding && senderProfileId) {
      const { data: senderProfile } = await supabase
        .from('sender_profiles')
        .select('name, display_name, logo_url, brand_color, footer_text, footer_image_url, footer_logo_url, signature, template_style, sender_name, signature_name, sender_email, sender_title, sender_image_url, website_url')
        .eq('id', senderProfileId)
        .eq('user_id', user.id)
        .maybeSingle();
      if (senderProfile) {
        branding = {
          companyName: branding.companyName,
          headerName: senderProfile.display_name ?? branding.headerName,
          logoUrl: senderProfile.logo_url ?? branding.logoUrl,
          brandColor: senderProfile.brand_color || branding.brandColor,
          footerText: senderProfile.footer_text ?? branding.footerText,
          footerImageUrl: senderProfile.footer_logo_url ?? senderProfile.logo_url ?? branding.footerImageUrl,
          signature: senderProfile.signature ?? branding.signature,
          templateStyle: ['professional', 'minimal', 'modern', 'creative', 'corporate', 'bold', 'elegant'].includes(senderProfile.template_style) ? senderProfile.template_style : branding.templateStyle,
          senderName: senderProfile.sender_name ?? branding.senderName,
          signatureName: senderProfile.signature_name ?? branding.signatureName,
          senderEmail: senderProfile.sender_email ?? branding.senderEmail,
          senderTitle: senderProfile.sender_title ?? branding.senderTitle,
          senderImageUrl: senderProfile.sender_image_url ?? branding.senderImageUrl,
          websiteUrl: senderProfile.website_url ?? branding.websiteUrl,
        };
      }
    }

    const sentEmails = [];
    const errors = [];

    // Send emails according to the sequence schedule
    for (let i = startFromStep; i < personalizedEmails.length; i++) {
      const emailData = personalizedEmails[i];
      
      // Calculate if this email should be sent now based on delay
      const firstEmailSentAt = companySequence.metadata?.first_email_sent_at;
      if (i > 0 && firstEmailSentAt) {
        const daysSinceFirst = Math.floor(
          (Date.now() - new Date(firstEmailSentAt).getTime()) / (1000 * 60 * 60 * 24)
        );
        
        if (daysSinceFirst < emailData.delayDays) {
          console.log(`Skipping step ${i + 1}, delay not met (${daysSinceFirst}/${emailData.delayDays} days)`);
          continue;
        }
      }

      try {
        console.log(`Sending email step ${i + 1}/${personalizedEmails.length} via ${emailProvider}`);

        let emailMessageId = null;

        if (emailProvider === 'gmail' || emailProvider === 'gmail_direct') {
          // Send via Gmail Direct API (OAuth) with pre-emptive token refresh.
          const gmailFrom = (connection.from_email || user.email || '').trim();
          if (!gmailFrom) {
            throw new Error('Gmail connection has no from_email set. Reconnect Gmail in Settings.');
          }
          // Refresh once per step
          await getValidGmailAccessToken(supabase, connection as any);

          const toLine = contact.name
            ? `${encodeRfc2047(contact.name)} <${contact.email}>`
            : contact.email;
          const rawMessage = [
            `From: ${encodeRfc2047(senderName)} <${gmailFrom}>`,
            `To: ${toLine}`,
            `Subject: ${encodeRfc2047(emailData.subject)}`,
            'MIME-Version: 1.0',
            'Content-Type: text/plain; charset=UTF-8',
            '',
            emailData.body,
          ].join('\r\n');
          const rawB64Url = btoa(unescape(encodeURIComponent(rawMessage)))
            .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

          const gmailData = await sendGmailMessage(supabase, connection as any, rawB64Url);
          emailMessageId = gmailData?.id || null;
        } else if (emailProvider === 'sendgrid') {
          // Send via SendGrid
          const SENDGRID_API_KEY = Deno.env.get('SENDGRID_API_KEY');
          if (!SENDGRID_API_KEY) {
            throw new Error('SendGrid API key not configured');
          }

          const htmlBody = branding
            ? renderEmailTemplate(branding.templateStyle, {
                body: emailData.body,
                senderName: branding.senderName || senderName,
                signatureName: branding.signatureName ?? undefined,
                senderEmail: branding.senderEmail || fromEmail,
                senderTitle: branding.senderTitle ?? undefined,
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
            : emailData.body.replace(/\n/g, '<br>');

          const sendgridResponse = await fetch('https://api.sendgrid.com/v3/mail/send', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${SENDGRID_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              personalizations: [{
                to: [{ email: contact.email, name: contact.name }],
                subject: emailData.subject,
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
                { type: 'text/plain', value: emailData.body },
                { type: 'text/html', value: htmlBody },
              ],
            }),
          });

          if (!sendgridResponse.ok) {
            const errorText = await sendgridResponse.text();
            throw new Error(`Failed to send via SendGrid: ${errorText}`);
          }

          emailMessageId = sendgridResponse.headers.get('X-Message-Id') || null;
        } else {
          // Send via Resend (default)
          const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
          if (!RESEND_API_KEY) {
            throw new Error('Resend API key not configured');
          }

          const htmlBody = branding
            ? renderEmailTemplate(branding.templateStyle, {
                body: emailData.body,
                senderName: branding.senderName || senderName,
                signatureName: branding.signatureName ?? undefined,
                senderEmail: branding.senderEmail || fromEmail,
                senderTitle: branding.senderTitle ?? undefined,
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
            : emailData.body.replace(/\n/g, '<br>');

          const RESEND_INBOUND_EMAIL = Deno.env.get('RESEND_INBOUND_EMAIL') || 'leadgenie@eldapgraaa.resend.app';
          const resendResponse = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${RESEND_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              from: `${senderName} <${fromEmail}>`,
              to: [contact.email],
              subject: emailData.subject,
              text: emailData.body,
              html: htmlBody,
              reply_to: RESEND_INBOUND_EMAIL,
            }),
          });

          if (!resendResponse.ok) {
            const errorText = await resendResponse.text();
            throw new Error(`Failed to send via Resend: ${errorText}`);
          }

          const resendData = await resendResponse.json();
          emailMessageId = resendData.id || null;
        }

        // Record email activity with detailed tracking metadata (+ to_email for inbound match)
        await supabase
          .from('email_activities')
          .insert({
            company_sequence_id: companySequenceId,
            contact_id: contact.id,
            step_number: i,
            subject: emailData.subject,
            body: emailData.body,
            status: 'sent',
            sent_at: new Date().toISOString(),
            external_message_id: emailMessageId,
            thread_id: emailMessageId,
            metadata: {
              to: contact.email,
              to_email: contact.email,
              recipient_email: contact.email,
              provider: emailProvider,
              sending_method: connection.sending_method,
              tracking_enabled: connection.tracking_enabled,
              can_track_opens: connection.capabilities?.opens || false,
              can_track_clicks: connection.capabilities?.clicks || false,
              can_track_replies: true,
              sequence_name: companySequence.email_sequences?.name,
              company_name: companySequence.companies?.name,
            },
          });

        // Also write email_threads so Conversations shows outbound sequence mail
        try {
          const threadHtml = branding
            ? renderEmailTemplate(branding.templateStyle, {
                body: emailData.body,
                senderName: branding.senderName || senderName,
                signatureName: branding.signatureName ?? undefined,
                senderEmail: branding.senderEmail || fromEmail,
                senderTitle: branding.senderTitle ?? undefined,
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
            : emailData.body.replace(/\n/g, '<br>');
          await supabase.from('email_threads').insert({
            company_sequence_id: companySequenceId,
            from_email: fromEmail,
            to_email: contact.email,
            subject: emailData.subject,
            body_text: emailData.body,
            body_html: threadHtml,
            direction: 'outbound',
            thread_id: emailMessageId,
            message_id: emailMessageId,
            received_at: new Date().toISOString(),
          });
        } catch (threadErr) {
          console.error('Failed to create email_threads row:', threadErr);
        }

        sentEmails.push({
          stepNumber: i + 1,
          subject: emailData.subject,
          sentAt: new Date().toISOString(),
        });

        // Update sequence metadata — keep active on last step when repeat_sequence is set
        const metadata = companySequence.metadata || {};
        if (i === 0) {
          metadata.first_email_sent_at = new Date().toISOString();
        }
        metadata.last_email_sent_at = new Date().toISOString();
        const isLast = i === personalizedEmails.length - 1;
        const shouldRepeat = !!metadata.repeat_sequence;

        await supabase
          .from('company_sequences')
          .update({
            current_step: i,
            status: isLast && !shouldRepeat ? 'completed' : 'active',
            metadata,
          })
          .eq('id', companySequenceId);

        console.log(`Email step ${i + 1} sent successfully`);

      } catch (stepError) {
        console.error(`Error sending step ${i + 1}:`, stepError);
        errors.push({
          stepNumber: i + 1,
          error: stepError instanceof Error ? stepError.message : 'Unknown error',
        });
        
        // Don't continue if there's an error
        break;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        sentEmails,
        errors: errors.length > 0 ? errors : undefined,
        totalSent: sentEmails.length,
        sequenceStatus: companySequence.status,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error sending sequence emails:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
