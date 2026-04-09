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
