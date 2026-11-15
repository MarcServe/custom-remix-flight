// Lead-discovery actions for the assistant (MCP) and API: find leads on demand,
// read/approve what Autopilot found, trigger a run, and tune Autopilot/personas.
import { knownCompanies, isKnown, searchWithLeadFinder, searchWithPerplexity, searchWithApifyMaps, dedupeLeads, domainOf, type SourceLead } from "../_shared/discovery-sources.ts";
import { cleanTerm } from "../_shared/discovery-planner.ts";
import { promoteLeadToCompany } from "../_shared/lead-promote.ts";
import { sourceTag } from "./crm.ts";

const json = (obj: unknown, status = 200) => new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json" } });
const str = (v: unknown): string => (v == null ? "" : String(v)).trim();
const lim = (v: unknown, d = 50, max = 500): number => Math.min(max, Math.max(1, parseInt(String(v || d), 10) || d));
const list = (v: unknown): string[] | undefined => (Array.isArray(v) ? v.map(cleanTerm).filter(Boolean) : typeof v === "string" && v.trim() ? v.split(/[,;\n]/).map(cleanTerm).filter(Boolean) : undefined);
const background = (p: Promise<unknown>) => { const rt = (globalThis as any).EdgeRuntime; if (rt?.waitUntil) rt.waitUntil(p.catch(() => {})); else p.catch(() => {}); };

export const LEAD_ACTIONS = [
  "find_leads", "list_discovered_leads", "approve_leads", "reject_leads",
  "run_discovery", "list_discovery_runs", "get_autopilot", "update_autopilot", "list_personas", "upsert_persona",
];

const leadView = (l: any) => {
  const d = l.company_data || {};
  return { id: l.id, name: l.company_name, website: l.company_website, industry: l.industry, geography: l.geography, status: l.status, quality: l.quality_score, email: d.generalEmail || null, phone: d.companyPhone || null, description: d.description ? String(d.description).slice(0, 200) : null, sources: l.sources_used || [l.source], found_at: l.created_at, company_id: l.company_id || null };
};

