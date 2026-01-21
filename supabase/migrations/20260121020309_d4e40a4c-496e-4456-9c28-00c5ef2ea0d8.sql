-- Create discovery_runs table to track all discovery runs
CREATE TABLE public.discovery_runs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  discovery_run_id TEXT NOT NULL UNIQUE,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE,
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed', 'partial')),
  
  -- Stats
  total_leads_found INTEGER DEFAULT 0,
  leads_enriched INTEGER DEFAULT 0,
  leads_auto_approved INTEGER DEFAULT 0,
  leads_pending INTEGER DEFAULT 0,
  emails_extracted INTEGER DEFAULT 0,
  contacts_created INTEGER DEFAULT 0,
  campaigns_created INTEGER DEFAULT 0,
  sequences_enrolled INTEGER DEFAULT 0,
  
  -- Source breakdown
  source_breakdown JSONB DEFAULT '{}',
  
  -- Errors
  error_message TEXT,
  errors JSONB DEFAULT '[]',
  
  -- Persona info
  persona_id UUID REFERENCES discovery_personas(id) ON DELETE SET NULL,
  persona_name TEXT,
  
  -- Metadata
  trigger_type TEXT DEFAULT 'scheduled' CHECK (trigger_type IN ('scheduled', 'manual', 'catch_up')),
  settings_snapshot JSONB,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.discovery_runs ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their own discovery runs"
  ON public.discovery_runs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own discovery runs"
  ON public.discovery_runs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own discovery runs"
  ON public.discovery_runs FOR UPDATE
  USING (auth.uid() = user_id);

-- Index for efficient querying
CREATE INDEX idx_discovery_runs_user_id ON public.discovery_runs(user_id);
CREATE INDEX idx_discovery_runs_started_at ON public.discovery_runs(started_at DESC);
CREATE INDEX idx_discovery_runs_status ON public.discovery_runs(status);

-- Add full_auto_mode column if not exists (enables completely hands-free operation)
ALTER TABLE public.autonomous_discovery_settings 
ADD COLUMN IF NOT EXISTS full_auto_mode BOOLEAN DEFAULT false;

-- Add campaign_send_time column for scheduling auto-campaigns
ALTER TABLE public.autonomous_discovery_settings 
ADD COLUMN IF NOT EXISTS campaign_send_time TEXT DEFAULT '10:00';

-- Add auto_extract_all_emails to extract emails for ALL leads, not just auto-approved
ALTER TABLE public.autonomous_discovery_settings 
ADD COLUMN IF NOT EXISTS auto_extract_all_emails BOOLEAN DEFAULT false;

-- Add deep_enrichment_mode to ensure ALL leads get Perplexity enrichment
ALTER TABLE public.autonomous_discovery_settings 
ADD COLUMN IF NOT EXISTS deep_enrichment_mode BOOLEAN DEFAULT false;