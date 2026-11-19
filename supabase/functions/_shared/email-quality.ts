// Shared rules for "is this an address we should ever prospect to?", the
// suppression list built from bounces, bounce-notice parsing, and a safe
// greeting name. Every scraper and every sender should go through these, so a
// bad address is stopped once instead of in five slightly different ways.
//
// Pure functions only, apart from loadSuppressedEmails (which takes the db).

// Website asset names that look like emails to a naive regex:
// "shadow@2x.png", "rae-hero2@2x-optimized-1-600x350.jpg", "pad192x192@stretch.png".
const FILE_EXTENSION =
  /\.(png|jpe?g|gif|webp|svg|bmp|ico|tiff?|avif|heic|css|js|mjs|json|xml|pdf|zip|woff2?|ttf|eot|otf|mp4|mov|webm|mp3|wav)$/i;

// Domains that only ever appear as placeholders, template filler or third-party
// tooling embedded in a page, never as a real prospect's mailbox.
const PLACEHOLDER_DOMAINS = new Set([
  "example.com", "example.co.uk", "example.org", "example.net",
  "domain.com", "yourdomain.com", "email.com", "youremail.com", "yourcompany.com",
  "company.com", "test.com", "abc.xyz", "sentry.io", "wixpress.com",
  "sentry.wixpress.com", "sentry-next.wixpress.com", "godaddy.com",
]);
const RESERVED_TLD = /\.(example|test|invalid|localhost|local)$/i;

// Local parts that are placeholders in website templates and form hints.
const PLACEHOLDER_LOCALS = new Set([
  "test", "testing", "example", "email", "youremail", "your.email", "yourname", "your.name",
  "name", "user", "username", "someone", "somebody", "filler", "ex", "sample", "me",
  "john.doe", "jane.doe", "johndoe", "janedoe", "john", "jane", "first.last", "firstname.lastname",
]);

// Specific addresses scraped from page boilerplate (font credits, theme authors).
const KNOWN_JUNK = new Set(["impallari@gmail.com"]);

// Mailboxes that are never a sales contact and tend to reject or ignore outreach.
const NON_SALES_LOCAL =
  /^(noreply|no-reply|donotreply|do-not-reply|mailer-daemon|postmaster|hostmaster|webmaster|abuse|privacy|dpo|gdpr|legal|unsubscribe|press|media|careers|jobs|recruit(ment|ing)?|hr|security|billing|invoices?|complaints|compliance|whistleblow\w*)$/i;

