// LeadBoosters support assistant: Claude answers questions about what is going on in the
// signed-in user's account (campaigns, follow-ups, Autopilot, replies, settings) using
// read-only tools over their own data, and links to the right page in the app.
// It never sends, pauses or changes anything; it tells the user where to do that.
import Anthropic from "npm:@anthropic-ai/sdk";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { overview } from "../_shared/support-overview.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const MODEL = "claude-opus-5-5";
const MAX_TOOL_ROUNDS = 8;
const MAX_TURNS_KEPT = 20;

const json = (o: unknown, status = 200) =>
  new Response(JSON.stringify(o), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

// Read-only actions of the existing api-campaigns API the assistant may call.
const READ_ACTIONS = [
  "list", "get_campaign", "list_sequences", "get_sequence", "sequence_health", "list_enrollments",
  "get_autopilot", "list_discovery_runs", "list_discovered_leads", "list_personas",
  "list_notifications", "list_newsletters", "list_subscribers", "list_sms_conversations", "get_sms_conversation",
  "list_groups", "get_group", "list_senders", "get_business_profile",
  "search_companies", "get_company", "search_contacts", "get_contact", "list_deals",
  "list_automations", "list_automation_runs",
] as const;

const SYSTEM = `You are the LeadBoosters support assistant, built into the LeadBoosters CRM web app (www.leadboosters.co.uk). The person chatting is a signed-in user asking about their own account. Your job: explain clearly what is going on (campaigns, follow-ups, Autopilot, replies, newsletters, settings) and point them to the exact page to see or change it.

How to work:
- Look things up with your tools before answering anything about their account. Start with get_overview for broad questions like "what's going on" or "what campaigns are running".
- Your tools only read data. You cannot send, schedule, pause, delete or edit anything. When the user wants a change, tell them exactly where to make it, with a link, and what to click.
- Every answer about something in the app ends with one or more links to the right page, written as markdown links with the app path, e.g. [Open the campaign](/campaigns?open=<campaign id>).
- Write plainly for a busy business owner: lead with the answer, short sentences, numbers in a short list or table, no jargon or internal IDs in the prose (put IDs only inside links). Times are UK time (Europe/London).
- Be honest about what the data shows. If something looks wrong (a campaign stuck sending, follow-ups paused, a high bounce rate, a draft never sent), say so and say what to check.
- Don't invent figures, features or pages. If you can't find something, say so.

Pages you can link to (paths only, no domain):
- / : Dashboard
- /campaigns : all email and SMS campaigns. /campaigns?open=<campaign id> opens one campaign. Tabs: ?tab=overview, ?tab=drafts, ?tab=delivery (deliverability), ?tab=health, ?tab=automation, ?tab=testing (A/B tests)
- /all-campaigns : active campaigns across email, SMS and sequences in one list (bulk pause, resume, stop)
- /campaigns/import-email : personalised per-recipient emails
- /ai-create : write a campaign with AI
- /sequences : follow-up sequences (the Day 1/3/5 follow-ups after a campaign), their steps and who is enrolled
- /company-sequences : companies currently in a sequence and the step they're on
- /conversations : replies to campaigns and follow-ups. /conversations?tab=personal for personal email, /conversations?tab=texts for SMS replies
- /auto-responses : AI auto-replies to inbound email
- /newsletters : newsletters and subscribers. /newsletters?edit=<newsletter id> opens one
- /newsletter-series : automatic newsletter series
- /recipient-groups : saved recipient lists
- /email-branding : sender profiles (who an email is "from", logo, signature)
- /autopilot : Autopilot (daily lead finding and outreach): overview, history, settings, personas, analytics
- /lead-inbox : leads found by Autopilot to approve or reject. ?tab=pending, ?tab=auto_approved, ?tab=approved, ?tab=rejected
- /lead-finder : search for new leads by hand
- /enrichment : company enrichment
- /hospitality-leads : hospitality lead lists
- /companies, /people, /deals, /pipeline : the CRM
- /notes, /events, /files, /invoices : records
- /teams, /shared-inbox : team features
- /integrations/email-providers : sending accounts (Resend, Gmail, SMTP, SendGrid)
- /email-deliverability : bounces, spam complaints, domain health
- /business-profile : business details the AI writes from
- /api-keys, /connect-ai : API keys and the Claude / ChatGPT connection
- /subscription : plan and billing
- /profile : the user's own profile

Words the user may use: "follow-ups" are sequences enrolled after a campaign sends; a "persona" is an Autopilot target customer; "Lead Inbox" holds Autopilot's finds; a "sender profile" is the From name, address, logo and signature.`;

const TOOLS: Anthropic.Tool[] = [
  {
    name: "get_overview",
    description: "Snapshot of everything going on in the account right now: campaigns sending, scheduled, drafts and recently sent (with sent, opened, clicked, replied and bounced counts), follow-ups running per campaign, Autopilot status and next run, leads waiting for review, recent replies, newsletters and bounces. Use first for broad questions.",
    input_schema: {
      type: "object",
      properties: { days: { type: "integer", description: "How many days back to include for recently sent campaigns (default 14, max 60)." } },
      additionalProperties: false,
    },
  },
  {
    name: "crm_read",
    description: `Read data from the account with one read-only action. Actions and their main args:
- list: latest 50 campaigns (id, name, status, counts)
- get_campaign {campaign_id}: one campaign with recipient counts by status
- list_sequences / get_sequence {sequence_id}: follow-up sequences and their steps
- sequence_health: whether follow-ups are running and anything stuck
- list_enrollments {sequence_id?, status?}: who is in follow-ups
- get_autopilot, list_discovery_runs, list_discovered_leads {status?}, list_personas: Autopilot
- list_notifications, list_newsletters, list_subscribers, list_sms_conversations, get_sms_conversation {conversation_id}
- list_groups, get_group {group_id}, list_senders, get_business_profile
- search_companies {query}, get_company {company_id}, search_contacts {query}, get_contact {contact_id}, list_deals
- list_automations, list_automation_runs`,
    input_schema: {
      type: "object",
      properties: {
        action: { type: "string", enum: [...READ_ACTIONS] },
        args: { type: "object", description: "Arguments for the action, e.g. {\"campaign_id\": \"...\"}", additionalProperties: true },
      },
      required: ["action"],
      additionalProperties: false,
    },
  },
];

const cap = (v: unknown, n = 14000) => {
  const s = typeof v === "string" ? v : JSON.stringify(v);
  return s.length > n ? s.slice(0, n) + "…(truncated)" : s;
};

async function crmRead(authHeader: string, action: string, args: Record<string, unknown>) {
  if (!(READ_ACTIONS as readonly string[]).includes(action)) return { error: `Not a read action: ${action}` };
  const r = await fetch(`${SUPABASE_URL}/functions/v1/api-campaigns`, {
    method: "POST",
    headers: { Authorization: authHeader, apikey: ANON_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ ...(args || {}), action }),
  });
  const body = await r.json().catch(() => ({ error: `HTTP ${r.status}` }));
  return r.ok ? body : { error: body?.error || `HTTP ${r.status}` };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization") || "";
    const anon = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } } });
    const { data: { user } } = await anon.auth.getUser();
    if (!user) return json({ error: "Please sign in again." }, 401);
    if (!(Deno.env.get("ANTHROPIC_API_KEY") || "").trim()) {
      return json({ error: "The assistant isn't switched on yet: the Claude API key hasn't been added on the server." }, 503);
    }
    const db = createClient(SUPABASE_URL, SERVICE_KEY);

    const body = await req.json().catch(() => ({}));
    // Conversation from the browser: plain text turns only, newest last.
    const history = (Array.isArray(body.messages) ? body.messages : [])
      .filter((m: any) => (m?.role === "user" || m?.role === "assistant") && typeof m?.content === "string" && m.content.trim())
      .slice(-MAX_TURNS_KEPT)
      .map((m: any) => ({ role: m.role, content: String(m.content).slice(0, 8000) })) as Anthropic.MessageParam[];
    while (history.length && history[0].role !== "user") history.shift();
    if (!history.length || history[history.length - 1].role !== "user") return json({ error: "Ask a question first." }, 400);

    const page = typeof body.page === "string" ? body.page.slice(0, 200) : "";
    const messages: Anthropic.MessageParam[] = [...history];
    if (page) messages.push({ role: "system" as any, content: `The user is currently on the page ${page}.` } as any);

    const client = new Anthropic({ apiKey: Deno.env.get("ANTHROPIC_API_KEY")!.trim() });
    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const response: any = await (client.beta.messages.create as any)({
        model: MODEL,
        max_tokens: 16000,
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
        tools: TOOLS,
        output_config: { effort: "low" },
        messages,
      });

      if (response.stop_reason === "refusal") {
        return json({ reply: "I can't help with that one. Ask me about your campaigns, follow-ups, Autopilot or settings." });
      }
      if (response.stop_reason !== "tool_use") {
        const text = (response.content || []).filter((b: any) => b.type === "text").map((b: any) => b.text).join("\n").trim();
        return json({ reply: text || "I couldn't find an answer to that. Try asking another way." });
      }

      messages.push({ role: "assistant", content: response.content });
      const results: Anthropic.ToolResultBlockParam[] = [];
      for (const block of response.content as any[]) {
        if (block.type !== "tool_use") continue;
        let out: unknown;
        try {
          const input = (block.input || {}) as Record<string, any>;
          if (block.name === "get_overview") out = await overview(db, user.id, input.days);
          else if (block.name === "crm_read" && typeof input.action === "string") out = await crmRead(authHeader, input.action, (input.args && typeof input.args === "object") ? input.args : {});
          else out = { error: "Unknown tool or missing action" };
          results.push({ type: "tool_result", tool_use_id: block.id, content: cap(out) });
        } catch (e) {
          results.push({ type: "tool_result", tool_use_id: block.id, content: `Error: ${(e as Error).message}`, is_error: true });
        }
      }
      messages.push({ role: "user", content: results });
    }
    return json({ reply: "That needed more lookups than I can do in one go. Try a narrower question, like one campaign by name." });
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) return json({ error: "The assistant is busy right now. Try again in a minute." }, 429);
    if (e instanceof Anthropic.AuthenticationError) return json({ error: "The assistant's Claude API key isn't valid." }, 503);
    if (e instanceof Anthropic.APIError) return json({ error: `The assistant had a problem (${e.status}). Try again.` }, 502);
    console.error("[support-assistant]", e);
    return json({ error: "Something went wrong. Try again." }, 500);
  }
});
