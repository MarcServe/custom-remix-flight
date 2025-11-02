-- Create lead_finder_searches table to track active searches
CREATE TABLE public.lead_finder_searches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  search_params JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'paused', 'complete', 'error')),
  progress INTEGER NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  current_status TEXT,
  stats JSONB DEFAULT '{}'::jsonb,
  usage JSONB DEFAULT '{}'::jsonb,
  trace_url TEXT,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create lead_finder_leads table to store individual leads
CREATE TABLE public.lead_finder_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  search_id UUID NOT NULL REFERENCES public.lead_finder_searches(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  enrichment_status TEXT NOT NULL DEFAULT 'pending' CHECK (enrichment_status IN ('pending', 'enriching', 'enriched', 'skipped')),
  contact_status TEXT NOT NULL DEFAULT 'pending' CHECK (contact_status IN ('pending', 'searching', 'found', 'none', 'skipped')),
  quality_score INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX idx_lead_finder_searches_user_id ON public.lead_finder_searches(user_id);
CREATE INDEX idx_lead_finder_searches_status ON public.lead_finder_searches(status);
CREATE INDEX idx_lead_finder_searches_created_at ON public.lead_finder_searches(created_at DESC);
CREATE INDEX idx_lead_finder_leads_search_id ON public.lead_finder_leads(search_id);
CREATE INDEX idx_lead_finder_leads_user_id ON public.lead_finder_leads(user_id);

-- Add updated_at trigger for lead_finder_searches
CREATE TRIGGER update_lead_finder_searches_updated_at
  BEFORE UPDATE ON public.lead_finder_searches
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add updated_at trigger for lead_finder_leads
CREATE TRIGGER update_lead_finder_leads_updated_at
  BEFORE UPDATE ON public.lead_finder_leads
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable Row Level Security
ALTER TABLE public.lead_finder_searches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_finder_leads ENABLE ROW LEVEL SECURITY;

-- RLS Policies for lead_finder_searches
CREATE POLICY "Users can view their own searches"
  ON public.lead_finder_searches
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own searches"
  ON public.lead_finder_searches
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own searches"
  ON public.lead_finder_searches
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own searches"
  ON public.lead_finder_searches
  FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for lead_finder_leads
CREATE POLICY "Users can view their own leads"
  ON public.lead_finder_leads
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own leads"
  ON public.lead_finder_leads
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own leads"
  ON public.lead_finder_leads
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own leads"
  ON public.lead_finder_leads
  FOR DELETE
  USING (auth.uid() = user_id);

-- Enable realtime for both tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.lead_finder_searches;
ALTER PUBLICATION supabase_realtime ADD TABLE public.lead_finder_leads;