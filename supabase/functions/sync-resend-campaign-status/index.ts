import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

type ResendEmail = {
  id: string;
  to?: string[];
  created_at?: string;
  last_event?: string;
};

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
    const startDate = body.startDate as string | undefined; // ISO date or datetime
    const endDate = body.endDate as string | undefined;

    if (!campaignId) {
      return new Response(
        JSON.stringify({ error: 'campaignId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    if (!resendApiKey) {
      // Return 200 so the client gets the actual message instead of a generic "non-2xx" error
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

    const start = startDate ? new Date(startDate).getTime() : null;
    const end = endDate ? new Date(endDate).getTime() : null;
    const allEmails: ResendEmail[] = [];
    let cursor: string | undefined;
    const maxPages = 50;
    let pages = 0;

    while (pages < maxPages) {
      const url = new URL('https://api.resend.com/emails');
      url.searchParams.set('limit', '100');
      if (cursor) url.searchParams.set('after', cursor);
      const res = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${resendApiKey}` },
      });
      if (!res.ok) {
        const text = await res.text();
        console.error('Resend list error:', res.status, text);
        // Return 200 with a descriptive message so client can show it clearly
        return new Response(
          JSON.stringify({ success: false, skipped: true, message: `Resend API returned ${res.status}. Check that your RESEND_API_KEY is valid.`, details: text }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const json = await res.json();
      const data = (json.data || []) as ResendEmail[];
      for (const e of data) {
        const created = e.created_at ? new Date(e.created_at).getTime() : 0;
        if (start != null && created < start) continue;
        if (end != null && created > end) continue;
        allEmails.push(e);
      }
      if (!json.has_more || data.length === 0) break;
      cursor = data[data.length - 1]?.id;
      pages++;
    }

    const recipientByExternalId = new Map<string, { id: string; campaign_id: string }>();
    const { data: recipients } = await serviceSupabase
      .from('email_campaign_recipients')
      .select('id, campaign_id, external_message_id, email, sent_at')
      .eq('campaign_id', campaignId);
    for (const r of recipients || []) {
      if ((r as any).external_message_id) {
        recipientByExternalId.set((r as any).external_message_id.trim(), { id: (r as any).id, campaign_id: (r as any).campaign_id });
      }
    }

    const toEmail = (e: ResendEmail): string | null => {
      const t = e.to?.[0];
      if (typeof t === 'string') return t.trim().toLowerCase();
      return null;
    };

    let updated = 0;
    let matched = 0;
    const now = new Date().toISOString();

    for (const email of allEmails) {
      let rec = recipientByExternalId.get(email.id);
      if (!rec && toEmail(email)) {
        const recipientEmail = toEmail(email)!;
        const { data: byEmail } = await serviceSupabase
          .from('email_campaign_recipients')
          .select('id, campaign_id')
          .eq('campaign_id', campaignId)
          .ilike('email', recipientEmail)
          .in('status', ['sent', 'opened', 'clicked'])
          .order('sent_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (byEmail) {
          rec = { id: byEmail.id, campaign_id: byEmail.campaign_id };
          await serviceSupabase
            .from('email_campaign_recipients')
            .update({ external_message_id: email.id })
            .eq('id', byEmail.id);
          recipientByExternalId.set(email.id, rec);
        }
      }
      if (!rec) continue;
      matched++;

      const lastEvent = (email.last_event || '').toLowerCase();
      const updates: Record<string, unknown> = {};
      if (['delivered', 'opened', 'clicked'].includes(lastEvent)) {
        updates.delivered_at = now;
      }
      if (['opened', 'clicked'].includes(lastEvent)) {
        updates.opened_at = now;
        updates.status = 'opened';
      }
      if (lastEvent === 'clicked') {
        updates.clicked_at = now;
        updates.status = 'clicked';
      }
      if (Object.keys(updates).length === 0) continue;

      const { error: upErr } = await serviceSupabase
        .from('email_campaign_recipients')
        .update(updates)
        .eq('id', rec.id);
      if (!upErr) updated++;
    }

    if (updated > 0) {
      const { count } = await serviceSupabase
        .from('email_campaign_recipients')
        .select('*', { count: 'exact', head: true })
        .eq('campaign_id', campaignId)
        .in('status', ['opened', 'clicked']);
      if (count != null) {
        await serviceSupabase
          .from('email_campaigns')
          .update({ opened_count: count })
          .eq('id', campaignId);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        campaignId,
        fetched: allEmails.length,
        matched,
        updated,
        message: `Synced ${updated} recipient(s) from Resend.`,
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
