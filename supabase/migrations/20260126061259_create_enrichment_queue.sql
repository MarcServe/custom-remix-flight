-- Create enrichment_queue table to stage leads before moving to CRM
-- This allows enrichment with Perplexity/Exa and email extraction before adding to main CRM

CREATE TABLE IF NOT EXISTS public.enrichment_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Lead information
  name TEXT NOT NULL,
  website TEXT,
  industry TEXT,
  geography TEXT,
  description TEXT,
  email TEXT,
  phone TEXT,
  linkedin_url TEXT,
  
  -- Source information
  source TEXT DEFAULT 'manual' CHECK (source IN ('manual', 'lead_finder', 'autopilot', 'import', 'apify', 'google_maps')),
  source_metadata JSONB,
  
  -- Enrichment status
  enrichment_status TEXT DEFAULT 'pending' CHECK (enrichment_status IN ('pending', 'enriching', 'enriched', 'failed', 'extracting_email', 'ready_for_crm')),
  enrichment_provider TEXT CHECK (enrichment_provider IN ('perplexity', 'exa', 'both')),
  
  -- Enrichment data
  enrichment_data JSONB,
  enrichment_errors TEXT[],
  
  -- Email extraction
  email_extraction_status TEXT DEFAULT 'pending' CHECK (email_extraction_status IN ('pending', 'extracting', 'extracted', 'failed', 'not_needed')),
  extracted_email TEXT,
  email_extraction_attempts INTEGER DEFAULT 0,
  
  -- Metadata
  metadata JSONB,
  notes TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  enriched_at TIMESTAMPTZ,
  moved_to_crm_at TIMESTAMPTZ
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_enrichment_queue_user_id ON enrichment_queue(user_id);
CREATE INDEX IF NOT EXISTS idx_enrichment_queue_status ON enrichment_queue(enrichment_status);
CREATE INDEX IF NOT EXISTS idx_enrichment_queue_email_status ON enrichment_queue(email_extraction_status);
CREATE INDEX IF NOT EXISTS idx_enrichment_queue_created_at ON enrichment_queue(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_enrichment_queue_source ON enrichment_queue(source);

-- Enable RLS
ALTER TABLE enrichment_queue ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own enrichment queue"
  ON enrichment_queue FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own enrichment queue items"
  ON enrichment_queue FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own enrichment queue items"
  ON enrichment_queue FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own enrichment queue items"
  ON enrichment_queue FOR DELETE
  USING (auth.uid() = user_id);

-- Add comments
COMMENT ON TABLE enrichment_queue IS 'Staging area for leads before they are enriched and moved to CRM';
COMMENT ON COLUMN enrichment_queue.enrichment_status IS 'Status of enrichment process: pending, enriching, enriched, failed, extracting_email, ready_for_crm';
COMMENT ON COLUMN enrichment_queue.email_extraction_status IS 'Status of email extraction: pending, extracting, extracted, failed, not_needed';

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_enrichment_queue_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_enrichment_queue_updated_at
  BEFORE UPDATE ON enrichment_queue
  FOR EACH ROW
  EXECUTE FUNCTION update_enrichment_queue_updated_at();
