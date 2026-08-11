#!/usr/bin/env bash
# One-shot hospitality ingest → US + UK groups, campaigns, newsletters.
# Requires an API key from LeadBoosters → Settings → API Keys.
#
#   export LEADBOOSTERS_API_KEY=lb_live_...
#   export LEADBOOSTERS_APP_URL=https://your-app.example
#   ./hospitality-ingest.sh

set -euo pipefail
API_KEY="${LEADBOOSTERS_API_KEY:?set LEADBOOSTERS_API_KEY}"
API_URL="${LEADBOOSTERS_API_URL:-https://kgndpwzqohepotahnfeo.supabase.co/functions/v1/ingest-hospitality-leads}"
APP_URL="${LEADBOOSTERS_APP_URL:?set LEADBOOSTERS_APP_URL to your deployed app origin}"

curl -sS -X POST "$API_URL" \
  -H "x-api-key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"action\": \"ingest\",
    \"markets\": [\"US\", \"UK\"],
    \"leads_base_url\": \"$APP_URL\",
    \"create_crm\": true,
    \"create_campaigns\": true,
    \"create_newsletters\": true,
    \"create_newsletter_series\": true
  }"
echo

# Opt into daily cron (same settings)
curl -sS -X POST "$API_URL" \
  -H "x-api-key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"action\": \"enable_daily\",
    \"markets\": [\"US\", \"UK\"],
    \"leads_base_url\": \"$APP_URL\"
  }"
echo
