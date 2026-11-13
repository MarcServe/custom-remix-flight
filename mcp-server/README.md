# LeadBoosters MCP server

Lets Claude (or any MCP client — Codex, Cursor, your own scripts) **load and schedule
email campaigns** in LeadBoosters. Sending happens automatically at the scheduled
London time, through the same pipeline as the app (dedupe, domain verification,
monthly limits, and no-reply follow-ups all still apply).

**Scope:** create + schedule + read status for email. Calling tools create **draft
queues only** — they never place calls or send cold SMS. A human screens TPS/CTPS
and clicks Call next lead in LeadBoosters.

## 1. Get an API key
In LeadBoosters: **Settings → API Keys → New API key**. Copy it (shown once). It looks
like `lb_live_…`.

## 2. Install
```bash
cd mcp-server
npm install
```

## 3. Add to Claude
**Claude Desktop** — edit `claude_desktop_config.json`:
```json
{
  "mcpServers": {
    "leadboosters": {
      "command": "node",
      "args": ["/ABSOLUTE/PATH/TO/mcp-server/index.mjs"],
      "env": { "LEADBOOSTERS_API_KEY": "lb_live_your_key_here" }
    }
  }
}
```

**Claude Code** — from the repo:
```bash
claude mcp add leadboosters --env LEADBOOSTERS_API_KEY=lb_live_your_key -- node ./mcp-server/index.mjs
```

Restart Claude. You'll see the `leadboosters` tools available.

## 4. Tools
- **create_campaign** — `{ name, subject, body_text?, body_html?, recipients:[{email,first_name?,last_name?,company?}], schedule_at? }`
  - `schedule_at`: London time `"2026-07-16T09:00"` (or full ISO). Omit → draft.
  - Subject/body support `{{firstName}} {{lastName}} {{fullName}} {{company}} {{email}}`.
- **list_campaigns** — recent campaigns + status/counts.
- **campaign_status** — `{ campaign_id }` → status + counts.

## Daily sending
This server is stateless — to send daily, have your automation (a Claude Code
scheduled task, a cron, etc.) call **create_campaign** once a day with that day's
list and a `schedule_at` for when it should go out. LeadBoosters handles the send.

## Raw API (no MCP)
```bash
curl -X POST https://kgndpwzqohepotahnfeo.supabase.co/functions/v1/api-campaigns \
  -H "x-api-key: lb_live_your_key" -H "Content-Type: application/json" \
  -d '{"action":"create","name":"Daily","subject":"Hi {{firstName}}","body_text":"...","recipients":[{"email":"jane@acme.com","first_name":"Jane"}],"schedule_at":"2026-07-16T09:00"}'
```

## Newsletters
- **create_newsletter** — `{ subject, title?, body_html?, body_text?, audience?, schedule_at? }`
  - `audience`: `{ "all_active": true }` (default) or `{ "group_ids": ["…"] }` / `{ "tag_ids": ["…"] }`.
  - Sends to your subscriber base at `schedule_at` (London). Omit → draft.

## Send a test first
- **send_test** — `{ to_email, subject, body_html?, body_text? }` sends one email now from
  your active sender, so you can eyeball it before scheduling a real run. Surfaces the real
  provider error (e.g. "domain not verified") if the sender isn't ready.

## Daily cadence (agent-triggered)
The API/MCP is stateless — schedule the *cadence* on your side and call the API each day.

**Option A — shell cron:** see `examples/daily-campaign.sh` (build today's list, schedule at 09:00 London).
```
# crontab -e
0 6 * * *  LEADBOOSTERS_API_KEY=lb_live_...  /path/to/mcp-server/examples/daily-campaign.sh
```

**Option B — Claude Code scheduled task:** create a routine that runs daily and tells Claude:
> "Using the leadboosters MCP: build today's recipient list from <your source>, send_test to me first, then create_campaign scheduled for 09:00 London."

Claude will call `send_test` then `create_campaign` via this server on each run.
