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
 * Auto-detect column mappings based on header names
 */
export function autoDetectMappings(headers: string[]): ColumnMapping[] {
  const mappings: ColumnMapping[] = [];
  
  const companyPatterns: Record<string, RegExp> = {
    name: /^(company\s*name|name|business\s*name|organization)$/i,
    website: /^(website|url|site|web|domain|homepage)$/i,
    company_phone: /^(phone|telephone|tel|company\s*phone|business\s*phone)$/i,
    general_email: /^(email|e-?mail|company\s*email|business\s*email)$/i,
    industry: /^(industry|sector|category|business\s*type)$/i,
    size: /^(size|company\s*size|employees|employee\s*count|staff)$/i,
    geography: /^(geography|location|country|region|city|state)$/i,
    headquarters: /^(address|headquarters|hq|street|full\s*address)$/i,
    linkedin_url: /^(linkedin|linkedin\s*url|company\s*linkedin)$/i,
    description: /^(description|about|summary|bio)$/i,
  };
  
  const contactPatterns: Record<string, RegExp> = {
    name: /^(contact\s*name|person\s*name|full\s*name|owner|owner\s*name)$/i,
    email: /^(contact\s*email|person\s*email|owner\s*email)$/i,
    title: /^(title|job\s*title|position|role|designation)$/i,
    phone: /^(contact\s*phone|person\s*phone|mobile|cell)$/i,
    linkedin_url: /^(contact\s*linkedin|person\s*linkedin|profile\s*url)$/i,
    department: /^(department|dept|division|team)$/i,
  };
  
  headers.forEach(header => {
    // Check company patterns
    for (const [field, pattern] of Object.entries(companyPatterns)) {
      if (pattern.test(header)) {
        mappings.push({ csvColumn: header, dbField: field, table: 'company' });
        return;
      }
    }
    
    // Check contact patterns
    for (const [field, pattern] of Object.entries(contactPatterns)) {
      if (pattern.test(header)) {
        mappings.push({ csvColumn: header, dbField: field, table: 'contact' });
        return;
      }
    }
  });
  
  return mappings;
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
