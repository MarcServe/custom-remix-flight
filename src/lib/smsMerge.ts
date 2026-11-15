// Fill personalisation tags in an SMS. Accepts {name} and {{name}} and the
// common spellings people type: {first_name}, {firstName}, {first name},
// {company}, {business}, {phone}, {email}. Unknown tags are left untouched.
// Keep in sync with supabase/functions/send-bulk-sms (fillSmsTags).
const PLACEHOLDER_NAMES = new Set(['manual entry', 'contact', 'group member']);

export function fillSmsTags(
  template: string,
  vars: { name?: string | null; phone?: string | null; email?: string | null },
): string {
  if (!template) return '';
  let full = (vars.name || '').trim();
  if (PLACEHOLDER_NAMES.has(full.toLowerCase())) full = '';
  const parts = full.split(/\s+/).filter(Boolean);
  const first = parts[0] || '';
  const last = parts.slice(1).join(' ');
  const values: Record<string, string> = {
    name: full || 'there',
    fullname: full || 'there',
    contactname: full || 'there',
    firstname: first || 'there',
    first: first || 'there',
    lastname: last,
    last: last,
    surname: last,
    company: full,
    companyname: full,
    business: full,
    businessname: full,
    phone: vars.phone || '',
    mobile: vars.phone || '',
    email: vars.email || '',
  };
  return template.replace(/\{\{?\s*([A-Za-z][A-Za-z _-]{0,30}?)\s*\}?\}/g, (match, key: string) => {
    const k = key.toLowerCase().replace(/[\s_-]/g, '');
    return k in values ? values[k] : match;
  });
}

export const SMS_TAG_HINT = 'Personalise with {name}, {first_name} or {company}';
