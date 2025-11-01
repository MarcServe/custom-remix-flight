import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.78.0';
import { corsHeaders } from '../_shared/cors.ts';
import { wrapEmailContent } from '../_shared/email-wrapper.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { testEmail, subject, body, senderConnectionId, recipientName, recipientEmail } = await req.json();
    
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

    // Personalize content using the first recipient's data
    const personalizedSubject = subject
      .replace(/\{\{firstName\}\}/g, recipientName.split(' ')[0] || '')
      .replace(/\{\{lastName\}\}/g, recipientName.split(' ')[1] || '')
      .replace(/\{\{fullName\}\}/g, recipientName);

    const personalizedBody = body
      .replace(/\{\{firstName\}\}/g, recipientName.split(' ')[0] || '')
      .replace(/\{\{lastName\}\}/g, recipientName.split(' ')[1] || '')
      .replace(/\{\{fullName\}\}/g, recipientName);

    // Build signature
    const signatureText = `\n\nBest regards,\n${userProfile?.full_name || 'Team'}\n${userProfile?.job_title ? `${userProfile.job_title}\n` : ''}${businessProfile?.company_name || ''}`;

    // Prepare email content
    const bodyHtml = `<p>${personalizedBody.replace(/\n/g, '</p><p>')}</p>`;
    const wrappedHtml = wrapEmailContent(
      bodyHtml,
      userProfile?.full_name || 'Team',
      connection.from_email || (connection.metadata as any)?.email || ''
    );

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
        subject: `[TEST] ${personalizedSubject}`,
        html: wrappedHtml,
        text: personalizedBody + signatureText,
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
