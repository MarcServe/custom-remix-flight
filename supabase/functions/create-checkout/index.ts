import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Plans are looked up by Stripe lookup_key: lb_<plan>_<monthly|yearly>
const PLANS = ["crm", "autopilot", "autopilot_pro", "agency"] as const;
const TRIAL_DAYS = 7;

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CREATE-CHECKOUT] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? ""
  );

  try {
    logStep("Function started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");
    logStep("Stripe key verified");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");

    const token = authHeader.replace("Bearer ", "");
    const { data, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    const user = data.user;
    if (!user?.email) throw new Error("User not authenticated or email not available");
    logStep("User authenticated", { userId: user.id, email: user.email });

    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });

    const reqBody = await req.json().catch(() => ({}));
    const plan = (PLANS as readonly string[]).includes(reqBody?.plan) ? reqBody.plan : "autopilot";
    const interval = reqBody?.interval === "yearly" ? "yearly" : "monthly";
    const lookupKey = `lb_${plan}_${interval}`;
    const prices = await stripe.prices.list({ lookup_keys: [lookupKey], active: true, limit: 1 });
    const PRICE_ID = prices.data[0]?.id;
    if (!PRICE_ID) throw new Error(`No active price for ${lookupKey}`);
    logStep("Plan selected", { plan, interval, priceId: PRICE_ID });

    // Reuse existing Stripe customer if one exists
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    let customerId: string | undefined;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
      logStep("Found existing customer", { customerId });
    } else {
      logStep("No existing customer found — will create on checkout");
    }

    // Only offer trial to brand-new customers who have never had a subscription
    let trialDays: number | undefined = TRIAL_DAYS;
    if (customerId) {
      const existingSubs = await stripe.subscriptions.list({
        customer: customerId,
        limit: 1,
        status: "all", // includes canceled, past_due, etc.
      });
      if (existingSubs.data.length > 0) {
        trialDays = undefined;
        logStep("Returning subscriber — skipping trial", { customerId });
      } else {
        logStep("New customer — applying trial", { trialDays });
      }
    }

    const origin = req.headers.get("origin") || "https://leadboosters.bizboosters.co.uk";

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      line_items: [{ price: PRICE_ID, quantity: 1 }],
      mode: "subscription",
      subscription_data: {
        ...(trialDays ? { trial_period_days: trialDays } : {}),
        metadata: { user_id: user.id, app: "leadboosters", plan },
      },
      allow_promotion_codes: true,
      success_url: `${origin}/subscription?success=true`,
      cancel_url: `${origin}/subscription?canceled=true`,
    });

    logStep("Checkout session created", { sessionId: session.id });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in create-checkout", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
