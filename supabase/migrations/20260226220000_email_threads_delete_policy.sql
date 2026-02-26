-- Allow users to delete email threads they can view (own sequence or standalone)
CREATE POLICY "Users can delete email threads"
ON email_threads
FOR DELETE
USING (
  auth.uid() IS NOT NULL AND (
    company_sequence_id IS NULL
    OR
    EXISTS (
      SELECT 1
      FROM company_sequences cs
      JOIN email_sequences es ON cs.sequence_id = es.id
      WHERE cs.id = email_threads.company_sequence_id
      AND es.created_by = auth.uid()
    )
  )
);
