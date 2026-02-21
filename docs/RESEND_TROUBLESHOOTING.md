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

## 4. **Spam and recipient address**

- Ask the recipient to check **spam/junk**
- Confirm the **To** address is correct and has no typos

## 5. **Redeploy after changes**

After setting `RESEND_API_KEY` or changing secrets:

```bash
supabase functions deploy send-crm-email --project-ref YOUR_PROJECT_REF
supabase functions deploy send-bulk-emails --project-ref YOUR_PROJECT_REF
```

Replace `YOUR_PROJECT_REF` with your Supabase project reference (e.g. from the dashboard URL).
