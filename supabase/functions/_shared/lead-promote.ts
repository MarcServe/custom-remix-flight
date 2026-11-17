// Turns an approved discovered lead (autonomous_leads row) into a CRM company
// (+ a general-enquiries contact when an email is known) and enrols it in the
// Autopilot sequence when that is switched on. Shared by Autopilot, the email
// extractor and the assistant tools so every path behaves the same.
import { domainOf } from "./discovery-sources.ts";

export interface PromoteSettings { auto_enroll_enabled?: boolean | null; auto_enroll_sequence_id?: string | null }

export async function promoteLeadToCompany(db: any, userId: string, lead: any, settings: PromoteSettings | null, personaSequenceId?: string | null): Promise<string | null> {
  if (lead.company_id) return lead.company_id;
  const d = lead.company_data || {};
  const dom = domainOf(lead.company_website);
  let companyId: string | null = null;
  // 1) Same name → same company.
  const name = String(lead.company_name || "").trim();
  if (name) {
    const { data: byName } = await db.from("companies").select("id").eq("user_id", userId).ilike("name", name).order("created_at").limit(1);
    if (byName?.[0]?.id) companyId = byName[0].id;
  }
  // 2) Same website → same company, but only when exactly one company uses that site.
  //    Hotel groups, franchises and NHS trusts share one domain across many separate organisations.
  if (!companyId && dom) {
    const { data: byDomain } = await db.from("companies").select("id, website").eq("user_id", userId).ilike("website", `%${dom}%`).limit(5);
    const exact = (byDomain || []).filter((c: any) => domainOf(c.website) === dom);
    if (exact.length === 1) companyId = exact[0].id;
  }
  if (!companyId) {
    // companies.website is unique platform-wide. Properties of a chain often list the group's
    // shared site, so fall back to the property's own contact page, then a name-tagged URL.
    const slug = String(lead.company_name || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
    const base = lead.company_website || "";
    const candidates = [base, d.sourceUrl && d.sourceUrl !== base ? d.sourceUrl : null, base ? `${base.replace(/#.*$/, "")}#${slug}` : null, `no-website-${crypto.randomUUID()}`]
      .filter((v, i, a): v is string => !!v && a.indexOf(v) === i);
    let company: any = null; let error: any = null;
    for (const website of candidates) {
      ({ data: company, error } = await db.from("companies").insert({
        user_id: userId, name: lead.company_name, website, description: d.description || null, industry: lead.industry || null,
      size: lead.company_size || null, geography: lead.geography || null, linkedin_url: d.linkedinUrl || d.socialProfiles?.linkedin || null, company_phone: d.companyPhone || null, general_email: d.generalEmail || null,
      social_profiles: d.socialProfiles || {}, key_executives: d.keyExecutives || [], employee_count: d.employeeCount || null, recent_news: d.recentNews || null,
      enrichment_data: lead.enrichment_data || null, enrichment_status: d.wasEnriched || lead.enrichment_data ? "completed" : "pending",
      tags: Array.isArray(d.suggestedTags) && d.suggestedTags.length ? d.suggestedTags : null,
      }).select("id").single());
      if (!error && company) break;
      if (error?.code !== "23505") break; // only a duplicate website is worth retrying
    }
    if (error || !company) { console.error("[promote] company insert failed", error?.message); return null; }
    companyId = company.id;
    const contacts = Array.isArray(lead.contacts) && lead.contacts.length ? lead.contacts : Array.isArray(d.contacts) ? d.contacts : [];
    const isEmail = (v: unknown) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v || ""));
    const rows = contacts.filter((c: any) => c?.name || isEmail(c?.email)).map((c: any) => ({ ...c, email: isEmail(c?.email) ? String(c.email).toLowerCase() : null })).slice(0, 10).map((c: any, i: number) => ({ company_id: companyId, name: c.name || c.email, email: c.email || null, title: c.title || null, phone: c.phone || null, linkedin_url: c.linkedinUrl || null, is_primary_contact: i === 0 }));
    if (!rows.length && d.generalEmail) rows.push({ company_id: companyId, name: lead.company_name, email: d.generalEmail, title: "General enquiries", phone: d.companyPhone || null, linkedin_url: null, is_primary_contact: true });
    if (rows.length) await db.from("contacts").insert(rows).then(() => {}, (e: any) => console.error("[promote] contacts", e?.message));
  }
  await db.from("autonomous_leads").update({ company_id: companyId, reviewed_at: lead.reviewed_at || new Date().toISOString() }).eq("id", lead.id);
  const seqId = personaSequenceId || (settings?.auto_enroll_enabled ? settings?.auto_enroll_sequence_id : null);
  if (seqId) {
    const { data: already } = await db.from("company_sequences").select("id").eq("company_id", companyId).eq("sequence_id", seqId).limit(1);
    if (!already?.length) await db.from("company_sequences").insert({ company_id: companyId, sequence_id: seqId, status: "active", current_step: 0, auto_respond_enabled: true }).then(() => {}, () => {});
  }
  return companyId;
}

/** Add to a discovery run's counters (read-modify-write; runs are per user so races are harmless). */
export async function bumpRunCounters(db: any, discoveryRunId: string, delta: { emails_extracted?: number; contacts_created?: number; sequences_enrolled?: number }): Promise<void> {
  if (!discoveryRunId) return;
  const { data: run } = await db.from("discovery_runs").select("emails_extracted, contacts_created, sequences_enrolled").eq("discovery_run_id", discoveryRunId).maybeSingle();
  if (!run) return;
  await db.from("discovery_runs").update({
    emails_extracted: (run.emails_extracted || 0) + (delta.emails_extracted || 0),
    contacts_created: (run.contacts_created || 0) + (delta.contacts_created || 0),
    sequences_enrolled: (run.sequences_enrolled || 0) + (delta.sequences_enrolled || 0),
  }).eq("discovery_run_id", discoveryRunId);
}
