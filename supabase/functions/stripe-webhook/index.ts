import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

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
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
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

        const { error } = await supabase.from("subscribers").upsert(
          {
            stripe_customer_id: sub.customer as string,
            stripe_subscription_id: sub.id,
            subscribed: sub.status === "active" || sub.status === "trialing",
            subscription_tier: "premium",
            subscription_end: new Date(
              (sub as unknown as { current_period_end: number }).current_period_end * 1000
            ).toISOString(),
            updated_at: new Date().toISOString(),
          },
          { onConflict: "stripe_customer_id" }
        );

        if (error) {
          logStep("Upsert failed — no subscribers table, logging only", { error: error.message });
          // Non-fatal: check-subscription queries Stripe live anyway
        }
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        logStep("Subscription cancelled", { subId: sub.id, customer: sub.customer });

        const { error } = await supabase
          .from("subscribers")
          .update({ subscribed: false, updated_at: new Date().toISOString() })
          .eq("stripe_customer_id", sub.customer as string);

        if (error) {
          logStep("Cancel update failed — no subscribers table, logging only", { error: error.message });
        }
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        logStep("Payment failed", { customer: invoice.customer, invoiceId: invoice.id });

        const { error } = await supabase
          .from("subscribers")
          .update({ subscribed: false, updated_at: new Date().toISOString() })
          .eq("stripe_customer_id", invoice.customer as string);

        if (error) {
          logStep("Payment-failed update failed — no subscribers table, logging only", { error: error.message });
        }
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
