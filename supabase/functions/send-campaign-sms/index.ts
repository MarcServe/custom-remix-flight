import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { credsFromMetadata, normalizePhone, twilioPost } from "../_shared/twilio.ts";

const LIVE_OUTCOMES = new Set(["interested", "send_demo", "call_back", "not_right_person"]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "No authorization header" }, 401);

    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) return json({ error: "Unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const queueItemId = String(body.queue_item_id || body.queueItemId || "").trim();
    const message = String(body.message || "").trim();
    if (!queueItemId) return json({ error: "queue_item_id is required" }, 400);
    if (!message) return json({ error: "message is required" }, 400);

    const db = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: item } = await db
      .from("calling_queue")
      .select("*, campaign:calling_campaigns(*)")
      .eq("id", queueItemId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!item) return json({ error: "Queue item not found" }, 404);

    const campaign = (item.campaign || {}) as Record<string, unknown>;
    const to = normalizePhone(item.phone);
    if (!to) return json({ error: "Invalid phone number" }, 400);

    const { data: suppressed } = await db
      .from("suppression_list")
      .select("reason")
      .eq("user_id", user.id)
      .eq("phone", to)
      .in("reason", ["dnc", "sms_opt_out", "tps", "ctps"])
      .limit(1);
    if (suppressed && suppressed.length > 0) {
      return json({ error: `Cannot SMS: number is suppressed (${suppressed[0].reason})` }, 403);
    }

    // First version: no cold SMS. Allow only after a live conversation or explicit consent.
    if (!item.sms_consent && !LIVE_OUTCOMES.has(String(item.outcome || ""))) {
      return json({
        error: "Cold SMS is blocked. Send SMS only after a live call outcome or when the contact has consented.",
      }, 403);
    }

    let connectionQuery = db
      .from("crm_connections")
      .select("*")
      .eq("user_id", user.id)
      .eq("provider", "twilio")
      .eq("status", "active");
    if (campaign.connection_id) connectionQuery = connectionQuery.eq("id", String(campaign.connection_id));
    const { data: connection } = await connectionQuery.maybeSingle();
    const creds = credsFromMetadata((connection?.metadata || {}) as Record<string, unknown>);
    if (!creds) return json({ error: "Twilio is not connected" }, 400);

    const statusUrl = `${supabaseUrl}/functions/v1/twilio-status-webhook?queue_item_id=${encodeURIComponent(item.id)}`;
    const twilio = await twilioPost(creds, "Messages.json", {
      From: creds.fromNumber,
      To: to,
      Body: message,
      StatusCallback: statusUrl,
    });

    if (!twilio.ok) {
      return json({ error: String(twilio.data.message || twilio.text || "Twilio SMS failed") }, 400);
    }

    await db.from("sms_messages").insert({
      user_id: user.id,
      campaign_id: item.campaign_id,
      queue_item_id: item.id,
      company_id: item.company_id,
      twilio_message_sid: String(twilio.data.sid || ""),
      direction: "outbound",
      from_number: creds.fromNumber,
      to_number: to,
      body: message,
      status: String(twilio.data.status || "queued"),
      raw_payload: twilio.data,
    });

    return json({ success: true, message_sid: twilio.data.sid, status: twilio.data.status });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : String(error) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
