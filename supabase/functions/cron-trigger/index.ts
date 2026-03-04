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
 * - POST { action: "sync-inbound-from-resend" } - Pulls received emails from Resend into CRM (backup to webhook)
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
        // 1) Start newly scheduled campaigns; 2) Continue sending campaigns that still have pending recipients
        console.log('[cron-trigger] Processing scheduled and in-progress campaigns');

        const { data: scheduledCampaigns, error: scheduledError } = await supabase
          .from('email_campaigns')
          .select('id, user_id, name, scheduled_at')
          .eq('status', 'scheduled')
          .lte('scheduled_at', new Date().toISOString());

        if (scheduledError) {
          console.error('[cron-trigger] Error fetching scheduled campaigns:', scheduledError);
          return new Response(JSON.stringify({
            success: false,
            error: scheduledError.message
          }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // Campaign IDs that still have pending recipients (for continue logic)
        const { data: pendingByCampaign, error: pendingError } = await supabase
          .from('email_campaign_recipients')
          .select('campaign_id')
          .eq('status', 'pending');
        const campaignIdsWithPending = [...new Set((pendingByCampaign || []).map((r: any) => r.campaign_id))];

        const { data: sendingCampaigns, error: sendingError } = campaignIdsWithPending.length > 0
          ? await supabase
              .from('email_campaigns')
              .select('id, user_id, name, scheduled_at')
              .eq('status', 'sending')
              .in('id', campaignIdsWithPending)
          : { data: [] as any[], error: null };

        if (sendingError) {
          console.error('[cron-trigger] Error fetching sending campaigns:', sendingError);
        }

        const campaigns = [
          ...(scheduledCampaigns || []),
          ...(sendingCampaigns || []).filter((s: any) => !(scheduledCampaigns || []).some((sc: any) => sc.id === s.id))
        ];
        console.log(`[cron-trigger] Found ${scheduledCampaigns?.length || 0} scheduled, ${(sendingCampaigns || []).length} in-progress with pending → ${campaigns.length} campaigns to process`);

        const results: any[] = [];

        for (const campaign of campaigns) {
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

      case 'process-scheduled-ab-actions': {
        // Process due scheduled Resend/Swap A/B actions (from A/B Testing → Schedule tab)
        console.log('[cron-trigger] Processing scheduled campaign actions');
        const now = new Date().toISOString();
        const { data: due, error: dueError } = await supabase
          .from('scheduled_campaign_actions')
          .select('id, campaign_id, action')
          .eq('status', 'pending')
          .lte('scheduled_at', now);
        if (dueError) {
          console.error('[cron-trigger] Error fetching scheduled actions:', dueError);
          return new Response(JSON.stringify({ success: false, error: dueError.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        const results: { id: string; campaign_id: string; action: string; ok?: boolean; error?: string }[] = [];
        for (const row of due || []) {
          try {
            if (row.action === 'swap') {
              const resResend = await fetch(`${SUPABASE_URL}/functions/v1/resend-campaign-variants`, {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({ campaignId: row.campaign_id, action: 'swap' }),
              });
              const resResendJson = await resResend.json().catch(() => ({}));
              if (resResendJson.error) throw new Error(resResendJson.error);
            } else {
              const variant = row.action === 'resend_a' ? 'A' : row.action === 'resend_b' ? 'B' : null;
              let query = supabase
                .from('email_campaign_recipients')
                .update({ status: 'pending' })
                .eq('campaign_id', row.campaign_id)
                .in('status', ['sent', 'opened', 'clicked']);
              if (variant) query = query.eq('ab_variant', variant);
              const { error: upErr } = await query;
              if (upErr) throw upErr;
              await supabase
                .from('email_campaigns')
                .update({ status: 'sending' })
                .eq('id', row.campaign_id);
            }
            const resSend = await fetch(`${SUPABASE_URL}/functions/v1/send-bulk-emails`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ campaignId: row.campaign_id, triggeredByCron: true }),
            });
            await resSend.json().catch(() => ({}));
            await supabase.from('scheduled_campaign_actions').update({ status: 'completed' }).eq('id', row.id);
            results.push({ id: row.id, campaign_id: row.campaign_id, action: row.action, ok: true });
          } catch (e) {
            console.error('[cron-trigger] Scheduled action failed:', row.id, e);
            results.push({ id: row.id, campaign_id: row.campaign_id, action: row.action, error: e instanceof Error ? e.message : String(e) });
          }
        }
        return new Response(JSON.stringify({
          success: true,
          action: 'process-scheduled-ab-actions',
          processed: (due || []).length,
          results,
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      case 'process-newsletter-series': {
        console.log('[cron-trigger] Processing newsletter series (daily AI sends)');
        const response = await fetch(`${SUPABASE_URL}/functions/v1/process-newsletter-series`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({}),
        });
        const result = await response.json().catch(() => ({}));
        console.log('[cron-trigger] Newsletter series result:', result);
        return new Response(JSON.stringify({
          success: response.ok,
          action: 'process-newsletter-series',
          result,
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'sync-inbound-from-resend': {
        // Pull received emails from Resend into CRM (backup when webhook doesn't fire)
        console.log('[cron-trigger] Syncing inbound emails from Resend');
        const response = await fetch(`${SUPABASE_URL}/functions/v1/sync-inbound-from-resend`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({}),
        });
        const result = await response.json().catch(() => ({}));
        console.log('[cron-trigger] Sync inbound result:', result);
        return new Response(JSON.stringify({
          success: response.ok,
          action: 'sync-inbound-from-resend',
          result,
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
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
