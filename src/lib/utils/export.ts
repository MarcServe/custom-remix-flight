/**
 * Export utilities for lead finder data
 */

interface CompanyExportData {
  name: string;
  website?: string;
  industry?: string;
  size?: string;
  geography?: string;
  description?: string;
  linkedinUrl?: string;
  employeeCount?: number;
  companyPhone?: string;
  generalEmail?: string;
  qualityScore?: number;
  dataCompleteness?: number;
  contacts?: Array<{
    name: string;
    email?: string;
    title?: string;
    department?: string;
    phone?: string;
  }>;
  products?: string;
  recentNews?: string;
  fundingInfo?: string;
}

/**
 * Convert companies to CSV format
 */
export function generateCSVContent(companies: CompanyExportData[]): string {
  // CSV headers
  const headers = [
    'Company Name',
    'Website',
    'Industry',
    'Size',
    'Geography',
    'Description',
    'LinkedIn URL',
    'Employee Count',
    'Company Phone',
    'General Email',
    'Quality Score',
    'Data Completeness %',
    'Contact Names',
    'Contact Emails',
    'Contact Titles',
    'Products',
    'Recent News',
    'Funding Info'
  ];

  // Create CSV rows
  const rows = companies.map(company => {
    const contactNames = company.contacts?.map(c => c.name).join('; ') || '';
    const contactEmails = company.contacts?.map(c => c.email || 'N/A').join('; ') || '';
    const contactTitles = company.contacts?.map(c => c.title || 'N/A').join('; ') || '';

    return [
      escapeCSV(company.name),
      escapeCSV(company.website || ''),
      escapeCSV(company.industry || ''),
      escapeCSV(company.size || ''),
      escapeCSV(company.geography || ''),
      escapeCSV(company.description || ''),
      escapeCSV(company.linkedinUrl || ''),
      company.employeeCount?.toString() || '',
      escapeCSV(company.companyPhone || ''),
      escapeCSV(company.generalEmail || ''),
      company.qualityScore?.toString() || '',
      company.dataCompleteness?.toString() || '',
      escapeCSV(contactNames),
      escapeCSV(contactEmails),
      escapeCSV(contactTitles),
      escapeCSV(company.products || ''),
      escapeCSV(company.recentNews || ''),
      escapeCSV(company.fundingInfo || '')
    ];
  });

  // Combine headers and rows (CRLF for Excel compatibility)
  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.join(','))
  ].join('\r\n');

  return csvContent;
}

/**
 * Escape CSV values (handle commas, quotes, newlines)
 */
function escapeCSV(value: string): string {
  if (!value) return '';
  
  // If value contains comma, quote, or newline, wrap in quotes and escape existing quotes
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  
  return value;
}

/**
 * Download CSV file
 */
export function downloadCSV(content: string, filename: string): void {
  const BOM = '\uFEFF';
  const blob = new Blob([BOM + content], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  // Clean up
  URL.revokeObjectURL(url);
}

/**
 * Export companies to CSV and trigger download
 */
export function exportCompaniesToCSV(companies: CompanyExportData[], prefix: string = 'leads'): void {
  const csvContent = generateCSVContent(companies);
  const timestamp = new Date().toISOString().split('T')[0];
  const filename = `${prefix}_${timestamp}.csv`;
  downloadCSV(csvContent, filename);
}
