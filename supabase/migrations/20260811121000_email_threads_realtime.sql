-- Enable realtime for Conversations inbox updates
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'email_threads'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.email_threads;
  END IF;
END $$;
