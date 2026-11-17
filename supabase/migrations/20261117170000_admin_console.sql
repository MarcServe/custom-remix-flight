-- Platform admin console: who may use it, and plan limits editable without a deploy.
CREATE TABLE IF NOT EXISTS public.platform_admins (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.platform_admins ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins see themselves" ON public.platform_admins;
CREATE POLICY "Admins see themselves" ON public.platform_admins FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.plan_limits (
  tier text PRIMARY KEY,
  autopilot boolean NOT NULL,
  leads_per_month integer NOT NULL CHECK (leads_per_month >= 0),
  personas integer NOT NULL CHECK (personas >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);
ALTER TABLE public.plan_limits ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone signed in can read plan limits" ON public.plan_limits;
CREATE POLICY "Anyone signed in can read plan limits" ON public.plan_limits FOR SELECT TO authenticated USING (true);

INSERT INTO public.plan_limits (tier, autopilot, leads_per_month, personas) VALUES
  ('free', false, 0, 0), ('individual', false, 0, 0), ('pro', false, 100, 0), ('crm', false, 100, 0),
  ('trial', true, 100, 1), ('autopilot', true, 500, 1), ('autopilot_pro', true, 2000, 3),
  ('agency', true, 10000, 20), ('legacy_full', true, 2000, 3)
ON CONFLICT (tier) DO NOTHING;

-- Admin action log
CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL,
  action text NOT NULL,
  details jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;
