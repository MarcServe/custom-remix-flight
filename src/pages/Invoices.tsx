import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { FileText, Plus, Download, Sparkles, DollarSign, Calendar as CalendarIcon, Trash2, Upload } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import InvoiceDetailsDialog from "@/components/InvoiceDetailsDialog";
import SendInvoiceEmailDialog from "@/components/SendInvoiceEmailDialog";

export default function Invoices() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [aiDialogOpen, setAiDialogOpen] = useState(false);
  const [aiFormData, setAiFormData] = useState({
    companyId: "",
    dealId: "",
    type: "invoice",
    context: "",
    customPricing: "",
  });
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [sendEmailDialogOpen, setSendEmailDialogOpen] = useState(false);

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importJson, setImportJson] = useState("");
  const importInputRef = useRef<HTMLInputElement>(null);

  const { data: invoices, isLoading } = useQuery({
    queryKey: ["invoices", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("invoices")
        .select(`
          *,
          companies(name),
          deals(title)
        `)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  const { data: companies } = useQuery({
    queryKey: ["companies-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("companies")
        .select("id, name")
        .order("name");
      
      if (error) throw error;
      return data;
    },
  });

  const { data: deals } = useQuery({
    queryKey: ["deals-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("deals")
        .select("id, title")
        .order("title");
      
      if (error) throw error;
      return data;
    },
  });

  const generateInvoice = useMutation({
    mutationFn: async (formData: typeof aiFormData) => {
      const { data, error } = await supabase.functions.invoke("generate-invoice", {
        body: formData,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      setAiDialogOpen(false);
      setAiFormData({ companyId: "", dealId: "", type: "invoice", context: "", customPricing: "" });
      toast({ title: "Success", description: "Invoice generated successfully" });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to generate invoice",
        variant: "destructive",
      });
    },
  });

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      draft: "secondary",
      sent: "default",
      paid: "default",
      overdue: "destructive",
    };
    return <Badge variant={variants[status] || "outline"}>{status}</Badge>;
  };

  const toggleSelectAll = () => {
    if (!invoices?.length) return;
    if (selectedIds.length === invoices.length) setSelectedIds([]);
    else setSelectedIds(invoices.map((inv: any) => inv.id));
  };

  const toggleSelectOne = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const deleteSelected = useMutation({
    mutationFn: async (ids: string[]) => {
      if (ids.length === 0) return ids.length;
      const { error } = await supabase.from("invoices").delete().in("id", ids);
      if (error) throw error;
      return ids.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      setSelectedIds([]);
      setDeleteDialogOpen(false);
      toast({ title: "Deleted", description: `${count} invoice(s) removed.` });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const handleImportExternal = async () => {
    if (!user?.id) {
      toast({ title: "Error", description: "You must be signed in to import.", variant: "destructive" });
      return;
    }
    setImporting(true);
    try {
      let rows: any[] = [];
      if (importFile) {
        const text = await importFile.text();
        const ext = (importFile.name || "").toLowerCase();
        if (ext.endsWith(".json")) {
          const parsed = JSON.parse(text);
          rows = Array.isArray(parsed) ? parsed : [parsed];
        } else if (ext.endsWith(".csv")) {
          const lines = text.split(/\r?\n/).filter(Boolean);
          const header = lines[0].split(",").map((h) => h.trim().toLowerCase().replace(/\s+/g, "_"));
          for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(",").map((v) => v.trim());
            const row: any = {};
            header.forEach((h, j) => { row[h] = values[j] ?? ""; });
            rows.push(row);
          }
        } else {
          toast({ title: "Unsupported file", description: "Use .json or .csv", variant: "destructive" });
          setImporting(false);
          return;
        }
      } else if (importJson.trim()) {
        const parsed = JSON.parse(importJson);
        rows = Array.isArray(parsed) ? parsed : [parsed];
      } else {
        toast({ title: "No data", description: "Upload a file or paste JSON.", variant: "destructive" });
        setImporting(false);
        return;
      }

      const companyNameToId: Record<string, string> = {};
      (companies || []).forEach((c: any) => { companyNameToId[c.name?.toLowerCase() || ""] = c.id; });

      let inserted = 0;
      for (const row of rows) {
        const invoiceNumber = row.invoice_number || row.invoice_number || row["invoice number"] || `IMP-${Date.now()}-${inserted}`;
        const invoiceType = (row.invoice_type || row.type || row.invoice_type || "invoice") as string;
        const issueDate = row.issue_date || row.date || row.issue_date || format(new Date(), "yyyy-MM-dd");
        const dueDate = row.due_date || row.due_date || row.due || issueDate;
        const totalAmount = Number(row.total_amount ?? row.total ?? row.amount ?? row.total_amount ?? 0) || 0;
        const subtotal = Number(row.subtotal ?? row.subtotal) || totalAmount;
        const taxRate = Number(row.tax_rate ?? row.tax_rate) ?? 0;
        const taxAmount = Number(row.tax_amount ?? row.tax_amount) ?? 0;
        const status = (row.status || row.status || "draft") as string;
        const companyName = (row.company_name || row.company || row.company_name || "").trim().toLowerCase();
        const companyId = row.company_id || (companyName ? companyNameToId[companyName] : null) || null;

        let lineItems = row.line_items;
        if (typeof lineItems === "string") {
          try { lineItems = JSON.parse(lineItems); } catch { lineItems = [{ description: "Imported item", quantity: 1, unitPrice: totalAmount, total: totalAmount }]; }
        }
        if (!Array.isArray(lineItems) || lineItems.length === 0) {
          lineItems = [{ description: row.description || "Imported", quantity: 1, unitPrice: totalAmount, total: totalAmount }];
        }

        const { error } = await supabase.from("invoices").insert({
          user_id: user.id,
          invoice_number: invoiceNumber,
          invoice_type: invoiceType,
          issue_date: issueDate,
          due_date: dueDate,
          total_amount: totalAmount,
          subtotal,
          tax_rate: taxRate || null,
          tax_amount: taxAmount || null,
          line_items: lineItems,
          status: status || "draft",
          payment_status: row.payment_status || "unpaid",
          company_id: companyId,
          notes: row.notes || null,
          terms: row.terms || null,
          ai_generated: false,
        });
        if (!error) inserted++;
      }

      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      setImportDialogOpen(false);
      setImportFile(null);
      setImportJson("");
      if (importInputRef.current) importInputRef.current.value = "";
      toast({ title: "Imported", description: `${inserted} invoice(s) imported.` });
    } catch (e: any) {
      toast({ title: "Import failed", description: e?.message || "Invalid file or JSON.", variant: "destructive" });
    } finally {
      setImporting(false);
    }
  };

  const downloadInvoicePDF = (invoice: any) => {
    // Simple HTML to PDF download (in production, use proper PDF generation)
    const html = `
      <html>
        <head>
          <title>Invoice ${invoice.invoice_number}</title>
          <style>
            body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
            h1 { color: #333; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { padding: 10px; text-align: left; border-bottom: 1px solid #ddd; }
            .total { font-size: 1.2em; font-weight: bold; }
          </style>
        </head>
        <body>
          <h1>Invoice ${invoice.invoice_number}</h1>
          <p><strong>Date:</strong> ${format(new Date(invoice.issue_date), "MMM d, yyyy")}</p>
          <p><strong>Due Date:</strong> ${format(new Date(invoice.due_date), "MMM d, yyyy")}</p>
          ${invoice.companies ? `<p><strong>To:</strong> ${invoice.companies.name}</p>` : ''}
          
          <table>
            <thead>
              <tr>
                <th>Description</th>
                <th>Quantity</th>
                <th>Unit Price</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              ${invoice.line_items?.map((item: any) => `
                <tr>
                  <td>${item.description}</td>
                  <td>${item.quantity}</td>
                  <td>$${item.unitPrice.toFixed(2)}</td>
                  <td>$${item.total.toFixed(2)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          
          <div style="margin-top: 20px; text-align: right;">
            <p>Subtotal: $${invoice.subtotal.toFixed(2)}</p>
            <p>Tax (${invoice.tax_rate}%): $${invoice.tax_amount.toFixed(2)}</p>
            <p class="total">Total: $${invoice.total_amount.toFixed(2)}</p>
          </div>
          
          ${invoice.notes ? `<p style="margin-top: 20px;"><strong>Notes:</strong><br/>${invoice.notes}</p>` : ''}
          ${invoice.terms ? `<p style="margin-top: 20px;"><strong>Terms:</strong><br/>${invoice.terms}</p>` : ''}
        </body>
      </html>
    `;

    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `invoice-${invoice.invoice_number}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Invoices & Quotations</h1>
          <p className="text-muted-foreground">Generate and manage invoices with AI</p>
        </div>
        <Dialog open={aiDialogOpen} onOpenChange={setAiDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Sparkles className="mr-2 h-4 w-4" />
              Generate with AI
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[525px] max-h-[90vh] flex flex-col">
            <DialogHeader>
              <DialogTitle>AI Invoice Generator</DialogTitle>
              <DialogDescription>
                Let AI create a professional invoice or quotation based on your data
              </DialogDescription>
            </DialogHeader>
            <ScrollArea className="flex-1 px-1 max-h-[60vh]">
              <div className="grid gap-4 py-4 pr-3">
              <div className="grid gap-2">
                <Label htmlFor="type">Type</Label>
                <Select
                  value={aiFormData.type}
                  onValueChange={(value) => setAiFormData({ ...aiFormData, type: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="invoice">Invoice</SelectItem>
                    <SelectItem value="quotation">Quotation</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="company">Company (Optional)</Label>
                <Select
                  value={aiFormData.companyId}
                  onValueChange={(value) => setAiFormData({ ...aiFormData, companyId: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select company" />
                  </SelectTrigger>
                  <SelectContent>
                    {companies?.map((company) => (
                      <SelectItem key={company.id} value={company.id}>
                        {company.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="deal">Deal (Optional)</Label>
                <Select
                  value={aiFormData.dealId}
                  onValueChange={(value) => setAiFormData({ ...aiFormData, dealId: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select deal" />
                  </SelectTrigger>
                  <SelectContent>
                    {deals?.map((deal) => (
                      <SelectItem key={deal.id} value={deal.id}>
                        {deal.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="context">Additional Context</Label>
                <Textarea
                  id="context"
                  value={aiFormData.context}
                  onChange={(e) => setAiFormData({ ...aiFormData, context: e.target.value })}
                  placeholder="E.g., 3 months of consulting services, monthly retainer..."
                  rows={4}
                />
              </div>
              
              <Separator className="my-2" />
              
              <div className="grid gap-2">
                <Label htmlFor="customPricing">Custom Pricing (Optional)</Label>
                <p className="text-xs text-muted-foreground mb-2">
                  Specify custom line items and pricing. Format: "Item Name - $Price" (one per line)
                </p>
                <Textarea
                  id="customPricing"
                  value={aiFormData.customPricing}
                  onChange={(e) => setAiFormData({ ...aiFormData, customPricing: e.target.value })}
                  placeholder="E.g.,&#10;Consulting Services - $5000&#10;Website Development - $3000&#10;Monthly Support (3 months) - $1500"
                  rows={5}
                  className="font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  Leave empty to let AI determine pricing from context
                </p>
              </div>
              </div>
            </ScrollArea>
            <DialogFooter className="mt-4">
              <Button
                onClick={() => generateInvoice.mutate(aiFormData)}
                disabled={generateInvoice.isPending}
              >
                {generateInvoice.isPending ? "Generating..." : "Generate"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Invoices</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{invoices?.length || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Amount</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${invoices?.reduce((sum, inv) => sum + Number(inv.total_amount), 0).toFixed(2)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Unpaid</CardTitle>
            <CalendarIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {invoices?.filter(inv => inv.payment_status === 'unpaid').length || 0}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle>All Invoices</CardTitle>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setImportDialogOpen(true)}>
              <Upload className="mr-2 h-4 w-4" />Import
            </Button>
            {selectedIds.length > 0 && (
              <Button variant="destructive" size="sm" onClick={() => setDeleteDialogOpen(true)}>
                <Trash2 className="mr-2 h-4 w-4" />Delete ({selectedIds.length})
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading invoices...</p>
          ) : !invoices || invoices.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-4 text-lg font-semibold">No invoices yet</h3>
              <p className="text-sm text-muted-foreground mt-2">Generate your first invoice with AI or import external invoices</p>
              <div className="flex flex-wrap justify-center gap-2 mt-4">
                <Button variant="outline" onClick={() => setImportDialogOpen(true)}>
                  <Upload className="mr-2 h-4 w-4" />Import External Invoices
                </Button>
                <Button onClick={() => setAiDialogOpen(true)}>
                  <Sparkles className="mr-2 h-4 w-4" />Generate with AI
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2 py-3 border-b">
                <Checkbox
                  id="inv-select-all"
                  checked={invoices.length > 0 && selectedIds.length === invoices.length}
                  onCheckedChange={toggleSelectAll}
                  aria-label="Select all"
                />
                <Label htmlFor="inv-select-all" className="text-sm cursor-pointer">
                  {selectedIds.length === invoices.length ? "Clear selection" : "Select all"}
                </Label>
                <span className="text-muted-foreground text-sm mx-1">|</span>
                <Button variant="outline" size="sm" onClick={() => setImportDialogOpen(true)}>
                  <Upload className="mr-2 h-4 w-4" />Import external
                </Button>
                {selectedIds.length > 0 && (
                  <>
                    <span className="text-muted-foreground text-sm mx-1">|</span>
                    <Button variant="destructive" size="sm" onClick={() => setDeleteDialogOpen(true)}>
                      <Trash2 className="mr-2 h-4 w-4" />Delete selected ({selectedIds.length})
                    </Button>
                  </>
                )}
              </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={invoices.length > 0 && selectedIds.length === invoices.length}
                      onCheckedChange={toggleSelectAll}
                      aria-label="Select all"
                    />
                  </TableHead>
                  <TableHead>Invoice #</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map((invoice) => (
                  <TableRow 
                    key={invoice.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => {
                      setSelectedInvoice(invoice);
                      setDetailsDialogOpen(true);
                    }}
                  >
                    <TableCell className="w-10" onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={selectedIds.includes(invoice.id)}
                        onCheckedChange={() => {}}
                        onClick={(e) => toggleSelectOne(invoice.id, e)}
                      />
                    </TableCell>
                    <TableCell className="font-medium">{invoice.invoice_number}</TableCell>
                    <TableCell>{invoice.companies?.name || "N/A"}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{invoice.invoice_type}</Badge>
                    </TableCell>
                    <TableCell>${Number(invoice.total_amount).toFixed(2)}</TableCell>
                    <TableCell>{getStatusBadge(invoice.status)}</TableCell>
                    <TableCell>{format(new Date(invoice.issue_date), "MMM d, yyyy")}</TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => downloadInvoicePDF(invoice)}
                          title="Download"
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => { e.stopPropagation(); setSelectedInvoice(invoice); setDeleteDialogOpen(true); setSelectedIds([invoice.id]); }}
                          title="Delete"
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete selected invoices?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete {selectedIds.length} invoice(s). This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteSelected.mutate(selectedIds)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleteSelected.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Import External Invoices</DialogTitle>
            <DialogDescription>
              Upload a JSON or CSV file, or paste JSON. Each row should include: invoice_number, invoice_type, issue_date, due_date, total_amount, status, and optionally company_name, company_id, line_items, notes, terms.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>File (.json or .csv)</Label>
              <input
                ref={importInputRef}
                type="file"
                accept=".json,.csv"
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm file:border-0 file:bg-transparent file:text-sm file:font-medium"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  setImportFile(f || null);
                  if (f) setImportJson("");
                }}
              />
            </div>
            <div className="space-y-2">
              <Label>Or paste JSON array</Label>
              <Textarea
                value={importJson}
                onChange={(e) => setImportJson(e.target.value)}
                placeholder='[{"invoice_number":"INV-001","invoice_type":"invoice","issue_date":"2026-01-01","due_date":"2026-01-31","total_amount":1000,"status":"draft"}]'
                rows={6}
                className="font-mono text-xs"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setImportDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleImportExternal} disabled={importing || (!importFile && !importJson.trim())}>
              {importing ? "Importing..." : "Import"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Invoice Details Dialog */}
      {selectedInvoice && (
        <InvoiceDetailsDialog
          invoice={selectedInvoice}
          open={detailsDialogOpen}
          onOpenChange={setDetailsDialogOpen}
          onSendEmail={() => {
            setDetailsDialogOpen(false);
            setSendEmailDialogOpen(true);
          }}
          onDownload={() => downloadInvoicePDF(selectedInvoice)}
        />
      )}

      {/* Send Invoice Email Dialog */}
      {selectedInvoice && (
        <SendInvoiceEmailDialog
          invoice={selectedInvoice}
          open={sendEmailDialogOpen}
          onOpenChange={setSendEmailDialogOpen}
        />
      )}
    </div>
  );
}