/** Lowercase, trim, drop a leading mailto: and wrapping punctuation. */
export function normalizeEmail(raw: unknown): string {
  return String(raw ?? "")
    .trim()
    .replace(/^mailto:/i, "")
    .replace(/^[<("']+|[>)"'.,;:]+$/g, "")
    .toLowerCase();
}

/**
 * Why an address must not be prospected to, or null when it is fine.
 * Checks shape first, then the junk/placeholder/non-sales lists.
 */
export function emailRejectReason(raw: unknown): string | null {
  const email = normalizeEmail(raw);
  if (!email) return "empty";
  if (email.length > 254) return "too long";
  const at = email.lastIndexOf("@");
  if (at <= 0 || at !== email.indexOf("@")) return "not an email address";
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  if (local.length > 64 || !/^[a-z0-9!#$%&'*+/=?^_`{|}~.-]+$/.test(local) || /^\.|\.$|\.\./.test(local)) {
    return "not an email address";
  }
  const labels = domain.split(".");
  if (labels.length < 2 || labels.some((l) => !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(l))) {
    return "not an email address";
  }
  if (!/^[a-z]{2,24}$/.test(labels[labels.length - 1])) return "not an email address";
  if (FILE_EXTENSION.test(email)) return "image or file name, not an email address";
  // Retina asset suffixes ("logo@2x-foo...") even when the extension was cut off.
  if (/^\d+(\.\d+)?x\b/.test(domain)) return "image or file name, not an email address";
  if (KNOWN_JUNK.has(email)) return "address copied from page boilerplate";
  if (PLACEHOLDER_DOMAINS.has(domain) || RESERVED_TLD.test(domain)) return "placeholder address";
  if (PLACEHOLDER_LOCALS.has(local)) return "placeholder address";
  if (NON_SALES_LOCAL.test(local)) return "non-sales mailbox";
  return null;
}

export function isProspectableEmail(raw: unknown): boolean {
  return emailRejectReason(raw) === null;
}

/**
 * Addresses this user must never mail again: hard bounces and spam complaints,
 * from Resend webhooks and from Gmail bounce notices alike.
 */
// deno-lint-ignore no-explicit-any
export async function loadSuppressedEmails(db: any, userId: string | null | undefined): Promise<Set<string>> {
  const out = new Set<string>();
  if (!userId) return out;
  const { data, error } = await db
    .from("email_bounce_events")
    .select("recipient_email")
    .eq("user_id", userId)
    .in("bounce_type", ["hard", "complaint"])
    .limit(20000);
  if (error) {
    console.error("[email-quality] Could not load suppression list:", error.message);
    return out;
  }
  for (const row of data || []) {
    const e = normalizeEmail((row as { recipient_email?: string }).recipient_email);
    if (e) out.add(e);
  }
  return out;
}

export interface ParsedBounce {
  recipient: string;
  /** false for "Delivery incomplete / will retry" delay notices. */
  permanent: boolean;
  reason: string;
}

const BOUNCE_SENDER = /mailer-daemon|postmaster@|mail delivery (subsystem|system)/i;
const BOUNCE_SUBJECT =
  /delivery status notification|undeliver|delivery (has )?failed|returned mail|mail delivery failed|failure notice|couldn'?t be delivered|not delivered|delivery incomplete/i;
const DELAY_HINT = /\(delay\)|delivery incomplete|will retry|temporary problem delivering|delayed/i;

/**
 * Recognise a bounce notice (Gmail mailer-daemon, Office 365 postmaster, …)
 * and pull out who it was for. Returns null for anything that is not a bounce,
 * so callers can use it to keep bounces out of the "replies" path.
 */
export function parseBounce(
  msg: { from?: string | null; subject?: string | null; body?: string | null },
  ownAddresses: string[] = [],
): ParsedBounce | null {
  const from = String(msg.from || "");
  const subject = String(msg.subject || "");
  const body = String(msg.body || "");
  if (!BOUNCE_SENDER.test(from) && !BOUNCE_SUBJECT.test(subject)) return null;

  const own = new Set(ownAddresses.map(normalizeEmail).filter(Boolean));
  const usable = (e: string) => !!e && !own.has(e) && !BOUNCE_SENDER.test(e);

  let recipient = "";
  const headerMatch = body.match(/(?:Final|Original)-Recipient:\s*rfc822;\s*<?([^\s>]+@[^\s>]+)>?/i);
  if (headerMatch && usable(normalizeEmail(headerMatch[1]))) recipient = normalizeEmail(headerMatch[1]);
  if (!recipient) {
    const prose = body.match(
      /(?:delivered to|message to|delivering your message to|couldn'?t be delivered to|forwarded from)\s+<?([^\s<>]+@[^\s<>]+)/i,
    );
    if (prose && usable(normalizeEmail(prose[1]))) recipient = normalizeEmail(prose[1]);
  }
  if (!recipient) {
    for (const m of body.matchAll(/[^\s@<>()"',;:]+@[^\s@<>()"',;:]+\.[a-z0-9]{2,}/gi)) {
      const e = normalizeEmail(m[0]);
      if (usable(e)) { recipient = e; break; }
    }
  }
  if (!recipient) return null;

  const diag = body.match(/Diagnostic-Code:\s*(?:smtp;\s*)?([^\r\n]+)/i)?.[1]
    || body.match(/The response (?:from the remote server )?was:\s*\n?\s*([^\r\n]+)/i)?.[1]
    || subject;
  const permanent = !DELAY_HINT.test(subject) && !/^Action:\s*delayed/im.test(body) && !/^Status:\s*4\./im.test(body)
    && !DELAY_HINT.test(body.slice(0, 400));
  return { recipient, permanent, reason: diag.trim().slice(0, 500) };
}

// Words that end up in a first-name field from company names, page chrome or
// email local parts, and are never a person's name.
const NOT_A_FIRST_NAME = new Set([
  "contact", "info", "hello", "team", "office", "head", "admin", "enquiries", "enquiry", "sales",
  "support", "reception", "manager", "owner", "customer", "client", "group", "member", "manual",
  "footer", "header", "logo", "sharing", "access", "network", "the", "dr", "drs", "mr", "mrs",
  "ms", "dear", "sir", "madam", "there", "unknown", "null", "undefined",
]);

/**
 * The first name to put after "Hi". Falls back to "there" whenever the value
 * looks like a company, a role, a file name or an email fragment rather than a
 * person (e.g. "Hi Reiss", "Hi footer", "Hi Because" are what this prevents).
 */
export function greetingFirstName(
  rawName: unknown,
  opts: { company?: string | null; email?: string | null } = {},
): string {
  const name = String(rawName ?? "").trim();
  if (!name || /[@\d_/\\]/.test(name)) return "there";
  const first = name.split(/\s+/)[0].replace(/[.,;:!]+$/, "");
  if (first.length < 2 || !/^[A-Za-zÀ-ɏ][A-Za-zÀ-ɏ'’-]*$/.test(first)) return "there";
  // Scraped fragments come through lowercase; a real name has a capital.
  if (first === first.toLowerCase()) return "there";
  // ALL-CAPS single words are usually acronyms/brands ("NHS", "UK").
  if (first.length > 1 && first === first.toUpperCase()) return "there";
  const lower = first.toLowerCase();
  if (NOT_A_FIRST_NAME.has(lower)) return "there";
  const company = String(opts.company ?? "").trim().toLowerCase();
  if (company) {
    const companyFirst = company.split(/[\s.,&-]+/)[0];
    if (lower === companyFirst || lower === company) return "there";
  }
  const domain = normalizeEmail(opts.email).split("@")[1] || "";
  if (domain && domain.split(".")[0].startsWith(lower)) return "there";
  // A whole multi-word value equal to the company is a company, not a person.
  if (company && name.toLowerCase() === company) return "there";
  return first;
}