export async function handleLeadAction(db: any, userId: string, action: string, body: any): Promise<Response | null> {
  switch (action) {
    case "find_leads": {
      const query = str(body.query);
      if (!query) return json({ error: "query is required, e.g. 'independent dental clinics' or 'housing associations needing accessible websites'" }, 400);
      const geography = cleanTerm(body.geography); const industry = cleanTerm(body.industry); const size = cleanTerm(body.size);
      const max = lim(body.max, 25, 100);
      const save = body.save !== false;
      const sources = Array.isArray(body.sources) && body.sources.length ? body.sources.map(String) : ["web", "perplexity"];
      const [known, { data: settings }] = await Promise.all([knownCompanies(db, userId), db.from("autonomous_discovery_settings").select("*").eq("user_id", userId).maybeSingle()]);
      type R = { source: string; leads: SourceLead[]; error?: string; timedOut?: boolean };
      const calls: Promise<R>[] = [];
      if (sources.includes("web")) calls.push(searchWithLeadFinder({ size: size || "any", geography: geography || "any", industry: industry || "any", customSearchText: query, useSerpApi: body.use_google === true, maxResults: Math.min(50, max * 2), exaQueries: [query, `${query} ${geography}`.trim()], excludeDomains: known.recentDomains.slice(0, 100), exaCategory: "company", exaSearchType: "auto" }, 70_000).then((r) => ({ source: "web", ...r })));
      if (sources.includes("perplexity")) calls.push(searchWithPerplexity(query, geography, industry, Math.min(25, max), known.recentNames.slice(0, 40)).then((r) => ({ source: "perplexity", ...r })));
      if (sources.includes("maps") && (body.maps_query || query)) calls.push(searchWithApifyMaps(str(body.maps_query) || query, geography || "United Kingdom", Math.min(60, max * 2), 60_000).then((r) => ({ source: "maps", ...r })));
      const results = await Promise.all(calls);
      const errors: string[] = []; const bySource: Record<string, number> = {}; const all: SourceLead[] = [];
      for (const r of results) { if (r.error) errors.push(`${r.source}: ${r.error}`); if (r.timedOut) errors.push(`${r.source}: time limit reached, partial results`); bySource[r.source] = r.leads.length; for (const l of r.leads) { l.source = l.source || r.source; all.push(l); } }
      const fresh = dedupeLeads(all).filter((l) => !isKnown(l, known)).sort((a, b) => (b.qualityScore || 0) - (a.qualityScore || 0)).slice(0, max);
      const skippedKnown = dedupeLeads(all).length - fresh.length;
      if (!save || !fresh.length) return json({ found: fresh.length, already_in_crm: Math.max(0, skippedKnown), saved: 0, by_source: bySource, errors, leads: fresh.map((l) => ({ name: l.name, website: l.website, industry: l.industry, geography: l.geography, quality: l.qualityScore, email: l.generalEmail || null, phone: l.companyPhone || null, description: l.description ? String(l.description).slice(0, 200) : null, sources: l.sources_used })) });
      const runId = `assistant-${Date.now()}`;
      const status = settings?.full_auto_mode ? "auto_approved" : (body.status === "approved" || body.status === "auto_approved") ? "auto_approved" : "pending";
      const rows = fresh.map((l) => ({
        user_id: userId, discovery_run_id: runId, persona_id: str(body.persona_id) || null, status, quality_score: Math.round(l.qualityScore || 0),
        company_data: { ...l, generalEmail: l.generalEmail || null, companyPhone: l.companyPhone || null, contacts: (l as any).contacts || [], suggestedTags: [...new Set([...(((l as any).suggestedTags as string[]) || []), ...(sourceTag(body) ? [sourceTag(body) as string] : [])])] },
        company_name: l.name, company_website: l.website || null, industry: l.industry || industry || null, geography: l.geography || geography || null, company_size: (l as any).size || size || null,
        contacts: (l as any).contacts || [], source: "assistant", sources_used: [...new Set(["assistant", ...((l.sources_used as string[]) || [l.source])])], source_breakdown: { primary: "assistant", all: l.sources_used || [l.source] },
      }));
      const { data: inserted, error } = await db.from("autonomous_leads").insert(rows).select("id, company_name, company_website, industry, geography, status, quality_score, company_data, sources_used, source, created_at, company_id");
      if (error) return json({ error: `Could not save leads: ${error.message}` }, 500);
      await db.from("discovery_runs").insert({ user_id: userId, discovery_run_id: runId, status: "completed", completed_at: new Date().toISOString(), trigger_type: "manual", total_leads_found: inserted.length, leads_auto_approved: inserted.filter((r: any) => r.status === "auto_approved").length, leads_pending: inserted.filter((r: any) => r.status === "pending").length, raw_found: all.length, source_breakdown: bySource, errors, search_queries: [{ query, industry, geography, angle: "assistant" }], planner_method: "assistant", persona_name: str(body.persona_name) || "AI assistant" }).then(() => {}, () => {});
      // Find public emails in the background so the leads become contactable.
      const needEmail = inserted.filter((r: any) => !r.company_data?.generalEmail && r.company_website).map((r: any) => r.id);
      if (needEmail.length) {
        const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        background(fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/bulk-extract-emails`, { method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, body: JSON.stringify({ leadIds: needEmail.slice(0, 60), createContact: false, stream: false, promote: status === "auto_approved", chain: true, chunk: 12 }) }));
      }
      return json({ found: fresh.length, already_in_crm: Math.max(0, skippedKnown), saved: inserted.length, status, run_id: runId, by_source: bySource, errors, note: needEmail.length ? `Looking up public emails for ${Math.min(40, needEmail.length)} of them in the background; call list_discovered_leads in a minute to see them.` : undefined, leads: inserted.map(leadView) });
    }

    case "list_discovered_leads": {
      let q = db.from("autonomous_leads").select("id, company_name, company_website, industry, geography, status, quality_score, company_data, sources_used, source, created_at, company_id").eq("user_id", userId).order("created_at", { ascending: false }).limit(lim(body.limit, 50, 500));
      const status = str(body.status);
      if (status) q = status === "approved" ? q.in("status", ["approved", "auto_approved"]) : q.eq("status", status);
      if (body.days) q = q.gte("created_at", new Date(Date.now() - Number(body.days) * 86_400_000).toISOString());
      if (str(body.search)) q = q.or(`company_name.ilike.%${str(body.search)}%,company_website.ilike.%${str(body.search)}%,industry.ilike.%${str(body.search)}%`);
      if (body.with_email === true) q = q.not("company_data->>generalEmail", "is", null);
      if (str(body.run_id)) q = q.eq("discovery_run_id", str(body.run_id));
      const { data, error } = await q;
      if (error) return json({ error: error.message }, 500);
      const leads = (data || []).map(leadView);
      return json({ count: leads.length, with_email: leads.filter((l: any) => l.email).length, leads });
    }

    case "approve_leads":
    case "reject_leads": {
      const ids = Array.isArray(body.ids) ? body.ids.map(String) : str(body.id) ? [str(body.id)] : [];
      if (!ids.length) return json({ error: "ids[] required" }, 400);
      const { data: leads } = await db.from("autonomous_leads").select("*").eq("user_id", userId).in("id", ids.slice(0, 200));
      if (action === "reject_leads") {
        await db.from("autonomous_leads").update({ status: "rejected", reviewed_at: new Date().toISOString() }).eq("user_id", userId).in("id", ids.slice(0, 200));
        return json({ rejected: (leads || []).length });
      }
      const { data: settings } = await db.from("autonomous_discovery_settings").select("auto_enroll_enabled, auto_enroll_sequence_id").eq("user_id", userId).maybeSingle();
      let approved = 0; const companies: { lead_id: string; company_id: string | null; name: string }[] = [];
      for (const lead of leads || []) {
        const st = sourceTag(body);
        const tagged = st ? { ...lead, company_data: { ...(lead.company_data || {}), suggestedTags: [...new Set([...(((lead.company_data || {}).suggestedTags as string[]) || []), st])] } } : lead;
        const companyId = await promoteLeadToCompany(db, userId, tagged, settings);
        await db.from("autonomous_leads").update({ status: "approved", reviewed_at: new Date().toISOString(), company_id: companyId }).eq("id", lead.id);
        approved++; companies.push({ lead_id: lead.id, company_id: companyId, name: lead.company_name });
      }
      return json({ approved, companies, note: "Approved leads are now companies in the CRM (with a general-enquiries contact when an email was known). Use search_companies / create_campaign to reach them." });
    }

    case "run_discovery": {
      const { data: settings } = await db.from("autonomous_discovery_settings").select("enabled, daily_lead_target, queries_per_run").eq("user_id", userId).maybeSingle();
      if (!settings) return json({ error: "Autopilot is not set up yet. Open Autopilot in LeadBoosters and save settings once." }, 400);
      const { data: running } = await db.from("discovery_runs").select("discovery_run_id, started_at").eq("user_id", userId).eq("status", "running").gte("started_at", new Date(Date.now() - 10 * 60_000).toISOString()).limit(1);
      if (running?.length) return json({ started: false, message: "A discovery run is already in progress; check list_discovery_runs in a couple of minutes." });
      const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      background(fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/autonomous-lead-discovery`, { method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, body: JSON.stringify({ userId, forceRun: true }) }));
      return json({ started: true, message: `Autopilot discovery started (target ${settings.daily_lead_target || 50} leads across ${settings.queries_per_run || 6} search angles). It takes 2–4 minutes; call list_discovery_runs then list_discovered_leads with run_id to see what it found.` });
    }

    case "list_discovery_runs": {
      const { data } = await db.from("discovery_runs").select("discovery_run_id, started_at, completed_at, status, trigger_type, persona_name, raw_found, total_leads_found, leads_auto_approved, leads_pending, emails_extracted, contacts_created, source_breakdown, search_queries, planner_method, errors").eq("user_id", userId).order("started_at", { ascending: false }).limit(lim(body.limit, 10, 100));
      return json({ runs: (data || []).map((r: any) => ({ run_id: r.discovery_run_id, started_at: r.started_at, completed_at: r.completed_at, status: r.status, trigger: r.trigger_type, persona: r.persona_name, companies_seen: r.raw_found, new_leads_saved: r.total_leads_found, auto_approved: r.leads_auto_approved, pending: r.leads_pending, emails_found: r.emails_extracted, added_to_crm: r.contacts_created, by_source: r.source_breakdown, search_angles: (r.search_queries || []).map((q: any) => q?.query || q), planner: r.planner_method, problems: r.errors || [] })) });
    }

    case "get_autopilot": {
      const [{ data: s }, { data: personas }] = await Promise.all([
        db.from("autonomous_discovery_settings").select("enabled, discovery_frequency, preferred_discovery_hour, timezone, daily_lead_target, max_leads_per_run, queries_per_run, use_ai_planner, use_perplexity_search, use_serp_api, use_apify, full_auto_mode, auto_approve_threshold, auto_enroll_enabled, auto_enroll_sequence_id, auto_create_campaign, target_industries, target_geographies, target_company_sizes, custom_search_query, avoid_industries, avoid_keywords, last_run_at, next_run_at, total_approved, total_rejected").eq("user_id", userId).maybeSingle(),
        db.from("discovery_personas").select("id, name, is_active, description, target_industries, target_geographies, target_keywords, target_company_sizes, custom_search_query, exclude_industries, exclude_keywords, auto_approve_threshold, auto_enroll_sequence_id, total_leads_found, total_approved").eq("user_id", userId).order("priority"),
      ]);
      return json({ settings: s, personas: personas || [], sources: { web_search: "Exa (always on)", google: s?.use_serp_api !== false ? "on (SerpAPI, small quota)" : "off", perplexity: s?.use_perplexity_search !== false ? "on" : "off", google_maps: s?.use_apify ? "on (Apify)" : "off", planner: s?.use_ai_planner !== false ? "AI plans fresh angles each run" : "rotation" } });
    }

    case "update_autopilot": {
      const allowed = ["enabled", "discovery_frequency", "preferred_discovery_hour", "daily_lead_target", "max_leads_per_run", "queries_per_run", "use_ai_planner", "use_perplexity_search", "use_serp_api", "use_apify", "full_auto_mode", "auto_approve_threshold", "auto_enroll_enabled", "auto_enroll_sequence_id", "auto_create_campaign", "custom_search_query", "avoid_industries", "avoid_keywords", "target_industries", "target_geographies", "target_company_sizes"];
      const patch: Record<string, unknown> = {};
      for (const k of allowed) if (body[k] !== undefined) patch[k] = ["avoid_industries", "avoid_keywords", "target_industries", "target_geographies", "target_company_sizes"].includes(k) ? list(body[k]) ?? null : body[k];
      if (patch.queries_per_run != null) patch.queries_per_run = Math.min(10, Math.max(1, Number(patch.queries_per_run) || 6));
      if (!Object.keys(patch).length) return json({ error: `Nothing to update. Allowed: ${allowed.join(", ")}` }, 400);
      patch.updated_at = new Date().toISOString();
      const { data, error } = await db.from("autonomous_discovery_settings").update(patch).eq("user_id", userId).select("enabled, daily_lead_target, queries_per_run, use_ai_planner, use_perplexity_search, use_serp_api, use_apify, full_auto_mode, next_run_at").maybeSingle();
      if (error) return json({ error: error.message }, 500);
      if (!data) return json({ error: "Autopilot is not set up yet. Open Autopilot in LeadBoosters and save settings once." }, 400);
      return json({ updated: Object.keys(patch).filter((k) => k !== "updated_at"), settings: data });
    }

    case "list_personas": {
      const { data } = await db.from("discovery_personas").select("id, name, is_active, priority, description, target_industries, target_geographies, target_keywords, target_company_sizes, custom_search_query, exclude_industries, exclude_keywords, auto_approve_threshold, auto_enroll_sequence_id, total_leads_found, total_approved, updated_at").eq("user_id", userId).order("priority");
      return json({ personas: data || [] });
    }

    case "upsert_persona": {
      const fields: Record<string, unknown> = {};
      if (body.description !== undefined) fields.description = str(body.description) || null;
      if (body.custom_search_query !== undefined) fields.custom_search_query = str(body.custom_search_query) || null;
      for (const k of ["target_industries", "target_geographies", "target_keywords", "target_company_sizes", "exclude_industries", "exclude_keywords"]) if (body[k] !== undefined) fields[k] = list(body[k]) ?? null;
      if (body.is_active !== undefined) fields.is_active = !!body.is_active;
      if (body.auto_approve_threshold !== undefined) fields.auto_approve_threshold = Number(body.auto_approve_threshold) || null;
      if (body.auto_enroll_sequence_id !== undefined) fields.auto_enroll_sequence_id = str(body.auto_enroll_sequence_id) || null;
      for (const k of ["email_tone", "call_to_action", "talking_points", "value_proposition", "product_focus"]) if (body[k] !== undefined) fields[k] = str(body[k]) || null;
      const id = str(body.persona_id); const name = str(body.name);
      let existing: any = null;
      if (id) ({ data: existing } = await db.from("discovery_personas").select("id, name").eq("user_id", userId).eq("id", id).maybeSingle());
      else if (name) ({ data: existing } = await db.from("discovery_personas").select("id, name").eq("user_id", userId).ilike("name", name).maybeSingle());
      if (existing) {
        if (name && name !== existing.name) fields.name = name;
        if (!Object.keys(fields).length) return json({ error: "Nothing to update" }, 400);
        const { data, error } = await db.from("discovery_personas").update({ ...fields, updated_at: new Date().toISOString() }).eq("id", existing.id).select("id, name, is_active, target_industries, target_geographies, target_keywords, target_company_sizes, custom_search_query").single();
        if (error) return json({ error: error.message }, 500);
        return json({ updated: true, persona: data });
      }
      if (!name) return json({ error: "name is required to create a persona" }, 400);
      const { data, error } = await db.from("discovery_personas").insert({ user_id: userId, name, is_active: fields.is_active ?? true, ...fields }).select("id, name, is_active, target_industries, target_geographies, target_keywords, target_company_sizes, custom_search_query").single();
      if (error) return json({ error: error.message }, 500);
      return json({ created: true, persona: data, note: "Autopilot will use this persona on its next run. Call run_discovery to try it now." });
    }

    default:
      return null;
  }
}
