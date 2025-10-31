-- Update crm_connections table to allow email providers
-- This fixes the integration issue where gmail, outlook, and smtp connections were failing
-- because the CHECK constraint only allowed CRM providers

-- Drop the existing CHECK constraint
ALTER TABLE public.crm_connections 
DROP CONSTRAINT IF EXISTS crm_connections_provider_check;

-- Add updated CHECK constraint with both CRM and email providers
ALTER TABLE public.crm_connections 
ADD CONSTRAINT crm_connections_provider_check 
CHECK (provider IN ('gmail', 'outlook', 'smtp', 'hubspot', 'salesforce', 'pipedrive', 'zoho'));