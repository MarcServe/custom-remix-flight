-- Track delivery from Resend (email.delivered webhook or sync). Enables "Delivered" and "Delivered, not opened" segments.
ALTER TABLE public.email_campaign_recipients
  ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

COMMENT ON COLUMN public.email_campaign_recipients.delivered_at IS 'When Resend (or provider) reported delivery to recipient mail server; used for delivered/delivered_not_opened segments.';

-- Update RPC to include delivered and delivered_not_opened counts
CREATE OR REPLACE FUNCTION public.get_campaign_recipient_status_counts(p_campaign_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'all', count(*)::int,
    'pending', count(*) FILTER (WHERE status = 'pending')::int,
    'sent', count(*) FILTER (WHERE status = 'sent' AND sent_at IS NOT NULL)::int,
    'delivered', count(*) FILTER (WHERE delivered_at IS NOT NULL)::int,
    'delivered_not_opened', count(*) FILTER (WHERE delivered_at IS NOT NULL AND opened_at IS NULL)::int,
    'opened', count(*) FILTER (WHERE opened_at IS NOT NULL)::int,
    'clicked', count(*) FILTER (WHERE clicked_at IS NOT NULL)::int,
    'opened_no_click', count(*) FILTER (WHERE opened_at IS NOT NULL AND clicked_at IS NULL)::int,
    'bounced', count(*) FILTER (WHERE status = 'bounced')::int,
    'failed', count(*) FILTER (WHERE status = 'failed')::int
  )
  FROM email_campaign_recipients
  WHERE campaign_id = p_campaign_id;
$$;

COMMENT ON FUNCTION public.get_campaign_recipient_status_counts(uuid) IS 'Returns counts by segment for campaign recipient list filter, follow-up targeting, and Resend sync';
