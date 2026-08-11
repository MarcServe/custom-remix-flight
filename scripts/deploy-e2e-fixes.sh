#!/usr/bin/env bash
# Deploy the E2E bug-fix branch to Supabase (migrations + critical edge functions).
# Requires:
#   export SUPABASE_ACCESS_TOKEN=...   # Dashboard → Account → Access Tokens
#   export SUPABASE_DB_PASSWORD=...    # Dashboard → Project Settings → Database
# Optional:
#   export VERCEL_TOKEN=...            # for frontend preview/prod

set -euo pipefail
cd "$(dirname "$0")/.."

PROJECT_REF="${SUPABASE_PROJECT_REF:-kgndpwzqohepotahnfeo}"

if [[ -z "${SUPABASE_ACCESS_TOKEN:-}" ]]; then
  echo "Missing SUPABASE_ACCESS_TOKEN. Create one at https://supabase.com/dashboard/account/tokens"
  exit 1
fi

echo "==> Linking project $PROJECT_REF"
npx supabase link --project-ref "$PROJECT_REF" ${SUPABASE_DB_PASSWORD:+-p "$SUPABASE_DB_PASSWORD"} || true

echo "==> Pushing migrations (campaign delete cascades + email_threads realtime)"
if [[ -n "${SUPABASE_DB_PASSWORD:-}" ]]; then
  npx supabase db push --password "$SUPABASE_DB_PASSWORD"
else
  npx supabase db push
fi

FUNCTIONS=(
  autonomous-lead-discovery
  send-sequence-email
  send-bulk-emails
  process-inbound-emails
  send-crm-email
  gmail-sync-replies
  personalize-sequence
  process-sequence-steps
)

echo "==> Deploying edge functions: ${FUNCTIONS[*]}"
for fn in "${FUNCTIONS[@]}"; do
  echo "---- $fn"
  npx supabase functions deploy "$fn" --project-ref "$PROJECT_REF"
done

if [[ -n "${VERCEL_TOKEN:-}" ]]; then
  echo "==> Deploying frontend to Vercel (prod)"
  npx vercel deploy --prod --token "$VERCEL_TOKEN" --yes
else
  echo "==> Skipping Vercel (set VERCEL_TOKEN to deploy frontend). Merge PR #6 into roundup for auto-deploy."
fi

echo "Done."
