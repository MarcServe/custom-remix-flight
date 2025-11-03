-- Add 'gmail_direct' as a new provider type to crm_connections
ALTER TABLE public.crm_connections 
DROP CONSTRAINT IF EXISTS crm_connections_provider_check;

ALTER TABLE public.crm_connections 
ADD CONSTRAINT crm_connections_provider_check 
CHECK (provider = ANY (ARRAY[
  'gmail'::text,
  'gmail_direct'::text,
  'outlook'::text,
  'smtp'::text,
  'hubspot'::text,
  'salesforce'::text,
  'pipedrive'::text,
  'zoho'::text,
  'resend'::text,
  'sendgrid'::text
]));