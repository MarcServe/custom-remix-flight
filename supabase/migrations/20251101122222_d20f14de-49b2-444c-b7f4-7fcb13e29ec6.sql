-- Enhance email_sequences table
ALTER TABLE public.email_sequences
ADD COLUMN goal TEXT,
ADD COLUMN ai_instructions TEXT;

COMMENT ON COLUMN public.email_sequences.goal IS 'The objective of the sequence (e.g., "Convert lead to customer", "Schedule demo")';
COMMENT ON COLUMN public.email_sequences.ai_instructions IS 'Custom instructions for AI behavior when generating responses';

-- Enhance company_sequences table
ALTER TABLE public.company_sequences
ADD COLUMN conversation_history JSONB DEFAULT '[]'::jsonb,
ADD COLUMN ai_context JSONB DEFAULT '{}'::jsonb,
ADD COLUMN next_action TEXT DEFAULT 'send_next_step' CHECK (next_action IN ('send_next_step', 'wait_for_response', 'personalized_response', 'completed', 'paused'));

COMMENT ON COLUMN public.company_sequences.conversation_history IS 'Array of all emails sent and received in this sequence';
COMMENT ON COLUMN public.company_sequences.ai_context IS 'AI analysis and understanding of the conversation';
COMMENT ON COLUMN public.company_sequences.next_action IS 'The next action the system should take';

-- Create email_threads table
CREATE TABLE public.email_threads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_sequence_id UUID NOT NULL REFERENCES company_sequences(id) ON DELETE CASCADE,
  message_id TEXT,
  thread_id TEXT,
  direction TEXT NOT NULL CHECK (direction IN ('outbound', 'inbound')),
  subject TEXT,
  body_html TEXT,
  body_text TEXT,
  from_email TEXT NOT NULL,
  to_email TEXT NOT NULL,
  received_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  sentiment TEXT CHECK (sentiment IN ('positive', 'neutral', 'negative', 'interested', 'not_interested', 'requesting_info')),
  ai_analysis JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.email_threads ENABLE ROW LEVEL SECURITY;

-- Create policies for email_threads
CREATE POLICY "Users can view threads of their sequences"
ON public.email_threads
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM company_sequences cs
    JOIN email_sequences es ON cs.sequence_id = es.id
    WHERE cs.id = email_threads.company_sequence_id
    AND es.created_by = auth.uid()
  )
);

CREATE POLICY "Users can insert threads for their sequences"
ON public.email_threads
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM company_sequences cs
    JOIN email_sequences es ON cs.sequence_id = es.id
    WHERE cs.id = email_threads.company_sequence_id
    AND es.created_by = auth.uid()
  )
);

CREATE POLICY "Users can update threads of their sequences"
ON public.email_threads
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM company_sequences cs
    JOIN email_sequences es ON cs.sequence_id = es.id
    WHERE cs.id = email_threads.company_sequence_id
    AND es.created_by = auth.uid()
  )
);

-- Add indexes for performance
CREATE INDEX idx_email_threads_company_sequence ON email_threads(company_sequence_id);
CREATE INDEX idx_email_threads_direction ON email_threads(direction);
CREATE INDEX idx_email_threads_sentiment ON email_threads(sentiment);
CREATE INDEX idx_email_threads_received_at ON email_threads(received_at);
CREATE INDEX idx_company_sequences_next_action ON company_sequences(next_action);

COMMENT ON TABLE public.email_threads IS 'Stores all emails in a sequence conversation for context-aware AI responses';