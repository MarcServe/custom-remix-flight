-- In-app notifications that actually fire. One table, filled by database
-- triggers (so it does not matter which function or client wrote the row),
-- delivered live through realtime, read state kept server-side.

CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  type text NOT NULL,                 -- email_reply | sms_reply | sms_opt_out | campaign_done | newsletter_sent | sequence_reply | sequence_click | bounce | lead_search_done
  title text NOT NULL,
  body text,
  link text,                          -- in-app path to open
  entity_type text,
  entity_id text,
  metadata jsonb,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS notifications_user_created_idx ON public.notifications (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS notifications_unread_idx ON public.notifications (user_id) WHERE read_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS notifications_dedupe_idx ON public.notifications (user_id, type, entity_id) WHERE entity_id IS NOT NULL;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "notifications_owner" ON public.notifications;
CREATE POLICY "notifications_owner" ON public.notifications
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Realtime: notifications, plus the tables the sidebar/pages already subscribe to
-- but which were never published (so those subscriptions silently did nothing).
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['notifications','deals','events','email_campaigns','company_sequences','newsletters','email_activities']
  LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END $$;

-- Insert helper (ignores duplicates for the same entity)
CREATE OR REPLACE FUNCTION public.notify_user(
  p_user_id uuid, p_type text, p_title text, p_body text, p_link text, p_entity_type text, p_entity_id text, p_metadata jsonb DEFAULT NULL
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF p_user_id IS NULL THEN RETURN; END IF;
  INSERT INTO public.notifications (user_id, type, title, body, link, entity_type, entity_id, metadata)
  VALUES (p_user_id, p_type, left(p_title, 200), left(p_body, 500), p_link, p_entity_type, p_entity_id, p_metadata)
  ON CONFLICT DO NOTHING;
END $$;

-- Who owns an email thread? Sequence → company owner; otherwise the user whose
-- sender address received it; otherwise, if there is a single account with an
-- email sender connected, that account.
CREATE OR REPLACE FUNCTION public.email_thread_owner(p_company_sequence_id uuid, p_to_email text)
RETURNS uuid LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v uuid; addr text := lower(coalesce(p_to_email, ''));
BEGIN
  IF p_company_sequence_id IS NOT NULL THEN
    SELECT c.user_id INTO v FROM company_sequences cs JOIN companies c ON c.id = cs.company_id WHERE cs.id = p_company_sequence_id;
    IF v IS NOT NULL THEN RETURN v; END IF;
  END IF;
  IF addr <> '' THEN
    SELECT user_id INTO v FROM crm_connections WHERE lower(coalesce(from_email,'')) = addr ORDER BY (status = 'active') DESC LIMIT 1;
    IF v IS NOT NULL THEN RETURN v; END IF;
    SELECT user_id INTO v FROM business_profiles WHERE lower(coalesce(email_sender_email,'')) = addr LIMIT 1;
    IF v IS NOT NULL THEN RETURN v; END IF;
    SELECT id INTO v FROM profiles WHERE lower(coalesce(email,'')) = addr LIMIT 1;
    IF v IS NOT NULL THEN RETURN v; END IF;
  END IF;
  SELECT user_id INTO v FROM crm_connections WHERE status = 'active' AND provider NOT IN ('twilio','vonage','messagebird','plivo')
    GROUP BY user_id HAVING count(*) > 0;
  -- only when exactly one such account exists
  IF (SELECT count(DISTINCT user_id) FROM crm_connections WHERE status = 'active' AND provider NOT IN ('twilio','vonage','messagebird','plivo')) = 1 THEN RETURN v; END IF;
  RETURN NULL;
END $$;

-- 1) Inbound email → "Reply from …"
CREATE OR REPLACE FUNCTION public.trg_notify_email_thread() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid; who text;
BEGIN
  IF NEW.direction IS DISTINCT FROM 'inbound' THEN RETURN NEW; END IF;
  uid := public.email_thread_owner(NEW.company_sequence_id, NEW.to_email);
  who := coalesce(NEW.from_email, 'someone');
  PERFORM public.notify_user(uid, 'email_reply', 'Reply from ' || who,
    coalesce(NEW.subject, left(NEW.body_text, 120)),
    CASE WHEN NEW.company_sequence_id IS NOT NULL THEN '/conversations?sequence=' || NEW.company_sequence_id ELSE '/conversations?tab=personal' END,
    'email_thread', NEW.id::text, jsonb_build_object('from', NEW.from_email, 'thread_id', NEW.thread_id));
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS notify_email_thread ON public.email_threads;
CREATE TRIGGER notify_email_thread AFTER INSERT ON public.email_threads FOR EACH ROW EXECUTE FUNCTION public.trg_notify_email_thread();

-- 2) Inbound text → "Text from …" (STOP gets its own type)
CREATE OR REPLACE FUNCTION public.trg_notify_sms() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.direction <> 'inbound' THEN RETURN NEW; END IF;
  IF coalesce((NEW.metadata->>'opt_out')::boolean, false) THEN
    PERFORM public.notify_user(NEW.user_id, 'sms_opt_out', (coalesce(NEW.contact_name, NEW.counterparty)) || ' opted out of texts', 'They replied STOP; campaigns will skip this number.', '/conversations?tab=texts', 'sms_message', NEW.id::text, jsonb_build_object('phone', NEW.counterparty));
  ELSE
    PERFORM public.notify_user(NEW.user_id, 'sms_reply', 'Text from ' || coalesce(NEW.contact_name, NEW.counterparty), left(NEW.body, 160), '/conversations?tab=texts', 'sms_message', NEW.id::text, jsonb_build_object('phone', NEW.counterparty, 'campaign_id', NEW.campaign_id));
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS notify_sms ON public.sms_messages;
CREATE TRIGGER notify_sms AFTER INSERT ON public.sms_messages FOR EACH ROW EXECUTE FUNCTION public.trg_notify_sms();

