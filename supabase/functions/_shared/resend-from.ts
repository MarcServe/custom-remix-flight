// Resend only delivers From addresses on domains verified in the account. Anyone sending
// without their own verified domain (a Gmail address, a customer's unverified domain, or no
// address at all) sends from the default Biz Boosters address instead; their name stays as
// the display name and replies still come back through the inbound Reply-To.
export const RESEND_DEFAULT_FROM = (Deno.env.get("RESEND_DEFAULT_FROM") || "hello@bizboosters.co.uk").trim().toLowerCase();

let domainsCache: { at: number; domains: Set<string> | null } | null = null;

/** Verified sending domains in the Resend account (cached 10 minutes); null when Resend can't be asked. */
export async function resendVerifiedDomains(): Promise<Set<string> | null> {
  if (domainsCache && Date.now() - domainsCache.at < 10 * 60_000) return domainsCache.domains;
  let domains: Set<string> | null = null;
  try {
    const key = (Deno.env.get("RESEND_API_KEY") || "").trim();
    if (key) {
      const r = await fetch("https://api.resend.com/domains", { headers: { Authorization: `Bearer ${key}` } });
      if (r.ok) {
        const j = await r.json();
        domains = new Set(((j?.data || []) as any[]).filter((d) => d?.status === "verified").map((d) => String(d.name).toLowerCase()));
      }
    }
  } catch { /* keep null */ }
  domainsCache = { at: Date.now(), domains };
  return domains;
}

/** The From address to use with Resend: the requested one when its domain is verified, else the default. */
export async function resendFromAddress(requested: string | null | undefined): Promise<{ email: string; fallback: boolean }> {
  const email = String(requested || "").trim().toLowerCase();
  const domain = email.includes("@") ? email.split("@")[1] : "";
  if (!domain) return { email: RESEND_DEFAULT_FROM, fallback: true };
  const verified = await resendVerifiedDomains();
  if (!verified) return { email, fallback: false }; // Resend unreachable: don't second-guess
  // A sub-domain of a verified domain is not itself verified in Resend; only exact matches count.
  if (verified.has(domain)) return { email, fallback: false };
  return { email: RESEND_DEFAULT_FROM, fallback: true };
}
