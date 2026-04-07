/**
 * Extract campaign-ready messages from PDFs (one email per page, or delimiter / Subject: blocks).
 * Pairs with BulkEmailDialog CSV-style personalization (subject + body per recipient).
 */
import { plainToEmailHtml, type CsvImportRow } from "@/lib/csv-campaign-import";

export type PdfCampaignMessage = {
  email?: string;
  first_name: string;
  last_name: string;
  subject: string;
  bodyText: string;
  bodyHtml: string;
  rowFooter: string;
};

let workerConfigured = false;

async function ensurePdfWorker(): Promise<void> {
  if (workerConfigured) return;
  const pdfjs = await import("pdfjs-dist");
  const workerMod = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
  pdfjs.GlobalWorkerOptions.workerSrc = workerMod.default;
  workerConfigured = true;
}

/** Raw text per PDF page (reading order: stream order, good enough for exported mail-merge docs). */
export async function extractTextPerPageFromPdf(file: File): Promise<string[]> {
  await ensurePdfWorker();
  const { getDocument } = await import("pdfjs-dist");
  const data = new Uint8Array(await file.arrayBuffer());
  const doc = await getDocument({ data }).promise;
  const pages: string[] = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const tc = await page.getTextContent();
    const parts = tc.items
      .map((item) => {
        if (item && typeof item === "object" && "str" in item && typeof (item as { str: string }).str === "string") {
          return (item as { str: string }).str;
        }
        return "";
      })
      .filter(Boolean);
    pages.push(parts.join(" ").replace(/\s+/g, " ").trim());
  }
  return pages;
}

/** Split full document text into candidate message blocks. */
export function splitDocumentIntoRawBlocks(text: string): string[] {
  let t = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
  if (!t) return [];

  const byHeavyRule = t.split(/\n\s*[-_*]{4,}\s*\n/);
  if (byHeavyRule.length >= 2) {
    return byHeavyRule.map((s) => s.trim()).filter(Boolean);
  }
  const byEqRule = t.split(/\n\s*={4,}\s*\n/);
  if (byEqRule.length >= 2) {
    return byEqRule.map((s) => s.trim()).filter(Boolean);
  }

  const subParts = t.split(/\n(?=Subject\s*:)/i).map((s) => s.trim()).filter(Boolean);
  if (subParts.length >= 2) {
    return subParts.filter((s, i) => i === 0 && !/^subject\s*:/i.test(s) && s.length < 80 ? false : true);
  }

  const numSplit = t.split(/\n(?=\d{1,4}[\.\)]\s*(?:Subject|SUBJECT|Message)\s*:)/i);
  if (numSplit.length >= 2) {
    return numSplit.map((s) => s.trim()).filter(Boolean);
  }

  return [t];
}

/**
 * Parse one block of plain text into subject, body, optional email / names / footer.
 */
export function parseRawPdfBlock(block: string): Omit<PdfCampaignMessage, "bodyHtml"> | null {
  const b0 = block.replace(/\r/g, "").trim();
  if (!b0 || b0.length < 8) return null;

  let work = b0;
  let rowFooter = "";
  const footMatch = work.match(/(?:^|\n)\s*Footer\s*:\s*([\s\S]*)$/i);
  if (footMatch && footMatch.index != null) {
    rowFooter = footMatch[1].trim();
    work = work.slice(0, footMatch.index).trim();
  }

  let email: string | undefined;
  const emailM = work.match(/(?:^|\n)\s*(?:To|Email|E-mail)\s*:\s*([^\s@]+@[^\s@]+\.[^\s@]+)/i);
  if (emailM) email = emailM[1].toLowerCase().trim();

  let first_name = "";
  let last_name = "";
  const fnM = work.match(/(?:^|\n)\s*First(?:\s*name)?\s*:\s*(.+)/i);
  const lnM = work.match(/(?:^|\n)\s*Last(?:\s*name)?\s*:\s*(.+)/i);
  if (fnM) first_name = fnM[1].split("\n")[0].trim();
  if (lnM) last_name = lnM[1].split("\n")[0].trim();

  let subject = "";
  let bodyPart = "";

  const subjM = work.match(/(?:^|\n)\s*Subject\s*:\s*(.+?)(?=\n|$)/i);
  if (subjM && subjM.index != null) {
    subject = subjM[1].trim();
    bodyPart = work.slice(subjM.index + subjM[0].length).trim();
  }

  bodyPart = bodyPart.replace(/^\s*Body\s*:\s*/i, "").trim();

  if (!subject) {
    const lines = work.split("\n").map((l) => l.trim()).filter(Boolean);
    if (lines.length >= 2) {
      subject = lines[0].slice(0, 500);
      bodyPart = lines.slice(1).join("\n").trim();
    }
  }

  bodyPart = bodyPart
    .replace(/^(?:To|Email|E-mail)\s*:.*$/im, "")
    .replace(/^(?:First|Last)(?:\s*name)?\s*:.*$/gim, "")
    .replace(/^Subject\s*:.*$/im, "")
    .trim();

  if (!subject.trim() || !bodyPart.trim()) return null;

  return {
    email,
    first_name,
    last_name,
    subject: subject.trim() || "(No subject)",
    bodyText: bodyPart,
    rowFooter,
  };
}

