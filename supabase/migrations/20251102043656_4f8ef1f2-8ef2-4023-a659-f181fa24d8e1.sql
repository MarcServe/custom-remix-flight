-- Phase 3: Add review workflow fields to auto_response_analytics

-- Add status field to track review state
ALTER TABLE auto_response_analytics
ADD COLUMN IF NOT EXISTS requires_review boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS review_status text DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS reviewed_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS reviewed_by uuid REFERENCES auth.users(id);

-- Add constraint for review_status values
ALTER TABLE auto_response_analytics
ADD CONSTRAINT valid_review_status 
CHECK (review_status IN ('pending', 'approved', 'rejected', 'sent'));

-- Create index for faster queries on pending reviews
CREATE INDEX IF NOT EXISTS idx_auto_response_pending_review 
ON auto_response_analytics(user_id, review_status, requires_review)
WHERE requires_review = true AND review_status = 'pending';