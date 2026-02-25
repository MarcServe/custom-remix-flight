import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

/**
 * Webhook handler for email events (opens, clicks, bounces, replies)
 * This handles events from Resend or similar email providers
 */
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const rawPayload = await req.json();
    console.log('Received email webhook:', JSON.stringify(rawPayload, null, 2));

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Handle SendGrid batch format (array of events)
    const payloads = Array.isArray(rawPayload) ? rawPayload : [rawPayload];
    const results = [];

    for (const payload of payloads) {
      try {
        // Parse webhook based on provider
        let eventType: string;
        let emailId: string;
        let eventData: any;

        // Detect provider and normalize webhook format
        if (payload.type && payload.data) {
          // Resend format
          eventType = payload.type;
          eventData = payload.data;
          emailId = eventData.email_id || eventData.id;
          console.log('Detected Resend webhook format');
        } else if (payload.event && payload.sg_message_id) {
          // SendGrid format (individual event)
          const sgEventMap: Record<string, string> = {
            'delivered': 'email.delivered',
            'open': 'email.opened',
            'click': 'email.clicked',
            'bounce': 'email.bounced',
            'dropped': 'email.bounced',
            'spamreport': 'email.spam',
            'unsubscribe': 'email.unsubscribed',
          };
          eventType = sgEventMap[payload.event] || payload.event;
          emailId = payload.sg_message_id;
          eventData = payload;
          console.log('Detected SendGrid webhook format:', payload.event);
        } else {
          console.error('Unknown webhook format for event:', payload);
          results.push({ success: false, error: 'Invalid format', payload });
          continue;
        }
        
        if (!emailId) {
          console.error('No email ID in payload:', payload);
          results.push({ success: false, error: 'No email ID', payload });
          continue;
        }
        emailId = String(emailId).trim();

        console.log(`Processing event: ${eventType} for email: ${emailId}`);

        // Find the email activity by external message ID
        const { data: activity, error: findError } = await supabase
          .from('email_activities')
          .select('*')
          .eq('external_message_id', emailId)
          .single();

        if (findError || !activity) {
          // Try to find a campaign recipient directly by external_message_id
          let directRecipient = (await supabase
            .from('email_campaign_recipients')
            .select('id, campaign_id')
            .eq('external_message_id', emailId)
            .maybeSingle()).data;
          if (!directRecipient && eventData?.to?.length > 0) {
            const recipientEmail = (eventData.to[0] && typeof eventData.to[0] === 'string')
              ? eventData.to[0].trim().toLowerCase()
              : null;
            if (recipientEmail) {
              const { data: byEmail } = await supabase
                .from('email_campaign_recipients')
                .select('id, campaign_id')
                .ilike('email', recipientEmail)
                .eq('status', 'sent')
                .order('sent_at', { ascending: false })
                .limit(1)
                .maybeSingle();
              if (byEmail) {
                directRecipient = byEmail;
                await supabase
                  .from('email_campaign_recipients')
                  .update({ external_message_id: emailId })
                  .eq('id', byEmail.id);
                console.log(`Backfilled external_message_id for recipient ${byEmail.id} (matched by email ${recipientEmail})`);
              }
            }
          }
          if (directRecipient) {
            const recipientUpdates: Record<string, any> = {};
            if (eventType === 'email.opened') {
              recipientUpdates.opened_at = new Date().toISOString();
              recipientUpdates.status = 'opened';
            } else if (eventType === 'email.clicked') {
              recipientUpdates.opened_at = new Date().toISOString();
              recipientUpdates.clicked_at = new Date().toISOString();
              recipientUpdates.status = 'clicked';
            } else if (eventType === 'email.bounced') {
              recipientUpdates.status = 'bounced';
            }
            if (Object.keys(recipientUpdates).length > 0) {
              await supabase
                .from('email_campaign_recipients')
                .update(recipientUpdates)
                .eq('id', directRecipient.id);
              if (eventType === 'email.opened' || eventType === 'email.clicked') {
                const { count } = await supabase
                  .from('email_campaign_recipients')
                  .select('*', { count: 'exact', head: true })
                  .eq('campaign_id', directRecipient.campaign_id)
                  .in('status', ['opened', 'clicked']);
                if (count !== null) {
                  await supabase
                    .from('email_campaigns')
                    .update({ opened_count: count })
                    .eq('id', directRecipient.campaign_id);
                }
              }
              console.log(`✅ Updated campaign recipient directly for ${emailId} (${eventType})`);
            }
            results.push({ success: true, recipientId: directRecipient.id, event: eventType });
            continue;
          }
          console.error('Email activity not found:', emailId);
          results.push({ success: false, error: 'Activity not found', emailId, payload });
          continue;
        }

        // Update based on event type
        const updates: any = { metadata: activity.metadata || {} };

        switch (eventType) {
          case 'email.opened':
            updates.opened_at = new Date().toISOString();
            updates.metadata.opened = true;
            updates.metadata.open_count = (updates.metadata.open_count || 0) + 1;
            updates.metadata.last_open = new Date().toISOString();
            console.log(`Email opened: ${emailId}, count: ${updates.metadata.open_count}`);
            break;

          case 'email.clicked':
            updates.metadata.clicked = true;
            updates.metadata.click_count = (updates.metadata.click_count || 0) + 1;
            updates.metadata.last_click = new Date().toISOString();
            const clickedUrl = eventData.link || eventData.url;
            if (clickedUrl) {
              updates.metadata.clicked_links = [
                ...(updates.metadata.clicked_links || []),
                clickedUrl,
              ];
            }
            console.log(`Email clicked: ${emailId}, link: ${clickedUrl}`);
            break;

          case 'email.bounced':
            updates.bounced_at = new Date().toISOString();
            updates.status = 'bounced';
            updates.metadata.bounce_reason = eventData.reason || eventData.type || 'Unknown';
            
            // Determine bounce type (hard or soft)
            const bounceType = eventData.bounce_type || eventData.type || 
              (eventData.reason?.toLowerCase().includes('permanent') ? 'hard' : 'soft');
            
            console.log(`Email bounced: ${emailId}, type: ${bounceType}, reason: ${updates.metadata.bounce_reason}`);
            
            // Track bounce event
            const { data: sequenceData } = await supabase
              .from('company_sequences')
              .select('sequence:email_sequences(user_id)')
              .eq('id', activity.company_sequence_id)
              .single();
            
            if (sequenceData) {
              await supabase
                .from('email_bounce_events')
                .insert({
                  user_id: (sequenceData.sequence as any)?.user_id,
                  email_activity_id: activity.id,
                  recipient_email: eventData.email || 'unknown',
                  bounce_type: bounceType,
                  bounce_reason: eventData.reason || eventData.type || 'No reason provided',
                  external_message_id: emailId,
                  occurred_at: new Date().toISOString(),
                  metadata: eventData,
                });
            }
            
            // Pause the sequence if email bounced
            await supabase
              .from('company_sequences')
              .update({ status: 'paused' })
              .eq('id', activity.company_sequence_id);
            break;

          case 'email.delivered':
            updates.status = 'delivered';
            updates.metadata.delivered_at = new Date().toISOString();
            break;

          case 'email.replied':
            updates.replied_at = new Date().toISOString();
            updates.status = 'replied';
            updates.metadata.reply_received = true;
            
            // If we have reply content in the webhook, we could process it here
            // For now, we rely on the process-inbound-emails webhook to handle the full reply
            console.log('Reply event received for email:', emailId);
            
            // Update the sequence to indicate a reply was received
            await supabase
              .from('company_sequences')
              .update({ 
                next_action: 'personalized_response',
                updated_at: new Date().toISOString()
              })
              .eq('id', activity.company_sequence_id);
            break;

          case 'email.spam':
            updates.status = 'spam';
            updates.metadata.marked_spam_at = new Date().toISOString();
            
            // Track spam complaint as a bounce event
            const { data: spamSequenceData } = await supabase
              .from('company_sequences')
              .select('sequence:email_sequences(user_id)')
              .eq('id', activity.company_sequence_id)
              .single();
            
            if (spamSequenceData) {
              await supabase
                .from('email_bounce_events')
                .insert({
                  user_id: (spamSequenceData.sequence as any)?.user_id,
                  email_activity_id: activity.id,
                  recipient_email: eventData.email || 'unknown',
                  bounce_type: 'complaint',
                  bounce_reason: 'Marked as spam',
                  external_message_id: emailId,
                  occurred_at: new Date().toISOString(),
                  metadata: eventData,
                });
            }
            
            console.log(`Email marked as spam: ${emailId}`);
            
            // Stop the sequence if marked as spam
            await supabase
              .from('company_sequences')
              .update({ status: 'completed' })
              .eq('id', activity.company_sequence_id);
            break;

          case 'email.unsubscribed':
            updates.status = 'unsubscribed';
            updates.metadata.unsubscribed_at = new Date().toISOString();
            console.log(`Email unsubscribed: ${emailId}`);
            
            // Stop the sequence if unsubscribed
            await supabase
              .from('company_sequences')
              .update({ status: 'completed' })
              .eq('id', activity.company_sequence_id);
            break;

          default:
            console.log(`Unknown event type: ${eventType}`);
            updates.metadata[eventType] = {
              timestamp: new Date().toISOString(),
              data: eventData,
            };
        }

        // Update the email activity
        const { error: updateError } = await supabase
          .from('email_activities')
          .update(updates)
          .eq('id', activity.id);

        if (updateError) {
          throw new Error(`Failed to update activity: ${updateError.message}`);
        }

        // Also update the campaign recipient if this email belongs to a bulk campaign
        try {
          const campaignRecipientUpdates: Record<string, any> = {};
          if (eventType === 'email.opened') {
            campaignRecipientUpdates.opened_at = new Date().toISOString();
            campaignRecipientUpdates.status = 'opened';
          } else if (eventType === 'email.clicked') {
            campaignRecipientUpdates.opened_at = new Date().toISOString();
            campaignRecipientUpdates.clicked_at = new Date().toISOString();
            campaignRecipientUpdates.status = 'clicked';
          } else if (eventType === 'email.bounced') {
            campaignRecipientUpdates.status = 'bounced';
          }
          if (Object.keys(campaignRecipientUpdates).length > 0) {
            const { data: campaignRecipient } = await supabase
              .from('email_campaign_recipients')
              .select('id, campaign_id')
              .eq('external_message_id', emailId)
              .maybeSingle();
            if (campaignRecipient) {
              await supabase
                .from('email_campaign_recipients')
                .update(campaignRecipientUpdates)
                .eq('id', campaignRecipient.id);
              // Update campaign-level opened_count
              if (eventType === 'email.opened' || eventType === 'email.clicked') {
                const { count } = await supabase
                  .from('email_campaign_recipients')
                  .select('*', { count: 'exact', head: true })
                  .eq('campaign_id', campaignRecipient.campaign_id)
                  .in('status', ['opened', 'clicked']);
                if (count !== null) {
                  await supabase
                    .from('email_campaigns')
                    .update({ opened_count: count })
                    .eq('id', campaignRecipient.campaign_id);
                }
              }
              console.log(`✅ Also updated campaign recipient for ${emailId}`);
            }
          }
        } catch (crErr) {
          console.error('Non-fatal: failed to update campaign recipient:', crErr);
        }

        console.log(`✅ Updated email activity ${activity.id} for event ${eventType}`);
        results.push({ success: true, activityId: activity.id, event: eventType });
      } catch (eventError) {
        console.error('Error processing individual event:', eventError);
        results.push({ 
          success: false, 
          error: eventError instanceof Error ? eventError.message : 'Unknown error',
          payload 
        });
      }
    }

    // Return success if at least one event was processed
    const successCount = results.filter(r => r.success).length;
    console.log(`Processed ${successCount}/${results.length} webhook events`);

    return new Response(
      JSON.stringify({ 
        success: successCount > 0, 
        processed: successCount,
        total: results.length,
        results 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in email-webhook:', error);
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
