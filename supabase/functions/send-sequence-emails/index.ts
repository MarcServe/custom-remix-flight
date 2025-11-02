import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.78.0';
import { corsHeaders } from '../_shared/cors.ts';

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

    // Get verified contact
    const { data: contacts } = await supabase
      .from('contacts')
      .select('*')
      .eq('company_id', companySequence.company_id)
      .eq('email_verified', true)
      .order('is_primary_contact', { ascending: false })
      .limit(1);

    if (!contacts || contacts.length === 0) {
      throw new Error('No verified contact found for this company');
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

    // Get business profile for email provider preference
    const { data: businessProfile } = await supabase
      .from('business_profiles')
      .select('email_provider, company_name')
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
      || connections.find(c => c.tracking_enabled && ['gmail', 'outlook'].includes(c.provider))
      || connections[0];

    const emailProvider = connection.provider;
    console.log(`Using optimal email provider: ${emailProvider} (tracking: ${connection.tracking_enabled})`);

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

        if (emailProvider === 'gmail') {
          // Send via Nango Gmail API
          const nangoResponse = await fetch(`https://api.nango.dev/gmail/messages/send`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${NANGO_SECRET_KEY}`,
              'Connection-Id': connection.connection_id,
              'Provider-Config-Key': 'gmail',
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              to: contact.email,
              subject: emailData.subject,
              body: emailData.body,
              from: user.email,
            }),
          });

          if (!nangoResponse.ok) {
            const errorText = await nangoResponse.text();
            throw new Error(`Failed to send email: ${errorText}`);
          }

          const nangoData = await nangoResponse.json();
          emailMessageId = nangoData.id || null;
        } else if (emailProvider === 'sendgrid') {
          // Send via SendGrid
          const SENDGRID_API_KEY = Deno.env.get('SENDGRID_API_KEY');
          if (!SENDGRID_API_KEY) {
            throw new Error('SendGrid API key not configured');
          }

          const fromEmail = connection?.from_email || 'noreply@yourdomain.com';
          const senderName = businessProfile?.company_name || 'Your Business';

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
              content: [{
                type: 'text/plain',
                value: emailData.body,
              }],
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

          // Get Resend connection for verified from_email
          const { data: resendConnection } = await supabase
            .from('crm_connections')
            .select('from_email')
            .eq('user_id', user.id)
            .eq('provider', 'resend')
            .eq('status', 'active')
            .maybeSingle();

          const fromEmail = resendConnection?.from_email || connection?.from_email || 'onboarding@resend.dev';
          const senderName = businessProfile?.company_name || 'CRM';

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
            }),
          });

          if (!resendResponse.ok) {
            const errorText = await resendResponse.text();
            throw new Error(`Failed to send via Resend: ${errorText}`);
          }

          const resendData = await resendResponse.json();
          emailMessageId = resendData.id || null;
        }

        // Record email activity with detailed tracking metadata
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
            metadata: {
              provider: emailProvider,
              sending_method: connection.sending_method,
              tracking_enabled: connection.tracking_enabled,
              can_track_opens: connection.capabilities?.opens || false,
              can_track_clicks: connection.capabilities?.clicks || false,
              can_track_replies: connection.capabilities?.replies || false,
              sequence_name: companySequence.email_sequences?.name,
              company_name: companySequence.companies?.name,
            },
          });

        sentEmails.push({
          stepNumber: i + 1,
          subject: emailData.subject,
          sentAt: new Date().toISOString(),
        });

        // Update sequence metadata
        const metadata = companySequence.metadata || {};
        if (i === 0) {
          metadata.first_email_sent_at = new Date().toISOString();
        }
        metadata.last_email_sent_at = new Date().toISOString();

        await supabase
          .from('company_sequences')
          .update({
            current_step: i,
            status: i === personalizedEmails.length - 1 ? 'completed' : 'active',
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
