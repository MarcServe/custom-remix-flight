// Addresses that belong to THIS app. The Resend account is shared with other
// Biz Boosters products, so account-wide webhooks and the inbox listing include
// mail that is not ours; anything not addressed to one of these is ignored.
export const RESEND_INBOUND_EMAIL = (Deno.env.get('RESEND_INBOUND_EMAIL') || 'leadgenie@eldapgraaa.resend.app').toLowerCase();

export async function loadOwnAddresses(db: any): Promise<Set<string>> {
  const own = new Set<string>([RESEND_INBOUND_EMAIL]);
  const [{ data: conns }, { data: bps }, { data: profs }] = await Promise.all([
    db.from('crm_connections').select('from_email'),
    db.from('business_profiles').select('email_sender_email'),
    db.from('profiles').select('email'),
  ]);
  for (const c of conns || []) if (c.from_email) own.add(String(c.from_email).toLowerCase());
  for (const b of bps || []) if (b.email_sender_email) own.add(String(b.email_sender_email).toLowerCase());
  for (const p of profs || []) if (p.email) own.add(String(p.email).toLowerCase());
  return own;
}

export function extractAddresses(to: unknown): string[] {
  const list = Array.isArray(to) ? to : typeof to === 'string' ? to.split(/[,;]/) : to && typeof to === 'object' && (to as any).email ? [(to as any).email] : [];
  return list.map((t) => { const m = String(typeof t === 'object' && t ? (t as any).email ?? '' : t).toLowerCase().match(/[^\s<>,;"']+@[^\s<>,;"']+/); return m ? m[0] : ''; }).filter(Boolean);
}

export function addressedToUs(own: Set<string>, to: unknown, cc?: unknown): boolean {
  return [...extractAddresses(to), ...extractAddresses(cc)].some((a) => own.has(a));
}
