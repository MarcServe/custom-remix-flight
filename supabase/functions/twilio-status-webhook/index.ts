import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
  const queueItemId = params.queue_item_id || "";
  const callSid = params.CallSid || params.ParentCallSid || "";
  const callStatus = (params.CallStatus || params.DialCallStatus || "").toLowerCase();
  const duration = params.CallDuration || params.DialCallDuration || "";

  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  if (callSid) {
    const patch: Record<string, unknown> = {
      status: callStatus || "unknown",
      raw_payload: params,
    };
    if (duration) patch.duration_seconds = Number(duration) || 0;
    if (["completed", "busy", "failed", "no-answer", "canceled"].includes(callStatus)) {
      patch.ended_at = new Date().toISOString();
    }
    await db.from("call_logs").update(patch).eq("twilio_call_sid", callSid);
  }

  if (queueItemId && ["busy", "failed", "no-answer", "canceled"].includes(callStatus)) {
    await db.from("calling_queue").update({ status: "pending" }).eq("id", queueItemId).eq("status", "calling");
  }

  return new Response("<Response></Response>", {
    status: 200,
    headers: { "Content-Type": "text/xml" },
  });
});
