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
    .replace(/\{\{\s*firstName\s*\}\}/gi, r.first_name || (full.split(" ")[0] || ""))
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

const isPhoneCampaign = (c: any) => (Array.isArray(c?.tags) && c.tags.includes("phone_sms")) || String(c?.name || "").startsWith("📞");

export const CRM_ACTIONS = [
  "get_business_profile", "list_senders",
  "search_contacts", "get_contact", "upsert_contact", "update_contact",
  "search_companies", "upsert_company", "update_company",
  "get_group", "add_to_group", "remove_from_group",
  "get_campaign", "update_campaign", "send_campaign", "unschedule_campaign", "create_phone_campaign",
  "list_newsletters", "send_newsletter", "list_subscribers", "add_subscribers",
  "list_deals", "create_deal", "update_deal",
];

export async function handleCrmAction(db: any, userId: string, action: string, body: any): Promise<Response | null> {
  switch (action) {
    // ───────────────────────── profile / senders ─────────────────────────
    case "get_business_profile": {
      const { data } = await db.from("business_profiles").select(
        "company_name, industry, website, phone, services_description, target_audience, value_proposition, tone_preference, " +
        "email_brand_color, email_logo_url, email_header_name, email_footer_text, email_footer_logo_url, email_signature, " +
        "email_sender_name, email_sender_title, email_sender_email, email_sender_phone, email_template_style, email_provider",
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
        const { data, error } = await db.from("people").update(fields).eq("id", existing.id).select("id, first_name, last_name, email, phone, title, tags, company_id").single();
        if (error) return json({ error: error.message }, 500);
        return json({ contact: data, created: false });
      }
      if (Array.isArray(body.add_tags)) fields.tags = body.add_tags.map(str).filter(Boolean);
      if (!fields.first_name) fields.first_name = email.split("@")[0];
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

      const { data: existing } = await db.from("recipient_group_members").select("email, phone").eq("group_id", g.id).limit(100000);
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

    default:
      return null;
  }
}
