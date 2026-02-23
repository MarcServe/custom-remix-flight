import { useState, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Upload, FileSpreadsheet, Check, AlertCircle, Building2, User, X, Save } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { 
  parseCSV, 
  autoDetectMappings, 
  inferFieldFromValues,
  COMPANY_FIELDS, 
  CONTACT_FIELDS,
  ColumnMapping,
  ParsedCSV,
  extractDomain,
  normalizeCompanyName,
  parseMultipleEmails,
  companyNameFromWebsite,
  normalizeWebsiteUrl
} from '@/lib/utils/csv-parser';
import { COMPANY_SOURCE_TAGS } from '@/lib/company-sources';
import { useNavigate } from 'react-router-dom';

interface ApifyCSVUploaderProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When provided, "Create Email Campaign" will call this with imported company IDs and close (e.g. open campaign compose with those companies). */
  onComplete?: (companyIds: string[]) => void;
}

type ImportStep = 'upload' | 'mapping' | 'preview' | 'importing' | 'complete';

/** A row that failed to import (e.g. unique constraint); user can edit and retry. */
export interface FailedImportRow {
  id: string;
  rowIndex: number;
  companyPayload: Record<string, unknown>;
  contactEmails: string[];
  contactData: Record<string, unknown>;
  errorMessage: string;
  constraint?: string;
}

