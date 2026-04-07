/**
 * Delimited row parser (quoted fields, CRLF/LF). Use comma for CSV or tab for TSV.
 */
export function parseDelimited(text: string, delimiter: "," | "\t"): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let i = 0;
  let inQuotes = false;
  const s = text.replace(/^\uFEFF/, ""); // BOM

  while (i < s.length) {
    const c = s[i];
    if (inQuotes) {
      if (c === '"') {
        if (s[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += c;
      i++;
      continue;
    }
    if (c === '"') {
      inQuotes = true;
      i++;
      continue;
    }
    if (c === delimiter) {
      row.push(field);
      field = "";
      i++;
      continue;
    }
    if (c === "\r" || c === "\n") {
      if (c === "\r" && s[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      i++;
      continue;
    }
    field += c;
    i++;
  }
  row.push(field);
  if (row.length > 1 || row[0] !== "" || rows.length === 0) {
    rows.push(row);
  }
  return rows;
}

/** Minimal CSV parser (quoted fields, commas, CRLF/LF). */
export function parseCsv(text: string): string[][] {
  return parseDelimited(text, ",");
}

/** Sniff tab- vs comma-separated from the first line (for .txt / unknown extension). */
export function sniffDelimiter(firstLine: string): "," | "\t" {
  const tabs = (firstLine.match(/\t/g) || []).length;
  const commas = (firstLine.match(/,/g) || []).length;
  if (tabs === 0 && commas === 0) return ",";
  return tabs > commas ? "\t" : ",";
}

/** Parse CSV or TSV from text (BOM stripped; delimiter from first line). */
export function parseSpreadsheetText(text: string): string[][] {
  const s = text.replace(/^\uFEFF/, "");
  const nl = s.search(/\r?\n/);
  const firstLine = (nl >= 0 ? s.slice(0, nl) : s).replace(/\r$/, "");
  const delim = sniffDelimiter(firstLine);
  return parseDelimited(s, delim);
}

function normalizeHeader(h: string): string {
  return h
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/-/g, "_");
}

export type CsvColumnMap = {
  email: number;
  first_name: number | null;
  last_name: number | null;
  full_name: number | null;
  subject: number | null;
  body: number | null;
  body_html: number | null;
  footer: number | null;
};

function findCol(headers: string[], candidates: string[]): number | null {
  const norm = headers.map(normalizeHeader);
  for (const cand of candidates) {
    const idx = norm.indexOf(cand);
    if (idx >= 0) return idx;
  }
  return null;
}

export function detectColumnMap(headerRow: string[]): { map: CsvColumnMap | null; error?: string } {
  const headers = headerRow.map((h) => h.trim());
  const email = findCol(headers, ["email", "e_mail", "e_mail_address", "mail"]);
  if (email === null) {
    return { map: null, error: 'Missing required column "email" (or "mail").' };
  }
  return {
    map: {
      email,
      first_name: findCol(headers, ["first_name", "firstname", "first", "given_name"]),
      last_name: findCol(headers, ["last_name", "lastname", "last", "surname", "family_name"]),
      full_name: findCol(headers, ["full_name", "name", "contact_name", "recipient_name"]),
      subject: findCol(headers, ["subject", "title", "email_subject"]),
      body: findCol(headers, ["body", "message", "email_body", "text", "plain", "body_text"]),
      body_html: findCol(headers, ["body_html", "html_body", "html", "email_html"]),
      footer: findCol(headers, ["footer", "signature", "email_footer"]),
    },
  };
}

export type CsvImportRow = {
  email: string;
  first_name: string;
  last_name: string;
  subject: string;
  bodyText: string;
  bodyHtml: string;
  rowFooter: string;
};

function cell(row: string[], idx: number | null): string {
  if (idx === null || idx < 0 || idx >= row.length) return "";
  return (row[idx] ?? "").trim();
}

/** Plain text to simple HTML paragraphs (reuse app convention). */
export function plainToEmailHtml(text: string): string {
  const raw = (text || "").trim();
  if (!raw) return "<p></p>";
  if (raw.includes("<p>") || raw.includes("<div") || raw.includes("<br")) return raw;
  const paras = raw.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  if (paras.length === 0) return "<p></p>";
  return paras.map((p) => `<p style="margin:0 0 12px 0;line-height:1.5;">${escapeHtml(p).replace(/\n/g, "<br>")}</p>`).join("");
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function parseCampaignCsvRows(
  rows: string[][],
  map: CsvColumnMap,
  defaultSubject: string
): { ok: CsvImportRow[]; errors: string[] } {
  if (rows.length < 2) {
    return { ok: [], errors: ["CSV has no data rows."] };
  }
  const dataRows = rows.slice(1).filter((r) => r.some((c) => String(c).trim() !== ""));
  const ok: CsvImportRow[] = [];
  const errors: string[] = [];
  dataRows.forEach((row, lineIdx) => {
    const lineNum = lineIdx + 2;
    const email = cell(row, map.email).toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.push(`Row ${lineNum}: invalid or missing email.`);
      return;
    }
    let first = cell(row, map.first_name);
    let last = cell(row, map.last_name);
    const full = cell(row, map.full_name);
    if (!first && !last && full) {
      const parts = full.split(/\s+/);
      first = parts[0] || "";
      last = parts.slice(1).join(" ") || "";
    }
    const subject = cell(row, map.subject) || defaultSubject || "";
    const bodyHtmlRaw = cell(row, map.body_html);
    const bodyPlain = cell(row, map.body);
    let bodyText = bodyPlain;
    let bodyHtml = bodyHtmlRaw;
    if (!bodyHtmlRaw && bodyPlain) {
      bodyHtml = plainToEmailHtml(bodyPlain);
    }
    if (!bodyPlain && bodyHtmlRaw) {
      bodyText = bodyHtmlRaw.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    }
    if (!bodyText.trim() && !bodyHtml.trim()) {
      errors.push(`Row ${lineNum} (${email}): missing body (use "body" or "body_html" column).`);
      return;
    }
    const rowFooter = cell(row, map.footer);
    ok.push({
      email,
      first_name: first,
      last_name: last,
      subject: subject || "(No subject)",
      bodyText: bodyText || bodyTextFromHtml(bodyHtml),
      bodyHtml: bodyHtml || plainToEmailHtml(bodyText),
      rowFooter,
    });
  });
  return { ok, errors };
}

function bodyTextFromHtml(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}
