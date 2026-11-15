// Plans the day's lead-discovery searches so Autopilot does not run the same
// query every morning (which returns the same companies, all of which are then
// thrown away as duplicates). Uses OpenAI when available, otherwise rotates
// through industry × geography × keyword combinations.

export interface PlannedQuery {
  query: string;        // main web-search phrase
  alt_query?: string;   // a second phrasing for the same angle
  industry: string;
  geography: string;    // concrete: a city/region + country where possible
  size?: string;
  angle: string;        // why this angle should surface new companies
  maps_query?: string;  // Google Maps-style business type, e.g. "dental clinic"
  maps_location?: string;
}

export interface PlanInput {
  persona?: {
    name?: string; description?: string | null; target_industries?: string[] | null; target_geographies?: string[] | null;
    target_company_sizes?: string[] | null; target_keywords?: string[] | null; custom_search_query?: string | null;
    exclude_industries?: string[] | null; exclude_keywords?: string[] | null;
  } | null;
  setting: Record<string, any>;
  businessProfile?: Record<string, any> | null;
  recentCompanies: string[];   // names/domains found recently (avoid)
  recentQueries: string[];     // queries used recently (avoid repeating)
  count: number;
}

const TITLE_FIX: Record<string, string> = { uk: "United Kingdom", usa: "United States", us: "United States", gb: "United Kingdom" };
export function cleanTerm(s: unknown): string {
  let t = String(s ?? "").trim().replace(/[.\s]+$/g, "").replace(/\s+/g, " ");
  if (!t) return "";
  const low = t.toLowerCase();
  if (TITLE_FIX[low]) return TITLE_FIX[low];
  // Fix shouty/odd casing like "United KIngdom" while leaving acronyms (WCAG, NHS) alone
  if (/[a-z]/.test(t) && /\b[A-Z]{2,}[a-z]/.test(t)) t = t.replace(/\b([A-Z])([A-Z]+)([a-z]+)/g, (_m, a, b, c) => a + (b + c).toLowerCase());
  return t;
}
const cleanList = (v: unknown): string[] => (Array.isArray(v) ? v : []).map(cleanTerm).filter(Boolean);

function dayIndex(): number { return Math.floor(Date.now() / 86_400_000); }

/** Deterministic fallback: rotate combinations so each day covers a different slice. */
export function rotationPlan(input: PlanInput): PlannedQuery[] {
  const p = input.persona || {};
  const s = input.setting || {};
  const industries = cleanList(p.target_industries).length ? cleanList(p.target_industries) : cleanList(s.target_industries);
  const geos = cleanList(p.target_geographies).length ? cleanList(p.target_geographies) : cleanList(s.target_geographies);
  const keywords = cleanList(p.target_keywords);
  const sizes = cleanList(p.target_company_sizes).length ? cleanList(p.target_company_sizes) : cleanList(s.target_company_sizes);
  const base = cleanTerm(p.custom_search_query || s.custom_search_query || "");
  const inds = industries.length ? industries : [base || input.businessProfile?.target_audience || "growing businesses"];
  const gs = geos.length ? geos : ["United Kingdom"];
  const kws = keywords.length ? keywords : [""];
  const combos: PlannedQuery[] = [];
  for (const ind of inds) for (const g of gs) for (const k of kws) {
    const q = [k, ind, g].filter(Boolean).join(" ");
    combos.push({ query: q, alt_query: `${ind} companies ${g} ${k}`.trim(), industry: ind, geography: g, size: sizes[0], angle: "rotation", maps_query: ind, maps_location: g });
  }
  if (!combos.length) combos.push({ query: base || "B2B companies with growth potential", industry: base, geography: gs[0], angle: "rotation" });
  const used = new Set(input.recentQueries.map((x) => x.toLowerCase()));
  const fresh = combos.filter((c) => !used.has(c.query.toLowerCase()));
  const pool = fresh.length >= Math.min(input.count, 2) ? fresh : combos;
  const start = dayIndex() % pool.length;
  const out: PlannedQuery[] = [];
  for (let i = 0; i < Math.min(input.count, pool.length); i++) out.push(pool[(start + i) % pool.length]);
  return out;
}

