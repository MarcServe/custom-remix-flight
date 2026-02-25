-- RPC: Return per-segment counts for a campaign's recipients (supports large lists without fetching all rows)
-- Used for Resend-style status filter dropdown and segment-based follow-up
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
    'opened', count(*) FILTER (WHERE opened_at IS NOT NULL)::int,
    'clicked', count(*) FILTER (WHERE clicked_at IS NOT NULL)::int,
    'opened_no_click', count(*) FILTER (WHERE opened_at IS NOT NULL AND clicked_at IS NULL)::int,
    'bounced', count(*) FILTER (WHERE status = 'bounced')::int,
    'failed', count(*) FILTER (WHERE status = 'failed')::int
  )
  FROM email_campaign_recipients
  WHERE campaign_id = p_campaign_id;
$$;

COMMENT ON FUNCTION public.get_campaign_recipient_status_counts(uuid) IS 'Returns counts by segment for campaign recipient list filter and follow-up targeting';
