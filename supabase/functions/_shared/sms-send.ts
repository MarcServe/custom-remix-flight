// Shared SMS helpers: provider send (Twilio / Vonage / Plivo / MessageBird),
// number normalisation, opt-out keywords and the sms_messages log that powers
// two-way texting in Conversations. Used by send-bulk-sms, sms-inbound,
// send-sms-reply and the public API.

export type SmsResult = { success: boolean; messageId?: string; status?: string; error?: string };
export const PHONE_PROVIDERS = ["twilio", "vonage", "messagebird", "plivo"];

function b64(str: string): string {
  if (typeof btoa !== "undefined") return btoa(str);
  return btoa(String.fromCharCode(...new TextEncoder().encode(str)));
}

export const digitsOf = (p: unknown): string => String(p ?? "").replace(/\D/g, "");

/** Best-effort E.164. Bare national numbers get `defaultCc` (digits, e.g. "44"). */
export function normalizePhone(raw: unknown, defaultCc = "44"): string | null {
  let p = String(raw ?? "").trim();
  if (!p) return null;
  if (p.toLowerCase().startsWith("phone:")) p = p.slice(6).trim();
  const hasPlus = p.startsWith("+");
  const d = p.replace(/\D/g, "");
  if (d.length < 7) return null;
  if (hasPlus) return `+${d}`;
  if (d.startsWith("00")) return `+${d.slice(2)}`;
  if (d.startsWith("0")) return defaultCc ? `+${defaultCc}${d.replace(/^0+/, "")}` : null;
  if (defaultCc && d.startsWith(defaultCc) && d.length >= 11) return `+${d}`;
  return defaultCc ? `+${defaultCc}${d}` : `+${d}`;
}

export const OPT_OUT_WORDS = new Set(["STOP", "STOPALL", "UNSUBSCRIBE", "CANCEL", "END", "QUIT", "OPTOUT", "OPT OUT", "REMOVE"]);
export const OPT_IN_WORDS = new Set(["START", "UNSTOP", "YES", "SUBSCRIBE", "OPTIN", "OPT IN"]);
export const isOptOut = (body: string) => OPT_OUT_WORDS.has(body.trim().toUpperCase().replace(/[.!]+$/, ""));
export const isOptIn = (body: string) => OPT_IN_WORDS.has(body.trim().toUpperCase().replace(/[.!]+$/, ""));

export function senderNumberOf(provider: string, metadata: Record<string, any>): string | null {
  return metadata?.phone_number || metadata?.from_number || metadata?.originator || null;
}

export async function sendOneSms(provider: string, metadata: Record<string, any>, phoneNumber: string, message: string): Promise<SmsResult> {
  switch (provider) {
    case "twilio": {
      const accountSid = metadata.account_sid, authToken = metadata.auth_token, fromNumber = metadata.phone_number;
      if (!accountSid || !authToken || !fromNumber) return { success: false, error: "Twilio credentials not configured" };
      const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
        method: "POST",
        headers: { Authorization: `Basic ${b64(`${accountSid}:${authToken}`)}`, "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ From: fromNumber, To: phoneNumber, Body: message }),
      });
      if (!r.ok) {
        const t = await r.text();
        let msg = "Twilio API error";
        try { const j = JSON.parse(t); if (j.message) msg = j.message; if (j.code) msg = `Twilio Error ${j.code}: ${msg}`; } catch { msg = t || msg; }
        return { success: false, error: msg };
      }
      const d = await r.json();
      return { success: true, messageId: d.sid, status: d.status };
    }
    case "vonage": {
      const { api_key, api_secret, from_number } = metadata;
      if (!api_key || !api_secret || !from_number) return { success: false, error: "Vonage credentials not configured" };
      const r = await fetch("https://rest.nexmo.com/sms/json", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ api_key, api_secret, from: from_number, to: phoneNumber, text: message }) });
      if (!r.ok) return { success: false, error: `Vonage error: ${await r.text()}` };
      const d = await r.json();
      if (d.messages?.[0]?.status !== "0") return { success: false, error: `Vonage error: ${d.messages?.[0]?.["error-text"] || "Unknown error"}` };
      return { success: true, messageId: d.messages?.[0]?.["message-id"], status: "sent" };
    }
    case "plivo": {
      const { auth_id, auth_token, phone_number } = metadata;
      if (!auth_id || !auth_token || !phone_number) return { success: false, error: "Plivo credentials not configured" };
      const r = await fetch(`https://api.plivo.com/v1/Account/${auth_id}/Message/`, { method: "POST", headers: { Authorization: `Basic ${b64(`${auth_id}:${auth_token}`)}`, "Content-Type": "application/json" }, body: JSON.stringify({ src: phone_number, dst: phoneNumber, text: message }) });
      if (!r.ok) return { success: false, error: `Plivo error: ${await r.text()}` };
      const d = await r.json();
      return { success: true, messageId: d.message_uuid?.[0], status: "sent" };
    }
    case "messagebird": {
      const { access_key, originator } = metadata;
      if (!access_key || !originator) return { success: false, error: "MessageBird credentials not configured" };
      const r = await fetch("https://rest.messagebird.com/messages", { method: "POST", headers: { Authorization: `AccessKey ${access_key}`, "Content-Type": "application/json" }, body: JSON.stringify({ originator, recipients: [phoneNumber], body: message }) });
      if (!r.ok) return { success: false, error: `MessageBird error: ${await r.text()}` };
      const d = await r.json();
      return { success: true, messageId: d.id, status: d.status };
    }
    default:
      return { success: false, error: `Unsupported provider: ${provider}` };
  }
}

