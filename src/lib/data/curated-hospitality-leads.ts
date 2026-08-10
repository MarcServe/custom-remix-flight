/**
 * Typed loader for hand-researched hospitality leads published on official websites.
 * Source file: /data/hospitality-leads/verified-leads.json (also served from /public).
 */

export type CuratedHospitalityLead = {
  propertyName: string;
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
  emailSource?: string;
  verificationStatus?: string;
  verificationMethod?: string;
};

export type CuratedHospitalityLeadsFile = {
  generatedAt: string;
  method: string;
  verificationStandard: string;
  markets: string[];
  leads: CuratedHospitalityLead[];
};

export async function loadCuratedHospitalityLeads(): Promise<CuratedHospitalityLeadsFile> {
  const res = await fetch("/data/hospitality-leads/verified-leads.json", { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Failed to load curated leads (${res.status})`);
  }
  return res.json();
}
