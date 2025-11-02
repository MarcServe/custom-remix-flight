import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const SENDGRID_API_KEY = Deno.env.get('SENDGRID_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { companySequenceId, stepNumber } = await req.json();

    if (!companySequenceId || stepNumber === undefined) {
      throw new Error('Missing required fields: companySequenceId, stepNumber');
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Fetch company sequence with related data
    const { data: companySequence, error: sequenceError } = await supabase
      .from('company_sequences')
      .select(`
        *,
        company:companies(id, name, website),
        sequence:email_sequences(name)
      `)
      .eq('id', companySequenceId)
      .single();

    if (sequenceError || !companySequence) {
      throw new Error(`Company sequence not found: ${sequenceError?.message}`);
    }

    // Check if sequence is active
    if (companySequence.status !== 'active') {
      throw new Error('Sequence is not active');
    }

    // Get the email step
    const emailStep = companySequence.personalized_emails?.find(
      (e: any) => e.stepNumber === stepNumber
    );

    if (!emailStep) {
      throw new Error(`Step ${stepNumber} not found`);
    }

    // Fetch contacts for this company
    const { data: contacts, error: contactsError } = await supabase
      .from('contacts')
      .select('*')
      .eq('company_id', companySequence.company_id)
      .eq('email_verified', true)
      .limit(1);

    if (contactsError || !contacts || contacts.length === 0) {
      throw new Error('No verified contacts found for this company');
    }

    const contact = contacts[0];

    // Get the user who owns this sequence to check email provider preference
    const authHeader = req.headers.get('Authorization');
    const token = authHeader ? authHeader.replace('Bearer ', '') : null;
    const { data: { user } } = token 
      ? await supabase.auth.getUser(token)
      : { data: { user: null } };

    // Get business profile for email provider preference
    let emailProvider = 'resend';
    let fromEmail = 'noreply@yourdomain.com';
    let senderName = 'Your Company';

    if (user) {
      // Get user profile for business email
      const { data: userProfile } = await supabase
        .from('profiles')
        .select('email')
        .eq('id', user.id)
        .maybeSingle();

      const { data: businessProfile } = await supabase
        .from('business_profiles')
        .select('email_provider, company_name')
        .eq('user_id', user.id)
        .maybeSingle();

      emailProvider = businessProfile?.email_provider || 'resend';
      senderName = businessProfile?.company_name || 'Your Company';

      // Get SMTP connection for from_email
      const { data: connection } = await supabase
        .from('crm_connections')
        .select('from_email')
        .eq('user_id', user.id)
        .eq('provider', 'smtp')
        .eq('status', 'active')
        .maybeSingle();

      // Priority: connection.from_email > profiles.email > default
      fromEmail = connection?.from_email || userProfile?.email || 'noreply@yourdomain.com';
    }

    console.log(`Sending via ${emailProvider} from ${fromEmail}`);

    // Send email via configured provider
    let emailResult;
    let externalMessageId;

    if (emailProvider === 'sendgrid' && SENDGRID_API_KEY) {
      const sendgridResponse = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${SENDGRID_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          personalizations: [{
            to: [{ email: contact.email, name: contact.name }],
            subject: emailStep.subject,
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
              value: emailStep.body,
            },
            {
              type: 'text/html',
              value: emailStep.body.replace(/\n/g, '<br>'),
            },
          ],
          custom_args: {
            company_sequence_id: companySequenceId,
            step_number: stepNumber.toString(),
          },
        }),
      });

      if (!sendgridResponse.ok) {
        const errorText = await sendgridResponse.text();
        throw new Error(`Email send failed via SendGrid: ${errorText}`);
      }

      externalMessageId = sendgridResponse.headers.get('X-Message-Id') || `sendgrid-${crypto.randomUUID()}`;
    } else if (RESEND_API_KEY) {
      const resendResponse = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: `${senderName} <${fromEmail}>`,
          to: contact.email,
          subject: emailStep.subject,
          html: emailStep.body.replace(/\n/g, '<br>'),
          tags: [
            { name: 'company_sequence_id', value: companySequenceId },
            { name: 'step_number', value: stepNumber.toString() },
          ],
        }),
      });

      emailResult = await resendResponse.json();
      
      if (!resendResponse.ok) {
        throw new Error(`Email send failed: ${JSON.stringify(emailResult)}`);
      }

      externalMessageId = emailResult.id;
    } else {
      console.log('RESEND_API_KEY not configured, simulating email send');
      externalMessageId = `simulated-${crypto.randomUUID()}`;
    }

    // Record email activity
    const { error: activityError } = await supabase
      .from('email_activities')
      .insert({
        company_sequence_id: companySequenceId,
        contact_id: contact.id,
        step_number: stepNumber,
        subject: emailStep.subject,
        body: emailStep.body,
        status: 'sent',
        sent_at: new Date().toISOString(),
        external_message_id: externalMessageId,
        metadata: {
          to: contact.email,
          from: fromEmail,
          provider: emailProvider,
        },
      });

    if (activityError) {
      console.error('Failed to record email activity:', activityError);
    }

    // Update company sequence current_step
    const { error: updateError } = await supabase
      .from('company_sequences')
      .update({
        current_step: stepNumber,
        updated_at: new Date().toISOString(),
      })
      .eq('id', companySequenceId);

    if (updateError) {
      console.error('Failed to update company sequence:', updateError);
    }

    // Check if this was the last step
    const isLastStep = stepNumber >= (companySequence.personalized_emails?.length || 0) - 1;
    if (isLastStep) {
      await supabase
        .from('company_sequences')
        .update({ status: 'completed' })
        .eq('id', companySequenceId);
    }

    console.log(`Email sent successfully for sequence ${companySequenceId}, step ${stepNumber}`);

    return new Response(
      JSON.stringify({
        success: true,
        emailId: externalMessageId,
        recipient: contact.email,
        step: stepNumber,
        isLastStep,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in send-sequence-email:', error);
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
