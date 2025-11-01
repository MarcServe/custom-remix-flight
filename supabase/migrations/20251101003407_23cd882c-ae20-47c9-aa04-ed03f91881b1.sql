-- Create user_deal_views table for tracking viewed deals
CREATE TABLE user_deal_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  viewed_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, deal_id)
);

-- Enable RLS on user_deal_views
ALTER TABLE user_deal_views ENABLE ROW LEVEL SECURITY;

-- RLS policies for user_deal_views
CREATE POLICY "Users can view their own deal views"
  ON user_deal_views FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own deal views"
  ON user_deal_views FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own deal views"
  ON user_deal_views FOR UPDATE
  USING (auth.uid() = user_id);

-- Indexes for user_deal_views
CREATE INDEX idx_user_deal_views_user_id ON user_deal_views(user_id);
CREATE INDEX idx_user_deal_views_deal_id ON user_deal_views(deal_id);

-- Create user_campaign_views table for tracking viewed campaigns
CREATE TABLE user_campaign_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_sequence_id UUID NOT NULL REFERENCES company_sequences(id) ON DELETE CASCADE,
  viewed_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, company_sequence_id)
);

-- Enable RLS on user_campaign_views
ALTER TABLE user_campaign_views ENABLE ROW LEVEL SECURITY;

-- RLS policies for user_campaign_views
CREATE POLICY "Users can view their own campaign views"
  ON user_campaign_views FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own campaign views"
  ON user_campaign_views FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own campaign views"
  ON user_campaign_views FOR UPDATE
  USING (auth.uid() = user_id);

-- Indexes for user_campaign_views
CREATE INDEX idx_user_campaign_views_user_id ON user_campaign_views(user_id);
CREATE INDEX idx_user_campaign_views_company_sequence_id ON user_campaign_views(company_sequence_id);