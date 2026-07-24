// ai-find-leads: on-demand lead discovery for the in-app "Create with AI" page.
// Discovers PUBLICLY-LISTED business emails matching a user's sector/audience,
// creates a draft campaign with a first batch immediately, then keeps discovering
// more in the background ("small now, more later"). Auth via the caller's Supabase
// session (user JWT). Mirrors api-campaigns' CRM linking + no-reply follow-up.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key",
};

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

const EMAIL_RE = /^[^\s@,]+@[^\s@,]+\.[^\s@,]+$/;
const FREEMAIL = new Set([
  "gmail.com", "googlemail.com", "yahoo.com", "yahoo.co.uk", "hotmail.com", "hotmail.co.uk",
  "outlook.com", "live.com", "msn.com", "icloud.com", "me.com", "mac.com", "aol.com",
  "proton.me", "protonmail.com", "gmx.com", "gmx.net", "mail.com", "yandex.com", "zoho.com",
]);
// Hosts that are directories/social, not an org's own site.
const SKIP_HOSTS = ["linkedin.", "facebook.", "twitter.", "x.com", "instagram.", "youtube.", "youtu.be",
  "wikipedia.", "yelp.", "yell.com", "trustpilot.", "glassdoor.", "indeed.", "crunchbase.", "pinterest.",
  "tiktok.", "reddit.", "medium.com", "amazon.", "google.", "bing.", "apple.com", "gov.uk/guidance"];
const GENERIC_LOCAL = /^(noreply|no-reply|donotreply|do-not-reply|mailer-daemon|postmaster|abuse|privacy|unsubscribe|webmaster|hostmaster|example|test|sentry|wordpress|sitemap)$/i;

function domainToName(domain: string): string {
  const base = (domain || "").split(".")[0] || "";
  return base ? base.charAt(0).toUpperCase() + base.slice(1) : "";
}
function cap(s: string) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }

async function mapPool<T, R>(items: T[], limit: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out = new Array(items.length) as R[];
  let idx = 0;
  async function worker() { while (idx < items.length) { const i = idx++; out[i] = await fn(items[i]); } }
  await Promise.all(Array.from({ length: Math.min(limit, items.length || 1) }, worker));
  return out;
}

function personalize(tpl: string, r: any): string {
  if (!tpl) return "";
  const full = [r.first_name, r.last_name].filter(Boolean).join(" ") || r.company || r.email || "";
  return tpl
    .replace(/\{\{\s*firstName\s*\}\}/gi, r.first_name || "there")
    .replace(/\{\{\s*lastName\s*\}\}/gi, r.last_name || "")
    .replace(/\{\{\s*fullName\s*\}\}/gi, full)
    .replace(/\{\{\s*name\s*\}\}/gi, full)
    .replace(/\{\{\s*company\s*\}\}/gi, r.company || "")
    .replace(/\{\{\s*email\s*\}\}/gi, r.email || "");
}

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

async function ensurePersonCompany(db: any, userId: string, r: any): Promise<string | null> {
  const email = String(r.email || "").toLowerCase().trim();
  if (!email) return null;
  const first = String(r.first_name || "Contact");
  const last = String(r.last_name || "");
  const fullName = [first, last].filter(Boolean).join(" ") || email;
  const { data: person } = await db.from("people").select("id, company_id").eq("user_id", userId).eq("email", email).maybeSingle();
  let personId: string | null = person?.id ?? null;
  let companyId: string | null = person?.company_id ?? null;
  if (!companyId) {
    const domain = (email.split("@")[1] || "").toLowerCase();
    const isFree = FREEMAIL.has(domain);
    let companyName = String(r.company || "").trim();
    if (!companyName) companyName = isFree ? email : (domainToName(domain) || email);
    const { data: existingCo } = await db.from("companies").select("id").eq("user_id", userId).eq("name", companyName).maybeSingle();
    if (existingCo?.id) companyId = existingCo.id;
    else {
      const { data: co, error } = await db.from("companies").insert({ user_id: userId, name: companyName, general_email: isFree ? email : null }).select("id").single();
      if (co?.id) companyId = co.id;
      else if (error) { const { data: retry } = await db.from("companies").select("id").eq("user_id", userId).eq("name", companyName).maybeSingle(); companyId = retry?.id ?? null; }
    }
  }
  if (!companyId) return personId;
  if (personId) { if (!person?.company_id) await db.from("people").update({ company_id: companyId }).eq("id", personId); }
  else {
    const { data: np, error: pErr } = await db.from("people").insert({ user_id: userId, email, first_name: first, last_name: last, company_id: companyId }).select("id").single();
    if (np?.id) personId = np.id;
    else if (pErr) { const { data: retry } = await db.from("people").select("id, company_id").eq("user_id", userId).eq("email", email).maybeSingle(); if (retry?.id) { personId = retry.id; if (!retry.company_id) await db.from("people").update({ company_id: companyId }).eq("id", retry.id); } }
  }
  const { data: ec } = await db.from("contacts").select("id, email_verified").eq("company_id", companyId).eq("email", email).maybeSingle();
  if (ec?.id) { if (!ec.email_verified) await db.from("contacts").update({ email_verified: true }).eq("id", ec.id); }
  else await db.from("contacts").insert({ company_id: companyId, name: fullName, email, email_verified: true, is_primary_contact: true });
  return personId;
}

