# LeadBoosters MCP server

Lets Claude (Claude.ai, Claude Desktop, Claude Code), ChatGPT, Cursor, Codex, or your own
scripts **work your LeadBoosters CRM directly**: look up and save contacts and companies,
build recipient groups, write and send HTML email campaigns and SMS campaigns, run
newsletters and follow-up sequences, and manage deals — all by instruction.

Sending goes through the same pipeline as the app, so dedupe, sender verification,
monthly limits, branding and the Day 1/3/5 no-reply follow-ups all still apply.

## Hosted server (recommended)

The server is hosted; there is nothing to run. Get an API key in LeadBoosters
(**Settings → API Keys → New API key**, starts with `lb_live_`) and use this URL:

```
https://kgndpwzqohepotahnfeo.supabase.co/functions/v1/mcp?key=lb_live_YOUR_KEY
```

- **Claude.ai** (Pro/Max/Team/Enterprise): Settings → Connectors → Add custom connector → paste the URL.
- **Claude Code**: `claude mcp add --transport http leadboosters "<url>"`
- **ChatGPT** (Developer mode): Settings → Connectors → Create → paste the URL, auth "None".
- **Cursor / Windsurf / Codex**: add `{ "url": "<url>" }` under `mcpServers`.

Full step-by-step for each app: [docs/connect-ai-assistants.md](../docs/connect-ai-assistants.md).

## Local stdio server (this folder)

`index.mjs` is a thin stdio proxy to the hosted server, for clients that only speak stdio
(e.g. Claude Desktop via config file without `mcp-remote`).

```bash
cd mcp-server && npm install
claude mcp add leadboosters --env LEADBOOSTERS_API_KEY=lb_live_your_key -- node /ABSOLUTE/PATH/TO/mcp-server/index.mjs
```

Claude Desktop `claude_desktop_config.json`:
```json
{ "mcpServers": { "leadboosters": { "command": "node", "args": ["/ABSOLUTE/PATH/TO/mcp-server/index.mjs"], "env": { "LEADBOOSTERS_API_KEY": "lb_live_your_key_here" } } } }
```

The tool catalogue lives in `supabase/functions/_shared/mcp-tools.ts`; the hosted server is
`supabase/functions/mcp`. Add a tool there (plus its `action` in `api-campaigns/crm.ts`) and
every client picks it up — no npm release needed.

## 4. Tools

| Area | Tools |
|---|---|
| Brand & senders | `get_business_profile` (read before writing copy — brand colour, logo, signature, tone), `list_senders` |
| Contacts | `search_contacts`, `get_contact`, `upsert_contact`, `update_contact` |
| Companies | `search_companies`, `upsert_company`, `update_company` |
| Groups | `list_groups`, `get_group`, `create_group`, `add_to_group`, `remove_from_group`, `delete_group` |
| Email campaigns | `create_campaign` (HTML/text, merge tags, schedule), `list_campaigns`, `get_campaign`, `update_campaign`, `send_test`, `send_campaign`, `unschedule_campaign` |
| SMS campaigns | `create_phone_campaign` (`{name}` / `{first_name}` / `{company}` tags, per-recipient messages, `send_now`) |
| Newsletters | `create_newsletter`, `list_newsletters`, `send_newsletter`, `list_subscribers`, `add_subscribers` |
| Deals | `list_deals`, `create_deal`, `update_deal` |
| Sequences & follow-ups | `list_sequences`, `get_sequence`, `create_sequence`, `update_sequence`, `enroll_in_sequence`, `list_enrollments`, `update_enrollment`, `run_sequences_now`, `sequence_health`, `schedule_sms_followup` |

Times (`schedule_at`) are UK wall-clock, e.g. `"2026-11-20T09:00"`; a full ISO
timestamp with a zone also works. Omit it to create a draft.

Email merge tags: `{{firstName}} {{lastName}} {{fullName}} {{company}} {{email}}`.
SMS merge tags: `{name} {first_name} {company} {phone}` (single or double braces).

### Example instructions
- "Find all contacts tagged *hotel* in Manchester and put them in a group called *Manchester hotels*."
- "Write an on-brand HTML email introducing our new booking assistant, create it as a draft for the *Manchester hotels* group, and send me a test."
- "Send campaign *Manchester hotels intro* now."
- "Text everyone in *Route Local Bristol* : *Hi {name}, Mike at Route Local…* — save as a draft first."
- "Add Jane Doe (jane@acme.com, Acme Ltd, Head of Ops) as a contact and open a £2,500 deal at Proposal stage."

`send_campaign` and `send_newsletter` send real messages immediately. Claude is told
to confirm with you first unless you already asked it to send.

## Raw API (no MCP)
Every tool is a JSON action on one endpoint:
```bash
curl -X POST https://kgndpwzqohepotahnfeo.supabase.co/functions/v1/api-campaigns \
  -H "x-api-key: lb_live_your_key" -H "Content-Type: application/json" \
  -d '{"action":"search_contacts","query":"acme","limit":20}'
```
Send `{"action":"anything"}` to get the full list of actions back in the error message.

## Daily sending
The server is stateless. For a daily send, have your automation (a Claude Code
scheduled task, cron, etc.) call `create_campaign` once a day with that day's
`group_ids` and a `schedule_at`. LeadBoosters sends at that time.
