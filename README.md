<div align="center">

# LeadGeni CRM

AI-assisted lead generation, outreach, and sales operations built with React, Supabase, and edge functions.

![LeadGeni screenshot](public/placeholder.svg)

</div>

## Table of Contents

- [Overview](#overview)
- [Feature Highlights](#feature-highlights)
- [System Architecture](#system-architecture)
- [Tech Stack](#tech-stack)
- [Development Workflow](#development-workflow)
- [Local Environment Setup](#local-environment-setup)
- [Running the App Locally](#running-the-app-locally)
- [Supabase Database & Edge Functions](#supabase-database--edge-functions)
- [Environment Variables](#environment-variables)
- [Email & Integrations](#email--integrations)
- [Branching & Deployment](#branching--deployment)
- [Testing & Quality](#testing--quality)
- [Troubleshooting](#troubleshooting)
- [License](#license)

## Overview

LeadGeni is a modern CRM focused on AI-powered prospecting, automated outreach sequences, and collaborative sales workflows. The product pairs a Vite/React single-page app with Supabase for authentication, database, real-time updates, and edge functions. Third-party integrations handle email connectivity (Nango + Gmail/Outlook, SMTP, Resend) and AI enrichment (Lovable AI, OpenAI, Perplexity, Exa, GetProspect).

This repository contains everything required to run the LeadGeni frontend, Supabase schema, migrations, and edge functions. It is currently deployed to Vercel (frontend) and Supabase (backend) with Lovable managing AI-assisted commits.

## Feature Highlights

- **AI Lead Finder** – Filter by geography, company size, and industry, then enrich companies using AI providers and third-party data sources.
- **Email Outreach & Sequences** – Compose sequences, send one-off emails, track deliveries, opens, clicks, bounces, and replies via Resend webhooks.
- **Inbox & Threads** – (In progress) Receive replies via Supabase edge function `process-inbound-emails`; map incoming mail to sequences and threads.
- **Integrations Hub** – Connect Gmail/Outlook accounts through Nango OAuth, configure SMTP, verify sender addresses, and monitor connection status.
- **CRM Pipelines** – Manage companies, deals, people, and sequences with Kanban boards, dialogs, and dashboards built on shadcn/ui.
- **Collaboration** – Teams, shared inboxes, invitations, and role-based access (see migration `20251101023000_create_collaboration_tables.sql`).
- **Real-time UX** – React Query + Supabase real-time keep pipelines and notifications in sync.

## System Architecture

```
Vite/React (LeadGeni SPA)
│
├── Supabase Auth & Database (Postgres + RLS)
│   ├── Tables: companies, deals, email_activities, crm_connections, teams, shared_inboxes, …
│   ├── SQL migrations under `supabase/migrations`
│   └── Realtime subscriptions for notifications & pipelines
│
├── Supabase Edge Functions (`supabase/functions`)
│   ├── lead-finder          : orchestrates Exa + AI providers + enrichment
│   ├── ai-provider          : abstraction over Lovable AI / OpenAI / Perplexity
│   ├── send-sequence-email  : transactional email send via Nango/Resend
│   ├── email-webhook        : processes Resend events (opens, clicks, replies)
│   ├── process-inbound-emails (pending download): stores inbound replies
│   ├── nango-oauth-init & nango-webhook          : manage email OAuth flow
│   ├── send-team-invitation                      : email invitations
│   └── additional helper functions (verify-email, test-smtp, etc.)
│
└── Third-party Services
    ├── Nango (OAuth for Gmail/Outlook)
    ├── Resend (email delivery + webhooks)
    ├── Exa, GetProspect (lead enrichment APIs)
    ├── Lovable AI / OpenAI / Perplexity (AI generation)
    └── Vercel (hosting) + Supabase (backend hosting)
```

## Tech Stack

- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui, React Router, TanStack Query, Zustand
- **Backend**: Supabase Postgres, Supabase Auth, Supabase Edge Functions (Deno)
- **AI & Data**: Lovable AI, OpenAI, Perplexity, Exa, GetProspect
- **Email**: Nango OAuth (Gmail/Outlook), SMTP, Resend webhooks
- **Tooling**: ESLint, TypeScript, Supabase CLI, Vercel, GitHub Actions

## Development Workflow

- **Lovable-generated commits** land on `main` (default branch for the Lovable agent).
- **Human review & deployment** happens on `roundup`. Merge or cherry-pick from `main` → `roundup` before deploying to Vercel.
- Feature branches (e.g., `UIresponsiveness`) branch off `roundup`, then merge back through pull requests.
- GitHub Actions (`.github/workflows/main.yml`) runs CI on pushes and PRs.

## Local Environment Setup

### Prerequisites

- Node.js ≥ 18 (recommend using [nvm](https://github.com/nvm-sh/nvm))
- npm (bundled with Node) or pnpm/yarn
- [Supabase CLI](https://supabase.com/docs/reference/cli/installation) for local database/functions
- (Optional) [Vercel CLI](https://vercel.com/docs/cli) for preview deployments

### Install dependencies

```bash
git clone https://github.com/MarcServe/custom-remix-flight.git
cd custom-remix-flight
npm install
```

### Environment files

Create `.env` in the project root (used by Vite) and `.env.local` or environment secrets for Supabase CLI:

```bash
cp .env.example .env         # create this file manually if not present
```

Populate values as described in [Environment Variables](#environment-variables).

## Running the App Locally

1. **Start Supabase locally** (spins up Postgres + GoTrue + storage + edge runtime):

   ```bash
   supabase start
   ```

   Apply migrations (optional; `supabase start` handles initial schema):

   ```bash
   supabase db reset  # drops and re-runs migrations in supabase/migrations
   ```

2. **Run the Vite dev server**:

   ```bash
   npm run dev
   ```

   The app is available at `http://localhost:5173`.

3. **Invoke edge functions locally** using Supabase CLI:

   ```bash
   supabase functions serve lead-finder
   supabase functions serve send-sequence-email
   # ... run in separate terminals as needed
   ```

## Supabase Database & Edge Functions

- SQL schema lives in `supabase/migrations`. Recent additions include:
  - `20251101023000_create_collaboration_tables.sql` – teams, shared inboxes, invitations.
  - Earlier migrations defining CRM tables (`companies`, `deals`, `email_activities`, `crm_connections`, etc.).
- Edge functions are in `supabase/functions/<name>/index.ts`. Key ones:
  - `lead-finder` – orchestrates Exa + AI providers + enrichment and optional inserts.
  - `ai-provider` – routes AI requests to Lovable/OpenAI/Perplexity.
  - `email-webhook` – handles delivery/open/reply/bounce events from Resend.
  - `nango-oauth-init` / `nango-webhook` – manage OAuth session tokens and connection storage.
  - `send-sequence-email` / `send-sequence-emails` / `send-crm-email` – outbound email actions.
  - `send-team-invitation` – generates invite tokens and sends via Resend.
  - `verify-email` & `send-verification-email` – sender verification flow.
  - `process-inbound-emails` – ingest replies (ensure handler populates `from_email`).

### Deploying Edge Functions

```bash
supabase functions deploy lead-finder
supabase functions deploy email-webhook
# or deploy all with:
supabase functions deploy --project-ref <project-ref>
```

Remember to set secrets (below) in Supabase before deploying.

## Environment Variables

The project reads variables from multiple places (Vite, Supabase functions, Vercel). Below are the canonical names and expected sources:

| Scope | Key | Description |
|-------|-----|-------------|
| Frontend (Vite) | `VITE_SUPABASE_URL` | Supabase project URL |
| Frontend (Vite) | `VITE_SUPABASE_ANON_KEY` | Supabase anon/key for browser |
| Frontend (optional) | `VITE_APP_ENV`, `VITE_APP_URL` | UI toggles / base URL |
| Frontend (optional) | `VITE_SENTRY_DSN` | Sentry DSN; when set, error/performance monitoring is enabled |
| Frontend (optional) | `VITE_SENTRY_TRACES_SAMPLE_RATE` | Float (0–1) for transaction sampling |
| Frontend (optional) | `VITE_SENTRY_REPLAYS_SESSION_SAMPLE_RATE` | Float (0–1) for session replay sampling |
| Frontend (optional) | `VITE_SENTRY_REPLAYS_ON_ERROR_SAMPLE_RATE` | Sampling for replay on error |
| Supabase Functions | `SUPABASE_URL` | Same as above |
| Supabase Functions | `SUPABASE_ANON_KEY` | Public anon key |
| Supabase Functions | `SUPABASE_SERVICE_ROLE_KEY` | Service role (server-side write access) |
| Supabase Functions | `NANGO_SECRET_KEY` | Secret from Nango dashboard |
| Supabase Functions | `RESEND_API_KEY` | Resend transactional email key |
| Supabase Functions | `APP_URL` / `APP_BASE_URL` | Base URL for email links |
| Supabase Functions | `EXA_API_KEY` | Exa search API key |
| Supabase Functions | `GETPROSPECT_API_KEY` | Contact enrichment key |
| Supabase Functions | `LOVABLE_API_KEY` | Lovable AI key |
| Supabase Functions | `OPENAI_API_KEY` | (Optional) OpenAI key when using OpenAI provider |
| Supabase Functions | `PERPLEXITY_API_KEY` | (Optional) Perplexity key |
| Supabase Functions | `AI_PROVIDER` | Default provider (`lovable`, `openai`, `perplexity`) |
| Supabase Functions | `NANGO_WEBHOOK_SECRET` | (optional) verify Nango webhooks |
| Supabase Functions | `RESEND_WEBHOOK_SECRET` | (optional) verify Resend webhooks |
| Build (optional) | `SENTRY_AUTH_TOKEN` | Needed for Sentry source map upload (set in CI/Vercel) |
| Build (optional) | `SENTRY_ORG`, `SENTRY_PROJECT` | Sentry identifiers used by the Vite plugin |

Configure matching secrets in Vercel (Frontend) and Supabase (edge functions). When `VITE_SENTRY_DSN` is provided, the app automatically initializes Sentry (`src/sentry/client.ts`). To validate the integration, render the test button and click it; the exception should appear in Sentry within seconds.

## Email & Integrations

- **Nango OAuth** – `nango-oauth-init` creates Connect sessions; `nango-webhook` stores connections mapped to Supabase users. Ensure integration IDs (`google-mail`, `microsoft-outlook`) exist in Nango and redirect URIs include `https://api.nango.dev/oauth/callback`.
- **Resend** – `send-sequence-email(s)` deliver via Resend’s API. Webhooks (`email-webhook`) capture events and update `email_activities`. Make sure webhook endpoints in Resend point to `https://<project>.supabase.co/functions/v1/email-webhook`.
- **Inbound Replies** – Configure Resend inbound processing to hit `process-inbound-emails`. Error “null value in column `from_email`” means the handler must populate required fields before inserting.
- **Lead Enrichment** – `lead-finder` uses Exa for initial results, Perplexity for enrichment, and GetProspect for contacts (all optional depending on API keys).

## Branching & Deployment

- **Branches**
  - `main` – Lovable automation output. Do **not** deploy directly.
  - `roundup` – Manually curated branch for staging/production deployments.
  - Feature branches (e.g., `UIresponsiveness`) – branch from `roundup`, merge back via PR.

- **GitHub Actions** – `.github/workflows/main.yml` runs lint/build on `roundup` and PRs.

- **Vercel**
  - Production branch: `roundup`.
  - Preview deployments: any other branch pushed to GitHub.
  - If you need to deploy Lovable commits instantly, merge `main` → `roundup` or temporarily point Production to `main`.
  - Vercel free tier limits to 100 deployments/day; heavy Lovable runs may hit this cap.

## Testing & Quality

- **Linting** – `npm run lint` (ESLint 9 + TypeScript).
- **Type Checking** – TypeScript configured via `tsconfig.json` and `tsconfig.app.json`.
- **Manual QA** – Verify lead finder flows, email send/receive, OAuth connections, team collaboration module, and Supabase policies.
- **Future Enhancements** – Add automated tests (Vitest/Playwright), extend CI to cover Supabase migrations (`supabase db lint`), integrate preview comments.

## Troubleshooting

- **Leads disappear after search** – Ensure `useUIStore` caches `LeadFinderResponse`; fix lives in `src/pages/LeadFinder.tsx`.
- **Nango OAuth fails** – Verify Supabase function secrets (`NANGO_SECRET_KEY`) and integration IDs. Check `supabase/functions/nango-oauth-init/index.ts` logs.
- **Inbound emails not visible** – Review Resend webhook logs; “null value in column `from_email`” means `process-inbound-emails` must capture sender addresses before inserting.
- **Vercel doesn’t show latest commits** – Confirm merges from `main` → `roundup`. Vercel only builds the branch configured as Production.
- **Deployment rate limit** – Vercel free tier caps API deployments at 100/day. Wait for reset or upgrade to avoid `api-deployments-free-per-day` errors.

## License

Proprietary – LeadGeni CRM is an internal project. Do not distribute without permission from the RevGeni/Biz Boosters team.

---

Need help or have questions? Reach out to the engineering team via Slack or open an issue in GitHub.
