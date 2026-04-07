import {
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

function rowFromObject(obj: unknown, lineNum: number, defaultSubject: string): { row?: CsvImportRow; error?: string } {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) {
    return { error: `Row ${lineNum}: expected an object.` };
  }
  const o = obj as Record<string, unknown>;
  const email = pickStr(o, ["email", "Email", "e_mail", "mail", "E-mail"]).toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: `Row ${lineNum}: invalid or missing email.` };
  }
  let first = pickStr(o, ["first_name", "firstName", "firstname", "First Name"]);
  let last = pickStr(o, ["last_name", "lastName", "lastname", "Last Name"]);
  const full = pickStr(o, ["full_name", "name", "fullName", "recipient_name", "contact_name"]);
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
    return { error: `Row ${lineNum} (${email}): missing body (use "body" or "body_html").` };
  }
  const rowFooter = pickStr(o, ["footer", "Footer", "signature", "email_footer"]);
  return {
    row: {
      email,
      first_name: first,
      last_name: last,
      subject: subject || "(No subject)",
      bodyText: bodyText || bodyTextFromHtml(bodyHtml),
      bodyHtml: bodyHtml || plainToEmailHtml(bodyText),
      rowFooter,
    },
  };
}

function bodyTextFromHtml(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function extractJsonArray(data: unknown): unknown[] | null {
  if (Array.isArray(data)) return data;
  if (data && typeof data === "object") {
    const o = data as Record<string, unknown>;
    for (const k of ["recipients", "messages", "rows", "people", "contacts", "data"]) {
      const v = o[k];
      if (Array.isArray(v)) return v;
    }
  }
  return null;
}

/**
 * Parse campaign rows from JSON: a top-level array, or { recipients | messages | rows | people | contacts | data: [...] }.
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
        'JSON must be an array of objects, or an object with key "recipients", "messages", "rows", "people", "contacts", or "data".',
      ],
    };
  }
  const ok: CsvImportRow[] = [];
  arr.forEach((item, i) => {
    const lineNum = i + 1;
    const { row, error } = rowFromObject(item, lineNum, defaultSubject);
    if (error) errors.push(error);
    else if (row) ok.push(row);
  });
  return { ok, errors };
}
