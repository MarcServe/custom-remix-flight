import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

/**
 * Fetch a single email's status from Resend using GET /emails/{id}.
 * Much more targeted than listing all emails — no pagination, no rate-limit issues.
 * Returns null if the request fails.
 */
async function fetchResendEmail(
  id: string,
  apiKey: string,
): Promise<{ id: string; last_event?: string } | null> {
  const res = await fetch(`https://api.resend.com/emails/${id}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!res.ok) {
    console.warn(`[sync] Resend GET /emails/${id} → ${res.status}`);
    return null;
  }
  return res.json();
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing Authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
    const supabaseAuth = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(token);
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json().catch(() => ({}));
    const campaignId = body.campaignId as string | undefined;

    if (!campaignId) {
      return new Response(
        JSON.stringify({ error: 'campaignId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    if (!resendApiKey) {
      return new Response(
        JSON.stringify({ success: false, skipped: true, message: 'Resend API key not configured. Add RESEND_API_KEY in Supabase secrets to enable tracking sync.' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const serviceSupabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: campaign, error: campError } = await serviceSupabase
      .from('email_campaigns')
      .select('id, user_id')
      .eq('id', campaignId)
      .single();
    if (campError || !campaign || campaign.user_id !== user.id) {
      return new Response(
        JSON.stringify({ success: false, message: 'Campaign not found or access denied' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch all sent recipients for this campaign that have a Resend message ID.
    // Exclude already-clicked (highest status) to avoid unnecessary API calls.
    const { data: recipients } = await serviceSupabase
      .from('email_campaign_recipients')
      .select('id, email, external_message_id, status')
      .eq('campaign_id', campaignId)
      .not('external_message_id', 'is', null)
      .in('status', ['sent', 'delivered', 'opened']); // skip 'clicked' — already at max

    if (!recipients || recipients.length === 0) {
      return new Response(
        JSON.stringify({ success: true, campaignId, checked: 0, updated: 0, message: 'No trackable recipients found. Send the campaign first.' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[sync] Checking ${recipients.length} sent recipients via GET /emails/{id}`);

    let updated = 0;
    const now = new Date().toISOString();

    // Process in parallel batches of 10 to stay well within rate limits
    const CONCURRENCY = 10;
    for (let i = 0; i < recipients.length; i += CONCURRENCY) {
      const batch = (recipients as any[]).slice(i, i + CONCURRENCY);
      await Promise.all(
        batch.map(async (rec: any) => {
          const emailData = await fetchResendEmail(rec.external_message_id, resendApiKey);
          if (!emailData) return;

          const lastEvent = (emailData.last_event || '').toLowerCase();
          const updates: Record<string, unknown> = {};

          if (['delivered', 'opened', 'clicked'].includes(lastEvent)) {
            updates.delivered_at = now;
            if (rec.status === 'sent') updates.status = 'delivered';
          }
          if (['opened', 'clicked'].includes(lastEvent)) {
            updates.opened_at = now;
            updates.status = 'opened';
          }
          if (lastEvent === 'clicked') {
            updates.clicked_at = now;
            updates.status = 'clicked';
          }
          if (lastEvent === 'bounced' || lastEvent === 'complained') {
            updates.status = 'bounced';
          }

          if (Object.keys(updates).length === 0) return;

          const { error: upErr } = await serviceSupabase
            .from('email_campaign_recipients')
            .update(updates)
            .eq('id', rec.id);
          if (!upErr) updated++;
        })
      );
    }

    // Update campaign open/click counts
    if (updated > 0) {
      const { count: openedCount } = await serviceSupabase
        .from('email_campaign_recipients')
        .select('*', { count: 'exact', head: true })
        .eq('campaign_id', campaignId)
        .in('status', ['opened', 'clicked']);
      if (openedCount != null) {
        await serviceSupabase
          .from('email_campaigns')
          .update({ opened_count: openedCount })
          .eq('id', campaignId);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        campaignId,
        checked: recipients.length,
        updated,
        message: updated > 0
          ? `Synced ${updated} recipient(s) — tracking data updated.`
          : `Checked ${recipients.length} recipient(s) — no new tracking events.`,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('sync-resend-campaign-status error:', err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
