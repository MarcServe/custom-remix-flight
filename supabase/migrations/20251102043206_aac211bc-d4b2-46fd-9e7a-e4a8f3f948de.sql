-- Phase 1: Fix email_threads to support standalone emails

-- Step 1: Make company_sequence_id nullable to support standalone emails
ALTER TABLE email_threads 
ALTER COLUMN company_sequence_id DROP NOT NULL;

-- Step 2: Drop old restrictive policies
DROP POLICY IF EXISTS "Users can insert threads for their sequences" ON email_threads;
DROP POLICY IF EXISTS "Users can view threads of their sequences" ON email_threads;
DROP POLICY IF EXISTS "Users can update threads of their sequences" ON email_threads;

-- Step 3: Add new policies that support both standalone and sequence emails
CREATE POLICY "Users can insert email threads"
ON email_threads
FOR INSERT
WITH CHECK (
  auth.uid() IS NOT NULL AND (
    -- Allow standalone emails (no sequence)
    company_sequence_id IS NULL
    OR
    -- Allow sequence emails they own
    EXISTS (
      SELECT 1
      FROM company_sequences cs
      JOIN email_sequences es ON cs.sequence_id = es.id
      WHERE cs.id = email_threads.company_sequence_id
      AND es.created_by = auth.uid()
    )
  )
);

CREATE POLICY "Users can view email threads"
ON email_threads
FOR SELECT
USING (
  auth.uid() IS NOT NULL AND (
    -- Allow standalone emails
    company_sequence_id IS NULL
    OR
    -- Allow sequence emails they own
    EXISTS (
      SELECT 1
      FROM company_sequences cs
      JOIN email_sequences es ON cs.sequence_id = es.id
      WHERE cs.id = email_threads.company_sequence_id
      AND es.created_by = auth.uid()
    )
  )
);

CREATE POLICY "Users can update email threads"
ON email_threads
FOR UPDATE
USING (
  auth.uid() IS NOT NULL AND (
    -- Allow standalone emails
    company_sequence_id IS NULL
    OR
    -- Allow sequence emails they own
    EXISTS (
      SELECT 1
      FROM company_sequences cs
      JOIN email_sequences es ON cs.sequence_id = es.id
      WHERE cs.id = email_threads.company_sequence_id
      AND es.created_by = auth.uid()
    )
  )
);

-- Step 4: Create the missing thread for the existing email
INSERT INTO email_threads (
  company_sequence_id,
  from_email,
  to_email,
  subject,
  body_text,
  body_html,
  direction,
  thread_id,
  message_id,
  received_at,
  created_at
)
SELECT
  NULL,
  COALESCE((metadata->>'from_email')::text, 'michaelorji5111@gmail.com'),
  (metadata->>'to_email')::text,
  subject,
  body,
  body,
  'outbound',
  thread_id,
  external_message_id,
  sent_at,
  sent_at
FROM email_activities
WHERE id = '412c3110-b61d-4ffd-8f3a-78fa2451a7f3'
ON CONFLICT DO NOTHING;