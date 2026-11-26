-- One-off clean-up (25 Nov 2026): role/placeholder labels stored as people.first_name ("Hi Primary,").
-- NOT a migration. Run by hand in the Supabase SQL editor only after Mike OKs it.
-- Step 1 is read-only. Step 2 changes data inside a transaction; check the counts before COMMIT.

-- ── Step 1: preview (read-only) ─────────────────────────────────────────────
SELECT lower(trim(first_name)) AS label, count(*) AS people
FROM public.people
WHERE lower(trim(first_name)) IN ('primary', 'contact', 'info', 'admin', 'sales', 'enquiries', 'enquiry', 'hello', 'team', 'office', 'general', 'reception', 'support', 'bookings', 'accounts', 'marketing', 'main', 'default')
GROUP BY 1 ORDER BY 2 DESC;

SELECT count(*) AS contacts_named_primary FROM public.contacts WHERE trim(name) ILIKE 'primary';

-- ── Step 2: fix ─────────────────────────────────────────────────────────────
BEGIN;

-- People: a label is not a name. Null first_name (and last_name when it is empty) so emails say "Hi there".
UPDATE public.people
SET first_name = NULL,
    last_name  = NULLIF(trim(coalesce(last_name, '')), ''),
    updated_at = now()
WHERE lower(trim(first_name)) IN ('primary', 'contact', 'info', 'admin', 'sales', 'enquiries', 'enquiry', 'hello', 'team', 'office', 'general', 'reception', 'support', 'bookings', 'accounts', 'marketing', 'main', 'default');

-- Contacts: the Autopilot general-inbox contact was literally named "Primary"; new ones are "General enquiries".
UPDATE public.contacts SET name = 'General enquiries' WHERE trim(name) ILIKE 'primary';

-- Re-check: both should be 0.
SELECT count(*) AS people_left FROM public.people WHERE lower(trim(first_name)) IN ('primary', 'contact', 'info', 'admin', 'sales', 'enquiries', 'enquiry', 'hello', 'team', 'office', 'general', 'reception', 'support', 'bookings', 'accounts', 'marketing', 'main', 'default');
SELECT count(*) AS contacts_left FROM public.contacts WHERE trim(name) ILIKE 'primary';

-- COMMIT;   -- uncomment / run once the counts look right, otherwise ROLLBACK;
