-- Fix RLS policies for email_sequences to filter by created_by
DROP POLICY IF EXISTS "Authenticated users can view email_sequences" ON email_sequences;
DROP POLICY IF EXISTS "Authenticated users can insert email_sequences" ON email_sequences;
DROP POLICY IF EXISTS "Authenticated users can update email_sequences" ON email_sequences;
DROP POLICY IF EXISTS "Authenticated users can delete email_sequences" ON email_sequences;

-- Create proper user-scoped policies for email_sequences
CREATE POLICY "Users can view their own email_sequences"
  ON email_sequences FOR SELECT
  USING (auth.uid() = created_by);

CREATE POLICY "Users can insert their own email_sequences"
  ON email_sequences FOR INSERT
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update their own email_sequences"
  ON email_sequences FOR UPDATE
  USING (auth.uid() = created_by);

CREATE POLICY "Users can delete their own email_sequences"
  ON email_sequences FOR DELETE
  USING (auth.uid() = created_by);

-- Fix RLS policies for company_sequences to filter by company ownership
DROP POLICY IF EXISTS "Authenticated users can view company_sequences" ON company_sequences;
DROP POLICY IF EXISTS "Authenticated users can insert company_sequences" ON company_sequences;
DROP POLICY IF EXISTS "Authenticated users can update company_sequences" ON company_sequences;
DROP POLICY IF EXISTS "Authenticated users can delete company_sequences" ON company_sequences;

-- Create proper user-scoped policies for company_sequences (via companies.user_id)
CREATE POLICY "Users can view their own company_sequences"
  ON company_sequences FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM companies 
    WHERE companies.id = company_sequences.company_id 
    AND companies.user_id = auth.uid()
  ));

CREATE POLICY "Users can insert their own company_sequences"
  ON company_sequences FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM companies 
    WHERE companies.id = company_sequences.company_id 
    AND companies.user_id = auth.uid()
  ));

CREATE POLICY "Users can update their own company_sequences"
  ON company_sequences FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM companies 
    WHERE companies.id = company_sequences.company_id 
    AND companies.user_id = auth.uid()
  ));

CREATE POLICY "Users can delete their own company_sequences"
  ON company_sequences FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM companies 
    WHERE companies.id = company_sequences.company_id 
    AND companies.user_id = auth.uid()
  ));