// ── Discovery ──────────────────────────────────────────────────────────────
async function fetchText(url: string, ms = 8000): Promise<string | null> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), ms);
    const res = await fetch(url, { signal: ctrl.signal, headers: { "User-Agent": "Mozilla/5.0 (compatible; LeadBoostersBot/1.0)" } });
    clearTimeout(t);
    if (!res.ok) return null;
    const ct = res.headers.get("content-type") || "";
    if (!ct.includes("text/html") && !ct.includes("text/plain")) return null;
    return (await res.text()).slice(0, 400000);
  } catch { return null; }
}

async function serpSearch(query: string, serpKey: string, num = 20): Promise<string[]> {
  try {
    const url = `https://serpapi.com/search.json?engine=google&num=${num}&q=${encodeURIComponent(query)}&api_key=${serpKey}`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    const links = (data.organic_results || []).map((r: any) => r.link).filter(Boolean) as string[];
    return links.filter((l) => !SKIP_HOSTS.some((h) => l.toLowerCase().includes(h)));
  } catch { return []; }
}

function nameFromLocal(local: string): { first: string; last: string } {
  const parts = local.split(/[._-]/).filter((p) => /^[a-z]+$/i.test(p) && p.length > 1);
  if (parts.length >= 2 && !GENERIC_LOCAL.test(parts[0])) return { first: cap(parts[0]), last: cap(parts[1]) };
  return { first: "there", last: "" };
}

function extractBusinessEmail(html: string, siteDomain: string): string | null {
  const found = html.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g) || [];
  for (const raw of found) {
    const email = raw.toLowerCase();
    if (!EMAIL_RE.test(email)) continue;
    const [local, domain] = email.split("@");
    if (GENERIC_LOCAL.test(local)) continue;
    if (/\.(png|jpg|jpeg|gif|webp|svg|css|js)$/i.test(email)) continue;
    if (FREEMAIL.has(domain)) continue;
    // Prefer an email on the site's own domain.
    if (siteDomain && domain.includes(siteDomain.replace(/^www\./, "").split(".").slice(-2).join("."))) return email;
  }
  // Fall back to the first non-generic, non-freemail email.
  for (const raw of found) {
    const email = raw.toLowerCase();
    if (!EMAIL_RE.test(email)) continue;
    const [local, domain] = email.split("@");
    if (GENERIC_LOCAL.test(local) || FREEMAIL.has(domain) || /\.(png|jpg|jpeg|gif|webp|svg|css|js)$/i.test(email)) continue;
    return email;
  }
  return null;
}

async function discover(audience: string, region: string, want: number, exclude: Set<string>, serpKey: string): Promise<any[]> {
  const q = [audience, region].filter(Boolean).join(" ").trim();
  const queries = [q, `${q} contact email`, `${q} organisations ${region}`.trim(), `${audience} ${region} directory`.trim()];
  const urls: string[] = [];
  for (const query of queries) {
    if (urls.length >= want * 5) break;
    const found = await serpSearch(query, serpKey, 20);
    for (const u of found) if (!urls.includes(u)) urls.push(u);
  }
  const recips: any[] = [];
  const seen = new Set<string>();
  // Common places orgs list a public email; stop at the first hit per site.
  const paths = ["", "/contact", "/contact-us", "/about", "/about-us", "/get-in-touch"];
  await mapPool(urls, 6, async (url) => {
    if (recips.length >= want) return null;
    let host = "", origin = ""; try { const u = new URL(url); host = u.hostname; origin = u.origin; } catch { return null; }
    const domain = host.replace(/^www\./, "");
    let email: string | null = null;
    for (const p of paths) {
      if (recips.length >= want) return null;
      const target = p === "" ? url : `${origin}${p}`;
      const html = await fetchText(target, p === "" ? 8000 : 5000);
      if (html) { email = extractBusinessEmail(html, host); if (email) break; }
    }
    if (!email || exclude.has(email) || seen.has(email)) return null;
    seen.add(email);
    const { first, last } = nameFromLocal(email.split("@")[0]);
    if (recips.length < want) recips.push({ email, first_name: first, last_name: last, company: domainToName(domain) });
    return null;
  });
  return recips.slice(0, want);
}

