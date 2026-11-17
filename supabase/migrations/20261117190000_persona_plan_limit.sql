-- Persona limit by plan, enforced in the database so it holds for the app, the API and the AI connection.
-- Everyone may keep 1 active persona (the AI email writer uses it); Autopilot plans allow more (plan_limits.personas).
CREATE OR REPLACE FUNCTION public.effective_plan_tier(uid uuid) RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(
    (SELECT tier FROM public.plan_overrides WHERE user_id = uid AND (expires_at IS NULL OR expires_at > now())),
    (SELECT tier FROM public.user_plans WHERE user_id = uid AND tier <> 'free' AND COALESCE(status, 'active') IN ('active', 'trialing')),
    (SELECT 'trial' FROM public.profiles WHERE id = uid AND created_at + interval '7 days' > now()),
    'free');
$$;
REVOKE ALL ON FUNCTION public.effective_plan_tier(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.enforce_persona_plan_limit() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE allowed integer; active_others integer;
BEGIN
  IF NEW.is_active IS TRUE AND (TG_OP = 'INSERT' OR OLD.is_active IS DISTINCT FROM TRUE) THEN
    SELECT GREATEST(1, COALESCE((SELECT personas FROM public.plan_limits WHERE tier = public.effective_plan_tier(NEW.user_id)), 1)) INTO allowed;
    SELECT count(*) INTO active_others FROM public.discovery_personas WHERE user_id = NEW.user_id AND is_active AND id <> NEW.id;
    IF active_others >= allowed THEN
      RAISE EXCEPTION 'Your plan allows % active persona%. Pause another persona first, or upgrade your plan for more.', allowed, CASE WHEN allowed = 1 THEN '' ELSE 's' END
        USING ERRCODE = 'P0001';
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_persona_plan_limit ON public.discovery_personas;
CREATE TRIGGER trg_persona_plan_limit BEFORE INSERT OR UPDATE OF is_active ON public.discovery_personas
  FOR EACH ROW EXECUTE FUNCTION public.enforce_persona_plan_limit();
