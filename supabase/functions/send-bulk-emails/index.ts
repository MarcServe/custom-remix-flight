import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";
import { wrapEmailContent } from "../_shared/email-wrapper.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
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

    const {
      data: { user },
      error: authError,
    } = await supabaseClient.auth.getUser();

    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    const { campaignId } = await req.json();

    if (!campaignId) {
      throw new Error('Campaign ID is required');
    }

    console.log(`Processing bulk email campaign: ${campaignId}`);

    // Get campaign details
    const { data: campaign, error: campaignError } = await supabaseClient
      .from('email_campaigns')
      .select('*, crm_connections(*)')
      .eq('id', campaignId)
      .eq('user_id', user.id)
      .single();

    if (campaignError || !campaign) {
      throw new Error('Campaign not found');
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

    // Get user profile for signature
    const { data: userProfile } = await supabaseClient
      .from('profiles')
      .select('full_name, job_title')
      .eq('id', user.id)
      .single();

    // Get business profile with email provider preference
    const { data: businessProfile } = await supabaseClient
      .from('business_profiles')
      .select('company_name, email_provider')
      .eq('user_id', user.id)
      .single();

    const emailProvider = businessProfile?.email_provider || 'resend';
    console.log(`Using email provider: ${emailProvider}`);

    // Send emails with rate limiting
    for (const recipient of recipients) {
      try {
        let messageId: string | null = null;
        const connection = campaign.crm_connections;

        if (!connection) {
          throw new Error('No email connection configured');
        }

        if (connection.provider === 'gmail') {
          // Send via Gmail/Nango
          const nangoSecretKey = Deno.env.get('NANGO_SECRET_KEY');
          if (!nangoSecretKey) throw new Error('Gmail not configured');

          const nangoResponse = await fetch('https://api.nango.dev/v1/gmail/messages', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${nangoSecretKey}`,
              'Connection-Id': connection.connection_id,
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
        } else if (connection.provider === 'smtp') {
          // Send via SMTP
          const senderName = businessProfile?.company_name || 'Your Business';
          const wrappedHtml = wrapEmailContent(
            recipient.personalized_body_html, 
            senderName, 
            connection.from_email
          );

          const smtpMode = (connection.metadata as any)?.smtp_mode || 'direct'; // Default to 'direct' for open-source use

          if (smtpMode === 'direct' && (connection.metadata as any)?.smtp_host) {
            // Direct SMTP
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

            await client.send({
              from: `${senderName} <${connection.from_email}>`,
              to: recipient.email,
              subject: recipient.personalized_subject,
              content: recipient.personalized_body_text,
              html: wrappedHtml,
            });

            await client.close();
            messageId = `direct-smtp-${Date.now()}`;
          } else {
            // Resend relay
            const resendApiKey = Deno.env.get('RESEND_API_KEY');
            if (!resendApiKey) throw new Error('Email service not configured');

            const resendResponse = await fetch('https://api.resend.com/emails', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${resendApiKey}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                from: `${senderName} <${connection.from_email}>`,
                to: [recipient.email],
                subject: recipient.personalized_subject,
                text: recipient.personalized_body_text,
                html: wrappedHtml,
              }),
            });

            if (!resendResponse.ok) {
              throw new Error('Resend send failed');
            }

            const resendData = await resendResponse.json();
            messageId = resendData.id || null;
          }
        } else if (emailProvider === 'sendgrid') {
          // Send via SendGrid
          const sendgridApiKey = Deno.env.get('SENDGRID_API_KEY');
          if (!sendgridApiKey) throw new Error('SendGrid not configured');

          const senderName = businessProfile?.company_name || 'Your Business';
          const fromEmail = connection.from_email || 'noreply@yourdomain.com';
          const wrappedHtml = wrapEmailContent(
            recipient.personalized_body_html, 
            senderName, 
            fromEmail
          );

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
        }

        // Update recipient status
        await supabaseClient
          .from('email_campaign_recipients')
          .update({
            status: 'sent',
            sent_at: new Date().toISOString(),
            external_message_id: messageId,
          })
          .eq('id', recipient.id);

        sentCount++;

        // Rate limiting: wait 200ms between emails
        await new Promise(resolve => setTimeout(resolve, 200));

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