// ── Insert helpers ───────────────────────────────────────────────────────────
async function insertRecipients(db: any, userId: string, campaignId: string, groupId: string, recips: any[], subject: string, bodyText: string, finalHtml: string) {
  if (!recips.length) return 0;
  const ids = await mapPool(recips, 6, (r) => ensurePersonCompany(db, userId, r).catch(() => null));
  recips.forEach((r, i) => { r.person_id = ids[i] || null; });
  const rows = recips.map((r) => ({
    campaign_id: campaignId, email: r.email,
    name: [r.first_name, r.last_name].filter(Boolean).join(" ") || r.company || r.email,
    person_id: r.person_id || null,
    personalized_subject: personalize(subject, r) || subject,
    personalized_body_html: personalize(finalHtml, r) || finalHtml,
    personalized_body_text: personalize(bodyText, r),
    status: "pending",
  }));
  await db.from("email_campaign_recipients").insert(rows);
  await db.from("recipient_group_members").insert(recips.map((r) => ({
    group_id: groupId, email: r.email, first_name: r.first_name || null, last_name: r.last_name || null,
    company: r.company || null, person_id: r.person_id || null,
  })));
  const { data: camp } = await db.from("email_campaigns").select("total_recipients").eq("id", campaignId).maybeSingle();
  await db.from("email_campaigns").update({ total_recipients: (camp?.total_recipients || 0) + rows.length }).eq("id", campaignId);
  return rows.length;
}

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    // Auth: lb_live_ API key (scheduled routine) OR a Supabase user session (in-app).
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
      return json({ error: "Sign in or API key required" }, 401);
    }

    const serpKey = Deno.env.get("SERPAPI_API_KEY");
    if (!serpKey) return json({ error: "Lead discovery isn't configured (missing search key)." }, 400);

    const body = await req.json().catch(() => ({}));
    const name = String(body.name || "").trim() || "AI campaign";
    const subject = String(body.subject || "").trim();
    const bodyText = String(body.body_text || "").trim();
    let audience = String(body.audience || "").trim();
    const region = String(body.region || "").trim();
    const firstBatch = Math.min(15, Math.max(4, Number(body.first_batch) || 10));
    const maxTotal = Math.min(60, Math.max(firstBatch, Number(body.max_total) || 50));
    if (!subject || !bodyText) return json({ error: "subject and body_text are required" }, 400);

    // Adapt to the user's sector when no audience given: fall back to their business profile.
    if (!audience) {
      const { data: bp } = await db.from("business_profiles").select("company_name, description, industry").eq("user_id", userId).maybeSingle();
      audience = [bp?.industry, bp?.description].filter(Boolean).join(" ").slice(0, 120) || "small businesses";
    }

    const finalHtml = `<p>${bodyText.replace(/\n{2,}/g, "</p><p>").replace(/\n/g, "<br/>")}</p>`;
    const followUpSeqId = await ensureNoReplySequence(db, userId);

    // Draft campaign shell.
    const { data: campaign, error: campErr } = await db.from("email_campaigns").insert({
      user_id: userId, name, subject_template: subject,
      body_html_template: finalHtml, body_text_template: bodyText,
      status: "draft", total_recipients: 0,
      auto_follow_up_enabled: !!followUpSeqId, follow_up_sequence_id: followUpSeqId,
    }).select("id").single();
    if (campErr || !campaign) return json({ error: campErr?.message || "Failed to create draft" }, 500);

    const date = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "Europe/London" });
    const groupName = `Fresh leads · ${audience.slice(0, 32)} · ${date}`;
    const { data: grp } = await db.from("recipient_groups").insert({
      user_id: userId, name: groupName, description: `Auto-discovered leads for "${name}".`,
    }).select("id, name").single();
    const groupId = grp?.id;

    // Phase 1 — small now.
    const batch1 = await discover(audience, region, firstBatch, new Set(), serpKey);
    const found = new Set(batch1.map((r) => r.email));
    let added = 0;
    if (groupId) added = await insertRecipients(db, userId, campaign.id, groupId, batch1, subject, bodyText, finalHtml);

    // Phase 2 — more later, in the background.
    const remaining = maxTotal - added;
    if (groupId && remaining > 0) {
      const bg = (async () => {
        try {
          const more = await discover(audience, region, remaining, found, serpKey);
          if (more.length) await insertRecipients(db, userId, campaign.id, groupId, more, subject, bodyText, finalHtml);
        } catch (_e) { /* best-effort */ }
      })();
      // @ts-ignore EdgeRuntime is provided by the Supabase Edge runtime.
      if (typeof EdgeRuntime !== "undefined" && (EdgeRuntime as any).waitUntil) (EdgeRuntime as any).waitUntil(bg);
      else bg.catch(() => {});
    }

    return json({
      campaign_id: campaign.id,
      group: grp ? { id: grp.id, name: grp.name } : null,
      recipients: added,
      still_discovering: remaining > 0,
      follow_up_enabled: !!followUpSeqId,
      message: added
        ? `Draft created with ${added} lead${added === 1 ? "" : "s"} so far${remaining > 0 ? " — more are being added in the background." : "."}`
        : "Draft created, but no public emails were found yet — try a broader audience/region, or add recipients manually.",
    });
  } catch (e: any) {
    return json({ error: e?.message || "Failed" }, 500);
  }
});
