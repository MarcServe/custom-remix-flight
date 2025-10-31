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

        // Get last email activity
        const { data: lastActivity } = await supabase
          .from('email_activities')
          .select('*')
          .eq('company_sequence_id', sequence.id)
          .eq('step_number', sequence.current_step)
          .single();

        if (!lastActivity?.sent_at) {
          console.log(`Sequence ${sequence.id}: No activity found for current step`);
          continue;
        }

        // Check automation rules if enabled
        const automationRules = sequence.automation_rules || { enabled: true, rules: [] };
        let shouldSendNext = false;
        let triggerReason = '';

        if (automationRules.enabled && automationRules.rules?.length > 0) {
          const hoursSinceLastEmail = (Date.now() - new Date(lastActivity.sent_at).getTime()) / (1000 * 60 * 60);

          for (const rule of automationRules.rules) {
            const waitHours = rule.wait_hours || 48;

            switch (rule.type) {
              case 'no_open':
                if (!lastActivity.opened_at && hoursSinceLastEmail >= waitHours) {
                  shouldSendNext = true;
                  triggerReason = `no_open (${waitHours}h elapsed)`;
                }
                break;

              case 'opened_not_clicked':
                if (lastActivity.opened_at && !lastActivity.metadata?.clicked && hoursSinceLastEmail >= waitHours) {
                  shouldSendNext = true;
                  triggerReason = `opened_not_clicked (${waitHours}h elapsed)`;
                }
                break;

              case 'clicked_not_replied':
                if (lastActivity.metadata?.clicked && !lastActivity.replied_at && hoursSinceLastEmail >= waitHours) {
                  shouldSendNext = true;
                  triggerReason = `clicked_not_replied (${waitHours}h elapsed)`;
                }
                break;

              case 'no_reply_after_open':
                if (lastActivity.opened_at && !lastActivity.replied_at && hoursSinceLastEmail >= waitHours) {
                  shouldSendNext = true;
                  triggerReason = `no_reply_after_open (${waitHours}h elapsed)`;
                }
                break;
            }

            if (shouldSendNext) break;
          }
        }

        // Fallback to time-based delay if no behavioral rule triggered
        if (!shouldSendNext) {
          const daysSinceLastEmail = Math.floor(
            (Date.now() - new Date(lastActivity.sent_at).getTime()) / (1000 * 60 * 60 * 24)
          );

          if (daysSinceLastEmail >= nextStep.delayDays) {
            shouldSendNext = true;
            triggerReason = `time_delay (${nextStep.delayDays} days elapsed)`;
          } else {
            console.log(
              `Sequence ${sequence.id}: Not enough time passed (${daysSinceLastEmail}/${nextStep.delayDays} days)`
            );
            continue;
          }
        }

        if (shouldSendNext) {
          console.log(`Sequence ${sequence.id}: Sending next step due to ${triggerReason}`);

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
            trigger: triggerReason,
            result: sendResponse.data,
          });

          console.log(`Processed sequence ${sequence.id}, sent step ${nextStepNumber}`);
        }
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
