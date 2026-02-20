/**
 * Source tags applied when adding companies to CRM from different entry points.
 * Used for grouping and filtering on the Companies page.
 */
export const COMPANY_SOURCE_TAGS = {
  RESEARCH_CHAT: "Research Chat",
  LEAD_FINDER: "Lead Finder",
  LEAD_INBOX: "Lead Inbox",
  AUTOPILOT: "Autopilot",
  CSV_IMPORT: "CSV Import",
  GOOGLE_MAPS: "Google Maps",
} as const;

export const SOURCE_TAG_LIST = Object.values(COMPANY_SOURCE_TAGS);

/** Get the first known source tag from a company's tags, or null */
export function getCompanySource(company: { tags?: string[] | null }): string | null {
  const tags = company.tags || [];
  const lower = SOURCE_TAG_LIST.map((t) => t.toLowerCase());
  for (const tag of tags) {
    const t = typeof tag === "string" ? tag.trim().toLowerCase() : "";
    if (t && lower.includes(t)) return SOURCE_TAG_LIST[lower.indexOf(t)];
  }
  return null;
}
