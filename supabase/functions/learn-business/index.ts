// Learn a business from its website (or pasted text) and propose the Business
// Profile fields plus a knowledge base used to ground every AI-written message.
//
//   POST { url, apply?: boolean, overwrite?: boolean, text?: string }
//   Auth: owner JWT, or service role + x-user-id (API / MCP).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const OPENAI_KEY = (Deno.env.get("OPENAI_API_KEY") || "").trim();
const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const UA = "Mozilla/5.0 (compatible; LeadBoostersBot/1.0; +https://leadboosters.bizboosters.co.uk)";
const INTERESTING = /about|service|product|solution|pricing|price|plans|team|who-we-are|what-we-do|faq|contact|menu|rooms|offer/i;

function stripHtml(html: string): { title: string; description: string; text: string; links: string[]; logo: string | null; themeColor: string | null; ogImage: string | null } {
  const title = (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "").replace(/\s+/g, " ").trim();
  const meta = (name: string) => html.match(new RegExp(`<meta[^>]+(?:name|property)=["']${name}["'][^>]+content=["']([^"']*)["']`, "i"))?.[1] || html.match(new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+(?:name|property)=["']${name}["']`, "i"))?.[1] || "";
  const description = meta("description") || meta("og:description");
  const ogImage = meta("og:image") || null;
  const themeColor = meta("theme-color") || null;
  const logo = html.match(/<img[^>]+(?:src|data-src)=["']([^"']+)["'][^>]*(?:alt=["'][^"']*logo[^"']*["']|class=["'][^"']*logo[^"']*["'])/i)?.[1]
    || html.match(/<img[^>]+(?:alt|class)=["'][^"']*logo[^"']*["'][^>]+(?:src|data-src)=["']([^"']+)["']/i)?.[1]
    || html.match(/<img[^>]+(?:src|data-src)=["']([^"']*logo[^"']*)["']/i)?.[1] || null;
  const links = Array.from(html.matchAll(/<a[^>]+href=["']([^"'#?]+)["']/gi)).map((m) => m[1]);
  let text = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<(nav|footer|header)[\s\S]*?<\/\1>/gi, (m) => m.length > 4000 ? " " : m)
    .replace(/<br\s*\/?>|<\/(p|div|li|h[1-6]|tr|section|article)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"')
    .replace(/[ \t]+/g, " ").replace(/\n\s*\n+/g, "\n").trim();
  return { title, description, text, links, logo, themeColor, ogImage };
}

async function fetchPage(url: string): Promise<string | null> {
  try {
    const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 9000);
    const r = await fetch(url, { headers: { "User-Agent": UA, Accept: "text/html,*/*" }, redirect: "follow", signal: ctrl.signal });
    clearTimeout(t);
    if (!r.ok) return null;
    const ct = r.headers.get("content-type") || "";
    if (!ct.includes("html") && !ct.includes("text")) return null;
    return (await r.text()).slice(0, 600_000);
  } catch { return null; }
}

// Script-rendered sites (React/Vite/Next SPAs) ship almost no text in their HTML.
// Fall back to a rendering reader that returns the page as plain text/markdown.
async function fetchRendered(url: string): Promise<{ text: string; links: string[]; title: string } | null> {
  try {
    const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 20000);
    const r = await fetch(`https://r.jina.ai/${url}`, { headers: { Accept: "text/plain", "User-Agent": UA, "X-Return-Format": "markdown" }, signal: ctrl.signal });
    clearTimeout(t);
    if (!r.ok) return null;
    const md = (await r.text()).slice(0, 200_000);
    const title = md.match(/^Title:\s*(.+)$/m)?.[1]?.trim() || "";
    const links = Array.from(md.matchAll(/\((https?:\/\/[^)\s]+)\)/g)).map((m) => m[1]);
    const text = md.replace(/^(Title|URL Source|Published Time|Markdown Content):.*$/gm, "").replace(/!\[[^\]]*\]\([^)]*\)/g, " ").replace(/\[([^\]]*)\]\([^)]*\)/g, "$1").replace(/[ \t]+/g, " ").replace(/\n\s*\n+/g, "\n").trim();
    return { text, links, title };
  } catch { return null; }
}

async function sitemapLinks(origin: string): Promise<string[]> {
  try {
    const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 6000);
    const r = await fetch(`${origin}/sitemap.xml`, { headers: { "User-Agent": UA }, signal: ctrl.signal });
    clearTimeout(t);
    if (!r.ok) return [];
    const xml = await r.text();
    return Array.from(xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)).map((m) => m[1]).slice(0, 200);
  } catch { return []; }
}

const plainLen = (t: string) => t.replace(/\s+/g, " ").trim().length;

