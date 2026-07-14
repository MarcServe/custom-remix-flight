# LeadBoosters MCP server

Lets Claude (or any MCP client — Codex, Cursor, your own scripts) **load and schedule
email campaigns** in LeadBoosters. Sending happens automatically at the scheduled
London time, through the same pipeline as the app (dedupe, domain verification,
monthly limits, and no-reply follow-ups all still apply).

**Scope:** create + schedule + read status. No "send now" and no pause/delete — the
safest surface for automation that touches real inboxes.

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
