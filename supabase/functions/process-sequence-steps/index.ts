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
    const now = new Date();

    // Parse repeat_only_for: supports single value or JSON array for multi-select
    const parseRepeatOnlyFor = (raw: string | undefined): string[] => {
      if (!raw || !raw.trim()) return ['no_reply'];
      const s = raw.trim();
      if (s.startsWith('[')) {
        try {
          const arr = JSON.parse(s);
          return Array.isArray(arr) ? arr.filter((x: unknown) => typeof x === 'string') : [s];
        } catch {
          return [s];
        }
      }
      return [s];
    };
    const matchesRepeatOption = (opt: string, opened: boolean, clicked: boolean, replied: boolean): boolean => {
      switch (opt) {
        case 'all': return true;
        case 'not_opened': return !opened;
        case 'opened_not_clicked': return opened && !clicked;
        case 'clicked_not_replied': return clicked && !replied;
        case 'no_reply':
        default: return !replied;
      }
    };

    // 1. Handle restarts: sequences that were due to restart (repeat_sequence)
    for (const sequence of activeSequences) {
      const meta = (sequence.metadata || {}) as {
        restart_after?: string;
        repeat_sequence?: boolean;
        repeat_after_days?: number;
        repeat_only_for?: string;
      };
      const restartAfter = meta.restart_after ? new Date(meta.restart_after) : null;
      if (restartAfter && restartAfter.getTime() <= now.getTime()) {
        const repeatOnlyForOptions = parseRepeatOnlyFor(meta.repeat_only_for);
        const lastStep = sequence.current_step ?? 0;
        const { data: lastStepActivity } = await supabase
          .from('email_activities')
          .select('opened_at, replied_at, metadata')
          .eq('company_sequence_id', sequence.id)
          .eq('step_number', lastStep)
          .order('sent_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        const opened = !!lastStepActivity?.opened_at;
        const clicked = !!(lastStepActivity?.metadata as { clicked?: boolean } | null)?.clicked;
        const replied = !!lastStepActivity?.replied_at;

        const stillEligible = repeatOnlyForOptions.some((opt) => matchesRepeatOption(opt, opened, clicked, replied));

        try {
          if (!stillEligible) {
            await supabase
              .from('company_sequences')
              .update({
                status: 'completed',
                metadata: { ...meta, restart_after: null },
                updated_at: now.toISOString(),
              })
              .eq('id', sequence.id);
            console.log(`Sequence ${sequence.id}: Not restarted—no longer eligible (${repeatOnlyForOptions.join(',')})`);
          } else {
            await supabase
              .from('company_sequences')
              .update({
                current_step: 0,
                metadata: { ...meta, restart_after: null },
                updated_at: now.toISOString(),
              })
              .eq('id', sequence.id);
            await supabase.from('email_activities').insert({
              company_sequence_id: sequence.id,
              contact_id: null,
              step_number: 0,
              subject: '(Restart)',
              body: '',
              status: 'sent',
              sent_at: now.toISOString(),
              metadata: { repeat_restart: true },
            });
            console.log(`Sequence ${sequence.id}: Restarted (repeat)`);
          }
        } catch (e) {
          console.error(`Failed to restart sequence ${sequence.id}:`, e);
        }
      }
    }

    // Re-fetch active sequences after restarts (current_step may have changed)
    const { data: activeSequencesAfterRestart } = await supabase
      .from('company_sequences')
      .select('*')
      .eq('status', 'active');

    const sequencesToProcess = activeSequencesAfterRestart || activeSequences;

    for (const sequence of sequencesToProcess) {
      try {
        const nextStepNumber = sequence.current_step + 1;
        const nextStep = sequence.personalized_emails?.[nextStepNumber];

        if (!nextStep) {
          // No more steps: schedule restart (if repeat and condition matches) or mark completed
          const meta = (sequence.metadata || {}) as {
            restart_after?: string;
            repeat_sequence?: boolean;
            repeat_after_days?: number;
            repeat_only_for?: string;
          };
          const repeatSequence = meta.repeat_sequence === true;
          const repeatAfterDays = Math.max(1, Math.min(30, meta.repeat_after_days ?? 5));
          const repeatOnlyForOptions = parseRepeatOnlyFor(meta.repeat_only_for);

          let shouldRestart = false;
          if (repeatSequence) {
            const { data: lastStepActivity } = await supabase
              .from('email_activities')
              .select('opened_at, replied_at, metadata')
              .eq('company_sequence_id', sequence.id)
              .eq('step_number', sequence.current_step)
              .order('sent_at', { ascending: false })
              .limit(1)
              .maybeSingle();

            const opened = !!lastStepActivity?.opened_at;
            const clicked = !!(lastStepActivity?.metadata as { clicked?: boolean } | null)?.clicked;
            const replied = !!lastStepActivity?.replied_at;

            shouldRestart = repeatOnlyForOptions.some((opt) => matchesRepeatOption(opt, opened, clicked, replied));
          }

          if (repeatSequence && shouldRestart) {
            const restartAt = new Date(now);
            restartAt.setDate(restartAt.getDate() + repeatAfterDays);
            await supabase
              .from('company_sequences')
              .update({
                metadata: { ...meta, restart_after: restartAt.toISOString() },
                updated_at: now.toISOString(),
              })
              .eq('id', sequence.id);
            console.log(`Sequence ${sequence.id}: Scheduled repeat in ${repeatAfterDays} days (repeat_only_for=${repeatOnlyForOptions.join(',')})`);
          } else {
            await supabase
              .from('company_sequences')
              .update({ status: 'completed' })
              .eq('id', sequence.id);
            if (repeatSequence && !shouldRestart) {
              console.log(`Sequence ${sequence.id}: Completed (repeat conditions ${repeatOnlyForOptions.join(',')} not met—contact already engaged/replied)`);
            }
          }
          continue;
        }

        // Get last email activity (most recent for this step)
        const { data: lastActivity } = await supabase
          .from('email_activities')
          .select('*')
          .eq('company_sequence_id', sequence.id)
          .eq('step_number', sequence.current_step)
          .order('sent_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!lastActivity?.sent_at) {
          // If stuck at step 0 with no activity, the initial email was never sent or never recorded.
          // Attempt to send step 0 now so the sequence can progress.
          if (sequence.current_step === 0) {
            const firstStep = sequence.personalized_emails?.[0];
            if (firstStep) {
              console.log(`Sequence ${sequence.id}: No activity at step 0, sending initial email`);
              try {
                const sendResponse = await supabase.functions.invoke('send-sequence-email', {
                  body: { companySequenceId: sequence.id, stepNumber: 0 },
                });
                if (sendResponse.error) {
                  console.error(`Sequence ${sequence.id}: Failed to send initial email:`, sendResponse.error.message);
                } else {
                  processed.push({ sequenceId: sequence.id, stepNumber: 0, trigger: 'initial_send_recovery', result: sendResponse.data });
                }
              } catch (e) {
                console.error(`Sequence ${sequence.id}: Error sending initial email:`, e);
              }
            } else {
              console.log(`Sequence ${sequence.id}: No step 0 defined, marking completed`);
              await supabase.from('company_sequences').update({ status: 'completed' }).eq('id', sequence.id);
            }
          } else {
            // Mid-sequence with no activity — sequence data is inconsistent, log and skip
            console.warn(`Sequence ${sequence.id}: No activity at step ${sequence.current_step} but current_step > 0 — skipping`);
          }
          continue;
        }

        // ── GUARANTEED STOP-ON-REPLY ─────────────────────────────────────────
        // If the contact has replied to ANY email in this sequence, stop all
        // follow-ups immediately — a human takes over from the AI-drafted reply.
        // This must run before both the behavioral rules AND the time-based
        // fallback, otherwise a plain "wait N days" step would fire even after a
        // reply. This is what makes the "we stop the moment they reply" promise true.
        const { data: replyActivity } = await supabase
          .from('email_activities')
          .select('id')
          .eq('company_sequence_id', sequence.id)
          .not('replied_at', 'is', null)
          .limit(1)
          .maybeSingle();
        if (replyActivity) {
          await supabase
            .from('company_sequences')
            .update({ status: 'completed', next_action: 'replied', updated_at: new Date().toISOString() })
            .eq('id', sequence.id);
          console.log(`Sequence ${sequence.id}: contact replied — follow-ups stopped`);
          processed.push({ sequenceId: sequence.id, stepNumber: sequence.current_step, trigger: 'stopped_on_reply' });
          continue;
        }

        // Check automation rules: per-step on next email, then step_rules map, then globals.
        // Sequence Settings saves per-step config as automation_rules.step_rules["0"|"1"|...]
        // (template step index). Campaign enrollments use personalized stepNumber = index + 1
        // when step 0 is the campaign stub.
        const automationRules = sequence.automation_rules || { enabled: true, rules: [] };
        const nextStepRule = nextStep?.automation_rule as { type?: string; wait_hours?: number } | undefined;
        const stepRulesMap = (automationRules.step_rules || {}) as Record<string, {
          enabled?: boolean;
          type?: string;
          wait_hours?: number;
        }>;
        const fromStepRules =
          stepRulesMap[String(nextStepNumber)] ||
          stepRulesMap[String(Math.max(0, nextStepNumber - 1))] ||
          null;

        let rulesToCheck: Array<{ type: string; wait_hours?: number }> = [];
        if (nextStepRule?.type && nextStepRule.type !== 'time_based' && nextStepRule.type !== 'none') {
          rulesToCheck = [{ type: nextStepRule.type, wait_hours: nextStepRule.wait_hours ?? 24 }];
        } else if (fromStepRules?.enabled && fromStepRules.type && fromStepRules.type !== 'time_based' && fromStepRules.type !== 'none') {
          rulesToCheck = [{ type: fromStepRules.type, wait_hours: fromStepRules.wait_hours ?? 24 }];
        } else {
          rulesToCheck = automationRules.rules || [];
        }

        // Explicit "none" on the next step skips behavioral + time fallback for this tick
        const skipAutomation =
          nextStepRule?.type === 'none' ||
          (fromStepRules?.enabled && fromStepRules.type === 'none');

        let shouldSendNext = false;
        let triggerReason = '';

        if (!skipAutomation && automationRules.enabled && rulesToCheck.length > 0) {
          const hoursSinceLastEmail = (Date.now() - new Date(lastActivity.sent_at).getTime()) / (1000 * 60 * 60);

          for (const rule of rulesToCheck) {
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

              // Legacy / Settings UI types: wait until engagement, then wait_hours after that event
              case 'wait_for_open': {
                if (lastActivity.opened_at) {
                  const hoursSinceOpen =
                    (Date.now() - new Date(lastActivity.opened_at).getTime()) / (1000 * 60 * 60);
                  if (hoursSinceOpen >= waitHours) {
                    shouldSendNext = true;
                    triggerReason = `wait_for_open (${waitHours}h after open)`;
                  }
                }
                break;
              }

              case 'wait_for_click': {
                const clickedAt = lastActivity.metadata?.last_click || lastActivity.metadata?.clicked_at;
                if (lastActivity.metadata?.clicked && clickedAt) {
                  const hoursSinceClick =
                    (Date.now() - new Date(clickedAt).getTime()) / (1000 * 60 * 60);
                  if (hoursSinceClick >= waitHours) {
                    shouldSendNext = true;
                    triggerReason = `wait_for_click (${waitHours}h after click)`;
                  }
                } else if (lastActivity.metadata?.clicked && hoursSinceLastEmail >= waitHours) {
                  // clicked flag without timestamp — fall back to hours since send
                  shouldSendNext = true;
                  triggerReason = `wait_for_click (${waitHours}h elapsed after click flag)`;
                }
                break;
              }
            }

            if (shouldSendNext) break;
          }
        }

        // Fallback to time-based delay if no behavioral rule triggered (and step isn't "none")
        if (!shouldSendNext && !skipAutomation) {
          // For wait_for_* rules that haven't engaged yet, do NOT fall through to delayDays
          const waitingForEngagement = rulesToCheck.some(
            (r) => r.type === 'wait_for_open' || r.type === 'wait_for_click'
          );
          if (waitingForEngagement) {
            console.log(
              `Sequence ${sequence.id}: waiting for engagement (${rulesToCheck.map((r) => r.type).join(',')}) before step ${nextStepNumber}`
            );
            continue;
          }

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
