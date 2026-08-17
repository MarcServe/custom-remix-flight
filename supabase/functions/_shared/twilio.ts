export function base64Encode(str: string): string {
  if (typeof btoa !== "undefined") return btoa(str);
  const data = new TextEncoder().encode(str);
  return btoa(String.fromCharCode(...data));
}

export function normalizePhone(raw: string | null | undefined): string {
  if (!raw) return "";
  const trimmed = String(raw).trim();
  const hasPlus = trimmed.startsWith("+");
  const digits = trimmed.replace(/\D/g, "");
  if (!digits) return "";
  return hasPlus ? `+${digits}` : `+${digits}`;
}

export function phonesMatch(a: string, b: string): boolean {
  const na = normalizePhone(a).replace(/\D/g, "");
  const nb = normalizePhone(b).replace(/\D/g, "");
  if (!na || !nb) return false;
  return na === nb || na.endsWith(nb) || nb.endsWith(na);
}

export type TwilioCreds = {
  accountSid: string;
  authToken: string;
  fromNumber: string;
};

export function credsFromMetadata(metadata: Record<string, unknown> | null | undefined): TwilioCreds | null {
  if (!metadata) return null;
  const accountSid = String(metadata.account_sid || "").trim();
  const authToken = String(metadata.auth_token || "").trim();
  const fromNumber = normalizePhone(String(metadata.phone_number || metadata.from_number || ""));
  if (!accountSid || !authToken || !fromNumber) return null;
  return { accountSid, authToken, fromNumber };
}

export async function twilioPost(
  creds: TwilioCreds,
  path: string,
  params: Record<string, string>,
): Promise<{ ok: boolean; status: number; data: Record<string, unknown>; text: string }> {
  const url = `https://api.twilio.com/2010-04-01/Accounts/${creds.accountSid}/${path}`;
  const body = new URLSearchParams(params);
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Basic ${base64Encode(`${creds.accountSid}:${creds.authToken}`)}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
  const text = await res.text();
  let data: Record<string, unknown> = {};
  try { data = JSON.parse(text); } catch { /* Twilio error may be XML */ }
  return { ok: res.ok, status: res.status, data, text };
}

export function xmlEscape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function twiml(body: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?><Response>${body}</Response>`;
}

export const STOP_WORDS = new Set([
  "stop", "stopall", "unsubscribe", "cancel", "end", "quit",
]);

export function isStopKeyword(body: string): boolean {
  return STOP_WORDS.has(String(body || "").trim().toLowerCase());
}