function toFullMessage(partial: Omit<PdfCampaignMessage, "bodyHtml">): PdfCampaignMessage {
  const bodyHtml =
    partial.bodyText.includes("<p>") || partial.bodyText.includes("<div") || partial.bodyText.includes("<br")
      ? partial.bodyText
      : plainToEmailHtml(partial.bodyText);
  return {
    ...partial,
    bodyHtml,
  };
}

/**
 * Choose per-page vs full-document parsing depending on which yields more valid messages.
 */
export function parsePdfTextToMessages(perPageTexts: string[], fullText: string): {
  messages: PdfCampaignMessage[];
  usedPageWise: boolean;
  warnings: string[];
} {
  const warnings: string[] = [];
  const pageMsgs: PdfCampaignMessage[] = [];
  for (const page of perPageTexts) {
    const p = parseRawPdfBlock(page);
    if (p) pageMsgs.push(toFullMessage(p));
  }

  const blocks = splitDocumentIntoRawBlocks(fullText);
  const docMsgs: PdfCampaignMessage[] = [];
  for (const bl of blocks) {
    const p = parseRawPdfBlock(bl);
    if (p) docMsgs.push(toFullMessage(p));
  }

  const nPage = perPageTexts.length;
  const oneMessagePerPage = nPage > 1 && pageMsgs.length === nPage;

  let messages: PdfCampaignMessage[];
  let usedPageWise: boolean;

  if (oneMessagePerPage) {
    messages = pageMsgs;
    usedPageWise = true;
  } else if (docMsgs.length > pageMsgs.length) {
    messages = docMsgs;
    usedPageWise = false;
    if (pageMsgs.length > 0) {
      warnings.push(
        `Used full-document layout (${docMsgs.length} messages). Per-page parsing found ${pageMsgs.length} message(s).`,
      );
    }
  } else if (pageMsgs.length > 0) {
    messages = pageMsgs;
    usedPageWise = true;
    if (docMsgs.length > pageMsgs.length && !oneMessagePerPage) {
      warnings.push("Prefer per-page text; consider one email per PDF page for best results.");
    }
  } else {
    messages = docMsgs;
    usedPageWise = false;
  }

  return { messages, usedPageWise, warnings };
}

export async function extractCampaignMessagesFromPdf(file: File): Promise<{
  messages: PdfCampaignMessage[];
  usedPageWise: boolean;
  warnings: string[];
}> {
  const perPage = await extractTextPerPageFromPdf(file);
  const fullText = perPage.join("\n\n");
  const { messages, usedPageWise, warnings } = parsePdfTextToMessages(perPage, fullText);
  return { messages, usedPageWise, warnings };
}

/** Convert to CSV row shape for shared footer / merge logic in BulkEmailDialog. */
export function pdfMessageToCsvRow(m: PdfCampaignMessage): CsvImportRow {
  return {
    email: m.email ?? "",
    first_name: m.first_name,
    last_name: m.last_name,
    subject: m.subject,
    bodyText: m.bodyText,
    bodyHtml: m.bodyHtml,
    rowFooter: m.rowFooter,
  };
}
