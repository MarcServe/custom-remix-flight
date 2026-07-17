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

// Free-mail domains never represent a shared company, so contacts on them get a
// distinct company (their own email) → each enrolls in its own follow-up thread.
const FREEMAIL = new Set([
  "gmail.com", "googlemail.com", "yahoo.com", "yahoo.co.uk", "hotmail.com", "hotmail.co.uk",
  "outlook.com", "live.com", "msn.com", "icloud.com", "me.com", "mac.com", "aol.com",
  "proton.me", "protonmail.com", "gmx.com", "gmx.net", "mail.com", "yandex.com", "zoho.com",
]);

function domainToName(domain: string): string {
  const base = (domain || "").split(".")[0] || "";
  return base ? base.charAt(0).toUpperCase() + base.slice(1) : "";
}

// Run an async mapper over items with a bounded concurrency so linking hundreds
// of recipients doesn't fan out into unbounded parallel DB calls.
async function mapPool<T, R>(items: T[], limit: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out = new Array(items.length) as R[];
  let idx = 0;
  async function worker() { while (idx < items.length) { const i = idx++; out[i] = await fn(items[i]); } }
  await Promise.all(Array.from({ length: Math.min(limit, items.length || 1) }, worker));
  return out;
}

// The ready-made "Day 1 / 3 / 5" no-reply follow-up. Mirrors setup-noreply-followup
// so API campaigns share the exact same sequence (found-or-created once per user).
const FOLLOWUP_STEPS = [
  { subject: "Just following up", body: "Hi {{firstName}},\n\nI wanted to quickly follow up on my previous email in case it slipped through. Would you be open to a short conversation?\n\nThanks!", delayDays: 1 },
  { subject: "Re: quick follow-up", body: "Hi {{firstName}},\n\nCircling back on this — I'd genuinely value your thoughts, and I'm happy to share more detail or answer any questions.\n\nBest,", delayDays: 2 },
  { subject: "Last note from me", body: "Hi {{firstName}},\n\nI don't want to clutter your inbox, so this will be my last note. If the timing isn't right, no problem at all — just let me know and I'll reach out again down the line.\n\nThanks for your time.", delayDays: 2 },
];
const NOREPLY_SEQ_NAME = "No-reply follow-up (Day 1 / 3 / 5)";

async function ensureNoReplySequence(db: any, userId: string): Promise<string | null> {
  const { data: existing } = await db.from("email_sequences").select("id").eq("created_by", userId).eq("name", NOREPLY_SEQ_NAME).limit(1).maybeSingle();
  if (existing?.id) return existing.id;
  const { data: seq } = await db.from("email_sequences").insert({
    name: NOREPLY_SEQ_NAME,
    description: "Auto-created: 3 gentle follow-ups on day 1, 3 and 5. Stops automatically as soon as the recipient replies.",
    steps: FOLLOWUP_STEPS.map((s) => JSON.stringify(s)),
    created_by: userId, repeat_sequence: false, repeat_after_days: 5, repeat_only_for: "no_reply",
    auto_respond: false, use_email_branding: true,
  }).select("id").single();
  return seq?.id ?? null;
}

