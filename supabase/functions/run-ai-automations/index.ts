// Runs scheduled AI automations. Each automation is a plain-English job; the
// runner lets a model work through it with the same tools the MCP server
// exposes (executed via api-campaigns as the owning user), logs every step,
// stores a summary and notifies the user.
//
//   POST {}                         (service role, from cron) → run everything due
//   POST { automation_id }          (service role or the owner's JWT) → run one now
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { MCP_TOOLS } from "../_shared/mcp-tools.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const OPENAI_KEY = (Deno.env.get("OPENAI_API_KEY") || "").trim();
const MAX_STEPS = 20;
const RUN_BUDGET_MS = 110_000;
const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

// ── Scheduling ──────────────────────────────────────────────────────────────
function zonedParts(d: Date, tz: string) {
  const p = new Intl.DateTimeFormat("en-US", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", weekday: "short", hour12: false }).formatToParts(d);
  const g = (t: string) => p.find((x) => x.type === t)?.value || "";
  const wd = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(g("weekday"));
  return { y: +g("year"), m: +g("month"), d: +g("day"), h: +g("hour") % 24, min: +g("minute"), wd };
}
// UTC instant for a wall-clock time in tz (iterative offset fix, DST-safe).
function zonedToUtc(y: number, m: number, d: number, h: number, min: number, tz: string): Date {
  let ts = Date.UTC(y, m - 1, d, h, min, 0);
  for (let i = 0; i < 3; i++) {
    const p = zonedParts(new Date(ts), tz);
    const shown = Date.UTC(p.y, p.m - 1, p.d, p.h, p.min, 0);
    const diff = Date.UTC(y, m - 1, d, h, min, 0) - shown;
    if (diff === 0) break;
    ts += diff;
  }
  return new Date(ts);
}
export function computeNextRun(a: { schedule_kind: string; time_of_day: string; days_of_week: number[] | null; timezone: string }, from = new Date()): Date {
  const tz = a.timezone || "Europe/London";
  if (a.schedule_kind === "hourly") return new Date(Math.floor(from.getTime() / 3600000) * 3600000 + 3600000);
  const [hh, mm] = String(a.time_of_day || "08:00").split(":").map((n) => parseInt(n, 10) || 0);
  const days = a.schedule_kind === "weekdays" ? [1, 2, 3, 4, 5] : a.schedule_kind === "weekly" ? (a.days_of_week?.length ? a.days_of_week : [1]) : [0, 1, 2, 3, 4, 5, 6];
  const now = zonedParts(from, tz);
  for (let i = 0; i < 8; i++) {
    const base = new Date(Date.UTC(now.y, now.m - 1, now.d + i, 12, 0, 0));
    const bp = zonedParts(base, tz);
    const candidate = zonedToUtc(bp.y, bp.m, bp.d, hh, mm, tz);
    if (candidate.getTime() > from.getTime() && days.includes(bp.wd)) return candidate;
  }
  return new Date(from.getTime() + 86400000);
}

// ── Tool execution via api-campaigns, acting as the owner ───────────────────
async function callTool(userId: string, action: string, args: Record<string, unknown>) {
  const r = await fetch(`${SUPABASE_URL}/functions/v1/api-campaigns`, {
    method: "POST",
    headers: { Authorization: `Bearer ${SERVICE_KEY}`, "x-user-id": userId, "Content-Type": "application/json" },
    body: JSON.stringify({ action, ...args }),
  });
  const text = await r.text();
  let data: any; try { data = JSON.parse(text); } catch { data = { raw: text.slice(0, 500) }; }
  return { ok: r.ok, data };
}

const clip = (v: unknown, n = 4000) => { const s = typeof v === "string" ? v : JSON.stringify(v); return s.length > n ? s.slice(0, n) + `… [${s.length - n} more chars]` : s; };

async function runOne(db: any, a: any, trigger: string) {
  const startedAt = Date.now();
  const { data: run } = await db.from("ai_automation_runs").insert({ automation_id: a.id, user_id: a.user_id, trigger, status: "running", model: a.model || "gpt-4o-mini" }).select("id").single();
  await db.from("ai_automations").update({ running_since: new Date().toISOString(), last_status: "running" }).eq("id", a.id);
  const steps: any[] = [];
  let summary = ""; let status = "success"; let error: string | null = null; let tokensIn = 0, tokensOut = 0;
  try {
    if (!OPENAI_KEY) throw new Error("OPENAI_API_KEY is not configured");
    const { data: bp } = await db.from("business_profiles").select("company_name, industry, services_description, target_audience, value_proposition, tone_preference, email_sender_name, website").eq("user_id", a.user_id).maybeSingle();
    const tools = MCP_TOOLS.filter((t) => a.allow_sending || !t.sends).map((t) => ({ type: "function", function: { name: t.name, description: t.description, parameters: t.inputSchema } }));
    const nowUk = new Date().toLocaleString("en-GB", { timeZone: a.timezone || "Europe/London", dateStyle: "full", timeStyle: "short" });
    const system =
      `You are LeadBoosters' automation agent, working inside the CRM of ${bp?.company_name || "the user's business"}` +
      `${bp?.industry ? ` (${bp.industry})` : ""}. Now: ${nowUk}. ` +
      `Business: ${bp?.services_description || bp?.value_proposition || "see profile"}. Audience: ${bp?.target_audience || "n/a"}. Tone: ${bp?.tone_preference || "professional"}. Sender: ${bp?.email_sender_name || "the owner"}.\n` +
      `You run unattended on a schedule. Carry out the job below using the tools; look things up before acting; prefer saving work in LeadBoosters (drafts, groups, contacts, deals). ` +
      (a.allow_sending ? `Sending is permitted for this automation when the job says to send.` : `This automation may NOT send anything: create drafts, groups, contacts and deals only (sending tools are unavailable).`) +
      ` Avoid duplicating work from a previous run: check existing campaigns/groups/drafts first. Do at most ${MAX_STEPS} tool calls. ` +
      `When finished, reply with a concise plain-text summary (what you created/changed with names and ids, what you found, anything needing the user's attention). No markdown headings.`;
    const messages: any[] = [{ role: "system", content: system }, { role: "user", content: `Job: ${a.instruction}` }];
    for (let i = 0; i < MAX_STEPS + 1; i++) {
      if (Date.now() - startedAt > RUN_BUDGET_MS) { summary = (summary || "") + "\n(Stopped: time budget reached; the rest continues on the next run.)"; break; }
      const r = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST", headers: { Authorization: `Bearer ${OPENAI_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: a.model || "gpt-4o-mini", temperature: 0.3, messages, tools, tool_choice: i >= MAX_STEPS ? "none" : "auto" }),
      });
      if (!r.ok) throw new Error(`OpenAI ${r.status}: ${(await r.text()).slice(0, 300)}`);
      const d = await r.json();
      tokensIn += d.usage?.prompt_tokens || 0; tokensOut += d.usage?.completion_tokens || 0;
      const msg = d.choices?.[0]?.message;
      if (!msg) throw new Error("No completion");
      messages.push(msg);
      const calls = msg.tool_calls || [];
      if (!calls.length) { summary = String(msg.content || "").trim(); break; }
      for (const c of calls) {
        const name = c.function?.name; let args: any = {};
        try { args = JSON.parse(c.function?.arguments || "{}"); } catch { args = {}; }
        const tool = MCP_TOOLS.find((t) => t.name === name);
        let result: any;
        if (!tool) result = { ok: false, data: { error: `Unknown tool ${name}` } };
        else result = await callTool(a.user_id, tool.action, args);
        steps.push({ tool: name, args: JSON.parse(clip(args, 1500)), ok: result.ok, result: clip(result.data, 1200), at: new Date().toISOString() });
        messages.push({ role: "tool", tool_call_id: c.id, content: clip(result.data, 6000) });
      }
    }
    if (!summary) summary = "Finished without a closing summary.";
  } catch (e) {
    status = "failed"; error = (e as Error)?.message || String(e);
  }
  const finished = new Date().toISOString();
  await db.from("ai_automation_runs").update({ status, finished_at: finished, summary, steps, error, tokens_in: tokensIn, tokens_out: tokensOut }).eq("id", run?.id);
  const next = a.enabled ? computeNextRun(a, new Date()).toISOString() : null;
  await db.from("ai_automations").update({ running_since: null, last_run_at: finished, last_status: status, last_summary: clip(error ? `Failed: ${error}` : summary, 1000), next_run_at: next, updated_at: finished }).eq("id", a.id);
  await db.from("notifications").insert({
    user_id: a.user_id, type: status === "success" ? "automation_run" : "automation_failed",
    title: status === "success" ? `Automation ran: ${a.name}` : `Automation failed: ${a.name}`,
    body: clip(error || summary, 400), link: "/ai-create?tab=connect", entity_type: "automation_run", entity_id: run?.id || null,
    metadata: { automation_id: a.id, steps: steps.length },
  });
  return { run_id: run?.id, status, summary, steps: steps.length, error, next_run_at: next };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const db = createClient(SUPABASE_URL, SERVICE_KEY);
    const authHeader = req.headers.get("Authorization") || "";
    const isService = authHeader === `Bearer ${SERVICE_KEY}`;
    const body = await req.json().catch(() => ({}));
    let userId: string | null = null;
    if (!isService) {
      const anon = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
      const { data: { user } } = await anon.auth.getUser();
      if (!user) return json({ error: "Unauthorized" }, 401);
      userId = user.id;
      if (!body.automation_id && !body.reschedule_only) return json({ error: "automation_id required" }, 400);
    }

    if (body.reschedule_only) {
      const { data: rows } = await db.from("ai_automations").select("*").is("next_run_at", null).eq("enabled", true);
      for (const a of rows || []) await db.from("ai_automations").update({ next_run_at: computeNextRun(a).toISOString() }).eq("id", a.id);
      return json({ success: true, rescheduled: (rows || []).length });
    }
    if (body.automation_id) {
      let q = db.from("ai_automations").select("*").eq("id", body.automation_id);
      if (userId) q = q.eq("user_id", userId);
      const { data: a } = await q.maybeSingle();
      if (!a) return json({ error: "Automation not found" }, 404);
      if (a.running_since && Date.now() - new Date(a.running_since).getTime() < 10 * 60_000) return json({ error: "Already running; try again in a few minutes." }, 409);
      const result = await runOne(db, a, body.trigger || (isService ? "api" : "manual"));
      return json({ success: result.status === "success", ...result });
    }

    // Cron: everything due (skip anything mid-run unless stale).
    const nowIso = new Date().toISOString();
    const { data: due } = await db.from("ai_automations").select("*").eq("enabled", true).lte("next_run_at", nowIso).order("next_run_at", { ascending: true }).limit(10);
    const results: any[] = [];
    const startedAt = Date.now();
    for (const a of due || []) {
      if (a.running_since && Date.now() - new Date(a.running_since).getTime() < 10 * 60_000) continue;
      if (Date.now() - startedAt > 100_000) break; // the rest run on the next tick
      results.push({ id: a.id, name: a.name, ...(await runOne(db, a, "schedule")) });
    }
    // Automations without a next_run_at yet (older rows): schedule them.
    const { data: unscheduled } = await db.from("ai_automations").select("*").eq("enabled", true).is("next_run_at", null);
    for (const a of unscheduled || []) await db.from("ai_automations").update({ next_run_at: computeNextRun(a).toISOString() }).eq("id", a.id);
    return json({ success: true, ran: results.length, results });
  } catch (e) {
    return json({ error: (e as Error)?.message || "Failed" }, 500);
  }
});
