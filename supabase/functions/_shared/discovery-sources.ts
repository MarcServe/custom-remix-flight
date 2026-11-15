// Lead-discovery sources shared by Autopilot (autonomous-lead-discovery) and the
// assistant tools (api-campaigns find_leads). Every source returns plain lead
// objects: { name, website, description?, industry?, geography?, companyPhone?,
// generalEmail?, qualityScore, source }.

export interface SourceLead { name: string; website?: string | null; description?: string; industry?: string; geography?: string; address?: string; companyPhone?: string | null; generalEmail?: string | null; rating?: number; reviews?: number; qualityScore: number; source: string; [k: string]: unknown }

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

export function domainOf(url: unknown): string | null {
  const s = String(url || "").trim();
  if (!s || s.includes("no-website")) return null;
  try { return new URL(s.startsWith("http") ? s : `https://${s}`).hostname.replace(/^www\./, "").toLowerCase() || null; } catch { return null; }
}

/** What this user has already got, so sources can skip it and the planner can avoid it. */
export async function knownCompanies(db: any, userId: string): Promise<{ domains: Set<string>; names: Set<string>; recentNames: string[]; recentDomains: string[] }> {
  const [{ data: companies }, { data: auto }] = await Promise.all([
    db.from("companies").select("name, website, created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(3000),
    db.from("autonomous_leads").select("company_name, company_website, created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(3000),
  ]);
  const domains = new Set<string>(); const names = new Set<string>(); const recentNames: string[] = []; const recentDomains: string[] = [];
  const add = (name: unknown, site: unknown, recent: boolean) => {
    const n = String(name || "").trim().toLowerCase(); const d = domainOf(site);
    if (n) { names.add(n); if (recent && recentNames.length < 150) recentNames.push(String(name)); }
    if (d) { domains.add(d); if (recent && recentDomains.length < 150) recentDomains.push(d); }
  };
  const cutoff = Date.now() - 45 * 86_400_000;
  for (const c of companies || []) add(c.name, c.website, new Date(c.created_at).getTime() > cutoff);
  for (const l of auto || []) add(l.company_name, l.company_website, new Date(l.created_at).getTime() > cutoff);
  return { domains, names, recentNames, recentDomains };
}

export async function recentQueries(db: any, userId: string, days = 21): Promise<string[]> {
  const { data } = await db.from("discovery_runs").select("search_queries").eq("user_id", userId).gte("started_at", new Date(Date.now() - days * 86_400_000).toISOString()).order("started_at", { ascending: false }).limit(40);
  const out: string[] = [];
  for (const r of data || []) for (const q of (Array.isArray(r.search_queries) ? r.search_queries : [])) { const s = typeof q === "string" ? q : q?.query; if (s) out.push(String(s)); }
  return out;
}

export function isKnown(lead: { name?: string; website?: string | null }, known: { domains: Set<string>; names: Set<string> }): boolean {
  const d = domainOf(lead.website); const n = String(lead.name || "").trim().toLowerCase();
  return (!!d && known.domains.has(d)) || (!!n && known.names.has(n));
}

/** Streams leads from lead-finder; returns whatever arrived by the deadline. */
export async function searchWithLeadFinder(params: Record<string, unknown>, timeoutMs = 95_000): Promise<{ leads: SourceLead[]; error?: string; timedOut?: boolean }> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  const leads: SourceLead[] = [];
  let timedOut = false;
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/lead-finder`, {
      method: "POST", signal: ctrl.signal,
      headers: { Authorization: `Bearer ${SERVICE_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ dryRun: true, provider: "openai", model: "gpt-4o-mini", enrichWithPerplexity: false, autonomousMode: true, ...params }),
    });
    if (!res.ok) return { leads, error: `lead-finder ${res.status}: ${(await res.text()).slice(0, 200)}` };
    const reader = res.body?.getReader(); if (!reader) return { leads };
    const dec = new TextDecoder(); let buf = "";
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      buf += dec.decode(value, { stream: true });
      const lines = buf.split("\n"); buf = lines.pop() || "";
      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        try {
          const ev = JSON.parse(line.slice(6));
          if (ev.type === "lead" && ev.lead) leads.push(ev.lead);
          if (ev.type === "batch" && ev.leads) leads.push(...ev.leads);
          if (ev.type === "lead-update" && ev.lead) { const i = leads.findIndex((l) => l.name === ev.lead.name); if (i >= 0) leads[i] = ev.lead; else leads.push(ev.lead); }
        } catch { /* ignore */ }
      }
    }
  } catch (e) {
    if ((e as Error)?.name === "AbortError") timedOut = true; else return { leads, error: String((e as Error)?.message || e) };
  } finally { clearTimeout(timer); }
  return { leads: leads.map((l) => ({ ...l, source: l.source || "lead-finder", qualityScore: Number(l.qualityScore) || 30 })), timedOut };
}

