-- Create autonomous_discovery_settings table for user configuration
CREATE TABLE public.autonomous_discovery_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  enabled BOOLEAN NOT NULL DEFAULT false,
  discovery_frequency TEXT NOT NULL DEFAULT 'daily', -- 'daily', 'weekly', 'twice_weekly'
  max_leads_per_run INTEGER NOT NULL DEFAULT 10,
  target_industries TEXT[] DEFAULT NULL,
  target_geographies TEXT[] DEFAULT NULL,
  target_company_sizes TEXT[] DEFAULT NULL,
  custom_search_query TEXT DEFAULT NULL,
  use_serp_api BOOLEAN NOT NULL DEFAULT false,
  enrich_with_perplexity BOOLEAN NOT NULL DEFAULT true,
  auto_approve_threshold INTEGER DEFAULT NULL, -- If quality score >= threshold, auto-approve
  last_run_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  next_run_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create autonomous_leads table for discovered leads pending approval
CREATE TABLE public.autonomous_leads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  discovery_run_id UUID DEFAULT NULL, -- Groups leads from the same discovery run
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'approved', 'rejected', 'auto_approved'
  quality_score INTEGER DEFAULT NULL,
  
  -- Company data (stored as JSONB for flexibility)
  company_data JSONB NOT NULL DEFAULT '{}',
  
  -- Denormalized key fields for filtering
  company_name TEXT NOT NULL,
  company_website TEXT DEFAULT NULL,
  industry TEXT DEFAULT NULL,
  geography TEXT DEFAULT NULL,
  company_size TEXT DEFAULT NULL,
  
  -- Contacts data
  contacts JSONB DEFAULT '[]',
  
  -- Enrichment data
  enrichment_data JSONB DEFAULT NULL,
  source TEXT DEFAULT 'exa', -- 'exa', 'serpapi', 'google_maps'
  
  -- Approval workflow
  reviewed_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  company_id UUID DEFAULT NULL, -- Set when lead is approved and saved to companies table
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for efficient queries
CREATE INDEX idx_autonomous_leads_user_status ON public.autonomous_leads(user_id, status);
CREATE INDEX idx_autonomous_leads_discovery_run ON public.autonomous_leads(discovery_run_id);

-- Enable RLS
ALTER TABLE public.autonomous_discovery_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.autonomous_leads ENABLE ROW LEVEL SECURITY;

-- RLS policies for autonomous_discovery_settings
CREATE POLICY "Users can view their own discovery settings"
ON public.autonomous_discovery_settings FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own discovery settings"
ON public.autonomous_discovery_settings FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own discovery settings"
ON public.autonomous_discovery_settings FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own discovery settings"
ON public.autonomous_discovery_settings FOR DELETE
USING (auth.uid() = user_id);

-- RLS policies for autonomous_leads
CREATE POLICY "Users can view their own autonomous leads"
ON public.autonomous_leads FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own autonomous leads"
ON public.autonomous_leads FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own autonomous leads"
ON public.autonomous_leads FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own autonomous leads"
ON public.autonomous_leads FOR DELETE
USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_autonomous_discovery_settings_updated_at
BEFORE UPDATE ON public.autonomous_discovery_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_autonomous_leads_updated_at
BEFORE UPDATE ON public.autonomous_leads
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();