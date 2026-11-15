-- Two-way SMS: every text in and out, threaded by the other party's number,
-- plus STOP opt-outs that every campaign must respect.

CREATE TABLE IF NOT EXISTS public.sms_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  connection_id uuid REFERENCES public.crm_connections(id) ON DELETE SET NULL,
  direction text NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  counterparty text NOT NULL,            -- E.164 of the customer
  from_number text NOT NULL,
  to_number text NOT NULL,
  body text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'received', -- received | sent | failed | queued
  provider text,
  provider_sid text,
  campaign_id uuid REFERENCES public.email_campaigns(id) ON DELETE SET NULL,
  campaign_recipient_id uuid REFERENCES public.email_campaign_recipients(id) ON DELETE SET NULL,
  person_id uuid REFERENCES public.people(id) ON DELETE SET NULL,
  contact_name text,
  read_at timestamptz,
  error_message text,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS sms_messages_provider_sid_uq ON public.sms_messages (provider_sid) WHERE provider_sid IS NOT NULL;
CREATE INDEX IF NOT EXISTS sms_messages_thread_idx ON public.sms_messages (user_id, counterparty, created_at DESC);
CREATE INDEX IF NOT EXISTS sms_messages_unread_idx ON public.sms_messages (user_id, created_at DESC) WHERE direction = 'inbound' AND read_at IS NULL;

ALTER TABLE public.sms_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sms_messages_owner" ON public.sms_messages;
CREATE POLICY "sms_messages_owner" ON public.sms_messages
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.sms_opt_outs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  phone text NOT NULL,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, phone)
);
ALTER TABLE public.sms_opt_outs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sms_opt_outs_owner" ON public.sms_opt_outs;
CREATE POLICY "sms_opt_outs_owner" ON public.sms_opt_outs
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Live updates in Conversations
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'sms_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.sms_messages;
  END IF;
END $$;
