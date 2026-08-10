/**
 * Ingest curated hospitality leads → CRM + recipient groups + campaigns + newsletters.
 *
 * Auth: Supabase JWT (in-app) or lb_live_ API key.
 *
 * Actions:
 * - ingest (default): create US/UK groups, draft campaigns, optional newsletters/series, CRM
 * - enable_daily / disable_daily: opt into daily automation
 * - daily: cron/service — process opted-in users (refresh from public JSON URLs)
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key",
};

type Market = "US" | "UK";

type CuratedLead = {
  propertyName?: string;
  propertyType?: string;
  city?: string;
  country?: string;
  address?: string;
  website?: string;
  sourceUrl?: string;
  phone?: string;
  propertyEmail?: string;
  decisionMakerName?: string;
  decisionMakerTitle?: string;
  decisionMakerEmail?: string;
  salesEmail?: string;
  reservationsEmail?: string;
  emailVerified?: boolean;
  verificationStatus?: string;
};

type Recip = {
  email: string;
  first_name: string;
  last_name: string;
  company: string;
  name: string;
  market: Market;
  city?: string;
  website?: string;
  sourceUrl?: string;
  phone?: string;
  person_id?: string | null;
};

const EMAIL_RE = /^[^\s@,]+@[^\s@,]+\.[^\s@,]+$/;
const FREEMAIL = new Set([
  "gmail.com", "googlemail.com", "yahoo.com", "yahoo.co.uk", "hotmail.com",
  "outlook.com", "icloud.com", "aol.com", "protonmail.com", "mail.com",
]);
const SKIP_LOCAL = new Set([
  "privacy", "unsubscribe", "careers", "recruitment", "hr", "noreply", "no-reply", "donotreply",
]);

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function dateLabel(): string {
  return new Date().toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Europe/London",
  });
}

function pickEmail(lead: CuratedLead): string | null {
  for (const raw of [lead.decisionMakerEmail, lead.salesEmail, lead.propertyEmail, lead.reservationsEmail]) {
    const email = String(raw || "").trim().toLowerCase();
    if (!EMAIL_RE.test(email)) continue;
    const local = email.split("@")[0];
    const domain = email.split("@")[1] || "";
    if (SKIP_LOCAL.has(local) || FREEMAIL.has(domain)) continue;
    return email;
  }
  return null;
}

function marketFor(lead: CuratedLead): Market | null {
  const c = (lead.country || "").toLowerCase();
  if (c.includes("united states") || c === "usa" || c === "us") return "US";
  if (c.includes("united kingdom") || c.includes("uk") || c === "gb") return "UK";
  return null;
}

function isVerified(lead: CuratedLead): boolean {
  if (lead.verificationStatus && String(lead.verificationStatus).toLowerCase() !== "verified") return false;
  if (lead.emailVerified === false) return false;
  return !!(lead.propertyEmail || lead.decisionMakerEmail || lead.salesEmail || lead.reservationsEmail);
}

function toRecipients(leads: CuratedLead[], markets: Market[]): { byMarket: Record<Market, Recip[]>; skipped: number } {
  const want = new Set(markets);
  const byMarket: Record<Market, Recip[]> = { US: [], UK: [] };
  const seen = new Set<string>();
  let skipped = 0;
  for (const lead of leads) {
    if (!isVerified(lead)) { skipped++; continue; }
    const email = pickEmail(lead);
    const market = marketFor(lead);
    if (!email || !market || !want.has(market)) { skipped++; continue; }
    if (seen.has(email)) { skipped++; continue; }
    seen.add(email);
    const dm = String(lead.decisionMakerName || "").trim();
    const parts = dm.split(/\s+/).filter(Boolean);
    byMarket[market].push({
      email,
      first_name: parts[0] || "Team",
      last_name: parts.slice(1).join(" ") || "",
      company: String(lead.propertyName || "").trim() || email,
      name: dm || String(lead.propertyName || "").trim() || email,
      market,
      city: lead.city,
      website: lead.website,
      sourceUrl: lead.sourceUrl,
      phone: lead.phone,
    });
  }
  return { byMarket, skipped };
}

function modernEmailHtml(opts: {
  eyebrow: string;
  headline: string;
  intro: string;
  paragraphs: string[];
  bullets: string[];
  ctaLabel: string;
  ctaNote: string;
  footerNote: string;
}): string {
  const paras = opts.paragraphs
    .map((p) => `<p style="margin:0 0 14px;font-size:16px;line-height:1.6;color:#1c1917;">${p}</p>`)
    .join("");
  const bullets = opts.bullets
    .map((b) => `<li style="margin:0 0 8px;font-size:15px;line-height:1.5;color:#292524;">${b}</li>`)
    .join("");
  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f5f0e8;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f0e8;padding:28px 12px;"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fffdf9;border-radius:18px;overflow:hidden;border:1px solid #e7e0d4;">
<tr><td style="padding:28px 28px 18px;background:linear-gradient(135deg,#0f766e 0%,#134e4a 55%,#1c1917 100%);">
<p style="margin:0 0 8px;font-size:12px;letter-spacing:0.14em;text-transform:uppercase;color:#99f6e4;font-family:Georgia,serif;">${opts.eyebrow}</p>
<h1 style="margin:0;font-size:28px;line-height:1.25;color:#fafaf9;font-family:Georgia,'Times New Roman',serif;font-weight:600;">${opts.headline}</h1>
</td></tr>
<tr><td style="padding:28px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#1c1917;">${opts.intro}</p>
${paras}
<ul style="margin:8px 0 20px;padding-left:20px;">${bullets}</ul>
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 16px;"><tr>
<td style="background:#0f766e;border-radius:999px;padding:12px 22px;"><span style="color:#ecfdf5;font-size:14px;font-weight:600;">${opts.ctaLabel}</span></td>
</tr></table>
<p style="margin:0;font-size:14px;line-height:1.5;color:#57534e;">${opts.ctaNote}</p>
</td></tr>
<tr><td style="padding:16px 28px 24px;border-top:1px solid #ebe4d8;">
<p style="margin:0;font-size:12px;line-height:1.5;color:#a8a29e;">${opts.footerNote}</p>
</td></tr>
</table></td></tr></table></body></html>`;
}

function campaignCopy(market: Market) {
  const region = market === "UK" ? "the UK" : "the US";
  const subject =
    market === "UK"
      ? "{{company}} — a simpler way to fill short-stay gaps"
      : "{{company}} — turn empty nights into direct bookings";
  const bodyText = `Hi {{firstName}},

I came across {{company}} while researching hospitality operators across ${region}, and wanted to share a quick idea.

TalkStay helps hotels and short-stay teams convert more direct enquiries — without adding another heavy system to manage.

If useful, I can send a 2-minute overview tailored to {{company}}.

Best regards`;
  const bodyHtml = modernEmailHtml({
    eyebrow: market === "UK" ? "Hospitality · United Kingdom" : "Hospitality · United States",
    headline: market === "UK" ? "Fill short-stay gaps with less friction" : "Turn empty nights into direct bookings",
    intro: "Hi {{firstName}},",
    paragraphs: [
      `I came across <strong>{{company}}</strong> while researching hospitality operators across ${region}.`,
      "TalkStay helps hotels and short-stay teams convert more direct enquiries — without another heavy system to manage.",
    ],
    bullets: [
      "Respond faster to booking and group enquiries",
      "Keep property contacts organised for outreach",
      "Run light, on-brand follow-ups that feel human",
    ],
    ctaLabel: "Happy to send a 2-minute overview",
    ctaNote: "Reply to this email and I’ll tailor it for {{company}}.",
    footerNote: "Sent via LeadBoosters · verified website contacts only",
  });
  return { subject, bodyText, bodyHtml };
}

function newsletterCopy(market: Market) {
  const title = `Hospitality brief · ${market}`;
  const subject = market === "UK" ? "This week in UK hospitality ops" : "This week in US hospitality ops";
  const bodyText = `Hospitality brief for ${market}\n\nOps notes for property and sales teams. Reply to tailor the next edition.`;
  const bodyHtml = modernEmailHtml({
    eyebrow: `Daily hospitality · ${market}`,
    headline: market === "UK" ? "Your UK hospitality brief" : "Your US hospitality brief",
    intro: "Quick ops notes for property and sales teams.",
    paragraphs: [
      "Direct enquiry response time still wins more bookings than rate tweaks alone.",
      "Group and events inboxes convert better when ownership is clear on every property.",
      "A short weekly touchpoint with warm prospects beats one-off blasts.",
    ],
    bullets: [
      "Prioritise verified decision-maker inboxes",
      "Keep US and UK lists separate for tone and timing",
      "Use rotating modern templates so editions feel fresh",
    ],
    ctaLabel: "Want this tailored?",
    ctaNote: "Reply with your property type and city — we’ll personalise the next edition.",
    footerNote: "LeadBoosters hospitality newsletter · unsubscribe anytime",
  });
  return { title, subject, bodyHtml, bodyText };
}

function personalize(tpl: string, r: Recip): string {
  if (!tpl) return "";
  const full = [r.first_name, r.last_name].filter(Boolean).join(" ") || r.name || r.email;
  return tpl
    .replace(/\{\{\s*firstName\s*\}\}/gi, r.first_name || full.split(" ")[0] || "")
    .replace(/\{\{\s*lastName\s*\}\}/gi, r.last_name || "")
    .replace(/\{\{\s*fullName\s*\}\}/gi, full)
    .replace(/\{\{\s*name\s*\}\}/gi, full)
    .replace(/\{\{\s*company\s*\}\}/gi, r.company || "")
    .replace(/\{\{\s*email\s*\}\}/gi, r.email || "");
}

async function mapPool<T, R>(items: T[], limit: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out = new Array(items.length) as R[];
  let idx = 0;
  async function worker() {
    while (idx < items.length) {
      const i = idx++;
      out[i] = await fn(items[i]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length || 1) }, worker));
  return out;
}

async function ensurePersonCompany(db: any, userId: string, r: Recip): Promise<string | null> {
  const email = r.email;
  const first = r.first_name || "Contact";
  const last = r.last_name || "";
  const fullName = [first, last].filter(Boolean).join(" ") || email;

  const { data: person } = await db.from("people").select("id, company_id").eq("user_id", userId).eq("email", email).maybeSingle();
  let personId: string | null = person?.id ?? null;
  let companyId: string | null = person?.company_id ?? null;

  if (!companyId) {
    const companyName = r.company || email;
    const { data: existingCo } = await db.from("companies").select("id").eq("user_id", userId).eq("name", companyName).maybeSingle();
    if (existingCo?.id) companyId = existingCo.id;
    else {
      const { data: co } = await db.from("companies").insert({
        user_id: userId,
        name: companyName,
        website: r.website || null,
        company_phone: r.phone || null,
        general_email: email,
        headquarters: r.city || null,
        geography: r.city || null,
        industry: "Hospitality",
        tags: ["Hospitality Leads"],
        enrichment_data: {
          source: "hospitality_ingest",
          email_verified: true,
          source_url: r.sourceUrl || null,
        },
      }).select("id").single();
      companyId = co?.id ?? null;
    }
  }
  if (!companyId) return personId;

  if (personId) {
    if (!person?.company_id) await db.from("people").update({ company_id: companyId }).eq("id", personId);
  } else {
    const { data: np } = await db.from("people").insert({
      user_id: userId, email, first_name: first, last_name: last, company_id: companyId,
    }).select("id").single();
    personId = np?.id ?? null;
  }

  const { data: ec } = await db.from("contacts").select("id, email_verified").eq("company_id", companyId).eq("email", email).maybeSingle();
  if (ec?.id) {
    if (!ec.email_verified) await db.from("contacts").update({ email_verified: true }).eq("id", ec.id);
  } else {
    await db.from("contacts").insert({
      company_id: companyId, name: fullName, email, email_verified: true, is_primary_contact: true,
    });
  }
  return personId;
}

async function createGroup(db: any, userId: string, name: string, description: string, recips: Recip[]) {
  const { data: grp, error } = await db.from("recipient_groups").insert({
    user_id: userId, name, description,
  }).select("id, name").single();
  if (error || !grp) throw new Error(error?.message || "Failed to create group");
  for (let i = 0; i < recips.length; i += 400) {
    const slice = recips.slice(i, i + 400).map((r) => ({
      group_id: grp.id,
      email: r.email,
      first_name: r.first_name || null,
      last_name: r.last_name || null,
      company: r.company || null,
      person_id: r.person_id || null,
    }));
    const { error: mErr } = await db.from("recipient_group_members").insert(slice);
    if (mErr) throw new Error(mErr.message);
  }
  return { id: grp.id as string, name: grp.name as string, members: recips.length };
}

async function createCampaign(db: any, userId: string, market: Market, recips: Recip[], scheduleAt: string | null) {
  const copy = campaignCopy(market);
  const label = dateLabel();
  const status = scheduleAt ? "scheduled" : "draft";
  const { data: campaign, error } = await db.from("email_campaigns").insert({
    user_id: userId,
    name: `Hospitality ${market} outreach · ${label}`,
    subject_template: copy.subject,
    body_html_template: copy.bodyHtml,
    body_text_template: copy.bodyText,
    status,
    scheduled_at: scheduleAt,
    total_recipients: recips.length,
    tags: ["Hospitality Leads", `Hospitality ${market}`],
  }).select("id, name, status").single();
  if (error || !campaign) throw new Error(error?.message || "Failed to create campaign");

  const rows = recips.map((r) => {
    const nm = [r.first_name, r.last_name].filter(Boolean).join(" ") || r.name || r.email;
    return {
      campaign_id: campaign.id,
      email: r.email,
      name: nm,
      person_id: r.person_id || null,
      personalized_subject: personalize(copy.subject, r),
      personalized_body_html: personalize(copy.bodyHtml, r),
      personalized_body_text: personalize(copy.bodyText, r),
      status: "pending",
    };
  });
  for (let i = 0; i < rows.length; i += 500) {
    const { error: rErr } = await db.from("email_campaign_recipients").insert(rows.slice(i, i + 500));
    if (rErr) throw new Error(rErr.message);
  }
  return { id: campaign.id as string, name: campaign.name as string, status: campaign.status as string, recipients: recips.length };
}

async function createNewsletter(db: any, userId: string, market: Market, groupId: string, scheduleAt: string | null) {
  const copy = newsletterCopy(market);
  const status = scheduleAt ? "scheduled" : "draft";
  const { data: nl, error } = await db.from("newsletters").insert({
    user_id: userId,
    title: `${copy.title} · ${dateLabel()}`,
    subject: copy.subject,
    body_html: copy.bodyHtml,
    status,
    scheduled_at: scheduleAt,
    scheduled_send_options: { recipientGroupIds: [groupId] },
  }).select("id, title, status").single();
  if (error || !nl) throw new Error(error?.message || "Failed to create newsletter");
  return { id: nl.id as string, title: nl.title as string, status: nl.status as string };
}

async function upsertNewsletterSeries(db: any, userId: string, market: Market, groupId: string) {
  const name = `Hospitality ${market} daily brief`;
  const topic = market === "UK"
    ? "UK hospitality operations, short-stay filling tips, and boutique hotel sales ideas for GMs and sales leads"
    : "US hospitality operations, direct bookings, and short-stay sales tips for hotel GMs and revenue managers";

  const { data: existing } = await db.from("newsletter_series")
    .select("id, name, status")
    .eq("user_id", userId)
    .eq("name", name)
    .maybeSingle();

  const payload = {
    duration_days: 365,
    send_time: market === "UK" ? "09:00" : "10:00",
    timezone: market === "UK" ? "Europe/London" : "America/New_York",
    scheduled_send_options: { recipientGroupIds: [groupId] },
    ai_topic_template: topic,
    ai_tone: "modern professional",
    ai_target_audience: `Hospitality decision makers in the ${market}`,
    template_styles: ["modern", "elegant", "minimal", "professional"],
    updated_at: new Date().toISOString(),
  };

  if (existing?.id) {
    await db.from("newsletter_series").update(payload).eq("id", existing.id);
    return { id: existing.id as string, name, status: existing.status as string, created: false };
  }

  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/London" });
  const { data: series, error } = await db.from("newsletter_series").insert({
    user_id: userId,
    name,
    start_date: today,
    status: "active",
    ...payload,
  }).select("id, name, status").single();
  if (error || !series) throw new Error(error?.message || "Failed to create newsletter series");
  return { id: series.id as string, name: series.name as string, status: series.status as string, created: true };
}

async function syncNewsletterSubscribers(db: any, userId: string, recips: Recip[]) {
  for (let i = 0; i < recips.length; i += 100) {
    const slice = recips.slice(i, i + 100);
    for (const r of slice) {
      const { data: existing } = await db.from("newsletter_subscribers")
        .select("id").eq("user_id", userId).eq("email", r.email).maybeSingle();
      if (existing?.id) {
        await db.from("newsletter_subscribers").update({
          status: "active",
          first_name: r.first_name || null,
          last_name: r.last_name || null,
          company: r.company || null,
          industry: "Hospitality",
        }).eq("id", existing.id);
      } else {
        await db.from("newsletter_subscribers").insert({
          user_id: userId,
          email: r.email,
          first_name: r.first_name || null,
          last_name: r.last_name || null,
          company: r.company || null,
          industry: "Hospitality",
          status: "active",
          source: "hospitality_ingest",
        });
      }
    }
  }
}

async function loadLeadsFromUrls(urls: string[]): Promise<CuratedLead[]> {
  const out: CuratedLead[] = [];
  for (const url of urls) {
    try {
      const res = await fetch(url, { headers: { Accept: "application/json" } });
      if (!res.ok) continue;
      const data = await res.json();
      const leads = Array.isArray(data) ? data : data?.leads || [];
      out.push(...leads);
    } catch {
      // ignore bad URLs
    }
  }
  return out;
}

async function runIngest(db: any, userId: string, body: any) {
  const markets: Market[] = Array.isArray(body.markets) && body.markets.length
    ? body.markets.map((m: string) => String(m).toUpperCase()).filter((m: string) => m === "US" || m === "UK")
    : ["US", "UK"];

  let leads: CuratedLead[] = Array.isArray(body.leads) ? body.leads : [];
  if (!leads.length) {
    const urls: string[] = Array.isArray(body.leads_urls) ? body.leads_urls : [];
    if (body.leads_base_url) {
      const base = String(body.leads_base_url).replace(/\/$/, "");
      urls.push(`${base}/data/hospitality-leads/uk-verified-leads.json`);
      urls.push(`${base}/data/hospitality-leads/us-focus-verified-leads.json`);
    }
    if (urls.length) leads = await loadLeadsFromUrls(urls);
  }
  if (!leads.length) {
    return { error: "No leads provided. Pass leads[] or leads_base_url / leads_urls." , status: 400 };
  }

  const createCrm = body.create_crm !== false && body.createCrm !== false;
  const createCampaigns = body.create_campaigns !== false && body.createCampaigns !== false;
  const createNewsletters = body.create_newsletters !== false && body.createNewsletters !== false;
  const createSeries = body.create_newsletter_series !== false && body.createNewsletterSeries !== false;
  const scheduleAt = body.schedule_at || body.scheduleAt || null;

  const { byMarket, skipped } = toRecipients(leads, markets);
  const label = dateLabel();
  const result: any = {
    skipped,
    markets: {},
    message: "",
  };

  for (const market of markets) {
    const recips = byMarket[market];
    if (!recips.length) {
      result.markets[market] = { recipients: 0, skipped: true };
      continue;
    }

    if (createCrm) {
      const ids = await mapPool(recips, 6, (r) => ensurePersonCompany(db, userId, r).catch(() => null));
      recips.forEach((r, i) => { r.person_id = ids[i] || null; });
    }

    const group = await createGroup(
      db,
      userId,
      `Hospitality ${market} · verified · ${label}`,
      `Auto-created from hospitality ingest (${market}). Website-verified emails only. Ready for campaigns and daily newsletters.`,
      recips,
    );

    await syncNewsletterSubscribers(db, userId, recips).catch(() => {});

    let campaign = null;
    if (createCampaigns) {
      campaign = await createCampaign(db, userId, market, recips, scheduleAt);
    }

    let newsletter = null;
    if (createNewsletters) {
      newsletter = await createNewsletter(db, userId, market, group.id, scheduleAt);
    }

    let series = null;
    if (createSeries) {
      series = await upsertNewsletterSeries(db, userId, market, group.id);
    }

    result.markets[market] = {
      recipients: recips.length,
      group,
      campaign,
      newsletter,
      series,
    };
  }

  result.message = "Hospitality ingest complete. Groups are ready for campaigns and daily newsletter sending.";
  return { result, status: 200 };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const xApiKey = (req.headers.get("x-api-key") || "").trim();
    const authHeader = req.headers.get("authorization") || "";
    const bearer = authHeader.replace(/^Bearer\s+/i, "").trim();

    const body = await req.json().catch(() => ({}));
    const action = String(body.action || "ingest");

    // Cron / service path for daily processing
    if (action === "daily" && bearer === serviceKey) {
      const { data: settings } = await db.from("hospitality_automation_settings")
        .select("*").eq("enabled", true);
      const outcomes = [];
      for (const s of settings || []) {
        try {
          const ingestBody = {
            markets: s.markets || ["US", "UK"],
            leads_base_url: s.leads_base_url,
            create_crm: s.create_crm !== false,
            create_campaigns: s.create_campaigns !== false,
            create_newsletters: s.create_newsletters !== false,
            create_newsletter_series: s.create_newsletter_series !== false,
          };
          const { result, status } = await runIngest(db, s.user_id, ingestBody);
          await db.from("hospitality_automation_settings").update({
            last_run_at: new Date().toISOString(),
            last_run_result: result,
          }).eq("user_id", s.user_id);
          outcomes.push({ user_id: s.user_id, status, result });
        } catch (e: any) {
          outcomes.push({ user_id: s.user_id, error: e?.message || "failed" });
        }
      }
      return json({ processed: outcomes.length, outcomes });
    }

    // User auth
    let userId: string;
    if (xApiKey.startsWith("lb_live_") || bearer.startsWith("lb_live_")) {
      const rawKey = xApiKey.startsWith("lb_live_") ? xApiKey : bearer;
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
      return json({ error: "Missing or invalid auth" }, 401);
    }

    if (action === "enable_daily") {
      const row = {
        user_id: userId,
        enabled: true,
        markets: Array.isArray(body.markets) ? body.markets : ["US", "UK"],
        leads_base_url: body.leads_base_url || body.leadsBaseUrl || null,
        create_crm: body.create_crm !== false,
        create_campaigns: body.create_campaigns !== false,
        create_newsletters: body.create_newsletters !== false,
        create_newsletter_series: body.create_newsletter_series !== false,
        updated_at: new Date().toISOString(),
      };
      const { error } = await db.from("hospitality_automation_settings").upsert(row, { onConflict: "user_id" });
      if (error) return json({ error: error.message }, 500);
      return json({ ok: true, enabled: true, message: "Daily hospitality ingest enabled. Cron will create campaign-ready groups for verified emails." });
    }

    if (action === "disable_daily") {
      const { error } = await db.from("hospitality_automation_settings")
        .upsert({ user_id: userId, enabled: false, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
      if (error) return json({ error: error.message }, 500);
      return json({ ok: true, enabled: false });
    }

    if (action === "status") {
      const { data } = await db.from("hospitality_automation_settings").select("*").eq("user_id", userId).maybeSingle();
      return json({ settings: data || { enabled: false } });
    }

    if (action === "ingest" || action === "create") {
      const { result, status } = await runIngest(db, userId, body);
      if (status !== 200) return json(result, status);
      return json(result);
    }

    return json({ error: "Unknown action. Use ingest | enable_daily | disable_daily | status | daily." }, 400);
  } catch (e: any) {
    return json({ error: e?.message || "Failed" }, 500);
  }
});
