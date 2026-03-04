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
    const newsletterId = body.newsletterId as string | undefined;
    const startDate = body.startDate as string | undefined;
    const endDate = body.endDate as string | undefined;

    if (!newsletterId) {
      return new Response(
        JSON.stringify({ error: 'newsletterId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    if (!resendApiKey) {
      return new Response(
        JSON.stringify({ error: 'Resend API not configured' }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const serviceSupabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: newsletter, error: nlError } = await serviceSupabase
      .from('newsletters')
      .select('id, user_id')
      .eq('id', newsletterId)
      .single();
    if (nlError || !newsletter || newsletter.user_id !== user.id) {
      return new Response(
        JSON.stringify({ error: 'Newsletter not found or access denied' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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
        return new Response(
          JSON.stringify({ error: `Resend API error: ${res.status}`, details: text }),
          { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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

    const { data: sends } = await serviceSupabase
      .from('newsletter_sends')
      .select('id, external_message_id, subscriber_id')
      .eq('newsletter_id', newsletterId);
    const sendByExternalId = new Map<string, { id: string }>();
    const sendByEmail = new Map<string, { id: string }>();
    const subscriberIds = [...new Set((sends || []).map((s: any) => s.subscriber_id).filter(Boolean))];
    let emailBySubscriberId: Record<string, string> = {};
    if (subscriberIds.length > 0) {
      const { data: subs } = await serviceSupabase
        .from('newsletter_subscribers')
        .select('id, email')
        .in('id', subscriberIds);
      emailBySubscriberId = Object.fromEntries(
        (subs || []).map((s: any) => [s.id, (s.email || '').trim().toLowerCase()])
      );
    }
    for (const s of sends || []) {
      const row = s as any;
      if (row.external_message_id) {
        sendByExternalId.set(String(row.external_message_id).trim(), { id: row.id });
      }
      const email = emailBySubscriberId[row.subscriber_id];
      if (email) sendByEmail.set(email, { id: row.id });
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
      let send = sendByExternalId.get(email.id);
      if (!send && toEmail(email)) {
        const recipientEmail = toEmail(email)!;
        send = sendByEmail.get(recipientEmail) ?? null;
        if (send) {
          await serviceSupabase
            .from('newsletter_sends')
            .update({ external_message_id: email.id })
            .eq('id', send.id);
          sendByExternalId.set(email.id, send);
        }
      }
      if (!send) continue;
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
        .from('newsletter_sends')
        .update(updates)
        .eq('id', send.id);
      if (!upErr) updated++;
    }

    if (updated > 0) {
      const { count: openCount } = await serviceSupabase
        .from('newsletter_sends')
        .select('*', { count: 'exact', head: true })
        .eq('newsletter_id', newsletterId)
        .not('opened_at', 'is', null);
      if (openCount != null) {
        await serviceSupabase
          .from('newsletters')
          .update({ total_opened: openCount })
          .eq('id', newsletterId);
      }
      const { count: clickCount } = await serviceSupabase
        .from('newsletter_sends')
        .select('*', { count: 'exact', head: true })
        .eq('newsletter_id', newsletterId)
        .not('clicked_at', 'is', null);
      if (clickCount != null) {
        await serviceSupabase
          .from('newsletters')
          .update({ total_clicked: clickCount })
          .eq('id', newsletterId);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        newsletterId,
        fetched: allEmails.length,
        matched,
        updated,
        message: `Synced ${updated} send(s) from Resend.`,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('sync-resend-newsletter-status error:', err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
