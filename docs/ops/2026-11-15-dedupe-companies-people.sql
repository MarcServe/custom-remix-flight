BEGIN;
-- ===== companies: canonical = oldest per (user, domain) =====
CREATE TEMP TABLE cmap AS
WITH d AS (
  SELECT id, user_id, created_at,
         lower(regexp_replace(regexp_replace(website,'^https?://(www\.)?',''),'/.*$','')) AS dom
  FROM companies WHERE website IS NOT NULL AND website NOT LIKE 'no-website-%'
), ranked AS (
  SELECT id, user_id, dom, first_value(id) OVER (PARTITION BY user_id, dom ORDER BY created_at, id) AS keep_id
  FROM d WHERE dom <> ''
)
SELECT id AS dup_id, keep_id FROM ranked WHERE id <> keep_id;
-- fill gaps on the kept row from its duplicates
UPDATE companies k SET
  general_email = COALESCE(k.general_email, s.general_email),
  company_phone = COALESCE(k.company_phone, s.company_phone),
  description   = COALESCE(k.description, s.description),
  industry      = COALESCE(k.industry, s.industry),
  geography     = COALESCE(k.geography, s.geography),
  linkedin_url  = COALESCE(k.linkedin_url, s.linkedin_url),
  size          = COALESCE(k.size, s.size)
FROM (SELECT DISTINCT ON (m.keep_id) m.keep_id, c.general_email, c.company_phone, c.description, c.industry, c.geography, c.linkedin_url, c.size
      FROM cmap m JOIN companies c ON c.id = m.dup_id
      ORDER BY m.keep_id, (c.general_email IS NOT NULL) DESC, c.created_at) s
WHERE k.id = s.keep_id;
-- company_sequences has UNIQUE(company_id, sequence_id): drop dup enrolments that would collide
DELETE FROM company_sequences cs USING cmap m
WHERE cs.company_id = m.dup_id AND EXISTS (SELECT 1 FROM company_sequences k WHERE k.company_id = m.keep_id AND k.sequence_id = cs.sequence_id);
UPDATE company_sequences t SET company_id = m.keep_id FROM cmap m WHERE t.company_id = m.dup_id;
UPDATE contacts t SET company_id = m.keep_id FROM cmap m WHERE t.company_id = m.dup_id;
UPDATE calendar_events t SET company_id = m.keep_id FROM cmap m WHERE t.company_id = m.dup_id;
UPDATE invoices t SET company_id = m.keep_id FROM cmap m WHERE t.company_id = m.dup_id;
UPDATE lead_feedback_analytics t SET company_id = m.keep_id FROM cmap m WHERE t.company_id = m.dup_id;
UPDATE people t SET company_id = m.keep_id FROM cmap m WHERE t.company_id = m.dup_id;
UPDATE deals t SET company_id = m.keep_id FROM cmap m WHERE t.company_id = m.dup_id;
UPDATE events t SET company_id = m.keep_id FROM cmap m WHERE t.company_id = m.dup_id;
UPDATE chat_conversations t SET company_id = m.keep_id FROM cmap m WHERE t.company_id = m.dup_id;
UPDATE autonomous_leads t SET company_id = m.keep_id FROM cmap m WHERE t.company_id = m.dup_id;
-- exact-duplicate contacts created by the merge (same company + same email): keep oldest
DELETE FROM contacts c USING contacts k
WHERE c.company_id = k.company_id AND lower(c.email) = lower(k.email) AND c.email IS NOT NULL AND c.created_at > k.created_at;
DELETE FROM companies c USING cmap m WHERE c.id = m.dup_id;

-- ===== people: canonical = oldest per (user, email) =====
CREATE TEMP TABLE pmap AS
WITH ranked AS (
  SELECT id, first_value(id) OVER (PARTITION BY user_id, lower(email) ORDER BY created_at, id) AS keep_id
  FROM people WHERE email IS NOT NULL AND email <> ''
)
SELECT id AS dup_id, keep_id FROM ranked WHERE id <> keep_id;
UPDATE people k SET
  first_name = COALESCE(NULLIF(k.first_name,''), s.first_name), last_name = COALESCE(NULLIF(k.last_name,''), s.last_name),
  company_id = COALESCE(k.company_id, s.company_id)
FROM (SELECT DISTINCT ON (m.keep_id) m.keep_id, p.first_name, p.last_name, p.company_id FROM pmap m JOIN people p ON p.id = m.dup_id ORDER BY m.keep_id, p.created_at) s
WHERE k.id = s.keep_id;
UPDATE deal_contacts t SET person_id = m.keep_id FROM pmap m WHERE t.person_id = m.dup_id
  AND NOT EXISTS (SELECT 1 FROM deal_contacts x WHERE x.deal_id = t.deal_id AND x.person_id = m.keep_id);
DELETE FROM deal_contacts t USING pmap m WHERE t.person_id = m.dup_id;
UPDATE email_campaign_recipients t SET person_id = m.keep_id FROM pmap m WHERE t.person_id = m.dup_id;
UPDATE recipient_group_members t SET person_id = m.keep_id FROM pmap m WHERE t.person_id = m.dup_id;
UPDATE sms_messages t SET person_id = m.keep_id FROM pmap m WHERE t.person_id = m.dup_id;
DELETE FROM people p USING pmap m WHERE p.id = m.dup_id;

-- ===== contacts with invalid emails =====
UPDATE contacts SET email = 'adrian.sargent@esgtreasury.com' WHERE id = 'c7ca1e8b-b2c1-48cc-95cf-0059d8c3f19e';
DELETE FROM contacts WHERE id IN ('33e5e419-1328-4602-b775-1e2ba03a8d52','78b40f89-fa45-48d1-9e13-a6920e362788','c216accb-966c-4d6f-a030-413e39067a83');

SELECT (SELECT count(*) FROM cmap) AS companies_merged, (SELECT count(*) FROM pmap) AS people_merged,
       (SELECT count(*) FROM companies) AS companies_now, (SELECT count(*) FROM people) AS people_now,
       (SELECT count(*) FROM contacts) AS contacts_now,
       (SELECT count(*) FROM (SELECT user_id, lower(regexp_replace(regexp_replace(website,'^https?://(www\.)?',''),'/.*$','')) d FROM companies WHERE website NOT LIKE 'no-website-%' GROUP BY 1,2 HAVING count(*)>1) x) AS dup_domains_left,
       (SELECT count(*) FROM (SELECT user_id, lower(email) FROM people WHERE email IS NOT NULL AND email<>'' GROUP BY 1,2 HAVING count(*)>1) x) AS dup_people_left,
       (SELECT count(*) FROM contacts WHERE email IS NOT NULL AND email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$') AS bad_contacts_left;
COMMIT;
