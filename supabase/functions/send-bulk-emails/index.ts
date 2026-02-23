import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";
import { renderEmailTemplate } from "../_shared/professional-template.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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
      // Use service role client for cron-triggered requests
      supabaseClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );
      
      // Get the campaign's user_id
      const { data: campaign, error: campaignError } = await supabaseClient
        .from('email_campaigns')
        .select('user_id')
        .eq('id', campaignId)
        .single();
      
      if (campaignError || !campaign) {
        throw new Error('Campaign not found');
      }
      
      userId = campaign.user_id;
      console.log(`[cron] Processing campaign for user: ${userId}`);
    } else {
      // Use authenticated client for user-initiated requests
      supabaseClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_ANON_KEY') ?? '',
        {
          global: {
            headers: { Authorization: authHeader },
          },
        }
      );

      const {
        data: { user },
        error: authError,
      } = await supabaseClient.auth.getUser();

      if (authError || !user) {
        throw new Error('Unauthorized');
      }
      
      userId = user.id;
    }

    // Get campaign details
    const { data: campaign, error: campaignError } = await supabaseClient
      .from('email_campaigns')
      .select('*')
      .eq('id', campaignId)
      .single();

    if (campaignError || !campaign) {
      throw new Error('Campaign not found');
    }
    
    // Verify user ownership for non-service-role requests
    if (!isServiceRole && !triggeredByCron && campaign.user_id !== userId) {
      throw new Error('Unauthorized: Campaign does not belong to user');
    }

    // Update campaign status to sending
    await supabaseClient
      .from('email_campaigns')
      .update({ 
        status: 'sending',
        started_at: new Date().toISOString()
      })
      .eq('id', campaignId);

    // Get pending recipients (batch of 50 to avoid overwhelming)
    const { data: recipients, error: recipientsError } = await supabaseClient
      .from('email_campaign_recipients')
      .select('*')
      .eq('campaign_id', campaignId)
      .eq('status', 'pending')
      .limit(50);

    if (recipientsError) {
      throw new Error('Failed to fetch recipients');
    }

    if (!recipients || recipients.length === 0) {
      // Mark campaign as completed if no pending recipients
      await supabaseClient
        .from('email_campaigns')
        .update({ 
          status: 'completed',
          completed_at: new Date().toISOString()
        })
        .eq('id', campaignId);

      return new Response(
        JSON.stringify({
          success: true,
          message: 'No pending recipients',
          sent: 0,
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log(`Sending to ${recipients.length} recipients`);

    let sentCount = 0;
    let failedCount = 0;

    // Get user profile for signature and business email
    const { data: userProfile } = await supabaseClient
      .from('profiles')
      .select('full_name, job_title, email, avatar_url')
      .eq('id', userId)
      .maybeSingle();

    // Get business profile with email provider preference and branding settings
    const { data: businessProfile } = await supabaseClient
      .from('business_profiles')
      .select('company_name, email_header_name, email_provider, email_template_style, email_logo_url, email_brand_color, email_footer_text, email_footer_image_url, email_footer_logo_url, email_sender_image_url, email_sender_name, email_signature_name, email_sender_title, email_sender_email, email_signature, website')
      .eq('user_id', userId)
      .maybeSingle();

    // Resolve branding: when a sender profile is selected, use that profile; otherwise use business (default)
    let branding: {
      companyName: string | null;
      headerName: string | null;
      logoUrl: string | null;
      brandColor: string;
      footerText: string | null;
      footerImageUrl: string | null;
      signature: string | null;
      templateStyle: string;
      senderName: string | null;
      signatureName: string | null;
      senderEmail: string | null;
      senderTitle: string | null;
      senderImageUrl: string | null;
      websiteUrl: string | null;
    } = {
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
    // When campaign has a sender profile, email branding (business) still overrides; profile fills in only when branding has no value
    if (campaign.sender_profile_id) {
      const { data: senderProfile } = await supabaseClient
        .from('sender_profiles')
        .select('name, display_name, logo_url, brand_color, footer_text, footer_image_url, footer_logo_url, signature, template_style, sender_name, signature_name, sender_email, sender_title, sender_image_url, website_url')
        .eq('id', campaign.sender_profile_id)
        .eq('user_id', userId)
        .maybeSingle();
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
    // Ensure we always have a name next to the logo when logo is present
    if (branding.logoUrl && !branding.companyName) branding.companyName = businessProfile?.company_name || 'Company';

    // Get connection - use campaign's sender_connection_id if specified, otherwise find optimal
    let optimalConnection: any;
    
    if (campaign.sender_connection_id) {
      // Use the specific connection saved with the campaign
      const { data: campaignConnection, error: connectionError } = await supabaseClient
        .from('crm_connections')
        .select('*')
        .eq('id', campaign.sender_connection_id)
        .eq('user_id', userId)
        .eq('status', 'active')
        .single();

      if (connectionError || !campaignConnection) {
        console.error('Campaign connection not found, falling back to optimal:', connectionError);
        // Fall back to finding optimal connection
        const { data: connections } = await supabaseClient
          .from('crm_connections')
          .select('*')
          .eq('user_id', userId)
          .eq('status', 'active')
          .order('tracking_enabled', { ascending: false });

        if (!connections || connections.length === 0) {
          throw new Error('No active email connections found. Please configure an email provider.');
        }

        optimalConnection = connections.find((c: any) => c.tracking_enabled && ['resend', 'sendgrid'].includes(c.provider))
          || connections.find((c: any) => c.tracking_enabled && ['gmail', 'outlook'].includes(c.provider))
          || connections[0];
      } else {
        optimalConnection = campaignConnection;
      }
    } else {
      // No specific connection in campaign, find optimal one
      const { data: connections, error: connectionsError } = await supabaseClient
        .from('crm_connections')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'active')
        .order('tracking_enabled', { ascending: false });

      if (!connections || connections.length === 0) {
        throw new Error('No active email connections found. Please configure an email provider.');
      }

      // Priority: Providers with tracking > Resend/SendGrid > Gmail/Outlook > SMTP Direct
      optimalConnection = connections.find((c: any) => c.tracking_enabled && ['resend', 'sendgrid'].includes(c.provider))
        || connections.find((c: any) => c.tracking_enabled && ['gmail', 'outlook'].includes(c.provider))
        || connections[0];
    }

    const emailProvider = optimalConnection.provider;
    console.log(`Using email provider: ${emailProvider} (connection ID: ${optimalConnection.id}, tracking: ${optimalConnection.tracking_enabled})`);

    // Get API-key provider connection for verified from_email (if not already optimal)
    let effectiveConnection = optimalConnection;
    if (!['resend', 'sendgrid'].includes(optimalConnection.provider)) {
      const { data: apiConnection } = await supabaseClient
        .from('crm_connections')
        .select('from_email')
        .eq('user_id', userId)
        .eq('provider', emailProvider)
        .eq('status', 'active')
        .maybeSingle();
      
      if (apiConnection?.from_email) {
        effectiveConnection = { ...optimalConnection, from_email: apiConnection.from_email };
      }
    }

    // Send emails with rate limiting
    for (const recipient of recipients) {
      try {
        // Validate recipient has required fields
        if (!recipient.email || !recipient.personalized_subject) {
          throw new Error(`Missing required fields for recipient ${recipient.id}: email or subject`);
        }

        // Ensure we have body content
        const bodyText = recipient.personalized_body_text || '';
        const bodyHtml = recipient.personalized_body_html || '';
        
        if (!bodyText.trim() && !bodyHtml.trim()) {
          throw new Error(`No body content for recipient ${recipient.email}`);
        }

        let messageId: string | null = null;

        if (optimalConnection.provider === 'gmail') {
          // Send via Gmail/Nango
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
              body: {
                content: recipient.personalized_body_text,
                type: 'text/plain',
              },
            }),
          });

          if (!nangoResponse.ok) {
            throw new Error('Gmail send failed');
          }

          const nangoData = await nangoResponse.json();
          messageId = nangoData.id || null;
        } else if (optimalConnection.provider === 'smtp') {
          // Send via SMTP with branded template
          const senderName = branding.senderName || branding.companyName || userProfile?.full_name || 'Your Business';
          const fromEmail = branding.senderEmail || optimalConnection.from_email || userProfile?.email || 'noreply@yourdomain.com';
          
          // Extract body HTML (remove signature if already included to avoid duplicates)
          let bodyHtml = recipient.personalized_body_html || '';
          // More comprehensive signature removal patterns
          const signaturePatterns = [
            /<br><br><p>Best regards,.*$/is,
            /<br><br>Best regards,.*$/is,
            /<p>Best regards,.*$/is,
            /Best regards,.*$/is,
            /<div class="signature".*$/is,
            /<div class="email-signature".*$/is,
            /<div[^>]*class="[^"]*signature[^"]*".*$/is,
            /michael orji.*$/is,  // Remove if signature contains name
            /Michael Orji.*$/is,
            /AI Founding Engineer.*$/is,
            /AI innovation Studio.*$/is,
            /AI Innovation Studio.*$/is,
            /Biz Boosters Ltd.*$/is,
            /biz boosters.*$/is,
          ];
          for (const pattern of signaturePatterns) {
            bodyHtml = bodyHtml.replace(pattern, '').trim();
          }
          // Also remove any trailing signature-like content (multiple newlines followed by name/email patterns)
          bodyHtml = bodyHtml.replace(/(<br\s*\/?>|\n){2,}.*?(michael|orji|biz boosters|founding engineer|AI innovation|innovation studio).*$/is, '').trim();
          
          // Render with branded template
          let wrappedHtml: string;
          try {
            wrappedHtml = renderEmailTemplate(
              branding.templateStyle,
              {
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
              }
            );
          } catch (templateError: any) {
            console.error('Error rendering email template (SMTP):', templateError);
            throw new Error(`Failed to render email template: ${templateError instanceof Error ? templateError.message : String(templateError)}`);
          }

          const smtpMode = (optimalConnection.metadata as any)?.smtp_mode || 'direct'; // Default to 'direct' for open-source use

          if (smtpMode === 'direct' && (optimalConnection.metadata as any)?.smtp_host) {
            // Direct SMTP
            const smtpConfig = optimalConnection.metadata as any;
            const client = new SMTPClient({
              connection: {
                hostname: smtpConfig.smtp_host,
                port: smtpConfig.smtp_port || 587,
                tls: smtpConfig.smtp_secure !== false,
                auth: {
                  username: smtpConfig.smtp_username,
                  password: smtpConfig.smtp_password,
                },
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
            // Resend relay - use verified email from connection or fallback
            const resendApiKey = Deno.env.get('RESEND_API_KEY');
            if (!resendApiKey) throw new Error('Email service not configured');

            const effectiveFromEmail = effectiveConnection.from_email || userProfile?.email;
            if (!effectiveFromEmail) {
              throw new Error('Business Email not configured. Please set your business email in Settings > Profile.');
            }

            const resendResponse = await fetch('https://api.resend.com/emails', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${resendApiKey}`,
                'Content-Type': 'application/json',
              },
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
              console.error('Resend API error:', errorData);
              throw new Error(parseResendError(resendResponse.status, errorData));
            }

            const resendData = await resendResponse.json();
            messageId = resendData.id || null;
          }
        } else if (emailProvider === 'sendgrid') {
          // Send via SendGrid
          const sendgridApiKey = Deno.env.get('SENDGRID_API_KEY');
          if (!sendgridApiKey) throw new Error('SendGrid not configured');

          const senderName = branding.senderName || branding.companyName || userProfile?.full_name || 'Your Business';
          const fromEmail = branding.senderEmail || effectiveConnection.from_email || userProfile?.email;
          if (!fromEmail) {
            throw new Error('Business Email not configured. Please set your business email in Settings > Profile and verify it in SendGrid.');
          }
          
          // Extract body HTML (remove signature if already included to avoid duplicates)
          let bodyHtml = recipient.personalized_body_html || '';
          // More comprehensive signature removal patterns
          const signaturePatterns = [
            /<br><br><p>Best regards,.*$/is,
            /<br><br>Best regards,.*$/is,
            /<p>Best regards,.*$/is,
            /Best regards,.*$/is,
            /<div class="signature".*$/is,
            /<div class="email-signature".*$/is,
            /<div[^>]*class="[^"]*signature[^"]*".*$/is,
            /michael orji.*$/is,  // Remove if signature contains name
            /Michael Orji.*$/is,
            /AI Founding Engineer.*$/is,
            /AI innovation Studio.*$/is,
            /AI Innovation Studio.*$/is,
            /Biz Boosters Ltd.*$/is,
            /biz boosters.*$/is,
          ];
          for (const pattern of signaturePatterns) {
            bodyHtml = bodyHtml.replace(pattern, '').trim();
          }
          // Also remove any trailing signature-like content (multiple newlines followed by name/email patterns)
          bodyHtml = bodyHtml.replace(/(<br\s*\/?>|\n){2,}.*?(michael|orji|biz boosters|founding engineer|AI innovation|innovation studio).*$/is, '').trim();
          
          // Render with branded template
          let wrappedHtml: string;
          try {
            wrappedHtml = renderEmailTemplate(
              branding.templateStyle,
              {
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
              }
            );
          } catch (templateError: any) {
            console.error('Error rendering email template (SMTP):', templateError);
            throw new Error(`Failed to render email template: ${templateError instanceof Error ? templateError.message : String(templateError)}`);
          }

          const sendgridResponse = await fetch('https://api.sendgrid.com/v3/mail/send', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${sendgridApiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              personalizations: [{
                to: [{ email: recipient.email, name: recipient.name }],
                subject: recipient.personalized_subject,
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
                {
                  type: 'text/plain',
                  value: recipient.personalized_body_text,
                },
                {
                  type: 'text/html',
                  value: wrappedHtml,
                },
              ],
            }),
          });

          if (!sendgridResponse.ok) {
            throw new Error('SendGrid send failed');
          }

          messageId = sendgridResponse.headers.get('X-Message-Id') || null;
        } else if (emailProvider === 'resend') {
          // Send via Resend
          const resendApiKey = Deno.env.get('RESEND_API_KEY');
          if (!resendApiKey) throw new Error('Resend not configured. Please add RESEND_API_KEY.');

          const senderName = branding.senderName || branding.companyName || userProfile?.full_name || 'CRM';
          const fromEmail = branding.senderEmail || effectiveConnection.from_email || userProfile?.email || 'onboarding@resend.dev';
          
          // Extract body HTML (remove signature if already included to avoid duplicates)
          let bodyHtml = recipient.personalized_body_html || '';
          // More comprehensive signature removal patterns
          const signaturePatterns = [
            /<br><br><p>Best regards,.*$/is,
            /<br><br>Best regards,.*$/is,
            /<p>Best regards,.*$/is,
            /Best regards,.*$/is,
            /<div class="signature".*$/is,
            /<div class="email-signature".*$/is,
            /<div[^>]*class="[^"]*signature[^"]*".*$/is,
          ];
          for (const pattern of signaturePatterns) {
            bodyHtml = bodyHtml.replace(pattern, '').trim();
          }
          
          // Render with branded template
          let wrappedHtml: string;
          try {
            wrappedHtml = renderEmailTemplate(
              branding.templateStyle,
              {
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
              }
            );
          } catch (templateError: any) {
            console.error('Error rendering email template (Resend):', templateError);
            throw new Error(`Failed to render email template: ${templateError instanceof Error ? templateError.message : String(templateError)}`);
          }

          const resendResponse = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${resendApiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              from: `${senderName} <${fromEmail}>`,
              to: [recipient.email],
              subject: recipient.personalized_subject,
              text: recipient.personalized_body_text || '',
              html: wrappedHtml,
              headers: {
                'X-Priority': '3',
                'Importance': 'normal',
              },
            }),
          });

          if (!resendResponse.ok) {
            const errorData = await resendResponse.text();
            console.error('Resend API error:', errorData);
            throw new Error(parseResendError(resendResponse.status, errorData));
          }

          const resendData = await resendResponse.json();
          messageId = resendData.id || null;
        } else {
          throw new Error(`Unsupported email provider: ${emailProvider}`);
        }

        // Update recipient status with tracking metadata
        await supabaseClient
          .from('email_campaign_recipients')
          .update({
            status: 'sent',
            sent_at: new Date().toISOString(),
            external_message_id: messageId,
            email_period: 'new', // Mark as new email
          })
          .eq('id', recipient.id);

        // Record detailed email activity with provider tracking info
        await supabaseClient
          .from('email_activities')
          .insert({
            contact_id: recipient.person_id,
            step_number: 0,
            subject: recipient.personalized_subject,
            body: recipient.personalized_body_text,
            status: 'sent',
            sent_at: new Date().toISOString(),
            external_message_id: messageId,
            email_period: 'new', // Mark as new email
            metadata: {
              campaign_id: campaignId,
              provider: optimalConnection.provider,
              sending_method: optimalConnection.sending_method,
              tracking_enabled: optimalConnection.tracking_enabled,
              can_track_opens: optimalConnection.capabilities?.opens || false,
              can_track_clicks: optimalConnection.capabilities?.clicks || false,
              can_track_replies: optimalConnection.capabilities?.replies || false,
              recipient_email: recipient.email,
              recipient_name: recipient.name,
            },
          });

        // Auto follow-up: enroll recipient's company in follow-up sequence for no-reply reminders
        const followUpSeqId = campaign.auto_follow_up_enabled && campaign.follow_up_sequence_id && recipient.person_id
          ? campaign.follow_up_sequence_id
          : null;
        if (followUpSeqId) {
          try {
            const { data: person } = await supabaseClient
              .from('people')
              .select('company_id')
              .eq('id', recipient.person_id)
              .single();
            const companyId = person?.company_id;
            if (companyId) {
              const { data: existing } = await supabaseClient
                .from('company_sequences')
                .select('id')
                .eq('campaign_id', campaignId)
                .eq('company_id', companyId)
                .maybeSingle();
              if (!existing) {
                const { data: followUpSequence } = await supabaseClient
                  .from('email_sequences')
                  .select('steps')
                  .eq('id', followUpSeqId)
                  .single();
                const steps = Array.isArray(followUpSequence?.steps) ? followUpSequence.steps : [];
                const personalizedEmails: { stepNumber: number; subject: string; body: string; delayDays: number }[] = [
                  { stepNumber: 0, subject: '(Campaign)', body: '', delayDays: 0 },
                ];
                steps.forEach((step: { subject?: string; body?: string; delayDays?: number }, i: number) => {
                  personalizedEmails.push({
                    stepNumber: i + 1,
                    subject: step?.subject ?? `Follow-up ${i + 1}`,
                    body: step?.body ?? '',
                    delayDays: typeof step?.delayDays === 'number' ? step.delayDays : (i === 0 ? 3 : (i + 1) * 2),
                  });
                });
                const { data: newCs, error: csErr } = await supabaseClient
                  .from('company_sequences')
                  .insert({
                    company_id: companyId,
                    sequence_id: followUpSeqId,
                    campaign_id: campaignId,
                    current_step: 0,
                    personalized_emails: personalizedEmails,
                    status: 'active',
                    automation_rules: {
                      enabled: true,
                      rules: [
                        { type: 'no_reply_after_open', wait_hours: 48 },
                        { type: 'no_open', wait_hours: 72 },
                      ],
                    },
                    metadata: { first_email_sent_at: new Date().toISOString(), campaign_recipient_id: recipient.id },
                  })
                  .select('id')
                  .single();
                if (!csErr && newCs?.id) {
                  await supabaseClient.from('email_activities').insert({
                    company_sequence_id: newCs.id,
                    contact_id: null,
                    step_number: 0,
                    subject: recipient.personalized_subject,
                    body: recipient.personalized_body_text,
                    status: 'sent',
                    sent_at: new Date().toISOString(),
                    external_message_id: messageId,
                    metadata: { campaign_id: campaignId, campaign_recipient_id: recipient.id },
                  });
                  console.log(`Enrolled company ${companyId} in follow-up sequence for campaign ${campaignId}`);
                }
              }
            }
          } catch (followUpErr) {
            console.error('Campaign follow-up enrollment failed (non-fatal):', followUpErr);
          }
        }

        sentCount++;

        // Sending control: 1 email per 5 seconds to preserve SMTP health and avoid spam
        const delayMs = 5000;
        await new Promise((resolve) => setTimeout(resolve, delayMs));

      } catch (error: any) {
        console.error(`Failed to send to ${recipient.email}:`, error);

        // Update recipient with error
        await supabaseClient
          .from('email_campaign_recipients')
          .update({
            status: 'failed',
            error_message: error.message,
          })
          .eq('id', recipient.id);

        failedCount++;

        // Same delay after failed send so we don't hammer the provider
        const delayMs = 5000;
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }

    // Update campaign counts
    await supabaseClient
      .from('email_campaigns')
      .update({
        sent_count: campaign.sent_count + sentCount,
        failed_count: campaign.failed_count + failedCount,
      })
      .eq('id', campaignId);

    // Check if more recipients remain
    const { count } = await supabaseClient
      .from('email_campaign_recipients')
      .select('*', { count: 'exact', head: true })
      .eq('campaign_id', campaignId)
      .eq('status', 'pending');

    // If no more pending recipients, mark as completed
    if (count === 0) {
      await supabaseClient
        .from('email_campaigns')
        .update({ 
          status: 'completed',
          completed_at: new Date().toISOString()
        })
        .eq('id', campaignId);
    }

    console.log(`Campaign batch complete: ${sentCount} sent, ${failedCount} failed`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Sent ${sentCount} emails, ${failedCount} failed`,
        sent: sentCount,
        failed: failedCount,
        remainingPending: count,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error: any) {
    console.error('Error in send-bulk-emails function:', error);
    return new Response(
      JSON.stringify({
        error: error.message || 'An error occurred',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});