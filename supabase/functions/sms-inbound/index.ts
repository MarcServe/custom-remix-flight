// Twilio inbound SMS webhook. Twilio POSTs application/x-www-form-urlencoded
// (From, To, Body, MessageSid, AccountSid, ...). We find the LeadBoosters user
// whose Twilio number received it, verify Twilio's signature with that user's
// auth token, store the text, mark the campaign recipient as replied, honour
// STOP / START, and answer with TwiML.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { digitsOf, normalizePhone, isOptOut, isOptIn, nameForNumber, logSms } from "../_shared/sms-send.ts";

const PUBLIC_URL = Deno.env.get("SMS_WEBHOOK_URL") || "https://kgndpwzqohepotahnfeo.supabase.co/functions/v1/sms-inbound";

const twiml = (message?: string) =>
  new Response(`<?xml version="1.0" encoding="UTF-8"?><Response>${message ? `<Message>${escapeXml(message)}</Message>` : ""}</Response>`, {
    status: 200, headers: { "Content-Type": "text/xml" },
  });
const escapeXml = (s: string) => s.replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" }[c] as string));

async function twilioSignature(authToken: string, url: string, params: Record<string, string>): Promise<string> {
  const data = url + Object.keys(params).sort().map((k) => k + params[k]).join("");
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(authToken), { name: "HMAC", hash: "SHA-1" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  return btoa(String.fromCharCode(...new Uint8Array(sig)));
}

Deno.serve(async (req) => {
  if (req.method === "GET") return new Response(JSON.stringify({ ok: true, service: "sms-inbound" }), { headers: { "Content-Type": "application/json" } });
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const raw = await req.text();
  const params: Record<string, string> = {};
  for (const [k, v] of new URLSearchParams(raw)) params[k] = v;
  const from = normalizePhone(params.From, "") || params.From;
  const to = normalizePhone(params.To, "") || params.To;
  const body = String(params.Body || "").trim();
  const sid = params.MessageSid || params.SmsSid || null;
  if (!from || !to) return new Response("Bad request", { status: 400 });

  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  // Whose number is this? Match on the receiving number (and account when given).
  const { data: conns } = await db.from("crm_connections").select("id, user_id, provider, metadata, status").eq("provider", "twilio").limit(500);
  const toDigits = digitsOf(to);
  const candidates = (conns || []).filter((c: any) => {
    const n = digitsOf(c.metadata?.phone_number);
    const numMatch = n && (n === toDigits || n.endsWith(toDigits.slice(-10)));
    const acctMatch = !params.AccountSid || !c.metadata?.account_sid || c.metadata.account_sid === params.AccountSid;
    return numMatch && acctMatch;
  });
  if (!candidates.length) {
    console.warn("[sms-inbound] no connection for", to);
    return twiml(); // 200 so Twilio doesn't retry forever
  }

  // Verify Twilio's signature against each candidate's auth token (URL as Twilio called it).
  const signature = req.headers.get("x-twilio-signature") || "";
  const urls = Array.from(new Set([PUBLIC_URL, req.url, req.url.replace(/^http:/, "https:")]));
  let conn: any = null;
  for (const c of candidates) {
    const token = c.metadata?.auth_token;
    if (!token) continue;
    for (const u of urls) {
      if ((await twilioSignature(token, u, params)) === signature) { conn = c; break; }
    }
    if (conn) break;
  }
  if (!conn) {
    console.warn("[sms-inbound] signature mismatch for", to);
    return new Response("Forbidden", { status: 403 });
  }

  const userId = conn.user_id as string;
  const { name, personId } = await nameForNumber(db, userId, from);

  // Which campaign text is this answering? Most recent one sent to this number.
  const { data: camps } = await db.from("email_campaigns").select("id").eq("user_id", userId).contains("tags", ["phone_sms"]).order("created_at", { ascending: false }).limit(100);
  const cids = (camps || []).map((c: any) => c.id);
  let recipient: any = null;
  if (cids.length) {
    const { data } = await db.from("email_campaign_recipients").select("id, campaign_id, status").in("campaign_id", cids).eq("email", `phone:${from}`).order("created_at", { ascending: false }).limit(1).maybeSingle();
    recipient = data;
  }

  const optOut = isOptOut(body);
  const optIn = isOptIn(body);
  await logSms(db, {
    user_id: userId, connection_id: conn.id, direction: "inbound", counterparty: from, from_number: from, to_number: to,
    body, status: "received", provider: "twilio", provider_sid: sid,
    campaign_id: recipient?.campaign_id || null, campaign_recipient_id: recipient?.id || null, person_id: personId, contact_name: name,
    metadata: { num_media: Number(params.NumMedia || 0) || 0, ...(optOut ? { opt_out: true } : {}), ...(optIn ? { opt_in: true } : {}) },
  });

  if (recipient && recipient.status === "sent") {
    await db.from("email_campaign_recipients").update({ status: "replied" }).eq("id", recipient.id);
  }

  if (optOut) {
    await db.from("sms_opt_outs").upsert({ user_id: userId, phone: from, reason: `Replied "${body}"` }, { onConflict: "user_id,phone" });
    const { data: bp } = await db.from("business_profiles").select("company_name").eq("user_id", userId).maybeSingle();
    const reply = `You've been unsubscribed from ${bp?.company_name || "our"} texts and won't hear from us again. Reply START to opt back in.`;
    await logSms(db, { user_id: userId, connection_id: conn.id, direction: "outbound", counterparty: from, from_number: to, to_number: from, body: reply, status: "sent", provider: "twilio", metadata: { auto_reply: "opt_out" }, read_at: new Date().toISOString() });
    return twiml(reply);
  }
  if (optIn) {
    await db.from("sms_opt_outs").delete().eq("user_id", userId).eq("phone", from);
    const reply = "You're subscribed again. Reply STOP at any time to opt out.";
    await logSms(db, { user_id: userId, connection_id: conn.id, direction: "outbound", counterparty: from, from_number: to, to_number: from, body: reply, status: "sent", provider: "twilio", metadata: { auto_reply: "opt_in" }, read_at: new Date().toISOString() });
    return twiml(reply);
  }
  return twiml();
});
