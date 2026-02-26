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

## 5. Troubleshooting

- **Replies show in Resend but not in CRM**  
  - Confirm the `email.received` webhook is set and the URL is correct.  
  - In Resend, check the webhook’s delivery logs for that reply (success/failure).  
  - In Supabase, check **Edge Functions → process-inbound-emails → Logs** for the same time as the reply.

- **“Missing from address” or “null value in column from_email”**  
  The payload from Resend is being parsed; the code now normalizes `from` (e.g. `"Name <email>"` → `email`). If you still see this, check Resend’s payload in the webhook log and the function logs.

- **Reply stored but not linked to the right conversation**  
  Matching uses In-Reply-To / References, then sender email, then subject. For **test** emails we don’t create a sequence, so test replies will appear as **standalone** threads (Personal), not under a sequence.

- **Hostinger “domain records missing”**  
  That warning is about sending/receiving **from** michael.o@bizboosters.co.uk (e.g. deliverability). It does not block the CRM from receiving replies via Resend; replies are ingested through the Resend webhook, not through Hostinger.
