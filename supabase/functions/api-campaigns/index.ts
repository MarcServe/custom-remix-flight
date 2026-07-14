import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key",
};

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function personalize(tpl: string, r: any): string {
  if (!tpl) return "";
  const full = [r.first_name, r.last_name].filter(Boolean).join(" ") || r.name || r.email || "";
  return tpl
    .replace(/\{\{\s*firstName\s*\}\}/gi, r.first_name || (full.split(" ")[0] || ""))
    .replace(/\{\{\s*lastName\s*\}\}/gi, r.last_name || full.split(" ").slice(1).join(" ") || "")
    .replace(/\{\{\s*fullName\s*\}\}/gi, full)
    .replace(/\{\{\s*name\s*\}\}/gi, full)
    .replace(/\{\{\s*company\s*\}\}/gi, r.company || "")
    .replace(/\{\{\s*email\s*\}\}/gi, r.email || "");
}

// Interpret a bare "YYYY-MM-DDTHH:mm" as London wall-clock → UTC ISO. Full ISO passes through.
function toUtcIso(schedule: string, tz = "Europe/London"): string | null {
  if (!schedule) return null;
  if (/[zZ]|[+\-]\d{2}:?\d{2}$/.test(schedule)) return new Date(schedule).toISOString();
  const [datePart, timePart = "00:00"] = schedule.split("T");
  const [y, mo, d] = datePart.split("-").map(Number);
  const [h, mi] = timePart.split(":").map(Number);
  const target = Date.UTC(y, (mo || 1) - 1, d || 1, h || 0, mi || 0, 0);
  let ts = target;
  const fmt = new Intl.DateTimeFormat("en-US", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false });
  for (let i = 0; i < 3; i++) {
    const p = fmt.formatToParts(new Date(ts));
    const g = (t: string) => parseInt(p.find((x) => x.type === t)?.value || "0", 10);
    const sh = g("hour") === 24 ? 0 : g("hour");
    const shown = Date.UTC(g("year"), g("month") - 1, g("day"), sh, g("minute"), 0);
    const diff = target - shown;
    if (diff === 0) break;
    ts += diff;
  }
  return new Date(ts).toISOString();
}

const EMAIL_RE = /^[^\s@,]+@[^\s@,]+\.[^\s@,]+$/;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    // ── Auth via API key (X-API-Key or Authorization: Bearer lb_live_...) ──
    const rawKey = (req.headers.get("x-api-key") || req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
    if (!rawKey.startsWith("lb_live_")) return json({ error: "Missing or invalid API key" }, 401);
    const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const keyHash = await sha256Hex(rawKey);
    const { data: keyRow } = await db.from("api_keys").select("id, user_id, revoked_at").eq("key_hash", keyHash).maybeSingle();
    if (!keyRow || keyRow.revoked_at) return json({ error: "Invalid or revoked API key" }, 401);
    const userId = keyRow.user_id;
    db.from("api_keys").update({ last_used_at: new Date().toISOString() }).eq("id", keyRow.id).then(() => {});

    const body = await req.json().catch(() => ({}));
    const action = body.action || (req.method === "GET" ? "list" : "create");

    if (action === "list") {
      const { data } = await db.from("email_campaigns")
        .select("id, name, status, sent_count, failed_count, total_recipients, scheduled_at, created_at")
        .eq("user_id", userId).order("created_at", { ascending: false }).limit(50);
      return json({ campaigns: data || [] });
    }

    if (action === "status") {
      if (!body.campaign_id) return json({ error: "campaign_id required" }, 400);
      const { data } = await db.from("email_campaigns")
        .select("id, name, status, sent_count, failed_count, total_recipients, scheduled_at")
        .eq("id", body.campaign_id).eq("user_id", userId).maybeSingle();
      if (!data) return json({ error: "Campaign not found" }, 404);
      return json({ campaign: data });
    }

    if (action === "create") {
      const name = String(body.name || "").trim();
      const subject = String(body.subject || "").trim();
      const bodyText = String(body.body_text || body.bodyText || "").trim();
      const bodyHtml = String(body.body_html || body.bodyHtml || "").trim();
      const recipientsIn = Array.isArray(body.recipients) ? body.recipients : [];
      if (!name) return json({ error: "name is required" }, 400);
      if (!subject) return json({ error: "subject is required" }, 400);
      if (!bodyText && !bodyHtml) return json({ error: "body_text or body_html is required" }, 400);
      if (recipientsIn.length === 0) return json({ error: "recipients is required (non-empty array)" }, 400);

      // Dedupe + validate recipients
      const seen = new Set<string>();
      const recips = [];
      for (const r of recipientsIn) {
        const email = String(r?.email || "").trim().toLowerCase();
        if (!EMAIL_RE.test(email) || seen.has(email)) continue;
        seen.add(email);
        recips.push({ email, first_name: r.first_name || r.firstName || "", last_name: r.last_name || r.lastName || "", company: r.company || "", name: r.name || "" });
      }
      if (recips.length === 0) return json({ error: "No valid recipient emails" }, 400);

      const scheduledAt = body.schedule_at || body.scheduleAt ? toUtcIso(String(body.schedule_at || body.scheduleAt), body.timezone || "Europe/London") : null;
      const status = scheduledAt ? "scheduled" : "draft";

      const finalHtml = bodyHtml || `<p>${bodyText.replace(/\n/g, "</p><p>")}</p>`;
      const { data: campaign, error: campErr } = await db.from("email_campaigns").insert({
        user_id: userId,
        name,
        subject_template: subject,
        body_html_template: finalHtml,
        body_text_template: bodyText || finalHtml.replace(/<[^>]+>/g, " "),
        status,
        scheduled_at: scheduledAt,
        total_recipients: recips.length,
      }).select("id").single();
      if (campErr || !campaign) return json({ error: campErr?.message || "Failed to create campaign" }, 500);

      const rows = recips.map((r) => {
        const nm = [r.first_name, r.last_name].filter(Boolean).join(" ") || r.name || r.email;
        return {
          campaign_id: campaign.id,
          email: r.email,
          name: nm,
          personalized_subject: personalize(subject, r) || subject,
          personalized_body_html: personalize(finalHtml, r) || finalHtml,
          personalized_body_text: personalize(bodyText || finalHtml.replace(/<[^>]+>/g, " "), r),
          status: "pending",
        };
      });
      for (let i = 0; i < rows.length; i += 500) {
        const { error: rErr } = await db.from("email_campaign_recipients").insert(rows.slice(i, i + 500));
        if (rErr) return json({ error: `Recipients insert failed: ${rErr.message}`, campaign_id: campaign.id }, 500);
      }

      return json({
        campaign_id: campaign.id,
        status,
        scheduled_at: scheduledAt,
        recipients: rows.length,
        message: scheduledAt
          ? `Campaign scheduled — it will send automatically at ${scheduledAt} (UTC).`
          : "Campaign created as a draft. Provide schedule_at to have it sent automatically.",
      });
    }

    return json({ error: "Unknown action. Use create | list | status." }, 400);
  } catch (e: any) {
    return json({ error: e?.message || "Failed" }, 500);
  }
});

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
