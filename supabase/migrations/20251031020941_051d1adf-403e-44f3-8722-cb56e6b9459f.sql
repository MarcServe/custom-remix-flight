-- ==========================================
-- Phase 2: Production Database Schema
-- ==========================================

-- 1. Add AI enrichment tracking columns to companies
ALTER TABLE companies 
  ADD COLUMN IF NOT EXISTS enrichment_provider TEXT,
  ADD COLUMN IF NOT EXISTS enrichment_model TEXT,
  ADD COLUMN IF NOT EXISTS langfuse_trace_id TEXT,
  ADD COLUMN IF NOT EXISTS enrichment_error TEXT;

-- 2. Add AI tracking to email_sequences
ALTER TABLE email_sequences
  ADD COLUMN IF NOT EXISTS provider TEXT DEFAULT 'openai',
  ADD COLUMN IF NOT EXISTS model TEXT,
  ADD COLUMN IF NOT EXISTS langfuse_trace_id TEXT;

-- 3. Create user roles system (prevent privilege escalation)
CREATE TYPE app_role AS ENUM ('admin', 'sales_rep', 'viewer');

CREATE TABLE IF NOT EXISTS user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL DEFAULT 'sales_rep',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, role)
);

-- RLS for user_roles
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own roles"
  ON user_roles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Only admins can manage roles"
  ON user_roles FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Security definer function (avoids RLS recursion)
CREATE OR REPLACE FUNCTION has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- 4. Create audit logs table
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  table_name TEXT NOT NULL,
  record_id UUID NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
  old_data JSONB,
  new_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_table ON audit_logs(table_name, record_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at DESC);

-- RLS for audit logs
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own audit logs"
  ON audit_logs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all audit logs"
  ON audit_logs FOR SELECT
  USING (has_role(auth.uid(), 'admin'));

-- 5. Full-text search indexes
CREATE INDEX IF NOT EXISTS idx_companies_search 
  ON companies USING GIN(
    to_tsvector('english', 
      COALESCE(name, '') || ' ' || 
      COALESCE(description, '') || ' ' || 
      COALESCE(industry, '')
    )
  );

CREATE INDEX IF NOT EXISTS idx_people_search
  ON people USING GIN(
    to_tsvector('english',
      COALESCE(first_name, '') || ' ' ||
      COALESCE(last_name, '') || ' ' ||
      COALESCE(title, '')
    )
  );

-- 6. Updated_at triggers for auto-timestamp updates
CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to companies
DROP TRIGGER IF EXISTS set_companies_updated_at ON companies;
CREATE TRIGGER set_companies_updated_at
  BEFORE UPDATE ON companies
  FOR EACH ROW
  EXECUTE FUNCTION trigger_set_updated_at();

-- Apply to deals
DROP TRIGGER IF EXISTS set_deals_updated_at ON deals;
CREATE TRIGGER set_deals_updated_at
  BEFORE UPDATE ON deals
  FOR EACH ROW
  EXECUTE FUNCTION trigger_set_updated_at();

-- Apply to people
DROP TRIGGER IF EXISTS set_people_updated_at ON people;
CREATE TRIGGER set_people_updated_at
  BEFORE UPDATE ON people
  FOR EACH ROW
  EXECUTE FUNCTION trigger_set_updated_at();

-- Apply to profiles
DROP TRIGGER IF EXISTS set_profiles_updated_at ON profiles;
CREATE TRIGGER set_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION trigger_set_updated_at();

-- 7. Additional performance indexes
CREATE INDEX IF NOT EXISTS idx_companies_enrichment_status 
  ON companies(enrichment_status) WHERE enrichment_status IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_events_type ON events(type);
CREATE INDEX IF NOT EXISTS idx_events_due_at ON events(due_at) WHERE due_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_deals_close_date ON deals(close_date);

-- 8. Company search function (for advanced search)
CREATE OR REPLACE FUNCTION search_companies(search_query TEXT)
RETURNS TABLE (
  id UUID,
  name TEXT,
  website TEXT,
  industry TEXT,
  size TEXT,
  geography TEXT,
  status TEXT,
  rank REAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id,
    c.name,
    c.website,
    c.industry,
    c.size,
    c.geography,
    c.status,
    ts_rank(
      to_tsvector('english', 
        COALESCE(c.name, '') || ' ' || 
        COALESCE(c.description, '') || ' ' || 
        COALESCE(c.industry, '')
      ),
      plainto_tsquery('english', search_query)
    ) as rank
  FROM companies c
  WHERE to_tsvector('english', 
          COALESCE(c.name, '') || ' ' || 
          COALESCE(c.description, '') || ' ' || 
          COALESCE(c.industry, '')
        ) @@ plainto_tsquery('english', search_query)
  ORDER BY rank DESC
  LIMIT 50;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON TABLE user_roles IS 'User role assignments for access control';
COMMENT ON TABLE audit_logs IS 'Audit trail for data changes';
COMMENT ON FUNCTION search_companies IS 'Full-text search for companies';