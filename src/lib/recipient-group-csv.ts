import { parseCSV, type ParsedCSV } from "@/lib/utils/csv-parser";

export type RecipientGroupCsvRow = {
  email: string;
  first_name: string | null;
  last_name: string | null;
  company: string | null;
};

const EMAIL_HEADER_RE = /^(e-?mail|email\s*address|e\s*mail)$/i;
const FIRST_HEADER_RE = /^(first|given|fname|first\s*name)$/i;
const LAST_HEADER_RE = /^(last|surname|lname|last\s*name|family)$/i;
const COMPANY_HEADER_RE = /^(company|organisation|organization|business)$/i;

/** Basic check for a plausible single email (not full newsletter validation). */
export function looksLikeEmail(s: string): boolean {
  const t = s.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t);
}

function findEmailColumnIndex(headers: string[]): number {
  const normalized = headers.map((h) => h.trim().toLowerCase());
  for (let i = 0; i < normalized.length; i++) {
    if (EMAIL_HEADER_RE.test(normalized[i])) return i;
  }
  for (let i = 0; i < normalized.length; i++) {
    if (normalized[i] === "email" || normalized[i].endsWith("email")) return i;
  }
  return 0;
}

function headerMatch(headers: string[], re: RegExp): number {
  for (let i = 0; i < headers.length; i++) {
    if (re.test(headers[i].trim())) return i;
  }
  return -1;
}

/**
 * Parse CSV/TSV text into deduped recipient rows (by email).
 * Expects a header row with an email column (or uses first column).
 */
