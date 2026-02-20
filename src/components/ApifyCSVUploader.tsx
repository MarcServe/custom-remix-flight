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
import { Upload, FileSpreadsheet, Check, AlertCircle, Building2, User, X } from 'lucide-react';
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
  normalizeCompanyName
} from '@/lib/utils/csv-parser';
import { COMPANY_SOURCE_TAGS } from '@/lib/company-sources';
import { useNavigate } from 'react-router-dom';

interface ApifyCSVUploaderProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type ImportStep = 'upload' | 'mapping' | 'preview' | 'importing' | 'complete';

export function ApifyCSVUploader({ open, onOpenChange }: ApifyCSVUploaderProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [step, setStep] = useState<ImportStep>('upload');
  const [csvData, setCsvData] = useState<ParsedCSV | null>(null);
  const [mappings, setMappings] = useState<ColumnMapping[]>([]);
  const [unmappedColumns, setUnmappedColumns] = useState<string[]>([]);
  const [suggestedMappings, setSuggestedMappings] = useState<Map<string, { field: string; table: 'company' | 'contact'; confidence: number }>>(new Map());
  const [importProgress, setImportProgress] = useState(0);
  const [importStats, setImportStats] = useState({ companies: 0, contacts: 0, skipped: 0 });
  const [importedCompanyIds, setImportedCompanyIds] = useState<string[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [previewPage, setPreviewPage] = useState(1);
  const [previewPageSize, setPreviewPageSize] = useState(10);

  const handleFileSelect = useCallback((file: File) => {
    if (!file.name.endsWith('.csv')) {
      toast.error('Please upload a CSV file');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const parsed = parseCSV(text);
      
      if (parsed.headers.length === 0) {
        toast.error('CSV file appears to be empty');
        return;
      }

      setCsvData(parsed);
      
      // Auto-detect mappings with enhanced Apify patterns
      const detected = autoDetectMappings(parsed.headers);
      setMappings(detected);
      
      // Find unmapped columns and try to infer from values
      const mappedColumns = detected.map(m => m.csvColumn);
      const unmapped = parsed.headers.filter(h => !mappedColumns.includes(h));
      setUnmappedColumns(unmapped);
      
      // Infer field types from sample values for unmapped columns
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
      toast.success(`Loaded ${parsed.rows.length} rows from CSV`);
    };
    reader.readAsText(file);
  }, []);

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

    const stats = { companies: 0, contacts: 0, skipped: 0 };
    const totalRows = csvData.rows.length;
    
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

        if (!companyData.name) {
          stats.skipped++;
          continue;
        }

        // Check for existing company
        let companyId: string | undefined;
        const normalizedName = normalizeCompanyName(companyData.name);
        
        if (existingByName.has(normalizedName)) {
          companyId = existingByName.get(normalizedName);
          stats.skipped++;
        } else if (companyData.website) {
          const domain = extractDomain(companyData.website);
          if (domain && existingByDomain.has(domain)) {
            companyId = existingByDomain.get(domain);
            stats.skipped++;
          }
        }

        // Create new company if not exists
        if (!companyId) {
          const insertData = {
            name: companyData.name as string,
            user_id: user.id,
            website: companyData.website,
            company_phone: companyData.company_phone,
            general_email: companyData.general_email,
            industry: companyData.industry,
            size: companyData.size,
            geography: companyData.geography,
            headquarters: companyData.headquarters,
            linkedin_url: companyData.linkedin_url,
            description: companyData.description,
            employee_count: companyData.employee_count,
            tags: [COMPANY_SOURCE_TAGS.CSV_IMPORT],
          };
          
          const { data: newCompany, error } = await supabase
            .from('companies')
            .insert([insertData])
            .select('id')
            .single();
          
          if (error) {
            console.error('Company insert error:', error);
            stats.skipped++;
            continue;
          }
          
          companyId = newCompany.id;
          existingByName.set(normalizedName, companyId);
          if (companyData.website) {
            const domain = extractDomain(companyData.website);
            if (domain) existingByDomain.set(domain, companyId);
          }
          stats.companies++;
        }

        // Build contact data if mappings exist
        if (contactMappings.length > 0 && companyId) {
          const contactData: Record<string, any> = { company_id: companyId };
          contactMappings.forEach(m => {
            const value = row[m.csvColumn]?.trim();
            if (value) contactData[m.dbField] = value;
          });

          if (contactData.name || contactData.email) {
            const contactInsertData = {
              company_id: companyId,
              name: (contactData.name || contactData.email || 'Unknown') as string,
              email: contactData.email,
              title: contactData.title,
              phone: contactData.phone,
              linkedin_url: contactData.linkedin_url,
              department: contactData.department,
            };
            
            const { error } = await supabase
              .from('contacts')
              .insert([contactInsertData]);
            
            if (!error) stats.contacts++;
          }
        }
      } catch (err) {
        console.error('Row import error:', err);
        stats.skipped++;
      }

      setImportProgress(Math.round(((i + 1) / totalRows) * 100));
    }

    setImportStats(stats);
    setStep('complete');
    queryClient.invalidateQueries({ queryKey: ['companies'] });
  };

  const reset = () => {
    setStep('upload');
    setCsvData(null);
    setMappings([]);
    setUnmappedColumns([]);
    setImportProgress(0);
    setImportStats({ companies: 0, contacts: 0, skipped: 0 });
  };

  const handleClose = () => {
    reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Import Companies from CSV
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-hidden">
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
                  <code className="bg-muted px-1 rounded">Description</code>
                </p>
                <p className="text-muted-foreground">
                  Example header row: <code className="bg-muted px-1 rounded text-xs">Name,Website,Email,Phone,Industry,Geography</code>
                </p>
              </div>
            </div>
          )}

          {step === 'mapping' && csvData && (
            <Tabs defaultValue="mapped" className="h-full flex flex-col">
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

              <TabsContent value="mapped" className="h-[400px]">
                <ScrollArea className="h-full pr-4">
                  <div className="space-y-3">
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
                </ScrollArea>
              </TabsContent>

              <TabsContent value="unmapped" className="h-[400px]">
                <ScrollArea className="h-full pr-4">
                  <div className="space-y-2">
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
                </ScrollArea>
              </TabsContent>

              <TabsContent value="preview" className="h-[400px] flex flex-col">
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
                      <ScrollArea className="flex-1 min-h-0">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              {csvData.headers.slice(0, 6).map(h => (
                                <TableHead key={h} className="whitespace-nowrap">{h}</TableHead>
                              ))}
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {pageRows.map((row, idx) => (
                              <TableRow key={startIndex + idx}>
                                {csvData.headers.slice(0, 6).map(h => (
                                  <TableCell key={h} className="max-w-[200px] truncate">
                                    {row[h] || '-'}
                                  </TableCell>
                                ))}
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </ScrollArea>
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
                {importStats.skipped > 0 && (
                  <Badge variant="outline" className="text-base px-4 py-2">
                    <AlertCircle className="h-4 w-4 mr-2" />
                    {importStats.skipped} Skipped
                  </Badge>
                )}
              </div>
              {importStats.companies > 0 && (
                <div className="flex justify-center gap-3">
                  <Button variant="outline" onClick={handleClose}>
                    Close
                  </Button>
                  <Button onClick={() => {
                    handleClose();
                    navigate('/campaigns');
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
