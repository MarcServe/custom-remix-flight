-- Scheduled AI automations: a plain-English job, a schedule, and a server-side
-- runner that executes it with the same tools the MCP server exposes.

CREATE TABLE IF NOT EXISTS public.ai_automations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  instruction text NOT NULL,
  schedule_kind text NOT NULL DEFAULT 'daily' CHECK (schedule_kind IN ('hourly', 'daily', 'weekdays', 'weekly')),
  time_of_day text NOT NULL DEFAULT '08:00',          -- HH:MM in `timezone`
  days_of_week int[] NOT NULL DEFAULT '{1}',          -- for weekly: 0=Sun … 6=Sat
  timezone text NOT NULL DEFAULT 'Europe/London',
  enabled boolean NOT NULL DEFAULT true,
  allow_sending boolean NOT NULL DEFAULT false,       -- false = drafts only; send_* tools are withheld
  model text,
  next_run_at timestamptz,
  last_run_at timestamptz,
  last_status text,                                   -- success | failed | running
  last_summary text,
  running_since timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ai_automations_due_idx ON public.ai_automations (next_run_at) WHERE enabled;
ALTER TABLE public.ai_automations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ai_automations_owner" ON public.ai_automations;
CREATE POLICY "ai_automations_owner" ON public.ai_automations FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.ai_automation_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_id uuid NOT NULL REFERENCES public.ai_automations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  status text NOT NULL DEFAULT 'running',             -- running | success | failed
  trigger text NOT NULL DEFAULT 'schedule',           -- schedule | manual | api
  summary text,
  steps jsonb NOT NULL DEFAULT '[]'::jsonb,           -- [{tool, args, ok, result}]
  error text,
  model text,
  tokens_in int, tokens_out int
);
CREATE INDEX IF NOT EXISTS ai_automation_runs_auto_idx ON public.ai_automation_runs (automation_id, started_at DESC);
ALTER TABLE public.ai_automation_runs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ai_automation_runs_owner" ON public.ai_automation_runs;
CREATE POLICY "ai_automation_runs_owner" ON public.ai_automation_runs FOR SELECT USING (auth.uid() = user_id);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'ai_automation_runs') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.ai_automation_runs;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'ai_automations') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.ai_automations;
  END IF;
END $$;

-- Tick every 15 minutes; the runner picks up whatever is due.
DO $$ BEGIN PERFORM cron.unschedule('run-ai-automations'); EXCEPTION WHEN OTHERS THEN NULL; END $$;
SELECT cron.schedule(
  'run-ai-automations',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_project_url' LIMIT 1) || '/functions/v1/cron-trigger',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || COALESCE((SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_service_role_key' LIMIT 1), '')
    ),
    body := '{"action": "run-ai-automations"}'::jsonb
  );
  $$
);
