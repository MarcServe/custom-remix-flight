import {
  expandCampaignEmailCell,
  plainToEmailHtml,
  type CsvImportRow,
} from "@/lib/csv-campaign-import";

function pickStr(obj: Record<string, unknown>, keys: string[]): string {
  for (const k of keys) {
    const v = obj[k];
    if (v != null && String(v).trim() !== "") return String(v).trim();
  }
  return "";
}

function collectEmails(o: Record<string, unknown>): string[] {
  const fromField = expandCampaignEmailCell(
    pickStr(o, ["email", "Email", "e_mail", "mail", "E-mail", "emails", "Emails"])
  );
  if (fromField.length) return fromField;

  // Array of emails or contacts on one business object
  for (const key of ["emails", "Emails", "contacts", "Contacts"]) {
    const v = o[key];
    if (!Array.isArray(v)) continue;
    const out: string[] = [];
    for (const item of v) {
      if (typeof item === "string") out.push(...expandCampaignEmailCell(item));
      else if (item && typeof item === "object") {
        const email = pickStr(item as Record<string, unknown>, ["email", "Email", "mail"]);
        out.push(...expandCampaignEmailCell(email));
      }
    }
    if (out.length) return [...new Set(out.map((e) => e.toLowerCase()))];
  }
  return [];
}

function rowsFromObject(
  obj: unknown,
  lineNum: number,
  defaultSubject: string
): { rows: CsvImportRow[]; error?: string } {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) {
    return { rows: [], error: `Row ${lineNum}: expected an object.` };
  }
  const o = obj as Record<string, unknown>;
  const emails = collectEmails(o);
  if (emails.length === 0) {
    return {
      rows: [],
      error: `Row ${lineNum}: invalid or missing email. Tip: use one email, a comma-separated list, or an "emails" array — each address becomes its own recipient.`,
    };
  }
  let first = pickStr(o, ["first_name", "firstName", "firstname", "First Name"]);
  let last = pickStr(o, ["last_name", "lastName", "lastname", "Last Name"]);
  const full = pickStr(o, ["full_name", "name", "fullName", "recipient_name", "contact_name", "propertyName", "company"]);
  if (!first && !last && full) {
    const parts = full.split(/\s+/);
    first = parts[0] || "";
    last = parts.slice(1).join(" ") || "";
  }
  const subject = pickStr(o, ["subject", "Subject", "title", "email_subject"]) || defaultSubject || "";
  const bodyHtmlRaw = pickStr(o, ["body_html", "bodyHtml", "html_body", "html", "email_html"]);
  const bodyPlain = pickStr(o, ["body", "Body", "message", "email_body", "text", "plain", "body_text", "bodyText"]);
  let bodyText = bodyPlain;
  let bodyHtml = bodyHtmlRaw;
  if (!bodyHtmlRaw && bodyPlain) {
    bodyHtml = plainToEmailHtml(bodyPlain);
  }
  if (!bodyPlain && bodyHtmlRaw) {
    bodyText = bodyHtmlRaw.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  }
  if (!bodyText.trim() && !bodyHtml.trim()) {
    return {
      rows: [],
      error: `Row ${lineNum} (${emails[0]}): missing body (use "body" or "body_html").`,
    };
  }
  const rowFooter = pickStr(o, ["footer", "Footer", "signature", "email_footer"]);
  const finalizedText = bodyText || bodyTextFromHtml(bodyHtml);
  const finalizedHtml = bodyHtml || plainToEmailHtml(bodyText);
  return {
    rows: emails.map((email) => ({
      email,
      first_name: first,
      last_name: last,
      subject: subject || "(No subject)",
      bodyText: finalizedText,
      bodyHtml: finalizedHtml,
      rowFooter,
    })),
  };
}

function bodyTextFromHtml(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function extractJsonArray(data: unknown): unknown[] | null {
  if (Array.isArray(data)) return data;
  if (data && typeof data === "object") {
    const o = data as Record<string, unknown>;
    for (const k of ["recipients", "messages", "rows", "people", "contacts", "data", "leads"]) {
      const v = o[k];
      if (Array.isArray(v)) return v;
    }
  }
  return null;
}

/**
 * Parse campaign rows from JSON: a top-level array, or { recipients | messages | rows | people | contacts | data: [...] }.
 * Multiple emails on one business (comma-separated or emails[]) expand to one recipient each.
 */
export function parseCampaignJson(text: string, defaultSubject: string): { ok: CsvImportRow[]; errors: string[] } {
  const errors: string[] = [];
  let data: unknown;
  try {
    data = JSON.parse(text.replace(/^\uFEFF/, ""));
  } catch {
    return { ok: [], errors: ["Invalid JSON."] };
  }
  const arr = extractJsonArray(data);
  if (!arr) {
    return {
      ok: [],
      errors: [
        'JSON must be an array of objects, or an object with key "recipients", "messages", "rows", "people", "contacts", "leads", or "data".',
      ],
    };
  }
  const ok: CsvImportRow[] = [];
  const seen = new Set<string>();
  arr.forEach((item, i) => {
    const lineNum = i + 1;
    const { rows, error } = rowsFromObject(item, lineNum, defaultSubject);
    if (error) errors.push(error);
    for (const row of rows) {
      if (seen.has(row.email)) continue;
      seen.add(row.email);
      ok.push(row);
    }
  });
  return { ok, errors };
}
