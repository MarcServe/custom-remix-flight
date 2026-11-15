// Send a text from Conversations (signed-in user). Body: { to, message, connection_id? }.
// Refuses numbers that have opted out, logs the message to sms_messages and
// marks the thread as read.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { normalizePhone, activePhoneConnection, isOptedOut, sendOneSms, senderNumberOf, logSms, nameForNumber } from "../_shared/sms-send.ts";

const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization") || "";
    const anon = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: authErr } = await anon.auth.getUser();
    if (authErr || !user) return json({ success: false, error: "Unauthorized" }, 401);
    const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const body = await req.json().catch(() => ({}));
    const to = normalizePhone(body.to);

    // AI draft: suggest a reply from the thread + business profile (nothing is sent).
    if (body.draft === true) {
      if (!to) return json({ success: false, error: "A valid phone number is required" }, 400);
      const apiKey = (Deno.env.get("OPENAI_API_KEY") || "").trim();
      if (!apiKey) return json({ success: false, error: "AI drafting is not configured (OPENAI_API_KEY missing)." }, 400);
      const [{ data: bp }, { data: msgs }] = await Promise.all([
        db.from("business_profiles").select("company_name, services_description, value_proposition, tone_preference, email_sender_name, phone, website, knowledge_base").eq("user_id", user.id).maybeSingle(),
        db.from("sms_messages").select("direction, body, created_at, contact_name").eq("user_id", user.id).eq("counterparty", to).order("created_at", { ascending: false }).limit(12),
      ]);
      const thread = (msgs || []).reverse();
      const name = thread.find((m: any) => m.contact_name)?.contact_name || "";
      const transcript = thread.map((m: any) => `${m.direction === "inbound" ? "Customer" : "Us"}: ${m.body}`).join("\n");
      const sys = `You write short SMS replies for ${bp?.company_name || "a small business"}${bp?.email_sender_name ? ` (sent by ${bp.email_sender_name})` : ""}. ` +
        `What we do: ${bp?.services_description || bp?.value_proposition || "see conversation"}. Tone: ${bp?.tone_preference || "friendly, professional"}. ` +
        (bp?.knowledge_base ? `Business facts: ${String(bp.knowledge_base).slice(0, 3000)} ` : "") +
        `Rules: one SMS where possible (under 160 characters, never over 300), plain text, no emojis unless the customer used them, no links unless we already shared one, ` +
        `answer their actual question, propose one clear next step (e.g. a quick call or a link), sign off with the sender's first name if known. Output only the message text.`;
      const userMsg = `Conversation with ${name || to}:\n${transcript || "(no messages yet)"}\n\n${body.instruction ? `Guidance from me: ${String(body.instruction).slice(0, 500)}` : "Write the next reply from us."}`;
      const r = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST", headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: "gpt-4o-mini", temperature: 0.5, max_tokens: 200, messages: [{ role: "system", content: sys }, { role: "user", content: userMsg }] }),
      });
      if (!r.ok) return json({ success: false, error: `AI error: ${(await r.text()).slice(0, 200)}` }, 502);
      const d = await r.json();
      const draft = String(d.choices?.[0]?.message?.content || "").trim().replace(/^["']|["']$/g, "");
      return json({ success: true, draft });
    }
    const message = String(body.message || "").trim();
    if (!to) return json({ success: false, error: "A valid phone number is required" }, 400);
    if (!message) return json({ success: false, error: "Message is required" }, 400);
    if (message.length > 1600) return json({ success: false, error: "Message is too long (max 1600 characters)" }, 400);

    const conn = await activePhoneConnection(db, user.id, body.connection_id || null);
    if (!conn) return json({ success: false, error: "No active phone service. Connect Twilio in Settings → Integrations." }, 400);
    if (await isOptedOut(db, user.id, to)) return json({ success: false, error: "This number has opted out (replied STOP). You can't text them unless they reply START." }, 400);

    const fromNumber = senderNumberOf(conn.provider, conn.metadata || {}) || "";
    const result = await sendOneSms(conn.provider, conn.metadata || {}, to, message);
    const { name, personId } = await nameForNumber(db, user.id, to);
    const now = new Date().toISOString();
    const id = await logSms(db, {
      user_id: user.id, connection_id: conn.id, direction: "outbound", counterparty: to, from_number: fromNumber, to_number: to,
      body: message, status: result.success ? "sent" : "failed", provider: conn.provider, provider_sid: result.messageId || null,
      person_id: personId, contact_name: name, error_message: result.success ? null : result.error || "Send failed", read_at: now,
    });
    if (result.success) {
      await db.from("sms_messages").update({ read_at: now }).eq("user_id", user.id).eq("counterparty", to).eq("direction", "inbound").is("read_at", null);
    }
    return json({ success: result.success, id, error: result.success ? undefined : result.error, provider_sid: result.messageId }, result.success ? 200 : 502);
  } catch (e) {
    return json({ success: false, error: (e as Error)?.message || "Failed" }, 500);
  }
});
