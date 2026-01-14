import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Upload, 
  FileSpreadsheet, 
  CheckCircle, 
  Loader2,
  AlertCircle,
  Database
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useQueryClient } from '@tanstack/react-query';

interface ParsedRow {
  name?: string;
  website?: string;
  email?: string;
  phone?: string;
  industry?: string;
  geography?: string;
  [key: string]: string | undefined;
}

export function ImportCSVPanel() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isDragging, setIsDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<ParsedRow[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && (droppedFile.type === 'text/csv' || droppedFile.name.endsWith('.csv'))) {
      processFile(droppedFile);
    } else {
      toast.error('Please upload a CSV file');
    }
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      processFile(selectedFile);
    }
  };

  const processFile = async (file: File) => {
    setFile(file);
    
    const text = await file.text();
    const lines = text.split('\n').filter(line => line.trim());
    
    if (lines.length < 2) {
      toast.error('CSV file is empty or has no data rows');
      return;
    }

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/['"]/g, ''));
    
    const rows: ParsedRow[] = [];
    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVLine(lines[i]);
      const row: ParsedRow = {};
      
      headers.forEach((header, idx) => {
        const value = values[idx]?.trim().replace(/['"]/g, '') || '';
        
        // Map common header variations
        if (header.includes('name') || header.includes('company')) {
          row.name = value;
        } else if (header.includes('website') || header.includes('url') || header.includes('site')) {
          row.website = value;
        } else if (header.includes('email') || header.includes('mail')) {
          row.email = value;
        } else if (header.includes('phone') || header.includes('tel')) {
          row.phone = value;
        } else if (header.includes('industry') || header.includes('category')) {
          row.industry = value;
        } else if (header.includes('city') || header.includes('location') || header.includes('geography') || header.includes('address')) {
          row.geography = value;
        }
        
        row[header] = value;
      });
      
      if (row.name) {
        rows.push(row);
      }
    }

    setParsedData(rows);
    toast.success(`Parsed ${rows.length} rows from CSV`);
  };

  const parseCSVLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"' && !inQuotes) {
        inQuotes = true;
      } else if (char === '"' && inQuotes) {
        inQuotes = false;
      } else if (char === ',' && !inQuotes) {
        result.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current);
    
    return result;
  };

  const handleImport = async () => {
    if (parsedData.length === 0) {
      toast.error('No data to import');
      return;
    }

    setIsImporting(true);
    setImportProgress(0);
    let imported = 0;
    let skipped = 0;

    for (let i = 0; i < parsedData.length; i++) {
      const row = parsedData[i];
      
      try {
        // Check if exists
        const { data: existing } = await supabase
          .from('companies')
          .select('id')
          .eq('user_id', user?.id)
          .ilike('name', row.name || '')
          .maybeSingle();

        if (existing) {
          skipped++;
        } else {
          const { error } = await supabase
            .from('companies')
            .insert({
              user_id: user?.id,
              name: row.name,
              website: row.website || `no-website-${crypto.randomUUID()}`,
              general_email: row.email,
              company_phone: row.phone,
              industry: row.industry,
              geography: row.geography,
            });

          if (!error) imported++;
        }
      } catch (err) {
        console.error('Import error:', err);
      }

      setImportProgress(Math.round(((i + 1) / parsedData.length) * 100));
    }

    queryClient.invalidateQueries({ queryKey: ['companies'] });
    setIsImporting(false);
    toast.success(`Imported ${imported} companies${skipped > 0 ? ` (${skipped} skipped)` : ''}`);
    
    // Reset
    setFile(null);
    setParsedData([]);
    setImportProgress(0);
  };

  const resetImport = () => {
    setFile(null);
    setParsedData([]);
    setImportProgress(0);
  };

  return (
    <div className="space-y-4">
      {!file && (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`
            border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer
            ${isDragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/30 hover:border-primary/50'}
          `}
        >
          <input
            type="file"
            accept=".csv"
            onChange={handleFileSelect}
            className="hidden"
            id="csv-upload"
          />
          <label htmlFor="csv-upload" className="cursor-pointer">
            <div className="flex flex-col items-center gap-4">
              <div className="p-4 rounded-full bg-primary/10">
                <Upload className="h-8 w-8 text-primary" />
              </div>
              <div>
                <p className="font-medium">Drop your CSV file here</p>
                <p className="text-sm text-muted-foreground mt-1">
                  or click to browse
                </p>
              </div>
              <Badge variant="secondary">
                <FileSpreadsheet className="h-3 w-3 mr-1" />
                CSV files only
              </Badge>
            </div>
          </label>
        </div>
      )}

      {file && parsedData.length > 0 && !isImporting && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              <span className="font-medium">{file.name}</span>
            </div>
            <Badge variant="secondary">{parsedData.length} rows</Badge>
          </div>

          <Card className="p-4 bg-muted/30">
            <h4 className="font-medium mb-2 text-sm">Preview (first 5 rows):</h4>
            <ScrollArea className="h-[200px]">
              <div className="space-y-2">
                {parsedData.slice(0, 5).map((row, idx) => (
                  <div key={idx} className="p-2 bg-background rounded border text-xs">
                    <div className="font-medium">{row.name}</div>
                    <div className="text-muted-foreground flex flex-wrap gap-2 mt-1">
                      {row.website && <span>🌐 {row.website}</span>}
                      {row.email && <span>📧 {row.email}</span>}
                      {row.phone && <span>📞 {row.phone}</span>}
                      {row.industry && <span>🏢 {row.industry}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </Card>

          <div className="flex gap-2">
            <Button variant="outline" onClick={resetImport} className="flex-1">
              Cancel
            </Button>
            <Button onClick={handleImport} className="flex-1">
              <Database className="h-4 w-4 mr-2" />
              Import {parsedData.length} Companies
            </Button>
          </div>
        </div>
      )}

      {isImporting && (
        <div className="py-8 text-center space-y-4">
          <Loader2 className="h-10 w-10 mx-auto animate-spin text-primary" />
          <div>
            <h3 className="font-medium">Importing Companies</h3>
            <p className="text-sm text-muted-foreground">{importProgress}% complete</p>
          </div>
          <Progress value={importProgress} className="w-full max-w-xs mx-auto" />
        </div>
      )}

      {!file && (
        <div className="p-4 bg-muted/30 rounded-lg">
          <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            Supported CSV formats:
          </h4>
          <ul className="text-xs text-muted-foreground space-y-1">
            <li>• Apify Google Maps exports</li>
            <li>• LinkedIn Sales Navigator exports</li>
            <li>• Any CSV with name, website, email columns</li>
          </ul>
        </div>
      )}
    </div>
  );
}
