import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { wrapEmailContent } from "../_shared/email-wrapper.ts";

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
  sender?: 'gmail' | 'gmail_direct' | 'resend' | 'smtp' | 'sendgrid';
  testConnection?: boolean; // Test SMTP connection without sending
  enableAutoResponder?: boolean; // Enable AI auto-responder for replies
  templateStyle?: string; // Email template style (professional, modern, minimal, etc.)
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
    let { toEmail, toName, subject, body, bodyHtml, bodyText, companyId, contactId, testConnection = false, enableAutoResponder = false, templateStyle = 'professional' } = emailRequest;
    
    // Fetch user profile for signature and business email
    const { data: userProfile } = await supabaseClient
      .from('profiles')
      .select('full_name, job_title, email')
      .eq('id', user.id)
      .single();

    // Fetch business profile for company name and email provider preference
    const { data: businessProfile } = await supabaseClient
      .from('business_profiles')
      .select('company_name, email_provider')
      .eq('user_id', user.id)
      .maybeSingle();
    
    // Determine sender based on business profile preference
    let sender: 'gmail' | 'gmail_direct' | 'resend' | 'smtp' | 'sendgrid' = emailRequest.sender || businessProfile?.email_provider || 'resend';
    
    console.log(`Email provider preference: ${businessProfile?.email_provider}, Using: ${sender}`);

    // Generate thread_id for email threading (used across all sending methods)
    const threadId = `crm_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Build email signature
    const signatureText = `\n\nBest regards,\n${userProfile?.full_name || 'Team'}\n${userProfile?.job_title ? `${userProfile.job_title}\n` : ''}${businessProfile?.company_name || ''}`;
    const signatureHtml = `<br><br><p>Best regards,<br><strong>${userProfile?.full_name || 'Team'}</strong><br>${userProfile?.job_title ? `${userProfile.job_title}<br>` : ''}${businessProfile?.company_name || ''}</p>`;

    // Support both legacy plain text and new HTML emails with signature
    let emailBodyHtml = bodyHtml || (body ? `<p>${body.replace(/\n/g, '</p><p>')}</p>` : '');
    let emailBodyText = bodyText || body || '';

    // Append signature if not already present
    if (!emailBodyText.includes('Best regards,')) {
      emailBodyText += signatureText;
    }
    if (!emailBodyHtml.includes('Best regards,')) {
      emailBodyHtml += signatureHtml;
    }

    if (!toEmail || !subject || !emailBodyText) {
      throw new Error('Missing required fields: toEmail, subject, body');
    }

    console.log(`Sending email to ${toEmail} from user ${user.email} using ${sender}`);

    let messageId: string | null = null;
    let provider = sender;

    if (sender === 'gmail' || sender === 'gmail_direct') {
      // Send via Gmail Direct OAuth
      const { data: connection, error: connectionError } = await supabaseClient
        .from('crm_connections')
        .select('id, metadata, from_email')
        .eq('user_id', user.id)
        .in('provider', ['gmail', 'gmail_direct'])
        .eq('status', 'active')
        .maybeSingle();

      if (connectionError || !connection) {
        throw new Error('Gmail not connected. Please connect Gmail in Settings.');
      }

      const metadata = connection.metadata as any;
      let accessToken = metadata?.access_token;
      const refreshToken = metadata?.refresh_token;
      const expiresAt = metadata?.expires_at;

      // Check if token is expired and refresh if needed
      if (expiresAt && new Date(expiresAt) <= new Date()) {
        console.log('Gmail access token expired, refreshing...');
        
        const refreshResponse = await supabaseClient.functions.invoke('gmail-oauth-refresh', {
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

      // Get from email
      const fromEmail = connection.from_email || userProfile?.email || user.email;
      if (!fromEmail) {
        throw new Error('Could not determine sender email address.');
      }

      console.log(`Sending via Gmail Direct API from: ${fromEmail}`);

      // Build Gmail API message
      const emailLines = [
        `From: ${fromEmail}`,
        `To: ${toEmail}`,
        `Subject: ${subject}`,
        'MIME-Version: 1.0',
        'Content-Type: text/plain; charset=utf-8',
        '',
        emailBodyText
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
      messageId = gmailData.id || null;
      provider = 'gmail_direct';
      console.log('Email sent via Gmail Direct:', gmailData);
    } else if (sender === 'smtp') {
      // Send via Resend using verified business email
      const { data: connection, error: connectionError } = await supabaseClient
        .from('crm_connections')
        .select('from_email, status')
        .eq('user_id', user.id)
        .eq('provider', 'smtp')
        .eq('status', 'active')
        .maybeSingle();

      if (connectionError || !connection || !connection.from_email) {
        throw new Error('Business Email not configured. Please verify your email in Settings.');
      }

      // Fetch business profile for company name
      const { data: businessProfile } = await supabaseClient
        .from('business_profiles')
        .select('company_name')
        .eq('user_id', user.id)
        .maybeSingle();

      // Priority: connection.from_email > profiles.email > error
      const fromEmail = connection.from_email || userProfile?.email;
      if (!fromEmail) {
        throw new Error('Business Email not configured. Please set your business email in Settings > Profile.');
      }

      const senderName = businessProfile?.company_name || 'Your Business';
      const wrappedHtml = wrapEmailContent(emailBodyHtml, senderName, fromEmail);

      console.log(`Sending via Resend with verified domain: ${senderName} <${connection.from_email}>`);

      const resendApiKey = Deno.env.get('RESEND_API_KEY');
      if (!resendApiKey) {
        throw new Error('Email service not configured.');
      }

      const resendResponse = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: `${senderName} <${fromEmail}>`,
          to: [toEmail],
          subject,
          text: emailBodyText,
          html: wrappedHtml,
          reply_to: fromEmail, // Enable replies to this address
          headers: {
            'X-Entity-Ref-ID': threadId, // Custom header for tracking
          },
        }),
      });

      if (!resendResponse.ok) {
        const errorData = await resendResponse.text();
        console.error('Resend API error:', errorData);
        throw new Error(`Failed to send email: ${errorData}`);
      }

      const resendData = await resendResponse.json();
      messageId = resendData.id || null;
      provider = 'smtp';
      console.log('Email sent successfully via Resend:', resendData);
    } else if (sender === 'sendgrid') {
      // Send via SendGrid
      const sendgridApiKey = Deno.env.get('SENDGRID_API_KEY');
      if (!sendgridApiKey) {
        throw new Error('SendGrid not configured. Please add SENDGRID_API_KEY.');
      }

      // Get verified sender email
      const { data: connection } = await supabaseClient
        .from('crm_connections')
        .select('from_email')
        .eq('user_id', user.id)
        .eq('provider', 'smtp')
        .eq('status', 'active')
        .maybeSingle();

      const { data: businessProfile } = await supabaseClient
        .from('business_profiles')
        .select('company_name')
        .eq('user_id', user.id)
        .maybeSingle();

      // Priority: connection.from_email > profiles.email > error
      const fromEmail = connection?.from_email || userProfile?.email;
      if (!fromEmail) {
        throw new Error('Business Email not configured. Please set your business email in Settings > Profile and verify it in SendGrid.');
      }
      const senderName = businessProfile?.company_name || 'Your Business';
      const wrappedHtml = wrapEmailContent(emailBodyHtml, senderName, fromEmail);

      console.log(`Sending via SendGrid from: ${senderName} <${fromEmail}>`);

      const sendgridResponse = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${sendgridApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          personalizations: [{
            to: [{ email: toEmail, name: toName }],
            subject: subject,
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
              value: emailBodyText,
            },
            {
              type: 'text/html',
              value: wrappedHtml,
            },
          ],
          custom_args: {
            thread_id: threadId,
            crm_tracking: 'true',
          },
        }),
      });

      if (!sendgridResponse.ok) {
        const errorData = await sendgridResponse.text();
        console.error('SendGrid API error:', errorData);
        throw new Error(`Failed to send via SendGrid: ${errorData}`);
      }

      // SendGrid returns 202 Accepted with X-Message-Id header
      messageId = sendgridResponse.headers.get('X-Message-Id') || null;
      provider = 'sendgrid';
      console.log('Email sent successfully via SendGrid:', messageId);
    } else {
      // Send via Resend (default)
      const resendApiKey = Deno.env.get('RESEND_API_KEY');
      if (!resendApiKey) {
        throw new Error('Resend not configured. Please contact support.');
      }

      // Get Resend connection for verified from_email
      const { data: resendConnection } = await supabaseClient
        .from('crm_connections')
        .select('from_email')
        .eq('user_id', user.id)
        .eq('provider', 'resend')
        .eq('status', 'active')
        .maybeSingle();

      const fromEmail = resendConnection?.from_email || userProfile?.email || 'onboarding@resend.dev';
      const senderName = businessProfile?.company_name || 'CRM';

      console.log(`Sending via Resend from: ${senderName} <${fromEmail}>`);

      const resendResponse = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
      body: JSON.stringify({
        from: `${senderName} <${fromEmail}>`,
        to: [toEmail],
        subject,
        text: emailBodyText,
        html: wrapEmailContent(emailBodyHtml, senderName, fromEmail),
        reply_to: fromEmail, // Enable replies
        headers: {
          'X-Entity-Ref-ID': threadId, // Custom header for tracking
        },
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

    // Check if company has an active sequence
    let linkedSequenceId: string | null = null;
    
    if (companyId) {
      console.log(`Checking for active sequences for company ${companyId}`);
      const { data: activeSequences, error: seqError } = await supabaseClient
        .from('company_sequences')
        .select('id, status')
        .eq('company_id', companyId)
        .in('status', ['active', 'draft'])
        .order('updated_at', { ascending: false })
        .limit(1);
      
      if (!seqError && activeSequences && activeSequences.length > 0) {
        linkedSequenceId = activeSequences[0].id;
        console.log(`Linking email to sequence ${linkedSequenceId}`);
      } else {
        console.log('No active sequences found for company, creating standalone email');
      }
    }

    // Log to email_activities for tracking
    const { data: activityData, error: activityError } = await supabaseClient
      .from('email_activities')
      .insert({
        contact_id: contactId || null,
        company_sequence_id: linkedSequenceId, // Link to sequence if exists, otherwise null
        step_number: linkedSequenceId ? 1 : 0, // If linked to sequence, it's step 1
        status: 'sent',
        subject,
        body: emailBodyText,
        sent_at: new Date().toISOString(),
        external_message_id: messageId,
        thread_id: threadId,
        metadata: {
          provider,
          sent_via: 'crm_direct',
          has_html: !!emailBodyHtml,
          to_email: toEmail,
          to_name: toName,
          company_id: companyId || null,
          auto_linked: !!linkedSequenceId,
          enable_auto_responder: enableAutoResponder,
          template_style: templateStyle,
        },
      })
      .select()
      .single();

    if (activityError) {
      console.error('Failed to log email activity:', activityError);
    }

    // If linked to sequence, update the sequence's current_step and updated_at
    if (linkedSequenceId && activityData) {
      const { error: updateError } = await supabaseClient
        .from('company_sequences')
        .update({
          current_step: 1,
          updated_at: new Date().toISOString(),
        })
        .eq('id', linkedSequenceId);
      
      if (updateError) {
        console.error('Failed to update sequence step:', updateError);
      } else {
        console.log('Sequence updated with new step');
      }
    }

    // ALSO create entry in email_threads for conversation view
    // This is KEY for reply tracking and unified conversation view
    if (activityData) {
      try {
        // Get the user's from_email with priority order
        const { data: connection, error: connError } = await supabaseClient
          .from('crm_connections')
          .select('from_email')
          .eq('user_id', user.id)
          .eq('provider', provider)
          .eq('status', 'active')
          .maybeSingle();

        if (connError) {
          console.error('Error fetching connection for email thread:', connError);
        }

        // Priority: connection.from_email > profiles.email > user.email
        const fromEmail = connection?.from_email || userProfile?.email || user.email || 'noreply@crm.com';

        console.log(`Creating email thread - From: ${fromEmail}, To: ${toEmail}, ThreadID: ${threadId}`);

        const { data: threadData, error: threadError } = await supabaseClient
          .from('email_threads')
          .insert({
            company_sequence_id: linkedSequenceId, // Link to sequence if exists
            from_email: fromEmail,
            to_email: toEmail,
            subject,
            body_text: emailBodyText,
            body_html: emailBodyHtml,
            direction: 'outbound',
            thread_id: threadId,
            message_id: messageId,
            received_at: new Date().toISOString(),
            ai_analysis: null,
            sentiment: null,
          })
          .select()
          .single();

        if (threadError) {
          console.error('❌ CRITICAL: Failed to create email thread:', {
            error: threadError,
            details: {
              fromEmail,
              toEmail,
              threadId,
              messageId,
              userId: user.id,
              provider,
            }
          });
          // Don't throw - email was sent successfully, just log the thread creation failure
        } else {
          console.log('✅ Email thread created successfully:', threadData?.id);
        }
      } catch (threadCreationError) {
        console.error('❌ Exception creating email thread:', threadCreationError);
        // Don't throw - email was sent successfully
      }
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
