-- Remove duplicate Resend/SendGrid senders (same user, provider, email) keeping one per sender
DELETE FROM public.crm_connections a
USING public.crm_connections b
WHERE a.user_id = b.user_id
  AND a.provider = b.provider
  AND trim(lower(a.from_email)) = trim(lower(b.from_email))
  AND a.id > b.id;

-- Prevent adding the same sender email twice (per user, provider)
CREATE UNIQUE INDEX IF NOT EXISTS crm_connections_user_provider_from_email_key
  ON public.crm_connections (user_id, provider, lower(trim(from_email)))
  WHERE status = 'active' AND from_email IS NOT NULL AND from_email != '';
