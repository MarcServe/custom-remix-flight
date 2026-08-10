/**
 * Helpers to turn curated hospitality leads into campaign/newsletter recipients.
 * Verified emails only — prefers decision-maker → sales → property → reservations.
 */

import type { CuratedHospitalityLead } from "@/lib/data/curated-hospitality-leads";

export type HospitalityMarket = "US" | "UK";

export type HospitalityRecipient = {
  email: string;
  first_name: string;
  last_name: string;
  company: string;
  name: string;
  market: HospitalityMarket;
  city?: string;
  website?: string;
  sourceUrl?: string;
  phone?: string;
};

const FREEMAIL = new Set([
  "gmail.com",
  "googlemail.com",
  "yahoo.com",
  "yahoo.co.uk",
  "hotmail.com",
  "outlook.com",
  "icloud.com",
  "aol.com",
  "protonmail.com",
  "mail.com",
]);

const SKIP_LOCAL = new Set([
  "privacy",
  "unsubscribe",
  "careers",
  "recruitment",
  "hr",
  "noreply",
  "no-reply",
  "donotreply",
]);

export function isVerifiedHospitalityLead(lead: CuratedHospitalityLead): boolean {
  if (lead.verificationStatus && lead.verificationStatus.toLowerCase() !== "verified") return false;
  if (lead.emailVerified === false) return false;
  return !!(lead.propertyEmail || lead.decisionMakerEmail || lead.salesEmail || lead.reservationsEmail);
}

export function pickBestVerifiedEmail(lead: CuratedHospitalityLead): string | null {
  const ordered = [
    lead.decisionMakerEmail,
    lead.salesEmail,
    lead.propertyEmail,
    lead.reservationsEmail,
  ];
  for (const raw of ordered) {
    const email = String(raw || "")
      .trim()
      .toLowerCase();
    if (!email || !email.includes("@")) continue;
    const local = email.split("@")[0];
    const domain = email.split("@")[1] || "";
    if (SKIP_LOCAL.has(local)) continue;
    if (FREEMAIL.has(domain)) continue;
    return email;
  }
  return null;
}

export function marketForLead(lead: CuratedHospitalityLead): HospitalityMarket | null {
  const country = (lead.country || "").toLowerCase();
  if (country.includes("united states") || country === "usa" || country === "us") return "US";
  if (country.includes("united kingdom") || country.includes("uk") || country === "gb") return "UK";
  return null;
}

export function curatedLeadToRecipient(lead: CuratedHospitalityLead): HospitalityRecipient | null {
  if (!isVerifiedHospitalityLead(lead)) return null;
  const email = pickBestVerifiedEmail(lead);
  if (!email) return null;
  const market = marketForLead(lead);
  if (!market) return null;

  const dmName = String(lead.decisionMakerName || "").trim();
  const parts = dmName.split(/\s+/).filter(Boolean);
  const first = parts[0] || "Team";
  const last = parts.slice(1).join(" ") || "";

  return {
    email,
    first_name: first,
    last_name: last,
    company: lead.propertyName,
    name: dmName || lead.propertyName,
    market,
    city: lead.city,
    website: lead.website,
    sourceUrl: lead.sourceUrl,
    phone: lead.phone,
  };
}

export function partitionRecipientsByMarket(leads: CuratedHospitalityLead[]): {
  US: HospitalityRecipient[];
  UK: HospitalityRecipient[];
  skipped: number;
} {
  const US: HospitalityRecipient[] = [];
  const UK: HospitalityRecipient[] = [];
  const seen = new Set<string>();
  let skipped = 0;

  for (const lead of leads) {
    const r = curatedLeadToRecipient(lead);
    if (!r) {
      skipped++;
      continue;
    }
    const key = r.email.toLowerCase();
    if (seen.has(key)) {
      skipped++;
      continue;
    }
    seen.add(key);
    if (r.market === "US") US.push(r);
    else UK.push(r);
  }

  return { US, UK, skipped };
}

export function hospitalityGroupName(market: HospitalityMarket, dateLabel?: string): string {
  const d =
    dateLabel ||
    new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  return `Hospitality ${market} · verified · ${d}`;
}

export function hospitalityCampaignName(market: HospitalityMarket, dateLabel?: string): string {
  const d =
    dateLabel ||
    new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  return `Hospitality ${market} outreach · ${d}`;
}

