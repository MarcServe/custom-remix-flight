/** Merge-token context for campaign / sequence email personalization. */
export type EmailMergeContext = {
  firstName?: string | null;
  lastName?: string | null;
  fullName?: string | null;
  email?: string | null;
  /** Recipient's company (hotel, employer, etc.) */
  companyName?: string | null;
  /** Campaign-level CTA / demo URL for {{demoLink}} */
  demoLink?: string | null;
  /** Extra keys (normalized to lowercase, underscores stripped for matching) */
  extras?: Record<string, string | null | undefined>;
};

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function normKey(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * Replace {{firstName}}, {{companyName}}, {{demoLink}}, {{company}}, etc.
 * Unknown tokens are left unchanged.
 */
export function personalizeEmailTemplate(
  template: string,
  ctx: EmailMergeContext,
  opts?: { escapeHtmlValues?: boolean }
): string {
  if (!template) return "";
  const wrap = opts?.escapeHtmlValues ? escapeHtml : (s: string) => s;

  const firstName = (ctx.firstName || "").trim();
  const lastName = (ctx.lastName || "").trim();
  const fullName =
    (ctx.fullName || "").trim() || [firstName, lastName].filter(Boolean).join(" ").trim();
  const email = (ctx.email || "").trim();
  // Fall back to recipient name for hospitality-style lists where the "name" is the property
  const companyName = (ctx.companyName || "").trim() || fullName;
  const demoLink = (ctx.demoLink || "").trim();

  const map: Record<string, string> = {
    firstname: wrap(firstName),
    lastname: wrap(lastName),
    fullname: wrap(fullName),
    name: wrap(fullName),
    email: wrap(email),
    companyname: wrap(companyName),
    company: wrap(companyName),
    company_name: wrap(companyName),
  };
  // Only replace {{demoLink}} when a value exists — empty would wipe CTAs from the body.
  if (demoLink) {
    map.demolink = wrap(demoLink);
    map.demo_link = wrap(demoLink);
  }

  for (const [k, v] of Object.entries(ctx.extras || {})) {
    if (v == null || String(v).trim() === '') continue;
    map[normKey(k)] = wrap(String(v));
  }

  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (match, rawKey: string) => {
    const k = normKey(rawKey);
    if (Object.prototype.hasOwnProperty.call(map, k)) return map[k];
    // Also allow exact lowercase_with_underscores keys stored as-is
    const lower = rawKey.toLowerCase();
    if (Object.prototype.hasOwnProperty.call(map, lower)) return map[lower];
    return match;
  });
}

/** Build merge context from a people-like row (+ optional campaign merge_vars). */
export function mergeContextFromPerson(
  person: {
    first_name?: string | null;
    last_name?: string | null;
    email?: string | null;
    name?: string | null;
    companies?: { name?: string | null } | null;
    company?: string | null;
  },
  campaignVars?: { demoLink?: string | null; extras?: Record<string, string | null | undefined> } | null
): EmailMergeContext {
  const first = person.first_name ?? "";
  const last = person.last_name ?? "";
  const full =
    person.name?.trim() ||
    [first, last].filter(Boolean).join(" ").trim() ||
    person.email ||
    "";
  return {
    firstName: first || full.split(/\s+/)[0] || "",
    lastName: last || full.split(/\s+/).slice(1).join(" ") || "",
    fullName: full,
    email: person.email || "",
    companyName: person.companies?.name || person.company || "",
    demoLink: campaignVars?.demoLink || "",
    extras: campaignVars?.extras,
  };
}
