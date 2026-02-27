# Resend Inbound: Replies in the CRM

When you send emails via the CRM (test emails, sequences, campaigns), replies are sent to Resend’s receiving address (e.g. `leadgenie@eldapgraaa.resend.app`). For those replies to show in **Conversations** in the CRM, Resend must notify our backend.

## Why replies go to Resend (not michael.o@bizboosters.co.uk)

Outgoing emails are sent with **Reply-To: leadgenie@…resend.app** so that:

1. Resend receives the reply.
2. Resend triggers a webhook to our app.
3. Our `process-inbound-emails` function stores the reply and links it to the right conversation (or creates a standalone thread).

So replies correctly go to Resend first; they appear in the CRM only after the webhook is configured and working.

## 1. Configure Resend “email.received” webhook

1. Log in to [Resend](https://resend.com) and open your project.
2. Go to **Webhooks** (or **Receiving** → webhook).
3. **Add webhook**:
   - **Event**: `email.received`
   - **Endpoint URL**:  
     `https://<YOUR_SUPABASE_PROJECT_REF>.supabase.co/functions/v1/process-inbound-emails`  
     Example: `https://kgndpwzqohepotahnfeo.supabase.co/functions/v1/process-inbound-emails`
4. Save. Resend will send a POST request to this URL whenever an email is received at your receiving address.

## 2. Supabase secrets

Ensure the edge function can call Resend’s API to fetch the full email (body, headers) when needed:

- **RESEND_API_KEY** – same key you use for sending.  
  Set in Supabase: Project → Settings → Edge Functions → Secrets.

`process-inbound-emails` uses this to fetch HTML/text and headers (e.g. In-Reply-To) for received emails.

## 3. Deploy the function

```bash
supabase functions deploy process-inbound-emails
```

## 4. Where replies appear in the CRM

- **Sequence/campaign replies**  
  If the reply can be matched to a sent sequence/campaign (by In-Reply-To, thread, or recipient), it is attached to that **sequence conversation** in **Conversations**.

- **Test / other replies**  
  If there is no matching sequence, the reply is stored as a **standalone** thread and appears in **Conversations** under the **Personal** (or standalone) area, grouped by sender email. Open the **Personal** tab and look for the sender address (e.g. the inbox you replied from).

## 5. Alternative: Sync inbound from Resend (backup pathway)

If the webhook isn’t delivering or you want to pull in recent replies manually:

1. **From the app**  
   On **Conversations**, click **Sync inbound**. This calls the `sync-inbound-from-resend` edge function, which lists received emails from Resend’s API, skips ones already in the CRM, and imports the rest. New threads appear under **Personal** (or linked to a sequence when matched).

2. **Deploy the sync function** (if not already deployed):
   ```bash
   supabase functions deploy sync-inbound-from-resend
   ```
   Ensure `RESEND_API_KEY` is set in Edge Function secrets.

3. **Cron (implemented)**  
   A pg_cron job runs every 10 minutes and triggers `sync-inbound-from-resend` via `cron-trigger` (migration `20260227110000_add_sync_inbound_cron.sql`). This pulls recent received emails from Resend into the CRM even when the webhook doesn’t fire.

**How Sync Inbound works (step by step):**

1. **Resend** receives every email sent to your receiving address (e.g. `leadgenie@…resend.app`), whether it’s a reply to a campaign or a completely new message.
2. When you click **Sync inbound** (or the cron runs), the app calls Resend’s **List received emails** API to get the last 50 received emails.
3. For each email, we check if we already have a row in **email_threads** with the same `message_id`. If yes, we **skip** it (counted as “already in CRM” in the toast).
4. For each **new** email we:
   - Fetch full content (body, headers) from Resend’s **Get received email** API.
   - Call the same **process-inbound-emails** logic (matching by In-Reply-To/sender/subject, then storing in `email_threads`).
5. New rows in **email_threads** are what you see in **Conversations** (Sequences or Personal). Sync does **not** create contacts or companies; it only fills the conversation threads. Creating contacts/deals from inbound is a separate feature.

So: **“X new email(s) added to Conversations”** = X new rows in `email_threads` (they show in the Conversations tab). **“Y already in CRM”** = Y emails were skipped because they were already in `email_threads`.

## 6. Troubleshooting

- **Replies show in Resend but not in CRM**  
  - Confirm the `email.received` webhook is set and the URL is correct.  
  - In Resend, check the webhook’s delivery logs for that reply (success/failure).  
  - In Supabase, check **Edge Functions → process-inbound-emails → Logs** for the same time as the reply.  
  - Use **Sync inbound** on the Conversations page to pull in recent received emails as a fallback.

- **“Missing from address” or “Invalid/empty JSON body”**  
  The payload from Resend is being parsed; the code now normalizes `from` (e.g. `"Name <email>"` → `email`). If you still see this, check Resend’s payload in the webhook log and the function logs.

- **Reply stored but not linked to the right conversation**  
  Matching uses In-Reply-To / References, then sender email, then subject. For **test** emails we don’t create a sequence, so test replies will appear as **standalone** threads (Personal), not under a sequence.

- **Hostinger “domain records missing”**  
  That warning is about sending/receiving **from** michael.o@bizboosters.co.uk (e.g. deliverability). It does not block the CRM from receiving replies via Resend; replies are ingested through the Resend webhook (or Sync inbound), not through Hostinger.
