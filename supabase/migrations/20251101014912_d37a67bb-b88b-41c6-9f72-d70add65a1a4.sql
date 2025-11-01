-- Add email verification columns to crm_connections table
ALTER TABLE crm_connections 
  ADD COLUMN IF NOT EXISTS verification_token text,
  ADD COLUMN IF NOT EXISTS verification_expires_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS verified_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS from_email text;

-- Add index for faster verification token lookups
CREATE INDEX IF NOT EXISTS idx_crm_connections_verification_token 
  ON crm_connections(verification_token) 
  WHERE verification_token IS NOT NULL;

-- Add index for faster from_email lookups
CREATE INDEX IF NOT EXISTS idx_crm_connections_from_email 
  ON crm_connections(from_email) 
  WHERE from_email IS NOT NULL;