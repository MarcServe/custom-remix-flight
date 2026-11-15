# Connect LeadBoosters to Claude, ChatGPT and other AI assistants

LeadBoosters has a hosted **MCP server**. Connect it once and your AI assistant can work
your CRM directly: find and save contacts, build groups, write and send on-brand
email and SMS campaigns, run newsletters and follow-up sequences, and report on results —
by instruction, with nothing to copy and paste.

## Your connection URL

1. In LeadBoosters go to **Settings → API Keys → New API key**. Copy the key (it starts
   with `lb_live_` and is shown once).
2. Your personal connection URL is:

```
https://kgndpwzqohepotahnfeo.supabase.co/functions/v1/mcp?key=lb_live_YOUR_KEY
```

Treat this URL like a password: anyone who has it can act in your account. You can
revoke a key at any time under Settings → API Keys, which disconnects every assistant
using it.

---

## Claude.ai (web, desktop and mobile apps)

Custom connectors are available on Claude Pro, Max, Team and Enterprise.

1. Open **Settings → Connectors** (on Team/Enterprise an admin does this under
   Organization settings → Connectors).
2. Click **Add custom connector**.
3. Name: `LeadBoosters`. Remote MCP server URL: your connection URL from above.
   Leave the OAuth fields empty.
4. Click **Add**, then **Connect**.
5. In any chat, open the tools menu (the **+** or sliders icon) and make sure
   **LeadBoosters** is switched on.

Because the connector is on your account, it works in the browser, the desktop app and
the mobile apps at the same time.

## Claude Desktop (manual config, works on every plan)

If you prefer a config file, or you're on the free plan:

1. Open **Settings → Developer → Edit Config**. This opens `claude_desktop_config.json`.
2. Add:

```json
{
  "mcpServers": {
    "leadboosters": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "https://kgndpwzqohepotahnfeo.supabase.co/functions/v1/mcp?key=lb_live_YOUR_KEY"]
    }
  }
}
```

3. Save and restart Claude Desktop. Node.js 18+ must be installed.

## Claude Code

```bash
claude mcp add --transport http leadboosters "https://kgndpwzqohepotahnfeo.supabase.co/functions/v1/mcp?key=lb_live_YOUR_KEY"
```

Add `--scope user` to make it available in every project. Check with `claude mcp list`
or `/mcp` inside a session.

## ChatGPT

Connectors with full tool access need **Developer mode** (Plus, Pro, Business, Enterprise
and Edu).

1. **Settings → Connectors → Advanced settings** and turn on **Developer mode**.
2. Back in **Connectors**, click **Create**.
3. Name: `LeadBoosters`. MCP Server URL: your connection URL. Authentication: **No
   authentication** (your key is already in the URL). Tick the acknowledgement and
   click **Create**.
4. In a new chat, open **+ → More → Developer mode** and enable **LeadBoosters**.

ChatGPT's **Deep research** mode only uses two tools, `search` and `fetch`; LeadBoosters
provides both, so research reports can pull from your CRM too.

## Cursor

**Settings → MCP → Add new global MCP server**, then add:

```json
{
  "mcpServers": {
    "leadboosters": {
      "url": "https://kgndpwzqohepotahnfeo.supabase.co/functions/v1/mcp?key=lb_live_YOUR_KEY"
    }
  }
}
```

Windsurf, VS Code (GitHub Copilot agent mode) and OpenAI Codex accept the same URL in
their own MCP settings.

## Developers: call it directly

Every tool is also a plain JSON action on `POST …/functions/v1/api-campaigns` with the
`x-api-key` header. Send `{"action":"anything"}` to get the full action list back.

---

## What the assistant can do

| Area | Examples of what to say |
|---|---|
| Contacts & companies | "Add Jane Doe at Acme as a contact and tag her *hotel*." / "Who do we have at Mercure?" |
| Groups | "Put every contact tagged *hotel* in Manchester into a group called *Manchester hotels*." |
| Email campaigns | "Write an on-brand HTML email introducing our booking assistant, create it as a draft for *Manchester hotels*, and send me a test." then "Send it now." |
| SMS campaigns | "Text everyone in *Route Local Bristol*: *Hi {name}, Mike at Route Local…* — save as a draft." |
| Newsletters | "Create next month's newsletter from these three points and schedule it for the 1st at 9am." |
| Follow-ups | "Are follow-ups working?" / "Enrol the *Manchester hotels* group in the Day 1/3/5 sequence." / "Schedule a follow-up text for the Bristol campaign in 3 days." |
| Deals & reporting | "Open a £2,500 deal with Mercure at Proposal stage." / "How did the TalkStay UK campaign do?" |
| Finding new leads | "Find 20 independent opticians in Leeds and save them." / "What did Autopilot find today?" / "Approve the ones with an email." / "Retarget Autopilot at housing associations in Greater Manchester and run it now." |

Anything that sends real messages (send now, send newsletter, enrol in a sequence) is
flagged to the assistant so it confirms with you first unless you've already said to send.

---

## "Why not just use Claude or ChatGPT on their own?"

An assistant on its own can write a great email. It can't send it, remember who it went
to, or chase the people who didn't reply. That's what LeadBoosters adds underneath:

- **A system of record.** Contacts, companies, groups, deals and every campaign ever sent
  live in LeadBoosters, so "the Manchester hotels we emailed in August" is a real list,
  not something to paste in again. Chats are forgotten; your CRM isn't.
- **Sending infrastructure.** Verified sender domains, Gmail/Resend/SendGrid and Twilio
  SMS, rate limits, bounce and unsubscribe handling, STOP opt-outs, and deliverability
  monitoring. Assistants don't have an outbox.
- **Automation that runs when you're not chatting.** Hourly follow-up sequences that stop
  the moment someone replies, scheduled sends, newsletter series, daily lead discovery.
- **Measurement.** Opens, clicks, replies and bounces per campaign, pipeline by stage,
  dashboards your team can look at without asking anyone.
- **A team, not a tab.** Shared inbox, conversations, multiple users, one source of truth.
- **Any assistant, same data.** Connect Claude today and ChatGPT tomorrow; both act on the
  same CRM, with your branding, your senders and your history.

In short: the assistant is the interface. LeadBoosters is the memory and the engine.
