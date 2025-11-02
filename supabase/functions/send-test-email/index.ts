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
      provider, // New field to specify provider directly
    } = await req.json();
    
    console.log('Sending test email to:', testEmail);

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
      const { data: conn } = await supabase
        .from('crm_connections')
        .select('*')
        .eq('id', senderConnectionId)
        .single();
      connection = conn;
    }

    // For API-key providers (resend, sendgrid), connection is optional
    // For OAuth providers (gmail, outlook), connection is required
    if (!connection && provider && !['resend', 'sendgrid'].includes(provider)) {
      throw new Error('Sender connection required for this provider');
    }

    // Get user profile for signature
    const { data: userProfile } = await supabase
      .from('profiles')
      .select('full_name, job_title')
      .eq('id', user.id)
      .single();

    const { data: businessProfile } = await supabase
      .from('business_profiles')
      .select('company_name, email_provider')
      .eq('user_id', user.id)
      .single();

    // Determine which email provider to use
    const emailProvider = provider || businessProfile?.email_provider || 'resend';
    console.log('Using email provider:', emailProvider);
    
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
              email: connection?.from_email || 'noreply@yourdomain.com',
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
            from: `${companyName || 'CRM'} <onboarding@resend.dev>`,
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
            email: connection?.from_email || user.email || 'noreply@yourdomain.com',
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
        throw new Error('Failed to send test email via SendGrid');
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
          from: connection?.from_email || `${userProfile?.full_name || 'Team'} <onboarding@resend.dev>`,
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
