// LeadBoosters plans and their limits. One place for check-subscription, the Stripe webhook,
// Autopilot and the assistant tools.
export type Tier = "free" | "trial" | "individual" | "pro" | "crm" | "autopilot" | "autopilot_pro" | "agency" | "legacy_full";

export interface PlanLimits {
  autopilot: boolean;          // may run Autopilot discovery
  leadsPerMonth: number;       // new leads found per calendar month (Autopilot + find_leads)
  personas: number;            // active personas Autopilot will use
}

export const LIMITS: Record<Tier, PlanLimits> = {
  free:          { autopilot: false, leadsPerMonth: 0,      personas: 0 },
  individual:    { autopilot: false, leadsPerMonth: 0,      personas: 0 },
  pro:           { autopilot: false, leadsPerMonth: 100,    personas: 0 },   // legacy £19.99: manual Lead Finder
  crm:           { autopilot: false, leadsPerMonth: 100,    personas: 0 },
  trial:         { autopilot: true,  leadsPerMonth: 100,    personas: 1 },   // 7-day trial, capped
  autopilot:     { autopilot: true,  leadsPerMonth: 500,    personas: 1 },
  autopilot_pro: { autopilot: true,  leadsPerMonth: 2000,   personas: 3 },
  agency:        { autopilot: true,  leadsPerMonth: 10000,  personas: 20 },
  legacy_full:   { autopilot: true,  leadsPerMonth: 2000,   personas: 3 },   // grandfathered old £29 plan
};

// Products created before Nov 2026 (no metadata). Anything else in the shared Stripe account
// (ROUT£, GrantsCopilot, Securar…) is NOT a LeadBoosters plan.
const LEGACY_PRODUCTS: Record<string, Tier> = {
  prod_TUNeoAZWiDngEH: "individual",   // LeadBoosters Individual
  prod_TUWSncZpXEQvVM: "individual",   // LeadBoosters - GBP (£9.99)
  prod_UbJKukbTXsTZ8Z: "pro",          // LeadBoosters Pro £19.99
  prod_TUWh5sRO2yGtDx: "legacy_full",  // LeadBoosters Business £29 (old all-in plan, grandfathered)
};

/** Tier for a Stripe price/product, or null if it isn't a LeadBoosters product. */
export function tierForStripe(price: any): Tier | null {
  const product = typeof price?.product === "string" ? price.product : price?.product?.id;
  const metaTier = price?.metadata?.app === "leadboosters" ? price?.metadata?.tier : (price?.product?.metadata?.app === "leadboosters" ? price.product.metadata.tier : null);
  if (metaTier && metaTier in LIMITS) return metaTier as Tier;
  if (product && LEGACY_PRODUCTS[product]) return LEGACY_PRODUCTS[product];
  return null;
}

const RANK: Record<Tier, number> = { free: 0, individual: 1, pro: 2, crm: 2, trial: 3, autopilot: 3, legacy_full: 4, autopilot_pro: 4, agency: 5 };
export const better = (a: Tier, b: Tier): Tier => (RANK[b] > RANK[a] ? b : a);

/** Effective plan for a user: override > paid plan > trial (7 days from sign-up) > free. */
export async function getUserPlan(db: any, userId: string): Promise<{ tier: Tier; limits: PlanLimits; source: string }> {
  const now = Date.now();
  const { data: ov } = await db.from("plan_overrides").select("tier, expires_at").eq("user_id", userId).maybeSingle();
  if (ov?.tier && ov.tier in LIMITS && (!ov.expires_at || new Date(ov.expires_at).getTime() > now)) return { tier: ov.tier, limits: LIMITS[ov.tier as Tier], source: "override" };
  const { data: up } = await db.from("user_plans").select("tier, status").eq("user_id", userId).maybeSingle();
  if (up?.tier && up.tier in LIMITS && up.tier !== "free" && ["active", "trialing"].includes(String(up.status || "active"))) return { tier: up.tier, limits: LIMITS[up.tier as Tier], source: "stripe" };
  const { data: prof } = await db.from("profiles").select("created_at").eq("id", userId).maybeSingle();
  if (prof?.created_at && new Date(prof.created_at).getTime() + 7 * 86_400_000 > now) return { tier: "trial", limits: LIMITS.trial, source: "trial" };
  return { tier: "free", limits: LIMITS.free, source: "none" };
}

/** New leads this user has had found since the start of the current month (UK time). */
export async function leadsUsedThisMonth(db: any, userId: string): Promise<number> {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", year: "numeric", month: "2-digit" }).formatToParts(new Date());
  const y = parts.find((p) => p.type === "year")!.value, m = parts.find((p) => p.type === "month")!.value;
  const start = new Date(`${y}-${m}-01T00:00:00Z`).toISOString();
  const { count } = await db.from("autonomous_leads").select("id", { count: "exact", head: true })
    .eq("user_id", userId).gte("created_at", start).neq("source", "curated");
  return count || 0;
}
