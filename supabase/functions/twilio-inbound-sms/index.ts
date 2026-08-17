import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { isStopKeyword, normalizePhone } from "../_shared/twilio.ts";

async function readParams(req: Request): Promise<Record<string, string>> {
  const url = new URL(req.url);
  const out: Record<string, string> = {};
  url.searchParams.forEach((v, k) => { out[k] = v; });
  if (req.method === "POST") {
    const text = await req.text();
    const body = new URLSearchParams(text);
    body.forEach((v, k) => { out[k] = v; });
  }
  return out;
}

Deno.serve(async (req) => {
  const params = await readParams(req);
  const from = normalizePhone(params.From);
  const to = normalizePhone(params.To);
  const body = String(params.Body || "").trim();
  const sid = params.MessageSid || "";

  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  // Match the Twilio number back to a LeadBoosters user connection.
  const { data: connections } = await db
    .from("crm_connections")
    .select("id, user_id, metadata")
    .eq("provider", "twilio")
    .eq("status", "active")
    .limit(50);

  const connection = (connections || []).find((c) => {
    const meta = (c.metadata || {}) as Record<string, unknown>;
    return normalizePhone(String(meta.phone_number || meta.from_number || "")) === to;
  });

  if (connection && from) {
    const { data: queueItem } = await db
      .from("calling_queue")
      .select("id, campaign_id, company_id")
      .eq("user_id", connection.user_id)
      .eq("phone", from)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    await db.from("sms_messages").insert({
      user_id: connection.user_id,
      campaign_id: queueItem?.campaign_id || null,
      queue_item_id: queueItem?.id || null,
      company_id: queueItem?.company_id || null,
      twilio_message_sid: sid,
      direction: "inbound",
      from_number: from,
      to_number: to,
      body,
      status: "received",
      raw_payload: params,
    });

    if (isStopKeyword(body)) {
      await db.from("suppression_list").upsert({
        user_id: connection.user_id,
        phone: from,
        reason: "sms_opt_out",
        source: "inbound_sms",
        notes: body,
      }, { onConflict: "user_id,phone,reason" });
    }
  }

  return new Response("<Response></Response>", {
    status: 200,
    headers: { "Content-Type": "text/xml" },
  });
});
