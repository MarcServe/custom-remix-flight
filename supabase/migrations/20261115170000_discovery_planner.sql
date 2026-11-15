-- Autopilot discovery: planned search angles per run, extra sources, planner toggles.
ALTER TABLE public.discovery_runs
  ADD COLUMN IF NOT EXISTS search_queries jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS planner_method text,
  ADD COLUMN IF NOT EXISTS raw_found integer NOT NULL DEFAULT 0;
COMMENT ON COLUMN public.discovery_runs.search_queries IS 'The distinct search angles used in this run [{query, industry, geography, angle}]';
COMMENT ON COLUMN public.discovery_runs.raw_found IS 'Companies returned by all sources before de-duplication against the account';

ALTER TABLE public.autonomous_discovery_settings
  ADD COLUMN IF NOT EXISTS use_ai_planner boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS use_perplexity_search boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS queries_per_run integer NOT NULL DEFAULT 6 CHECK (queries_per_run BETWEEN 1 AND 10);

-- 'assistant' = found by the connected AI (MCP find_leads); 'perplexity' = new source
COMMENT ON COLUMN public.autonomous_leads.source IS 'lead-finder | exa | serpapi | google_maps | apify | perplexity | assistant';
