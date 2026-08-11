-- Phone-capable recipient groups for SMS / phone bulk campaigns
ALTER TABLE public.recipient_group_members
  ALTER COLUMN email DROP NOT NULL;

ALTER TABLE public.recipient_group_members
  ADD COLUMN IF NOT EXISTS phone TEXT;

-- At least one of email or phone required
ALTER TABLE public.recipient_group_members
  DROP CONSTRAINT IF EXISTS recipient_group_members_email_or_phone_check;

ALTER TABLE public.recipient_group_members
  ADD CONSTRAINT recipient_group_members_email_or_phone_check
  CHECK (
    (email IS NOT NULL AND length(trim(email)) > 0)
    OR (phone IS NOT NULL AND length(trim(phone)) > 0)
  );

-- Unique phone per group (when present)
CREATE UNIQUE INDEX IF NOT EXISTS idx_recipient_group_members_group_phone
  ON public.recipient_group_members (group_id, phone)
  WHERE phone IS NOT NULL AND length(trim(phone)) > 0;

CREATE INDEX IF NOT EXISTS idx_recipient_group_members_phone
  ON public.recipient_group_members (group_id, phone);

COMMENT ON COLUMN public.recipient_group_members.phone IS
  'E.164 or free-form phone for SMS campaigns; email may be null for phone-only members.';

-- Channel hint on groups (optional; UI uses name/description too)
ALTER TABLE public.recipient_groups
  ADD COLUMN IF NOT EXISTS channel TEXT DEFAULT 'email';

COMMENT ON COLUMN public.recipient_groups.channel IS
  'email | phone | mixed — helps Campaign UIs filter Add-from-group lists.';
