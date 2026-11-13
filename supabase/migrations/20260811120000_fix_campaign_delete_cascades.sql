-- Allow deleting company_sequences / email_activities that have related
-- automation executions or bounce events. Without ON DELETE, Active Campaigns
-- "Delete" fails with a foreign-key violation for any sequence that ever ran
-- automation or bounced.

-- automation_rule_executions.company_sequence_id → company_sequences(id)
ALTER TABLE public.automation_rule_executions
  DROP CONSTRAINT IF EXISTS automation_rule_executions_company_sequence_id_fkey;

ALTER TABLE public.automation_rule_executions
  ADD CONSTRAINT automation_rule_executions_company_sequence_id_fkey
  FOREIGN KEY (company_sequence_id)
  REFERENCES public.company_sequences(id)
  ON DELETE CASCADE;

-- email_bounce_events.email_activity_id → email_activities(id)
ALTER TABLE public.email_bounce_events
  DROP CONSTRAINT IF EXISTS email_bounce_events_email_activity_id_fkey;

ALTER TABLE public.email_bounce_events
  ADD CONSTRAINT email_bounce_events_email_activity_id_fkey
  FOREIGN KEY (email_activity_id)
  REFERENCES public.email_activities(id)
  ON DELETE CASCADE;