export async function planDiscoveryQueries(input: PlanInput): Promise<{ queries: PlannedQuery[]; method: "ai" | "rotation" }> {
  const apiKey = (Deno.env.get("OPENAI_API_KEY") || "").trim();
  const fallback = () => ({ queries: rotationPlan(input), method: "rotation" as const });
  if (!apiKey || input.setting?.use_ai_planner === false) return fallback();
  const p = input.persona || {};
  const bp = input.businessProfile || {};
  const sys = `You plan B2B lead-discovery web searches for a sales team. Produce ${input.count} DIFFERENT search angles that will surface NEW companies they have not found before. ` +
    `Rules: each angle must combine a specific sector or niche with a CONCRETE place (a city, county, region or state, plus the country), and a distinct hook (e.g. "members of <trade body>", "<award> finalists", "recently funded", "hiring for <role>", "<regulation> deadline", "opened in 2025/2026", "franchises", "independent", "B Corp", "NHS trusts", "housing associations"). ` +
    `Spread angles across ALL the target industries and ALL the target geographies given; do not use the same place twice unless only one is given. ` +
    `Queries must be plain web-search phrases (no boolean operators, no quotes, no site:), 4–12 words, written so a search engine returns company websites rather than articles or job boards. ` +
    `maps_query is a short Google-Maps business type (2–4 words, e.g. "private dental clinic"); maps_location is a city or town. ` +
    `Avoid the recently used queries and avoid angles that would just return the recently found companies. Return JSON only: {"queries":[{"query","alt_query","industry","geography","size","angle","maps_query","maps_location"}]}.`;
  const user = {
    persona_name: p.name, persona_description: p.description, target_industries: cleanList(p.target_industries), target_geographies: cleanList(p.target_geographies),
    target_keywords: cleanList(p.target_keywords), target_company_sizes: cleanList(p.target_company_sizes), custom_search_query: p.custom_search_query || input.setting?.custom_search_query || null,
    exclude_industries: cleanList(p.exclude_industries).concat(cleanList(input.setting?.avoid_industries)), exclude_keywords: cleanList(p.exclude_keywords).concat(cleanList(input.setting?.avoid_keywords)),
    our_business: { company: bp.company_name, what_we_do: bp.services_description, audience: bp.target_audience, value: bp.value_proposition, facts: String(bp.knowledge_base || "").slice(0, 1500) },
    recently_used_queries: input.recentQueries.slice(0, 40), recently_found_companies: input.recentCompanies.slice(0, 120),
  };
  try {
    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST", headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "gpt-4o-mini", temperature: 0.9, max_tokens: 1800, response_format: { type: "json_object" }, messages: [{ role: "system", content: sys }, { role: "user", content: JSON.stringify(user) }] }),
    });
    if (!r.ok) { console.error("[planner] OpenAI error", r.status, (await r.text()).slice(0, 200)); return fallback(); }
    const d = await r.json();
    const parsed = JSON.parse(d.choices?.[0]?.message?.content || "{}");
    const used = new Set(input.recentQueries.map((x) => x.toLowerCase()));
    const seen = new Set<string>();
    const queries: PlannedQuery[] = [];
    for (const q of parsed.queries || []) {
      const query = cleanTerm(q.query);
      if (!query || used.has(query.toLowerCase()) || seen.has(query.toLowerCase())) continue;
      seen.add(query.toLowerCase());
      queries.push({
        query, alt_query: cleanTerm(q.alt_query) || undefined, industry: cleanTerm(q.industry) || cleanList(p.target_industries)[0] || "", geography: cleanTerm(q.geography) || cleanList(p.target_geographies)[0] || "",
        size: cleanTerm(q.size) || undefined, angle: cleanTerm(q.angle) || "ai", maps_query: cleanTerm(q.maps_query) || undefined, maps_location: cleanTerm(q.maps_location) || undefined,
      });
      if (queries.length >= input.count) break;
    }
    if (queries.length < Math.min(2, input.count)) return fallback();
    // Top up from rotation if the model returned too few
    if (queries.length < input.count) for (const q of rotationPlan({ ...input, count: input.count })) { if (queries.length >= input.count) break; if (!seen.has(q.query.toLowerCase())) { seen.add(q.query.toLowerCase()); queries.push(q); } }
    return { queries, method: "ai" };
  } catch (e) {
    console.error("[planner] failed", e);
    return fallback();
  }
}
