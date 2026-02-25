-- A/B test (body) for bulk email campaigns: split recipients between two body variants and compare results.

-- Campaign: store variant B and test settings
ALTER TABLE public.email_campaigns
  ADD COLUMN IF NOT EXISTS ab_test_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ab_subject_b text,
  ADD COLUMN IF NOT EXISTS ab_body_html_b text,
  ADD COLUMN IF NOT EXISTS ab_body_text_b text,
  ADD COLUMN IF NOT EXISTS ab_traffic_split integer NOT NULL DEFAULT 50,
  ADD COLUMN IF NOT EXISTS ab_winner_metric text DEFAULT 'open_rate' CHECK (ab_winner_metric IS NULL OR ab_winner_metric IN ('open_rate', 'click_rate', 'reply_rate'));

COMMENT ON COLUMN public.email_campaigns.ab_test_enabled IS 'When true, recipients are split between variant A (main body) and variant B (ab_* body) for A/B test';
COMMENT ON COLUMN public.email_campaigns.ab_traffic_split IS 'Percent of recipients who get variant A (rest get B). E.g. 50 = 50/50 split';
COMMENT ON COLUMN public.email_campaigns.ab_winner_metric IS 'Metric used to compare variants: open_rate, click_rate, reply_rate';

-- Recipients: which variant each received (so we can aggregate opens/clicks/replies by variant)
ALTER TABLE public.email_campaign_recipients
  ADD COLUMN IF NOT EXISTS ab_variant text CHECK (ab_variant IS NULL OR ab_variant IN ('A', 'B'));

COMMENT ON COLUMN public.email_campaign_recipients.ab_variant IS 'A/B test variant this recipient received: A = main body, B = variant B body';
