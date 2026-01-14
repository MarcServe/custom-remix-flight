/**
 * CSV Parser Utilities for Apify data import
 */

export interface ParsedCSV {
  headers: string[];
  rows: Record<string, string>[];
  rawRows: string[][];
}

/**
 * Parse CSV string into structured data
 */
export function parseCSV(csvText: string): ParsedCSV {
  const lines = csvText.split(/\r?\n/).filter(line => line.trim());
  if (lines.length === 0) {
    return { headers: [], rows: [], rawRows: [] };
  }

  // Parse headers
  const headers = parseCSVLine(lines[0]);
  
  // Parse data rows
  const rawRows: string[][] = [];
  const rows: Record<string, string>[] = [];
  
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length > 0 && values.some(v => v.trim())) {
      rawRows.push(values);
      const row: Record<string, string> = {};
      headers.forEach((header, idx) => {
        row[header] = values[idx] || '';
      });
      rows.push(row);
    }
  }

  return { headers, rows, rawRows };
}

/**
 * Parse a single CSV line handling quoted values
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];
    
    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        current += '"';
        i++; // Skip next quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  
  result.push(current.trim());
  return result;
}

/**
 * Column mapping configuration
 */
export interface ColumnMapping {
  csvColumn: string;
  dbField: string;
  table: 'company' | 'contact';
}

/**
 * Database field definitions
 */
export const COMPANY_FIELDS = [
  { value: 'name', label: 'Company Name', required: true },
  { value: 'website', label: 'Website' },
  { value: 'company_phone', label: 'Phone' },
  { value: 'general_email', label: 'Email' },
  { value: 'industry', label: 'Industry' },
  { value: 'size', label: 'Company Size' },
  { value: 'geography', label: 'Geography/Location' },
  { value: 'headquarters', label: 'Address/HQ' },
  { value: 'linkedin_url', label: 'LinkedIn URL' },
  { value: 'description', label: 'Description' },
  { value: 'employee_count', label: 'Employee Count' },
  { value: 'rating', label: 'Google Rating' },
  { value: 'reviews_count', label: 'Reviews Count' },
  { value: 'categories', label: 'Categories' },
] as const;

export const CONTACT_FIELDS = [
  { value: 'name', label: 'Contact Name', required: true },
  { value: 'email', label: 'Contact Email' },
  { value: 'title', label: 'Job Title' },
  { value: 'phone', label: 'Contact Phone' },
  { value: 'linkedin_url', label: 'Contact LinkedIn' },
  { value: 'department', label: 'Department' },
] as const;

/**
 * Apify Google Maps Scraper field patterns
 * These match the exact column names from popular Apify actors
 */
const APIFY_GOOGLE_MAPS_PATTERNS: Record<string, { field: string; table: 'company' | 'contact' }> = {
  // Exact matches from Google Maps Scraper actor
  'title': { field: 'name', table: 'company' },
  'phone': { field: 'company_phone', table: 'company' },
  'website': { field: 'website', table: 'company' },
  'address': { field: 'headquarters', table: 'company' },
  'city': { field: 'geography', table: 'company' },
  'state': { field: 'geography', table: 'company' },
  'countryCode': { field: 'geography', table: 'company' },
  'postalCode': { field: 'geography', table: 'company' },
  'categoryName': { field: 'industry', table: 'company' },
  'categories': { field: 'categories', table: 'company' },
  'totalScore': { field: 'rating', table: 'company' },
  'reviewsCount': { field: 'reviews_count', table: 'company' },
  'description': { field: 'description', table: 'company' },
  'url': { field: 'website', table: 'company' },
  // Email variations
  'email': { field: 'general_email', table: 'company' },
  'emails': { field: 'general_email', table: 'company' },
  'contactEmail': { field: 'general_email', table: 'company' },
  'businessEmail': { field: 'general_email', table: 'company' },
  // Owner/Contact fields
  'ownerName': { field: 'name', table: 'contact' },
  'ownerEmail': { field: 'email', table: 'contact' },
  'ownerPhone': { field: 'phone', table: 'contact' },
  'contactName': { field: 'name', table: 'contact' },
  'contactPhone': { field: 'phone', table: 'contact' },
};

/**
 * Auto-detect column mappings based on header names
 * Enhanced with Apify-specific patterns
 */
