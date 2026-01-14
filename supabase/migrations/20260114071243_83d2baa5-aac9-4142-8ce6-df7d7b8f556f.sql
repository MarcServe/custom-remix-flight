-- Add super discovery fields to autonomous_discovery_settings
ALTER TABLE public.autonomous_discovery_settings
ADD COLUMN IF NOT EXISTS use_apify BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS apify_max_results INTEGER DEFAULT 100,
ADD COLUMN IF NOT EXISTS apify_search_radius INTEGER DEFAULT 20000,
ADD COLUMN IF NOT EXISTS auto_create_campaign BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS campaign_send_time TEXT DEFAULT '10:00',
ADD COLUMN IF NOT EXISTS campaign_template_id UUID,
ADD COLUMN IF NOT EXISTS daily_lead_target INTEGER DEFAULT 50,
ADD COLUMN IF NOT EXISTS exa_quality_weight INTEGER DEFAULT 100,
ADD COLUMN IF NOT EXISTS serpapi_quality_weight INTEGER DEFAULT 90,
ADD COLUMN IF NOT EXISTS apify_quality_weight INTEGER DEFAULT 85,
ADD COLUMN IF NOT EXISTS full_auto_mode BOOLEAN DEFAULT false;

-- Add source tracking to autonomous_leads
ALTER TABLE public.autonomous_leads
ADD COLUMN IF NOT EXISTS sources_used TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS source_breakdown JSONB,
ADD COLUMN IF NOT EXISTS campaign_id UUID;

-- Add foreign key for campaign_id (optional, campaigns table may not exist)
-- We'll handle this gracefully in the application layer