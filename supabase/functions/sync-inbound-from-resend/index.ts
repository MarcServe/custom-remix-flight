import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

/**
 * Sync inbound emails from Resend into the CRM.
 * Use when the webhook didn't fire or emails are missing from Conversations.
 * Lists received emails from Resend API, skips ones we already have (by message_id),
 * fetches full content for the rest, and processes each via process-inbound-emails.
 */

function cleanApiKey(key: string | undefined): string | null {
  if (!key) return null;
  return key.trim().replace(/[^\x00-\x7F]/g, '');
}

const RESEND_API_KEY = cleanApiKey(Deno.env.get('RESEND_API_KEY'));

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !supabaseServiceKey) {
    return new Response(
      JSON.stringify({ error: 'Server misconfiguration' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  if (!RESEND_API_KEY) {
    return new Response(
      JSON.stringify({ error: 'RESEND_API_KEY not set' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Optional: require auth when called from the app; allow service role (cron)
  const authHeader = req.headers.get('Authorization');
  if (authHeader) {
    const token = authHeader.replace(/^Bearer\s+/i, '');
    const isServiceRole = token === supabaseServiceKey;
    if (!isServiceRole) {
      const { data: { user }, error } = await supabase.auth.getUser(token);
      if (error || !user) {
        return new Response(
          JSON.stringify({ error: 'Unauthorized' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }
  }

  let processed = 0;
  let skipped = 0;
  const errors: string[] = [];

  try {
    const listRes = await fetch('https://api.resend.com/emails/receiving', {
      headers: { Authorization: `Bearer ${RESEND_API_KEY}` },
    });
    if (!listRes.ok) {
      const t = await listRes.text();
      console.error('Resend list received failed:', listRes.status, t);
      return new Response(
        JSON.stringify({ error: 'Failed to list received emails from Resend', detail: t }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const listJson = await listRes.json();
    const items: { id: string; from?: string; to?: string[]; subject?: string; message_id?: string }[] = listJson?.data ?? [];
    if (items.length === 0) {
      return new Response(
        JSON.stringify({ success: true, processed: 0, skipped: 0, message: 'No received emails' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    for (const item of items.slice(0, 50)) {
      const messageId = item.message_id?.replace(/[<>]/g, '') ?? item.id;
      const { data: existing } = await supabase
        .from('email_threads')
        .select('id')
        .eq('direction', 'inbound')
        .eq('message_id', messageId)
        .limit(1)
        .maybeSingle();

      if (existing) {
        skipped++;
        continue;
      }

      let emailData: { from?: string; to?: string[]; subject?: string; message_id?: string; html?: string; text?: string; headers?: Record<string, string> };
      try {
        const getRes = await fetch(`https://api.resend.com/emails/receiving/${item.id}`, {
          headers: { Authorization: `Bearer ${RESEND_API_KEY}` },
        });
        if (!getRes.ok) {
          errors.push(`Failed to fetch email ${item.id}: ${getRes.status}`);
          continue;
        }
        emailData = await getRes.json();
      } catch (e) {
        errors.push(`Fetch ${item.id}: ${(e as Error).message}`);
        continue;
      }

      const payload = {
        type: 'email.received',
        data: {
          email_id: item.id,
          from: emailData.from ?? item.from,
          to: emailData.to ?? item.to ?? [],
          subject: emailData.subject ?? item.subject ?? '',
          message_id: emailData.message_id ?? item.message_id ?? item.id,
          html: emailData.html ?? '',
          text: emailData.text ?? '',
          headers: emailData.headers ?? {},
        },
      };

      const { data: invokeData, error: invokeErr } = await supabase.functions.invoke('process-inbound-emails', {
        body: payload,
      });
      if (invokeErr) {
        errors.push(`Process ${item.id}: ${invokeErr.message}`);
        continue;
      }
      // Only count as processed when the email was actually stored (not self-sent, not failed insert)
      const stored = invokeData?.stored === true || !!invokeData?.threadId;
      if (stored) processed++;
    }

    return new Response(
      JSON.stringify({
        success: true,
        processed,
        skipped,
        ...(errors.length ? { errors } : {}),
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (e) {
    console.error('Sync inbound error:', e);
    return new Response(
      JSON.stringify({ error: (e as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