/** Modern TalkStay-style outreach copy (plain text + HTML). */
export function buildHospitalityCampaignCopy(market: HospitalityMarket): {
  subject: string;
  bodyText: string;
  bodyHtml: string;
} {
  const region = market === "UK" ? "the UK" : "the US";
  const subject =
    market === "UK"
      ? "{{company}} — a simpler way to fill short-stay gaps"
      : "{{company}} — turn empty nights into direct bookings";

  const bodyText = `Hi {{firstName}},

I came across {{company}} while researching hospitality operators across ${region}, and wanted to share a quick idea.

TalkStay helps hotels and short-stay teams convert more direct enquiries — without adding another heavy system to manage. Teams typically use it to:
• Respond faster to booking and group enquiries
• Keep property contacts organised for outreach
• Run light, on-brand follow-ups that feel human

If useful, I can send a 2-minute overview tailored to {{company}}.

Best regards`;

  const bodyHtml = buildModernHospitalityEmailHtml({
    eyebrow: market === "UK" ? "Hospitality · United Kingdom" : "Hospitality · United States",
    headline: market === "UK" ? "Fill short-stay gaps with less friction" : "Turn empty nights into direct bookings",
    intro: `Hi {{firstName}},`,
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

export function buildHospitalityNewsletterCopy(market: HospitalityMarket): {
  title: string;
  subject: string;
  bodyHtml: string;
  bodyText: string;
} {
  const title = `Hospitality brief · ${market}`;
  const subject =
    market === "UK"
      ? "This week in UK hospitality ops"
      : "This week in US hospitality ops";

  const bodyText = `Hospitality brief for ${market}

Three things worth knowing this week for property and sales teams:

1) Direct enquiry response time still wins more bookings than rate tweaks alone.
2) Group/events inboxes convert better when ownership is clear.
3) A short weekly touchpoint with warm prospects beats one-off blasts.

Reply if you’d like next week’s edition tailored to your property type.`;

  const bodyHtml = buildModernHospitalityEmailHtml({
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

export function buildModernHospitalityEmailHtml(opts: {
  eyebrow: string;
  headline: string;
  intro: string;
  paragraphs: string[];
  bullets: string[];
  ctaLabel: string;
  ctaNote: string;
  footerNote: string;
}): string {
  const paras = opts.paragraphs.map((p) => `<p style="margin:0 0 14px;font-size:16px;line-height:1.6;color:#1c1917;">${p}</p>`).join("");
  const bullets = opts.bullets
    .map(
      (b) =>
        `<li style="margin:0 0 8px;font-size:15px;line-height:1.5;color:#292524;">${b}</li>`
    )
    .join("");

  return `<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#f5f0e8;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${opts.headline}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f0e8;padding:28px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fffdf9;border-radius:18px;overflow:hidden;border:1px solid #e7e0d4;">
          <tr>
            <td style="padding:28px 28px 18px;background:linear-gradient(135deg,#0f766e 0%,#134e4a 55%,#1c1917 100%);">
              <p style="margin:0 0 8px;font-size:12px;letter-spacing:0.14em;text-transform:uppercase;color:#99f6e4;font-family:Georgia,serif;">${opts.eyebrow}</p>
              <h1 style="margin:0;font-size:28px;line-height:1.25;color:#fafaf9;font-family:Georgia,'Times New Roman',serif;font-weight:600;">${opts.headline}</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:28px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
              <p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#1c1917;">${opts.intro}</p>
              ${paras}
              <ul style="margin:8px 0 20px;padding-left:20px;">${bullets}</ul>
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 16px;">
                <tr>
                  <td style="background:#0f766e;border-radius:999px;padding:12px 22px;">
                    <span style="color:#ecfdf5;font-size:14px;font-weight:600;">${opts.ctaLabel}</span>
                  </td>
                </tr>
              </table>
              <p style="margin:0;font-size:14px;line-height:1.5;color:#57534e;">${opts.ctaNote}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 28px 24px;border-top:1px solid #ebe4d8;">
              <p style="margin:0;font-size:12px;line-height:1.5;color:#a8a29e;">${opts.footerNote}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export const HOSPITALITY_SERIES_TOPIC = {
  US: "US hospitality operations, direct bookings, and short-stay sales tips for hotel GMs and revenue managers",
  UK: "UK hospitality operations, short-stay filling tips, and boutique hotel sales ideas for GMs and sales leads",
} as const;