function normaliseUrl(raw: string): string | null {
  let u = String(raw || "").trim();
  if (!u) return null;
  if (!/^https?:\/\//i.test(u)) u = "https://" + u;
  try { const p = new URL(u); if (!/\./.test(p.hostname)) return null; return p.toString(); } catch { return null; }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const db = createClient(SUPABASE_URL, SERVICE_KEY);
    const authHeader = req.headers.get("Authorization") || "";
    const actAs = (req.headers.get("x-user-id") || "").trim();
    let userId: string;
    if (authHeader === `Bearer ${SERVICE_KEY}` && actAs) userId = actAs;
    else {
      const anon = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
      const { data: { user } } = await anon.auth.getUser();
      if (!user) return json({ error: "Unauthorized" }, 401);
      userId = user.id;
    }
    if (!OPENAI_KEY) return json({ error: "AI is not configured (OPENAI_API_KEY missing)" }, 500);

    const body = await req.json().catch(() => ({}));
    const pastedText = String(body.text || "").trim();
    const url = normaliseUrl(body.url);
    if (!url && !pastedText) return json({ error: "Provide a website url (or text about the business)" }, 400);

    // ── Crawl: homepage + up to 5 relevant same-site pages
    const pages: { url: string; title: string; text: string }[] = [];
    let logo: string | null = null, themeColor: string | null = null, ogImage: string | null = null, homeDescription = "";
    if (url) {
      const home = await fetchPage(url);
      if (!home) return json({ error: `Could not read ${url}. Check the address, or paste a description of the business instead.` }, 400);
      const h = stripHtml(home);
      const origin = new URL(url).origin;
      const abs = (l: string) => { try { return new URL(l, url).toString(); } catch { return null; } };
      logo = h.logo ? abs(h.logo) : null; themeColor = h.themeColor; ogImage = h.ogImage ? abs(h.ogImage) : null; homeDescription = h.description;
      let homeText = h.text, homeTitle = h.title, homeLinks = h.links;
      let rendered = false;
      if (plainLen(homeText) < 600) {
        const rr = await fetchRendered(url);
        if (rr && plainLen(rr.text) > plainLen(homeText)) { homeText = rr.text; homeTitle = homeTitle || rr.title; homeLinks = [...homeLinks, ...rr.links]; rendered = true; }
      }
      pages.push({ url, title: homeTitle, text: homeText.slice(0, 9000) });
      const seen = new Set<string>([url.replace(/\/$/, "")]);
      const fromSitemap = homeLinks.length < 5 ? await sitemapLinks(origin) : [];
      const candidates = [...homeLinks, ...fromSitemap].map(abs).filter((l): l is string => !!l && l.startsWith(origin) && INTERESTING.test(l) && !/\.(pdf|jpg|png|svg|zip|mp4)$/i.test(l))
        .map((l) => l.replace(/\/$/, "")).filter((l) => !seen.has(l) && seen.add(l)).slice(0, 5);
      const extra = await Promise.all(candidates.map(async (l) => {
        const html = await fetchPage(l);
        let pg = html ? { url: l, ...stripHtml(html) } : null;
        if (rendered || !pg || plainLen(pg.text) < 300) { const rr = await fetchRendered(l); if (rr && plainLen(rr.text) > plainLen(pg?.text || "")) pg = { url: l, title: rr.title, text: rr.text, links: rr.links, description: "", logo: null, themeColor: null, ogImage: null }; }
        return pg;
      }));
      for (const p of extra) if (p && plainLen(p.text) > 200) pages.push({ url: p.url, title: p.title, text: p.text.slice(0, 5000) });
    }
    const corpus = [pastedText ? `PASTED DESCRIPTION:\n${pastedText.slice(0, 8000)}` : "", ...pages.map((p) => `PAGE ${p.url}\nTITLE: ${p.title}\n${p.text}`)].filter(Boolean).join("\n\n").slice(0, 28_000);
    const personaMode = body.mode === "persona";
    if (!personaMode && corpus.replace(/\s+/g, " ").length < 200) return json({ error: "The site returned almost no readable text (it may be fully script-rendered). Paste a description of the business instead." }, 400);

    // ── Current profile (so we fill gaps, not stomp on hand-written text unless asked)
    const { data: current } = await db.from("business_profiles").select("*").eq("user_id", userId).maybeSingle();

    // ── Persona mode: draft an Autopilot target persona (who to find and how to pitch them)
    //    from the website (usually the product being sold), the user's description of the
    //    audience, and the business profile. Nothing is saved; the app fills the form.
    if (personaMode) {
      const SIZES = ["1-10", "11-50", "51-200", "201-500", "501-1000", "1001-5000", "5000+"];
      const ourBusiness = current ? [
        current.company_name && `Company: ${current.company_name}`,
        current.services_description && `What we do: ${current.services_description}`,
        current.value_proposition && `Value proposition: ${current.value_proposition}`,
        current.target_audience && `Usual audience: ${current.target_audience}`,
        current.knowledge_base && `Facts: ${String(current.knowledge_base).slice(0, 3000)}`,
      ].filter(Boolean).join("\n") : "";
      const pp = `You design a lead-discovery persona for a B2B sales team. The persona tells an AI prospecting engine WHICH organisations to find and HOW to pitch them.

Inputs:
- WEBSITE CONTENT: usually the product or service being sold (sometimes the prospect type's own site).
- AUDIENCE NOTES from the user: who they want to reach and why. Treat these as the priority; the website fills in specifics.
- OUR BUSINESS: the seller's profile.

Return STRICT JSON:
{
 "name": string,                       // short, specific label, e.g. "UK housing associations: accessibility compliance"
 "description": string,                // 2-4 sentences: who to target, the problem we solve for them, why now
 "target_industries": string[],        // 3-8 specific sectors/niches a search engine understands (e.g. "Housing associations", "NHS trusts", "Dental clinics")
 "target_geographies": string[],       // 2-8 concrete places: countries AND key cities/regions (e.g. "United Kingdom", "Manchester", "Bristol")
 "target_company_sizes": string[],     // subset of ${JSON.stringify(SIZES)}
 "target_keywords": string[],          // 4-10 search hooks: problems, regulations, roles, triggers (e.g. "WCAG 2.2", "European Accessibility Act", "digital inclusion lead")
 "exclude_industries": string[],       // sectors that look similar but are wrong fits (may be empty)
 "exclude_keywords": string[],         // words that signal a bad fit, e.g. competitors, agencies, job boards (may be empty)
 "custom_search_query": string,        // one plain-English search sentence summarising the ideal prospect
 "product_focus": string,              // the product/service to lead with
 "value_proposition": string,          // 1-2 sentences in the buyer's terms
 "email_tone": "professional"|"casual"|"technical"|"persuasive",
 "talking_points": string[],           // 3-6 short points for outreach copy, grounded in the inputs
 "call_to_action": string              // one clear next step (keep any booking link or email the user gave)
}
Use only facts in the inputs for product claims; never invent statistics or clients. Plain text, no markdown.

AUDIENCE NOTES:
${pastedText || "(none given: infer the best-fit audience from the website and our business)"}

OUR BUSINESS:
${ourBusiness || "(no profile yet)"}

WEBSITE CONTENT:
${pages.length ? pages.map((p) => `PAGE ${p.url}\nTITLE: ${p.title}\n${p.text}`).join("\n\n").slice(0, 22_000) : "(no website given)"}`;
      if (!pastedText && !pages.length) return json({ error: "Give a website link, a description of who you want to reach, or both." }, 400);
      const pr = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST", headers: { Authorization: `Bearer ${OPENAI_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: "gpt-4o", temperature: 0.3, response_format: { type: "json_object" }, messages: [{ role: "system", content: "You design precise B2B prospecting personas. Output JSON only." }, { role: "user", content: pp }] }),
      });
      if (!pr.ok) return json({ error: `AI error: ${(await pr.text()).slice(0, 300)}` }, 502);
      const pd = await pr.json();
      let persona: any = {};
      try { persona = JSON.parse(pd.choices?.[0]?.message?.content || "{}"); } catch { return json({ error: "AI returned something unreadable; try again." }, 502); }
      const arr = (v: unknown, max = 10) => (Array.isArray(v) ? v.map((x) => String(x || "").trim()).filter(Boolean).slice(0, max) : []);
      const clean = {
        name: String(persona.name || "").trim().slice(0, 80),
        description: String(persona.description || "").trim(),
        target_industries: arr(persona.target_industries, 8),
        target_geographies: arr(persona.target_geographies, 8),
        target_company_sizes: arr(persona.target_company_sizes, 7).filter((s) => SIZES.includes(s)),
        target_keywords: arr(persona.target_keywords, 10),
        exclude_industries: arr(persona.exclude_industries, 8),
        exclude_keywords: arr(persona.exclude_keywords, 10),
        custom_search_query: String(persona.custom_search_query || "").trim(),
        product_focus: String(persona.product_focus || "").trim(),
        value_proposition: String(persona.value_proposition || "").trim(),
        email_tone: ["professional", "casual", "technical", "persuasive"].includes(persona.email_tone) ? persona.email_tone : "professional",
        talking_points: arr(persona.talking_points, 6),
        call_to_action: String(persona.call_to_action || "").trim(),
      };
      return json({ persona: clean, pages_read: pages.map((p) => p.url) });
    }

    const prompt = `You are setting up a CRM for a business from its website content. Return STRICT JSON with these keys:
{
 "company_name": string,                      // the trading name as the site uses it
 "industry": string,                          // 2-4 words
 "services_description": string,              // 1-3 sentences, concrete: what they sell/do, for whom, where
 "target_audience": string,                   // who buys: segments, roles, locations (one sentence or comma list)
 "value_proposition": string,                 // 1-2 sentences, their strongest differentiators in their own voice
 "tone_preference": "professional"|"friendly"|"casual"|"technical"|"luxury",
 "website": string,                           // canonical site url
 "phone": string|null, "email": string|null,  // public contact details if present
 "locations": string|null,                    // towns/cities/countries served
 "offerings": [{"name": string, "summary": string, "price": string|null}],   // up to 8 products/services/plans
 "proof_points": string[],                    // awards, numbers, notable clients, guarantees (max 6, only if stated)
 "faqs": [{"q": string, "a": string}],        // up to 6, only if present on the site
 "suggested_email_signature": string,         // 2-3 lines: name placeholder, role, company, phone/site
 "knowledge_base": string                     // AT LEAST 300 words (up to 600) of plain-text facts an assistant needs to write accurate, on-brand emails and texts. Cover, in short paragraphs: who they are and where; EVERY offering/product/service found with one or two lines each (and prices if shown); who each is for; how working with them works (process, free audits/trials, contact routes); USPs; proof points; common questions answered. No marketing fluff, no invented facts.
}
Only use facts present in the content; if unknown use null/empty. Content:\n\n${corpus}`;

    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST", headers: { Authorization: `Bearer ${OPENAI_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "gpt-4o", temperature: 0.2, response_format: { type: "json_object" }, messages: [{ role: "system", content: "You extract accurate, structured business information. Output JSON only." }, { role: "user", content: prompt }] }),
    });
    if (!r.ok) return json({ error: `AI error: ${(await r.text()).slice(0, 300)}` }, 502);
    const d = await r.json();
    let learned: any = {};
    try { learned = JSON.parse(d.choices?.[0]?.message?.content || "{}"); } catch { return json({ error: "AI returned something unreadable; try again." }, 502); }

    const proposal: Record<string, unknown> = {
      company_name: learned.company_name || current?.company_name || null,
      industry: learned.industry || null,
      services_description: learned.services_description || null,
      target_audience: learned.target_audience || null,
      value_proposition: learned.value_proposition || null,
      tone_preference: learned.tone_preference || null,
      website: learned.website || url || current?.website || null,
      phone: learned.phone || null,
      email_signature: learned.suggested_email_signature || null,
      email_brand_color: themeColor && /^#?[0-9a-f]{3,8}$/i.test(themeColor) ? (themeColor.startsWith("#") ? themeColor : `#${themeColor}`) : null,
      email_logo_url: logo || null,
      knowledge_base: learned.knowledge_base || null,
    };
    const extras = { locations: learned.locations || null, offerings: learned.offerings || [], proof_points: learned.proof_points || [], faqs: learned.faqs || [], og_image: ogImage, pages_read: pages.map((p) => p.url), home_description: homeDescription, chars_read: plainLen(corpus) };

    let applied: Record<string, unknown> | null = null;
    if (body.apply === true) {
      const overwrite = body.overwrite === true;
      const fields: Record<string, unknown> = { user_id: userId, website_learned_at: new Date().toISOString(), learned_from_url: url || null, updated_at: new Date().toISOString() };
      for (const [k, v] of Object.entries(proposal)) {
        if (v == null || v === "") continue;
        if (k === "email_logo_url" && !overwrite && current?.email_logo_url) continue; // never replace an uploaded logo silently
        const cur = current?.[k];
        if (overwrite || cur == null || String(cur).trim() === "") fields[k] = v;
      }
      // knowledge_base: always refresh (it is derived), but keep hand-written notes appended below a marker
      if (proposal.knowledge_base) {
        const handNotes = String(current?.knowledge_base || "").split("\n---\nMY NOTES\n")[1];
        fields.knowledge_base = String(proposal.knowledge_base) + (handNotes ? `\n---\nMY NOTES\n${handNotes}` : "");
      }
      const { error } = current
        ? await db.from("business_profiles").update(fields).eq("user_id", userId)
        : await db.from("business_profiles").insert(fields);
      if (error) return json({ error: `Could not save profile: ${error.message}` }, 500);
      applied = fields;
    }

    return json({ success: true, url, proposal, extras, applied, message: applied ? "Business profile updated from your website." : "Proposal ready. Review it and apply." });
  } catch (e) {
    return json({ error: (e as Error)?.message || "Failed" }, 500);
  }
});
