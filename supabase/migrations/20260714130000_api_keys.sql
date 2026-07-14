-- Per-user API keys for the external campaign API (used by the MCP server / Claude Code).
-- Keys are shown to the user once; only a SHA-256 hash is stored.
CREATE TABLE IF NOT EXISTS public.api_keys (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name         text NOT NULL DEFAULT 'API key',
  key_prefix   text NOT NULL,              -- e.g. "lb_live_1a2b3c4d" (safe to display)
  key_hash     text NOT NULL,              -- SHA-256 hex of the full key
  scopes       text[] NOT NULL DEFAULT ARRAY['campaigns:create','campaigns:read'],
  last_used_at timestamptz,
  revoked_at   timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS api_keys_user_id_idx ON public.api_keys(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS api_keys_key_hash_idx ON public.api_keys(key_hash);

ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

-- Users can read their own keys (never exposes the hash to the client via the app's
-- select list — the UI selects only safe columns) and revoke (soft-delete) them.
DROP POLICY IF EXISTS "Users read own api keys" ON public.api_keys;
CREATE POLICY "Users read own api keys" ON public.api_keys
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users revoke own api keys" ON public.api_keys;
CREATE POLICY "Users revoke own api keys" ON public.api_keys
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users delete own api keys" ON public.api_keys;
CREATE POLICY "Users delete own api keys" ON public.api_keys
  FOR DELETE USING (auth.uid() = user_id);
-- Inserts happen via the service role (manage-api-keys edge function) which hashes the key.