export function ApifyCSVUploader({ open, onOpenChange, onComplete }: ApifyCSVUploaderProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [step, setStep] = useState<ImportStep>('upload');
  const [csvData, setCsvData] = useState<ParsedCSV | null>(null);
  const [mappings, setMappings] = useState<ColumnMapping[]>([]);
  const [unmappedColumns, setUnmappedColumns] = useState<string[]>([]);
  const [suggestedMappings, setSuggestedMappings] = useState<Map<string, { field: string; table: 'company' | 'contact'; confidence: number }>>(new Map());
  const [importProgress, setImportProgress] = useState(0);
  const [importStats, setImportStats] = useState<{
    companies: number;
    contacts: number;
    replaced: number;
    skipped: number;
    skipReasons?: { noName: number; duplicateName: number; duplicateDomain: number; insertError: number; error: number };
    firstInsertError?: string;
  }>({ companies: 0, contacts: 0, replaced: 0, skipped: 0 });
  const [importedCompanyIds, setImportedCompanyIds] = useState<string[]>([]);
  const [importTag, setImportTag] = useState('');
  const [replaceDuplicates, setReplaceDuplicates] = useState(false);
  /** When same website exists and we're not replacing: add new emails as contacts to existing company. */
  const [mergeContactsWhenDuplicateDomain, setMergeContactsWhenDuplicateDomain] = useState(true);
  const [failedRows, setFailedRows] = useState<FailedImportRow[]>([]);
  const [savingAllFailed, setSavingAllFailed] = useState(false);
  const [savingProgress, setSavingProgress] = useState<{ current: number; total: number } | null>(null);
  const [normalisingWebsites, setNormalisingWebsites] = useState(false);
  const [normalisingProgress, setNormalisingProgress] = useState<{ current: number; total: number } | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [previewPage, setPreviewPage] = useState(1);
  const [previewPageSize, setPreviewPageSize] = useState(10);
  const [firstRowIsHeaders, setFirstRowIsHeaders] = useState(true);
  const [rawCsvText, setRawCsvText] = useState<string | null>(null);

  const applyParsed = useCallback((parsed: ParsedCSV) => {
    setCsvData(parsed);
    const detected = autoDetectMappings(parsed.headers);
    setMappings(detected);
    const mappedColumns = detected.map(m => m.csvColumn);
    const unmapped = parsed.headers.filter(h => !mappedColumns.includes(h));
    setUnmappedColumns(unmapped);
    const suggestions = new Map<string, { field: string; table: 'company' | 'contact'; confidence: number }>();
    unmapped.forEach(col => {
      const sampleValues = parsed.rows.slice(0, 10).map(r => r[col]);
      const inference = inferFieldFromValues(col, sampleValues);
      if (inference && inference.confidence > 0.7) {
        suggestions.set(col, inference);
      }
    });
    setSuggestedMappings(suggestions);
    setPreviewPage(1);
    setPreviewPageSize(10);
    setStep('mapping');
  }, []);

  const handleFileSelect = useCallback((file: File) => {
    if (!file.name.endsWith('.csv')) {
      toast.error('Please upload a CSV file');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      setRawCsvText(text);
      const parsed = parseCSV(text, { firstRowIsHeaders });
      if (parsed.headers.length === 0) {
        toast.error('CSV file appears to be empty');
        return;
      }
      applyParsed(parsed);
      toast.success(`Loaded ${parsed.rows.length} rows from CSV`);
    };
    reader.readAsText(file);
  }, [firstRowIsHeaders, applyParsed]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  }, [handleFileSelect]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileSelect(file);
  }, [handleFileSelect]);

  const updateMapping = (csvColumn: string, dbField: string, table: 'company' | 'contact') => {
    if (dbField === 'skip') {
      // Remove mapping
      setMappings(prev => prev.filter(m => m.csvColumn !== csvColumn));
      if (!unmappedColumns.includes(csvColumn)) {
        setUnmappedColumns(prev => [...prev, csvColumn]);
      }
    } else {
      // Add or update mapping
      setMappings(prev => {
        const existing = prev.find(m => m.csvColumn === csvColumn);
        if (existing) {
          return prev.map(m => m.csvColumn === csvColumn ? { ...m, dbField, table } : m);
        }
        return [...prev, { csvColumn, dbField, table }];
      });
      setUnmappedColumns(prev => prev.filter(c => c !== csvColumn));
    }
  };

  const addColumnMapping = (csvColumn: string) => {
    setUnmappedColumns(prev => prev.filter(c => c !== csvColumn));
    setMappings(prev => [...prev, { csvColumn, dbField: '', table: 'company' }]);
  };

  const runImport = async () => {
    if (!csvData) return;
    
    setStep('importing');
    setImportProgress(0);
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error('Please log in to import data');
      return;
    }

    const stats = { companies: 0, contacts: 0, replaced: 0, skipped: 0, skipReasons: { noName: 0, duplicateName: 0, duplicateDomain: 0, insertError: 0, error: 0 } as Record<string, number>, firstInsertError: undefined as string | undefined };
    const importedIds: string[] = [];
    const failed: FailedImportRow[] = [];
    const totalRows = csvData.rows.length;

    const pushFailed = (rowIndex: number, companyPayload: Record<string, unknown>, contactEmails: string[], contactData: Record<string, unknown>, err: unknown) => {
      const msg = (() => {
        if (err instanceof Error) return err.message;
        if (err && typeof err === 'object' && 'message' in err && typeof (err as { message: unknown }).message === 'string') return (err as { message: string }).message;
        return err != null ? String(err) : 'Unknown error';
      })();
      const constraint = msg.match(/unique constraint "([^"]+)"/i)?.[1] ?? undefined;
      failed.push({
        id: `failed-${rowIndex}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        rowIndex: rowIndex + 1,
        companyPayload: { ...companyPayload },
        contactEmails: [...contactEmails],
        contactData: { ...contactData },
        errorMessage: msg,
        constraint,
      });
    };
    
    // Group mappings by table
    const companyMappings = mappings.filter(m => m.table === 'company' && m.dbField);
    const contactMappings = mappings.filter(m => m.table === 'contact' && m.dbField);
    
    // Check for required fields
    const hasCompanyName = companyMappings.some(m => m.dbField === 'name');
    if (!hasCompanyName) {
      toast.error('Company Name mapping is required');
      setStep('mapping');
      return;
    }

    // Fetch existing companies for duplicate detection
    const { data: existingCompanies } = await supabase
      .from('companies')
      .select('id, name, website')
      .eq('user_id', user.id);
    
    const existingByName = new Map<string, string>();
    const existingByDomain = new Map<string, string>();
    
    existingCompanies?.forEach(c => {
      existingByName.set(normalizeCompanyName(c.name), c.id);
      if (c.website) {
        const domain = extractDomain(c.website);
        if (domain) existingByDomain.set(domain, c.id);
      }
    });

    for (let i = 0; i < csvData.rows.length; i++) {
      const row = csvData.rows[i];
      
      try {
        // Build company data
        const companyData: Record<string, any> = { user_id: user.id };
        companyMappings.forEach(m => {
          const value = row[m.csvColumn]?.trim();
          if (value) {
            if (m.dbField === 'employee_count') {
              const num = parseInt(value.replace(/\D/g, ''));
              if (!isNaN(num)) companyData[m.dbField] = num;
            } else {
              companyData[m.dbField] = value;
            }
          }
        });

        // One company, multiple emails: use first for company, keep rest for contacts
        const companyEmailRaw = companyData.general_email ?? (companyData as any).email;
        const allEmailsFromCompany = companyEmailRaw ? parseMultipleEmails(String(companyEmailRaw)) : [];
        if (allEmailsFromCompany.length > 0) {
          companyData.general_email = allEmailsFromCompany[0];
        }

        // If no company name mapped but we have website, derive name from domain (e.g. results.csv with only Website,Email)
        if (!companyData.name && companyData.website) {
          companyData.name = companyNameFromWebsite(companyData.website) ?? undefined;
        }
        if (!companyData.name) {
          stats.skipped++;
          stats.skipReasons.noName++;
          continue;
        }

        // Check for existing company
        let companyId: string | undefined;
        const normalizedName = normalizeCompanyName(companyData.name);
        let isDuplicateByName = false;
        let isDuplicateByDomain = false;
        
        if (existingByName.has(normalizedName)) {
          companyId = existingByName.get(normalizedName);
          isDuplicateByName = true;
        } else if (companyData.website) {
          const domain = extractDomain(companyData.website);
          if (domain && existingByDomain.has(domain)) {
            companyId = existingByDomain.get(domain);
            isDuplicateByDomain = true;
          }
        }

        // Coerce text fields to string; sanitize so description/specialism etc. never break the DB (null bytes, control chars)
        const str = (v: unknown) => {
          if (v == null || v === '') return undefined;
          if (typeof v === 'object') return undefined; // avoid storing "[object Object]"
          const s = String(v).replace(/\0/g, '').replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
          return s || undefined;
        };
        const rawWebsite = str(companyData.website);
        const companyPayload = {
          name: companyData.name as string,
          website: rawWebsite ? normalizeWebsiteUrl(rawWebsite) : undefined,
          company_phone: str(companyData.company_phone),
          general_email: str(companyData.general_email),
          industry: str(companyData.industry),
          size: str(companyData.size),
          geography: str(companyData.geography),
          headquarters: str(companyData.headquarters),
          linkedin_url: str(companyData.linkedin_url),
          description: str(companyData.description),
          employee_count: companyData.employee_count,
          tags: [COMPANY_SOURCE_TAGS.CSV_IMPORT, ...(importTag.trim() ? [`Import: ${importTag.trim()}`] : [])],
        };

        if (companyId && (isDuplicateByName || isDuplicateByDomain)) {
          if (replaceDuplicates) {
            const { error: updateErr } = await supabase
              .from('companies')
              .update(companyPayload)
              .eq('id', companyId);
            if (updateErr) {
              console.error('Company update error:', updateErr);
              stats.skipped++;
              stats.skipReasons.insertError++;
              if (!stats.firstInsertError) stats.firstInsertError = updateErr.message;
              const contactDataForErr: Record<string, unknown> = {};
              contactMappings.forEach(m => {
                const value = row[m.csvColumn]?.trim();
                if (value) contactDataForErr[m.dbField] = value;
              });
              pushFailed(i, companyPayload, allEmailsFromCompany, contactDataForErr, updateErr);
              continue;
            }
            importedIds.push(companyId);
            stats.replaced++;
          } else {
            // Same domain, different emails: optionally add new emails as contacts to existing company
            if (isDuplicateByDomain && mergeContactsWhenDuplicateDomain) {
              // Don't skip — use existing companyId and add contacts below; include in campaign set
              importedIds.push(companyId);
            } else {
              stats.skipped++;
              if (isDuplicateByName) stats.skipReasons.duplicateName++;
              else stats.skipReasons.duplicateDomain++;
              companyId = undefined; // so we don't add contacts for this row
            }
          }
        }

        // Create new company if not exists
        if (!companyId) {
          const insertData = {
            ...companyPayload,
            user_id: user.id,
          };
          
          const { data: newCompany, error } = await supabase
            .from('companies')
            .insert([insertData])
            .select('id')
            .single();
          
          if (error) {
            console.error('Company insert error:', error);
            stats.skipped++;
            stats.skipReasons.insertError++;
            if (!stats.firstInsertError) stats.firstInsertError = error.message;
            const contactData: Record<string, unknown> = {};
            contactMappings.forEach(m => {
              const value = row[m.csvColumn]?.trim();
              if (value) contactData[m.dbField] = value;
            });
            pushFailed(i, companyPayload, allEmailsFromCompany, contactData, error);
            continue;
          }
          
          companyId = newCompany.id;
          importedIds.push(companyId);
          existingByName.set(normalizedName, companyId);
          if (companyData.website) {
            const domain = extractDomain(companyData.website);
            if (domain) existingByDomain.set(domain, companyId);
          }
          stats.companies++;
        }

        // Build contact data: one contact per email when cell has multiple emails
        if (companyId) {
          const contactData: Record<string, any> = { company_id: companyId };
          if (contactMappings.length > 0) {
            contactMappings.forEach(m => {
              const value = row[m.csvColumn]?.trim();
              if (value) contactData[m.dbField] = value;
            });
          }
          const contactEmailRaw = contactData.email ?? (contactMappings.length === 0 ? undefined : null);
          const contactEmails = contactEmailRaw ? parseMultipleEmails(String(contactEmailRaw)) : (allEmailsFromCompany.length > 1 ? allEmailsFromCompany : []);
          const baseName = (contactData.name || contactData.email || '').trim() || undefined;
          if (contactEmails.length > 0) {
            for (let e = 0; e < contactEmails.length; e++) {
              const email = contactEmails[e];
              const name = baseName && e === 0 ? baseName : (email.split('@')[0] || 'Contact').replace(/[._-]+/g, ' ');
              const contactInsertData = {
                company_id: companyId,
                name: name || 'Contact',
                email,
                title: contactData.title,
                phone: contactData.phone,
                linkedin_url: contactData.linkedin_url,
                department: contactData.department,
              };
              const { error } = await supabase.from('contacts').insert([contactInsertData]);
              if (!error) stats.contacts++;
            }
          } else if (contactData.name || contactData.email) {
            const contactInsertData = {
              company_id: companyId,
              name: (contactData.name || contactData.email || 'Unknown') as string,
              email: contactData.email,
              title: contactData.title,
              phone: contactData.phone,
              linkedin_url: contactData.linkedin_url,
              department: contactData.department,
            };
            const { error } = await supabase.from('contacts').insert([contactInsertData]);
            if (!error) stats.contacts++;
          }
        }
      } catch (err) {
        console.error('Row import error:', err);
        stats.skipped++;
        stats.skipReasons.error++;
      }

      setImportProgress(Math.round(((i + 1) / totalRows) * 100));
    }

    setImportStats(stats);
    setImportedCompanyIds(importedIds);
    setFailedRows(failed);
    setStep('complete');
    queryClient.invalidateQueries({ queryKey: ['companies'] });
    queryClient.invalidateQueries({ queryKey: ['companies-full'] });
    queryClient.invalidateQueries({ queryKey: ['companies-total-count'] });
  };

  const updateFailedRowPayload = (id: string, field: string, value: string | number | undefined) => {
    setFailedRows(prev => prev.map(r => r.id === id ? { ...r, companyPayload: { ...r.companyPayload, [field]: value ?? '' } } : r));
  };

  /** Append a unique suffix to each row's website so companies_website_unique is satisfied for all. */
  const makeWebsitesUnique = () => {
    setFailedRows(prev => prev.map(r => {
      const w = (r.companyPayload.website as string) ?? '';
      if (!w.trim()) return r;
      const sep = w.includes('?') ? '&' : '?';
      const unique = `${w.trim()}${sep}import=row-${r.rowIndex}`;
      return { ...r, companyPayload: { ...r.companyPayload, website: unique } };
    }));
    toast.success(`Websites updated with a unique suffix for ${failedRows.length} rows. Click "Save all" to add to CRM.`);
  };

  /** Clear website for all failed rows so they can be added without triggering companies_website_unique. */
  const clearAllWebsites = () => {
    setFailedRows(prev => prev.map(r => ({ ...r, companyPayload: { ...r.companyPayload, website: '' } })));
    toast.success('Websites cleared. You can add companies without a website, or edit and Save individually. Click "Save all" to add all.');
  };

  /** Normalise website URLs (trailing slash, lowercase host) so e.g. example.com/ and example.com match before Save all. Shows progress. */
  const normaliseFailedRowWebsites = async () => {
    const total = failedRows.length;
    if (total === 0) return;
    setNormalisingWebsites(true);
    setNormalisingProgress({ current: 0, total });
    await new Promise(r => setTimeout(r, 50)); // let "Normalising... 0/141" render
    const BATCH = 50;
    let updated = failedRows.map(r => ({ ...r }));
    for (let start = 0; start < updated.length; start += BATCH) {
      const end = Math.min(start + BATCH, updated.length);
      for (let i = start; i < end; i++) {
        const w = (updated[i].companyPayload.website as string) ?? '';
        updated[i] = {
          ...updated[i],
          companyPayload: {
            ...updated[i].companyPayload,
            website: w.trim() ? normalizeWebsiteUrl(w) : w,
          },
        };
      }
      setFailedRows([...updated]);
      setNormalisingProgress({ current: end, total });
      await new Promise(r => setTimeout(r, 40)); // brief delay so user sees counter update
    }
    setNormalisingProgress(null);
    setNormalisingWebsites(false);
    toast.success(`Websites normalised for ${total} rows. Click "Save all" to add to CRM.`);
  };

  const saveAllFailedRows = async () => {
    const snapshot = [...failedRows];
    if (snapshot.length === 0) return;
    setSavingAllFailed(true);
    setSavingProgress({ current: 0, total: snapshot.length });
    let saved = 0;
    for (let i = 0; i < snapshot.length; i++) {
      const ok = await retryFailedRow(snapshot[i]);
      if (ok) saved++;
      setSavingProgress({ current: i + 1, total: snapshot.length });
      if ((i + 1) % 50 === 0) toast.loading(`Saving... ${i + 1}/${snapshot.length}`, { id: 'save-all' });
    }
    setSavingProgress(null);
    toast.dismiss('save-all');
    const failed = snapshot.length - saved;
    if (saved > 0) {
      toast.success(
        failed > 0
          ? `Added ${saved} companies to CRM. ${failed} row${failed !== 1 ? 's' : ''} could not be added (duplicate website). Use "Make websites unique" to add them as separate companies.`
          : `Added ${saved} companies to CRM.`
      );
    }
    if (failed > 0) {
      toast.info(`${failed} row${failed !== 1 ? 's' : ''} still have duplicate websites. Use "Make websites unique" then "Save all" to add each as a separate company.`, { duration: 6000 });
    }
    setSavingAllFailed(false);
  };

  const retryFailedRow = async (failed: FailedImportRow): Promise<boolean> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error('Please log in to add to CRM');
      return false;
    }
    const payload = failed.companyPayload as Record<string, unknown>;
    const str = (v: unknown) => (v != null && v !== '' ? String(v) : undefined);
    const name = (payload.name != null ? String(payload.name) : '').trim();
    if (!name) {
      toast.error('Company name is required');
      return false;
    }
    const rawWebsite = str(payload.website);
    const companyPayload = {
      name,
      website: rawWebsite ? normalizeWebsiteUrl(rawWebsite) : undefined,
      company_phone: str(payload.company_phone),
      general_email: str(payload.general_email),
      industry: str(payload.industry),
      size: str(payload.size),
      geography: str(payload.geography),
      headquarters: str(payload.headquarters),
      linkedin_url: str(payload.linkedin_url),
      description: str(payload.description),
      employee_count: typeof payload.employee_count === 'number' ? payload.employee_count : undefined,
      tags: (payload.tags as string[]) ?? [COMPANY_SOURCE_TAGS.CSV_IMPORT, ...(importTag.trim() ? [`Import: ${importTag.trim()}`] : [])],
    };
    const insertData = { ...companyPayload, user_id: user.id };
    const { data: newCompany, error } = await supabase
      .from('companies')
      .insert([insertData])
      .select('id')
      .single();
    if (error) {
      const errMsg = typeof error === 'object' && error !== null && 'message' in error && typeof (error as { message: unknown }).message === 'string' ? (error as { message: string }).message : (error instanceof Error ? error.message : String(error));
      toast.error(errMsg);
      setFailedRows(prev => prev.map(r => r.id === failed.id ? { ...r, errorMessage: errMsg } : r));
      return false;
    }
    const companyId = newCompany.id;
    const contactEmails = failed.contactEmails.length > 0 ? failed.contactEmails : (companyPayload.general_email ? [companyPayload.general_email] : []);
    let contactsAdded = 0;
    for (let e = 0; e < contactEmails.length; e++) {
      const email = contactEmails[e];
      const nameVal = (e === 0 && (failed.contactData.name as string)) ? (failed.contactData.name as string) : (email.split('@')[0] || 'Contact').replace(/[._-]+/g, ' ');
      const { error: contactErr } = await supabase.from('contacts').insert([{
        company_id: companyId,
        name: nameVal || 'Contact',
        email,
        title: failed.contactData.title,
        phone: failed.contactData.phone,
        linkedin_url: failed.contactData.linkedin_url,
        department: failed.contactData.department,
      }]);
      if (!contactErr) contactsAdded++;
    }
    setFailedRows(prev => prev.filter(r => r.id !== failed.id));
    setImportStats(s => ({ ...s, companies: s.companies + 1, contacts: s.contacts + contactsAdded }));
    setImportedCompanyIds(prev => [...prev, companyId]);
    queryClient.invalidateQueries({ queryKey: ['companies'] });
    queryClient.invalidateQueries({ queryKey: ['companies-full'] });
    queryClient.invalidateQueries({ queryKey: ['companies-total-count'] });
    toast.success(`Added "${name}" to CRM${contactsAdded > 0 ? ` with ${contactsAdded} contact(s)` : ''}`);
    return true;
  };

  const reset = () => {
    setStep('upload');
    setCsvData(null);
    setRawCsvText(null);
    setFirstRowIsHeaders(true);
    setMappings([]);
    setUnmappedColumns([]);
    setImportProgress(0);
    setImportStats({ companies: 0, contacts: 0, replaced: 0, skipped: 0, skipReasons: { noName: 0, duplicateName: 0, duplicateDomain: 0, insertError: 0, error: 0 } });
    setImportedCompanyIds([]);
    setFailedRows([]);
    setSavingAllFailed(false);
    setSavingProgress(null);
    setNormalisingWebsites(false);
    setNormalisingProgress(null);
    setImportTag('');
  };

  const handleClose = () => {
    reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col min-w-0"
        onInteractOutside={(e) => {
          const target = e.target as HTMLElement;
          if (target.closest?.('[data-sidebar="main"]')) e.preventDefault();
        }}
        onPointerDownOutside={(e) => {
          const target = e.target as HTMLElement;
          if (target.closest?.('[data-sidebar="main"]')) e.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Import Companies from CSV
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 min-h-0 min-w-0 overflow-auto">
          {step === 'upload' && (
            <div className="space-y-4">
              <Label
                htmlFor="csv-upload"
                className={`
                  flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-12 text-center transition-colors cursor-pointer
                  ${dragActive ? 'border-primary bg-primary/10' : 'border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/30'}
                `}
                onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
                onDragLeave={() => setDragActive(false)}
                onDrop={handleDrop}
              >
                <Input
                  id="csv-upload"
                  type="file"
                  accept=".csv,text/csv,application/csv,text/comma-separated-values"
                  className="hidden"
                  onChange={handleInputChange}
                />
                <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground pointer-events-none" />
                <h3 className="text-lg font-medium mb-2 pointer-events-none">Drop your CSV file here</h3>
                <p className="text-sm text-muted-foreground mb-4 pointer-events-none">
                  or click anywhere to browse. Supports Research Chat exports, Apify, and standard CSV.
                </p>
                <Button type="button" variant="outline" className="pointer-events-none" asChild>
                  <span>Select CSV File</span>
                </Button>
              </Label>
              <div className="flex items-start gap-3 rounded-lg border bg-muted/20 p-3 mb-3">
                <Checkbox
                  id="no-headers"
                  checked={!firstRowIsHeaders}
                  onCheckedChange={(v) => {
                    setFirstRowIsHeaders(!v);
                    if (rawCsvText) {
                      const parsed = parseCSV(rawCsvText, { firstRowIsHeaders: !v });
                      if (parsed.headers.length > 0) applyParsed(parsed);
                    }
                  }}
                />
                <div className="grid gap-1">
                  <label htmlFor="no-headers" className="text-sm font-medium cursor-pointer">
                    First row is data (no header row)
                  </label>
                  <p className="text-xs text-muted-foreground">
                    Use for CSVs with only Website and Email columns and no header line. We’ll infer columns and derive company names from the website.
                  </p>
                </div>
              </div>
              <div className="rounded-lg border bg-muted/30 p-4 text-sm">
                <p className="font-medium mb-2">CSV header requirements for mapping</p>
                <p className="text-muted-foreground mb-2">
                  Use these column names in your first row for auto-mapping. First row = headers only; data starts on row 2.
                </p>
                <p className="mb-1">
                  <span className="font-medium">Required:</span>{' '}
                  <code className="bg-muted px-1 rounded">Name</code> or <code className="bg-muted px-1 rounded">Company Name</code>
                </p>
                <p className="mb-2">
                  <span className="font-medium">Optional (any of these):</span>{' '}
                  <code className="bg-muted px-1 rounded">Website</code>, <code className="bg-muted px-1 rounded">Email</code>,{' '}
                  <code className="bg-muted px-1 rounded">Phone</code>, <code className="bg-muted px-1 rounded">Industry</code>,{' '}
                  <code className="bg-muted px-1 rounded">Geography</code>, <code className="bg-muted px-1 rounded">Address</code>,{' '}
                  <code className="bg-muted px-1 rounded">Company Size</code>, <code className="bg-muted px-1 rounded">LinkedIn URL</code>,{' '}
                  <code className="bg-muted px-1 rounded">Description</code> (or <code className="bg-muted px-1 rounded">Specialism</code> — both map to company description and are safe to use).
                </p>
                <p className="text-muted-foreground">
                  Example header row: <code className="bg-muted px-1 rounded text-xs">Name,Website,Email,Phone,Industry,Geography</code>
                </p>
                <p className="text-muted-foreground mt-2 text-xs">
                  <strong>Multiple emails:</strong> If one cell has several emails (e.g. <code>info@x.com, media@x.com</code>), we use the first for the company and create one contact per email (one row per email for tracking). Non-email noise (e.g. image filenames, tracking domains) is filtered out.
                </p>
              </div>
            </div>
          )}

          {step === 'mapping' && csvData && (
            <Tabs defaultValue="mapped" className="h-full flex flex-col min-w-0">
              <div className="rounded-md border bg-muted/20 px-3 py-2 mb-3 shrink-0">
                <p className="text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">CSV headers for next time:</span>{' '}
                  Required: <code className="bg-muted px-0.5 rounded">Name</code>. Optional: <code className="bg-muted px-0.5 rounded">Website</code>, <code className="bg-muted px-0.5 rounded">Email</code>, <code className="bg-muted px-0.5 rounded">Phone</code>, <code className="bg-muted px-0.5 rounded">Industry</code>, <code className="bg-muted px-0.5 rounded">Geography</code>, <code className="bg-muted px-0.5 rounded">Address</code> — use these in your first row for auto-mapping.
                </p>
              </div>
              <TabsList className="mb-4 shrink-0">
                <TabsTrigger value="mapped">
                  Mapped Columns ({mappings.length})
                </TabsTrigger>
                <TabsTrigger value="unmapped">
                  Unmapped ({unmappedColumns.length})
                </TabsTrigger>
                <TabsTrigger value="preview">
                  Preview Data
                </TabsTrigger>
              </TabsList>
              <div className="mb-3">
                <Label className="text-xs text-muted-foreground">Name this import (optional)</Label>
                <Input
                  placeholder="e.g. Feb 2026 leads, Conference list"
                  value={importTag}
                  onChange={(e) => setImportTag(e.target.value)}
                  className="mt-1 max-w-xs"
                />
                <p className="text-xs text-muted-foreground mt-1">Filter by this later via &quot;Filter by Tags&quot; → &quot;Import: …&quot;</p>
              </div>
              <div className="mb-3 flex items-start gap-3 rounded-lg border bg-muted/20 p-3">
                <Checkbox
                  id="replace-duplicates"
                  checked={replaceDuplicates}
                  onCheckedChange={(v) => setReplaceDuplicates(!!v)}
                />
                <div className="grid gap-1">
                  <label htmlFor="replace-duplicates" className="text-sm font-medium cursor-pointer">
                    Replace existing companies when duplicate (name or website)
                  </label>
                  <p className="text-xs text-muted-foreground">
                    If a company with the same name or website already exists, update it with the new CSV data (e.g. description, email). Use when the import has more robust information.
                  </p>
                </div>
              </div>
              <div className="mb-3 flex items-start gap-3 rounded-lg border bg-muted/20 p-3">
                <Checkbox
                  id="merge-contacts-domain"
                  checked={mergeContactsWhenDuplicateDomain}
                  onCheckedChange={(v) => setMergeContactsWhenDuplicateDomain(!!v)}
                />
                <div className="grid gap-1">
                  <label htmlFor="merge-contacts-domain" className="text-sm font-medium cursor-pointer">
                    When same website: add new emails as contacts (instead of skipping)
                  </label>
                  <p className="text-xs text-muted-foreground">
                    If a company with the same website already exists and you don’t replace it, add the CSV row’s emails as new contacts to that company. Same domain can have different emails.
                  </p>
                </div>
              </div>

              <TabsContent value="mapped" className="h-[400px] min-w-0">
                <div className="h-full overflow-auto pr-2">
                  <div className="space-y-3 min-w-max">
                    {mappings.map((mapping, idx) => (
                      <div key={idx} className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                        <div className="flex-1">
                          <Label className="text-xs text-muted-foreground">CSV Column</Label>
                          <p className="font-medium">{mapping.csvColumn}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            Sample: {csvData.rows[0]?.[mapping.csvColumn] || '-'}
                          </p>
                        </div>
                        
                        <Select
                          value={mapping.table}
                          onValueChange={(v) => updateMapping(mapping.csvColumn, mapping.dbField, v as 'company' | 'contact')}
                        >
                          <SelectTrigger className="w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="company">
                              <span className="flex items-center gap-1">
                                <Building2 className="h-3 w-3" /> Company
                              </span>
                            </SelectItem>
                            <SelectItem value="contact">
                              <span className="flex items-center gap-1">
                                <User className="h-3 w-3" /> Contact
                              </span>
                            </SelectItem>
                          </SelectContent>
                        </Select>

                        <Select
                          value={mapping.dbField}
                          onValueChange={(v) => updateMapping(mapping.csvColumn, v, mapping.table)}
                        >
                          <SelectTrigger className="w-40">
                            <SelectValue placeholder="Select field" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="skip">
                              <span className="text-muted-foreground">Skip this column</span>
                            </SelectItem>
                            {(mapping.table === 'company' ? COMPANY_FIELDS : CONTACT_FIELDS).map(f => (
                              <SelectItem key={f.value} value={f.value}>
                                {f.label} {f.required && <span className="text-destructive">*</span>}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => updateMapping(mapping.csvColumn, 'skip', mapping.table)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                    
                    {mappings.length === 0 && (
                      <p className="text-center text-muted-foreground py-8">
                        No columns mapped yet. Add columns from the "Unmapped" tab.
                      </p>
                    )}
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="unmapped" className="h-[400px] min-w-0">
                <div className="h-full overflow-auto pr-2">
                  <div className="space-y-2 min-w-max">
                    {unmappedColumns.map((col) => (
                      <div key={col} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                        <div>
                          <p className="font-medium">{col}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            Sample: {csvData.rows[0]?.[col] || '-'}
                          </p>
                        </div>
                        <Button variant="outline" size="sm" onClick={() => addColumnMapping(col)}>
                          Add Mapping
                        </Button>
                      </div>
                    ))}
                    
                    {unmappedColumns.length === 0 && (
                      <p className="text-center text-muted-foreground py-8">
                        All columns have been mapped!
                      </p>
                    )}
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="preview" className="h-[400px] flex flex-col min-w-0">
                {(() => {
                  const totalRows = csvData.rows.length;
                  const totalPages = Math.max(1, Math.ceil(totalRows / previewPageSize));
                  const startIndex = (previewPage - 1) * previewPageSize;
                  const endIndex = Math.min(startIndex + previewPageSize, totalRows);
                  const pageRows = csvData.rows.slice(startIndex, endIndex);
                  return (
                    <>
                      <div className="flex items-center justify-between gap-2 py-2 border-b shrink-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-muted-foreground whitespace-nowrap">Rows per page</span>
                          <Select
                            value={String(previewPageSize)}
                            onValueChange={(v) => {
                              setPreviewPageSize(Number(v));
                              setPreviewPage(1);
                            }}
                          >
                            <SelectTrigger className="w-[72px] h-8">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {[10, 25, 50, 100].map((n) => (
                                <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <span className="text-sm text-muted-foreground whitespace-nowrap">
                          Showing {totalRows === 0 ? 0 : startIndex + 1}–{endIndex} of {totalRows} rows
                        </span>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8"
                            onClick={() => setPreviewPage((p) => Math.max(1, p - 1))}
                            disabled={previewPage <= 1}
                          >
                            Previous
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8"
                            onClick={() => setPreviewPage((p) => Math.min(totalPages, p + 1))}
                            disabled={previewPage >= totalPages}
                          >
                            Next
                          </Button>
                        </div>
                      </div>
                      <div className="flex-1 min-h-0 overflow-auto">
                        <Table className="min-w-max">
                          <TableHeader>
                            <TableRow>
                              {csvData.headers.map(h => (
                                <TableHead key={h} className="whitespace-nowrap">{h}</TableHead>
                              ))}
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {pageRows.map((row, idx) => (
                              <TableRow key={startIndex + idx}>
                                {csvData.headers.map(h => (
                                  <TableCell key={h} className="max-w-[200px] whitespace-nowrap">
                                    <span className="inline-block max-w-[200px] truncate align-middle" title={String(row[h] || '-')}>
                                      {row[h] || '-'}
                                    </span>
                                  </TableCell>
                                ))}
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </>
                  );
                })()}
              </TabsContent>
            </Tabs>
          )}

          {step === 'importing' && (
            <div className="py-12 text-center">
              <Progress value={importProgress} className="mb-4" />
              <p className="text-lg font-medium">Importing data... {importProgress}%</p>
              <p className="text-sm text-muted-foreground">Please don't close this window</p>
            </div>
          )}

          {step === 'complete' && (
            <div className="py-12 text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-500/10 mb-4">
                <Check className="h-8 w-8 text-green-500" />
              </div>
              <h3 className="text-xl font-semibold mb-4">Import Complete!</h3>
              <div className="flex justify-center gap-4 mb-6">
                <Badge variant="secondary" className="text-base px-4 py-2">
                  <Building2 className="h-4 w-4 mr-2" />
                  {importStats.companies} Companies
                </Badge>
                <Badge variant="secondary" className="text-base px-4 py-2">
                  <User className="h-4 w-4 mr-2" />
                  {importStats.contacts} Contacts
                </Badge>
                {importStats.replaced > 0 && (
                  <Badge variant="secondary" className="text-base px-4 py-2">
                    <Building2 className="h-4 w-4 mr-2" />
                    {importStats.replaced} Replaced
                  </Badge>
                )}
                {importStats.skipped > 0 && (
                  <Badge variant="outline" className="text-base px-4 py-2">
                    <AlertCircle className="h-4 w-4 mr-2" />
                    {importStats.skipped} Skipped
                  </Badge>
                )}
              </div>
              {importStats.skipped > 0 && importStats.skipReasons && (
                <div className="text-left max-w-lg mx-auto mb-6 px-4 py-3 rounded-lg bg-muted/50 text-sm">
                  <p className="font-medium text-muted-foreground mb-2">Why rows were skipped:</p>
                  <ul className="space-y-1">
                    {importStats.skipReasons.duplicateName > 0 && (
                      <li>• <strong>Duplicate company name</strong> — already in your Companies ({importStats.skipReasons.duplicateName})</li>
                    )}
                    {importStats.skipReasons.duplicateDomain > 0 && (
                      <li>• <strong>Duplicate website</strong> — company with same domain exists ({importStats.skipReasons.duplicateDomain})</li>
                    )}
                    {importStats.skipReasons.noName > 0 && (
                      <li>• <strong>No company name</strong> — row missing or unmapped name ({importStats.skipReasons.noName})</li>
                    )}
                    {importStats.skipReasons.insertError > 0 && (
                      <li>
                        • <strong>Row rejected by database</strong> ({importStats.skipReasons.insertError}) — e.g. unique constraint (e.g. <code>companies_website_unique</code>). Fix the rows below and click Save to add to CRM.
                        {importStats.firstInsertError && (
                          <span className="block mt-1 text-xs text-muted-foreground">First error: {importStats.firstInsertError}</span>
                        )}
                      </li>
                    )}
                    {importStats.skipReasons.error > 0 && (
                      <li>• <strong>Other error</strong> — unexpected error processing row ({importStats.skipReasons.error})</li>
                    )}
                  </ul>
                </div>
              )}
              {failedRows.length > 0 && (
                <div className="text-left max-w-4xl mx-auto mb-6 rounded-lg border bg-muted/30 overflow-hidden">
                  <div className="px-4 py-3 border-b bg-muted/50 space-y-2">
                    <p className="font-medium text-foreground">
                      Fix errors and add to CRM ({failedRows.length} row{failedRows.length !== 1 ? 's' : ''})
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Fix <code className="bg-muted px-0.5 rounded">companies_website_unique</code>: use the actions below to fix all rows at once, or edit and Save individually.
                    </p>
                    {normalisingProgress && (
                      <div className="flex flex-col gap-1.5 rounded-md bg-muted/50 px-3 py-2">
                        <p className="text-sm font-medium text-foreground">Normalising websites…</p>
                        <div className="flex items-center gap-2">
                          <Progress value={normalisingProgress.total ? (normalisingProgress.current / normalisingProgress.total) * 100 : 0} className="h-2 flex-1" />
                          <span className="text-xs text-muted-foreground tabular-nums whitespace-nowrap">
                            {normalisingProgress.current}/{normalisingProgress.total} rows
                          </span>
                        </div>
                      </div>
                    )}
                    {savingProgress && (
                      <div className="flex flex-col gap-1.5 rounded-md bg-muted/50 px-3 py-2">
                        <p className="text-sm font-medium text-foreground">Saving to CRM…</p>
                        <div className="flex items-center gap-2">
                          <Progress value={savingProgress.total ? (savingProgress.current / savingProgress.total) * 100 : 0} className="h-2 flex-1" />
                          <span className="text-xs text-muted-foreground tabular-nums whitespace-nowrap">
                            {savingProgress.current}/{savingProgress.total} rows
                          </span>
                        </div>
                      </div>
                    )}
                    <div className="flex flex-wrap gap-2 pt-1 items-center">
                      <Button type="button" variant="outline" size="sm" onClick={normaliseFailedRowWebsites} disabled={normalisingWebsites || savingAllFailed}>
                        {normalisingWebsites ? 'Normalising...' : 'Normalise websites'}
                      </Button>
                      <Button type="button" variant="outline" size="sm" onClick={makeWebsitesUnique} disabled={normalisingWebsites}>
                        Make websites unique
                      </Button>
                      <Button type="button" variant="outline" size="sm" onClick={clearAllWebsites} disabled={normalisingWebsites}>
                        Clear all websites
                      </Button>
                      <Button type="button" size="sm" onClick={saveAllFailedRows} disabled={savingAllFailed || normalisingWebsites}>
                        {savingAllFailed ? 'Saving...' : `Save all (${failedRows.length})`}
                      </Button>
                    </div>
                  </div>
                  <ScrollArea className="h-[280px] w-full">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-12">Row</TableHead>
                          <TableHead>Name</TableHead>
                          <TableHead>Website</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead className="max-w-[200px]">Error</TableHead>
                          <TableHead className="w-20"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {failedRows.map((row) => (
                          <TableRow key={row.id}>
                            <TableCell className="font-mono text-xs text-muted-foreground">{row.rowIndex}</TableCell>
                            <TableCell className="p-1">
                              <Input
                                className="h-8 text-sm"
                                value={(row.companyPayload.name as string) ?? ''}
                                onChange={(e) => updateFailedRowPayload(row.id, 'name', e.target.value)}
                                placeholder="Company name"
                              />
                            </TableCell>
                            <TableCell className="p-1">
                              <Input
                                className="h-8 text-sm font-mono"
                                value={(row.companyPayload.website as string) ?? ''}
                                onChange={(e) => updateFailedRowPayload(row.id, 'website', e.target.value)}
                                placeholder="e.g. example.com"
                                title="Change or clear to fix unique constraint"
                              />
                            </TableCell>
                            <TableCell className="p-1">
                              <Input
                                className="h-8 text-sm font-mono"
                                value={(row.companyPayload.general_email as string) ?? ''}
                                onChange={(e) => updateFailedRowPayload(row.id, 'general_email', e.target.value)}
                                placeholder="Email"
                              />
                            </TableCell>
                            <TableCell className="max-w-[200px] text-xs text-muted-foreground truncate" title={row.errorMessage}>
                              {row.constraint ? (
                                <span className="text-amber-600 dark:text-amber-400">{row.constraint}</span>
                              ) : (
                                row.errorMessage
                              )}
                            </TableCell>
                            <TableCell className="p-1">
                              <Button size="sm" variant="default" className="h-8 gap-1" onClick={() => retryFailedRow(row)}>
                                <Save className="h-3.5 w-3.5" />
                                Save
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </div>
              )}
              {(importStats.companies > 0 || importStats.replaced > 0) && (
                <div className="flex justify-center gap-3">
                  <Button variant="outline" onClick={handleClose}>
                    Close
                  </Button>
                  <Button onClick={() => {
                    if (onComplete && importedCompanyIds.length > 0) {
                      onComplete(importedCompanyIds);
                      handleClose();
                    } else {
                      handleClose();
                      navigate('/campaigns');
                    }
                  }}>
                    Create Email Campaign
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          {step === 'mapping' && (
            <>
              <Button variant="outline" onClick={reset}>Back</Button>
              <Button onClick={runImport} disabled={!mappings.some(m => m.dbField === 'name')}>
                Import {csvData?.rows.length || 0} Rows
              </Button>
            </>
          )}
          {step === 'complete' && (
            <Button onClick={handleClose}>Done</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
