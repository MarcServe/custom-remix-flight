-- Run this in Supabase SQL Editor if you need multiple Resend/SendGrid senders per account.
-- Allows e.g. michael.o@bizboosters.co.uk and sales@talkweb.io as separate Resend connections.

ALTER TABLE public.crm_connections
  DROP CONSTRAINT IF EXISTS crm_connections_user_id_provider_key;
