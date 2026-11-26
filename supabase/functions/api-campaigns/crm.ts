import { ensurePersonCompany, parseSteps } from "../_shared/followup.ts";
import { greetingFirstName, isPlaceholderName } from "../_shared/email-quality.ts";
import { fetchAllRows } from "../_shared/fetch-all.ts";
import { sendOneSms, activePhoneConnection, isOptedOut, senderNumberOf, logSms, nameForNumber, normalizePhone as normalizeE164 } from "../_shared/sms-send.ts";

// CRM actions for the public API (api-campaigns). Each action is scoped to the
// authenticated user's rows. Returns null when the action isn't one of ours so
// the caller can fall through to its own handlers / "unknown action".

const EMAIL_RE = /^[^\s@,]+@[^\s@,]+\.[^\s@,]+$/;

function json(obj: unknown, status = 200): Response {
  return new Response(JSON.stringify(obj), {
    status,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key",
      "Content-Type": "application/json",
    },
  });
}

const str = (v: unknown): string => (v == null ? "" : String(v)).trim();
const opt = (v: unknown): string | null => { const s = str(v); return s ? s : null; };
const lim = (v: unknown, d = 50, max = 500): number => Math.min(max, Math.max(1, parseInt(String(v || d), 10) || d));
const digits = (p: unknown): string => str(p).replace(/\D/g, "");

// London wall-clock "YYYY-MM-DDTHH:mm" → UTC ISO. Full ISO with zone passes through.
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

// Email merge tags: {{firstName}} {{lastName}} {{fullName}} {{name}} {{company}} {{email}}
function personalize(tpl: string, r: any): string {
  if (!tpl) return "";
  const full = [r.first_name, r.last_name].filter(Boolean).join(" ") || r.name || r.email || "";
  return tpl
    .replace(/\{\{\s*firstName\s*\}\}/gi, greetingFirstName(r.first_name || full, { company: r.company, email: r.email }))
    .replace(/\{\{\s*lastName\s*\}\}/gi, r.last_name || full.split(" ").slice(1).join(" ") || "")
    .replace(/\{\{\s*fullName\s*\}\}/gi, full)
    .replace(/\{\{\s*name\s*\}\}/gi, full)
    .replace(/\{\{\s*company\s*\}\}/gi, r.company || "")
    .replace(/\{\{\s*email\s*\}\}/gi, r.email || "");
}

// SMS merge tags — same rules as src/lib/smsMerge.ts and send-bulk-sms.
const PLACEHOLDER_NAMES = new Set(["manual entry", "contact", "group member"]);
function fillSmsTags(template: string, vars: { name?: string | null; phone?: string | null }): string {
  if (!template) return "";
  let full = (vars.name || "").trim();
  if (PLACEHOLDER_NAMES.has(full.toLowerCase())) full = "";
  const parts = full.split(/\s+/).filter(Boolean);
  const first = parts[0] || "";
  const last = parts.slice(1).join(" ");
  const values: Record<string, string> = {
    name: full || "there", fullname: full || "there", contactname: full || "there",
    firstname: first || "there", first: first || "there",
    lastname: last, last, surname: last,
    company: full, companyname: full, business: full, businessname: full,
    phone: vars.phone || "", mobile: vars.phone || "", email: "",
  };
  return template.replace(/\{\{?\s*([A-Za-z][A-Za-z _-]{0,30}?)\s*\}?\}/g, (m, key: string) => {
    const k = key.toLowerCase().replace(/[\s_-]/g, "");
    return k in values ? values[k] : m;
  });
}

function normalizePhone(raw: unknown): string | null {
  let p = str(raw);
  if (!p) return null;
  const hasPlus = p.startsWith("+");
  const d = p.replace(/\D/g, "");
  if (d.length < 7) return null;
  if (hasPlus) return `+${d}`;
  if (d.startsWith("00")) return `+${d.slice(2)}`;
  if (d.startsWith("0")) return `+44${d.replace(/^0+/, "")}`; // default UK
  return `+${d}`;
}

function isUkLandline(e164: string): boolean {
  return /^\+44[123]/.test(e164);
}

async function companyIdByName(db: any, userId: string, name: string, create: boolean): Promise<string | null> {
  const n = str(name);
  if (!n) return null;
  const { data } = await db.from("companies").select("id").eq("user_id", userId).ilike("name", n).limit(1).maybeSingle();
  if (data?.id) return data.id;
  if (!create) return null;
  const { data: co } = await db.from("companies").insert({ user_id: userId, name: n }).select("id").single();
  return co?.id ?? null;
}

async function ownGroup(db: any, userId: string, body: any): Promise<{ id: string; name: string; channel: string | null } | null> {
  const id = str(body.group_id || body.groupId);
  const name = str(body.group_name || body.groupName || body.group);
  let q = db.from("recipient_groups").select("id, name, channel").eq("user_id", userId);
  q = id ? q.eq("id", id) : q.ilike("name", name);
  const { data } = await q.limit(1).maybeSingle();
  return data || null;
}

async function callFunction(name: string, payload: Record<string, unknown>): Promise<{ ok: boolean; status: number; data: any }> {
  const url = `${Deno.env.get("SUPABASE_URL")}/functions/v1/${name}`;
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const r = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, apikey: key, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const t = await r.text();
  let data: any; try { data = JSON.parse(t); } catch { data = { raw: t }; }
  return { ok: r.ok, status: r.status, data };
}

import { handleLeadAction, LEAD_ACTIONS } from "./leads.ts";

/** Tag records the assistant/API creates with where they came from (via-claude, via-chatgpt, via-api…). */
export const sourceTag = (body: any): string | null => { const v = String(body?.__source || "").toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 40); return v ? (v.startsWith("via-") ? v : `via-${v}`) : null; };
export const withSource = (tags: unknown, body: any): string[] | undefined => { const t = sourceTag(body); const base = Array.isArray(tags) ? tags.map(String).filter(Boolean) : []; if (!t) return Array.isArray(tags) ? base : undefined; return Array.from(new Set([...base, t])); };

const isPhoneCampaign = (c: any) => (Array.isArray(c?.tags) && c.tags.includes("phone_sms")) || String(c?.name || "").startsWith("📞");

export const CRM_ACTIONS = [
  "get_business_profile", "list_senders",
  "search_contacts", "get_contact", "upsert_contact", "update_contact",
  "search_companies", "get_company", "upsert_company", "update_company",
  "get_group", "add_to_group", "remove_from_group", "delete_group",
  "get_campaign", "update_campaign", "send_campaign", "unschedule_campaign", "create_phone_campaign",
  "list_newsletters", "send_newsletter", "list_subscribers", "add_subscribers",
  "list_deals", "create_deal", "update_deal",
  "list_sequences", "get_sequence", "create_sequence", "update_sequence", "enroll_in_sequence",
  "list_enrollments", "update_enrollment", "run_sequences_now", "sequence_health", "schedule_sms_followup",
  "list_sms_conversations", "get_sms_conversation", "reply_sms", "list_sms_opt_outs",
  "list_notifications", "mark_notifications_read",
  "list_automations", "create_automation", "update_automation", "delete_automation", "run_automation", "list_automation_runs", "reschedule_automations",
  "learn_business", "update_business_profile",
  ...LEAD_ACTIONS,
];

async function ownSequence(db: any, userId: string, body: any) {
  const id = str(body.sequence_id || body.sequenceId);
  const name = str(body.sequence_name || body.sequenceName || body.sequence);
  if (!id && !name) return null;
  let q = db.from("email_sequences").select("id, name, description, steps, repeat_sequence, repeat_after_days, repeat_only_for, use_email_branding, created_at").eq("created_by", userId);
  q = id ? q.eq("id", id) : q.ilike("name", name);
  const { data } = await q.order("created_at", { ascending: false }).limit(1).maybeSingle();
  return data || null;
}

async function enrollmentCounts(db: any, sequenceIds: string[]): Promise<Record<string, Record<string, number>>> {
  const out: Record<string, Record<string, number>> = {};
  if (!sequenceIds.length) return out;
  const { data } = await db.from("company_sequences").select("sequence_id, status").in("sequence_id", sequenceIds).limit(100000);
  for (const r of data || []) { (out[r.sequence_id] ||= {})[r.status] = ((out[r.sequence_id] ||= {})[r.status] || 0) + 1; }
  return out;
}

async function sendersFor(db: any, userId: string) {
  const { data } = await db.from("crm_connections").select("id").eq("user_id", userId).eq("status", "active").in("provider", ["twilio", "vonage", "messagebird", "plivo"]).limit(1).maybeSingle();
  return data;
}

