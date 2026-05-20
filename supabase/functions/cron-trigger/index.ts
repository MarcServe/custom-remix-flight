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
 * - POST { action: "sync-gmail-replies" } - Syncs Gmail replies for all connected users (runs hourly via pg_cron)
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
        // 1) Send scheduled newsletters (status = scheduled, scheduled_at <= now)
        // 2) Continue batch sends (status = sending, batch_send = true, batch_next_at <= now, or any pending if forceNextBatch)
        const forceNextBatch = body.forceNextBatch === true || body.force_next_batch === true;
        console.log('[cron-trigger] Processing scheduled and batch newsletters', forceNextBatch ? '(force next batch now)' : '');

        const now = new Date().toISOString();

        const { data: scheduledNewsletters, error: nlError } = await supabase
          .from('newsletters')
          .select('id, user_id, title, scheduled_at')
          .eq('status', 'scheduled')
          .lte('scheduled_at', now);

        let batchQuery = supabase
          .from('newsletters')
          .select('id, user_id, title, batch_sent_count, batch_size, total_recipients')
          .eq('status', 'sending')
          .eq('batch_send', true)
          .not('batch_next_at', 'is', null);
        if (!forceNextBatch) {
          batchQuery = batchQuery.lte('batch_next_at', now);
        }
        const { data: batchNewsletters, error: batchError } = await batchQuery;

        if (nlError) {
          console.error('[cron-trigger] Error fetching scheduled newsletters:', nlError);
        }
        if (batchError) {
          console.error('[cron-trigger] Error fetching batch newsletters:', batchError);
        }

        let toProcess = [...(scheduledNewsletters || []).map((nl: any) => ({ ...nl, continueBatch: false })), ...(batchNewsletters || []).map((nl: any) => ({ ...nl, continueBatch: true }))];
        console.log(`[cron-trigger] Found ${scheduledNewsletters?.length || 0} scheduled + ${batchNewsletters?.length || 0} batch newsletters`);

        // Respect sending window: only process when current hour is within user's start–end (in user's timezone or UTC). Skip when forceNextBatch.
        if (!forceNextBatch && toProcess.length > 0) {
          const userIds = [...new Set(toProcess.map((nl: any) => nl.user_id))];
          const { data: profiles } = await supabase
            .from('business_profiles')
            .select('user_id, newsletter_cron_start_hour_utc, newsletter_cron_end_hour_utc, newsletter_cron_timezone')
            .in('user_id', userIds);
          const profileByUser = (profiles || []).reduce((acc: Record<string, { start: number; end: number; timezone: string | null }>, p: any) => {
            acc[p.user_id] = {
              start: p.newsletter_cron_start_hour_utc != null ? Math.max(0, Math.min(23, Number(p.newsletter_cron_start_hour_utc) | 0)) : 9,
              end: p.newsletter_cron_end_hour_utc != null ? Math.max(0, Math.min(23, Number(p.newsletter_cron_end_hour_utc) | 0)) : 22,
              timezone: (p.newsletter_cron_timezone && String(p.newsletter_cron_timezone).trim()) || null,
            };
            return acc;
          }, {});
          const now = new Date();
          const utcHour = now.getUTCHours();
          toProcess = toProcess.filter((nl: any) => {
            const w = profileByUser[nl.user_id] ?? { start: 9, end: 22, timezone: null };
            let currentHour: number;
            let tzLabel: string;
            if (w.timezone) {
              try {
                currentHour = parseInt(
                  new Intl.DateTimeFormat('en-CA', { timeZone: w.timezone, hour: 'numeric', hour12: false }).format(now),
                  10
                );
                tzLabel = w.timezone;
              } catch {
                currentHour = utcHour;
                tzLabel = 'UTC (fallback)';
              }
            } else {
              currentHour = utcHour;
              tzLabel = 'UTC';
            }
            const inWindow = currentHour >= w.start && currentHour <= w.end;
            if (!inWindow) console.log(`[cron-trigger] Skipping ${nl.title} (window ${w.start}:00–${w.end}:00 ${tzLabel}, now ${currentHour}:00)`);
            return inWindow;
          });
          console.log(`[cron-trigger] After sending window filter: ${toProcess.length} newsletters to process`);
        }

        const results: any[] = [];
        for (const nl of toProcess) {
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
                continueBatch: nl.continueBatch === true,
                batchSize: nl.continueBatch === true ? 50 : undefined,
              }),
            });
            const result = await response.json().catch(() => ({}));
            results.push({ newsletterId: nl.id, title: nl.title, continueBatch: nl.continueBatch, result });
            console.log(`[cron-trigger] Newsletter ${nl.title} (batch=${nl.continueBatch}) result:`, result);
          } catch (err) {
            console.error(`[cron-trigger] Error sending newsletter ${nl.id}:`, err);
            results.push({ newsletterId: nl.id, error: err instanceof Error ? err.message : 'Unknown error' });
          }
        }

        return new Response(JSON.stringify({
          success: true,
          action: 'send-newsletters',
          newslettersProcessed: toProcess.length,
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

      case 'sync-gmail-replies': {
        console.log('[cron-trigger] Syncing Gmail replies for all connected users');
        const response = await fetch(`${SUPABASE_URL}/functions/v1/gmail-sync-replies`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ triggered_by: 'cron' }),
        });
        const result = await response.json().catch(() => ({}));
        console.log('[cron-trigger] Gmail sync result:', result);
        return new Response(JSON.stringify({
          success: response.ok,
          action: 'sync-gmail-replies',
          result,
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
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
