-- Store audience and sender when scheduling a newsletter so cron can send to the same selection
ALTER TABLE public.newsletters
  ADD COLUMN IF NOT EXISTS scheduled_send_options JSONB DEFAULT NULL;

COMMENT ON COLUMN public.newsletters.scheduled_send_options IS 'When status=scheduled: { categoryFilters?, recipientGroupIds?, industryFilter?, tagCategoryIds?, sender_connection_id? } for cron send';
