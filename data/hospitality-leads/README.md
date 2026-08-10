# Hospitality verified leads — UK + US

Hand-researched contacts from **official hotel / serviced-apartment websites**.

## Are these verified?

**Yes.** Every row is marked `Verification Status = verified` because the email was found **published on the property’s official contact page**.

| Column | Meaning |
|---|---|
| `Verification Status` | `verified` |
| `Verification Method` | Published on official website contact page |
| `Verification Source URL` | Exact page where the email was observed |
| `Email Source` | `official_website` |

This is **not** SMTP guessing, Airbnb scraping, or LinkedIn scraping.

## Counts

- **679 properties** total (`counts.total` in JSON)
- **398 UK** across London and major UK cities
- **281 US**
- **885 unique emails** across property / sales / reservations / decision-maker fields

UK coverage includes Apex Hotels, Roomzzz, Malmaison, Hotel du Vin, Locke / Cove / SACO, The Hoxton, Dakota, GuestHouse, Firmdale, Leonardo, Motel One, Z Hotels, QHotels, Exclusive Collection, and independents.

US coverage includes Ace Hotel, The Standard, The Hoxton, YOTEL, Edition, Proper, Freehand, Graduate, 1 Hotels, Arlo, Viceroy, and independents across major US cities.

## Files

- `verified-leads.json` — source of truth (UK + US)
- `uk-verified-leads.json` — UK-only for campaigns
- `us-focus-verified-leads.json` — US-only for campaigns
- `verified-leads.csv` — campaign-ready (verification columns + source URL)
- `raw/` — research batch inputs used to build the merged file

## App

`/hospitality-leads` → **Curated verified** (shows source link per lead)

## Ingest pipeline (campaigns + newsletters)

From **Hospitality Leads → Campaign & newsletter ingest**:

1. Creates **US** and **UK** `recipient_groups` (verified emails only)
2. Saves companies/contacts to CRM
3. Creates draft **email campaigns** with modern TalkStay-style HTML
4. Creates newsletter drafts + **daily newsletter series** (rotating modern/elegant/minimal templates)
5. Optional **Daily automatic scans** — opts into `hospitality_automation_settings`; cron calls `ingest-hospitality-leads` each morning

Edge function: `supabase/functions/ingest-hospitality-leads`  
CLI example: `mcp-server/examples/hospitality-ingest.sh`  
API also supports `api-campaigns` action `create_group` for custom automation.
