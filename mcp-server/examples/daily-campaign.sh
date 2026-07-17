#!/usr/bin/env bash
# Daily campaign — schedule a send to a saved Recipient Group every morning.
# Run once a day via cron / launchd / a Claude Code scheduled task.
#
#   1) In LeadBoosters, open Recipient Groups and copy the group's id from the URL/row.
#   2) Put your API key + group id below (or as env vars). Keep the key private.
#   3) chmod +x daily-campaign.sh   then add to cron (see README).

set -euo pipefail
API_KEY="${LEADBOOSTERS_API_KEY:?set LEADBOOSTERS_API_KEY}"
API_URL="${LEADBOOSTERS_API_URL:-https://kgndpwzqohepotahnfeo.supabase.co/functions/v1/api-campaigns}"
GROUP_ID="${LEADBOOSTERS_GROUP_ID:?set LEADBOOSTERS_GROUP_ID to a recipient group id}"
TODAY="$(date +%Y-%m-%d)"

curl -sS -X POST "$API_URL" \
  -H "x-api-key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"action\": \"create\",
    \"name\": \"Daily outreach $TODAY\",
    \"subject\": \"Quick note for {{firstName}}\",
    \"body_text\": \"Hi {{firstName}},\n\nSharing today's update...\n\nThanks!\",
    \"group_ids\": [\"$GROUP_ID\"],
    \"schedule_at\": \"${TODAY}T09:00\"
  }"
echo
