import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { credsFromMetadata, normalizePhone, twilioPost } from "../_shared/twilio.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return json({ error: "No authorization header" }, 401);
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) return json({ error: "Unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const queueItemId = String(body.queue_item_id || body.queueItemId || "").trim();
    if (!queueItemId) return json({ error: "queue_item_id is required" }, 400);

    const db = createClient(supabaseUrl, serviceKey);

    const { data: item, error: itemErr } = await db
      .from("calling_queue")
      .select("*, campaign:calling_campaigns(*)")
      .eq("id", queueItemId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (itemErr || !item) return json({ error: "Queue item not found" }, 404);

    const campaign = item.campaign as Record<string, unknown> | null;
    if (!campaign) return json({ error: "Campaign not found" }, 404);
    if (!["ready", "active"].includes(String(campaign.status))) {
      return json({ error: "Campaign must be ready or active before calling" }, 400);
    }

    if (item.tps_status === "listed" || item.ctps_status === "listed") {
      return json({ error: "Number is listed on TPS/CTPS and cannot be called" }, 403);
    }

    const leadPhone = normalizePhone(item.phone);
    if (!leadPhone) return json({ error: "Queue item has no valid phone number" }, 400);

    const { data: suppressed } = await db
      .from("suppression_list")
      .select("id, reason")
      .eq("user_id", user.id)
      .eq("phone", leadPhone)
      .in("reason", ["dnc", "tps", "ctps", "invalid"])
      .limit(1);
    if (suppressed && suppressed.length > 0) {
      await db.from("calling_queue").update({ status: "blocked" }).eq("id", item.id);
      return json({ error: `Number is on the suppression list (${suppressed[0].reason})` }, 403);
    }

    const connectionId = String(campaign.connection_id || body.connection_id || "");
    let connectionQuery = db
      .from("crm_connections")
      .select("*")
      .eq("user_id", user.id)
      .eq("status", "active")
      .eq("provider", "twilio");
    if (connectionId) connectionQuery = connectionQuery.eq("id", connectionId);
    const { data: connection } = await connectionQuery.maybeSingle();

    const creds = credsFromMetadata((connection?.metadata || {}) as Record<string, unknown>);
    if (!creds) return json({ error: "Twilio is not connected. Add Account SID, Auth Token and a UK number in Settings → Phone." }, 400);

    const agentPhone = normalizePhone(
      String(body.caller_phone || campaign.caller_phone || (connection?.metadata as Record<string, unknown>)?.caller_phone || ""),
    );
    if (!agentPhone) {
      return json({ error: "Set your caller phone (the handset Twilio should ring first) on the campaign or Twilio connection." }, 400);
    }

    const voiceUrl = `${supabaseUrl}/functions/v1/twilio-voice-webhook?queue_item_id=${encodeURIComponent(item.id)}`;
    const statusUrl = `${supabaseUrl}/functions/v1/twilio-status-webhook?queue_item_id=${encodeURIComponent(item.id)}`;

    const twilio = await twilioPost(creds, "Calls.json", {
      From: creds.fromNumber,
      To: agentPhone,
      Url: voiceUrl,
      StatusCallback: statusUrl,
      StatusCallbackEvent: "initiated ringing answered completed",
      StatusCallbackMethod: "POST",
    });

    if (!twilio.ok) {
      const msg = String(twilio.data.message || twilio.text || "Twilio call failed");
      return json({ error: msg, twilio: twilio.data }, 400);
    }

    const callSid = String(twilio.data.sid || "");
    await db.from("call_logs").insert({
      user_id: user.id,
      campaign_id: item.campaign_id,
      queue_item_id: item.id,
      company_id: item.company_id,
      twilio_call_sid: callSid,
      direction: "outbound",
      from_number: creds.fromNumber,
      to_number: leadPhone,
      status: String(twilio.data.status || "initiated"),
      started_at: new Date().toISOString(),
      raw_payload: twilio.data,
    });

    await db.from("calling_queue").update({
      status: "calling",
      last_called_at: new Date().toISOString(),
    }).eq("id", item.id);

    await db.from("calling_campaigns").update({
      status: campaign.status === "ready" ? "active" : campaign.status,
      started_at: campaign.started_at || new Date().toISOString(),
    }).eq("id", item.campaign_id);

    return json({
      success: true,
      call_sid: callSid,
      status: twilio.data.status,
      agent_phone: agentPhone,
      lead_phone: leadPhone,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return json({ error: msg }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