/** Perplexity (sonar) as a discovery source: asks for real companies with websites, as JSON. */
export async function searchWithPerplexity(query: string, geography: string, industry: string, n = 20, avoid: string[] = []): Promise<{ leads: SourceLead[]; error?: string }> {
  const key = (Deno.env.get("PERPLEXITY_API_KEY") || "").trim();
  if (!key) return { leads: [], error: "PERPLEXITY_API_KEY not configured" };
  const schema = { type: "object", properties: { companies: { type: "array", items: { type: "object", properties: { name: { type: "string" }, website: { type: "string" }, city: { type: "string" }, industry: { type: "string" }, description: { type: "string" }, phone: { type: "string" }, email: { type: "string" } }, required: ["name", "website"] } } }, required: ["companies"] };
  const prompt = `List ${n} real, currently operating companies or organisations matching: "${query}"${geography ? ` in ${geography}` : ""}${industry ? ` (sector: ${industry})` : ""}. ` +
    `Only include organisations that have their own website (give the official homepage URL, not LinkedIn, directories or social pages). Prefer small and mid-sized independent businesses over global brands. ` +
    (avoid.length ? `Do NOT include any of these: ${avoid.slice(0, 60).join("; ")}. ` : "") +
    `For each give: name, website, city, industry, a one-sentence description, and a public phone or general email if shown on their site. Return JSON only.`;
  try {
    const body = JSON.stringify({ model: "sonar", temperature: 0.2, max_tokens: 3500, messages: [{ role: "system", content: "You are a meticulous business researcher. Only list organisations you can verify exist." }, { role: "user", content: prompt }], response_format: { type: "json_schema", json_schema: { schema } } });
    let r: Response | null = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      if (attempt) await new Promise((res) => setTimeout(res, 2500 * attempt));
      r = await fetch("https://api.perplexity.ai/chat/completions", { method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, body });
      if (r.status !== 429) break;
    }
    if (!r) return { leads: [], error: "Perplexity: no response" };
    if (!r.ok) return { leads: [], error: `Perplexity ${r.status}: ${(await r.text()).slice(0, 200)}` };
    const d = await r.json();
    let content = String(d.choices?.[0]?.message?.content || "");
    content = content.replace(/^```(?:json)?/m, "").replace(/```$/m, "").trim();
    const start = content.indexOf("{"); if (start > 0) content = content.slice(start);
    const parsed = JSON.parse(content);
    const leads: SourceLead[] = [];
    for (const c of parsed.companies || []) {
      const site = String(c.website || "").trim(); const dom = domainOf(site);
      if (!c.name || !dom || /linkedin\.com|facebook\.com|crunchbase\.com|yelp\.|yell\.com|wikipedia\.org|instagram\.com|x\.com|twitter\.com/i.test(dom)) continue;
      leads.push({ name: String(c.name).trim(), website: site.startsWith("http") ? site : `https://${site}`, description: c.description || undefined, industry: c.industry || industry || undefined, geography: c.city ? `${c.city}${geography ? `, ${geography}` : ""}` : geography || undefined, companyPhone: c.phone || null, generalEmail: c.email && /@/.test(c.email) ? String(c.email).toLowerCase() : null, qualityScore: 55 + (c.email ? 10 : 0) + (c.phone ? 5 : 0), source: "perplexity" });
    }
    return { leads };
  } catch (e) { return { leads: [], error: `Perplexity: ${String((e as Error)?.message || e)}` }; }
}

/** Apify Google Maps scraper; surfaces auth/plan errors instead of swallowing them. */
export async function searchWithApifyMaps(query: string, location: string, max = 60, timeoutMs = 90_000): Promise<{ leads: SourceLead[]; error?: string }> {
  const token = (Deno.env.get("APIFY_API_TOKEN") || "").trim();
  if (!token) return { leads: [], error: "APIFY_API_TOKEN not configured" };
  const ctrl = new AbortController(); const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(`https://api.apify.com/v2/acts/nwua9Gu5YrADL7ZDj/run-sync-get-dataset-items?token=${encodeURIComponent(token)}&timeout=${Math.floor(timeoutMs / 1000)}`, {
      method: "POST", signal: ctrl.signal, headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ searchStringsArray: [`${query} in ${location}`], maxCrawledPlacesPerSearch: Math.min(max, 300), language: "en", maxImages: 0, maxReviews: 0 }),
    });
    if (r.status === 401 || r.status === 403) return { leads: [], error: `Apify rejected the token (${r.status}). Renew APIFY_API_TOKEN in Supabase secrets or turn off Google Maps in Autopilot settings.` };
    if (!r.ok) return { leads: [], error: `Apify ${r.status}: ${(await r.text()).slice(0, 200)}` };
    const places = await r.json();
    const leads: SourceLead[] = (Array.isArray(places) ? places : []).map((p: any) => ({
      name: p.title || p.name || "", website: p.website || null, companyPhone: p.phone || null, generalEmail: null, address: p.address, geography: p.city || location,
      industry: p.categoryName || p.categories?.[0], rating: p.totalScore, reviews: p.reviewsCount,
      qualityScore: Math.min(100, 40 + (p.website ? 25 : 0) + (p.phone ? 10 : 0) + Math.min(25, Math.round((p.reviewsCount || 0) / 4))), source: "apify",
    })).filter((l: SourceLead) => l.name);
    return { leads };
  } catch (e) { return { leads: [], error: (e as Error)?.name === "AbortError" ? "Apify timed out" : `Apify: ${String((e as Error)?.message || e)}` }; }
  finally { clearTimeout(timer); }
}

export function dedupeLeads(leads: SourceLead[]): SourceLead[] {
  const seen = new Map<string, SourceLead>();
  for (const lead of leads) {
    const key = domainOf(lead.website) || String(lead.name || "").toLowerCase().trim();
    if (!key) continue;
    const prev = seen.get(key);
    if (!prev) { seen.set(key, { ...lead, sources_used: [lead.source] }); continue; }
    const merged = (lead.qualityScore || 0) > (prev.qualityScore || 0) ? { ...prev, ...lead } : { ...lead, ...prev };
    merged.generalEmail = prev.generalEmail || lead.generalEmail || null; merged.companyPhone = prev.companyPhone || lead.companyPhone || null; merged.website = prev.website || lead.website || null;
    merged.sources_used = [...new Set([...(prev.sources_used as string[] || [prev.source]), lead.source])];
    merged.qualityScore = Math.min(100, Math.max(prev.qualityScore || 0, lead.qualityScore || 0) + 5);
    seen.set(key, merged);
  }
  return [...seen.values()];
}