-- 3) Campaign finished (email or SMS)
CREATE OR REPLACE FUNCTION public.trg_notify_campaign_done() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'completed' AND coalesce(OLD.status, '') <> 'completed' AND coalesce(NEW.sent_count, 0) + coalesce(NEW.failed_count, 0) > 0 THEN
    PERFORM public.notify_user(NEW.user_id, 'campaign_done', 'Campaign finished: ' || NEW.name,
      coalesce(NEW.sent_count, 0) || ' sent' || CASE WHEN coalesce(NEW.failed_count, 0) > 0 THEN ', ' || NEW.failed_count || ' failed' ELSE '' END,
      '/campaigns', 'campaign', NEW.id::text, jsonb_build_object('sent', NEW.sent_count, 'failed', NEW.failed_count));
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS notify_campaign_done ON public.email_campaigns;
CREATE TRIGGER notify_campaign_done AFTER UPDATE OF status ON public.email_campaigns FOR EACH ROW EXECUTE FUNCTION public.trg_notify_campaign_done();

-- 4) Newsletter sent
CREATE OR REPLACE FUNCTION public.trg_notify_newsletter_sent() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'sent' AND coalesce(OLD.status, '') <> 'sent' THEN
    PERFORM public.notify_user(NEW.user_id, 'newsletter_sent', 'Newsletter sent: ' || coalesce(NEW.title, NEW.subject),
      coalesce(NEW.total_sent, NEW.total_recipients, 0) || ' recipients', '/newsletters', 'newsletter', NEW.id::text, NULL);
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS notify_newsletter_sent ON public.newsletters;
CREATE TRIGGER notify_newsletter_sent AFTER UPDATE OF status ON public.newsletters FOR EACH ROW EXECUTE FUNCTION public.trg_notify_newsletter_sent();

