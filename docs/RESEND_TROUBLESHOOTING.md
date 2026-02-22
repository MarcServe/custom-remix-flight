# Resend email not arriving – what to check

If you send with Resend but don’t receive the emails:

## 1. **RESEND_API_KEY is set**

- Supabase Dashboard → **Project Settings** → **Edge Functions** → **Secrets**
- Add `RESEND_API_KEY` with your Resend API key (from [resend.com/api-keys](https://resend.com/api-keys))
- Redeploy the functions that send email (e.g. `send-crm-email`, `send-bulk-emails`, `send-newsletter`) after changing secrets

## 2. **Sending domain is verified**

- Resend only delivers when the **From** address uses a **verified domain**
- Go to [resend.com/domains](https://resend.com/domains) and add your domain
- Complete DNS verification (SPF, DKIM, etc.)
- In the app, **Settings → Email Providers → Resend**: the “Send from” address must use that verified domain (e.g. `sales@yourdomain.com`)

If the domain isn’t verified, Resend may return an error (e.g. 403) or accept the request but not deliver. The app will now show Resend’s error message when the API returns one.

## 3. **Check Resend dashboard**

- [resend.com/emails](https://resend.com/emails) (or **Logs** in the Resend dashboard)
- Confirm the email was **accepted** and see delivery status
- If it’s “delivered”, the issue may be spam or the recipient address

## 4. **Emails in Promotions instead of Inbox**

Gmail often routes cold outreach or marketing-style mail to **Promotions**. To improve primary **Inbox** placement:

- **From name** – Use a real person’s name (e.g. “Michael Orji” or “Sarah from TalkWeb”) in **Email Branding → Sender profiles** rather than only a company name. Avoid “noreply” or “Marketing”.
- **Reply-To** – Campaigns use your real From address for replies; that encourages engagement and helps Gmail treat mail as 1:1.
- **Subject lines** – Avoid all caps, heavy sales language, or “FREE / Act now”. Keep them concise and conversational.
- **Content** – More 1:1, personal tone and less “broadcast” or template-heavy copy. Personalization (e.g. first name, company) helps.
- **Domain authentication** – Verify your sending domain in Resend with **SPF and DKIM**; add **DMARC** in your DNS if you can. See [resend.com/domains](https://resend.com/domains). Strong auth improves trust and can help Inbox placement.
- **Domain reputation** – New or low-volume domains are filtered more. Warm up by sending to engaged contacts first; avoid big blasts or sudden volume spikes.
- **Recipient action** – Ask recipients to move one message to **Primary** and/or click “Not spam”; that trains Gmail for future emails from you.

Outgoing campaign/CRM emails from this app send with `X-Priority: 3` and `Importance: normal` so they look like normal mail rather than bulk marketing. You can’t force Gmail to put every email in Inbox, but the above improves the odds.

## 5. **Spam and recipient address**

- Ask the recipient to check **spam/junk** and **Promotions**
- Confirm the **To** address is correct and has no typos

## 6. **Redeploy after changes**

After setting `RESEND_API_KEY` or changing secrets:

```bash
supabase functions deploy send-crm-email --project-ref YOUR_PROJECT_REF
supabase functions deploy send-bulk-emails --project-ref YOUR_PROJECT_REF
```

Replace `YOUR_PROJECT_REF` with your Supabase project reference (e.g. from the dashboard URL).
