import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { normalizePhone } from "../_shared/twilio.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key",
};

const PRODUCTS = new Set(["TalkStay", "TalkWeb", "GrantsCopilot", "other"]);
const OUTCOMES = new Set([
  "interested", "send_demo", "call_back", "not_right_person",
  "not_interested", "no_answer", "invalid_number", "do_not_call",
]);
const DEFAULT_SCRIPTS: Record<string, string> = {
  TalkStay: `Hi, is this {{company}}?\n\nMy name is {{caller}} calling from LeadBoosters about TalkStay — a guest-messaging tool that helps hotels reply faster and convert more direct bookings.\n\nHave you got 30 seconds?\n\nIf yes: We set this up for similar properties so the front desk isn't buried in WhatsApp and booking.com messages. Would a short demo this week be useful?\n\nIf no: No problem — when is a better time to call back?`,
  TalkWeb: `Hi, is this {{company}}?\n\nIt's {{caller}} from LeadBoosters. We help hospitality businesses with TalkWeb — websites and booking pages that actually convert.\n\nQuick question: are you happy with how your site turns browsers into bookings, or is that something you're reviewing?\n\nIf interested: I can send a short walkthrough. What's the best email?\n\nIf not: Thanks for your time — I'll note not to call again unless you ask.`,
  GrantsCopilot: `Hi, is this {{company}}?\n\nIt's {{caller}} from LeadBoosters. We built GrantsCopilot to help businesses find and apply for relevant UK grants without the usual paperwork slog.\n\nAre you currently looking at any funding, or would a 10-minute overview be useful?\n\nIf yes: I'll send a one-pager and book a slot.\n\nIf no: Understood — I'll mark you as not interested.`,
  other: `Hi, is this {{company}}?\n\nIt's {{caller}}. I'm calling about {{product}}.\n\nHave you got a moment to see if this is relevant?`,
};

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function personalize(tpl: string, vars: Record<string, string>): string {
  return (tpl || "").replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k) => vars[k] || "");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const xApiKey = (req.headers.get("x-api-key") || "").trim();
    const authHeader = req.headers.get("authorization") || "";
    const bearer = authHeader.replace(/^Bearer\s+/i, "").trim();
    const rawKey = xApiKey || bearer;
    let userId: string;

    if (rawKey.startsWith("lb_live_")) {
      const keyHash = await sha256Hex(rawKey);
      const { data: keyRow } = await db.from("api_keys").select("id, user_id, revoked_at").eq("key_hash", keyHash).maybeSingle();
      if (!keyRow || keyRow.revoked_at) return json({ error: "Invalid or revoked API key" }, 401);
      userId = keyRow.user_id;
      db.from("api_keys").update({ last_used_at: new Date().toISOString() }).eq("id", keyRow.id).then(() => {});
    } else if (bearer && bearer.split(".").length === 3) {
      const { data: userData, error: uErr } = await db.auth.getUser(bearer);
      if (uErr || !userData?.user) return json({ error: "Invalid or expired session" }, 401);
      userId = userData.user.id;
    } else {
      return json({ error: "Missing or invalid API key" }, 401);
    }

    const body = await req.json().catch(() => ({}));
    const action = String(body.action || "list");

    if (action === "list") {
      const { data } = await db.from("calling_campaigns")
        .select("id, name, product, status, max_queue_size, created_at, started_at")
        .eq("user_id", userId).order("created_at", { ascending: false }).limit(50);
      return json({ campaigns: data || [] });
    }

    if (action === "status" || action === "list_queue") {
      const campaignId = String(body.campaign_id || "");
      if (!campaignId) return json({ error: "campaign_id required" }, 400);
      const { data: campaign } = await db.from("calling_campaigns")
        .select("*").eq("id", campaignId).eq("user_id", userId).maybeSingle();
      if (!campaign) return json({ error: "Campaign not found" }, 404);
      const { data: queue } = await db.from("calling_queue")
        .select("id, contact_name, company_name, phone, email, status, outcome, tps_status, ctps_status, follow_up_at, queue_position")
        .eq("campaign_id", campaignId).order("queue_position");
      return json({ campaign, queue: queue || [] });
    }

    if (action === "generate_script") {
      const product = PRODUCTS.has(body.product) ? body.product : "TalkStay";
      const company = String(body.company || "{{company}}");
      const caller = String(body.caller || "{{caller}}");
      const script = personalize(DEFAULT_SCRIPTS[product] || DEFAULT_SCRIPTS.other, {
        company, caller, product,
      });
      return json({ product, script });
    }

    if (action === "create") {
      const name = String(body.name || "").trim();
      if (!name) return json({ error: "name is required" }, 400);
      const product = PRODUCTS.has(body.product) ? body.product : "TalkStay";
      const leadsIn = Array.isArray(body.leads) ? body.leads : [];
      const maxQueue = Math.min(20, Math.max(1, Number(body.max_queue_size || 20)));
      if (leadsIn.length === 0) return json({ error: "Provide a 'leads' array (max 20). Each lead needs a phone." }, 400);

      const seen = new Set<string>();
      const leads: Array<Record<string, string>> = [];
      for (const raw of leadsIn) {
        const phone = normalizePhone(raw?.phone || raw?.company_phone);
        if (!phone || seen.has(phone)) continue;
        seen.add(phone);
        leads.push({
          phone,
          email: String(raw.email || raw.general_email || "").trim(),
          contact_name: String(raw.contact_name || raw.name || "").trim(),
          company_name: String(raw.company_name || raw.company || "").trim(),
          company_id: String(raw.company_id || ""),
        });
        if (leads.length >= maxQueue) break;
      }
      if (leads.length === 0) return json({ error: "No valid phone numbers in leads" }, 400);

      // Drop suppressed numbers rather than enqueue them.
      const { data: suppressed } = await db.from("suppression_list")
        .select("phone").eq("user_id", userId).in("phone", leads.map((l) => l.phone));
      const blocked = new Set((suppressed || []).map((s) => s.phone));
      const eligible = leads.filter((l) => !blocked.has(l.phone));
      if (eligible.length === 0) return json({ error: "Every lead is on the suppression list" }, 400);

      const script = String(body.script || "").trim() || personalize(DEFAULT_SCRIPTS[product], {
        company: "{{company}}", caller: "{{caller}}", product,
      });

      const { data: campaign, error: campErr } = await db.from("calling_campaigns").insert({
        user_id: userId,
        name,
        product,
        status: "draft",
        script,
        sms_template: String(body.sms_template || "").trim() || null,
        email_followup_subject: String(body.email_followup_subject || "").trim() || null,
        email_followup_body: String(body.email_followup_body || "").trim() || null,
        caller_phone: body.caller_phone ? normalizePhone(body.caller_phone) : null,
        max_queue_size: maxQueue,
        notes: "Created via Work/API. Human must start calling — no auto-dial.",
      }).select("*").single();
      if (campErr || !campaign) return json({ error: campErr?.message || "Failed to create campaign" }, 500);

      const rows = eligible.map((l, i) => ({
        campaign_id: campaign.id,
        user_id: userId,
        company_id: l.company_id || null,
        contact_name: l.contact_name || null,
        company_name: l.company_name || null,
        phone: l.phone,
        email: l.email || null,
        queue_position: i + 1,
        status: "pending",
        tps_status: "unknown",
        ctps_status: "unknown",
      }));
      const { error: qErr } = await db.from("calling_queue").insert(rows);
      if (qErr) return json({ error: qErr.message, campaign_id: campaign.id }, 500);

      return json({
        campaign_id: campaign.id,
        name: campaign.name,
        product,
        status: "draft",
        queued: rows.length,
        suppressed: leads.length - eligible.length,
        note: "Draft only. Open LeadBoosters → Calling, screen TPS/CTPS, then click Call next lead. Work will not auto-dial.",
      });
    }

    if (action === "start" || action === "pause" || action === "complete") {
      const campaignId = String(body.campaign_id || "");
      if (!campaignId) return json({ error: "campaign_id required" }, 400);
      const next = action === "start" ? "ready" : action === "pause" ? "paused" : "completed";
      const patch: Record<string, unknown> = { status: next };
      if (action === "start") patch.started_at = new Date().toISOString();
      if (action === "pause") patch.paused_at = new Date().toISOString();
      if (action === "complete") patch.completed_at = new Date().toISOString();
      const { data, error } = await db.from("calling_campaigns")
        .update(patch).eq("id", campaignId).eq("user_id", userId).select("id, status").maybeSingle();
      if (error || !data) return json({ error: error?.message || "Campaign not found" }, 404);
      return json({
        campaign_id: data.id,
        status: data.status,
        note: action === "start"
          ? "Campaign is ready. A human must click Call next lead — this API does not place calls."
          : `Campaign ${data.status}.`,
      });
    }

    if (action === "record_outcome") {
      const queueItemId = String(body.queue_item_id || "");
      const outcome = String(body.outcome || "");
      if (!queueItemId) return json({ error: "queue_item_id required" }, 400);
      if (!OUTCOMES.has(outcome)) return json({ error: `outcome must be one of: ${[...OUTCOMES].join(", ")}` }, 400);

      const { data: item } = await db.from("calling_queue")
        .select("*").eq("id", queueItemId).eq("user_id", userId).maybeSingle();
      if (!item) return json({ error: "Queue item not found" }, 404);

      const followUpHours = Number(body.follow_up_hours || 0);
      const followUpAt = outcome === "call_back" || outcome === "no_answer"
        ? new Date(Date.now() + (followUpHours || (outcome === "no_answer" ? 24 : 4)) * 3600_000).toISOString()
        : null;

      await db.from("calling_queue").update({
        outcome,
        status: "completed",
        notes: body.notes ? String(body.notes) : item.notes,
        follow_up_at: followUpAt,
      }).eq("id", item.id);

      if (outcome === "do_not_call" || outcome === "not_interested" || outcome === "invalid_number") {
        const reason = outcome === "invalid_number" ? "invalid" : "dnc";
        await db.from("suppression_list").upsert({
          user_id: userId,
          phone: item.phone,
          email: item.email,
          reason,
          source: "call_outcome",
          notes: String(body.notes || outcome),
        }, { onConflict: "user_id,phone,reason" });
      }

      return json({ ok: true, queue_item_id: item.id, outcome, follow_up_at: followUpAt });
    }

    if (action === "add_suppression") {
      const phone = normalizePhone(body.phone);
      if (!phone) return json({ error: "phone is required" }, 400);
      const reason = ["dnc", "tps", "ctps", "sms_opt_out", "invalid", "user_added"].includes(body.reason)
        ? body.reason
        : "user_added";
      const { error } = await db.from("suppression_list").upsert({
        user_id: userId,
        phone,
        email: body.email || null,
        reason,
        source: "work_api",
        notes: body.notes || null,
      }, { onConflict: "user_id,phone,reason" });
      if (error) return json({ error: error.message }, 500);
      return json({ ok: true, phone, reason });
    }

    return json({ error: `Unknown action '${action}'` }, 400);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : String(error) }, 500);
  }
});
