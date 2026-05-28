import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CUSTOMER-PORTAL] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");
    logStep("Stripe key verified");

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");
    logStep("Authorization header found");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    const user = userData.user;
    if (!user?.email) throw new Error("User not authenticated or email not available");
    logStep("User authenticated", { userId: user.id, email: user.email });

    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    if (customers.data.length === 0) {
      throw new Error("No Stripe customer found for this user");
    }
    const customerId = customers.data[0].id;
    logStep("Found Stripe customer", { customerId });

    // Find the LeadBoosters subscription specifically so the portal
    // opens focused on it (not unrelated subscriptions on the same customer)
    const LEADBOOSTERS_PRICE_ID = "price_1TZECTP8zypO5fiCk3voBln5";
    const allSubs = await stripe.subscriptions.list({ customer: customerId, status: "all", limit: 10 });
    const leadBoostersSub = allSubs.data.find(s =>
      s.items.data.some(i => i.price.id === LEADBOOSTERS_PRICE_ID)
    );
    logStep("LeadBoosters subscription", { found: !!leadBoostersSub, id: leadBoostersSub?.id });

    const origin = req.headers.get("origin") || "https://leadgenie.bizboosters.co.uk";

    // If we found the specific LeadBoosters subscription, direct the portal
    // to the subscription update flow so only that plan is shown prominently
    const portalParams: any = {
      customer: customerId,
      return_url: `${origin}/subscription`,
    };
    if (leadBoostersSub) {
      portalParams.flow_data = {
        type: "subscription_update",
        subscription_update: { subscription: leadBoostersSub.id },
      };
    }

    const portalSession = await stripe.billingPortal.sessions.create(portalParams);
    logStep("Customer portal session created", { sessionId: portalSession.id, url: portalSession.url });

    return new Response(JSON.stringify({ url: portalSession.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in customer-portal", { message: errorMessage });
    return new Response(JSON.stringify({ error: "Failed to open billing portal" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
