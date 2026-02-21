-- Allow multiple connections per user per provider (e.g. multiple Resend senders: sales@talkweb.io + michael.o@bizboosters.co.uk)
ALTER TABLE public.crm_connections
  DROP CONSTRAINT IF EXISTS crm_connections_user_id_provider_key;
