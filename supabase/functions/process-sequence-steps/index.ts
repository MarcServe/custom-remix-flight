import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

/**
 * This function is meant to be called periodically (e.g., via cron job)
 * to process active sequences and send emails for due steps
 */
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Fetch all active company sequences
    const { data: activeSequences, error: sequencesError } = await supabase
      .from('company_sequences')
      .select('*')
      .eq('status', 'active');

    if (sequencesError) {
      throw new Error(`Failed to fetch sequences: ${sequencesError.message}`);
    }

    if (!activeSequences || activeSequences.length === 0) {
      console.log('No active sequences to process');
      return new Response(
        JSON.stringify({ message: 'No active sequences', processed: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const processed = [];
    const errors = [];

    for (const sequence of activeSequences) {
      try {
        const nextStepNumber = sequence.current_step + 1;
        const nextStep = sequence.personalized_emails?.[nextStepNumber];

        if (!nextStep) {
          // No more steps, mark as completed
          await supabase
            .from('company_sequences')
            .update({ status: 'completed' })
            .eq('id', sequence.id);
          continue;
        }

        // Check if enough time has passed since last email
        const { data: lastActivity } = await supabase
          .from('email_activities')
          .select('sent_at')
          .eq('company_sequence_id', sequence.id)
          .eq('step_number', sequence.current_step)
          .single();

        if (lastActivity?.sent_at) {
          const daysSinceLastEmail = Math.floor(
            (Date.now() - new Date(lastActivity.sent_at).getTime()) / (1000 * 60 * 60 * 24)
          );

          if (daysSinceLastEmail < nextStep.delayDays) {
            console.log(
              `Sequence ${sequence.id}: Not enough time passed (${daysSinceLastEmail}/${nextStep.delayDays} days)`
            );
            continue;
          }
        }

        // Send the next email
        const sendResponse = await supabase.functions.invoke('send-sequence-email', {
          body: {
            companySequenceId: sequence.id,
            stepNumber: nextStepNumber,
          },
        });

        if (sendResponse.error) {
          throw new Error(sendResponse.error.message);
        }

        processed.push({
          sequenceId: sequence.id,
          stepNumber: nextStepNumber,
          result: sendResponse.data,
        });

        console.log(`Processed sequence ${sequence.id}, sent step ${nextStepNumber}`);
      } catch (error) {
        console.error(`Error processing sequence ${sequence.id}:`, error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        errors.push({
          sequenceId: sequence.id,
          error: errorMessage,
        });
      }
    }

    return new Response(
      JSON.stringify({
        message: 'Sequence processing complete',
        totalSequences: activeSequences.length,
        processed: processed.length,
        errors: errors.length,
        details: { processed, errors },
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in process-sequence-steps:', error);
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
