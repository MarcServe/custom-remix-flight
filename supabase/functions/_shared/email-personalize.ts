/** Merge-token context for campaign email personalization (edge). */
export type EmailMergeContext = {
  firstName?: string | null;
  lastName?: string | null;
  fullName?: string | null;
  email?: string | null;
  companyName?: string | null;
  demoLink?: string | null;
  extras?: Record<string, string | null | undefined>;
};

function normKey(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Replace {{firstName}}, {{companyName}}, {{demoLink}}, {{company}}, etc.
 * Unknown tokens are left unchanged.
 */
export function personalizeEmailTemplate(template: string, ctx: EmailMergeContext): string {
  if (!template) return '';

  const firstName = (ctx.firstName || '').trim();
  const lastName = (ctx.lastName || '').trim();
  const fullName =
    (ctx.fullName || '').trim() || [firstName, lastName].filter(Boolean).join(' ').trim();
  const email = (ctx.email || '').trim();
  const companyName = (ctx.companyName || '').trim() || fullName;
  const demoLink = (ctx.demoLink || '').trim();

  const map: Record<string, string> = {
    firstname: firstName,
    lastname: lastName,
    fullname: fullName,
    name: fullName,
    email,
    companyname: companyName,
    company: companyName,
    company_name: companyName,
    demolink: demoLink,
    demo_link: demoLink,
  };

  for (const [k, v] of Object.entries(ctx.extras || {})) {
    if (v == null) continue;
    map[normKey(k)] = String(v);
  }

  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (match, rawKey: string) => {
    const k = normKey(rawKey);
    if (Object.prototype.hasOwnProperty.call(map, k)) return map[k];
    const lower = rawKey.toLowerCase();
    if (Object.prototype.hasOwnProperty.call(map, lower)) return map[lower];
    return match;
  });
}

export function mergeContextFromRecipient(
  recipient: { name?: string | null; email?: string | null; company_name?: string | null },
  campaignVars?: { demoLink?: string | null; extras?: Record<string, string | null | undefined> } | null,
): EmailMergeContext {
  const fullName = (recipient.name || recipient.email || '').trim();
  const parts = fullName.split(/\s+/);
  return {
    firstName: parts[0] || '',
    lastName: parts.slice(1).join(' ') || '',
    fullName,
    email: recipient.email || '',
    companyName: recipient.company_name || '',
    demoLink: campaignVars?.demoLink || '',
    extras: campaignVars?.extras,
  };
}
