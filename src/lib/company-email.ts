/** Minimal company shape for resolving a sendable email (matches Companies list queries). */
export type CompanyLikeForEmail = {
  name?: string | null;
  general_email?: string | null;
  generalEmail?: string | null;
  contacts?: { email?: string | null; name?: string | null }[] | null;
};

export function getCompanyResolvableEmail(company: CompanyLikeForEmail): {
  email: string;
  first_name: string | null;
  last_name: string | null;
  company: string | null;
} | null {
  const contactWithEmail = company.contacts?.find((c) => c?.email);
  if (contactWithEmail?.email) {
    const nameParts = (contactWithEmail.name || "").trim().split(/\s+/);
    return {
      email: contactWithEmail.email.trim().toLowerCase(),
      first_name: nameParts[0] || null,
      last_name: nameParts.length > 1 ? nameParts.slice(1).join(" ") : null,
      company: company.name?.trim() || null,
    };
  }
  const ge = company.general_email || company.generalEmail;
  if (ge && String(ge).trim()) {
    const nameParts = (company.name || "").trim().split(/\s+/);
    return {
      email: String(ge).trim().toLowerCase(),
      first_name: nameParts[0] || null,
      last_name: nameParts.length > 1 ? nameParts.slice(1).join(" ") : null,
      company: company.name?.trim() || null,
    };
  }
  return null;
}