export function autoDetectMappings(headers: string[]): ColumnMapping[] {
  const mappings: ColumnMapping[] = [];
  const usedFields = new Set<string>();
  
  // First pass: exact Apify matches (highest priority)
  headers.forEach(header => {
    const normalized = header.trim();
    const apifyMatch = APIFY_GOOGLE_MAPS_PATTERNS[normalized];
    if (apifyMatch && !usedFields.has(`${apifyMatch.table}:${apifyMatch.field}`)) {
      mappings.push({ csvColumn: header, dbField: apifyMatch.field, table: apifyMatch.table });
      usedFields.add(`${apifyMatch.table}:${apifyMatch.field}`);
    }
  });
  
  const companyPatterns: Record<string, RegExp> = {
    name: /^(company\s*name|name|business\s*name|organization|place\s*name|business|storeName)$/i,
    website: /^(website|url|site|web|domain|homepage|websiteUrl|siteUrl)$/i,
    company_phone: /^(phone|telephone|tel|company\s*phone|business\s*phone|phoneNumber|mainPhone)$/i,
    general_email: /^(email|e-?mail|company\s*email|business\s*email|emailAddress|mail)$/i,
    industry: /^(industry|sector|category|business\s*type|type|categoryName|mainCategory)$/i,
    size: /^(size|company\s*size|employees|employee\s*count|staff|employeesCount)$/i,
    geography: /^(geography|location|country|region|city|state|area|locality|neighborhood)$/i,
    headquarters: /^(address|headquarters|hq|street|full\s*address|fullAddress|streetAddress|completeAddress)$/i,
    linkedin_url: /^(linkedin|linkedin\s*url|company\s*linkedin|linkedinUrl)$/i,
    description: /^(description|about|summary|bio|businessDescription|placeDescription)$/i,
    rating: /^(rating|score|totalScore|stars|googleRating|averageRating)$/i,
    reviews_count: /^(reviews|reviewsCount|reviewCount|numReviews|totalReviews)$/i,
  };
  
  const contactPatterns: Record<string, RegExp> = {
    name: /^(contact\s*name|person\s*name|full\s*name|owner|owner\s*name|ownerName|personName)$/i,
    email: /^(contact\s*email|person\s*email|owner\s*email|personalEmail)$/i,
    title: /^(title|job\s*title|position|role|designation|jobTitle)$/i,
    phone: /^(contact\s*phone|person\s*phone|mobile|cell|mobilePhone|cellPhone)$/i,
    linkedin_url: /^(contact\s*linkedin|person\s*linkedin|profile\s*url|linkedinProfile)$/i,
    department: /^(department|dept|division|team)$/i,
  };
  
  // Second pass: pattern matching for remaining unmapped columns
  headers.forEach(header => {
    // Skip if already mapped
    if (mappings.some(m => m.csvColumn === header)) return;
    
    // Check company patterns
    for (const [field, pattern] of Object.entries(companyPatterns)) {
      if (pattern.test(header) && !usedFields.has(`company:${field}`)) {
        mappings.push({ csvColumn: header, dbField: field, table: 'company' });
        usedFields.add(`company:${field}`);
        return;
      }
    }
    
    // Check contact patterns
    for (const [field, pattern] of Object.entries(contactPatterns)) {
      if (pattern.test(header) && !usedFields.has(`contact:${field}`)) {
        mappings.push({ csvColumn: header, dbField: field, table: 'contact' });
        usedFields.add(`contact:${field}`);
        return;
      }
    }
  });
  
  return mappings;
}

/**
 * Smart field inference from column values
 * Analyzes sample data to suggest field types
 */
export function inferFieldFromValues(columnName: string, sampleValues: string[]): { field: string; table: 'company' | 'contact'; confidence: number } | null {
  const nonEmptyValues = sampleValues.filter(v => v?.trim());
  if (nonEmptyValues.length === 0) return null;
  
  // Email detection
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const emailCount = nonEmptyValues.filter(v => emailRegex.test(v)).length;
  if (emailCount / nonEmptyValues.length > 0.7) {
    // Check if personal or business email
    const hasBusinessDomains = nonEmptyValues.some(v => 
      /@(gmail|yahoo|hotmail|outlook|aol)\./i.test(v) === false
    );
    return {
      field: hasBusinessDomains ? 'general_email' : 'email',
      table: hasBusinessDomains ? 'company' : 'contact',
      confidence: emailCount / nonEmptyValues.length
    };
  }
  
  // Phone detection
  const phoneRegex = /^[\+\d\s\-\(\)]{7,20}$/;
  const phoneCount = nonEmptyValues.filter(v => phoneRegex.test(v.replace(/\s/g, ''))).length;
  if (phoneCount / nonEmptyValues.length > 0.7) {
    return { field: 'company_phone', table: 'company', confidence: phoneCount / nonEmptyValues.length };
  }
  
  // URL detection
  const urlRegex = /^(https?:\/\/|www\.)/i;
  const urlCount = nonEmptyValues.filter(v => urlRegex.test(v)).length;
  if (urlCount / nonEmptyValues.length > 0.7) {
    const isLinkedIn = nonEmptyValues.some(v => /linkedin/i.test(v));
    return {
      field: isLinkedIn ? 'linkedin_url' : 'website',
      table: 'company',
      confidence: urlCount / nonEmptyValues.length
    };
  }
  
  // Rating detection (1-5 scale)
  const ratingCount = nonEmptyValues.filter(v => {
    const num = parseFloat(v);
    return !isNaN(num) && num >= 1 && num <= 5;
  }).length;
  if (ratingCount / nonEmptyValues.length > 0.8) {
    return { field: 'rating', table: 'company', confidence: ratingCount / nonEmptyValues.length };
  }
  
  return null;
}

/**
 * Extract domain from URL or email
 */
export function extractDomain(value: string): string | null {
  if (!value) return null;
  
  // Try URL
  try {
    const url = new URL(value.startsWith('http') ? value : `https://${value}`);
    return url.hostname.replace(/^www\./, '');
  } catch {
    // Try email
    const emailMatch = value.match(/@([^@]+)$/);
    if (emailMatch) {
      return emailMatch[1].toLowerCase();
    }
  }
  
  return null;
}

/**
 * Normalize company name for duplicate detection
 */
export function normalizeCompanyName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .replace(/(inc|llc|ltd|corp|co|company|limited|incorporated)$/g, '');
}
