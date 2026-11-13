#!/usr/bin/env node
/**
 * LeadBoosters MCP server.
 * Exposes campaign create/schedule/status tools to Claude (or any MCP client)
 * backed by the LeadBoosters API. Scope: create + schedule only (no send-now).
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
const CALLING_API_URL = process.env.LEADBOOSTERS_CALLING_API_URL ||
  "https://kgndpwzqohepotahnfeo.supabase.co/functions/v1/api-calling";
const API_KEY = process.env.LEADBOOSTERS_API_KEY;
if (!API_KEY) {
  console.error("[leadboosters-mcp] LEADBOOSTERS_API_KEY env var is required.");
  process.exit(1);
}

async function callApi(payload, url = API_URL) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "x-api-key": API_KEY, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }
  if (!res.ok) throw new Error(data?.error || `API error ${res.status}`);
  return data;
}

const server = new McpServer({ name: "leadboosters", version: "1.0.0" });

server.tool(
  "create_campaign",
  "Create an email campaign and (optionally) schedule it. If schedule_at is given, LeadBoosters sends it automatically at that London time — all safeguards (dedupe, domain verification, monthly limits) still apply. By default the Day 1/3/5 no-reply follow-up is enabled and recipients are linked to CRM people/companies so non-repliers are chased automatically. When you pass an explicit `recipients` list, always set a short, descriptive `group_name` based on the email's context (e.g. \"Q3 partnership outreach\") — it's saved as a reusable recipient group. Omit schedule_at to create a draft.",
  {
    name: z.string().describe("Internal campaign name."),
    subject: z.string().describe("Email subject. Supports {{firstName}}, {{lastName}}, {{fullName}}, {{company}}, {{email}}."),
    body_text: z.string().optional().describe("Plain-text body (supports the same tokens)."),
    body_html: z.string().optional().describe("HTML body (optional; derived from body_text if omitted)."),
    recipients: z.array(z.object({
      email: z.string(),
      first_name: z.string().optional(),
      last_name: z.string().optional(),
      company: z.string().optional(),
    })).optional().describe("Explicit recipients. Duplicates and invalid emails are dropped."),
    group_ids: z.array(z.string()).optional().describe("Recipient group ids to pull recipients from (instead of, or in addition to, an explicit list). Use list_groups to resolve a group by name."),
    group_name: z.string().optional().describe("Name for the reusable group auto-created from an explicit `recipients` list. Set this yourself to a concise label reflecting the email's context/audience. Ignored when only group_ids are used."),
    follow_up: z.boolean().optional().describe("Enable the Day 1/3/5 no-reply follow-up (default true). Set false to send a single email with no follow-ups."),
    schedule_at: z.string().optional().describe("London wall-clock 'YYYY-MM-DDTHH:mm' or full ISO. Omit for a draft."),
  },
  async (args) => {
    const data = await callApi({ action: "create", ...args });
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  },
);

server.tool(
  "list_campaigns",
  "List the most recent campaigns with their status and sent/failed counts.",
  {},
  async () => {
    const data = await callApi({ action: "list" });
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  },
);

server.tool(
  "list_groups",
  "List the user's recipient groups (id, name, member count). Use this to resolve a group by name into the group_id needed by create_campaign.",
  {},
  async () => {
    const data = await callApi({ action: "list_groups" });
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  },
);

server.tool(
  "campaign_status",
  "Get the status and counts for a single campaign by id.",
  { campaign_id: z.string() },
  async ({ campaign_id }) => {
    const data = await callApi({ action: "status", campaign_id });
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  },
);

server.tool(
  "create_newsletter",
  "Create a newsletter to your subscriber base and (optionally) schedule it. Sends automatically at schedule_at (London time). Audience defaults to all active subscribers; pass recipient group ids to target instead.",
  {
    subject: z.string(),
    title: z.string().optional().describe("Internal title; defaults to the subject."),
    body_html: z.string().optional(),
    body_text: z.string().optional(),
    audience: z.object({
      all_active: z.boolean().optional().describe("Send to all active subscribers (default when no groups given)."),
      group_ids: z.array(z.string()).optional().describe("Recipient group ids to target."),
      tag_ids: z.array(z.string()).optional(),
    }).optional(),
    schedule_at: z.string().optional().describe("London wall-clock 'YYYY-MM-DDTHH:mm' or full ISO. Omit for a draft."),
  },
  async (args) => {
    const data = await callApi({ action: "create_newsletter", ...args });
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  },
);

server.tool(
  "send_test",
  "Send a single test email to yourself to preview subject/body before scheduling a real send. Sends immediately from your active sender.",
  {
    to_email: z.string().describe("Where to send the test (usually your own address)."),
    subject: z.string(),
    body_html: z.string().optional(),
    body_text: z.string().optional(),
  },
  async (args) => {
    const data = await callApi({ action: "send_test", ...args });
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  },
);

server.tool(
  "create_calling_campaign",
  "Create a DRAFT human-assisted calling campaign (max 20 leads). Does NOT place calls or send cold SMS. You must include phone numbers. The user screens TPS/CTPS in LeadBoosters and clicks Call next lead. Never invent phone numbers.",
  {
    name: z.string().describe("Campaign name, e.g. TalkStay Cardiff hotels week 1."),
    product: z.enum(["TalkStay", "TalkWeb", "GrantsCopilot", "other"]).describe("Product being offered."),
    script: z.string().optional().describe("Call script. Supports {{company}}, {{caller}}, {{product}}."),
    sms_template: z.string().optional().describe("Optional SMS follow-up template (sent only after a live call or consent)."),
    email_followup_subject: z.string().optional(),
    email_followup_body: z.string().optional(),
    caller_phone: z.string().optional().describe("User's handset. Twilio rings this first."),
    leads: z.array(z.object({
      phone: z.string(),
      company: z.string().optional(),
      company_name: z.string().optional(),
      contact_name: z.string().optional(),
      email: z.string().optional(),
      company_id: z.string().optional(),
    })).describe("Up to 20 leads with real phone numbers. Duplicates and suppressed numbers are dropped."),
  },
  async (args) => {
    const data = await callApi({ action: "create", ...args }, CALLING_API_URL);
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  },
);

server.tool(
  "list_calling_campaigns",
  "List calling campaigns (draft/ready/active/paused/completed).",
  {},
  async () => {
    const data = await callApi({ action: "list" }, CALLING_API_URL);
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  },
);

server.tool(
  "calling_campaign_status",
  "Get a calling campaign and its queue (screening, outcomes, follow-ups).",
  { campaign_id: z.string() },
  async ({ campaign_id }) => {
    const data = await callApi({ action: "status", campaign_id }, CALLING_API_URL);
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  },
);

server.tool(
  "generate_call_script",
  "Generate a TalkStay / TalkWeb / GrantsCopilot call script. Does not start a campaign.",
  {
    product: z.enum(["TalkStay", "TalkWeb", "GrantsCopilot", "other"]),
    company: z.string().optional(),
    caller: z.string().optional(),
  },
  async (args) => {
    const data = await callApi({ action: "generate_script", ...args }, CALLING_API_URL);
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  },
);

server.tool(
  "ready_calling_campaign",
  "Mark a calling campaign ready so a HUMAN can click Call next lead. This does not place any calls.",
  { campaign_id: z.string() },
  async ({ campaign_id }) => {
    const data = await callApi({ action: "start", campaign_id }, CALLING_API_URL);
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  },
);

server.tool(
  "pause_calling_campaign",
  "Pause a calling campaign. Does not hang up an in-progress Twilio call.",
  { campaign_id: z.string() },
  async ({ campaign_id }) => {
    const data = await callApi({ action: "pause", campaign_id }, CALLING_API_URL);
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  },
);

server.tool(
  "record_call_outcome",
  "Log a call outcome and schedule the default next action. do_not_call / not_interested / invalid_number add the number to the suppression list.",
  {
    queue_item_id: z.string(),
    outcome: z.enum(["interested", "send_demo", "call_back", "not_right_person", "not_interested", "no_answer", "invalid_number", "do_not_call"]),
    notes: z.string().optional(),
    follow_up_hours: z.number().optional(),
  },
  async (args) => {
    const data = await callApi({ action: "record_outcome", ...args }, CALLING_API_URL);
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  },
);

server.tool(
  "add_phone_suppression",
  "Add a phone number to the do-not-call / TPS / CTPS / SMS opt-out list. Always do this when a contact objects.",
  {
    phone: z.string(),
    reason: z.enum(["dnc", "tps", "ctps", "sms_opt_out", "invalid", "user_added"]).optional(),
    notes: z.string().optional(),
    email: z.string().optional(),
  },
  async (args) => {
    const data = await callApi({ action: "add_suppression", ...args }, CALLING_API_URL);
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
console.error("[leadboosters-mcp] ready");
