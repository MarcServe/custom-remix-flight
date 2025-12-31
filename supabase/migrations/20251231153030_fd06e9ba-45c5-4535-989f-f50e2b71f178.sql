-- Add feedback learning columns to autonomous_discovery_settings
ALTER TABLE public.autonomous_discovery_settings
  ADD COLUMN IF NOT EXISTS learned_industries TEXT[] DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS learned_geographies TEXT[] DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS learned_company_sizes TEXT[] DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS learned_keywords TEXT[] DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS avoid_industries TEXT[] DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS avoid_keywords TEXT[] DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS total_approved INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_rejected INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS feedback_learning_enabled BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS auto_enroll_sequence_id UUID DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS auto_enroll_enabled BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS webhook_url TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS webhook_enabled BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS notify_on_auto_approve BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_min_quality_score INTEGER DEFAULT 70;

-- Create lead_feedback_analytics table for detailed tracking
CREATE TABLE IF NOT EXISTS public.lead_feedback_analytics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  autonomous_lead_id UUID REFERENCES public.autonomous_leads(id) ON DELETE SET NULL,
  action TEXT NOT NULL, -- 'approved', 'rejected', 'auto_approved'
  quality_score INTEGER,
  industry TEXT,
  geography TEXT,
  company_size TEXT,
  source TEXT,
  time_to_decision_seconds INTEGER, -- How long user took to decide
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for analytics queries
CREATE INDEX IF NOT EXISTS idx_lead_feedback_user_action ON public.lead_feedback_analytics(user_id, action);
CREATE INDEX IF NOT EXISTS idx_lead_feedback_industry ON public.lead_feedback_analytics(user_id, industry);

-- Enable RLS
ALTER TABLE public.lead_feedback_analytics ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their own feedback analytics"
ON public.lead_feedback_analytics FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own feedback analytics"
ON public.lead_feedback_analytics FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Function to update learned preferences based on feedback
CREATE OR REPLACE FUNCTION public.update_discovery_learning(
  p_user_id UUID,
  p_action TEXT,
  p_industry TEXT,
  p_geography TEXT,
  p_company_size TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Update counters
  IF p_action = 'approved' OR p_action = 'auto_approved' THEN
    UPDATE autonomous_discovery_settings
    SET 
      total_approved = COALESCE(total_approved, 0) + 1,
      learned_industries = CASE 
        WHEN p_industry IS NOT NULL AND feedback_learning_enabled 
        THEN array_append(
          array_remove(COALESCE(learned_industries, ARRAY[]::TEXT[]), p_industry),
          p_industry
        )
        ELSE learned_industries
      END,
      learned_geographies = CASE 
        WHEN p_geography IS NOT NULL AND feedback_learning_enabled 
        THEN array_append(
          array_remove(COALESCE(learned_geographies, ARRAY[]::TEXT[]), p_geography),
          p_geography
        )
        ELSE learned_geographies
      END,
      learned_company_sizes = CASE 
        WHEN p_company_size IS NOT NULL AND feedback_learning_enabled 
        THEN array_append(
          array_remove(COALESCE(learned_company_sizes, ARRAY[]::TEXT[]), p_company_size),
          p_company_size
        )
        ELSE learned_company_sizes
      END
    WHERE user_id = p_user_id;
  ELSIF p_action = 'rejected' THEN
    UPDATE autonomous_discovery_settings
    SET 
      total_rejected = COALESCE(total_rejected, 0) + 1,
      avoid_industries = CASE 
        WHEN p_industry IS NOT NULL AND feedback_learning_enabled 
        THEN array_append(
          array_remove(COALESCE(avoid_industries, ARRAY[]::TEXT[]), p_industry),
          p_industry
        )
        ELSE avoid_industries
      END
    WHERE user_id = p_user_id;
  END IF;
END;
$$;