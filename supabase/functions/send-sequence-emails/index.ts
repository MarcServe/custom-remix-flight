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

    const { data: connection } = await supabase
      .from('crm_connections')
      .select('*')
      .eq('user_id', user.id)
      .eq('provider', 'gmail')
      .eq('status', 'active')
      .single();

    if (!connection) {
      throw new Error('No active Gmail connection found. Please connect your Gmail account first.');
    }

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
        console.log(`Sending email step ${i + 1}/${personalizedEmails.length}`);

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

        // Record email activity
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
            external_message_id: nangoData.id || null,
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
