-- Add configurable Perplexity enrichment limit and overnight preparation settings
ALTER TABLE public.autonomous_discovery_settings
ADD COLUMN IF NOT EXISTS max_perplexity_enriched INTEGER DEFAULT 20,
ADD COLUMN IF NOT EXISTS pre_discovery_hours INTEGER DEFAULT 0;

-- Add comment for documentation
COMMENT ON COLUMN public.autonomous_discovery_settings.max_perplexity_enriched IS 'Maximum number of leads to enrich with Perplexity AI research (default 20)';
COMMENT ON COLUMN public.autonomous_discovery_settings.pre_discovery_hours IS 'Hours before delivery time to start discovery (0 = run at delivery time, 6 = overnight mode)';