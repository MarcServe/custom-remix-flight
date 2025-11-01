-- Create A/B test experiments table
CREATE TABLE public.email_ab_tests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused', 'completed')),
  
  -- Test configuration
  test_type TEXT NOT NULL DEFAULT 'subject_line' CHECK (test_type IN ('subject_line', 'content', 'send_time', 'sender_name')),
  traffic_split JSONB NOT NULL DEFAULT '{"variant_a": 50, "variant_b": 50}'::jsonb,
  
  -- Variants
  variant_a JSONB NOT NULL,
  variant_b JSONB NOT NULL,
  variant_c JSONB,
  
  -- Test duration and sample size
  min_sample_size INTEGER DEFAULT 100,
  confidence_level NUMERIC(3,2) DEFAULT 0.95,
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  
  -- Winner selection
  winning_variant TEXT CHECK (winning_variant IN ('variant_a', 'variant_b', 'variant_c', 'auto')),
  auto_select_winner BOOLEAN DEFAULT true,
  winner_metric TEXT DEFAULT 'open_rate' CHECK (winner_metric IN ('open_rate', 'click_rate', 'reply_rate', 'conversion_rate')),
  
  -- Results
  results JSONB DEFAULT '{}'::jsonb,
  metadata JSONB DEFAULT '{}'::jsonb,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.email_ab_tests ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own A/B tests"
  ON public.email_ab_tests
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own A/B tests"
  ON public.email_ab_tests
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own A/B tests"
  ON public.email_ab_tests
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own A/B tests"
  ON public.email_ab_tests
  FOR DELETE
  USING (auth.uid() = user_id);

-- Create indexes
CREATE INDEX idx_ab_tests_user_id ON public.email_ab_tests(user_id);
CREATE INDEX idx_ab_tests_status ON public.email_ab_tests(status);
CREATE INDEX idx_ab_tests_started_at ON public.email_ab_tests(started_at DESC);

-- Create A/B test assignments table (tracks which variant was sent to each recipient)
CREATE TABLE public.email_ab_test_assignments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ab_test_id UUID NOT NULL REFERENCES public.email_ab_tests(id) ON DELETE CASCADE,
  email_activity_id UUID NOT NULL REFERENCES public.email_activities(id) ON DELETE CASCADE,
  variant TEXT NOT NULL CHECK (variant IN ('variant_a', 'variant_b', 'variant_c')),
  
  -- Performance metrics
  sent_at TIMESTAMP WITH TIME ZONE,
  opened_at TIMESTAMP WITH TIME ZONE,
  clicked_at TIMESTAMP WITH TIME ZONE,
  replied_at TIMESTAMP WITH TIME ZONE,
  converted_at TIMESTAMP WITH TIME ZONE,
  
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.email_ab_test_assignments ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view assignments for their tests"
  ON public.email_ab_test_assignments
  FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.email_ab_tests
    WHERE email_ab_tests.id = email_ab_test_assignments.ab_test_id
    AND email_ab_tests.user_id = auth.uid()
  ));

CREATE POLICY "Users can create assignments for their tests"
  ON public.email_ab_test_assignments
  FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.email_ab_tests
    WHERE email_ab_tests.id = email_ab_test_assignments.ab_test_id
    AND email_ab_tests.user_id = auth.uid()
  ));

CREATE POLICY "Users can update assignments for their tests"
  ON public.email_ab_test_assignments
  FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.email_ab_tests
    WHERE email_ab_tests.id = email_ab_test_assignments.ab_test_id
    AND email_ab_tests.user_id = auth.uid()
  ));

-- Create indexes
CREATE INDEX idx_ab_test_assignments_test_id ON public.email_ab_test_assignments(ab_test_id);
CREATE INDEX idx_ab_test_assignments_activity_id ON public.email_ab_test_assignments(email_activity_id);
CREATE INDEX idx_ab_test_assignments_variant ON public.email_ab_test_assignments(variant);

-- Create advanced automation rules table
CREATE TABLE public.automation_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  enabled BOOLEAN DEFAULT true,
  priority INTEGER DEFAULT 0,
  
  -- Rule type
  rule_type TEXT NOT NULL CHECK (rule_type IN ('time_based', 'behavior_based', 'conditional', 'sequential')),
  
  -- Conditions (JSON array of condition objects)
  conditions JSONB NOT NULL DEFAULT '[]'::jsonb,
  
  -- Actions (JSON array of action objects)
  actions JSONB NOT NULL DEFAULT '[]'::jsonb,
  
  -- Time-based settings
  send_time_preference TEXT CHECK (send_time_preference IN ('optimal', 'specific', 'recipient_timezone')),
  specific_time TIME,
  specific_days INTEGER[] DEFAULT ARRAY[1,2,3,4,5], -- 0=Sunday, 1=Monday, etc.
  timezone TEXT DEFAULT 'UTC',
  
  -- Rate limiting
  max_sends_per_day INTEGER,
  min_time_between_sends_hours INTEGER DEFAULT 24,
  
  -- Applies to
  sequence_ids UUID[],
  company_ids UUID[],
  
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.automation_rules ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own automation rules"
  ON public.automation_rules
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own automation rules"
  ON public.automation_rules
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own automation rules"
  ON public.automation_rules
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own automation rules"
  ON public.automation_rules
  FOR DELETE
  USING (auth.uid() = user_id);

-- Create indexes
CREATE INDEX idx_automation_rules_user_id ON public.automation_rules(user_id);
CREATE INDEX idx_automation_rules_enabled ON public.automation_rules(enabled);
CREATE INDEX idx_automation_rules_priority ON public.automation_rules(priority DESC);
CREATE INDEX idx_automation_rules_type ON public.automation_rules(rule_type);

-- Create automation rule execution log
CREATE TABLE public.automation_rule_executions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  rule_id UUID NOT NULL REFERENCES public.automation_rules(id) ON DELETE CASCADE,
  company_sequence_id UUID REFERENCES public.company_sequences(id),
  
  executed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  success BOOLEAN NOT NULL,
  action_taken TEXT,
  error_message TEXT,
  
  conditions_met JSONB,
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Enable RLS
ALTER TABLE public.automation_rule_executions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view executions of their rules"
  ON public.automation_rule_executions
  FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.automation_rules
    WHERE automation_rules.id = automation_rule_executions.rule_id
    AND automation_rules.user_id = auth.uid()
  ));

-- Create indexes
CREATE INDEX idx_rule_executions_rule_id ON public.automation_rule_executions(rule_id);
CREATE INDEX idx_rule_executions_executed_at ON public.automation_rule_executions(executed_at DESC);
CREATE INDEX idx_rule_executions_success ON public.automation_rule_executions(success);

-- Create trigger for updated_at
CREATE TRIGGER update_ab_tests_updated_at
  BEFORE UPDATE ON public.email_ab_tests
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_automation_rules_updated_at
  BEFORE UPDATE ON public.automation_rules
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();