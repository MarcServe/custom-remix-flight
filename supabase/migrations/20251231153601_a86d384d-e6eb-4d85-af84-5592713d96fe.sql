-- Phase 5: Email Engagement Feedback Loop & Multi-Persona Targeting

-- Add email engagement tracking to lead_feedback_analytics
ALTER TABLE public.lead_feedback_analytics
  ADD COLUMN IF NOT EXISTS email_opened BOOLEAN DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS email_clicked BOOLEAN DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS email_replied BOOLEAN DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS email_bounced BOOLEAN DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS company_sequence_id UUID REFERENCES public.company_sequences(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS engagement_score INTEGER DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT now();

-- Create discovery personas table for multi-persona targeting
CREATE TABLE IF NOT EXISTS public.discovery_personas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  priority INTEGER DEFAULT 0,
  -- Targeting criteria
  target_industries TEXT[] DEFAULT NULL,
  target_geographies TEXT[] DEFAULT NULL,
  target_company_sizes TEXT[] DEFAULT NULL,
  target_keywords TEXT[] DEFAULT NULL,
  exclude_industries TEXT[] DEFAULT NULL,
  exclude_keywords TEXT[] DEFAULT NULL,
  -- AI learning for this persona
  learned_industries TEXT[] DEFAULT NULL,
  learned_geographies TEXT[] DEFAULT NULL,
  learned_company_sizes TEXT[] DEFAULT NULL,
  total_leads_found INTEGER DEFAULT 0,
  total_approved INTEGER DEFAULT 0,
  total_rejected INTEGER DEFAULT 0,
  conversion_rate NUMERIC DEFAULT 0,
  -- Outreach settings
  auto_enroll_sequence_id UUID DEFAULT NULL,
  custom_search_query TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on discovery_personas
ALTER TABLE public.discovery_personas ENABLE ROW LEVEL SECURITY;

-- RLS policies for discovery_personas
CREATE POLICY "Users can view their own discovery personas"
ON public.discovery_personas FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own discovery personas"
ON public.discovery_personas FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own discovery personas"
ON public.discovery_personas FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own discovery personas"
ON public.discovery_personas FOR DELETE
USING (auth.uid() = user_id);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_discovery_personas_user_active ON public.discovery_personas(user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_lead_feedback_company ON public.lead_feedback_analytics(company_id);
CREATE INDEX IF NOT EXISTS idx_lead_feedback_engagement ON public.lead_feedback_analytics(user_id, email_opened, email_replied);

-- Add persona_id to autonomous_leads to track which persona found them
ALTER TABLE public.autonomous_leads
  ADD COLUMN IF NOT EXISTS persona_id UUID REFERENCES public.discovery_personas(id) ON DELETE SET NULL;

-- Function to update engagement feedback from email activities
CREATE OR REPLACE FUNCTION public.update_lead_engagement_feedback()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company_id UUID;
  v_user_id UUID;
  v_lead_feedback_id UUID;
BEGIN
  -- Only process when there's engagement
  IF NEW.opened_at IS NOT NULL OR NEW.replied_at IS NOT NULL OR NEW.bounced_at IS NOT NULL THEN
    -- Get company_id and user_id from company_sequence
    SELECT cs.company_id, c.user_id INTO v_company_id, v_user_id
    FROM company_sequences cs
    JOIN companies c ON c.id = cs.company_id
    WHERE cs.id = NEW.company_sequence_id;
    
    IF v_company_id IS NOT NULL THEN
      -- Find existing feedback record for this company
      SELECT id INTO v_lead_feedback_id
      FROM lead_feedback_analytics
      WHERE company_id = v_company_id
      ORDER BY created_at DESC
      LIMIT 1;
      
      IF v_lead_feedback_id IS NOT NULL THEN
        -- Update engagement data
        UPDATE lead_feedback_analytics
        SET
          email_opened = CASE WHEN NEW.opened_at IS NOT NULL THEN true ELSE email_opened END,
          email_replied = CASE WHEN NEW.replied_at IS NOT NULL THEN true ELSE email_replied END,
          email_bounced = CASE WHEN NEW.bounced_at IS NOT NULL THEN true ELSE email_bounced END,
          company_sequence_id = NEW.company_sequence_id,
          engagement_score = CASE
            WHEN NEW.replied_at IS NOT NULL THEN 100
            WHEN NEW.opened_at IS NOT NULL THEN 50
            WHEN NEW.bounced_at IS NOT NULL THEN 0
            ELSE engagement_score
          END,
          updated_at = now()
        WHERE id = v_lead_feedback_id;
        
        -- Update learned preferences if replied (high-value signal)
        IF NEW.replied_at IS NOT NULL THEN
          PERFORM update_discovery_learning(
            v_user_id,
            'replied',
            (SELECT industry FROM lead_feedback_analytics WHERE id = v_lead_feedback_id),
            (SELECT geography FROM lead_feedback_analytics WHERE id = v_lead_feedback_id),
            (SELECT company_size FROM lead_feedback_analytics WHERE id = v_lead_feedback_id)
          );
        END IF;
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for email engagement feedback
DROP TRIGGER IF EXISTS email_engagement_feedback_trigger ON public.email_activities;
CREATE TRIGGER email_engagement_feedback_trigger
AFTER UPDATE ON public.email_activities
FOR EACH ROW
EXECUTE FUNCTION public.update_lead_engagement_feedback();

-- Update the learning function to handle 'replied' action
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
  -- Update counters - 'replied' is high-value, weight it more
  IF p_action = 'approved' OR p_action = 'auto_approved' OR p_action = 'replied' THEN
    UPDATE autonomous_discovery_settings
    SET 
      total_approved = CASE WHEN p_action = 'replied' THEN total_approved ELSE COALESCE(total_approved, 0) + 1 END,
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