import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
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

    // Send email via Resend (or your email provider)
    let emailResult;
    let externalMessageId;

    if (RESEND_API_KEY) {
      const resendResponse = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'Your Company <noreply@yourdomain.com>', // Configure this
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
          from: 'noreply@yourdomain.com',
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