// Ensure a recipient is a CRM person with a company, so the scheduled send's
// enrollFollowUp (which needs person_id → company_id) can enrol them. Idempotent:
// re-running the same daily group reuses the same people/companies.
async function ensurePersonCompany(db: any, userId: string, r: any): Promise<string | null> {
  const email = String(r.email || "").toLowerCase().trim();
  if (!email) return null;
  const { data: person } = await db.from("people").select("id, company_id").eq("user_id", userId).eq("email", email).maybeSingle();
  if (person?.id && person.company_id) return person.id;

  // Company: real company name when given; otherwise group by business domain,
  // and keep free-mail contacts distinct (their own email) so each follows up.
  const domain = (email.split("@")[1] || "").toLowerCase();
  const isFree = FREEMAIL.has(domain);
  let companyName = String(r.company || "").trim();
  if (!companyName) companyName = isFree ? email : (domainToName(domain) || email);

  let companyId: string | null = null;
  const { data: existingCo } = await db.from("companies").select("id").eq("user_id", userId).eq("name", companyName).maybeSingle();
  if (existingCo?.id) companyId = existingCo.id;
  else {
    const { data: co, error } = await db.from("companies").insert({ user_id: userId, name: companyName, general_email: isFree ? email : null }).select("id").single();
    if (co?.id) companyId = co.id;
    else if (error) {
      const { data: retry } = await db.from("companies").select("id").eq("user_id", userId).eq("name", companyName).maybeSingle();
      companyId = retry?.id ?? null;
    }
  }
  if (!companyId) return person?.id ?? null;

  if (person?.id) { await db.from("people").update({ company_id: companyId }).eq("id", person.id); return person.id; }
  const first = String(r.first_name || (r.name ? String(r.name).split(" ")[0] : "") || "Contact");
  const last = String(r.last_name || (r.name ? String(r.name).split(" ").slice(1).join(" ") : "") || "");
  const { data: np, error: pErr } = await db.from("people").insert({ user_id: userId, email, first_name: first, last_name: last, company_id: companyId }).select("id").single();
  if (np?.id) return np.id;
  if (pErr) {
    const { data: retry } = await db.from("people").select("id, company_id").eq("user_id", userId).eq("email", email).maybeSingle();
    if (retry?.id) { if (!retry.company_id) await db.from("people").update({ company_id: companyId }).eq("id", retry.id); return retry.id; }
  }
  return null;
}

