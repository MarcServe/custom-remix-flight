// Hosted MCP server (Streamable HTTP, stateless) for LeadBoosters.
//
//   POST https://<project>.supabase.co/functions/v1/mcp?key=lb_live_...
//
// Works with Claude.ai custom connectors, Claude Desktop/Code remote servers,
// ChatGPT connectors (developer mode) and Cursor. Authenticates with the user's
// lb_live_ API key (query `key`, header `x-api-key`, or `Authorization: Bearer`),
// then executes tools by calling api-campaigns with that same key.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { MCP_TOOLS, MCP_INSTRUCTIONS } from "../_shared/mcp-tools.ts";

const SERVER_VERSION = "1.2.0";
const PROTOCOLS = ["2025-06-18", "2025-03-26", "2024-11-05"];
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-api-key, content-type, accept, mcp-session-id, mcp-protocol-version, x-client-info, apikey",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Expose-Headers": "mcp-session-id, mcp-protocol-version",
};

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

type Rpc = { jsonrpc?: string; id?: string | number | null; method?: string; params?: any };
const rpcResult = (id: Rpc["id"], result: unknown) => ({ jsonrpc: "2.0", id, result });
const rpcError = (id: Rpc["id"], code: number, message: string, data?: unknown) => ({ jsonrpc: "2.0", id, error: { code, message, ...(data !== undefined ? { data } : {}) } });
const jsonResponse = (body: unknown, status = 200, extra: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json", ...extra } });

async function callApi(key: string, payload: Record<string, unknown>) {
  const url = `${Deno.env.get("SUPABASE_URL")}/functions/v1/api-campaigns`;
  const r = await fetch(url, { method: "POST", headers: { "x-api-key": key, "Content-Type": "application/json" }, body: JSON.stringify(payload) });
  const text = await r.text();
  let data: any; try { data = JSON.parse(text); } catch { data = { raw: text }; }
  return { ok: r.ok, status: r.status, data };
}

// ChatGPT's connector contract wants `search` + `fetch`; map them onto the CRM.
const CHATGPT_TOOLS = [
  { name: "search", description: "Search LeadBoosters CRM: contacts, companies, recipient groups and campaigns. Returns ids to pass to fetch.", inputSchema: { type: "object", properties: { query: { type: "string" } }, required: ["query"] } },
  { name: "fetch", description: "Fetch a LeadBoosters record by id returned from search (contact:<id>, company:<id>, group:<id>, campaign:<id>).", inputSchema: { type: "object", properties: { id: { type: "string" } }, required: ["id"] } },
];

async function runSearch(key: string, query: string) {
  const [c, co, g, camps] = await Promise.all([
    callApi(key, { action: "search_contacts", query, limit: 10 }),
    callApi(key, { action: "search_companies", query, limit: 10 }),
    callApi(key, { action: "list_groups" }),
    callApi(key, { action: "list" }),
  ]);
  const q = query.toLowerCase();
  const results: any[] = [];
  for (const x of c.data?.contacts || []) results.push({ id: `contact:${x.id}`, title: `${[x.first_name, x.last_name].filter(Boolean).join(" ")} <${x.email}>${x.company ? " · " + x.company : ""}`, url: `leadboosters://contact/${x.id}` });
  for (const x of co.data?.companies || []) results.push({ id: `company:${x.id}`, title: `${x.name}${x.industry ? " · " + x.industry : ""}`, url: `leadboosters://company/${x.id}` });
  for (const x of (g.data?.groups || []).filter((y: any) => String(y.name).toLowerCase().includes(q))) results.push({ id: `group:${x.id}`, title: `Group: ${x.name} (${x.members} members)`, url: `leadboosters://group/${x.id}` });
  for (const x of (camps.data?.campaigns || []).filter((y: any) => String(y.name).toLowerCase().includes(q))) results.push({ id: `campaign:${x.id}`, title: `Campaign: ${x.name} (${x.status}, ${x.sent_count} sent)`, url: `leadboosters://campaign/${x.id}` });
  return { results };
}

async function runFetch(key: string, id: string) {
  const [kind, rid] = String(id).split(":");
  const map: Record<string, Record<string, unknown>> = {
    contact: { action: "get_contact", contact_id: rid },
    company: { action: "get_company", company_id: rid },
    group: { action: "get_group", group_id: rid, limit: 200 },
    campaign: { action: "get_campaign", campaign_id: rid, include_body: true },
  };
  if (!map[kind]) throw new Error("Unknown id format");
  const r = await callApi(key, map[kind]);
  return { id, title: id, text: JSON.stringify(r.data, null, 2), url: `leadboosters://${kind}/${rid}`, metadata: { kind } };
}

async function handleRpc(msg: Rpc, key: string): Promise<unknown | null> {
  const id = msg.id ?? null;
  const method = msg.method || "";
  const isNotification = msg.id === undefined;
  try {
    switch (method) {
      case "initialize": {
        const requested = msg.params?.protocolVersion;
        return rpcResult(id, {
          protocolVersion: PROTOCOLS.includes(requested) ? requested : PROTOCOLS[0],
          capabilities: { tools: { listChanged: false } },
          serverInfo: { name: "leadboosters", version: SERVER_VERSION },
          instructions: MCP_INSTRUCTIONS,
        });
      }
      case "ping": return rpcResult(id, {});
      case "notifications/initialized":
      case "notifications/cancelled":
      case "notifications/roots/list_changed":
        return null;
      case "tools/list":
        return rpcResult(id, { tools: [...MCP_TOOLS.map(({ name, description, inputSchema }) => ({ name, description, inputSchema })), ...CHATGPT_TOOLS] });
      case "resources/list": return rpcResult(id, { resources: [] });
      case "resources/templates/list": return rpcResult(id, { resourceTemplates: [] });
      case "prompts/list": return rpcResult(id, { prompts: [] });
      case "tools/call": {
        const name = String(msg.params?.name || "");
        const args = (msg.params?.arguments && typeof msg.params.arguments === "object") ? msg.params.arguments : {};
        const text = (v: unknown) => ({ content: [{ type: "text", text: typeof v === "string" ? v : JSON.stringify(v, null, 2) }] });
        if (name === "search") return rpcResult(id, text(await runSearch(key, String(args.query || ""))));
        if (name === "fetch") return rpcResult(id, text(await runFetch(key, String(args.id || ""))));
        const tool = MCP_TOOLS.find((t) => t.name === name);
        if (!tool) return rpcError(id, -32602, `Unknown tool: ${name}`);
        const r = await callApi(key, { action: tool.action, ...args });
        if (!r.ok) return rpcResult(id, { isError: true, content: [{ type: "text", text: `LeadBoosters error: ${r.data?.error || r.data?.message || `HTTP ${r.status}`}` }] });
        return rpcResult(id, text(r.data));
      }
      default:
        return isNotification ? null : rpcError(id, -32601, `Method not found: ${method}`);
    }
  } catch (e) {
    return isNotification ? null : rpcError(id, -32603, (e as Error)?.message || "Internal error");
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  const url = new URL(req.url);

  // Friendly landing for a browser GET without a key.
  if (req.method === "GET" && !url.searchParams.get("key") && !req.headers.get("x-api-key") && !req.headers.get("authorization")) {
    return jsonResponse({ name: "LeadBoosters MCP", version: SERVER_VERSION, transport: "streamable-http", how: "POST JSON-RPC here with ?key=lb_live_... (Settings → API Keys in LeadBoosters). Add this URL as a custom connector in Claude.ai / ChatGPT, or `claude mcp add --transport http leadboosters <url>`." });
  }

  // ── Auth
  const authHeader = req.headers.get("authorization") || "";
  const bearer = authHeader.replace(/^Bearer\s+/i, "").trim();
  const key = (url.searchParams.get("key") || req.headers.get("x-api-key") || bearer || "").trim();
  if (!key.startsWith("lb_live_")) {
    return jsonResponse({ error: "Missing API key. Append ?key=lb_live_... to the URL or send it as x-api-key." }, 401, { "WWW-Authenticate": 'Bearer realm="leadboosters"' });
  }
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: keyRow } = await db.from("api_keys").select("id, revoked_at").eq("key_hash", await sha256Hex(key)).maybeSingle();
  if (!keyRow || keyRow.revoked_at) return jsonResponse({ error: "Invalid or revoked API key" }, 401);

  if (req.method === "GET") return jsonResponse({ error: "This server does not open a standalone event stream; send JSON-RPC via POST." }, 405, { Allow: "POST, DELETE, OPTIONS" });
  if (req.method === "DELETE") return new Response(null, { status: 200, headers: CORS });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  let body: unknown;
  try { body = await req.json(); } catch { return jsonResponse(rpcError(null, -32700, "Parse error"), 400); }
  const messages: Rpc[] = Array.isArray(body) ? body : [body as Rpc];
  const responses = (await Promise.all(messages.map((m) => handleRpc(m, key)))).filter((r) => r !== null);

  // Notifications only → 202 with no body (per spec).
  if (!responses.length) return new Response(null, { status: 202, headers: CORS });
  const payload = Array.isArray(body) ? responses : responses[0];
  return jsonResponse(payload, 200, { "mcp-protocol-version": PROTOCOLS[0] });
});
