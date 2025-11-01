import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";
import { wrapEmailContent } from "./_templates/email-wrapper.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface EmailRequest {
  toEmail: string;
  toName: string;
  subject: string;
  body?: string; // Plain text (legacy)
  bodyHtml?: string; // HTML content
  bodyText?: string; // Plain text version
  companyId?: string;
  contactId?: string;
  sender?: 'gmail' | 'resend' | 'smtp';
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabaseClient.auth.getUser();

    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    const emailRequest: EmailRequest = await req.json();
    const { toEmail, toName, subject, body, bodyHtml, bodyText, companyId, contactId, sender = 'resend' } = emailRequest;

    // Support both legacy plain text and new HTML emails
    const emailBodyHtml = bodyHtml || (body ? `<p>${body.replace(/\n/g, '</p><p>')}</p>` : '');
    const emailBodyText = bodyText || body || '';

    if (!toEmail || !subject || !emailBodyText) {
      throw new Error('Missing required fields: toEmail, subject, body');
    }

    console.log(`Sending email to ${toEmail} from user ${user.email} using ${sender}`);

    let messageId: string | null = null;
    let provider = sender;

    if (sender === 'gmail') {
      // Send via Nango/Gmail
      const { data: connection, error: connectionError } = await supabaseClient
        .from('crm_connections')
        .select('connection_id, provider')
        .eq('user_id', user.id)
        .eq('provider', 'gmail')
        .eq('status', 'active')
        .maybeSingle();

      if (connectionError || !connection) {
        throw new Error('Gmail not connected. Please connect Gmail in Settings or use Resend.');
      }

      const nangoSecretKey = Deno.env.get('NANGO_SECRET_KEY');
      if (!nangoSecretKey) {
        throw new Error('Gmail integration not configured.');
      }

      console.log(`Sending via Gmail using connection ${connection.connection_id}`);

      const nangoResponse = await fetch('https://api.nango.dev/v1/gmail/messages', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${nangoSecretKey}`,
          'Connection-Id': connection.connection_id,
          'Provider-Config-Key': 'google-mail',
          'Content-Type': 'application/json',
        },
      body: JSON.stringify({
        to: [{ email: toEmail, name: toName }],
        subject,
        body: {
          content: emailBodyText,
          type: 'text/plain',
        },
      }),
      });

      if (!nangoResponse.ok) {
        const errorData = await nangoResponse.text();
        console.error('Gmail API error:', errorData);
        throw new Error(`Failed to send via Gmail: ${errorData}`);
      }

      const nangoData = await nangoResponse.json();
      messageId = nangoData.id || null;
      console.log('Email sent via Gmail:', nangoData);
    } else if (sender === 'smtp') {
      // Send via SMTP (Direct or via Resend relay based on metadata.smtp_mode)
      const { data: connection, error: connectionError } = await supabaseClient
        .from('crm_connections')
        .select('from_email, status, metadata')
        .eq('user_id', user.id)
        .eq('provider', 'smtp')
        .eq('status', 'active')
        .maybeSingle();

      if (connectionError || !connection || !connection.from_email) {
        throw new Error('SMTP/Business Email not configured. Please verify your email in Settings.');
      }

      // Fetch business profile for company name
      const { data: businessProfile } = await supabaseClient
        .from('business_profiles')
        .select('company_name')
        .eq('user_id', user.id)
        .maybeSingle();

      const senderName = businessProfile?.company_name || 'Your Business';
      const smtpMode = (connection.metadata as any)?.smtp_mode || 'resend'; // 'direct' or 'resend'
      
      // Wrap HTML email with professional styling
      const wrappedHtml = wrapEmailContent(emailBodyHtml, senderName, connection.from_email);

      if (smtpMode === 'direct' && (connection.metadata as any)?.smtp_host) {
        // Direct SMTP Connection
        console.log(`Sending via Direct SMTP: ${(connection.metadata as any).smtp_host}`);

        const smtpConfig = connection.metadata as any;
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

        try {
          await client.send({
            from: `${senderName} <${connection.from_email}>`,
            to: toEmail,
            subject,
            content: emailBodyText,
            html: wrappedHtml,
          });

          await client.close();
          messageId = `direct-smtp-${Date.now()}`;
          provider = 'smtp';
          console.log('Email sent via Direct SMTP');
        } catch (smtpError: any) {
          console.error('Direct SMTP error:', smtpError);
          throw new Error(`Failed to send via Direct SMTP: ${smtpError.message}`);
        }
      } else {
        // Send via Resend (default relay mode)
        const resendApiKey = Deno.env.get('RESEND_API_KEY');
        
        if (!resendApiKey) {
          throw new Error('Email service not configured.');
        }

        console.log(`Sending via SMTP (Resend relay) with custom from: ${senderName} <${connection.from_email}>`);

        const resendResponse = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${resendApiKey}`,
            'Content-Type': 'application/json',
          },
        body: JSON.stringify({
          from: `${senderName} <${connection.from_email}>`,
          to: [toEmail],
          subject,
          text: emailBodyText,
          html: wrappedHtml,
        }),
        });

        if (!resendResponse.ok) {
          const errorData = await resendResponse.text();
          console.error('Resend API error (SMTP):', errorData);
          throw new Error(`Failed to send via Business Email: ${errorData}`);
        }

        const resendData = await resendResponse.json();
        messageId = resendData.id || null;
        provider = 'smtp';
        console.log('Email sent via SMTP (Resend relay):', resendData);
      }
    } else {
      // Send via Resend (default)
      const resendApiKey = Deno.env.get('RESEND_API_KEY');
      if (!resendApiKey) {
        throw new Error('Resend not configured. Please contact support.');
      }

      console.log('Sending via Resend');

      const resendResponse = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
      body: JSON.stringify({
        from: 'CRM <onboarding@resend.dev>',
        to: [toEmail],
        subject,
        text: emailBodyText,
        html: wrapEmailContent(emailBodyHtml, 'CRM', 'onboarding@resend.dev'),
      }),
      });

      if (!resendResponse.ok) {
        const errorData = await resendResponse.text();
        console.error('Resend API error:', errorData);
        throw new Error(`Failed to send via Resend: ${errorData}`);
      }

      const resendData = await resendResponse.json();
      messageId = resendData.id || null;
      console.log('Email sent via Resend:', resendData);
    }

    // Log email activity
    const { error: activityError } = await supabaseClient
      .from('email_activities')
      .insert({
        contact_id: contactId || null,
        company_sequence_id: companyId || null,
        step_number: 0,
        status: 'sent',
        subject,
        body: emailBodyText,
        sent_at: new Date().toISOString(),
        external_message_id: messageId,
        metadata: {
          provider,
          sent_via: 'crm_direct',
          has_html: !!emailBodyHtml,
        },
      });

    if (activityError) {
      console.error('Failed to log email activity:', activityError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Email sent successfully via ${sender}`,
        messageId,
        provider,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error('Error in send-crm-email function:', error);
    return new Response(
      JSON.stringify({
        error: error.message || 'An error occurred while sending the email',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
