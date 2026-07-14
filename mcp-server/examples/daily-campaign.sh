#!/usr/bin/env bash
# Daily campaign example — run once a day via cron or a Claude Code scheduled task.
# It builds "today's" recipient list however you like (here: a static file) and
# schedules a campaign to go out at 09:00 London the same day.
#
# Setup:
#   export LEADBOOSTERS_API_KEY=lb_live_...
#   chmod +x daily-campaign.sh
#   # crontab -e  →  0 6 * * *  /path/to/daily-campaign.sh   (runs 06:00 daily)

set -euo pipefail
: "${LEADBOOSTERS_API_KEY:?set LEADBOOSTERS_API_KEY}"
API_URL="${LEADBOOSTERS_API_URL:-https://kgndpwzqohepotahnfeo.supabase.co/functions/v1/api-campaigns}"
TODAY="$(date +%Y-%m-%d)"

# Build today's recipients JSON. Replace this with your own source (DB query, CSV, API…).
RECIPIENTS='[{"email":"jane@acme.com","first_name":"Jane"},{"email":"sam@beta.co","first_name":"Sam"}]'

curl -sS -X POST "$API_URL" \
  -H "x-api-key: $LEADBOOSTERS_API_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"action\": \"create\",
    \"name\": \"Daily outreach $TODAY\",
    \"subject\": \"Quick note for {{firstName}}\",
    \"body_text\": \"Hi {{firstName}},\n\nSharing today's update...\n\nThanks!\",
    \"recipients\": $RECIPIENTS,
    \"schedule_at\": \"${TODAY}T09:00\"
  }"
echo
