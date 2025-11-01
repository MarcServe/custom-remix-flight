-- Create email deliverability metrics table
CREATE TABLE public.email_deliverability_metrics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  domain TEXT NOT NULL,
  checked_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Overall health scores
  overall_score INTEGER CHECK (overall_score >= 0 AND overall_score <= 100),
  sender_reputation INTEGER CHECK (sender_reputation >= 0 AND sender_reputation <= 100),
  
  -- Bounce metrics
  bounce_rate NUMERIC(5,2) DEFAULT 0,
  hard_bounce_count INTEGER DEFAULT 0,
  soft_bounce_count INTEGER DEFAULT 0,
  total_sent INTEGER DEFAULT 0,
  
  -- Spam metrics
  spam_complaint_rate NUMERIC(5,2) DEFAULT 0,
  spam_complaint_count INTEGER DEFAULT 0,
  spam_score NUMERIC(5,2) DEFAULT 0,
  
  -- Domain health
  spf_valid BOOLEAN DEFAULT false,
  dkim_valid BOOLEAN DEFAULT false,
  dmarc_valid BOOLEAN DEFAULT false,
  mx_records_valid BOOLEAN DEFAULT false,
  
  -- Blacklist status
  blacklisted BOOLEAN DEFAULT false,
  blacklist_providers TEXT[],
  
  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.email_deliverability_metrics ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own deliverability metrics"
  ON public.email_deliverability_metrics
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own deliverability metrics"
  ON public.email_deliverability_metrics
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own deliverability metrics"
  ON public.email_deliverability_metrics
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Create indexes for performance
CREATE INDEX idx_deliverability_user_id ON public.email_deliverability_metrics(user_id);
CREATE INDEX idx_deliverability_domain ON public.email_deliverability_metrics(domain);
CREATE INDEX idx_deliverability_checked_at ON public.email_deliverability_metrics(checked_at DESC);

-- Create email bounce events table
CREATE TABLE public.email_bounce_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  email_activity_id UUID REFERENCES public.email_activities(id),
  recipient_email TEXT NOT NULL,
  bounce_type TEXT NOT NULL CHECK (bounce_type IN ('hard', 'soft', 'complaint')),
  bounce_reason TEXT,
  external_message_id TEXT,
  occurred_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.email_bounce_events ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own bounce events"
  ON public.email_bounce_events
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own bounce events"
  ON public.email_bounce_events
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Create indexes
CREATE INDEX idx_bounce_events_user_id ON public.email_bounce_events(user_id);
CREATE INDEX idx_bounce_events_email ON public.email_bounce_events(recipient_email);
CREATE INDEX idx_bounce_events_type ON public.email_bounce_events(bounce_type);
CREATE INDEX idx_bounce_events_occurred_at ON public.email_bounce_events(occurred_at DESC);