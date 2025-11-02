-- Drop the old provider check constraint
ALTER TABLE public.crm_connections 
DROP CONSTRAINT IF EXISTS crm_connections_provider_check;

-- Add new provider check constraint including resend and sendgrid
ALTER TABLE public.crm_connections 
ADD CONSTRAINT crm_connections_provider_check 
CHECK (provider = ANY (ARRAY['gmail'::text, 'outlook'::text, 'smtp'::text, 'hubspot'::text, 'salesforce'::text, 'pipedrive'::text, 'zoho'::text, 'resend'::text, 'sendgrid'::text]));