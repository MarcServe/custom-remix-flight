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
    const payload = await req.json();
    console.log('Received email webhook:', JSON.stringify(payload, null, 2));

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Parse the event type and data
    // This structure depends on your email provider (Resend, SendGrid, etc.)
    const { type, data } = payload;
    
    if (!type || !data) {
      throw new Error('Invalid webhook payload');
    }

    const emailId = data.email_id || data.id;
    
    if (!emailId) {
      throw new Error('No email ID in webhook payload');
    }

    // Find the email activity by external message ID
    const { data: activity, error: findError } = await supabase
      .from('email_activities')
      .select('*')
      .eq('external_message_id', emailId)
      .single();

    if (findError || !activity) {
      console.error('Email activity not found:', emailId);
      return new Response(
        JSON.stringify({ message: 'Email activity not found', emailId }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update based on event type
    const updates: any = { metadata: activity.metadata || {} };

    switch (type) {
      case 'email.opened':
        updates.opened_at = new Date().toISOString();
        updates.metadata.opened = true;
        updates.metadata.open_count = (updates.metadata.open_count || 0) + 1;
        break;

      case 'email.clicked':
        updates.metadata.clicked = true;
        updates.metadata.click_count = (updates.metadata.click_count || 0) + 1;
        updates.metadata.last_click = new Date().toISOString();
        if (data.link) {
          updates.metadata.clicked_links = [
            ...(updates.metadata.clicked_links || []),
            data.link,
          ];
        }
        break;

      case 'email.bounced':
        updates.bounced_at = new Date().toISOString();
        updates.status = 'bounced';
        updates.metadata.bounce_reason = data.reason || 'Unknown';
        
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
        updates.metadata.reply_received = true;
        
        // Pause the sequence when we get a reply
        await supabase
          .from('company_sequences')
          .update({ status: 'paused' })
          .eq('id', activity.company_sequence_id);
        break;

      case 'email.spam':
        updates.status = 'spam';
        updates.metadata.marked_spam_at = new Date().toISOString();
        
        // Stop the sequence if marked as spam
        await supabase
          .from('company_sequences')
          .update({ status: 'completed' })
          .eq('id', activity.company_sequence_id);
        break;

      default:
        console.log(`Unknown event type: ${type}`);
        updates.metadata[type] = {
          timestamp: new Date().toISOString(),
          data,
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

    console.log(`Updated email activity ${activity.id} for event ${type}`);

    return new Response(
      JSON.stringify({ success: true, activityId: activity.id, event: type }),
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
