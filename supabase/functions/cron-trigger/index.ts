import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

/**
 * Cron Trigger Edge Function
 * 
 * This function acts as a relay for pg_cron jobs to trigger other edge functions
 * with proper service role authentication. Since pg_cron can't access secrets,
 * this function reads the service role key from environment and passes it along.
 * 
 * Endpoints:
 * - POST { action: "discovery" } - Triggers autonomous-lead-discovery
 * - POST { action: "send-campaigns" } - Triggers send-bulk-emails for scheduled campaigns
 * - POST { action: "send-newsletters" } - Sends newsletters with status=scheduled and scheduled_at <= now
 * - POST { action: "process-sequences" } - Triggers process-sequence-steps
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  console.log('[cron-trigger] Received request');

  try {
    const body = await req.json().catch(() => ({}));
    const action = body.action || 'discovery';

    console.log(`[cron-trigger] Action: ${action}`);

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    switch (action) {
      case 'discovery': {
        // Trigger autonomous lead discovery
        console.log('[cron-trigger] Triggering autonomous-lead-discovery');
        
        const response = await fetch(`${SUPABASE_URL}/functions/v1/autonomous-lead-discovery`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({}),
        });
        
        const result = await response.json().catch(() => ({}));
        console.log('[cron-trigger] Discovery result:', result);
        
        return new Response(JSON.stringify({ 
          success: true, 
          action: 'discovery',
          result 
        }), { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        });
      }

      case 'send-campaigns': {
        // Find and send scheduled campaigns
        console.log('[cron-trigger] Processing scheduled campaigns');
        
        // Get all scheduled campaigns that are ready to send
        const { data: campaigns, error: campaignsError } = await supabase
          .from('email_campaigns')
          .select('id, user_id, name, scheduled_at')
          .eq('status', 'scheduled')
          .lte('scheduled_at', new Date().toISOString());
        
        if (campaignsError) {
          console.error('[cron-trigger] Error fetching campaigns:', campaignsError);
          return new Response(JSON.stringify({ 
            success: false, 
            error: campaignsError.message 
          }), { 
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          });
        }
        
        console.log(`[cron-trigger] Found ${campaigns?.length || 0} scheduled campaigns ready to send`);
        
        const results: any[] = [];
        
        for (const campaign of (campaigns || [])) {
          try {
            // Get user's auth token or use service role for sending
            const response = await fetch(`${SUPABASE_URL}/functions/v1/send-bulk-emails`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ 
                campaignId: campaign.id,
                triggeredByCron: true 
              }),
            });
            
            const result = await response.json().catch(() => ({}));
            results.push({ campaignId: campaign.id, name: campaign.name, result });
            console.log(`[cron-trigger] Campaign ${campaign.name} result:`, result);
          } catch (error) {
            console.error(`[cron-trigger] Error sending campaign ${campaign.id}:`, error);
            results.push({ campaignId: campaign.id, error: error instanceof Error ? error.message : 'Unknown error' });
          }
        }
        
        return new Response(JSON.stringify({ 
          success: true, 
          action: 'send-campaigns',
          campaignsProcessed: campaigns?.length || 0,
          results 
        }), { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        });
      }

      case 'send-newsletters': {
        // Find and send scheduled newsletters (status = scheduled, scheduled_at <= now)
        console.log('[cron-trigger] Processing scheduled newsletters');

        const { data: scheduledNewsletters, error: nlError } = await supabase
          .from('newsletters')
          .select('id, user_id, title, scheduled_at')
          .eq('status', 'scheduled')
          .lte('scheduled_at', new Date().toISOString());

        if (nlError) {
          console.error('[cron-trigger] Error fetching scheduled newsletters:', nlError);
          return new Response(JSON.stringify({
            success: false,
            error: nlError.message,
          }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        console.log(`[cron-trigger] Found ${scheduledNewsletters?.length || 0} scheduled newsletters ready to send`);

        const results: any[] = [];
        for (const nl of scheduledNewsletters || []) {
          try {
            const response = await fetch(`${SUPABASE_URL}/functions/v1/send-newsletter`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                newsletterId: nl.id,
                triggeredByCron: true,
              }),
            });
            const result = await response.json().catch(() => ({}));
            results.push({ newsletterId: nl.id, title: nl.title, result });
            console.log(`[cron-trigger] Newsletter ${nl.title} result:`, result);
          } catch (err) {
            console.error(`[cron-trigger] Error sending newsletter ${nl.id}:`, err);
            results.push({ newsletterId: nl.id, error: err instanceof Error ? err.message : 'Unknown error' });
          }
        }

        return new Response(JSON.stringify({
          success: true,
          action: 'send-newsletters',
          newslettersProcessed: scheduledNewsletters?.length || 0,
          results,
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'process-sequences': {
        // Trigger sequence step processing
        console.log('[cron-trigger] Processing sequence steps');
        
        const response = await fetch(`${SUPABASE_URL}/functions/v1/process-sequence-steps`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ triggered_by: 'cron' }),
        });
        
        const result = await response.json().catch(() => ({}));
        console.log('[cron-trigger] Sequence processing result:', result);
        
        return new Response(JSON.stringify({ 
          success: true, 
          action: 'process-sequences',
          result 
        }), { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        });
      }

      default:
        return new Response(JSON.stringify({ 
          success: false, 
          error: `Unknown action: ${action}` 
        }), { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        });
    }

  } catch (error) {
    console.error('[cron-trigger] Error:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), { 
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
  }
});