/** The user's active phone service (optionally a specific one). */
export async function activePhoneConnection(db: any, userId: string, connectionId?: string | null) {
  let q = db.from("crm_connections").select("id, provider, metadata, status").eq("user_id", userId).in("provider", PHONE_PROVIDERS);
  q = connectionId ? q.eq("id", connectionId) : q.eq("status", "active");
  const { data } = await q.order("created_at", { ascending: false }).limit(1).maybeSingle();
  return data || null;
}

export async function isOptedOut(db: any, userId: string, phone: string): Promise<boolean> {
  const { data } = await db.from("sms_opt_outs").select("id").eq("user_id", userId).eq("phone", phone).maybeSingle();
  return !!data;
}

/** Find a display name for a number from the CRM (people → companies → group members). */
export async function nameForNumber(db: any, userId: string, phone: string): Promise<{ name: string | null; personId: string | null }> {
  const d = digitsOf(phone);
  const tails = [phone, d, d.slice(-10), `0${d.slice(-10)}`];
  const { data: ppl } = await db.from("people").select("id, first_name, last_name, phone").eq("user_id", userId).not("phone", "is", null).limit(5000);
  for (const p of ppl || []) if (digitsOf(p.phone).endsWith(d.slice(-9))) return { name: [p.first_name, p.last_name].filter(Boolean).join(" ") || null, personId: p.id };
  const { data: cos } = await db.from("companies").select("id, name, company_phone").eq("user_id", userId).not("company_phone", "is", null).limit(5000);
  for (const c of cos || []) if (digitsOf(c.company_phone).endsWith(d.slice(-9))) return { name: c.name, personId: null };
  const { data: groups } = await db.from("recipient_groups").select("id").eq("user_id", userId);
  const gids = (groups || []).map((g: any) => g.id);
  if (gids.length) {
    const { data: m } = await db.from("recipient_group_members").select("first_name, last_name, company, phone").in("group_id", gids).in("phone", tails).limit(1).maybeSingle();
    if (m) return { name: [m.first_name, m.last_name].filter(Boolean).join(" ") || m.company || null, personId: null };
  }
  // Last resort: the name used on the most recent campaign text to this number
  const { data: camps } = await db.from("email_campaigns").select("id").eq("user_id", userId).contains("tags", ["phone_sms"]).order("created_at", { ascending: false }).limit(50);
  const cids = (camps || []).map((c: any) => c.id);
  if (cids.length) {
    const { data: r } = await db.from("email_campaign_recipients").select("name").in("campaign_id", cids).eq("email", `phone:${phone}`).order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (r?.name && !["Contact", "Manual Entry", "Group member"].includes(r.name)) return { name: r.name, personId: null };
  }
  return { name: null, personId: null };
}

export interface SmsLogRow {
  user_id: string; connection_id?: string | null; direction: "inbound" | "outbound"; counterparty: string;
  from_number: string; to_number: string; body: string; status: string; provider?: string | null; provider_sid?: string | null;
  campaign_id?: string | null; campaign_recipient_id?: string | null; person_id?: string | null; contact_name?: string | null;
  error_message?: string | null; metadata?: Record<string, unknown> | null; read_at?: string | null;
}

export async function logSms(db: any, row: SmsLogRow) {
  const { data, error } = await db.from("sms_messages").insert(row).select("id").maybeSingle();
  if (error && !String(error.message || "").includes("duplicate")) console.error("[sms log]", error.message);
  return data?.id ?? null;
}
