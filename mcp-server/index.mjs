#!/usr/bin/env node
/**
 * LeadBoosters MCP server (local stdio).
 *
 * Thin proxy to the hosted LeadBoosters MCP endpoint, so the tool catalogue
 * lives in one place. Use this when a client only speaks stdio; clients that
 * support remote (Streamable HTTP) servers can connect to the URL directly:
 *
 *   https://kgndpwzqohepotahnfeo.supabase.co/functions/v1/mcp?key=lb_live_...
 *
 * Env:
 *   LEADBOOSTERS_API_KEY   (required)  your lb_live_... key from Settings → API Keys
 *   LEADBOOSTERS_MCP_URL   (optional)  defaults to the hosted endpoint
 */
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";

const API_KEY = process.env.LEADBOOSTERS_API_KEY;
if (!API_KEY) {
  console.error("[leadboosters-mcp] LEADBOOSTERS_API_KEY env var is required.");
  process.exit(1);
}
const MCP_URL = process.env.LEADBOOSTERS_MCP_URL || "https://kgndpwzqohepotahnfeo.supabase.co/functions/v1/mcp";

let rpcId = 0;
async function remote(method, params) {
  const res = await fetch(MCP_URL, {
    method: "POST",
    headers: { "x-api-key": API_KEY, "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: ++rpcId, method, params }),
  });
  const text = await res.text();
  let msg;
  try { msg = JSON.parse(text); } catch { throw new Error(`Bad response from LeadBoosters (${res.status}): ${text.slice(0, 200)}`); }
  if (msg.error) throw new Error(msg.error.message || "LeadBoosters error");
  return msg.result;
}

const init = await remote("initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "leadboosters-mcp-stdio", version: "1.2.0" } }).catch((e) => {
  console.error(`[leadboosters-mcp] cannot reach ${MCP_URL}: ${e.message}`);
  process.exit(1);
});

const server = new Server(
  { name: "leadboosters", version: "1.2.0" },
  { capabilities: { tools: {} }, instructions: init?.instructions },
);

let toolsCache = null;
server.setRequestHandler(ListToolsRequestSchema, async () => {
  if (!toolsCache) toolsCache = await remote("tools/list", {});
  return toolsCache;
});
server.setRequestHandler(CallToolRequestSchema, async (req) => {
  try {
    return await remote("tools/call", { name: req.params.name, arguments: req.params.arguments || {} });
  } catch (e) {
    return { isError: true, content: [{ type: "text", text: `LeadBoosters error: ${e?.message || e}` }] };
  }
});

await server.connect(new StdioServerTransport());
console.error("[leadboosters-mcp] ready (proxying to hosted server)");