export async function handleCrmAction(db: any, userId: string, action: string, body: any): Promise<Response | null> {
  switch (action) {
    // ───────────────────────── profile / senders ─────────────────────────
    case "get_business_profile": {
      const { data } = await db.from("business_profiles").select(
        "company_name, industry, website, phone, services_description, target_audience, value_proposition, tone_preference, " +
        "email_brand_color, email_logo_url, email_header_name, email_footer_text, email_footer_logo_url, email_signature, " +
        "email_sender_name, email_sender_title, email_sender_email, email_sender_phone, email_template_style, email_provider, knowledge_base, website_learned_at, learned_from_url",
      ).eq("user_id", userId).maybeSingle();
      return json({ profile: data || null, note: data ? undefined : "No business profile yet — fill it in under Business Profile in the app." });
    }
    case "list_senders": {
      const { data } = await db.from("crm_connections")
        .select("id, provider, from_email, sending_method, status, verified_at, metadata, created_at")
        .eq("user_id", userId).order("created_at", { ascending: false });
      const isPhone = (c: any) => ["twilio", "vonage", "messagebird", "plivo"].includes(c.provider);
      const email = (data || []).filter((c: any) => !isPhone(c)).map((c: any) => ({ id: c.id, provider: c.provider, from_email: c.from_email, sending_method: c.sending_method, status: c.status, verified: !!c.verified_at }));
      const phone = (data || []).filter(isPhone).map((c: any) => ({ id: c.id, provider: c.provider, from_number: c.metadata?.phone_number || c.metadata?.from_number || null, status: c.status }));
      return json({ email_senders: email, phone_services: phone });
    }

    // ───────────────────────── contacts (people) ─────────────────────────
    case "search_contacts": {
      const q = str(body.query || body.q);
      const limit = lim(body.limit, 50, 500);
      let sel = db.from("people").select("id, first_name, last_name, email, phone, title, tags, location, linkedin_url, created_at, companies(name)")
        .eq("user_id", userId).order("created_at", { ascending: false }).limit(limit);
      if (q) sel = sel.or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%,email.ilike.%${q}%,title.ilike.%${q}%`);
      const tag = str(body.tag);
      if (tag) sel = sel.contains("tags", [tag]);
      const companyName = str(body.company);
      const { data, error } = await sel;
      if (error) return json({ error: error.message }, 500);
      let rows = (data || []).map((p: any) => ({ ...p, company: p.companies?.name || null, companies: undefined }));
      if (companyName) rows = rows.filter((p: any) => (p.company || "").toLowerCase().includes(companyName.toLowerCase()));
      return json({ contacts: rows, count: rows.length });
    }
    case "get_contact": {
      const id = str(body.contact_id || body.id);
      const email = str(body.email).toLowerCase();
      if (!id && !email) return json({ error: "contact_id or email required" }, 400);
      let q = db.from("people").select("*, companies(id, name, website, industry, company_phone)").eq("user_id", userId);
      q = id ? q.eq("id", id) : q.eq("email", email);
      const { data } = await q.maybeSingle();
      if (!data) return json({ error: "Contact not found" }, 404);
      return json({ contact: data });
    }
    case "upsert_contact": {
      const email = str(body.email).toLowerCase();
      if (!EMAIL_RE.test(email)) return json({ error: "A valid email is required" }, 400);
      const fields: Record<string, unknown> = {};
      for (const k of ["first_name", "last_name", "phone", "title", "location", "linkedin_url", "twitter_url", "bio"]) {
        if (body[k] != null) fields[k] = opt(body[k]);
      }
      if (Array.isArray(body.tags)) fields.tags = body.tags.map(str).filter(Boolean);
      if (body.company != null) fields.company_id = await companyIdByName(db, userId, body.company, true);
      const { data: existing } = await db.from("people").select("id, tags").eq("user_id", userId).eq("email", email).maybeSingle();
      if (existing?.id) {
        if (Array.isArray(body.add_tags)) fields.tags = Array.from(new Set([...(existing.tags || []), ...body.add_tags.map(str)])).filter(Boolean);
        if (sourceTag(body)) fields.tags = withSource(fields.tags ?? existing.tags, body);
        const { data, error } = await db.from("people").update(fields).eq("id", existing.id).select("id, first_name, last_name, email, phone, title, tags, company_id").single();
        if (error) return json({ error: error.message }, 500);
        return json({ contact: data, created: false });
      }
      if (Array.isArray(body.add_tags)) fields.tags = body.add_tags.map(str).filter(Boolean);
      if (fields.first_name && isPlaceholderName(fields.first_name)) fields.first_name = null;
      if (!fields.first_name && !isPlaceholderName(email.split("@")[0])) fields.first_name = email.split("@")[0];
      if (sourceTag(body)) fields.tags = withSource(fields.tags, body);
      const { data, error } = await db.from("people").insert({ user_id: userId, email, ...fields }).select("id, first_name, last_name, email, phone, title, tags, company_id").single();
      if (error) return json({ error: error.message }, 500);
      return json({ contact: data, created: true });
    }
    case "update_contact": {
      const id = str(body.contact_id || body.id);
      if (!id) return json({ error: "contact_id required" }, 400);
      const fields: Record<string, unknown> = {};
      for (const k of ["first_name", "last_name", "phone", "title", "location", "linkedin_url", "twitter_url", "bio"]) {
        if (body[k] != null) fields[k] = opt(body[k]);
      }
      if (body.email != null) { const e = str(body.email).toLowerCase(); if (!EMAIL_RE.test(e)) return json({ error: "Invalid email" }, 400); fields.email = e; }
      if (Array.isArray(body.tags)) fields.tags = body.tags.map(str).filter(Boolean);
      if (body.company != null) fields.company_id = await companyIdByName(db, userId, body.company, true);
      if (!Object.keys(fields).length) return json({ error: "Nothing to update" }, 400);
      const { data, error } = await db.from("people").update(fields).eq("id", id).eq("user_id", userId).select("id, first_name, last_name, email, phone, title, tags, company_id").maybeSingle();
      if (error) return json({ error: error.message }, 500);
      if (!data) return json({ error: "Contact not found" }, 404);
      return json({ contact: data });
    }

    // ───────────────────────── companies ─────────────────────────
    case "search_companies": {
      const q = str(body.query || body.q);
      const limit = lim(body.limit, 50, 500);
      let sel = db.from("companies").select("id, name, website, industry, company_phone, general_email, status, temperature, tags, headquarters, size, created_at")
        .eq("user_id", userId).order("created_at", { ascending: false }).limit(limit);
      if (q) sel = sel.or(`name.ilike.%${q}%,website.ilike.%${q}%,industry.ilike.%${q}%,general_email.ilike.%${q}%`);
      if (str(body.status)) sel = sel.eq("status", str(body.status).toUpperCase());
      const { data, error } = await sel;
      if (error) return json({ error: error.message }, 500);
      return json({ companies: data || [], count: (data || []).length });
    }
    case "get_company": {
      const id = str(body.company_id || body.id);
      const name = str(body.name);
      if (!id && !name) return json({ error: "company_id or name required" }, 400);
      let q = db.from("companies").select("id, name, website, industry, company_phone, general_email, description, headquarters, size, status, temperature, tags, linkedin_url, created_at").eq("user_id", userId);
      q = id ? q.eq("id", id) : q.ilike("name", name);
      const { data: company } = await q.limit(1).maybeSingle();
      if (!company) return json({ error: "Company not found" }, 404);
      const { data: people } = await db.from("people").select("id, first_name, last_name, email, phone, title").eq("company_id", company.id).limit(50);
      const { data: deals } = await db.from("deals").select("id, title, stage, amount").eq("company_id", company.id).limit(20);
      return json({ company, contacts: people || [], deals: deals || [] });
    }
    case "upsert_company": {
      const name = str(body.name);
      if (!name) return json({ error: "name is required" }, 400);
      const fields: Record<string, unknown> = {};
      for (const k of ["website", "industry", "company_phone", "general_email", "description", "headquarters", "size", "linkedin_url"]) {
        if (body[k] != null) fields[k] = opt(body[k]);
      }
      if (body.status != null) fields.status = str(body.status).toUpperCase();
      if (body.temperature != null) fields.temperature = str(body.temperature).toLowerCase();
      if (Array.isArray(body.tags)) fields.tags = body.tags.map(str).filter(Boolean);
      const { data: existing } = await db.from("companies").select("id").eq("user_id", userId).ilike("name", name).limit(1).maybeSingle();
      if (existing?.id) {
        const { data, error } = await db.from("companies").update(fields).eq("id", existing.id).select("id, name, website, industry, company_phone, general_email, status, tags").single();
        if (error) return json({ error: error.message }, 500);
        return json({ company: data, created: false });
      }
      if (sourceTag(body)) fields.tags = withSource(fields.tags, body);
      const { data, error } = await db.from("companies").insert({ user_id: userId, name, ...fields }).select("id, name, website, industry, company_phone, general_email, status, tags").single();
      if (error) return json({ error: error.message }, 500);
      return json({ company: data, created: true });
    }
    case "update_company": {
      const id = str(body.company_id || body.id);
      if (!id) return json({ error: "company_id required" }, 400);
      const fields: Record<string, unknown> = {};
      for (const k of ["name", "website", "industry", "company_phone", "general_email", "description", "headquarters", "size", "linkedin_url"]) {
        if (body[k] != null) fields[k] = opt(body[k]);
      }
      if (body.status != null) fields.status = str(body.status).toUpperCase();
      if (body.temperature != null) fields.temperature = str(body.temperature).toLowerCase();
      if (Array.isArray(body.tags)) fields.tags = body.tags.map(str).filter(Boolean);
      if (!Object.keys(fields).length) return json({ error: "Nothing to update" }, 400);
      const { data, error } = await db.from("companies").update(fields).eq("id", id).eq("user_id", userId).select("id, name, website, industry, company_phone, general_email, status, tags").maybeSingle();
      if (error) return json({ error: error.message }, 500);
      if (!data) return json({ error: "Company not found" }, 404);
      return json({ company: data });
    }

    // ───────────────────────── groups ─────────────────────────
    case "get_group": {
      const g = await ownGroup(db, userId, body);
      if (!g) return json({ error: "Group not found" }, 404);
      const limit = lim(body.limit, 200, 1000);
      const offset = Math.max(0, parseInt(String(body.offset || 0), 10) || 0);
      const { data, count } = await db.from("recipient_group_members")
        .select("id, email, phone, first_name, last_name, company, person_id", { count: "exact" })
        .eq("group_id", g.id).order("created_at", { ascending: true }).range(offset, offset + limit - 1);
      return json({ group: g, total_members: count ?? (data || []).length, members: data || [], offset, limit });
    }
    case "add_to_group": {
      let g = await ownGroup(db, userId, body);
      const wantName = str(body.group_name || body.groupName || body.group);
      if (!g && wantName && body.create_if_missing !== false) {
        const { data: ng, error } = await db.from("recipient_groups").insert({ user_id: userId, name: wantName, description: opt(body.description) }).select("id, name, channel").single();
        if (error) return json({ error: error.message }, 500);
        g = ng;
      }
      if (!g) return json({ error: "Group not found (pass group_id, or group_name to create it)" }, 404);

      const incoming: any[] = Array.isArray(body.recipients) ? [...body.recipients] : Array.isArray(body.members) ? [...body.members] : [];
      const contactIds: string[] = Array.isArray(body.contact_ids) ? body.contact_ids.map(str).filter(Boolean) : [];
      if (contactIds.length) {
        const { data: ppl } = await db.from("people").select("id, email, phone, first_name, last_name, companies(name)").eq("user_id", userId).in("id", contactIds);
        for (const p of ppl || []) incoming.push({ email: p.email, phone: p.phone, first_name: p.first_name, last_name: p.last_name, company: p.companies?.name, person_id: p.id });
      }
      const companyIds: string[] = Array.isArray(body.company_ids) ? body.company_ids.map(str).filter(Boolean) : [];
      if (companyIds.length) {
        const { data: cos } = await db.from("companies").select("id, name, general_email, company_phone").eq("user_id", userId).in("id", companyIds);
        for (const c of cos || []) incoming.push({ email: c.general_email, phone: c.company_phone, first_name: c.name, company: c.name });
      }
      if (!incoming.length) return json({ error: "Provide recipients[], contact_ids[] or company_ids[]" }, 400);

      const existing = await fetchAllRows(() => db.from("recipient_group_members").select("email, phone").eq("group_id", g.id).order("id"));
      const seenE = new Set((existing || []).map((m: any) => (m.email || "").toLowerCase()).filter(Boolean));
      const seenP = new Set((existing || []).map((m: any) => digits(m.phone)).filter(Boolean));
      const rows: any[] = []; let skipped = 0; let hasEmail = false; let hasPhone = false;
      for (const r of incoming) {
        const email = str(r?.email).toLowerCase();
        const phone = normalizePhone(r?.phone);
        const validEmail = EMAIL_RE.test(email);
        if (!validEmail && !phone) { skipped++; continue; }
        if ((validEmail && seenE.has(email)) || (phone && seenP.has(digits(phone)))) { skipped++; continue; }
        if (validEmail) { seenE.add(email); hasEmail = true; }
        if (phone) { seenP.add(digits(phone)); hasPhone = true; }
        rows.push({
          group_id: g.id,
          email: validEmail ? email : (phone ? `phone:${phone}` : null),
          phone: phone || null,
          first_name: opt(r.first_name || r.firstName || (r.name ? String(r.name).split(" ")[0] : "")),
          last_name: opt(r.last_name || r.lastName || (r.name ? String(r.name).split(" ").slice(1).join(" ") : "")),
          company: opt(r.company),
          person_id: r.person_id || null,
        });
      }
      for (let i = 0; i < rows.length; i += 500) {
        const { error } = await db.from("recipient_group_members").insert(rows.slice(i, i + 500));
        if (error) return json({ error: error.message, added: i }, 500);
      }
      // Keep the group's channel honest so the phone/email pickers list it.
      const prev = g.channel || "email";
      const next = hasPhone && (hasEmail || prev === "email" || prev === "mixed") ? "mixed" : hasPhone ? (prev === "phone" ? "phone" : "mixed") : prev;
      if (next !== g.channel) await db.from("recipient_groups").update({ channel: next }).eq("id", g.id);
      const { count } = await db.from("recipient_group_members").select("id", { count: "exact", head: true }).eq("group_id", g.id);
      return json({ group_id: g.id, name: g.name, added: rows.length, skipped_duplicates_or_invalid: skipped, total_members: count ?? null });
    }
    case "remove_from_group": {
      const g = await ownGroup(db, userId, body);
      if (!g) return json({ error: "Group not found" }, 404);
      const emails = (Array.isArray(body.emails) ? body.emails : []).map((e: unknown) => str(e).toLowerCase()).filter(Boolean);
      const phones = (Array.isArray(body.phones) ? body.phones : []).map(normalizePhone).filter(Boolean) as string[];
      if (!emails.length && !phones.length) return json({ error: "emails[] or phones[] required" }, 400);
      let removed = 0;
      if (emails.length) { const { count } = await db.from("recipient_group_members").delete({ count: "exact" }).eq("group_id", g.id).in("email", emails); removed += count || 0; }
      if (phones.length) { const { count } = await db.from("recipient_group_members").delete({ count: "exact" }).eq("group_id", g.id).in("phone", phones); removed += count || 0; }
      return json({ group_id: g.id, removed });
    }

    case "delete_group": {
      const g = await ownGroup(db, userId, body);
      if (!g) return json({ error: "Group not found" }, 404);
      const { count } = await db.from("recipient_group_members").select("id", { count: "exact", head: true }).eq("group_id", g.id);
      if ((count || 0) > 0 && body.confirm !== true) {
        return json({ error: `"${g.name}" has ${count} member(s). Pass confirm:true to delete the group and its member list (campaigns already created from it are unaffected).`, group_id: g.id, members: count }, 409);
      }
      await db.from("recipient_group_members").delete().eq("group_id", g.id);
      const { error } = await db.from("recipient_groups").delete().eq("id", g.id).eq("user_id", userId);
      if (error) return json({ error: error.message }, 500);
      return json({ deleted: true, group_id: g.id, name: g.name, members_removed: count || 0 });
    }

    // ───────────────────────── campaigns ─────────────────────────
    case "get_campaign": {
      const id = str(body.campaign_id);
      if (!id) return json({ error: "campaign_id required" }, 400);
      const { data: c } = await db.from("email_campaigns")
        .select("id, name, status, subject_template, body_html_template, body_text_template, tags, sent_count, failed_count, opened_count, total_recipients, scheduled_at, started_at, completed_at, created_at, auto_follow_up_enabled")
        .eq("id", id).eq("user_id", userId).maybeSingle();
      if (!c) return json({ error: "Campaign not found" }, 404);
      const counts: Record<string, number> = {};
      for (const s of ["pending", "sent", "failed", "bounced", "opened", "replied", "skipped"]) {
        const { count } = await db.from("email_campaign_recipients").select("id", { count: "exact", head: true }).eq("campaign_id", id).eq("status", s);
        if (count) counts[s] = count;
      }
      const { data: failed } = await db.from("email_campaign_recipients").select("email, name, error_message").eq("campaign_id", id).eq("status", "failed").limit(10);
      const includeBody = body.include_body === true;
      if (!includeBody) { delete c.body_html_template; delete c.body_text_template; }
      return json({ campaign: { ...c, type: isPhoneCampaign(c) ? "sms" : "email" }, recipient_counts: counts, sample_failures: failed || [] });
    }
    case "update_campaign": {
      const id = str(body.campaign_id);
      if (!id) return json({ error: "campaign_id required" }, 400);
      const { data: c } = await db.from("email_campaigns").select("id, status, subject_template, body_html_template, body_text_template, tags, name").eq("id", id).eq("user_id", userId).maybeSingle();
      if (!c) return json({ error: "Campaign not found" }, 404);
      if (!["draft", "scheduled", "paused"].includes(String(c.status))) return json({ error: `Only draft, scheduled or paused campaigns can be edited (this one is ${c.status}).` }, 400);
      const sms = isPhoneCampaign(c);
      const fields: Record<string, unknown> = {};
      if (body.name != null) fields.name = sms ? `📞 ${str(body.name).replace(/^📞\s*/, "")}` : str(body.name);
      if (body.subject != null && !sms) fields.subject_template = str(body.subject);
      const newHtml = body.body_html != null ? str(body.body_html) : null;
      const newText = body.body_text != null ? str(body.body_text) : body.message != null ? str(body.message) : null;
      if (newHtml || newText) {
        const html = newHtml || `<p>${(newText || "").replace(/\n/g, "</p><p>")}</p>`;
        fields.body_html_template = html;
        fields.body_text_template = newText || html.replace(/<[^>]+>/g, " ");
      }
      if (body.schedule_at === null || body.unschedule === true) { fields.scheduled_at = null; fields.status = "draft"; }
      else if (body.schedule_at) { fields.scheduled_at = toUtcIso(str(body.schedule_at), body.timezone || "Europe/London"); fields.status = "scheduled"; }
      if (!Object.keys(fields).length) return json({ error: "Nothing to update" }, 400);
      const { error } = await db.from("email_campaigns").update(fields).eq("id", id);
      if (error) return json({ error: error.message }, 500);

      // Re-personalise pending recipients when content changed.
      let updated = 0;
      if (fields.subject_template || fields.body_html_template) {
        const subject = (fields.subject_template as string) || c.subject_template;
        const html = (fields.body_html_template as string) || c.body_html_template;
        const text = (fields.body_text_template as string) || c.body_text_template;
        for (let page = 0; ; page++) {
          const { data: rows } = await db.from("email_campaign_recipients").select("id, email, name").eq("campaign_id", id).eq("status", "pending").range(page * 500, page * 500 + 499);
          if (!rows?.length) break;
          await Promise.all(rows.map((r: any) => {
            const phone = String(r.email || "").replace(/^phone:/, "");
            const vars = { first_name: "", last_name: "", name: r.name, email: r.email, company: "" };
            const bodyText = sms ? fillSmsTags(text || "", { name: r.name, phone }) : personalize(text || "", vars);
            return db.from("email_campaign_recipients").update({
              personalized_subject: sms ? r.personalized_subject : personalize(subject, vars),
              personalized_body_html: sms ? `<p>${bodyText.replace(/\n/g, "<br>")}</p>` : personalize(html, vars),
              personalized_body_text: bodyText,
            }).eq("id", r.id);
          }));
          updated += rows.length;
          if (rows.length < 500) break;
        }
      }
      return json({ campaign_id: id, updated_fields: Object.keys(fields), pending_recipients_refreshed: updated });
    }
    case "send_campaign": {
      const id = str(body.campaign_id);
      if (!id) return json({ error: "campaign_id required" }, 400);
      const { data: c } = await db.from("email_campaigns").select("id, name, status, tags, total_recipients").eq("id", id).eq("user_id", userId).maybeSingle();
      if (!c) return json({ error: "Campaign not found" }, 404);
      if (!["draft", "scheduled", "paused", "sending"].includes(String(c.status))) return json({ error: `Campaign is ${c.status}; nothing to send.` }, 400);
      const { count: pending } = await db.from("email_campaign_recipients").select("id", { count: "exact", head: true }).eq("campaign_id", id).eq("status", "pending");
      if (!pending) return json({ error: "No pending recipients to send to." }, 400);
      // schedule_at → schedule instead of sending now (UK time unless an offset is given)
      if (body.schedule_at) {
        const when = toUtcIso(String(body.schedule_at));
        if (!when) return json({ error: "schedule_at must be an ISO date-time, e.g. 2026-11-16T10:00 (UK time)" }, 400);
        if (new Date(when).getTime() < Date.now() - 60_000) return json({ error: "schedule_at is in the past" }, 400);
        const { error } = await db.from("email_campaigns").update({ status: "scheduled", scheduled_at: when }).eq("id", id).eq("user_id", userId);
        if (error) return json({ error: error.message }, 500);
        return json({ campaign_id: id, scheduled: true, scheduled_at: when, pending, message: `"${c.name}" is scheduled for ${when} (${pending} recipients). Nothing sent yet; unschedule_campaign cancels it.` });
      }
      const fn = isPhoneCampaign(c) ? "send-bulk-sms" : "send-bulk-emails";
      const r = await callFunction(fn, { campaignId: id, triggeredByCron: true });
      if (!r.ok) return json({ error: r.data?.error || r.data?.message || `Send failed (${r.status})`, details: r.data }, 502);
      return json({ campaign_id: id, started: true, pending_before: pending, result: r.data, message: `Sending "${c.name}" to ${pending} pending recipient(s). Use get_campaign to track progress.` });
    }
    case "unschedule_campaign": {
      const id = str(body.campaign_id);
      if (!id) return json({ error: "campaign_id required" }, 400);
      const { data, error } = await db.from("email_campaigns").update({ status: "draft", scheduled_at: null }).eq("id", id).eq("user_id", userId).in("status", ["scheduled", "paused"]).select("id, name").maybeSingle();
      if (error) return json({ error: error.message }, 500);
      if (!data) return json({ error: "Campaign not found or not scheduled/paused" }, 404);
      return json({ campaign_id: id, status: "draft", message: `"${data.name}" is back to a draft and will not send.` });
    }
    case "create_phone_campaign": {
      const name = str(body.name);
      const message = str(body.message || body.body_text);
      if (!name) return json({ error: "name is required" }, 400);
      const incoming: any[] = Array.isArray(body.recipients) ? [...body.recipients] : [];
      const groupIds: string[] = Array.isArray(body.group_ids) ? body.group_ids.map(str).filter(Boolean) : [];
      if (groupIds.length) {
        const { data: own } = await db.from("recipient_groups").select("id").eq("user_id", userId).in("id", groupIds);
        const ids = (own || []).map((g: any) => g.id);
        if (ids.length) {
          const { data: members } = await db.from("recipient_group_members").select("email, phone, first_name, last_name, company").in("group_id", ids).limit(100000);
          for (const m of members || []) {
            const phone = m.phone || (String(m.email || "").startsWith("phone:") ? String(m.email).slice(6) : null);
            if (phone) incoming.push({ phone, name: [m.first_name, m.last_name].filter(Boolean).join(" ") || m.company || "" });
          }
        }
      }
      if (!incoming.length) return json({ error: "Provide recipients[{phone,name?,message?}] and/or group_ids[]" }, 400);
      if (!message && incoming.some((r) => !str(r.message))) return json({ error: "message is required (or give every recipient its own message)" }, 400);

      const { data: svc } = await db.from("crm_connections").select("id").eq("user_id", userId).eq("status", "active").in("provider", ["twilio", "vonage", "messagebird", "plivo"]).limit(1).maybeSingle();
      const seen = new Set<string>(); const rows: any[] = []; let landlines = 0; let invalid = 0;
      for (const r of incoming) {
        const phone = normalizePhone(r.phone);
        if (!phone || seen.has(digits(phone))) { invalid++; continue; }
        seen.add(digits(phone));
        if (isUkLandline(phone)) landlines++;
        const rName = str(r.name || [r.first_name, r.last_name].filter(Boolean).join(" ") || r.company) || "Contact";
        const text = fillSmsTags(str(r.message) || message, { name: rName, phone });
        rows.push({ email: `phone:${phone}`, name: rName, status: "pending", personalized_subject: `Phone Campaign: ${name}`, personalized_body_text: text, personalized_body_html: `<p>${text.replace(/\n/g, "<br>")}</p>` });
      }
      if (!rows.length) return json({ error: "No valid phone numbers" }, 400);
      const perRecipientOnly = !message;
      const template = message || str(incoming.find((r) => str(r.message))?.message);
      const scheduledAt = body.schedule_at ? toUtcIso(str(body.schedule_at), body.timezone || "Europe/London") : null;
      const { data: camp, error } = await db.from("email_campaigns").insert({
        user_id: userId, name: `📞 ${name}`, subject_template: `Phone Campaign: ${name}`,
        body_text_template: template, body_html_template: `<p>${template.replace(/\n/g, "<br>")}</p>`,
        status: scheduledAt ? "scheduled" : "draft", scheduled_at: scheduledAt, total_recipients: rows.length,
        sent_count: 0, failed_count: 0, opened_count: 0, sender_connection_id: svc?.id || null,
        tags: perRecipientOnly ? ["phone_sms", "per_recipient_messages"] : ["phone_sms"],
      }).select("id").single();
      if (error || !camp) return json({ error: error?.message || "Failed to create campaign" }, 500);
      for (let i = 0; i < rows.length; i += 500) {
        const { error: rErr } = await db.from("email_campaign_recipients").insert(rows.slice(i, i + 500).map((r) => ({ ...r, campaign_id: camp.id })));
        if (rErr) { await db.from("email_campaigns").delete().eq("id", camp.id); return json({ error: rErr.message }, 500); }
      }
      let sent: any = null;
      if (body.send_now === true) {
        if (!svc) return json({ campaign_id: camp.id, status: "draft", recipients: rows.length, error: "Saved as draft: no active phone service (Twilio etc.) is connected, so it cannot send." }, 200);
        const r = await callFunction("send-bulk-sms", { campaignId: camp.id, triggeredByCron: true });
        sent = r.ok ? r.data : { error: r.data?.error || `Send failed (${r.status})` };
      }
      return json({
        campaign_id: camp.id, status: body.send_now === true && sent && !sent.error ? "sending" : (scheduledAt ? "scheduled" : "draft"),
        recipients: rows.length, skipped_invalid_or_duplicate: invalid, uk_landlines_will_be_skipped: landlines, scheduled_at: scheduledAt, send_result: sent,
        message: sent && !sent.error ? `Sending "${name}" now.` : scheduledAt ? `Scheduled for ${scheduledAt} (UTC).` : `Saved as draft. Use send_campaign to send it.`,
      });
    }

    // ───────────────────────── newsletters ─────────────────────────
    case "list_newsletters": {
      const { data } = await db.from("newsletters").select("id, title, subject, status, scheduled_at, sent_at, total_recipients, total_sent, total_opened, total_clicked, created_at")
        .eq("user_id", userId).order("created_at", { ascending: false }).limit(lim(body.limit, 50, 200));
      return json({ newsletters: data || [] });
    }
    case "send_newsletter": {
      const id = str(body.newsletter_id);
      if (!id) return json({ error: "newsletter_id required" }, 400);
      const { data: nl } = await db.from("newsletters").select("id, title, subject, body_html, status, scheduled_send_options").eq("id", id).eq("user_id", userId).maybeSingle();
      if (!nl) return json({ error: "Newsletter not found" }, 404);
      const testEmail = str(body.test_email).toLowerCase();
      if (testEmail) {
        // Preview to yourself through the newsletter sender itself (branding applied).
        return json({ error: "For a preview use send_test with the newsletter's subject and body_html; or open it in the app and click Send test." }, 400);
      }
      if (!["draft", "scheduled", "paused"].includes(String(nl.status))) return json({ error: `Newsletter is ${nl.status}; nothing to send.` }, 400);
      const audience = body.audience || {};
      const opts: Record<string, unknown> = { ...(nl.scheduled_send_options || {}) };
      if (Array.isArray(audience.group_ids) && audience.group_ids.length) { opts.recipientGroupIds = audience.group_ids; delete opts.sendToAllActive; }
      if (audience.all_active === true) { opts.sendToAllActive = true; delete opts.recipientGroupIds; }
      if (!opts.recipientGroupIds && !opts.tagCategoryIds && !opts.sendToAllActive) opts.sendToAllActive = true;
      await db.from("newsletters").update({ status: "scheduled", scheduled_at: new Date().toISOString(), scheduled_send_options: opts }).eq("id", id);
      const r = await callFunction("send-newsletter", { newsletterId: id, triggeredByCron: true });
      if (!r.ok) {
        await db.from("newsletters").update({ status: nl.status }).eq("id", id);
        return json({ error: r.data?.error || r.data?.message || `Send failed (${r.status})`, details: r.data }, 502);
      }
      return json({ newsletter_id: id, started: true, audience: opts, result: r.data, message: `Sending "${nl.title || nl.subject}" now. Large lists continue in batches automatically.` });
    }
    case "list_subscribers": {
      const q = str(body.query);
      let sel = db.from("newsletter_subscribers").select("id, email, first_name, last_name, company, status, source, created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(lim(body.limit, 100, 1000));
      sel = sel.eq("status", str(body.status) || "active");
      if (q) sel = sel.or(`email.ilike.%${q}%,first_name.ilike.%${q}%,last_name.ilike.%${q}%,company.ilike.%${q}%`);
      const { data, error } = await sel;
      if (error) return json({ error: error.message }, 500);
      const { count } = await db.from("newsletter_subscribers").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("status", "active");
      return json({ subscribers: data || [], active_total: count ?? null });
    }
    case "add_subscribers": {
      const incoming: any[] = Array.isArray(body.subscribers) ? body.subscribers : Array.isArray(body.recipients) ? body.recipients : [];
      if (!incoming.length) return json({ error: "subscribers[{email,first_name?,last_name?,company?}] required" }, 400);
      const emails = Array.from(new Set(incoming.map((r) => str(r?.email).toLowerCase()).filter((e) => EMAIL_RE.test(e))));
      const { data: existing } = await db.from("newsletter_subscribers").select("email").eq("user_id", userId).in("email", emails);
      const have = new Set((existing || []).map((e: any) => e.email.toLowerCase()));
      const rows = incoming.filter((r) => { const e = str(r?.email).toLowerCase(); return EMAIL_RE.test(e) && !have.has(e) && have.add(e); })
        .map((r) => ({ user_id: userId, email: str(r.email).toLowerCase(), first_name: opt(r.first_name), last_name: opt(r.last_name), company: opt(r.company), status: "active", source: str(body.source) || "api" }));
      for (let i = 0; i < rows.length; i += 500) {
        const { error } = await db.from("newsletter_subscribers").insert(rows.slice(i, i + 500));
        if (error) return json({ error: error.message, added: i }, 500);
      }
      return json({ added: rows.length, already_subscribed: emails.length - rows.length, invalid: incoming.length - emails.length });
    }

    // ───────────────────────── deals ─────────────────────────
    case "list_deals": {
      let sel = db.from("deals").select("id, title, stage, amount, priority, close_date, follow_up_date, tags, created_at, companies(name)").eq("user_id", userId).order("created_at", { ascending: false }).limit(lim(body.limit, 100, 500));
      if (str(body.stage)) sel = sel.eq("stage", str(body.stage).toUpperCase());
      const { data, error } = await sel;
      if (error) return json({ error: error.message }, 500);
      return json({ deals: (data || []).map((d: any) => ({ ...d, company: d.companies?.name || null, companies: undefined })), stages: ["LEAD", "QUALIFIED", "PROPOSAL", "NEGOTIATION", "WON", "LOST"] });
    }
    case "create_deal": {
      const title = str(body.title);
      if (!title) return json({ error: "title is required" }, 400);
      const companyId = str(body.company_id) || (body.company ? await companyIdByName(db, userId, body.company, true) : null);
      const { data, error } = await db.from("deals").insert({
        user_id: userId, title, company_id: companyId,
        stage: str(body.stage).toUpperCase() || "LEAD", amount: body.amount != null ? Number(body.amount) : null,
        priority: opt(body.priority), close_date: opt(body.close_date), follow_up_date: opt(body.follow_up_date), notes: opt(body.notes),
        tags: Array.isArray(body.tags) ? body.tags.map(str).filter(Boolean) : null,
      }).select("id, title, stage, amount, company_id").single();
      if (error) return json({ error: error.message }, 500);
      return json({ deal: data });
    }
    case "update_deal": {
      const id = str(body.deal_id || body.id);
      if (!id) return json({ error: "deal_id required" }, 400);
      const fields: Record<string, unknown> = {};
      if (body.title != null) fields.title = str(body.title);
      if (body.stage != null) fields.stage = str(body.stage).toUpperCase();
      if (body.amount != null) fields.amount = Number(body.amount);
      for (const k of ["priority", "close_date", "follow_up_date", "notes"]) if (body[k] != null) fields[k] = opt(body[k]);
      if (Array.isArray(body.tags)) fields.tags = body.tags.map(str).filter(Boolean);
      if (body.company != null) fields.company_id = await companyIdByName(db, userId, body.company, true);
      if (!Object.keys(fields).length) return json({ error: "Nothing to update" }, 400);
      const { data, error } = await db.from("deals").update(fields).eq("id", id).eq("user_id", userId).select("id, title, stage, amount, company_id").maybeSingle();
      if (error) return json({ error: error.message }, 500);
      if (!data) return json({ error: "Deal not found" }, 404);
      return json({ deal: data });
    }

    // ───────────────────────── sequences (follow-ups) ─────────────────────────
    case "list_sequences": {
      const { data } = await db.from("email_sequences").select("id, name, description, steps, repeat_sequence, repeat_after_days, repeat_only_for, created_at")
        .eq("created_by", userId).order("created_at", { ascending: false }).limit(lim(body.limit, 100, 500));
      const counts = await enrollmentCounts(db, (data || []).map((s: any) => s.id));
      return json({ sequences: (data || []).map((s: any) => { const steps = parseSteps(s.steps); return { id: s.id, name: s.name, description: s.description, steps: steps.length, first_subject: steps[0]?.subject || null, repeat_sequence: s.repeat_sequence, enrollments: counts[s.id] || {}, created_at: s.created_at }; }) });
    }
    case "get_sequence": {
      const seq = await ownSequence(db, userId, body);
      if (!seq) return json({ error: "Sequence not found (pass sequence_id or sequence_name)" }, 404);
      const counts = await enrollmentCounts(db, [seq.id]);
      return json({ sequence: { ...seq, steps: parseSteps(seq.steps) }, enrollments: counts[seq.id] || {} });
    }
    case "create_sequence": {
      const name = str(body.name);
      const stepsIn = Array.isArray(body.steps) ? body.steps : [];
      if (!name) return json({ error: "name is required" }, 400);
      if (!stepsIn.length) return json({ error: "steps[{subject, body, delayDays}] is required" }, 400);
      const steps = stepsIn.map((st: any, i: number) => ({ subject: str(st.subject) || `Follow-up ${i + 1}`, body: str(st.body || st.body_text), delayDays: Math.max(0, Number(st.delayDays ?? st.delay_days ?? (i === 0 ? 0 : 2)) || 0) }));
      if (steps.some((st: any) => !st.body)) return json({ error: "Every step needs a body" }, 400);
      const { data, error } = await db.from("email_sequences").insert({
        name, description: opt(body.description), steps: steps.map((st: any) => JSON.stringify(st)), created_by: userId,
        repeat_sequence: body.repeat_sequence === true, repeat_after_days: Math.max(1, Math.min(30, Number(body.repeat_after_days || 5))),
        repeat_only_for: str(body.repeat_only_for) || "no_reply", auto_respond: false, use_email_branding: body.use_email_branding !== false,
      }).select("id, name").single();
      if (error) return json({ error: error.message }, 500);
      return json({ sequence_id: data.id, name: data.name, steps: steps.length, message: `Sequence "${name}" created with ${steps.length} step(s). Use enroll_in_sequence to start people on it, or pass it as follow_up to a campaign.` });
    }
    case "update_sequence": {
      const seq = await ownSequence(db, userId, body);
      if (!seq) return json({ error: "Sequence not found" }, 404);
      const fields: Record<string, unknown> = {};
      if (body.name != null) fields.name = str(body.name);
      if (body.description != null) fields.description = opt(body.description);
      if (Array.isArray(body.steps)) {
        const steps = body.steps.map((st: any, i: number) => ({ subject: str(st.subject) || `Follow-up ${i + 1}`, body: str(st.body || st.body_text), delayDays: Math.max(0, Number(st.delayDays ?? st.delay_days ?? 2) || 0) }));
        fields.steps = steps.map((st: any) => JSON.stringify(st));
      }
      for (const k of ["repeat_sequence", "use_email_branding"]) if (typeof body[k] === "boolean") fields[k] = body[k];
      if (body.repeat_after_days != null) fields.repeat_after_days = Math.max(1, Math.min(30, Number(body.repeat_after_days) || 5));
      if (body.repeat_only_for != null) fields.repeat_only_for = str(body.repeat_only_for);
      if (!Object.keys(fields).length) return json({ error: "Nothing to update" }, 400);
      const { error } = await db.from("email_sequences").update(fields).eq("id", seq.id);
      if (error) return json({ error: error.message }, 500);
      return json({ sequence_id: seq.id, updated_fields: Object.keys(fields), note: fields.steps ? "People already enrolled keep the steps they were enrolled with; new enrolments use the new steps." : undefined });
    }
    case "enroll_in_sequence": {
      const seq = await ownSequence(db, userId, body);
      if (!seq) return json({ error: "Sequence not found (pass sequence_id or sequence_name)" }, 404);
      const steps = parseSteps(seq.steps);
      if (!steps.length) return json({ error: "Sequence has no steps" }, 400);
      const incoming: any[] = Array.isArray(body.recipients) ? [...body.recipients] : [];
      const contactIds: string[] = Array.isArray(body.contact_ids) ? body.contact_ids.map(str).filter(Boolean) : [];
      if (contactIds.length) {
        const { data: ppl } = await db.from("people").select("id, email, first_name, last_name, companies(name)").eq("user_id", userId).in("id", contactIds);
        for (const p of ppl || []) incoming.push({ email: p.email, first_name: p.first_name, last_name: p.last_name, company: p.companies?.name });
      }
      const companyIds: string[] = Array.isArray(body.company_ids) ? body.company_ids.map(str).filter(Boolean) : [];
      if (companyIds.length) {
        const { data: cos } = await db.from("companies").select("id, name, general_email").eq("user_id", userId).in("id", companyIds);
        for (const c of cos || []) incoming.push({ email: c.general_email, first_name: c.name, company: c.name });
      }
      const g = (body.group_id || body.group_name) ? await ownGroup(db, userId, body) : null;
      if (g) {
        const { data: members } = await db.from("recipient_group_members").select("email, first_name, last_name, company").eq("group_id", g.id).limit(100000);
        for (const m of members || []) incoming.push(m);
      }
      if (!incoming.length) return json({ error: "Provide recipients[], contact_ids[], company_ids[] or group_id/group_name" }, 400);

      const sendFirstNow = body.send_first_now !== false;
      const seen = new Set<string>(); const enrolled: any[] = []; let skippedInvalid = 0; let skippedAlready = 0;
      const emails = incoming.map((r) => str(r?.email).toLowerCase()).filter((e) => EMAIL_RE.test(e));
      const uniq = incoming.filter((r) => { const e = str(r?.email).toLowerCase(); if (!EMAIL_RE.test(e)) { skippedInvalid++; return false; } if (seen.has(e)) return false; seen.add(e); return true; });
      for (const r of uniq) {
        const email = str(r.email).toLowerCase();
        const vars = { first_name: r.first_name || "", last_name: r.last_name || "", name: r.name || "", company: r.company || "", email };
        const { companyId } = await ensurePersonCompany(db, userId, { email, first_name: r.first_name, last_name: r.last_name, name: r.name, company: r.company });
        if (!companyId) { skippedInvalid++; continue; }
        const { data: existing } = await db.from("company_sequences").select("id, status").eq("sequence_id", seq.id).eq("company_id", companyId).in("status", ["active", "paused"]).limit(1).maybeSingle();
        if (existing) { skippedAlready++; continue; }
        const personalized = steps.map((st, i) => ({
          stepNumber: i, subject: personalize(st.subject, vars), body: personalize(st.body, vars),
          delayDays: i === 0 ? 0 : st.delayDays,
          ...(st.automation_rule ? { automation_rule: st.automation_rule } : {}),
        }));
        const { data: cs, error } = await db.from("company_sequences").insert({
          company_id: companyId, sequence_id: seq.id, current_step: 0, personalized_emails: personalized, status: "active",
          automation_rules: { enabled: true, rules: [] },
          metadata: { enrolled_via: "api", recipient_email: email, repeat_sequence: !!seq.repeat_sequence, repeat_after_days: seq.repeat_after_days ?? 5, repeat_only_for: seq.repeat_only_for ?? "no_reply" },
        }).select("id").single();
        if (error || !cs) { enrolled.push({ email, error: error?.message || "insert failed" }); continue; }
        enrolled.push({ email, enrollment_id: cs.id, company_id: companyId });
      }
      const ok = enrolled.filter((e) => e.enrollment_id);
      let firstEmail: any[] = [];
      if (sendFirstNow && ok.length) {
        // Bounded concurrency: each call sends a real email through the user's provider.
        const queue = [...ok]; const results: any[] = [];
        await Promise.all(Array.from({ length: Math.min(3, queue.length) }, async () => {
          while (queue.length) {
            const e = queue.shift()!;
            const r = await callFunction("send-sequence-email", { companySequenceId: e.enrollment_id, stepNumber: 0 });
            results.push({ email: e.email, sent: r.ok, error: r.ok ? undefined : (r.data?.error || `HTTP ${r.status}`) });
          }
        }));
        firstEmail = results;
      }
      return json({
        sequence_id: seq.id, sequence: seq.name, enrolled: ok.length, skipped_already_enrolled: skippedAlready, skipped_invalid: skippedInvalid,
        failed: enrolled.filter((e) => e.error), first_email: sendFirstNow ? { sent: firstEmail.filter((r) => r.sent).length, failed: firstEmail.filter((r) => !r.sent) } : "queued: the hourly sequence run sends step 1 within the hour",
        message: `${ok.length} enrolled in "${seq.name}". Follow-up steps are sent automatically by the hourly run and stop as soon as someone replies.`,
      });
    }
    case "list_enrollments": {
      const limit = lim(body.limit, 100, 500);
      let q = db.from("company_sequences").select("id, status, current_step, next_action, personalized_emails, metadata, campaign_id, created_at, updated_at, company:companies!inner(id, name, user_id), sequence:email_sequences(id, name)")
        .eq("company.user_id", userId).order("updated_at", { ascending: false }).limit(limit);
      const status = str(body.status);
      if (status && status !== "all") q = q.eq("status", status);
      if (str(body.sequence_id)) q = q.eq("sequence_id", str(body.sequence_id));
      if (str(body.campaign_id)) q = q.eq("campaign_id", str(body.campaign_id));
      const { data, error } = await q;
      if (error) return json({ error: error.message }, 500);
      const rows = data || [];
      const ids = rows.map((r: any) => r.id);
      const last: Record<string, any> = {};
      if (ids.length) {
        const { data: acts } = await db.from("email_activities").select("company_sequence_id, step_number, sent_at, opened_at, replied_at").in("company_sequence_id", ids).order("sent_at", { ascending: false }).limit(5000);
        for (const a of acts || []) if (!last[a.company_sequence_id]) last[a.company_sequence_id] = a;
      }
      const out = rows.map((r: any) => {
        const steps = Array.isArray(r.personalized_emails) ? r.personalized_emails : [];
        const next = steps.find((s: any) => s.stepNumber === (r.current_step ?? 0) + 1);
        const la = last[r.id];
        const due = la?.sent_at && next ? new Date(new Date(la.sent_at).getTime() + (Number(next.delayDays) || 0) * 86400000).toISOString() : null;
        return {
          enrollment_id: r.id, status: r.status, sequence: r.sequence?.name, sequence_id: r.sequence?.id, company: r.company?.name, company_id: r.company?.id,
          recipient_email: r.metadata?.recipient_email || null, campaign_id: r.campaign_id,
          step: `${r.current_step ?? 0}/${Math.max(0, steps.length - 1)}`, last_sent_at: la?.sent_at || null, opened: !!la?.opened_at, replied: !!la?.replied_at,
          next_step_subject: next?.subject || null, next_due_at: due, stopped_reason: r.next_action || null, updated_at: r.updated_at,
        };
      });
      return json({ enrollments: out, count: out.length });
    }
    case "update_enrollment": {
      const id = str(body.enrollment_id);
      const status = str(body.status);
      if (!id || !["active", "paused", "completed"].includes(status)) return json({ error: "enrollment_id and status (active|paused|completed) required" }, 400);
      const { data: cs } = await db.from("company_sequences").select("id, company:companies!inner(user_id)").eq("id", id).eq("company.user_id", userId).maybeSingle();
      if (!cs) return json({ error: "Enrollment not found" }, 404);
      // next_action is CHECK-constrained (send_next_step|wait_for_response|personalized_response|completed|paused);
      // "stopped_manually" violated company_sequences_next_action_check, so completing always failed.
      const { error } = await db.from("company_sequences").update({ status, updated_at: new Date().toISOString(), ...(status === "completed" ? { next_action: "completed" } : status === "paused" ? { next_action: "paused" } : {}) }).eq("id", id);
      if (error) return json({ error: error.message }, 500);
      return json({ enrollment_id: id, status });
    }
    case "run_sequences_now": {
      const r = await callFunction("process-sequence-steps", { triggered_by: "api" });
      if (!r.ok) return json({ error: r.data?.error || `HTTP ${r.status}`, details: r.data }, 502);
      return json({ result: r.data, note: "This processed every user's due steps (same as the hourly run)." });
    }
    case "sequence_health": {
      const since = new Date(Date.now() - 30 * 86400000).toISOString();
      const { data: cs } = await db.from("company_sequences").select("id, status, current_step, personalized_emails, company:companies!inner(user_id)").eq("company.user_id", userId).limit(20000);
      const byStatus: Record<string, number> = {};
      for (const r of cs || []) byStatus[r.status] = (byStatus[r.status] || 0) + 1;
      const activeIds = (cs || []).filter((r: any) => r.status === "active").map((r: any) => r.id);
      let lastFollowUp: string | null = null; let followUpsSent30d = 0; let dueNow = 0;
      if (activeIds.length || true) {
        const { data: acts } = await db.from("email_activities").select("company_sequence_id, step_number, sent_at").gt("step_number", 0).gte("sent_at", since).order("sent_at", { ascending: false }).limit(5000);
        const mine = new Set((cs || []).map((r: any) => r.id));
        const own = (acts || []).filter((a: any) => mine.has(a.company_sequence_id));
        followUpsSent30d = own.length; lastFollowUp = own[0]?.sent_at || null;
      }
      if (activeIds.length) {
        const { data: acts } = await db.from("email_activities").select("company_sequence_id, step_number, sent_at").in("company_sequence_id", activeIds.slice(0, 2000)).order("sent_at", { ascending: false }).limit(10000);
        const last: Record<string, any> = {};
        for (const a of acts || []) if (!last[a.company_sequence_id]) last[a.company_sequence_id] = a;
        for (const r of (cs || []).filter((x: any) => x.status === "active")) {
          const steps = Array.isArray(r.personalized_emails) ? r.personalized_emails : [];
          const next = steps.find((s: any) => s.stepNumber === (r.current_step ?? 0) + 1);
          const la = last[r.id];
          if (next && la?.sent_at && Date.now() - new Date(la.sent_at).getTime() >= (Number(next.delayDays) || 0) * 86400000) dueNow++;
        }
      }
      const { data: camps } = await db.from("email_campaigns").select("id, name, status, auto_follow_up_enabled, follow_up_sequence_id, sent_count, tags").eq("user_id", userId).gte("created_at", since).gt("sent_count", 0);
      const emailCamps = (camps || []).filter((c: any) => !isPhoneCampaign(c));
      const noSeq = emailCamps.filter((c: any) => c.auto_follow_up_enabled && !c.follow_up_sequence_id).map((c: any) => c.name);
      const offCamps = emailCamps.filter((c: any) => !c.auto_follow_up_enabled).map((c: any) => c.name);
      return json({
        enrollments_by_status: byStatus, active: byStatus.active || 0, due_now: dueNow,
        follow_ups_sent_last_30d: followUpsSent30d, last_follow_up_sent_at: lastFollowUp,
        campaigns_last_30d: { email_with_follow_up: emailCamps.length - offCamps.length, email_follow_up_off: offCamps, email_missing_sequence_defaulted_at_send: noSeq, sms: (camps || []).length - emailCamps.length },
        how_it_runs: "Hourly cron → process-sequence-steps. Each email campaign send enrols its recipients (linked to a CRM company) in the campaign's follow-up sequence; steps go out after their delay and stop on reply. SMS campaigns have no automatic follow-up: use schedule_sms_followup.",
        verdict: (byStatus.active || 0) === 0 && followUpsSent30d === 0 ? "No follow-ups are active or have been sent in 30 days. Send an email campaign (follow-up on) or enroll_in_sequence to start some." : "Follow-ups are active.",
      });
    }
    case "schedule_sms_followup": {
      const id = str(body.campaign_id);
      const message = str(body.message);
      if (!id || !message) return json({ error: "campaign_id and message are required" }, 400);
      const { data: c } = await db.from("email_campaigns").select("id, name, tags, sender_connection_id").eq("id", id).eq("user_id", userId).maybeSingle();
      if (!c) return json({ error: "Campaign not found" }, 404);
      if (!isPhoneCampaign(c)) return json({ error: "That is an email campaign; its follow-ups run through sequences automatically." }, 400);
      const rows: any[] = [];
      for (let page = 0; ; page++) {
        const { data } = await db.from("email_campaign_recipients").select("email, name, status").eq("campaign_id", id).eq("status", "sent").range(page * 1000, page * 1000 + 999);
        rows.push(...(data || []));
        if (!data || data.length < 1000) break;
      }
      if (!rows.length) return json({ error: "No sent recipients to follow up" }, 400);
      const { data: outs } = await db.from("sms_opt_outs").select("phone").eq("user_id", userId);
      const optedOut = new Set((outs || []).map((o: any) => o.phone));
      const when = body.schedule_at ? toUtcIso(str(body.schedule_at), body.timezone || "Europe/London")
        : new Date(Date.now() + Math.max(0.01, Number(body.days ?? 3)) * 86400000).toISOString();
      const seen = new Set<string>(); const recips: any[] = [];
      for (const r of rows) {
        const phone = normalizePhone(String(r.email || "").replace(/^phone:/, ""));
        if (!phone || seen.has(phone) || optedOut.has(phone)) continue; seen.add(phone);
        const text = fillSmsTags(message, { name: r.name, phone });
        recips.push({ email: `phone:${phone}`, name: r.name || "Contact", status: "pending", personalized_subject: `Phone Campaign: ${c.name}`, personalized_body_text: text, personalized_body_html: `<p>${text.replace(/\n/g, "<br>")}</p>` });
      }
      const baseName = String(c.name).replace(/^📞\s*/, "");
      const name = str(body.name) || `${baseName} · follow-up`;
      const svc = await sendersFor(db, userId);
      const { data: camp, error } = await db.from("email_campaigns").insert({
        user_id: userId, name: `📞 ${name}`, subject_template: `Phone Campaign: ${name}`, body_text_template: message, body_html_template: `<p>${message.replace(/\n/g, "<br>")}</p>`,
        status: "scheduled", scheduled_at: when, total_recipients: recips.length, sent_count: 0, failed_count: 0, opened_count: 0,
        sender_connection_id: c.sender_connection_id || svc?.id || null, tags: ["phone_sms", `follow_up_of:${id}`], auto_follow_up_enabled: false,
      }).select("id").single();
      if (error || !camp) return json({ error: error?.message || "Failed to create follow-up campaign" }, 500);
      for (let i = 0; i < recips.length; i += 500) {
        const { error: rErr } = await db.from("email_campaign_recipients").insert(recips.slice(i, i + 500).map((r) => ({ ...r, campaign_id: camp.id })));
        if (rErr) { await db.from("email_campaigns").delete().eq("id", camp.id); return json({ error: rErr.message }, 500); }
      }
      return json({ campaign_id: camp.id, name, recipients: recips.length, scheduled_at: when, message: `Follow-up text scheduled for ${when} (UTC) to ${recips.length} number(s) who received "${baseName}" and have not replied or opted out. Cancel with unschedule_campaign.` });
    }

    // ───────────────────────── two-way SMS ─────────────────────────
    case "list_sms_conversations": {
      const limit = lim(body.limit, 50, 200);
      const { data, error } = await db.from("sms_messages").select("counterparty, contact_name, direction, body, status, created_at, read_at, campaign_id, person_id")
        .eq("user_id", userId).order("created_at", { ascending: false }).limit(5000);
      if (error) return json({ error: error.message }, 500);
      const threads = new Map<string, any>();
      for (const m of data || []) {
        let t = threads.get(m.counterparty);
        if (!t) { t = { phone: m.counterparty, name: m.contact_name || null, last_message: m.body, last_direction: m.direction, last_at: m.created_at, unread: 0, messages: 0, campaign_id: m.campaign_id || null, person_id: m.person_id || null }; threads.set(m.counterparty, t); }
        if (!t.name && m.contact_name) t.name = m.contact_name;
        if (!t.campaign_id && m.campaign_id) t.campaign_id = m.campaign_id;
        t.messages++;
        if (m.direction === "inbound" && !m.read_at) t.unread++;
      }
      let list = Array.from(threads.values());
      if (body.unread_only === true) list = list.filter((t) => t.unread > 0);
      if (str(body.campaign_id)) list = list.filter((t) => t.campaign_id === str(body.campaign_id));
      if (body.inbound_only !== false) list = list.filter((t) => (data || []).some((m: any) => m.counterparty === t.phone && m.direction === "inbound"));
      const { data: outs } = await db.from("sms_opt_outs").select("phone").eq("user_id", userId);
      const optedOut = new Set((outs || []).map((o: any) => o.phone));
      list = list.slice(0, limit).map((t) => ({ ...t, opted_out: optedOut.has(t.phone) }));
      return json({ conversations: list, count: list.length, note: list.length ? undefined : "No texts received yet. Replies arrive here once your Twilio number is pointed at the LeadBoosters webhook." });
    }
    case "get_sms_conversation": {
      const phone = normalizeE164(body.phone);
      if (!phone) return json({ error: "phone required" }, 400);
      const { data, error } = await db.from("sms_messages").select("id, direction, body, status, created_at, read_at, contact_name, campaign_id, error_message")
        .eq("user_id", userId).eq("counterparty", phone).order("created_at", { ascending: true }).limit(lim(body.limit, 200, 1000));
      if (error) return json({ error: error.message }, 500);
      if (body.mark_read !== false) await db.from("sms_messages").update({ read_at: new Date().toISOString() }).eq("user_id", userId).eq("counterparty", phone).eq("direction", "inbound").is("read_at", null);
      const opted = await isOptedOut(db, userId, phone);
      return json({ phone, name: (data || []).find((m: any) => m.contact_name)?.contact_name || null, opted_out: opted, messages: data || [] });
    }
    case "reply_sms": {
      const phone = normalizeE164(body.phone || body.to);
      const message = str(body.message);
      if (!phone || !message) return json({ error: "phone and message are required" }, 400);
      const conn = await activePhoneConnection(db, userId, str(body.connection_id) || null);
      if (!conn) return json({ error: "No active phone service (Twilio etc.) connected." }, 400);
      if (await isOptedOut(db, userId, phone)) return json({ error: "This number has opted out (replied STOP); it cannot be texted unless they reply START." }, 400);
      const { name, personId } = await nameForNumber(db, userId, phone);
      const text = fillSmsTags(message, { name, phone });
      const result = await sendOneSms(conn.provider, conn.metadata || {}, phone, text);
      const now = new Date().toISOString();
      await logSms(db, { user_id: userId, connection_id: conn.id, direction: "outbound", counterparty: phone, from_number: senderNumberOf(conn.provider, conn.metadata || {}) || "", to_number: phone, body: text, status: result.success ? "sent" : "failed", provider: conn.provider, provider_sid: result.messageId || null, person_id: personId, contact_name: name, error_message: result.success ? null : result.error || null, read_at: now, metadata: { via: "api" } });
      if (result.success) await db.from("sms_messages").update({ read_at: now }).eq("user_id", userId).eq("counterparty", phone).eq("direction", "inbound").is("read_at", null);
      if (!result.success) return json({ error: result.error || "Send failed" }, 502);
      return json({ sent: true, to: phone, name, message: text, provider_sid: result.messageId });
    }
    case "list_sms_opt_outs": {
      const { data } = await db.from("sms_opt_outs").select("phone, reason, created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(lim(body.limit, 200, 2000));
      return json({ opt_outs: data || [], count: (data || []).length });
    }

    // ───────────────────────── notifications ─────────────────────────
    case "list_notifications": {
      let q = db.from("notifications").select("id, type, title, body, link, entity_type, entity_id, read_at, created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(lim(body.limit, 30, 200));
      if (body.unread_only !== false) q = q.is("read_at", null);
      if (str(body.type)) q = q.eq("type", str(body.type));
      const { data, error } = await q;
      if (error) return json({ error: error.message }, 500);
      const { count } = await db.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", userId).is("read_at", null);
      return json({ notifications: data || [], unread_total: count ?? 0, types: ["email_reply", "sms_reply", "sms_opt_out", "campaign_done", "newsletter_sent", "sequence_reply", "sequence_click", "bounce", "lead_search_done"] });
    }
    case "mark_notifications_read": {
      const ids: string[] = Array.isArray(body.ids) ? body.ids.map(str).filter(Boolean) : [];
      let q = db.from("notifications").update({ read_at: new Date().toISOString() }, { count: "exact" }).eq("user_id", userId).is("read_at", null);
      if (ids.length) q = q.in("id", ids); else if (body.all !== true) return json({ error: "Pass ids[] or all:true" }, 400);
      const { count, error } = await q;
      if (error) return json({ error: error.message }, 500);
      return json({ marked_read: count ?? 0 });
    }

    // ───────────────────────── scheduled AI automations ─────────────────────────
    case "list_automations": {
      const { data, error } = await db.from("ai_automations").select("id, name, instruction, schedule_kind, time_of_day, days_of_week, timezone, enabled, allow_sending, next_run_at, last_run_at, last_status, last_summary, created_at").eq("user_id", userId).order("created_at", { ascending: true });
      if (error) return json({ error: error.message }, 500);
      return json({ automations: data || [], how: "Automations run on the server every 15 minutes when due. allow_sending=false means drafts only." });
    }
    case "create_automation": {
      const name = str(body.name); const instruction = str(body.instruction);
      if (!name || !instruction) return json({ error: "name and instruction are required" }, 400);
      const kind = ["hourly", "daily", "weekdays", "weekly"].includes(str(body.schedule_kind)) ? str(body.schedule_kind) : "daily";
      const row = { user_id: userId, name, instruction, schedule_kind: kind, time_of_day: /^\d{2}:\d{2}$/.test(str(body.time_of_day)) ? str(body.time_of_day) : "08:00", days_of_week: Array.isArray(body.days_of_week) ? body.days_of_week.map(Number).filter((d: number) => d >= 0 && d <= 6) : [1], timezone: str(body.timezone) || "Europe/London", enabled: body.enabled !== false, allow_sending: body.allow_sending === true, model: opt(body.model) };
      const { data, error } = await db.from("ai_automations").insert(row).select("id, name").single();
      if (error) return json({ error: error.message }, 500);
      await callFunction("run-ai-automations", { reschedule_only: true }).catch(() => null);
      const { data: fresh } = await db.from("ai_automations").select("next_run_at").eq("id", data.id).maybeSingle();
      return json({ automation_id: data.id, name: data.name, next_run_at: fresh?.next_run_at || null, message: `Automation "${name}" created (${kind} at ${row.time_of_day} UK). Use run_automation to try it now.` });
    }
    case "update_automation": {
      const id = str(body.automation_id);
      if (!id) return json({ error: "automation_id required" }, 400);
      const fields: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (body.name != null) fields.name = str(body.name);
      if (body.instruction != null) fields.instruction = str(body.instruction);
      if (body.schedule_kind != null && ["hourly", "daily", "weekdays", "weekly"].includes(str(body.schedule_kind))) fields.schedule_kind = str(body.schedule_kind);
      if (body.time_of_day != null && /^\d{2}:\d{2}$/.test(str(body.time_of_day))) fields.time_of_day = str(body.time_of_day);
      if (Array.isArray(body.days_of_week)) fields.days_of_week = body.days_of_week.map(Number);
      if (typeof body.enabled === "boolean") fields.enabled = body.enabled;
      if (typeof body.allow_sending === "boolean") fields.allow_sending = body.allow_sending;
      if (body.model != null) fields.model = opt(body.model);
      fields.next_run_at = null;
      const { data, error } = await db.from("ai_automations").update(fields).eq("id", id).eq("user_id", userId).select("id").maybeSingle();
      if (error) return json({ error: error.message }, 500);
      if (!data) return json({ error: "Automation not found" }, 404);
      await callFunction("run-ai-automations", { reschedule_only: true }).catch(() => null);
      return json({ automation_id: id, updated_fields: Object.keys(fields).filter((k) => k !== "updated_at" && k !== "next_run_at") });
    }
    case "delete_automation": {
      const id = str(body.automation_id);
      if (!id) return json({ error: "automation_id required" }, 400);
      const { data, error } = await db.from("ai_automations").delete().eq("id", id).eq("user_id", userId).select("id, name").maybeSingle();
      if (error) return json({ error: error.message }, 500);
      if (!data) return json({ error: "Automation not found" }, 404);
      return json({ deleted: true, name: data.name });
    }
    case "run_automation": {
      const id = str(body.automation_id);
      if (!id) return json({ error: "automation_id required" }, 400);
      const { data: a } = await db.from("ai_automations").select("id").eq("id", id).eq("user_id", userId).maybeSingle();
      if (!a) return json({ error: "Automation not found" }, 404);
      const r = await callFunction("run-ai-automations", { automation_id: id, trigger: "api" });
      if (!r.ok) return json({ error: r.data?.error || `HTTP ${r.status}`, details: r.data }, 502);
      return json(r.data);
    }
    case "list_automation_runs": {
      let q = db.from("ai_automation_runs").select("id, automation_id, started_at, finished_at, status, trigger, summary, error, steps").eq("user_id", userId).order("started_at", { ascending: false }).limit(lim(body.limit, 10, 100));
      if (str(body.automation_id)) q = q.eq("automation_id", str(body.automation_id));
      const { data, error } = await q;
      if (error) return json({ error: error.message }, 500);
      return json({ runs: (data || []).map((r: any) => ({ ...r, steps: (r.steps || []).map((s: any) => ({ tool: s.tool, ok: s.ok })) })) });
    }
    case "reschedule_automations": {
      await callFunction("run-ai-automations", { reschedule_only: true }).catch(() => null);
      return json({ ok: true });
    }

    // ───────────────────────── business knowledge ─────────────────────────
    case "learn_business": {
      const url = str(body.url); const text = str(body.text);
      if (!url && !text) return json({ error: "url (website) or text is required" }, 400);
      const r = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/learn-business`, {
        method: "POST", headers: { Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`, "x-user-id": userId, "Content-Type": "application/json" },
        body: JSON.stringify({ url, text, apply: body.apply === true, overwrite: body.overwrite === true }),
      });
      const t = await r.text(); let data: any; try { data = JSON.parse(t); } catch { data = { raw: t }; }
      if (!r.ok) return json({ error: data?.error || `HTTP ${r.status}` }, r.status === 401 ? 500 : r.status);
      return json(data);
    }
    case "update_business_profile": {
      const allowed = ["company_name", "industry", "website", "phone", "services_description", "target_audience", "value_proposition", "tone_preference", "email_signature", "email_sender_name", "email_sender_title", "email_sender_email", "email_sender_phone", "email_brand_color", "knowledge_base"];
      const fields: Record<string, unknown> = {};
      for (const k of allowed) if (body[k] !== undefined) fields[k] = body[k] === null ? null : String(body[k]);
      if (!Object.keys(fields).length) return json({ error: `Nothing to update. Fields: ${allowed.join(", ")}` }, 400);
      fields.updated_at = new Date().toISOString();
      const { data: cur } = await db.from("business_profiles").select("id").eq("user_id", userId).maybeSingle();
      const { error } = cur ? await db.from("business_profiles").update(fields).eq("user_id", userId) : await db.from("business_profiles").insert({ ...fields, user_id: userId });
      if (error) return json({ error: error.message }, 500);
      return json({ updated: Object.keys(fields).filter((k) => k !== "updated_at") });
    }

    default:
      return await handleLeadAction(db, userId, action, body);
  }
}
