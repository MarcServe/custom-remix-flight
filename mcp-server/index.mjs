#!/usr/bin/env node
/**
 * LeadBoosters MCP server — lets Claude (Claude Code, Claude Desktop, Codex,
 * Cursor…) work your LeadBoosters CRM directly: contacts, companies, recipient
 * groups, email + SMS campaigns, newsletters, subscribers and deals.
 *
 * Env:
 *   LEADBOOSTERS_API_KEY   (required)  your lb_live_... key from Settings → API Keys
 *   LEADBOOSTERS_API_URL   (optional)  defaults to the hosted endpoint
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const API_URL = process.env.LEADBOOSTERS_API_URL ||
  "https://kgndpwzqohepotahnfeo.supabase.co/functions/v1/api-campaigns";
const API_KEY = process.env.LEADBOOSTERS_API_KEY;
if (!API_KEY) {
  console.error("[leadboosters-mcp] LEADBOOSTERS_API_KEY env var is required.");
  process.exit(1);
}

async function callApi(payload) {
  const res = await fetch(API_URL, {
    method: "POST",
    headers: { "x-api-key": API_KEY, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }
  if (!res.ok) throw new Error(data?.error || data?.message || `API error ${res.status}`);
  return data;
}

const server = new McpServer({ name: "leadboosters", version: "1.1.0" });

// Register a tool whose arguments map 1:1 onto an API action.
function tool(name, description, shape, action = name) {
  server.tool(name, description, shape, async (args) => {
    try {
      const data = await callApi({ action, ...(args || {}) });
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    } catch (e) {
      return { isError: true, content: [{ type: "text", text: `LeadBoosters error: ${e?.message || e}` }] };
    }
  });
}

const recipient = z.object({
  email: z.string().optional(),
  phone: z.string().optional().describe("E.164 preferred (+447…); UK numbers starting 0 are converted."),
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  name: z.string().optional().describe("Full name or business name (used when first/last not given)."),
  company: z.string().optional(),
});

const scheduleAt = z.string().optional().describe("UK (London) wall-clock 'YYYY-MM-DDTHH:mm', or a full ISO timestamp. Omit for a draft.");

// ───────────── Profile & senders ─────────────
tool("get_business_profile",
  "Read the business profile: company name, industry, services, audience, value proposition, tone, brand colour, logo/footer URLs, email signature and sender name. Read this before writing any email or newsletter so the copy and HTML are on-brand.",
  {});
tool("list_senders",
  "List connected email senders (Gmail/Resend/SendGrid: from address, status) and phone/SMS services (Twilio etc.). Tells you whether sends and SMS campaigns can actually go out.",
  {});

// ───────────── Contacts & companies ─────────────
tool("search_contacts",
  "Search CRM contacts (people) by name, email or job title; optionally filter by tag or company name. Returns id, name, email, phone, title, company, tags.",
  { query: z.string().optional(), tag: z.string().optional(), company: z.string().optional(), limit: z.number().int().min(1).max(500).optional() });
tool("get_contact", "Fetch one contact with their company, by contact_id or email.",
  { contact_id: z.string().optional(), email: z.string().optional() });
tool("upsert_contact",
  "Create a contact, or update the one with this email. Company is matched by name (created if new). Use add_tags to append tags without replacing existing ones.",
  {
    email: z.string(), first_name: z.string().optional(), last_name: z.string().optional(), phone: z.string().optional(),
    title: z.string().optional(), company: z.string().optional(), location: z.string().optional(), linkedin_url: z.string().optional(),
    bio: z.string().optional(), tags: z.array(z.string()).optional().describe("Replace tags."), add_tags: z.array(z.string()).optional().describe("Append tags."),
  });
tool("update_contact", "Update fields on an existing contact by contact_id.",
  {
    contact_id: z.string(), email: z.string().optional(), first_name: z.string().optional(), last_name: z.string().optional(), phone: z.string().optional(),
    title: z.string().optional(), company: z.string().optional(), location: z.string().optional(), linkedin_url: z.string().optional(), bio: z.string().optional(), tags: z.array(z.string()).optional(),
  });
tool("search_companies", "Search companies by name, website, industry or general email; optional status filter (NEW, QUALIFIED, CONTACTED, MEETING, PROPOSAL, WON, LOST).",
  { query: z.string().optional(), status: z.string().optional(), limit: z.number().int().min(1).max(500).optional() });
tool("upsert_company", "Create a company, or update the one with this name (case-insensitive match).",
  {
    name: z.string(), website: z.string().optional(), industry: z.string().optional(), company_phone: z.string().optional(), general_email: z.string().optional(),
    description: z.string().optional(), headquarters: z.string().optional(), size: z.string().optional(), linkedin_url: z.string().optional(),
    status: z.string().optional(), temperature: z.enum(["hot", "warm", "cold"]).optional(), tags: z.array(z.string()).optional(),
  });
tool("update_company", "Update fields on an existing company by company_id.",
  {
    company_id: z.string(), name: z.string().optional(), website: z.string().optional(), industry: z.string().optional(), company_phone: z.string().optional(),
    general_email: z.string().optional(), description: z.string().optional(), headquarters: z.string().optional(), size: z.string().optional(),
    status: z.string().optional(), temperature: z.enum(["hot", "warm", "cold"]).optional(), tags: z.array(z.string()).optional(),
  });

// ───────────── Recipient groups ─────────────
tool("list_groups", "List recipient groups (id, name, channel email/phone/mixed, member count). Resolve a group name to its id here before using it elsewhere.", {});
tool("get_group", "List a group's members (paginated). Pass group_id or group_name.",
  { group_id: z.string().optional(), group_name: z.string().optional(), limit: z.number().int().min(1).max(1000).optional(), offset: z.number().int().min(0).optional() });
tool("create_group", "Create a recipient group from a list of people. Members may have an email, a phone number, or both (so one group can serve both email and SMS campaigns).",
  { name: z.string(), description: z.string().optional(), recipients: z.array(recipient).min(1), channel: z.enum(["email", "phone", "mixed"]).optional().describe("Defaults from the members given.") });
tool("add_to_group",
  "Add people to a group (deduped against existing members). Pass group_id, or group_name (created if it doesn't exist). Sources: recipients[], contact_ids[] (CRM contacts), company_ids[] (uses the company's general email/phone).",
  {
    group_id: z.string().optional(), group_name: z.string().optional(), description: z.string().optional(),
    recipients: z.array(recipient).optional(), contact_ids: z.array(z.string()).optional(), company_ids: z.array(z.string()).optional(),
    create_if_missing: z.boolean().optional().describe("Default true when group_name is given."),
  });
tool("remove_from_group", "Remove members from a group by email and/or phone.",
  { group_id: z.string().optional(), group_name: z.string().optional(), emails: z.array(z.string()).optional(), phones: z.array(z.string()).optional() });

tool("delete_group", "Delete a recipient group and its member list. Refuses when the group has members unless confirm=true (ask the user first). Campaigns already created from it are unaffected.",
  { group_id: z.string().optional(), group_name: z.string().optional(), confirm: z.boolean().optional() });

// ───────────── Email campaigns ─────────────
tool("create_campaign",
  "Create an email campaign (HTML and/or text) and optionally schedule it. Recipients come from an explicit list and/or group_ids. Subject/body support {{firstName}} {{lastName}} {{fullName}} {{company}} {{email}}. Defaults: recipients are linked to CRM people/companies and the Day 1/3/5 no-reply follow-up is on (set follow_up=false for a one-off). With an explicit recipients list, set a short descriptive group_name — it is saved as a reusable group. Omit schedule_at to create a draft, then use send_test to preview and send_campaign to send.",
  {
    name: z.string(), subject: z.string(), body_html: z.string().optional().describe("Full HTML email body. Branding (logo, footer, signature) is applied by the sender."),
    body_text: z.string().optional().describe("Plain-text body; derived from HTML if omitted."),
    recipients: z.array(recipient).optional(), group_ids: z.array(z.string()).optional(), group_name: z.string().optional(),
    follow_up: z.boolean().optional(), schedule_at: scheduleAt,
  }, "create");
tool("list_campaigns", "List recent campaigns (email and SMS) with status and sent/failed counts.", {}, "list");
tool("get_campaign", "Full status for one campaign: counts by recipient status, sample failures, and (with include_body) the subject/body.",
  { campaign_id: z.string(), include_body: z.boolean().optional() });
tool("update_campaign",
  "Edit a draft/scheduled/paused campaign: name, subject, body_html/body_text (or message for SMS), schedule_at (or unschedule=true). Pending recipients are re-personalised.",
  { campaign_id: z.string(), name: z.string().optional(), subject: z.string().optional(), body_html: z.string().optional(), body_text: z.string().optional(), message: z.string().optional(), schedule_at: z.string().optional(), unschedule: z.boolean().optional() });
tool("send_campaign",
  "SEND NOW: start sending a draft/scheduled/paused campaign (email or SMS) to its pending recipients immediately. This sends real messages — confirm with the user first unless they already asked to send.",
  { campaign_id: z.string() });
tool("unschedule_campaign", "Cancel a scheduled or paused campaign back to a draft so it will not send.", { campaign_id: z.string() });
tool("send_test",
  "Send a one-off test email to yourself to preview subject/body before sending for real. Needs an active Resend or SendGrid sender.",
  { to_email: z.string(), subject: z.string(), body_html: z.string().optional(), body_text: z.string().optional() });

// ───────────── SMS campaigns ─────────────
tool("create_phone_campaign",
  "Create an SMS campaign. Recipients from recipients[{phone,name?,message?}] and/or group_ids. message supports {name} {first_name} {company} {phone}; a recipient's own message overrides it. UK landlines are skipped at send time. Saved as a draft unless schedule_at or send_now=true.",
  { name: z.string(), message: z.string().optional(), recipients: z.array(recipient.extend({ message: z.string().optional() })).optional(), group_ids: z.array(z.string()).optional(), schedule_at: scheduleAt, send_now: z.boolean().optional() });

// ───────────── Newsletters ─────────────
tool("create_newsletter",
  "Create a newsletter (HTML) for your subscriber base and optionally schedule it. Audience defaults to all active subscribers; pass group_ids to target a group instead.",
  { subject: z.string(), title: z.string().optional(), body_html: z.string().optional(), body_text: z.string().optional(), audience: z.object({ all_active: z.boolean().optional(), group_ids: z.array(z.string()).optional(), tag_ids: z.array(z.string()).optional() }).optional(), schedule_at: scheduleAt });
tool("list_newsletters", "List newsletters with status and send/open/click totals.", { limit: z.number().int().optional() });
tool("send_newsletter", "SEND NOW: send a draft newsletter immediately to its audience (or an audience given here). Sends real email — confirm with the user first.",
  { newsletter_id: z.string(), audience: z.object({ all_active: z.boolean().optional(), group_ids: z.array(z.string()).optional() }).optional() });
tool("list_subscribers", "List newsletter subscribers (default status active) with optional search.", { query: z.string().optional(), status: z.string().optional(), limit: z.number().int().optional() });
tool("add_subscribers", "Add newsletter subscribers (existing emails are skipped).", { subscribers: z.array(recipient).min(1), source: z.string().optional() });

// ───────────── Deals ─────────────
tool("list_deals", "List deals, optionally by stage (LEAD, QUALIFIED, PROPOSAL, NEGOTIATION, WON, LOST).", { stage: z.string().optional(), limit: z.number().int().optional() });
tool("create_deal", "Create a deal. company is matched by name (created if new).",
  { title: z.string(), company: z.string().optional(), company_id: z.string().optional(), stage: z.string().optional(), amount: z.number().optional(), priority: z.string().optional(), close_date: z.string().optional(), follow_up_date: z.string().optional(), notes: z.string().optional(), tags: z.array(z.string()).optional() });
tool("update_deal", "Update a deal by deal_id (stage, amount, dates, notes, tags, company).",
  { deal_id: z.string(), title: z.string().optional(), stage: z.string().optional(), amount: z.number().optional(), priority: z.string().optional(), close_date: z.string().optional(), follow_up_date: z.string().optional(), notes: z.string().optional(), tags: z.array(z.string()).optional(), company: z.string().optional() });

const transport = new StdioServerTransport();
await server.connect(transport);
console.error("[leadboosters-mcp] ready");