export function parseRecipientRowsFromCSVText(csvText: string): RecipientGroupCsvRow[] {
  const text = csvText.trim();
  if (!text) return [];
  const parsed: ParsedCSV = parseCSV(text, { firstRowIsHeaders: true });
  if (parsed.headers.length === 0 || parsed.rows.length === 0) return [];

  const emailIdx = findEmailColumnIndex(parsed.headers);
  const firstIdx = headerMatch(parsed.headers, FIRST_HEADER_RE);
  const lastIdx = headerMatch(parsed.headers, LAST_HEADER_RE);
  const companyIdx = headerMatch(parsed.headers, COMPANY_HEADER_RE);

  const seen = new Set<string>();
  const out: RecipientGroupCsvRow[] = [];

  for (const row of parsed.rows) {
    const raw =
      row[parsed.headers[emailIdx]] ??
      Object.values(row)[0] ??
      "";
    const parts = raw
      .split(/[,;\s]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    for (const part of parts) {
      if (!looksLikeEmail(part)) continue;
      const email = part.toLowerCase();
      if (seen.has(email)) continue;
      seen.add(email);

      const first =
        firstIdx >= 0 ? (row[parsed.headers[firstIdx]] || "").trim() || null : null;
      const last =
        lastIdx >= 0 ? (row[parsed.headers[lastIdx]] || "").trim() || null : null;
      const company =
        companyIdx >= 0 ? (row[parsed.headers[companyIdx]] || "").trim() || null : null;

      out.push({
        email,
        first_name: first,
        last_name: last,
        company,
      });
    }
  }

  return out;
}

export type RecipientGroupPhoneRow = {
  phone: string;
  first_name: string | null;
  last_name: string | null;
  company: string | null;
};

const PHONE_HEADER_RE = /^(phone|mobile|tel|telephone|cell|whatsapp|msisdn|contact\s*number)$/i;
const NAME_HEADER_RE = /^(name|full\s*name|contact)$/i;

function looksLikePhone(s: string): boolean {
  const digits = s.replace(/\D/g, "");
  return digits.length >= 7 && digits.length <= 15;
}

function normalizePhone(raw: string): string {
  const t = raw.trim();
  if (!t) return "";
  if (t.startsWith("+")) return `+${t.slice(1).replace(/\D/g, "")}`;
  const digits = t.replace(/\D/g, "");
  return digits ? `+${digits}` : "";
}

/** Parse CSV/TSV or pasted lines into phone recipient rows. */
export function parsePhoneRecipientRowsFromText(text: string): RecipientGroupPhoneRow[] {
  const trimmed = text.trim();
  if (!trimmed) return [];

  // Prefer CSV with headers when multiple columns present
  if (trimmed.includes(",") || trimmed.includes("\t") || /\n/.test(trimmed)) {
    try {
      const parsed: ParsedCSV = parseCSV(trimmed, { firstRowIsHeaders: true });
      if (parsed.headers.length && parsed.rows.length) {
        const phoneIdx =
          headerMatch(parsed.headers, PHONE_HEADER_RE) >= 0
            ? headerMatch(parsed.headers, PHONE_HEADER_RE)
            : (() => {
                for (let i = 0; i < parsed.headers.length; i++) {
                  const sample = parsed.rows.slice(0, 5).map((r) => (r[parsed.headers[i]] || "").trim()).join(" ");
                  if (looksLikePhone(sample)) return i;
                }
                return 0;
              })();
        const firstIdx = headerMatch(parsed.headers, FIRST_HEADER_RE);
        const lastIdx = headerMatch(parsed.headers, LAST_HEADER_RE);
        const companyIdx = headerMatch(parsed.headers, COMPANY_HEADER_RE);
        const nameIdx = headerMatch(parsed.headers, NAME_HEADER_RE);
        const seen = new Set<string>();
        const out: RecipientGroupPhoneRow[] = [];
        for (const row of parsed.rows) {
          const raw = (row[parsed.headers[phoneIdx]] || Object.values(row)[0] || "").toString().trim();
          // Split multi-phone cells
          for (const part of raw.split(/[,;]+/).map((s) => s.trim()).filter(Boolean)) {
            if (!looksLikePhone(part)) continue;
            const phone = normalizePhone(part);
            const key = phone.replace(/\D/g, "");
            if (!key || seen.has(key)) continue;
            seen.add(key);
            let first =
              firstIdx >= 0 ? (row[parsed.headers[firstIdx]] || "").trim() || null : null;
            let last =
              lastIdx >= 0 ? (row[parsed.headers[lastIdx]] || "").trim() || null : null;
            if (!first && !last && nameIdx >= 0) {
              const full = (row[parsed.headers[nameIdx]] || "").trim();
              const parts = full.split(/\s+/);
              first = parts[0] || null;
              last = parts.length > 1 ? parts.slice(1).join(" ") : null;
            }
            const company =
              companyIdx >= 0 ? (row[parsed.headers[companyIdx]] || "").trim() || null : null;
            out.push({ phone, first_name: first, last_name: last, company });
          }
        }
        if (out.length) return out;
      }
    } catch {
      // fall through to line scrape
    }
  }

  // Fallback: scrape phone-like tokens from free text
  const seen = new Set<string>();
  const out: RecipientGroupPhoneRow[] = [];
  const tokens = trimmed.split(/[\n,;]+/).map((s) => s.trim()).filter(Boolean);
  for (const token of tokens) {
    // Allow "Name +1 555..." style
    const phoneMatch = token.match(/(\+?[\d][\d\s().\-]{6,}\d)/);
    const rawPhone = phoneMatch ? phoneMatch[1] : token;
    if (!looksLikePhone(rawPhone)) continue;
    const phone = normalizePhone(rawPhone);
    const key = phone.replace(/\D/g, "");
    if (!key || seen.has(key)) continue;
    seen.add(key);
    const namePart = phoneMatch ? token.replace(phoneMatch[0], "").trim() : "";
    const parts = namePart.split(/\s+/).filter(Boolean);
    out.push({
      phone,
      first_name: parts[0] || null,
      last_name: parts.length > 1 ? parts.slice(1).join(" ") : null,
      company: null,
    });
  }
  return out;
}
