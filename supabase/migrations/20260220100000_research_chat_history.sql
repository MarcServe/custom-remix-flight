-- Research Chat history: one row per user, messages retained for 30 days
CREATE TABLE IF NOT EXISTS public.research_chat_history (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  messages JSONB NOT NULL DEFAULT '[]',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_research_chat_history_updated_at
  ON public.research_chat_history(updated_at);

ALTER TABLE public.research_chat_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own research chat history"
  ON public.research_chat_history FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own research chat history"
  ON public.research_chat_history FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own research chat history"
  ON public.research_chat_history FOR UPDATE
  USING (auth.uid() = user_id);

COMMENT ON TABLE public.research_chat_history IS 'Research Chat conversation history; messages older than 30 days are treated as expired when loading';
