-- Applied to production 2026-06-19 via one-shot runner; recorded here for parity.
--
-- Historical cleanup: campaigns that errored on the old send code (before the
-- optimistic-lock fix) left recipients stranded as 'pending' even though the
-- campaign itself finished as 'failed' or 'completed'. Those rows will never be
-- sent (the cron no longer retries) and made campaign counts look broken
-- (e.g. a 'failed' campaign showing 1,300+ "pending").
--
-- This marks those orphaned pending rows as 'failed' so counts reflect reality.
-- Scope is deliberately limited to campaigns already in a terminal state
-- ('failed','completed'). PAUSED campaigns are intentionally NOT touched —
-- those were simply never sent and can still be sent. Reversible: the in-app
-- "Reschedule" flow resets failed recipients back to pending.
--
-- One-time fix: the optimistic lock now marks every recipient sent/failed
-- atomically, so this stranding cannot recur for new campaigns.

UPDATE public.email_campaign_recipients r
SET status = 'failed',
    error_message = COALESCE(NULLIF(r.error_message, ''), 'Campaign ended before this recipient was sent (historical cleanup)'),
    updated_at = now()
FROM public.email_campaigns c
WHERE r.campaign_id = c.id
  AND r.status = 'pending'
  AND c.status IN ('failed', 'completed');
