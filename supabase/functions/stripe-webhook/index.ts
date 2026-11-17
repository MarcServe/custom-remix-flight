import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { tierForStripe } from "../_shared/plans.ts";

const logStep = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[STRIPE-WEBHOOK] ${step}${detailsStr}`);
};

serve(async (req) => {
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");

  if (!webhookSecret || !stripeKey) {
    console.error("Missing STRIPE_WEBHOOK_SECRET or STRIPE_SECRET_KEY");
    return new Response("Webhook not configured", { status: 500 });
  }

  const sig = req.headers.get("stripe-signature");
  if (!sig) {
    return new Response("Missing stripe-signature header", { status: 400 });
  }

  const body = await req.text();

  let event: Stripe.Event;
  try {
    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    event = await stripe.webhooks.constructEventAsync(body, sig, webhookSecret);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Invalid signature";
    console.error("Webhook signature verification failed:", msg);
    return new Response(`Webhook Error: ${msg}`, { status: 400 });
  }

  logStep("Event received", { type: event.type, id: event.id });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    switch (event.type) {
      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        logStep("Subscription upsert", { subId: sub.id, status: sub.status });

        // Record LeadBoosters plans only (the Stripe account is shared with other products).
        const price: any = sub.items?.data?.[0]?.price;
        const tier = tierForStripe(price);
        const userId = (sub.metadata as any)?.user_id;
        if (tier && userId) {
          const end = (sub as any).current_period_end ?? (sub as any).items?.data?.[0]?.current_period_end;
          const live = sub.status === "active" || sub.status === "trialing";
          const { error } = await supabase.from("user_plans").upsert({
            user_id: userId, tier: live ? tier : "free", stripe_customer_id: String(sub.customer), stripe_subscription_id: sub.id,
            product_id: typeof price.product === "string" ? price.product : price.product?.id, price_id: price.id, status: sub.status,
            current_period_end: end ? new Date(end * 1000).toISOString() : null, updated_at: new Date().toISOString(),
          }, { onConflict: "user_id" });
          if (error) logStep("user_plans upsert failed", { error: error.message });
        } else {
          logStep("Not a LeadBoosters subscription or no user_id; skipped", { tier, userId });
        }
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        logStep("Subscription cancelled", { subId: sub.id, customer: sub.customer });

        const { error } = await supabase.from("user_plans")
          .update({ tier: "free", status: "canceled", updated_at: new Date().toISOString() })
          .eq("stripe_subscription_id", sub.id);
        if (error) logStep("Cancel update failed", { error: error.message });
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        logStep("Payment failed", { customer: invoice.customer, invoiceId: invoice.id });

        // Stripe retries failed payments; the subscription moves to past_due and then fires
        // customer.subscription.updated/deleted, which update the plan. Only log here.
        logStep("Payment failed; awaiting subscription status change", { customer: invoice.customer });
        break;
      }

      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode === "subscription") {
          logStep("Subscription checkout completed", { sessionId: session.id, customer: session.customer });
          // Subscription events will follow via customer.subscription.created
        }
        break;
      }

      default:
        logStep("Unhandled event type", { type: event.type });
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logStep("Error processing event", { message: msg });
    // Still return 200 to prevent Stripe retries for non-critical processing errors
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { "Content-Type": "application/json" },
    status: 200,
  });
});
