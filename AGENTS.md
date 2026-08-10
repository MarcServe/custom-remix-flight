# AGENTS.md

## Cursor Cloud specific instructions

LeadBoosters CRM is a Vite + React + TypeScript single-page app (shadcn/ui) whose
backend is a **hosted, remote Supabase project** (Postgres + Auth + Realtime +
Storage + Deno edge functions). There is no local backend to boot for normal
development.

### Services

| Service | Command | Notes |
|---------|---------|-------|
| Frontend dev server (Vite) | `npm run dev` | Serves at `http://127.0.0.1:5173/` (see `vite.config.ts`). `npm run dev:fresh` first frees dev ports via `scripts/kill-dev-ports.sh`. |
| Backend (Supabase) | none to start | The app talks to a **remote** Supabase project whose URL + anon key are hardcoded in `src/integrations/supabase/client.ts`. It is reachable directly; you do NOT need `supabase start` for normal frontend dev. |

Standard scripts live in `package.json`: `dev`, `build`, `build:dev`, `lint`,
`preview`. There is no automated test suite (no `test` script, no test runner).

### Non-obvious caveats

- **Backend is remote and hardcoded.** `src/integrations/supabase/client.ts` is an
  auto-generated file with a hardcoded `SUPABASE_URL` + anon key. The main
  `supabase` client ignores env vars, so copying `.env.example` to `.env` does NOT
  repoint the app at a local Supabase. Only three direct-`fetch` call sites read
  `VITE_SUPABASE_URL` (`LeadInbox.tsx`, `ResearchChatSlideOut.tsx`,
  `BulkEmailDialog.tsx`), and `BulkEmailDialog` falls back to the same hardcoded
  URL. A `.env` is therefore optional for running the app.
- **Signup requires email confirmation.** The remote Supabase has
  `mailer_autoconfirm = false`, so a brand-new email/password signup creates the
  account but returns NO session — you must click an emailed verification link
  before you can sign in. To test the authenticated CRM you need an
  already-confirmed account's credentials (or Google OAuth). The signup form
  itself still works end-to-end (account is created; a "check your email" toast
  shows).
- **`eslint .` also lints the Deno edge functions** under `supabase/functions/`,
  which currently report many pre-existing errors (mostly
  `@typescript-eslint/no-explicit-any`). These are pre-existing and are not caused
  by environment setup; `npm run lint` runs fine, it just exits non-zero due to
  those existing findings.
- **Vite build emits large-chunk warnings** and a dynamic/static import warning for
  `client.ts`; these are informational only — the build succeeds.
- **Three lockfiles exist** (`package-lock.json`, `pnpm-lock.yaml`, `bun.lockb`).
  Use **npm** (`npm install`) — it matches the README and `.claude/launch.json`.
- Optional integrations (AI providers, Resend email, Nango OAuth, Stripe, Exa/
  GetProspect enrichment, Sentry, Langfuse) are configured as Supabase edge-function
  secrets / optional `VITE_*` vars and are not needed to run or browse the app.
