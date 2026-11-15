-- Better attribution of inbound email threads to a LeadBoosters account.
-- Replies arrive at the shared Resend inbound address (not a per-user address),
-- so match on who we wrote to (campaign recipients / people / subscribers) and on
-- the app's own addresses; never attribute mail addressed to other systems.

CREATE OR REPLACE FUNCTION public.email_thread_owner(p_company_sequence_id uuid, p_to_email text)
RETURNS uuid LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v uuid; addr text := lower(coalesce(p_to_email, ''));
BEGIN
  IF p_company_sequence_id IS NOT NULL THEN
    SELECT c.user_id INTO v FROM company_sequences cs JOIN companies c ON c.id = cs.company_id WHERE cs.id = p_company_sequence_id;
    IF v IS NOT NULL THEN RETURN v; END IF;
  END IF;
  IF addr = '' THEN RETURN NULL; END IF;
  -- A user's own sender/profile address received it → that user.
  SELECT user_id INTO v FROM crm_connections WHERE lower(coalesce(from_email,'')) = addr ORDER BY (status = 'active') DESC LIMIT 1;
  IF v IS NOT NULL THEN RETURN v; END IF;
  SELECT user_id INTO v FROM business_profiles WHERE lower(coalesce(email_sender_email,'')) = addr LIMIT 1;
  IF v IS NOT NULL THEN RETURN v; END IF;
  SELECT id INTO v FROM profiles WHERE lower(coalesce(email,'')) = addr LIMIT 1;
  IF v IS NOT NULL THEN RETURN v; END IF;
  -- The app's shared reply address: owned by the (single) account that sends campaigns.
  IF addr = 'leadgenie@eldapgraaa.resend.app' THEN
    IF (SELECT count(DISTINCT user_id) FROM email_campaigns) = 1 THEN
      SELECT user_id INTO v FROM email_campaigns LIMIT 1; RETURN v;
    END IF;
  END IF;
  RETURN NULL;
END $$;

-- Owner by sender: did any account write to this address? (campaign recipient, CRM person, subscriber)
CREATE OR REPLACE FUNCTION public.email_thread_owner_by_sender(p_from_email text)
RETURNS uuid LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v uuid; f text := lower(coalesce(p_from_email, ''));
BEGIN
  IF f = '' THEN RETURN NULL; END IF;
  SELECT c.user_id INTO v FROM email_campaign_recipients r JOIN email_campaigns c ON c.id = r.campaign_id WHERE lower(r.email) = f ORDER BY r.created_at DESC LIMIT 1;
  IF v IS NOT NULL THEN RETURN v; END IF;
  SELECT user_id INTO v FROM people WHERE lower(email) = f LIMIT 1;
  IF v IS NOT NULL THEN RETURN v; END IF;
  SELECT user_id INTO v FROM newsletter_subscribers WHERE lower(email) = f LIMIT 1;
  RETURN v;
END $$;

CREATE OR REPLACE FUNCTION public.trg_notify_email_thread() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid; who text;
BEGIN
  IF NEW.direction IS DISTINCT FROM 'inbound' THEN RETURN NEW; END IF;
  -- Never notify about mail addressed to another system's inbox.
  IF lower(coalesce(NEW.to_email,'')) LIKE '%@inbound.talkweb.io' THEN RETURN NEW; END IF;
  uid := coalesce(public.email_thread_owner_by_sender(NEW.from_email), public.email_thread_owner(NEW.company_sequence_id, NEW.to_email));
  who := coalesce(NEW.from_email, 'someone');
  PERFORM public.notify_user(uid, 'email_reply', 'Reply from ' || who,
    coalesce(NEW.subject, left(NEW.body_text, 120)),
    CASE WHEN NEW.company_sequence_id IS NOT NULL THEN '/conversations?sequence=' || NEW.company_sequence_id ELSE '/conversations?tab=personal' END,
    'email_thread', NEW.id::text, jsonb_build_object('from', NEW.from_email, 'thread_id', NEW.thread_id));
  RETURN NEW;
END $$;

-- Redo the backfill with the better rule (one notification per distinct email, newest copy).
DELETE FROM public.notifications WHERE type = 'email_reply' AND coalesce((metadata->>'backfill')::boolean, false);
INSERT INTO public.notifications (user_id, type, title, body, link, entity_type, entity_id, metadata, created_at)
SELECT DISTINCT ON (coalesce(t.metadata->>'resend_email_id', t.message_id, t.id::text))
       coalesce(public.email_thread_owner_by_sender(t.from_email), public.email_thread_owner(t.company_sequence_id, t.to_email)),
       'email_reply', 'Reply from ' || coalesce(t.from_email, 'someone'), coalesce(t.subject, left(t.body_text, 120)),
       CASE WHEN t.company_sequence_id IS NOT NULL THEN '/conversations?sequence=' || t.company_sequence_id ELSE '/conversations?tab=personal' END,
       'email_thread', t.id::text, jsonb_build_object('from', t.from_email, 'thread_id', t.thread_id, 'backfill', true), coalesce(t.received_at, t.created_at)
FROM public.email_threads t
WHERE t.direction = 'inbound'
  AND coalesce(t.received_at, t.created_at) > now() - interval '30 days'
  AND lower(coalesce(t.to_email,'')) NOT LIKE '%@inbound.talkweb.io'
  AND coalesce(public.email_thread_owner_by_sender(t.from_email), public.email_thread_owner(t.company_sequence_id, t.to_email)) IS NOT NULL
ORDER BY coalesce(t.metadata->>'resend_email_id', t.message_id, t.id::text), coalesce(t.received_at, t.created_at) ASC
ON CONFLICT DO NOTHING;