-- 5) Sequence engagement: reply, click, bounce (opens are too noisy to notify)
CREATE OR REPLACE FUNCTION public.trg_notify_activity() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid; cname text;
BEGIN
  IF NEW.company_sequence_id IS NULL THEN RETURN NEW; END IF;
  SELECT c.user_id, c.name INTO uid, cname FROM company_sequences cs JOIN companies c ON c.id = cs.company_id WHERE cs.id = NEW.company_sequence_id;
  IF uid IS NULL THEN RETURN NEW; END IF;
  IF NEW.replied_at IS NOT NULL AND OLD.replied_at IS NULL THEN
    PERFORM public.notify_user(uid, 'sequence_reply', coalesce(cname, 'A contact') || ' replied', NEW.subject, '/conversations?sequence=' || NEW.company_sequence_id, 'email_activity', NEW.id::text || ':reply', NULL);
  ELSIF coalesce((NEW.metadata->>'clicked')::boolean, false) AND NOT coalesce((OLD.metadata->>'clicked')::boolean, false) THEN
    PERFORM public.notify_user(uid, 'sequence_click', coalesce(cname, 'A contact') || ' clicked a link', NEW.subject, '/conversations?sequence=' || NEW.company_sequence_id, 'email_activity', NEW.id::text || ':click', NULL);
  ELSIF NEW.status = 'bounced' AND coalesce(OLD.status, '') <> 'bounced' THEN
    PERFORM public.notify_user(uid, 'bounce', 'Email to ' || coalesce(cname, 'a contact') || ' bounced', NEW.subject, '/email-deliverability', 'email_activity', NEW.id::text || ':bounce', NULL);
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS notify_activity ON public.email_activities;
CREATE TRIGGER notify_activity AFTER UPDATE ON public.email_activities FOR EACH ROW EXECUTE FUNCTION public.trg_notify_activity();

-- 6) Lead search finished
CREATE OR REPLACE FUNCTION public.trg_notify_lead_search() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status IN ('complete', 'completed') AND coalesce(OLD.status, '') NOT IN ('complete', 'completed') THEN
    PERFORM public.notify_user(NEW.user_id, 'lead_search_done', 'Lead search finished',
      coalesce((NEW.stats->>'total_leads'), (NEW.stats->>'leads'), (NEW.stats->>'found'), '') || CASE WHEN coalesce(NEW.stats->>'total_leads', NEW.stats->>'leads', NEW.stats->>'found') IS NOT NULL THEN ' leads found' ELSE 'Open Lead Finder to review the results' END,
      '/lead-finder', 'lead_search', NEW.id::text, NULL);
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS notify_lead_search ON public.lead_finder_searches;
CREATE TRIGGER notify_lead_search AFTER UPDATE OF status ON public.lead_finder_searches FOR EACH ROW EXECUTE FUNCTION public.trg_notify_lead_search();

-- Backfill: replies received in the last 30 days, so the bell isn't empty on day one.
INSERT INTO public.notifications (user_id, type, title, body, link, entity_type, entity_id, metadata, created_at)
SELECT public.email_thread_owner(t.company_sequence_id, t.to_email), 'email_reply', 'Reply from ' || coalesce(t.from_email, 'someone'),
       coalesce(t.subject, left(t.body_text, 120)),
       CASE WHEN t.company_sequence_id IS NOT NULL THEN '/conversations?sequence=' || t.company_sequence_id ELSE '/conversations?tab=personal' END,
       'email_thread', t.id::text, jsonb_build_object('from', t.from_email, 'thread_id', t.thread_id, 'backfill', true), coalesce(t.received_at, t.created_at)
FROM public.email_threads t
WHERE t.direction = 'inbound' AND coalesce(t.received_at, t.created_at) > now() - interval '30 days'
  AND public.email_thread_owner(t.company_sequence_id, t.to_email) IS NOT NULL
ON CONFLICT DO NOTHING;
