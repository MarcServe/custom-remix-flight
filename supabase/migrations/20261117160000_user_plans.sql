-- LeadBoosters plans (Nov 2026): CRM £29, Autopilot £99, Autopilot Pro £249, Agency £499.
-- user_plans: the plan Stripe says each user is on (written by check-subscription and the
-- Stripe webhook). plan_overrides: manual grants (owner, partners, comped accounts) that win.
CREATE TABLE IF NOT EXISTS public.user_plans (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  tier text NOT NULL DEFAULT 'free',
  stripe_customer_id text,
  stripe_subscription_id text,
  product_id text,
  price_id text,
  status text,
  current_period_end timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.user_plans ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users read own plan" ON public.user_plans;
CREATE POLICY "Users read own plan" ON public.user_plans FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.plan_overrides (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  tier text NOT NULL,
  note text,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.plan_overrides ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users read own override" ON public.plan_overrides;
CREATE POLICY "Users read own override" ON public.plan_overrides FOR SELECT TO authenticated USING (user_id = auth.uid());
