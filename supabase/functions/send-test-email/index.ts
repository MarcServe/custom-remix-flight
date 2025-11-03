import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.78.0';
import { corsHeaders } from '../_shared/cors.ts';
import { renderEmailTemplate } from '../_shared/professional-template.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const SENDGRID_API_KEY = Deno.env.get('SENDGRID_API_KEY');

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      testEmail, 
      subject, 
      body, 
      senderConnectionId, 
      recipientName, 
      recipientEmail,
      templateStyle,
      brandColor,
      logoUrl,
      companyName,
      footerText,
      signature,
      provider, // Provider can be specified directly for API-key providers
    } = await req.json();
    
    console.log('Sending test email to:', testEmail, 'using provider:', provider);

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Authorization required');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      throw new Error('Invalid authorization');
    }

    // Get sender connection (optional for API-key providers like Resend/SendGrid)
    let connection = null;
    if (senderConnectionId) {
      console.log('Looking for connection with ID:', senderConnectionId);
      const { data: conn, error: connError } = await supabase
        .from('crm_connections')
        .select('*')
        .eq('connection_id', senderConnectionId)
        .eq('user_id', user.id)
        .single();
      
      if (connError) {
        console.error('Error fetching connection:', connError);
      }
      connection = conn;
    } else if (provider) {
      // Try to find connection by provider if no ID was provided
      console.log('Looking for connection by provider:', provider);
      const { data: conn, error: connError } = await supabase
        .from('crm_connections')
        .select('*')
        .eq('user_id', user.id)
        .eq('provider', provider)
        .eq('status', 'active')
        .maybeSingle();
      
      if (connError) {
        console.error('Error fetching connection by provider:', connError);
      }
      connection = conn;
    }

    console.log('Connection found:', !!connection, 'Provider:', provider, 'Connection ID:', connection?.id);

    // Outlook OAuth sending not yet supported - Gmail Direct now works!
    if (provider && ['outlook', 'microsoft'].includes(provider.toLowerCase())) {
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Outlook test emails are not yet supported. Please use Gmail, Resend, or SendGrid for sending test emails. Outlook is connected for receiving emails and webhooks.'
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // For API-key providers (resend, sendgrid) and Gmail Direct, connection is optional
    if (!connection && provider && !['resend', 'sendgrid', 'gmail', 'gmail_direct'].includes(provider.toLowerCase())) {
      throw new Error('Sender connection required for this provider');
    }

    // Get user profile for signature and business email
    const { data: userProfile } = await supabase
      .from('profiles')
      .select('full_name, job_title, email')
      .eq('id', user.id)
      .single();

    const { data: businessProfile } = await supabase
      .from('business_profiles')
      .select('company_name, email_provider')
      .eq('user_id', user.id)
      .single();

    // Determine which email provider to use
    const emailProvider = provider?.toLowerCase() || businessProfile?.email_provider || 'resend';
    console.log('Using email provider:', emailProvider);

    // Get API-key provider connection for verified from_email
    const { data: apiKeyConnection } = await supabase
      .from('crm_connections')
      .select('from_email, capabilities, metadata')
      .eq('user_id', user.id)
      .eq('provider', emailProvider)
      .eq('status', 'active')
      .maybeSingle();
    
    // Simple test email case (just provider test, no template/campaign)
    if (!templateStyle && !body) {
      const testSubject = 'Test Email - Provider Configuration Check';
      const testBody = `Hi there,\n\nThis is a test email from your CRM to verify your ${emailProvider} configuration is working correctly.\n\nIf you're seeing this, your email provider is set up properly!\n\nBest regards,\nYour CRM Team`;
      
      let messageId;
      
      // === DEBUG LOGGING ===
      console.log('=== EMAIL PROVIDER CHECK ===');
      console.log('emailProvider:', emailProvider);
      console.log('connection exists:', !!connection);
      console.log('connection provider:', connection?.provider);
      console.log('connection status:', connection?.status);
      console.log('connection.from_email:', connection?.from_email);
      console.log('senderConnectionId:', senderConnectionId);
      console.log('About to check gmail_direct condition');
      console.log('=== END DEBUG ===');
      
      if (emailProvider === 'gmail_direct' || emailProvider === 'gmail') {
        // Send via Gmail Direct API
        if (!connection) {
          throw new Error('Gmail connection not found. Please reconnect your Gmail account.');
        }

        const metadata = connection.metadata as any;
        let accessToken = metadata?.access_token;
        const expiresAt = metadata?.expires_at;

        // Check if token is expired and refresh if needed
        if (expiresAt && new Date(expiresAt) <= new Date()) {
          console.log('Gmail access token expired, refreshing...');
          
          const refreshResponse = await supabase.functions.invoke('gmail-oauth-refresh', {
            body: { connection_id: connection.id }
          });

          if (refreshResponse.error || !refreshResponse.data?.access_token) {
            throw new Error('Failed to refresh Gmail token. Please reconnect your Gmail account.');
          }

          accessToken = refreshResponse.data.access_token;
        }

        if (!accessToken) {
          throw new Error('Gmail access token not found. Please reconnect your Gmail account.');
        }

        const fromEmail = connection.from_email || userProfile?.email || user.email;
        
        // Build Gmail API message
        const emailLines = [
          `From: ${fromEmail}`,
          `To: ${testEmail}`,
          `Subject: ${testSubject}`,
          'MIME-Version: 1.0',
          'Content-Type: text/plain; charset=utf-8',
          '',
          testBody
        ];

        const emailMessage = emailLines.join('\r\n');
        const encodedMessage = btoa(emailMessage)
          .replace(/\+/g, '-')
          .replace(/\//g, '_')
          .replace(/=+$/, '');

        // Send via Gmail API
        const gmailResponse = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            raw: encodedMessage
          }),
        });

        if (!gmailResponse.ok) {
          const errorData = await gmailResponse.text();
          console.error('Gmail API error:', errorData);
          throw new Error(`Failed to send via Gmail: ${errorData}`);
        }

        const gmailData = await gmailResponse.json();
        messageId = gmailData.id || 'gmail-sent';
        console.log('Test email sent via Gmail Direct:', messageId);
      } else if (emailProvider === 'sendgrid' && SENDGRID_API_KEY) {
        const sendgridResponse = await fetch('https://api.sendgrid.com/v3/mail/send', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${SENDGRID_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            personalizations: [{
              to: [{ email: testEmail }],
              subject: testSubject,
            }],
            from: {
              email: apiKeyConnection?.from_email || connection?.from_email || userProfile?.email || user.email || 'noreply@yourdomain.com',
              name: userProfile?.full_name || 'CRM',
            },
            content: [
              {
                type: 'text/plain',
                value: testBody,
              },
            ],
          }),
        });

        if (!sendgridResponse.ok) {
          const errorText = await sendgridResponse.text();
          console.error('SendGrid API error:', errorText);
          
          // Try to parse SendGrid error for better message
          try {
            const errorJson = JSON.parse(errorText);
            const errorMsg = errorJson.errors?.[0]?.message || errorText;
            throw new Error(`SendGrid error: ${errorMsg}`);
          } catch {
            throw new Error(`SendGrid error: ${errorText}`);
          }
        }

        messageId = sendgridResponse.headers.get('X-Message-Id') || 'sendgrid-sent';
        console.log('Test email sent via SendGrid:', messageId);
      } else {
        if (!RESEND_API_KEY) {
          throw new Error('Resend API key not configured');
        }
        
        const resendResponse = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: apiKeyConnection?.from_email 
              ? `CRM <${apiKeyConnection.from_email}>` 
              : connection?.from_email 
                ? `CRM <${connection.from_email}>` 
                : userProfile?.email 
                  ? `CRM <${userProfile.email}>` 
                  : `CRM <onboarding@resend.dev>`,
            to: [testEmail],
            subject: testSubject,
            text: testBody,
          }),
        });

        if (!resendResponse.ok) {
          const errorText = await resendResponse.text();
          throw new Error(`Failed to send test email via Resend: ${errorText}`);
        }

        const data = await resendResponse.json();
        messageId = data.id;
        console.log('Test email sent via Resend:', messageId);
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          messageId, 
          provider: emailProvider,
          trackingEnabled: ['resend', 'sendgrid', 'gmail_direct', 'gmail'].includes(emailProvider),
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }
    
    // For template preview test
    if (templateStyle) {
      const sampleBody = `Hi there,

This is a test email to preview your email branding and template design.

Your emails will use this ${templateStyle} template with your custom branding, including your logo, brand colors, and signature.

This helps ensure your automated responses maintain a consistent and professional appearance that represents your brand.

If you're satisfied with how this looks, you're all set! Your auto-responses will use this template.`;

      const html = renderEmailTemplate(templateStyle, {
        body: sampleBody,
        senderName: userProfile?.full_name || 'Test Sender',
        senderEmail: recipientEmail,
        senderTitle: userProfile?.job_title,
        companyName: companyName || businessProfile?.company_name,
        logoUrl,
        brandColor: brandColor || '#8b5cf6',
        footerText,
        signature,
      });

      let messageId;
      
      if (emailProvider === 'sendgrid' && SENDGRID_API_KEY) {
        const sendgridResponse = await fetch('https://api.sendgrid.com/v3/mail/send', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${SENDGRID_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            personalizations: [{
              to: [{ email: recipientEmail }],
              subject: '🎨 Test Email - Your Email Template Preview',
            }],
            from: {
              email: apiKeyConnection?.from_email || connection?.from_email || userProfile?.email || 'noreply@yourdomain.com',
              name: companyName || 'CRM',
            },
            content: [
              {
                type: 'text/html',
                value: html,
              },
            ],
          }),
        });

        if (!sendgridResponse.ok) {
          const errorText = await sendgridResponse.text();
          throw new Error(`Failed to send test email via SendGrid: ${errorText}`);
        }

        messageId = sendgridResponse.headers.get('X-Message-Id') || 'sendgrid-sent';
        console.log('Template test email sent via SendGrid:', messageId);
      } else {
        if (!RESEND_API_KEY) {
          throw new Error('Email provider not configured');
        }
        
        const resendResponse = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: apiKeyConnection?.from_email 
              ? `${companyName || 'CRM'} <${apiKeyConnection.from_email}>` 
              : connection?.from_email 
                ? `${companyName || 'CRM'} <${connection.from_email}>` 
                : userProfile?.email 
                  ? `${companyName || 'CRM'} <${userProfile.email}>` 
                  : `${companyName || 'CRM'} <onboarding@resend.dev>`,
            to: [recipientEmail],
            subject: '🎨 Test Email - Your Email Template Preview',
            html,
          }),
        });

        if (!resendResponse.ok) {
          const errorText = await resendResponse.text();
          throw new Error(`Failed to send test email via Resend: ${errorText}`);
        }

        const data = await resendResponse.json();
        messageId = data.id;
        console.log('Template test email sent via Resend:', messageId);
      }

      return new Response(
        JSON.stringify({ success: true, messageId, provider: emailProvider }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Original bulk campaign test logic (connection optional for API-key providers)

    // Personalize content using the first recipient's data
    const personalizedSubject2 = subject
      .replace(/\{\{firstName\}\}/g, recipientName.split(' ')[0] || '')
      .replace(/\{\{lastName\}\}/g, recipientName.split(' ')[1] || '')
      .replace(/\{\{fullName\}\}/g, recipientName);

    const personalizedBody2 = body
      .replace(/\{\{firstName\}\}/g, recipientName.split(' ')[0] || '')
      .replace(/\{\{lastName\}\}/g, recipientName.split(' ')[1] || '')
      .replace(/\{\{fullName\}\}/g, recipientName);

    // Build signature
    const signatureText = `\n\nBest regards,\n${userProfile?.full_name || 'Team'}\n${userProfile?.job_title ? `${userProfile.job_title}\n` : ''}${businessProfile?.company_name || ''}`;

    // Prepare email content with signature
    const bodyHtml = renderEmailTemplate('professional', {
      body: personalizedBody2 + signatureText,
      senderName: userProfile?.full_name || 'Team',
      senderEmail: connection?.from_email || (connection?.metadata as any)?.email || user.email || '',
      senderTitle: userProfile?.job_title,
      companyName: businessProfile?.company_name,
    });

    // Send via configured provider
    let messageId;
    
    if (emailProvider === 'sendgrid' && SENDGRID_API_KEY) {
      const sendgridResponse = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${SENDGRID_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          personalizations: [{
            to: [{ email: testEmail }],
            subject: `[TEST] ${personalizedSubject2}`,
          }],
          from: {
            email: apiKeyConnection?.from_email || connection?.from_email || userProfile?.email || user.email || 'noreply@yourdomain.com',
            name: userProfile?.full_name || 'Team',
          },
          content: [
            {
              type: 'text/plain',
              value: personalizedBody2 + signatureText,
            },
            {
              type: 'text/html',
              value: bodyHtml,
            },
          ],
        }),
      });

        if (!sendgridResponse.ok) {
          const errorText = await sendgridResponse.text();
          console.error('SendGrid API error:', errorText);
          
          // Try to parse SendGrid error for better message
          try {
            const errorJson = JSON.parse(errorText);
            const errorMsg = errorJson.errors?.[0]?.message || errorText;
            throw new Error(`SendGrid error: ${errorMsg}`);
          } catch {
            throw new Error(`SendGrid error: ${errorText}`);
          }
        }

      messageId = sendgridResponse.headers.get('X-Message-Id') || 'sendgrid-sent';
      console.log('Test email sent successfully via SendGrid:', messageId);
    } else {
      if (!RESEND_API_KEY) {
        throw new Error('Email provider not configured');
      }
      
      const resendResponse = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: apiKeyConnection?.from_email 
            ? `${userProfile?.full_name || 'Team'} <${apiKeyConnection.from_email}>` 
            : connection?.from_email 
              ? `${userProfile?.full_name || 'Team'} <${connection.from_email}>` 
              : userProfile?.email 
                ? `${userProfile?.full_name || 'Team'} <${userProfile.email}>` 
                : `${userProfile?.full_name || 'Team'} <onboarding@resend.dev>`,
          to: [testEmail],
          subject: `[TEST] ${personalizedSubject2}`,
          html: bodyHtml,
          text: personalizedBody2 + signatureText,
        }),
      });

      if (!resendResponse.ok) {
        const errorText = await resendResponse.text();
        console.error('Resend API error:', errorText);
        throw new Error('Failed to send test email via Resend');
      }

      const data = await resendResponse.json();
      messageId = data.id;
      console.log('Test email sent successfully via Resend:', messageId);
    }

    return new Response(
      JSON.stringify({ success: true, messageId, provider: emailProvider }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error sending test email:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
