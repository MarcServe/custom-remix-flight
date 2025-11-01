import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.78.0';
import { corsHeaders } from '../_shared/cors.ts';
import { renderEmailTemplate } from '../_shared/professional-template.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!;

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

    // Get sender connection
    const { data: connection, error: connError } = await supabase
      .from('crm_connections')
      .select('*')
      .eq('id', senderConnectionId)
      .single();

    if (connError || !connection) {
      throw new Error('Sender connection not found');
    }

    // Get user profile for signature
    const { data: userProfile } = await supabase
      .from('profiles')
      .select('full_name, job_title')
      .eq('id', user.id)
      .single();

    const { data: businessProfile } = await supabase
      .from('business_profiles')
      .select('company_name')
      .eq('user_id', user.id)
      .single();

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
        throw new Error(`Failed to send test email: ${errorText}`);
      }

      const data = await resendResponse.json();
      console.log('Template test email sent:', data.id);

      return new Response(
        JSON.stringify({ success: true, messageId: data.id }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Original bulk campaign test logic
    if (!connection) {
      throw new Error('Connection required for bulk campaign test');
    }

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
      senderEmail: connection.from_email || (connection.metadata as any)?.email || '',
      senderTitle: userProfile?.job_title,
      companyName: businessProfile?.company_name,
    });

    // Send via Resend
    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: connection.from_email || `${userProfile?.full_name || 'Team'} <onboarding@resend.dev>`,
        to: [testEmail],
        subject: `[TEST] ${personalizedSubject2}`,
        html: bodyHtml,
        text: personalizedBody2 + signatureText,
      }),
    });

    if (!resendResponse.ok) {
      const errorText = await resendResponse.text();
      console.error('Resend API error:', errorText);
      throw new Error('Failed to send test email');
    }

    const data = await resendResponse.json();
    console.log('Test email sent successfully:', data);

    return new Response(
      JSON.stringify({ success: true, messageId: data.id }),
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