// Turn subject/body into a short, human recipient-group name, e.g.
// "Q3 partnership outreach" → "Q3 Partnership Outreach · Jul 17".
function deriveGroupName(subject: string, bodyText: string): string {
  let base = (subject || "").replace(/\{\{[^}]+\}\}/g, "").replace(/\s+/g, " ").trim();
  if (!base) base = (bodyText || "").replace(/\{\{[^}]+\}\}/g, "").replace(/\s+/g, " ").trim().split(/[.!?\n]/)[0] || "";
  if (base.length > 48) base = base.slice(0, 45).trim() + "…";
  if (!base) base = "Campaign recipients";
  const date = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "Europe/London" });
  return `${base} · ${date}`;
}

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

    if (action === "list_groups") {
      const { data: groups } = await db.from("recipient_groups")
        .select("id, name, description, created_at").eq("user_id", userId).order("created_at", { ascending: false });
      // Attach member counts
      const ids = (groups || []).map((g: any) => g.id);
      const counts: Record<string, number> = {};
      if (ids.length) {
        const { data: members } = await db.from("recipient_group_members").select("group_id").in("group_id", ids).limit(100000);
        for (const m of members || []) counts[m.group_id] = (counts[m.group_id] || 0) + 1;
      }
      return json({ groups: (groups || []).map((g: any) => ({ id: g.id, name: g.name, description: g.description, members: counts[g.id] || 0 })) });
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
      const hasGroups = Array.isArray(body.group_ids || body.groupIds) && (body.group_ids || body.groupIds).length > 0;
      if (recipientsIn.length === 0 && !hasGroups) return json({ error: "Provide 'recipients' (array) and/or 'group_ids'" }, 400);

      // Optionally pull recipients from saved recipient groups (so daily automation
      // can just reference a group id instead of hardcoding a list each day).
      const groupIds: string[] = Array.isArray(body.group_ids || body.groupIds)
        ? (body.group_ids || body.groupIds).map((g: any) => String(g)).filter(Boolean) : [];
      const fromGroups: any[] = [];
      if (groupIds.length) {
        // Scope to the caller's own groups
        const { data: ownGroups } = await db.from("recipient_groups").select("id").eq("user_id", userId).in("id", groupIds);
        const allowed = new Set((ownGroups || []).map((g: any) => g.id));
        const scoped = groupIds.filter((g) => allowed.has(g));
        if (scoped.length) {
          const { data: members } = await db.from("recipient_group_members")
            .select("email, first_name, last_name, company").in("group_id", scoped);
          for (const m of members || []) fromGroups.push(m);
        }
      }

      // Dedupe + validate recipients (explicit array + any group members)
      const seen = new Set<string>();
      const recips = [];
      for (const r of [...recipientsIn, ...fromGroups]) {
        const email = String(r?.email || "").trim().toLowerCase();
        if (!EMAIL_RE.test(email) || seen.has(email)) continue;
        seen.add(email);
        recips.push({ email, first_name: r.first_name || r.firstName || "", last_name: r.last_name || r.lastName || "", company: r.company || "", name: r.name || "" });
      }
      if (recips.length === 0) return json({ error: "No valid recipient emails (provide 'recipients' and/or 'group_ids')" }, 400);

      const scheduledAt = body.schedule_at || body.scheduleAt ? toUtcIso(String(body.schedule_at || body.scheduleAt), body.timezone || "Europe/London") : null;
      const status = scheduledAt ? "scheduled" : "draft";

      // Link recipients to CRM people + companies (default on) so the scheduled
      // send auto-enrols them into the no-reply follow-up. Best-effort per recipient.
      const linkPeople = body.link_people !== false && body.linkPeople !== false;
      let linkedCount = 0;
      if (linkPeople) {
        const ids = await mapPool(recips, 8, (r) => ensurePersonCompany(db, userId, r).catch(() => null));
        recips.forEach((r, i) => { (r as any).person_id = ids[i] || null; if (ids[i]) linkedCount++; });
      }

      // Enable the Day 1/3/5 no-reply follow-up (default on) so cold sends chase non-repliers.
      const wantFollowUp = body.follow_up !== false && body.followUp !== false;
      const followUpSeqId = wantFollowUp ? await ensureNoReplySequence(db, userId) : null;

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
        auto_follow_up_enabled: !!followUpSeqId,
        follow_up_sequence_id: followUpSeqId,
      }).select("id").single();
      if (campErr || !campaign) return json({ error: campErr?.message || "Failed to create campaign" }, 500);

      const rows = recips.map((r) => {
        const nm = [r.first_name, r.last_name].filter(Boolean).join(" ") || r.name || r.email;
        return {
          campaign_id: campaign.id,
          email: r.email,
          name: nm,
          person_id: (r as any).person_id || null,
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

      // Save an explicit recipient list as a reusable, named group (Claude passes a
      // group_name derived from the email's context; otherwise derive one from the
      // subject). Skipped when recipients came purely from existing group_ids.
      let createdGroup: { id: string; name: string; members: number } | null = null;
      if (recipientsIn.length > 0) {
        const groupName = String(body.group_name || body.groupName || "").trim() || deriveGroupName(subject, bodyText);
        const { data: grp } = await db.from("recipient_groups").insert({
          user_id: userId, name: groupName,
          description: `Auto-created from API campaign "${name}".`,
        }).select("id, name").single();
        if (grp?.id) {
          const members = recips.map((r) => ({
            group_id: grp.id, email: r.email,
            first_name: r.first_name || null, last_name: r.last_name || null,
            company: r.company || null, person_id: (r as any).person_id || null,
          }));
          for (let i = 0; i < members.length; i += 500) {
            await db.from("recipient_group_members").insert(members.slice(i, i + 500));
          }
          createdGroup = { id: grp.id, name: grp.name, members: members.length };
        }
      }

      const followUpMsg = followUpSeqId ? " No-reply follow-up (Day 1/3/5) is enabled." : "";
      return json({
        campaign_id: campaign.id,
        status,
        scheduled_at: scheduledAt,
        recipients: rows.length,
        linked_people: linkedCount,
        follow_up_enabled: !!followUpSeqId,
        group: createdGroup,
        message: (scheduledAt
          ? `Campaign scheduled — it will send automatically at ${scheduledAt} (UTC).`
          : "Campaign created as a draft. Provide schedule_at to have it sent automatically.") + followUpMsg,
      });
    }

    if (action === "create_newsletter") {
      const subject = String(body.subject || "").trim();
      const title = String(body.title || body.name || subject || "Newsletter").trim();
      const bodyHtml = String(body.body_html || body.bodyHtml || "").trim();
      const bodyText = String(body.body_text || body.bodyText || "").trim();
      if (!subject) return json({ error: "subject is required" }, 400);
      if (!bodyHtml && !bodyText) return json({ error: "body_html or body_text is required" }, 400);
      const finalHtml = bodyHtml || `<p>${bodyText.replace(/\n/g, "</p><p>")}</p>`;

      // Audience → scheduled_send_options (read by send-newsletter on the scheduled cron)
      const aud = body.audience || {};
      const groupIds = aud.group_ids || aud.groupIds;
      const tagIds = aud.tag_ids || aud.tagIds;
      const opts: Record<string, unknown> = {};
      if (Array.isArray(groupIds) && groupIds.length) opts.recipientGroupIds = groupIds;
      if (Array.isArray(tagIds) && tagIds.length) opts.tagCategoryIds = tagIds;
      // Default to all active subscribers when no explicit audience is given.
      if (!opts.recipientGroupIds && !opts.tagCategoryIds) opts.sendToAllActive = true;
      else if (aud.all_active || aud.allActive) opts.sendToAllActive = true;

      const scheduledAt = (body.schedule_at || body.scheduleAt) ? toUtcIso(String(body.schedule_at || body.scheduleAt), body.timezone || "Europe/London") : null;
      const status = scheduledAt ? "scheduled" : "draft";
      const { data: nl, error } = await db.from("newsletters").insert({
        user_id: userId, title, subject, body_html: finalHtml,
        status, scheduled_at: scheduledAt,
        scheduled_send_options: Object.keys(opts).length ? opts : null,
      }).select("id").single();
      if (error || !nl) return json({ error: error?.message || "Failed to create newsletter" }, 500);
      return json({
        newsletter_id: nl.id, status, scheduled_at: scheduledAt, audience: opts,
        message: scheduledAt
          ? `Newsletter scheduled — sends automatically at ${scheduledAt} (UTC) to ${opts.sendToAllActive ? "all active subscribers" : "the selected audience"}.`
          : "Newsletter draft created. Provide schedule_at to send automatically.",
      });
    }

    if (action === "send_test") {
      const toEmail = String(body.to_email || body.toEmail || "").trim().toLowerCase();
      const subject = String(body.subject || "").trim();
      const bodyHtml = String(body.body_html || body.bodyHtml || "").trim();
      const bodyText = String(body.body_text || body.bodyText || "").trim();
      if (!EMAIL_RE.test(toEmail)) return json({ error: "A valid to_email is required" }, 400);
      if (!subject || (!bodyHtml && !bodyText)) return json({ error: "subject and body_text/body_html are required" }, 400);

      const { data: conns } = await db.from("crm_connections")
        .select("provider, from_email").eq("user_id", userId).eq("status", "active").in("provider", ["resend", "sendgrid"]);
      const conn = (conns || []).find((c: any) => c.provider === "resend") || (conns || [])[0];
      if (!conn?.from_email) return json({ error: "No active Resend/SendGrid sender with a from address. Connect one in Settings → Email Providers." }, 400);
      const finalHtml = bodyHtml || `<p>${bodyText.replace(/\n/g, "</p><p>")}</p>`;

      if (conn.provider === "resend") {
        const r = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${Deno.env.get("RESEND_API_KEY")}`, "Content-Type": "application/json" },
          body: JSON.stringify({ from: conn.from_email, to: [toEmail], subject: `[TEST] ${subject}`, html: finalHtml, text: bodyText || undefined }),
        });
        const t = await r.text();
        if (!r.ok) { let d: any; try { d = JSON.parse(t); } catch { d = {}; } return json({ error: `Resend rejected the test: ${d?.message || d?.error || t}` }, 400); }
        return json({ ok: true, sent_to: toEmail, provider: "resend", from: conn.from_email, message: `Test email sent to ${toEmail}.` });
      }
      const r = await fetch("https://api.sendgrid.com/v3/mail/send", {
        method: "POST",
        headers: { Authorization: `Bearer ${Deno.env.get("SENDGRID_API_KEY")}`, "Content-Type": "application/json" },
        body: JSON.stringify({ personalizations: [{ to: [{ email: toEmail }], subject: `[TEST] ${subject}` }], from: { email: conn.from_email }, content: [{ type: "text/html", value: finalHtml }] }),
      });
      if (!r.ok) { const t = await r.text(); return json({ error: `SendGrid rejected the test: ${t}` }, 400); }
      return json({ ok: true, sent_to: toEmail, provider: "sendgrid", from: conn.from_email, message: `Test email sent to ${toEmail}.` });
    }

    return json({ error: "Unknown action. Use create | create_newsletter | send_test | list | status." }, 400);
  } catch (e: any) {
    return json({ error: e?.message || "Failed" }, 500);
  }
});

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
