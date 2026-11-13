import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { normalizePhone, twiml, xmlEscape } from "../_shared/twilio.ts";

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const queueItemId = url.searchParams.get("queue_item_id") || "";
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const db = createClient(supabaseUrl, serviceKey);

  if (!queueItemId) {
    return xml(twiml(`<Say voice="alice">Sorry, this call could not be connected.</Say>`));
  }

  const { data: item } = await db
    .from("calling_queue")
    .select("phone, campaign:calling_campaigns(connection_id, user_id)")
    .eq("id", queueItemId)
    .maybeSingle();

  const leadPhone = normalizePhone(item?.phone);
  if (!leadPhone) {
    return xml(twiml(`<Say voice="alice">Sorry, no valid number was found for this lead.</Say>`));
  }

  const campaign = item?.campaign as { connection_id?: string; user_id?: string } | null;
  let callerId = "";
  if (campaign?.connection_id) {
    const { data: conn } = await db.from("crm_connections").select("metadata").eq("id", campaign.connection_id).maybeSingle();
    const meta = (conn?.metadata || {}) as Record<string, unknown>;
    callerId = normalizePhone(String(meta.phone_number || meta.from_number || ""));
  }

  const statusUrl = `${supabaseUrl}/functions/v1/twilio-status-webhook?queue_item_id=${encodeURIComponent(queueItemId)}`;
  const dialAttrs = [
    `callerId="${xmlEscape(callerId || leadPhone)}"`,
    `timeout="30"`,
    `action="${xmlEscape(statusUrl)}"`,
  ].join(" ");

  return xml(twiml(
    `<Say voice="alice">Connecting you to the next lead.</Say>` +
    `<Dial ${dialAttrs}><Number>${xmlEscape(leadPhone)}</Number></Dial>`,
  ));
});

function xml(body: string) {
  return new Response(body, {
    status: 200,
    headers: { "Content-Type": "text/xml" },
  });
}
