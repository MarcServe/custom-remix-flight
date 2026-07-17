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

const transport = new StdioServerTransport();
await server.connect(transport);
console.error("[leadboosters-mcp] ready");
