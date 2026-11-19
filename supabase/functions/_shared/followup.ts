// Shared helpers for follow-up enrolment: link a recipient to a CRM person +
// company (what company_sequences hangs off), and find-or-create the default
// "No-reply follow-up (Day 1 / 3 / 5)" sequence. Used by send-bulk-emails at
// send time and by the public API (api-campaigns).

import { isProspectableEmail, greetingFirstName } from "./email-quality.ts";

// Free-mail domains never represent a shared company, so contacts on them get a
// distinct company (their own email) → each enrols in its own follow-up thread.
const FREEMAIL = new Set([
  "gmail.com", "googlemail.com", "yahoo.com", "yahoo.co.uk", "hotmail.com", "hotmail.co.uk",
  "outlook.com", "live.com", "msn.com", "icloud.com", "me.com", "mac.com", "aol.com",
  "proton.me", "protonmail.com", "gmx.com", "gmx.net", "mail.com", "yandex.com", "zoho.com",
]);

function domainToName(domain: string): string {
  const base = (domain || "").split(".")[0] || "";
  return base ? base.charAt(0).toUpperCase() + base.slice(1) : "";
}

export function firstEmail(raw: unknown): string {
  const s = String(raw || "").toLowerCase();
  const m = s.match(/[^\s@,;<>()]+@[^\s@,;<>()]+\.[^\s@,;<>()]+/);
  return m ? m[0] : "";
}

/**
 * Ensure a recipient is a CRM person with a company AND a verified contact.
 * Returns { personId, companyId }. Idempotent per (user, email).
 */
export async function ensurePersonCompany(
  db: any,
  userId: string,
  r: { email?: string | null; first_name?: string | null; last_name?: string | null; name?: string | null; company?: string | null },
): Promise<{ personId: string | null; companyId: string | null }> {
  const email = firstEmail(r.email);
  // Never enrol (or mark "verified") an address that is junk: image names
  // scraped from pages, placeholders, non-sales inboxes.
  if (!email || !isProspectableEmail(email)) return { personId: null, companyId: null };
  const nameParts = String(r.name || "").trim().split(/\s+/).filter(Boolean);
  // r.name is often the company ("Reiss", "Head Office") — only treat it as a
  // person's name when it doesn't look like the company or an email fragment.
  const guessedFirst = greetingFirstName(r.name, { company: r.company, email });
  const first = String(r.first_name || (guessedFirst !== "there" ? nameParts[0] : "") || "Contact");
  const last = String(r.last_name || (guessedFirst !== "there" ? nameParts.slice(1).join(" ") : "") || "");
  const fullName = [first, last].filter(Boolean).join(" ") || email;

  const { data: person } = await db.from("people").select("id, company_id").eq("user_id", userId).eq("email", email).maybeSingle();
  let personId: string | null = person?.id ?? null;
  let companyId: string | null = person?.company_id ?? null;

  if (!companyId) {
    const domain = (email.split("@")[1] || "").toLowerCase();
    const isFree = FREEMAIL.has(domain);
    let companyName = String(r.company || "").trim();
    if (!companyName) companyName = isFree ? email : (domainToName(domain) || email);

    const { data: existingCo } = await db.from("companies").select("id").eq("user_id", userId).eq("name", companyName).limit(1).maybeSingle();
    if (existingCo?.id) companyId = existingCo.id;
    else {
      const { data: co, error } = await db.from("companies").insert({ user_id: userId, name: companyName, general_email: isFree ? email : null }).select("id").single();
      if (co?.id) companyId = co.id;
      else if (error) {
        const { data: retry } = await db.from("companies").select("id").eq("user_id", userId).eq("name", companyName).limit(1).maybeSingle();
        companyId = retry?.id ?? null;
      }
    }
  }
  if (!companyId) return { personId, companyId: null };

  if (personId) {
    if (!person?.company_id) await db.from("people").update({ company_id: companyId }).eq("id", personId);
  } else {
    const { data: np, error: pErr } = await db.from("people").insert({ user_id: userId, email, first_name: first, last_name: last, company_id: companyId }).select("id").single();
    if (np?.id) personId = np.id;
    else if (pErr) {
      const { data: retry } = await db.from("people").select("id, company_id").eq("user_id", userId).eq("email", email).maybeSingle();
      if (retry?.id) { personId = retry.id; if (!retry.company_id) await db.from("people").update({ company_id: companyId }).eq("id", retry.id); }
    }
  }

  // Verified contact on the company: this is what send-sequence-email delivers to.
  const { data: ec } = await db.from("contacts").select("id, email_verified").eq("company_id", companyId).eq("email", email).maybeSingle();
  if (ec?.id) {
    if (!ec.email_verified) await db.from("contacts").update({ email_verified: true }).eq("id", ec.id);
  } else {
    await db.from("contacts").insert({ company_id: companyId, name: fullName, email, email_verified: true, is_primary_contact: true });
  }
  return { personId, companyId };
}

export const FOLLOWUP_STEPS = [
  { subject: "Just following up", body: "Hi {{firstName}},\n\nI wanted to quickly follow up on my previous email in case it slipped through. Would you be open to a short conversation?\n\nThanks!", delayDays: 1 },
  { subject: "Re: quick follow-up", body: "Hi {{firstName}},\n\nCircling back on this — I'd genuinely value your thoughts, and I'm happy to share more detail or answer any questions.\n\nBest,", delayDays: 2 },
  { subject: "Last note from me", body: "Hi {{firstName}},\n\nI don't want to clutter your inbox, so this will be my last note. If the timing isn't right, no problem at all — just let me know and I'll reach out again down the line.\n\nThanks for your time.", delayDays: 2 },
];
export const NOREPLY_SEQ_NAME = "No-reply follow-up (Day 1 / 3 / 5)";

export async function ensureNoReplySequence(db: any, userId: string): Promise<string | null> {
  const { data: existing } = await db.from("email_sequences").select("id").eq("created_by", userId).eq("name", NOREPLY_SEQ_NAME).limit(1).maybeSingle();
  if (existing?.id) return existing.id;
  const { data: seq } = await db.from("email_sequences").insert({
    name: NOREPLY_SEQ_NAME,
    description: "Auto-created: 3 gentle follow-ups on day 1, 3 and 5. Stops automatically as soon as the recipient replies.",
    steps: FOLLOWUP_STEPS.map((s) => JSON.stringify(s)),
    created_by: userId, repeat_sequence: false, repeat_after_days: 5, repeat_only_for: "no_reply",
    auto_respond: false, use_email_branding: true,
  }).select("id").single();
  return seq?.id ?? null;
}

/** Parse email_sequences.steps (array of objects or JSON strings) into objects. */
export function parseSteps(raw: unknown): Array<{ subject: string; body: string; delayDays: number; automation_rule?: { type?: string; wait_hours?: number } }> {
  const arr = Array.isArray(raw) ? raw : [];
  return arr.map((s: unknown) => {
    const o = typeof s === "string" ? (() => { try { return JSON.parse(s); } catch { return {}; } })() : (s as Record<string, unknown>) || {};
    return {
      subject: String((o as any).subject ?? ""),
      body: String((o as any).body ?? ""),
      delayDays: typeof (o as any).delayDays === "number" ? (o as any).delayDays : Number((o as any).delay_days ?? (o as any).delayDays ?? 2) || 2,
      ...((o as any).automation_rule ? { automation_rule: (o as any).automation_rule } : {}),
    };
  });
}
