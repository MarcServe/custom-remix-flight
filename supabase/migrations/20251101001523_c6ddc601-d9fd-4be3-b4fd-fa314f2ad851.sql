-- Create user_event_views table to track which events users have viewed
CREATE TABLE IF NOT EXISTS user_event_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  viewed_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, event_id)
);

-- Enable RLS
ALTER TABLE user_event_views ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their own event views"
  ON user_event_views FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own event views"
  ON user_event_views FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own event views"
  ON user_event_views FOR UPDATE
  USING (auth.uid() = user_id);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_event_views_user_id ON user_event_views(user_id);
CREATE INDEX IF NOT EXISTS idx_user_event_views_event_id ON user_event_views(event_id);
CREATE INDEX IF NOT EXISTS idx_user_event_views_user_event ON user_event_views(user_id, event_id);