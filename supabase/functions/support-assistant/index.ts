// LeadBoosters support assistant: Claude answers questions about what is going on in the
// signed-in user's account (campaigns, follow-ups, Autopilot, replies, settings) using
// read-only tools over their own data, and links to the right page in the app.
// It never sends, pauses or changes anything; it tells the user where to do that.
import Anthropic from "npm:@anthropic-ai/sdk";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

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

async function count(q: any): Promise<number> {
  const { count: c } = await q;
  return c || 0;
}

async function overview(db: any, userId: string, daysIn?: number) {
  const days = Math.max(1, Math.min(60, Number(daysIn) || 14));
  const since = new Date(Date.now() - days * 86_400_000).toISOString();
  const { data: camps } = await db.from("email_campaigns")
    .select("id, name, status, total_recipients, sent_count, scheduled_at, started_at, completed_at, created_at, auto_follow_up_enabled, sender_profile:sender_profiles(name, sender_email)")
    .eq("user_id", userId)
    .or(`status.in.(sending,scheduled,paused),and(status.eq.draft,total_recipients.gt.0),and(status.eq.completed,completed_at.gte.${since})`)
    .order("created_at", { ascending: false }).limit(40);
  const campaigns = [];
  for (const c of camps || []) {
    const r = db.from("email_campaign_recipients");
    const [sent, opened, clicked, replied, bounced, pending, failed] = await Promise.all([
      count(r.select("id", { count: "exact", head: true }).eq("campaign_id", c.id).not("external_message_id", "is", null)),
      count(db.from("email_campaign_recipients").select("id", { count: "exact", head: true }).eq("campaign_id", c.id).in("status", ["opened", "clicked", "replied"])),
      count(db.from("email_campaign_recipients").select("id", { count: "exact", head: true }).eq("campaign_id", c.id).eq("status", "clicked")),
      count(db.from("email_campaign_recipients").select("id", { count: "exact", head: true }).eq("campaign_id", c.id).eq("status", "replied")),
      count(db.from("email_campaign_recipients").select("id", { count: "exact", head: true }).eq("campaign_id", c.id).eq("status", "bounced")),
      count(db.from("email_campaign_recipients").select("id", { count: "exact", head: true }).eq("campaign_id", c.id).eq("status", "pending")),
      count(db.from("email_campaign_recipients").select("id", { count: "exact", head: true }).eq("campaign_id", c.id).eq("status", "failed")),
    ]);
    const [fuActive, fuPaused, fuDone] = await Promise.all([
      count(db.from("company_sequences").select("id", { count: "exact", head: true }).eq("campaign_id", c.id).eq("status", "active")),
      count(db.from("company_sequences").select("id", { count: "exact", head: true }).eq("campaign_id", c.id).eq("status", "paused")),
      count(db.from("company_sequences").select("id", { count: "exact", head: true }).eq("campaign_id", c.id).eq("status", "completed")),
    ]);
    campaigns.push({
      id: c.id, name: c.name, status: c.status, recipients: c.total_recipients,
      created: c.created_at, scheduled_for: c.scheduled_at, finished: c.completed_at,
      sends_as: (c as any).sender_profile ? `${(c as any).sender_profile.name} <${(c as any).sender_profile.sender_email || "default"}>` : "default business profile",
      delivered_to_provider: sent, opened, clicked, replied, bounced, waiting_to_send: pending, failed,
      follow_ups: c.auto_follow_up_enabled ? { running: fuActive, paused: fuPaused, finished: fuDone } : "off",
      link: `/campaigns?open=${c.id}`,
    });
  }
  const { data: ap } = await db.from("autonomous_discovery_settings")
    .select("enabled, discovery_frequency, daily_lead_target, full_auto_mode, next_run_at, last_run_at").eq("user_id", userId).maybeSingle();
  const { data: personas } = await db.from("discovery_personas").select("name, is_active").eq("user_id", userId);
  const monthStart = new Date(); monthStart.setUTCDate(1); monthStart.setUTCHours(0, 0, 0, 0);
  const [pendingLeads, leadsThisMonth, unreadNotes, repliesWeek, bouncesWeek] = await Promise.all([
    count(db.from("autonomous_leads").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("status", "pending")),
    count(db.from("autonomous_leads").select("id", { count: "exact", head: true }).eq("user_id", userId).gte("created_at", monthStart.toISOString()).neq("source", "curated")),
    count(db.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", userId).is("read_at", null)),
    count(db.from("email_campaign_recipients").select("id, email_campaigns!inner(user_id)", { count: "exact", head: true }).eq("email_campaigns.user_id", userId).eq("status", "replied").gte("updated_at", new Date(Date.now() - 7 * 86_400_000).toISOString())),
    count(db.from("email_bounce_events").select("id", { count: "exact", head: true }).eq("user_id", userId).gte("occurred_at", new Date(Date.now() - 7 * 86_400_000).toISOString())),
  ]);
  const { data: newsletters } = await db.from("newsletters").select("id, title, status, scheduled_at, sent_at")
    .eq("user_id", userId).in("status", ["scheduled", "sending"]).limit(10);
  const { data: series } = await db.from("newsletter_series").select("name, status, start_date, duration_days, send_time").eq("user_id", userId);
  return {
    now_uk: new Date().toLocaleString("en-GB", { timeZone: "Europe/London" }),
    campaigns,
    autopilot: ap ? { ...ap, personas_active: (personas || []).filter((p: any) => p.is_active).map((p: any) => p.name), new_leads_this_month: leadsThisMonth, leads_waiting_for_review: pendingLeads, link: "/autopilot" } : { enabled: false, link: "/autopilot" },
    lead_inbox: { waiting_for_review: pendingLeads, link: "/lead-inbox?tab=pending" },
    replies_last_7_days: { count: repliesWeek, link: "/conversations" },
    bounces_last_7_days: { count: bouncesWeek, link: "/email-deliverability" },
    unread_notifications: unreadNotes,
    newsletters_scheduled_or_sending: (newsletters || []).map((n: any) => ({ ...n, link: `/newsletters?edit=${n.id}` })),
    newsletter_series: series || [],
  };
}

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
