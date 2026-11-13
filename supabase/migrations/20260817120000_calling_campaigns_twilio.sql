-- Human-assisted calling + SMS campaigns (Twilio).
-- First version: click-to-call, SMS/email follow-ups, suppression, Work API.
-- Does NOT add automated AI cold-calling or bulk cold SMS.

-- ── Campaigns ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.calling_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  product text NOT NULL DEFAULT 'TalkStay'
    CHECK (product IN ('TalkStay', 'TalkWeb', 'GrantsCopilot', 'other')),
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'ready', 'active', 'paused', 'completed')),
  script text,
  sms_template text,
  email_followup_subject text,
  email_followup_body text,
  connection_id uuid REFERENCES public.crm_connections(id) ON DELETE SET NULL,
  caller_phone text,
  assigned_caller text,
  notes text,
  max_queue_size integer NOT NULL DEFAULT 20,
  started_at timestamptz,
  paused_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS calling_campaigns_user_id_idx
  ON public.calling_campaigns(user_id, created_at DESC);

-- ── Queue ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.calling_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.calling_campaigns(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
  person_id uuid REFERENCES public.people(id) ON DELETE SET NULL,
  contact_name text,
  company_name text,
  phone text NOT NULL,
  email text,
  queue_position integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN (
      'pending', 'blocked', 'calling', 'completed', 'skipped'
    )),
  outcome text
    CHECK (outcome IS NULL OR outcome IN (
      'interested', 'send_demo', 'call_back', 'not_right_person',
      'not_interested', 'no_answer', 'invalid_number', 'do_not_call'
    )),
  tps_status text NOT NULL DEFAULT 'unknown'
    CHECK (tps_status IN ('unknown', 'clear', 'listed', 'pending')),
  ctps_status text NOT NULL DEFAULT 'unknown'
    CHECK (ctps_status IN ('unknown', 'clear', 'listed', 'pending')),
  sms_consent boolean NOT NULL DEFAULT false,
  follow_up_at timestamptz,
  notes text,
  last_called_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS calling_queue_campaign_idx
  ON public.calling_queue(campaign_id, queue_position);
CREATE INDEX IF NOT EXISTS calling_queue_user_status_idx
  ON public.calling_queue(user_id, status);
CREATE INDEX IF NOT EXISTS calling_queue_phone_idx
  ON public.calling_queue(user_id, phone);

-- ── Call logs ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.call_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  campaign_id uuid REFERENCES public.calling_campaigns(id) ON DELETE SET NULL,
  queue_item_id uuid REFERENCES public.calling_queue(id) ON DELETE SET NULL,
  company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
  twilio_call_sid text,
  direction text NOT NULL DEFAULT 'outbound'
    CHECK (direction IN ('outbound', 'inbound')),
  from_number text,
  to_number text,
  status text NOT NULL DEFAULT 'initiated',
  duration_seconds integer,
  recording_url text,
  error_message text,
  raw_payload jsonb,
  started_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS call_logs_user_idx ON public.call_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS call_logs_sid_idx ON public.call_logs(twilio_call_sid);
CREATE INDEX IF NOT EXISTS call_logs_queue_idx ON public.call_logs(queue_item_id);

-- ── SMS messages ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.sms_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  campaign_id uuid REFERENCES public.calling_campaigns(id) ON DELETE SET NULL,
  queue_item_id uuid REFERENCES public.calling_queue(id) ON DELETE SET NULL,
  company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
  twilio_message_sid text,
  direction text NOT NULL DEFAULT 'outbound'
    CHECK (direction IN ('outbound', 'inbound')),
  from_number text,
  to_number text,
  body text NOT NULL,
  status text NOT NULL DEFAULT 'queued',
  error_message text,
  raw_payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sms_messages_user_idx ON public.sms_messages(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS sms_messages_sid_idx ON public.sms_messages(twilio_message_sid);
CREATE INDEX IF NOT EXISTS sms_messages_queue_idx ON public.sms_messages(queue_item_id);

-- ── Suppression (DNC / TPS / CTPS / SMS opt-out) ─────────────────────────────
CREATE TABLE IF NOT EXISTS public.suppression_list (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  phone text NOT NULL,
  email text,
  reason text NOT NULL
    CHECK (reason IN ('dnc', 'tps', 'ctps', 'sms_opt_out', 'invalid', 'user_added')),
  source text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, phone, reason)
);

CREATE INDEX IF NOT EXISTS suppression_list_user_phone_idx
  ON public.suppression_list(user_id, phone);

-- ── RLS ──────────────────────────────────────────────────────────────────────
ALTER TABLE public.calling_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calling_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.call_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sms_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppression_list ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own calling campaigns"
  ON public.calling_campaigns FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users manage own calling queue"
  ON public.calling_queue FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users manage own call logs"
  ON public.call_logs FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users manage own sms messages"
  ON public.sms_messages FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users manage own suppression list"
  ON public.suppression_list FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS calling_campaigns_updated_at ON public.calling_campaigns;
CREATE TRIGGER calling_campaigns_updated_at
  BEFORE UPDATE ON public.calling_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS calling_queue_updated_at ON public.calling_queue;
CREATE TRIGGER calling_queue_updated_at
  BEFORE UPDATE ON public.calling_queue
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
