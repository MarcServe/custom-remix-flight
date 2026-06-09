# Pre-emptive Gmail Token Refresh

## Goal
Stop Gmail sends from failing when the access token is about to expire. Today the code only refreshes after `expires_at <= now`, so a token that expires mid-send (or has clock skew) breaks the request.

## Approach
Centralize Gmail token handling in one shared helper that all send functions reuse:

1. **Refresh proactively** when the token expires within the next 5 minutes (configurable buffer), not only when already expired.
2. **Retry on 401** — if Gmail returns 401 `invalid_credentials` despite a fresh token, force a refresh and retry the send once.
3. **Single source of truth** — replace duplicated inline token logic across send functions.

## Changes

### New shared helper: `supabase/functions/_shared/gmail-utils.ts`
Add two exports:

- `getValidGmailAccessToken(supabaseClient, connection, { bufferSeconds = 300 })` — returns a valid `access_token`. Refreshes via the existing `gmail-oauth-refresh` edge function when `expires_at - now <= bufferSeconds` (or missing). Throws a clear error on failure.
- `sendGmailMessage(supabaseClient, connection, rawMessage)` — wraps the `POST /gmail/v1/users/me/messages/send` call. Uses the helper above; if Gmail responds 401, forces one refresh + retry, then surfaces the error.

### Updated callers (use the helper, remove inline refresh blocks)
- `supabase/functions/send-test-email/index.ts` (3 occurrences around lines 184–211, 374–407, 559–585)
- `supabase/functions/send-crm-email/index.ts` (~line 295–332)
- `supabase/functions/send-newsletter/index.ts` (~line 586–635)
- `supabase/functions/send-ai-response/index.ts` (~line 227–290)

Each caller stops computing `expiresAt` itself and just calls `getValidGmailAccessToken(...)` (or `sendGmailMessage(...)` where convenient). Error messages preserved ("Please reconnect your Gmail account.").

### Out of scope
- `send-bulk-emails` and `send-sequence-emails` Gmail paths go through Nango, not the direct Gmail API — no token-expiry handling needed there.
- `gmail-oauth-refresh` edge function itself is unchanged (already updates `crm_connections.metadata.access_token` / `expires_at`).
- No DB schema changes.
- No frontend changes.

## Verification
- After build, check `supabase--edge_function_logs` for `send-test-email` on a fresh send: should log "Gmail token within refresh buffer, refreshing..." when token is close to expiry, and succeed without 401.
- Existing already-expired path still works (buffer covers it).
