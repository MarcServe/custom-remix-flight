// Platform admin console API. Every call must come from a signed-in user listed in
// platform_admins. Actions: whoami, overview, users, set_override, limits, update_limits,
// prices, change_price, webhook_status.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { loadLimits, leadsUsedThisMonth, LIMITS, type Tier } from "../_shared/plans.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const STRIPE = (Deno.env.get("STRIPE_SECRET_KEY") || "").trim();
const PLAN_IDS = ["crm", "autopilot", "autopilot_pro", "agency"] as const;
const PRICE_GBP: Record<string, number> = { crm: 29, autopilot: 99, autopilot_pro: 249, agency: 499, legacy_full: 29, individual: 9.99, pro: 19.99 };
const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

async function stripe(method: string, path: string, params?: URLSearchParams) {
  const r = await fetch("https://api.stripe.com/v1/" + path, { method, headers: { Authorization: "Bearer " + STRIPE, "Content-Type": "application/x-www-form-urlencoded" }, body: params?.toString() });
  const j = await r.json(); if (!r.ok) throw new Error(j?.error?.message || `Stripe ${r.status}`); return j;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const anon = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: req.headers.get("Authorization") || "" } } });
    const { data: { user } } = await anon.auth.getUser();
    if (!user) return json({ error: "Unauthorized" }, 401);
    const db = createClient(SUPABASE_URL, SERVICE);
    const { data: adm } = await db.from("platform_admins").select("user_id").eq("user_id", user.id).maybeSingle();
    const body = await req.json().catch(() => ({}));
    const action = String(body.action || "whoami");
    if (action === "whoami") return json({ admin: !!adm });
    if (!adm) return json({ error: "Admins only" }, 403);
    const audit = (a: string, details: unknown) => db.from("admin_audit_log").insert({ admin_id: user.id, action: a, details }).then(() => {}, () => {});

    // All auth users (paged; the admin API caps a page at 1,000)
    const allUsers = async () => {
      const out: any[] = [];
      for (let page = 1; page < 50; page++) {
        const { data, error } = await db.auth.admin.listUsers({ page, perPage: 1000 });
        if (error) throw error;
        out.push(...data.users);
        if (data.users.length < 1000) break;
      }
      return out;
    };
    const effectiveTiers = async (users: any[]) => {
      const [{ data: plans }, { data: ovs }] = await Promise.all([
        db.from("user_plans").select("user_id, tier, status, current_period_end, stripe_subscription_id"),
        db.from("plan_overrides").select("user_id, tier, note, expires_at"),
      ]);
      const pm = new Map((plans || []).map((p: any) => [p.user_id, p]));
      const om = new Map((ovs || []).map((o: any) => [o.user_id, o]));
      const now = Date.now();
      return users.map((u) => {
        const ov: any = om.get(u.id); const pl: any = pm.get(u.id);
        const ovLive = ov && (!ov.expires_at || new Date(ov.expires_at).getTime() > now);
        const paid = pl && pl.tier !== "free" && ["active", "trialing"].includes(String(pl.status || "")) ? pl.tier : null;
        const trial = new Date(u.created_at).getTime() + 7 * 86_400_000 > now;
        const tier = ovLive ? ov.tier : paid || (trial ? "trial" : "free");
        const source = ovLive ? "override" : paid ? (pl.status === "trialing" ? "stripe trial" : "stripe") : trial ? "trial" : "none";
        return { user: u, tier, source, override: ov || null, plan: pl || null };
      });
    };

    switch (action) {
      case "overview": {
        const users = await allUsers();
        const rows = await effectiveTiers(users);
        const byTier: Record<string, number> = {};
        let mrr = 0, paying = 0;
        for (const r of rows) {
          byTier[r.tier] = (byTier[r.tier] || 0) + 1;
          if (r.source === "stripe") { paying++; mrr += PRICE_GBP[r.tier] || 0; }
        }
        const monthStart = new Date(); monthStart.setUTCDate(1); monthStart.setUTCHours(0, 0, 0, 0);
        const dayStart = new Date(); dayStart.setUTCHours(0, 0, 0, 0);
        const [{ count: leadsMonth }, { count: runsToday }, { count: autopilotOn }, { count: campaignsMonth }] = await Promise.all([
          db.from("autonomous_leads").select("id", { count: "exact", head: true }).gte("created_at", monthStart.toISOString()).neq("source", "curated"),
          db.from("discovery_runs").select("id", { count: "exact", head: true }).gte("started_at", dayStart.toISOString()),
          db.from("autonomous_discovery_settings").select("id", { count: "exact", head: true }).eq("enabled", true),
          db.from("email_campaigns").select("id", { count: "exact", head: true }).gte("created_at", monthStart.toISOString()),
        ]);
        const since30 = Date.now() - 30 * 86_400_000;
        return json({
          users: users.length,
          signups_30d: users.filter((u) => new Date(u.created_at).getTime() > since30).length,
          active_30d: users.filter((u) => u.last_sign_in_at && new Date(u.last_sign_in_at).getTime() > since30).length,
          paying, mrr_gbp: Math.round(mrr * 100) / 100, by_tier: byTier,
          trials_active: byTier.trial || 0,
          autopilot_enabled_accounts: autopilotOn || 0, discovery_runs_today: runsToday || 0,
          new_leads_this_month: leadsMonth || 0, campaigns_this_month: campaignsMonth || 0,
        });
      }

      case "users": {
        const q = String(body.search || "").toLowerCase().trim();
        const users = (await allUsers()).filter((u) => !q || String(u.email || "").toLowerCase().includes(q));
        users.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        const rows = await effectiveTiers(users.slice(0, 200));
        const limits = await loadLimits(db);
        const { data: admins } = await db.from("platform_admins").select("user_id");
        const adminIds = new Set((admins || []).map((a: any) => a.user_id));
        const out = [];
        for (const r of rows) {
          const used = await leadsUsedThisMonth(db, r.user.id);
          out.push({
            id: r.user.id, email: r.user.email, is_admin: adminIds.has(r.user.id), created_at: r.user.created_at, last_sign_in_at: r.user.last_sign_in_at,
            tier: r.tier, source: r.source, leads_used_this_month: used, leads_limit: (limits as any)[r.tier]?.leadsPerMonth ?? 0,
            override: r.override, subscription: r.plan ? { tier: r.plan.tier, status: r.plan.status, renews: r.plan.current_period_end, id: r.plan.stripe_subscription_id } : null,
          });
        }
        return json({ total: users.length, users: out });
      }

      case "set_override": {
        const userId = String(body.user_id || "");
        if (!userId) return json({ error: "user_id required" }, 400);
        // Platform admins can never be downgraded or have their access removed from the console.
        const { data: targetAdmin } = await db.from("platform_admins").select("user_id").eq("user_id", userId).maybeSingle();
        if (targetAdmin && body.tier !== "agency") return json({ error: "Admin accounts always keep full (Agency) access and can't be changed here." }, 400);
        if (!body.tier) {
          await db.from("plan_overrides").delete().eq("user_id", userId);
          await audit("remove_override", { user_id: userId });
          return json({ removed: true });
        }
        if (!(body.tier in LIMITS)) return json({ error: "Unknown tier" }, 400);
        const row = { user_id: userId, tier: body.tier, note: String(body.note || "").slice(0, 200) || null, expires_at: body.expires_at || null };
        const { error } = await db.from("plan_overrides").upsert(row, { onConflict: "user_id" });
        if (error) return json({ error: error.message }, 500);
        await audit("set_override", row);
        return json({ override: row });
      }

      case "limits": {
        const { data } = await db.from("plan_limits").select("*").order("leads_per_month");
        return json({ limits: data || [] });
      }

      case "update_limits": {
        const tier = String(body.tier || "");
        if (!(tier in LIMITS)) return json({ error: "Unknown tier" }, 400);
        const patch = {
          tier, autopilot: !!body.autopilot,
          leads_per_month: Math.max(0, Math.min(1_000_000, Number(body.leads_per_month) || 0)),
          personas: Math.max(0, Math.min(100, Number(body.personas) || 0)),
          updated_at: new Date().toISOString(), updated_by: user.id,
        };
        const { error } = await db.from("plan_limits").upsert(patch, { onConflict: "tier" });
        if (error) return json({ error: error.message }, 500);
        await audit("update_limits", patch);
        return json({ limits: patch });
      }

      case "prices": {
        const keys = PLAN_IDS.flatMap((p) => [`lb_${p}_monthly`, `lb_${p}_yearly`]);
        const qs = keys.map((k) => `lookup_keys[]=${k}`).join("&");
        const prices = await stripe("GET", `prices?active=true&limit=20&${qs}`);
        return json({ prices: (prices.data || []).map((p: any) => ({ id: p.id, lookup_key: p.lookup_key, amount_gbp: p.unit_amount / 100, interval: p.recurring?.interval, product: p.product, created: p.created })) });
      }

      case "change_price": {
        // New checkouts use the new price (lookup key moves); existing subscribers keep theirs.
        const plan = String(body.plan || ""), interval = body.interval === "yearly" ? "yearly" : "monthly";
        const amount = Math.round(Number(body.amount_gbp) * 100);
        if (!(PLAN_IDS as readonly string[]).includes(plan)) return json({ error: "Unknown plan" }, 400);
        if (!(amount >= 100 && amount <= 10_000_000)) return json({ error: "Amount must be between £1 and £100,000" }, 400);
        const lk = `lb_${plan}_${interval}`;
        const cur = await stripe("GET", `prices?active=true&limit=1&lookup_keys[]=${lk}`);
        const old = cur.data?.[0];
        if (!old) return json({ error: `No current price for ${lk}` }, 404);
        if (old.unit_amount === amount) return json({ unchanged: true });
        const p = new URLSearchParams();
        p.set("product", old.product); p.set("currency", "gbp"); p.set("unit_amount", String(amount));
        p.set("recurring[interval]", interval === "yearly" ? "year" : "month"); p.set("lookup_key", lk); p.set("transfer_lookup_key", "true");
        p.set("nickname", `${old.nickname || plan} (from ${new Date().toISOString().slice(0, 10)})`);
        p.set("metadata[app]", "leadboosters"); p.set("metadata[tier]", plan);
        const created = await stripe("POST", "prices", p);
        await audit("change_price", { plan, interval, from: old.unit_amount / 100, to: amount / 100, old_price: old.id, new_price: created.id });
        return json({ plan, interval, old_price: { id: old.id, amount_gbp: old.unit_amount / 100 }, new_price: { id: created.id, amount_gbp: amount / 100 }, note: "New sign-ups pay the new price. Existing subscribers stay on their current price until you migrate them in Stripe." });
      }

      case "webhook_status": {
        const list = await stripe("GET", "webhook_endpoints?limit=100");
        const ep = (list.data || []).find((w: any) => String(w.url).includes("kgndpwzqohepotahnfeo.supabase.co/functions/v1/stripe-webhook"));
        const ev = await stripe("GET", "events?limit=10&types[]=customer.subscription.updated&types[]=customer.subscription.created&types[]=customer.subscription.deleted");
        const undelivered = (ev.data || []).filter((e: any) => e.pending_webhooks > 0).length;
        return json({ endpoint: ep ? { id: ep.id, status: ep.status, events: ep.enabled_events } : null, recent_events: (ev.data || []).length, undelivered_recent: undelivered });
      }

      case "audit": {
        const { data } = await db.from("admin_audit_log").select("*").order("created_at", { ascending: false }).limit(100);
        return json({ entries: data || [] });
      }

      default:
        return json({ error: `Unknown action ${action}` }, 400);
    }
  } catch (e) {
    return json({ error: (e as Error)?.message || "Failed" }, 500);
  }
});
