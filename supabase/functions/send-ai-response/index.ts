import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SMTPClient } from 'https://deno.land/x/denomailer@1.6.0/mod.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { renderEmailTemplate } from '../_shared/professional-template.ts';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const SENDGRID_API_KEY = Deno.env.get('SENDGRID_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const RESEND_INBOUND_EMAIL = Deno.env.get('RESEND_INBOUND_EMAIL') || 'leadgenie@eldapgraaa.resend.app';

interface SendAIResponseRequest {
  companySequenceId: string;
  subject: string;
  body: string;
  recipientEmail?: string;
  inboundThreadId?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { companySequenceId, subject, body, recipientEmail, inboundThreadId }: SendAIResponseRequest = await req.json();

    if (!companySequenceId || !subject || !body) {
      throw new Error('Missing required fields: companySequenceId, subject, body');
    }

    console.log(`Sending AI response for sequence: ${companySequenceId}`);

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Fetch company sequence with related data
    const { data: companySequence, error: sequenceError } = await supabase
      .from('company_sequences')
      .select(`
        *,
        company:companies(id, name, website),
        sequence:email_sequences(name, user_id)
      `)
      .eq('id', companySequenceId)
      .single();

    if (sequenceError || !companySequence) {
      throw new Error(`Company sequence not found: ${sequenceError?.message}`);
    }

    // Fetch user profile for sender info
    const userId = (companySequence.sequence as any)?.user_id;
    if (!userId) {
      throw new Error('User not found for sequence');
    }

    const { data: userProfile } = await supabase
      .from('profiles')
      .select('full_name, email, job_title')
      .eq('id', userId)
      .single();

    const { data: businessProfile } = await supabase
      .from('business_profiles')
      .select('company_name, email_provider, auto_response_daily_limit, auto_response_paused, auto_response_count_today, auto_response_last_reset_date, ai_model, ai_response_style, ai_temperature, email_logo_url, email_brand_color, email_footer_text, email_signature, email_template_style')
      .eq('user_id', userId)
      .single();

    if (!businessProfile) {
      throw new Error('Business profile not found');
    }

    // Get email provider preference
    const emailProvider = businessProfile.email_provider || 'resend';
    console.log(`Using email provider: ${emailProvider}`);

    // Check if auto-response is paused globally
    if (businessProfile.auto_response_paused) {
      throw new Error('Auto-response is currently paused. Please unpause in settings to continue.');
    }

    // Check and reset daily counter if needed
    const today = new Date().toISOString().split('T')[0];
    let currentCount = businessProfile.auto_response_count_today || 0;
    
    if (businessProfile.auto_response_last_reset_date !== today) {
      // Reset counter for new day
      currentCount = 0;
      await supabase
        .from('business_profiles')
        .update({
          auto_response_count_today: 0,
          auto_response_last_reset_date: today,
        })
        .eq('user_id', userId);
    }

    // Check daily limit
    const dailyLimit = businessProfile.auto_response_daily_limit || 10;
    if (currentCount >= dailyLimit) {
      throw new Error(`Daily auto-response limit reached (${dailyLimit}). Increase limit in settings or wait until tomorrow.`);
    }

    // Use provided recipientEmail or fetch from contacts
    let recipientEmailAddress = recipientEmail;
    let contactName = '';

    if (!recipientEmailAddress) {
      const { data: contacts } = await supabase
        .from('contacts')
        .select('*')
        .eq('company_id', companySequence.company_id)
        .order('is_primary_contact', { ascending: false })
        .limit(1);

      if (!contacts || contacts.length === 0) {
        throw new Error('No contacts found for this company and no recipient email provided');
      }

      recipientEmailAddress = contacts[0].email;
      contactName = contacts[0].name;
    }

    if (!recipientEmailAddress) {
      throw new Error('Recipient email address is required');
    }

    // Check for email connection (SMTP or Gmail)
    const { data: emailConnection } = await supabase
      .from('crm_connections')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active')
      .in('provider', ['smtp', 'gmail'])
      .maybeSingle();

    let messageId: string | null = null;
    let provider = 'resend';
    const senderName = businessProfile?.company_name || userProfile?.full_name || 'CRM';
    const senderEmail = emailConnection?.from_email || userProfile?.email || 'noreply@yourdomain.com';

