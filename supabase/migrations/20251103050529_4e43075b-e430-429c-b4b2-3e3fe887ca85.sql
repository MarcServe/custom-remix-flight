-- Fix RLS policies to ensure users can only see their own data
-- Drop overly permissive policies that allow all authenticated users to see all data

-- Fix deals table - remove policies that allow viewing all deals
DROP POLICY IF EXISTS "Authenticated users can view deals" ON public.deals;
DROP POLICY IF EXISTS "Authenticated users can insert deals" ON public.deals;
DROP POLICY IF EXISTS "Authenticated users can update deals" ON public.deals;
DROP POLICY IF EXISTS "Authenticated users can delete deals" ON public.deals;

-- Fix people table - remove policies that allow viewing all people
DROP POLICY IF EXISTS "Authenticated users can view people" ON public.people;
DROP POLICY IF EXISTS "Authenticated users can insert people" ON public.people;
DROP POLICY IF EXISTS "Authenticated users can update people" ON public.people;
DROP POLICY IF EXISTS "Authenticated users can delete people" ON public.people;

-- Fix events table - remove policies that allow viewing all events
DROP POLICY IF EXISTS "Authenticated users can view events" ON public.events;
DROP POLICY IF EXISTS "Authenticated users can insert events" ON public.events;
DROP POLICY IF EXISTS "Authenticated users can update events" ON public.events;
DROP POLICY IF EXISTS "Authenticated users can delete events" ON public.events;

-- Add proper user-specific policies for events (join through companies or deals)
CREATE POLICY "Users can view events for their companies or deals"
  ON public.events FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM companies WHERE companies.id = events.company_id AND companies.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM deals WHERE deals.id = events.deal_id AND deals.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert events for their companies or deals"
  ON public.events FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM companies WHERE companies.id = events.company_id AND companies.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM deals WHERE deals.id = events.deal_id AND deals.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update events for their companies or deals"
  ON public.events FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM companies WHERE companies.id = events.company_id AND companies.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM deals WHERE deals.id = events.deal_id AND deals.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete events for their companies or deals"
  ON public.events FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM companies WHERE companies.id = events.company_id AND companies.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM deals WHERE deals.id = events.deal_id AND deals.user_id = auth.uid()
    )
  );

-- Fix email_activities table - restrict to user's own activities (join through company_sequences → companies)
DROP POLICY IF EXISTS "Authenticated users can view email_activities" ON public.email_activities;
DROP POLICY IF EXISTS "Authenticated users can insert email_activities" ON public.email_activities;
DROP POLICY IF EXISTS "Authenticated users can update email_activities" ON public.email_activities;
DROP POLICY IF EXISTS "Authenticated users can delete email_activities" ON public.email_activities;

CREATE POLICY "Users can view their own email activities"
  ON public.email_activities FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM company_sequences cs
      JOIN companies c ON c.id = cs.company_id
      WHERE cs.id = email_activities.company_sequence_id AND c.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert their own email activities"
  ON public.email_activities FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM company_sequences cs
      JOIN companies c ON c.id = cs.company_id
      WHERE cs.id = email_activities.company_sequence_id AND c.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own email activities"
  ON public.email_activities FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM company_sequences cs
      JOIN companies c ON c.id = cs.company_id
      WHERE cs.id = email_activities.company_sequence_id AND c.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their own email activities"
  ON public.email_activities FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM company_sequences cs
      JOIN companies c ON c.id = cs.company_id
      WHERE cs.id = email_activities.company_sequence_id AND c.user_id = auth.uid()
    )
  );

-- Fix profiles table - users should only see their own profile
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;

CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);