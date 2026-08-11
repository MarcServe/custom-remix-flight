---
name: hospitality-verified-leads
description: Research and export website-verified hospitality leads (hotels, short-stay, aparthotels) for UK and US outreach. Use when finding hotel emails, building TalkStay/LeadBoosters hospitality campaigns, ingesting curated leads into groups/campaigns/newsletters, or exporting Hospitality leads CSVs to Desktop.
---
# Hospitality verified leads extraction

Hand-research **public emails on official hotel / aparthotel / serviced-apartment contact pages**, then organise by **UK** and **US** for campaigns and newsletters.

## Hard rules (do not break)

- **Verified only** = email observed on an official contact / contact-directory page.
- Every lead must include a **`sourceUrl`** (exact page where the email was seen).
- **No** Airbnb scraping, LinkedIn scraping, ContactOut, or SMTP/email guessing.
- Prefer property / reservations / sales / events / groups inboxes.
- Skip `privacy@`, `unsubscribe@`, `careers@`, `noreply@` unless that is truly the only published address.
- Markets for this workflow: **United Kingdom** then **United States**.

## Research method

1. Open brand or property **Contact** / **Contact us** pages (curl or WebFetch).
2. Extract `mailto:` and visible emails with regex.
3. Decode Cloudflare `data-cfemail` when present:

```python
def decode_cf(encoded: str) -> str:
    r = int(encoded[:2], 16)
    return "".join(chr(int(encoded[n:n+2], 16) ^ r) for n in range(2, len(encoded), 2))
```

4. Spot-check samples: re-fetch `sourceUrl` and confirm the email still appears.
5. Reject form-only pages with no published address.

## Canonical lead schema

Property-centric row (multiple emails allowed):

| Field | Notes |
| --- | --- |
| `propertyName`, `propertyType`, `city`, `country` | Required identity |
| `website`, `sourceUrl`, `phone` | `sourceUrl` required |
| `propertyEmail` | Best general inbox |
| `decisionMakerName/Title/Email` | When published |
| `salesEmail`, `reservationsEmail` | Role inboxes |
| `emailVerified` | `true` |
| `emailSource` | `official_website` |
| `verificationStatus` | `verified` |
| `verificationMethod` | Published on official website contact page |

Email priority when picking one address for outreach:

1. decision maker → 2. sales → 3. property → 4. reservations  
Skip freemail domains.

## Repo locations

| Path | Purpose |
| --- | --- |
| `data/hospitality-leads/verified-leads.json` | Source of truth (UK+US) |
| `data/hospitality-leads/uk-verified-leads.json` | UK split |
| `data/hospitality-leads/us-focus-verified-leads.json` | US split |
| `public/data/hospitality-leads/` | App-served mirrors |
| `public/downloads/` | Desktop zip + LATEST CSVs |
| `scripts/export-hospitality-desktop.py` | Organised Desktop export |
| `supabase/functions/ingest-hospitality-leads` | Groups + campaigns + newsletters |
| `/hospitality-leads` page | UI load / ingest / CRM |

## Desktop export (always organise UK vs US)

```bash
# From repo root — writes ~/Desktop/Hospitality leads when run locally
python3 scripts/export-hospitality-desktop.py --dest "$HOME/Desktop/Hospitality leads"
```

Folder layout:

```
Hospitality leads/
  hospitality-UK-unique-emails-LATEST.csv
  hospitality-US-unique-emails-LATEST.csv
  hospitality-all-unique-emails-LATEST.csv
  hospitality-UK-properties-LATEST.csv
  hospitality-US-properties-LATEST.csv
  export-YYYY-MM-DD/
    01-by-market/
    02-emails-only/
    03-unique-emails/
```

If running as a **cloud agent** (no access to the user’s Mac Desktop):

1. Run the same script into `/opt/cursor/artifacts/Hospitality leads`
2. Also write zip + CSVs under `public/downloads/`
3. Commit/push and give GitHub raw download links
4. Never claim files were written to the user’s personal Desktop unless a local path was actually writable

Current download pack:

- Zip: `public/downloads/Hospitality-leads-FOR-DESKTOP.zip`
- Branch raw URL pattern:  
  `https://github.com/MarcServe/custom-remix-flight/raw/<branch>/public/downloads/Hospitality-leads-FOR-DESKTOP.zip`

## Campaign groups (preferred path)

UI: `/hospitality-leads` → **Create US + UK groups** (client-side, no edge deploy required).

- One **recipient_group_members** row per published contact email (multi-contact businesses expand).
- Then on `/campaigns` use **Add from group**, or click **US/UK group + open campaign**.
- Full ingest (`ingest-hospitality-leads`) still available for CRM + draft campaigns + newsletters.

## Multi-email / campaign upload

Campaign CSV/JSON import must **expand** comma/semicolon-separated emails into one recipient each
(`expandCampaignEmailCell` in `src/lib/csv-campaign-import.ts`). Never reject a whole row because a
business cell contains `a@x.com, b@x.com`.

## High-yield brand patterns (examples)

UK: Apex, Roomzzz, Malmaison, Hotel du Vin, Locke/Cove/SACO, Hoxton, Motel One, Z Hotels, Firmdale, Point A, Dakota, THE PIG, Leonardo property FAQs.  
US: Ace Hotel contact directory, Standard, Hoxton US, YOTEL, Edition, Proper, Graduate, Arlo, independents with published emails.

Skip brands that are form-only (often citizenM / some chain booking sites).

## Quality bar before shipping a batch

- [ ] Every row has `sourceUrl` + at least one non-junk email
- [ ] UK and US separated in exports and ingest groups
- [ ] Freemail / privacy / careers filtered out of outreach picks
- [ ] CSV + JSON mirrors under `data/` and `public/data/` updated together
- [ ] Desktop export regenerated (`scripts/export-hospitality-desktop.py`)
- [ ] Counts recorded in `data/hospitality-leads/README.md`
