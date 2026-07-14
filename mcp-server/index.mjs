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
  "Create an email campaign and (optionally) schedule it. If schedule_at is given, LeadBoosters sends it automatically at that London time — all safeguards (dedupe, domain verification, monthly limits, no-reply follow-ups) still apply. Omit schedule_at to create a draft.",
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
    })).describe("Recipients. Duplicates and invalid emails are dropped."),
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
  "campaign_status",
  "Get the status and counts for a single campaign by id.",
  { campaign_id: z.string() },
  async ({ campaign_id }) => {
    const data = await callApi({ action: "status", campaign_id });
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
console.error("[leadboosters-mcp] ready");