    // Render email with branded template
    const wrappedHtml = renderEmailTemplate(
      businessProfile?.email_template_style || 'professional',
      {
        body,
        senderName,
        senderEmail,
        senderTitle: userProfile?.job_title,
        companyName: businessProfile?.company_name,
        logoUrl: businessProfile?.email_logo_url,
        brandColor: businessProfile?.email_brand_color || '#8b5cf6',
        footerText: businessProfile?.email_footer_text,
        signature: businessProfile?.email_signature,
      }
    );

    // Send email based on available connection
    if (emailConnection?.provider === 'smtp' && emailConnection.from_email) {
      const smtpMode = (emailConnection.metadata as any)?.smtp_mode || 'direct';

      if (smtpMode === 'direct' && (emailConnection.metadata as any)?.smtp_host) {
        // Direct SMTP Connection
        console.log(`Sending AI response via Direct SMTP: ${(emailConnection.metadata as any).smtp_host}`);

        const smtpConfig = emailConnection.metadata as any;
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
          from: `${senderName} <${emailConnection.from_email}>`,
          to: recipientEmailAddress,
          subject,
          content: body,
          html: wrappedHtml,
        });

        await client.close();
        messageId = `direct-smtp-${Date.now()}`;
        provider = 'smtp';
        console.log('AI response sent via Direct SMTP');

      } else {
        // Resend relay mode
        if (!RESEND_API_KEY) {
          throw new Error('Email service not configured');
        }

        console.log(`Sending AI response via SMTP (Resend relay): ${senderName} <${emailConnection.from_email}>`);

        const resendResponse = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: `${senderName} <${emailConnection.from_email}>`,
            to: [recipientEmailAddress],
            subject,
            text: body,
            html: wrappedHtml,
          }),
        });

        if (!resendResponse.ok) {
          const errorText = await resendResponse.text();
          throw new Error(`Failed to send via SMTP: ${errorText}`);
        }

        const resendData = await resendResponse.json();
        messageId = resendData.id;
        provider = 'smtp';
        console.log('AI response sent via SMTP (Resend relay):', messageId);
      }

    } else if (emailConnection?.provider === 'gmail') {
      // Send via Gmail/Nango
      const nangoSecretKey = Deno.env.get('NANGO_SECRET_KEY');
      if (!nangoSecretKey) {
        throw new Error('Gmail integration not configured');
      }

      console.log(`Sending AI response via Gmail: ${emailConnection.connection_id}`);

      const nangoResponse = await fetch('https://api.nango.dev/v1/gmail/messages', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${nangoSecretKey}`,
          'Connection-Id': emailConnection.connection_id,
          'Provider-Config-Key': 'google-mail',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: [{ email: recipientEmailAddress, name: contactName || '' }],
          subject,
          body: {
            content: body,
            type: 'text/plain',
          },
        }),
      });

      if (!nangoResponse.ok) {
        const errorText = await nangoResponse.text();
        throw new Error(`Failed to send via Gmail: ${errorText}`);
      }

      const nangoData = await nangoResponse.json();
      messageId = nangoData.id;
      provider = 'gmail';
      console.log('AI response sent via Gmail:', messageId);

    } else {
      // SendGrid or Resend fallback
      if (emailProvider === 'sendgrid' && SENDGRID_API_KEY) {
        console.log('Sending AI response via SendGrid (fallback)');

        const sendgridResponse = await fetch('https://api.sendgrid.com/v3/mail/send', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${SENDGRID_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            personalizations: [{
              to: [{ email: recipientEmailAddress, name: contactName || '' }],
              subject: subject,
            }],
            from: {
              email: senderEmail,
              name: senderName,
            },
            reply_to: {
              email: senderEmail,
              name: senderName,
            },
            content: [
              {
                type: 'text/plain',
                value: body,
              },
              {
                type: 'text/html',
                value: wrappedHtml,
              },
            ],
            custom_args: {
              company_sequence_id: companySequenceId,
              auto_sent: 'true',
            },
          }),
        });

        if (!sendgridResponse.ok) {
          const errorText = await sendgridResponse.text();
          throw new Error(`Failed to send via SendGrid: ${errorText}`);
        }

        messageId = sendgridResponse.headers.get('X-Message-Id') || `sendgrid-${Date.now()}`;
        provider = 'sendgrid';
        console.log('AI response sent via SendGrid:', messageId);
        
      } else {
        // Fallback to Resend
      if (!RESEND_API_KEY) {
        throw new Error('No email provider configured. Please set up SMTP or Gmail in Settings.');
      }

      console.log('Sending AI response via Resend (fallback)');

      const resendResponse = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'CRM <onboarding@resend.dev>',
          to: [recipientEmailAddress],
          subject,
          text: body,
          reply_to: RESEND_INBOUND_EMAIL,
          html: renderEmailTemplate(
            businessProfile?.email_template_style || 'professional',
            {
              body,
              senderName: 'CRM',
              senderEmail: 'onboarding@resend.dev',
              senderTitle: userProfile?.job_title,
              companyName: businessProfile?.company_name,
              logoUrl: businessProfile?.email_logo_url,
              brandColor: businessProfile?.email_brand_color || '#8b5cf6',
              footerText: businessProfile?.email_footer_text,
              signature: businessProfile?.email_signature,
            }
          ),
        }),
      });

      if (!resendResponse.ok) {
        const errorText = await resendResponse.text();
        throw new Error(`Failed to send via Resend: ${errorText}`);
      }

      const resendData = await resendResponse.json();
      messageId = resendData.id;
      console.log('AI response sent via Resend:', messageId);
      }
    }

    // Create email_threads record for outbound email
    const { error: threadError } = await supabase
      .from('email_threads')
      .insert({
        company_sequence_id: companySequenceId,
        direction: 'outbound',
        from_email: senderEmail,
        to_email: recipientEmailAddress,
        subject,
        body_text: body,
        body_html: wrappedHtml,
        message_id: messageId,
        received_at: new Date().toISOString(),
        metadata: {
          provider,
          auto_sent: true,
          inbound_thread_id: inboundThreadId,
        },
      });

    if (threadError) {
      console.error('Failed to create email thread:', threadError);
    }

    // Create email_activities record (only if we have a contact_id from contacts table)
    let activityData = null;
    const { data: contactForActivity } = await supabase
      .from('contacts')
      .select('id')
      .eq('email', recipientEmailAddress)
      .eq('company_id', companySequence.company_id)
      .maybeSingle();

    if (contactForActivity) {
      const { data, error: activityError } = await supabase
        .from('email_activities')
        .insert({
          company_sequence_id: companySequenceId,
          contact_id: contactForActivity.id,
          step_number: (companySequence.current_step || 0) + 1,
          subject,
          body,
          status: 'sent',
          sent_at: new Date().toISOString(),
          external_message_id: messageId,
          metadata: {
            provider,
            auto_sent: true,
            ai_generated: true,
          },
        })
        .select()
        .single();

      activityData = data;
      
      if (activityError) {
        console.error('Failed to record email activity:', activityError);
      }
    }

    // Track analytics for sent auto-response
    if (activityData) {
      const { error: analyticsError } = await supabase
        .from('auto_response_analytics')
        .insert({
          user_id: userId,
          company_sequence_id: companySequenceId,
          email_activity_id: activityData.id,
          ai_model: businessProfile.ai_model || 'google/gemini-2.5-flash',
          ai_temperature: businessProfile.ai_temperature || 0.7,
          sent_at: new Date().toISOString(),
          token_count: (subject + body).length,
            metadata: {
              provider,
              recipient: recipientEmailAddress,
              company_name: (companySequence.company as any)?.name,
            },
        });

      if (analyticsError) {
        console.error('Failed to track analytics:', analyticsError);
      }
    }

    // Update company sequence
    const { error: updateError } = await supabase
      .from('company_sequences')
      .update({
        next_action: 'wait_for_response',
        updated_at: new Date().toISOString(),
        metadata: {
          ...(companySequence.metadata || {}),
          last_auto_response_at: new Date().toISOString(),
        },
      })
      .eq('id', companySequenceId);

    if (updateError) {
      console.error('Failed to update company sequence:', updateError);
    }

    // Increment daily auto-response counter
    await supabase
      .from('business_profiles')
      .update({
        auto_response_count_today: currentCount + 1,
      })
      .eq('user_id', userId);

    console.log(`AI response sent successfully to ${recipientEmailAddress} (${currentCount + 1}/${dailyLimit} today)`);

    return new Response(
      JSON.stringify({
        success: true,
        messageId,
        provider,
        recipient: recipientEmailAddress,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error in send-ai-response:', error);
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