import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { tierForStripe, better, getUserPlan, LIMITS, type Tier } from "../_shared/plans.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CHECK-SUBSCRIPTION] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    logStep("Function started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");
    logStep("Stripe key verified");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");
    logStep("Authorization header found");

    const token = authHeader.replace("Bearer ", "");
    logStep("Authenticating user with token");
    
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    const user = userData.user;
    if (!user?.email) throw new Error("User not authenticated or email not available");
    logStep("User authenticated", { userId: user.id, email: user.email });

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // The Stripe account is shared with other Biz Boosters products (ROUT£, GrantsCopilot,
    // Securar…): only LeadBoosters subscriptions count, and the best one wins.
    const customers = await stripe.customers.list({ email: user.email, limit: 10 });
    let tier: Tier = "free";
    let best: { sub: any; price: any } | null = null;
    for (const c of customers.data) {
      for (const status of ["active", "trialing"] as const) {
        const subs = await stripe.subscriptions.list({ customer: c.id, status, limit: 20, expand: ["data.items.data.price"] });
        for (const sub of subs.data) {
          const price: any = sub.items?.data?.[0]?.price;
          const t = tierForStripe(price);
          if (!t) continue;
          if (!best || better(tier, t) !== tier) { tier = better(tier, t); best = { sub, price }; }
        }
      }
    }
    logStep("LeadBoosters plan resolved", { tier, subscriptionId: best?.sub?.id });

    const periodEnd = best?.sub ? ((best.sub as any).current_period_end ?? (best.sub as any).items?.data?.[0]?.current_period_end) : null;
    const subscriptionEnd = periodEnd ? new Date(periodEnd * 1000).toISOString() : null;
    const productId = best ? (typeof best.price.product === "string" ? best.price.product : best.price.product?.id) : null;


    await supabaseClient.from("user_plans").upsert({
      user_id: user.id, tier, stripe_customer_id: best ? String(best.sub.customer) : (customers.data[0]?.id ?? null),
      stripe_subscription_id: best?.sub?.id ?? null, product_id: productId, price_id: best?.price?.id ?? null,
      status: best?.sub?.status ?? null, current_period_end: subscriptionEnd, updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" });

    // Manual grants (owner, partners, comped accounts) override what Stripe says.
    const plan = await getUserPlan(supabaseClient, user.id);
    const effective = plan.source === "override" ? plan.tier : tier;

    return new Response(JSON.stringify({
      subscribed: effective !== "free" && effective !== "trial",
      tier: effective,
      plan_source: plan.source === "override" ? "override" : (best ? "stripe" : "none"),
      limits: plan.source === "override" ? plan.limits : LIMITS[tier],
      product_id: productId,
      subscription_end: subscriptionEnd,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in check-subscription", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
