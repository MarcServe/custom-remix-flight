-- Add auto-approval rules table for custom approval logic
CREATE TABLE public.auto_approval_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  conditions JSONB NOT NULL DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  priority INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.auto_approval_rules ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their own approval rules" 
ON public.auto_approval_rules FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own approval rules" 
ON public.auto_approval_rules FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own approval rules" 
ON public.auto_approval_rules FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own approval rules" 
ON public.auto_approval_rules FOR DELETE USING (auth.uid() = user_id);

-- Add per-persona auto-approval threshold
ALTER TABLE public.discovery_personas 
ADD COLUMN IF NOT EXISTS auto_approve_threshold INTEGER DEFAULT 70;

-- Add approval reasoning to autonomous leads
ALTER TABLE public.autonomous_leads 
ADD COLUMN IF NOT EXISTS approval_reason TEXT,
ADD COLUMN IF NOT EXISTS approval_confidence INTEGER,
ADD COLUMN IF NOT EXISTS matched_rules TEXT[];

-- Add notification preferences to discovery settings
ALTER TABLE public.autonomous_discovery_settings
ADD COLUMN IF NOT EXISTS slack_webhook_url TEXT,
ADD COLUMN IF NOT EXISTS discord_webhook_url TEXT,
ADD COLUMN IF NOT EXISTS notify_on_discovery_complete BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS notify_on_hot_leads BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS hot_lead_threshold INTEGER DEFAULT 80;

-- Create trigger for updated_at
CREATE TRIGGER update_auto_approval_rules_updated_at
BEFORE UPDATE ON public.auto_approval_rules
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();