/**
 * Helper utilities for consistent email detection across leads
 */

interface LeadData {
  company_data?: Record<string, any>;
  company_website?: string;
  contacts?: Array<{ email?: string }> | null;
}

/**
 * Get the general email from a lead, checking multiple potential field names
 */
export function getLeadGeneralEmail(lead: LeadData): string | null {
  const companyData = lead.company_data || {};
  
  // Check various field names that might contain the email
  const email = 
    companyData.generalEmail ||
    companyData.general_email ||
    companyData.email ||
    companyData.contactEmail ||
    null;
  
  if (email && typeof email === 'string' && email.trim()) {
    return email.trim();
  }
  
  return null;
}

/**
 * Check if a lead has any email (general or from contacts)
 */
export function leadHasEmail(lead: LeadData): boolean {
  // Check general email
  if (getLeadGeneralEmail(lead)) {
    return true;
  }
  
  // Check contacts
  const contacts = lead.contacts || [];
  return contacts.some(c => c.email && c.email.trim());
}

/**
 * Check if a lead has a valid website for email extraction
 */
export function leadHasValidWebsite(lead: LeadData): boolean {
  const website = lead.company_website;
  if (!website) return false;
  if (website.includes('no-website')) return false;
  if (website.trim() === '') return false;
  return true;
}

/**
 * Check if a lead needs email extraction (has website but no email)
 */
export function leadNeedsEmailExtraction(lead: LeadData): boolean {
  return leadHasValidWebsite(lead) && !leadHasEmail(lead);
}

/**
 * Get all leads from a list that need email extraction
 */
export function getLeadsNeedingEmailExtraction(leads: LeadData[]): LeadData[] {
  return leads.filter(leadNeedsEmailExtraction);
}
