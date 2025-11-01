-- Create auto_response_analytics table for tracking performance
CREATE TABLE IF NOT EXISTS auto_response_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_sequence_id UUID REFERENCES company_sequences(id) ON DELETE SET NULL,
  email_activity_id UUID REFERENCES email_activities(id) ON DELETE SET NULL,
  ai_model TEXT NOT NULL,
  ai_temperature DECIMAL(2,1),
  response_time_ms INTEGER,
  token_count INTEGER,
  prompt_tokens INTEGER,
  completion_tokens INTEGER,
  generated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  sent_at TIMESTAMP WITH TIME ZONE,
  opened_at TIMESTAMP WITH TIME ZONE,
  replied_at TIMESTAMP WITH TIME ZONE,
  sentiment_score DECIMAL(3,2),
  success_score DECIMAL(3,2),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE auto_response_analytics ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own analytics"
  ON auto_response_analytics FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own analytics"
  ON auto_response_analytics FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own analytics"
  ON auto_response_analytics FOR UPDATE
  USING (auth.uid() = user_id);

-- Indexes for performance
CREATE INDEX idx_auto_response_analytics_user_id ON auto_response_analytics(user_id);
CREATE INDEX idx_auto_response_analytics_generated_at ON auto_response_analytics(generated_at DESC);
CREATE INDEX idx_auto_response_analytics_model ON auto_response_analytics(ai_model);
CREATE INDEX idx_auto_response_analytics_company_seq ON auto_response_analytics(company_sequence_id);

COMMENT ON TABLE auto_response_analytics IS 'Tracks performance and analytics for AI-generated auto-responses';
COMMENT ON COLUMN auto_response_analytics.response_time_ms IS 'Time taken to generate AI response in milliseconds';
COMMENT ON COLUMN auto_response_analytics.sentiment_score IS 'Sentiment analysis score of the response (-1 to 1)';
COMMENT ON COLUMN auto_response_analytics.success_score IS 'Success metric based on opens, replies, and engagement (0 to 1)';