# Twilio calling + SMS (first version)

Human-assisted click-to-call. LeadBoosters is the control centre; Twilio is the
voice/SMS pipe; Work/ChatGPT prepares drafts and monitors results.

## What this version does

- Queue up to 20 properties with phone numbers
- Screen each number (TPS / CTPS / internal do-not-call) before dialling
- Click **Call next lead** — Twilio rings *your* handset first, then connects the property
- Show the TalkStay / TalkWeb / GrantsCopilot script
- Log outcomes and auto-schedule the next action
- SMS follow-up only after a live-call outcome or explicit consent
- Email follow-up through the existing Gmail / Resend / SMTP connection
- Work/MCP tools to create drafts, generate scripts, pause, log outcomes, and maintain suppression

## What this version does **not** do

- AI voice cold-calling
- Prerecorded / automated marketing calls
- Bulk cold SMS to scraped mobiles
- Auto-dial from Work/ChatGPT
- Bypass TPS, CTPS, or do-not-call

## Connect Twilio

1. In LeadBoosters: **Settings → Phone / Twilio** or **Integrations → Connect Twilio**
2. Store Account SID, Auth Token, your Twilio UK number, and your handset number
3. Never commit the Auth Token. It lives in `crm_connections.metadata` for that user.

Point Twilio webhooks (Console → Phone Numbers → your UK number):

| Event | URL |
|-------|-----|
| Voice request | `https://kgndpwzqohepotahnfeo.supabase.co/functions/v1/twilio-voice-webhook` |
| Voice status | `https://kgndpwzqohepotahnfeo.supabase.co/functions/v1/twilio-status-webhook` |
| Messaging incoming | `https://kgndpwzqohepotahnfeo.supabase.co/functions/v1/twilio-inbound-sms` |

Inbound `STOP` / `UNSUBSCRIBE` texts are added to the suppression list automatically.

## Work / ChatGPT

Use the MCP server (`mcp-server/index.mjs`) with `LEADBOOSTERS_API_KEY`.

Approved actions: `create_calling_campaign`, `list_calling_campaigns`,
`calling_campaign_status`, `generate_call_script`, `ready_calling_campaign`,
`pause_calling_campaign`, `record_call_outcome`, `add_phone_suppression`.

There is **no** “place call” or “send bulk SMS” tool.

## Apply the schema

```bash
supabase db push
# or apply supabase/migrations/20260817120000_calling_campaigns_twilio.sql
```

Then deploy the new functions:

```bash
supabase functions deploy twilio-click-to-call twilio-voice-webhook twilio-status-webhook twilio-inbound-sms send-campaign-sms api-calling
```
