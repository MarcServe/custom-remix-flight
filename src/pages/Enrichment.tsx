import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Wand2,
  Loader2,
  Building2,
  Mail,
  Globe,
  Phone,
  Linkedin,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowRight,
  RefreshCw,
  Filter,
  Search,
  Download,
  Trash2,
  Sparkles,
  AlertCircle,
  Upload,
  Users,
  Zap,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";

interface EnrichmentQueueItem {
  id: string;
  name: string;
  website?: string;
  industry?: string;
  geography?: string;
  description?: string;
  email?: string;
  phone?: string;
  linkedin_url?: string;
  source: string;
  enrichment_status: 'pending' | 'enriching' | 'enriched' | 'failed' | 'extracting_email' | 'ready_for_crm';
  enrichment_provider?: 'perplexity' | 'exa' | 'both';
  enrichment_data?: any;
  enrichment_errors?: string[];
  email_extraction_status: 'pending' | 'extracting' | 'extracted' | 'failed' | 'not_needed';
  extracted_email?: string;
  created_at: string;
  updated_at: string;
  enriched_at?: string;
}

export default function Enrichment() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'enriching' | 'enriched' | 'ready_for_crm' | 'failed'>('all');
  const [searchQuery, setSearchQuery] = useState("");
  const [addLeadDialogOpen, setAddLeadDialogOpen] = useState(false);
  const [importFromCompaniesOpen, setImportFromCompaniesOpen] = useState(false);
  const [importFromPeopleOpen, setImportFromPeopleOpen] = useState(false);
  type ImportFilter = 'all' | 'missing-email' | 'missing-phone' | 'missing-email-and-phone';
  const [importCompanyFilter, setImportCompanyFilter] = useState<ImportFilter>('missing-email-and-phone');
  const [importPeopleFilter, setImportPeopleFilter] = useState<ImportFilter>('missing-email-and-phone');
  const [importSelectedIds, setImportSelectedIds] = useState<Set<string>>(new Set());
  const [importPeopleSelectedIds, setImportPeopleSelectedIds] = useState<Set<string>>(new Set());
  const [importAutoRun, setImportAutoRun] = useState(false);
  const [newLead, setNewLead] = useState({
    name: "",
    website: "",
    industry: "",
    geography: "",
  });

  // Fetch enrichment queue
  const { data: queueItems, isLoading } = useQuery({
    queryKey: ['enrichment-queue', statusFilter],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      let query = (supabase as any)
        .from('enrichment_queue')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (statusFilter !== 'all') {
        query = query.eq('enrichment_status', statusFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as EnrichmentQueueItem[];
    },
  });

  // Fetch companies for Import from Companies dialog
  const { data: companiesForImport } = useQuery({
    queryKey: ['companies-for-enrichment-import'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      const { data, error } = await supabase
        .from('companies')
        .select('id, name, website, industry, geography, general_email, company_phone')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as Array<{
        id: string;
        name: string;
        website?: string;
        industry?: string;
        geography?: string;
        general_email?: string;
        company_phone?: string;
      }>;
    },
    enabled: importFromCompaniesOpen,
  });

  const companiesToShowInImport = useMemo(() => {
    if (!companiesForImport) return [];
    if (importCompanyFilter === 'all') return companiesForImport;
    return companiesForImport.filter(c => {
      const hasEmail = !!(c.general_email && String(c.general_email).trim());
      const hasPhone = !!(c.company_phone && String(c.company_phone).trim());
      switch (importCompanyFilter) {
        case 'missing-email': return !hasEmail;
        case 'missing-phone': return !hasPhone;
        case 'missing-email-and-phone': return !hasEmail && !hasPhone;
        default: return true;
      }
    });
  }, [companiesForImport, importCompanyFilter]);

  // Fetch people (with company) for Import from People dialog
  type PersonForImport = {
    id: string;
    first_name: string | null;
    last_name: string | null;
    email: string | null;
    phone: string | null;
    company_id: string | null;
    companies: { name: string; website?: string; industry?: string; geography?: string } | null;
  };
  const { data: peopleForImport } = useQuery({
    queryKey: ['people-for-enrichment-import'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      const { data, error } = await supabase
        .from('people')
        .select('id, first_name, last_name, email, phone, company_id, companies(name, website, industry, geography)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as PersonForImport[];
    },
    enabled: importFromPeopleOpen,
  });

  const peopleToShowInImport = useMemo(() => {
    if (!peopleForImport) return [];
    if (importPeopleFilter === 'all') return peopleForImport;
    return peopleForImport.filter(p => {
      const hasEmail = !!(p.email && String(p.email).trim());
      const hasPhone = !!(p.phone && String(p.phone).trim());
      switch (importPeopleFilter) {
        case 'missing-email': return !hasEmail;
        case 'missing-phone': return !hasPhone;
        case 'missing-email-and-phone': return !hasEmail && !hasPhone;
        default: return true;
      }
    });
  }, [peopleForImport, importPeopleFilter]);

  // Import from Companies mutation
  const importFromCompaniesMutation = useMutation({
    mutationFn: async ({ companyIds, autoRun }: { companyIds: string[]; autoRun: boolean }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      const toInsert = (companiesForImport || []).filter(c => companyIds.includes(c.id));
      const inserts = toInsert.map(c => ({
        user_id: user.id,
        name: c.name,
        website: c.website || null,
        industry: c.industry || null,
        geography: c.geography || null,
        email: c.general_email || null,
        phone: c.company_phone || null,
        source: 'import',
        source_metadata: { from: 'companies', company_id: c.id },
        enrichment_status: 'pending',
        email_extraction_status: (c.website && !c.general_email) ? 'pending' : 'not_needed',
      }));
      const { data, error } = await (supabase as any).from('enrichment_queue').insert(inserts).select('id');
      if (error) throw error;
      const ids = (data || []).map((r: { id: string }) => r.id);
      return { ids, autoRun };
    },
    onSuccess: async (result) => {
      queryClient.invalidateQueries({ queryKey: ['enrichment-queue'] });
      setImportFromCompaniesOpen(false);
      setImportSelectedIds(new Set());
      toast({
        title: 'Imported to queue',
        description: `${result.ids.length} companies added. ${result.autoRun ? 'Starting enrichment…' : 'Run Enrich then Extract Emails when ready.'}`,
      });
      if (result.autoRun && result.ids.length > 0) {
        enrichMutation.mutate(result.ids);
      }
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message || 'Import failed', variant: 'destructive' });
    },
  });

  // Import from People mutation
  const importFromPeopleMutation = useMutation({
    mutationFn: async ({ personIds, autoRun }: { personIds: string[]; autoRun: boolean }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      const toInsert = (peopleForImport || []).filter(p => personIds.includes(p.id));
      const inserts = toInsert.map(p => {
        const company = p.companies;
        const name = (company?.name || [p.first_name, p.last_name].filter(Boolean).join(' ') || 'Unknown').trim();
        return {
          user_id: user.id,
          name,
          website: company?.website || null,
          industry: company?.industry || null,
          geography: company?.geography || null,
          email: p.email || null,
          phone: p.phone || null,
          source: 'import',
          source_metadata: { from: 'people', person_id: p.id, company_id: p.company_id },
          enrichment_status: 'pending',
          email_extraction_status: (company?.website && !p.email) ? 'pending' : 'not_needed',
        };
      });
      const { data, error } = await (supabase as any).from('enrichment_queue').insert(inserts).select('id');
      if (error) throw error;
      const ids = (data || []).map((r: { id: string }) => r.id);
      return { ids, autoRun };
    },
    onSuccess: async (result) => {
      queryClient.invalidateQueries({ queryKey: ['enrichment-queue'] });
      setImportFromPeopleOpen(false);
      setImportPeopleSelectedIds(new Set());
      toast({
        title: 'Imported to queue',
        description: `${result.ids.length} people/companies added. ${result.autoRun ? 'Starting enrichment…' : 'Run Enrich then Extract Emails when ready.'}`,
      });
      if (result.autoRun && result.ids.length > 0) {
        enrichMutation.mutate(result.ids);
      }
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message || 'Import failed', variant: 'destructive' });
    },
  });

  // Filter by search query
  const filteredItems = useMemo(() => {
    if (!queueItems) return [];
    if (!searchQuery.trim()) return queueItems;

    const query = searchQuery.toLowerCase();
    return queueItems.filter(item =>
      item.name.toLowerCase().includes(query) ||
      item.website?.toLowerCase().includes(query) ||
      item.industry?.toLowerCase().includes(query) ||
      item.email?.toLowerCase().includes(query)
    );
  }, [queueItems, searchQuery]);

  // Add lead to queue
  const addLeadMutation = useMutation({
    mutationFn: async (lead: typeof newLead) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await (supabase as any)
        .from('enrichment_queue')
        .insert({
          user_id: user.id,
          name: lead.name,
          website: lead.website || null,
          industry: lead.industry || null,
          geography: lead.geography || null,
          source: 'manual',
          enrichment_status: 'pending',
          email_extraction_status: lead.website ? 'pending' : 'not_needed',
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['enrichment-queue'] });
      setNewLead({ name: "", website: "", industry: "", geography: "" });
      setAddLeadDialogOpen(false);
      toast({
        title: "Lead added",
        description: "Lead added to enrichment queue",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to add lead",
        variant: "destructive",
      });
    },
  });

  // Batch enrich leads
  const enrichMutation = useMutation({
    mutationFn: async (itemIds: string[]) => {
      const items = filteredItems.filter(item => itemIds.includes(item.id));
      
      const { data, error } = await supabase.functions.invoke('batch-enrich-leads', {
        body: {
          itemIds,
          provider: 'perplexity', // Can be made configurable
        },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['enrichment-queue'] });
      setSelectedItems(new Set());
      toast({
        title: "Enrichment started",
        description: "Leads are being enriched in the background",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to start enrichment",
        variant: "destructive",
      });
    },
  });

  // Extract emails
  const extractEmailsMutation = useMutation({
    mutationFn: async (itemIds: string[]) => {
      const items = filteredItems.filter(item => itemIds.includes(item.id) && item.website && !item.email && !item.extracted_email);
      
      // Update status to extracting
      await (supabase as any)
        .from('enrichment_queue')
        .update({ email_extraction_status: 'extracting' })
        .in('id', items.map(i => i.id));

      // Extract emails for each item
      const results: any[] = [];
      for (const item of items) {
        try {
          const { data, error } = await supabase.functions.invoke('extract-website-email', {
            body: {
              companyId: item.id, // Use queue item ID
              website: item.website,
              companyName: item.name,
              isEnrichmentQueue: true, // Flag to indicate this is from enrichment queue
            },
          });

          if (error) throw error;

          if (data?.success && data.email) {
            // Update item with extracted email
            await (supabase as any)
              .from('enrichment_queue')
              .update({
                extracted_email: data.email,
                email_extraction_status: 'extracted',
                email: data.email, // Also update main email field
              })
              .eq('id', item.id);

            results.push({ id: item.id, email: data.email });
          } else {
            // Mark as failed
            await (supabase as any)
              .from('enrichment_queue')
              .update({
                email_extraction_status: 'failed',
                email_extraction_attempts: (item.email_extraction_attempts || 0) + 1,
              })
              .eq('id', item.id);
          }
        } catch (error: any) {
          console.error(`Error extracting email for ${item.name}:`, error);
          await (supabase as any)
            .from('enrichment_queue')
            .update({
              email_extraction_status: 'failed',
              email_extraction_attempts: (item.email_extraction_attempts || 0) + 1,
            })
            .eq('id', item.id);
        }

        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      return { extracted: results.length, total: items.length };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['enrichment-queue'] });
      setSelectedItems(new Set());
      toast({
        title: "Email extraction started",
        description: "Emails are being extracted in the background",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to extract emails",
        variant: "destructive",
      });
    },
  });

  // Move to CRM
  const moveToCRMMutation = useMutation({
    mutationFn: async (itemIds: string[]) => {
      const items = filteredItems.filter(item => itemIds.includes(item.id));
      
      const { data, error } = await supabase.functions.invoke('move-enriched-to-crm', {
        body: {
          itemIds,
        },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['enrichment-queue'] });
      queryClient.invalidateQueries({ queryKey: ['companies'] });
      queryClient.invalidateQueries({ queryKey: ['companies-full'] });
      queryClient.invalidateQueries({ queryKey: ['company-existing-tags'] });
      queryClient.invalidateQueries({ queryKey: ['people'] });
      setSelectedItems(new Set());
      toast({
        title: "Moved to CRM",
        description: `${data?.moved || 0} leads moved to CRM successfully`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to move to CRM",
        variant: "destructive",
      });
    },
  });

  // Delete items
  const deleteMutation = useMutation({
    mutationFn: async (itemIds: string[]) => {
      const { error } = await (supabase as any)
        .from('enrichment_queue')
        .delete()
        .in('id', itemIds);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['enrichment-queue'] });
      setSelectedItems(new Set());
      toast({
        title: "Deleted",
        description: "Items removed from queue",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete",
        variant: "destructive",
      });
    },
  });

  const getStatusBadge = (status: string) => {
    const variants: Record<string, any> = {
      pending: { variant: "secondary" as const, icon: Clock, label: "Pending" },
      enriching: { variant: "default" as const, icon: Loader2, label: "Enriching", className: "animate-spin" },
      enriched: { variant: "default" as const, icon: CheckCircle2, label: "Enriched", className: "bg-green-500" },
      ready_for_crm: { variant: "default" as const, icon: CheckCircle2, label: "Ready for CRM", className: "bg-blue-500" },
      failed: { variant: "destructive" as const, icon: XCircle, label: "Failed" },
      extracting_email: { variant: "default" as const, icon: Loader2, label: "Extracting Email", className: "animate-spin" },
    };

    const config = variants[status] || variants.pending;
    const Icon = config.icon;

    return (
      <Badge variant={config.variant} className={config.className}>
        <Icon className="h-3 w-3 mr-1" />
        {config.label}
      </Badge>
    );
  };

  const pendingCount = filteredItems.filter(i => i.enrichment_status === 'pending').length;
  const enrichedCount = filteredItems.filter(i => i.enrichment_status === 'enriched' || i.enrichment_status === 'ready_for_crm').length;
  const readyForCRMCount = filteredItems.filter(i => i.enrichment_status === 'ready_for_crm').length;

  const canEnrich = selectedItems.size > 0 && Array.from(selectedItems).some(id => {
    const item = filteredItems.find(i => i.id === id);
    return item?.enrichment_status === 'pending' || item?.enrichment_status === 'failed';
  });

  const canExtractEmails = selectedItems.size > 0 && Array.from(selectedItems).some(id => {
    const item = filteredItems.find(i => i.id === id);
    return item?.website && !item.email && (item.email_extraction_status === 'pending' || item.email_extraction_status === 'failed');
  });

  const canMoveToCRM = selectedItems.size > 0 && Array.from(selectedItems).every(id => {
    const item = filteredItems.find(i => i.id === id);
    return item?.enrichment_status === 'enriched' || item?.enrichment_status === 'ready_for_crm';
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Wand2 className="h-8 w-8" />
            Enrichment Queue
          </h1>
          <p className="text-muted-foreground mt-1">
            Enrich leads with Perplexity/Exa and extract emails before moving to CRM
          </p>
        </div>
        {pendingCount > 0 && (
          <Button
            onClick={() => {
              const pendingIds = filteredItems
                .filter(i => i.enrichment_status === 'pending' || i.enrichment_status === 'failed')
                .map(i => i.id);
              enrichMutation.mutate(pendingIds);
            }}
            disabled={enrichMutation.isPending}
            className="bg-primary text-white"
          >
            {enrichMutation.isPending ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Enriching…</>
            ) : (
              <><Zap className="h-4 w-4 mr-2" />Enrich All ({pendingCount})</>
            )}
          </Button>
        )}
        <Button variant="outline" onClick={() => setImportFromCompaniesOpen(true)}>
          <Upload className="h-4 w-4 mr-2" />
          Import from Companies
        </Button>
        <Button variant="outline" onClick={() => setImportFromPeopleOpen(true)}>
          <Upload className="h-4 w-4 mr-2" />
          Import from People
        </Button>
        <Dialog open={addLeadDialogOpen} onOpenChange={setAddLeadDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Wand2 className="h-4 w-4 mr-2" />
              Add Lead
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Lead to Enrichment Queue</DialogTitle>
              <DialogDescription>
                Add a new lead that will be enriched before moving to CRM
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Company Name *</Label>
                <Input
                  id="name"
                  value={newLead.name}
                  onChange={(e) => setNewLead({ ...newLead, name: e.target.value })}
                  placeholder="Acme Inc."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="website">Website</Label>
                <Input
                  id="website"
                  value={newLead.website}
                  onChange={(e) => setNewLead({ ...newLead, website: e.target.value })}
                  placeholder="https://example.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="industry">Industry</Label>
                <Input
                  id="industry"
                  value={newLead.industry}
                  onChange={(e) => setNewLead({ ...newLead, industry: e.target.value })}
                  placeholder="SaaS, Healthcare, etc."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="geography">Geography</Label>
                <Input
                  id="geography"
                  value={newLead.geography}
                  onChange={(e) => setNewLead({ ...newLead, geography: e.target.value })}
                  placeholder="United States, Europe, etc."
                />
              </div>
              <Button
                onClick={() => addLeadMutation.mutate(newLead)}
                disabled={!newLead.name.trim() || addLeadMutation.isPending}
                className="w-full"
              >
                {addLeadMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Adding...
                  </>
                ) : (
                  <>
                    <Wand2 className="h-4 w-4 mr-2" />
                    Add to Queue
                  </>
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Import from Companies dialog */}
        <Dialog open={importFromCompaniesOpen} onOpenChange={setImportFromCompaniesOpen}>
          <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
            <DialogHeader>
              <DialogTitle>Import from Companies</DialogTitle>
              <DialogDescription>
                Add companies from your CRM to the enrichment queue. Optionally run enrichment and email extraction after adding.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 flex-1 min-h-0 flex flex-col">
              <div className="flex items-center gap-2 flex-wrap">
                <Select
                  value={importCompanyFilter}
                  onValueChange={(v: ImportFilter) => {
                    setImportCompanyFilter(v);
                    setImportSelectedIds(new Set());
                  }}
                >
                  <SelectTrigger className="w-56">
                    <SelectValue placeholder="Filter companies" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="missing-email-and-phone">Missing email and phone</SelectItem>
                    <SelectItem value="missing-email">Missing email</SelectItem>
                    <SelectItem value="missing-phone">Missing phone</SelectItem>
                    <SelectItem value="all">All companies</SelectItem>
                  </SelectContent>
                </Select>
                <span className="text-sm text-muted-foreground">
                  {companiesToShowInImport.length} companies
                </span>
                <span className="text-xs text-muted-foreground ml-auto">Green = has data, gray = missing</span>
              </div>
              <ScrollArea className="h-[320px] border rounded-md shrink-0">
                <div className="p-2 space-y-1 min-h-0">
                  {(() => {
                    const visibleIds = companiesToShowInImport.slice(0, 200).map((c) => c.id);
                    const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => importSelectedIds.has(id));
                    return (
                      <>
                        <div
                          className="flex items-center gap-2 rounded p-2 bg-muted/60 hover:bg-muted cursor-pointer sticky top-0 z-10"
                          onClick={() => setImportSelectedIds((prev) => {
                            const next = new Set(prev);
                            if (allVisibleSelected) visibleIds.forEach((id) => next.delete(id));
                            else visibleIds.forEach((id) => next.add(id));
                            return next;
                          })}
                        >
                          <Checkbox
                            checked={allVisibleSelected}
                            onCheckedChange={(checked) => {
                              setImportSelectedIds((prev) => {
                                const next = new Set(prev);
                                if (checked) visibleIds.forEach((id) => next.add(id));
                                else visibleIds.forEach((id) => next.delete(id));
                                return next;
                              });
                            }}
                          />
                          <span className="text-sm font-medium text-muted-foreground">Select all ({companiesToShowInImport.length} companies)</span>
                        </div>
                        {companiesToShowInImport.slice(0, 200).map((c) => {
                          const hasEmail = !!(c.general_email && String(c.general_email).trim());
                          const hasPhone = !!(c.company_phone && String(c.company_phone).trim());
                          return (
                            <div
                              key={c.id}
                              className="flex items-center gap-2 rounded p-2 hover:bg-muted/50 cursor-pointer"
                              onClick={() => setImportSelectedIds(prev => {
                                const next = new Set(prev);
                                if (next.has(c.id)) next.delete(c.id);
                                else next.add(c.id);
                                return next;
                              })}
                            >
                              <Checkbox
                                checked={importSelectedIds.has(c.id)}
                                onCheckedChange={(checked) => {
                                  setImportSelectedIds(prev => {
                                    const next = new Set(prev);
                                    if (checked) next.add(c.id);
                                    else next.delete(c.id);
                                    return next;
                                  });
                                }}
                              />
                              <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                              <span className="font-medium truncate flex-1 min-w-0">{c.name}</span>
                              {c.website && <span className="text-xs text-muted-foreground truncate max-w-[100px] shrink-0">{c.website}</span>}
                              <span className={hasEmail ? "text-green-600 shrink-0" : "text-muted-foreground shrink-0"} title={hasEmail ? "Has email" : "Missing email"}>
                                <Mail className="h-3.5 w-3.5 inline mr-0.5" />
                                <span className="text-[10px] hidden sm:inline">{hasEmail ? "Email" : "No email"}</span>
                              </span>
                              <span className={hasPhone ? "text-green-600 shrink-0" : "text-muted-foreground shrink-0"} title={hasPhone ? "Has phone" : "Missing phone"}>
                                <Phone className="h-3.5 w-3.5 inline mr-0.5" />
                                <span className="text-[10px] hidden sm:inline">{hasPhone ? "Phone" : "No phone"}</span>
                              </span>
                            </div>
                          );
                        })}
                      </>
                    );
                  })()}
                </div>
              </ScrollArea>
              {companiesToShowInImport.length > 200 && (
                <p className="text-xs text-muted-foreground">Showing first 200. Select from list above.</p>
              )}
              <div className="flex items-center gap-2">
                <Checkbox
                  id="import-auto-run"
                  checked={importAutoRun}
                  onCheckedChange={(v) => setImportAutoRun(!!v)}
                />
                <Label htmlFor="import-auto-run" className="text-sm cursor-pointer">
                  Start enrichment after adding
                </Label>
              </div>
              <Button
                className="w-full"
                disabled={importSelectedIds.size === 0 || importFromCompaniesMutation.isPending}
                onClick={() => importFromCompaniesMutation.mutate({
                  companyIds: Array.from(importSelectedIds),
                  autoRun: importAutoRun,
                })}
              >
                {importFromCompaniesMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4 mr-2" />
                )}
                Add {importSelectedIds.size} to queue
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Import from People dialog */}
        <Dialog open={importFromPeopleOpen} onOpenChange={setImportFromPeopleOpen}>
          <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
            <DialogHeader>
              <DialogTitle>Import from People</DialogTitle>
              <DialogDescription>
                Add people (and their companies) from your CRM to the enrichment queue. Optionally run enrichment and email extraction after adding.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 flex-1 min-h-0 flex flex-col">
              <div className="flex items-center gap-2 flex-wrap">
                <Select
                  value={importPeopleFilter}
                  onValueChange={(v: ImportFilter) => {
                    setImportPeopleFilter(v);
                    setImportPeopleSelectedIds(new Set());
                  }}
                >
                  <SelectTrigger className="w-56">
                    <SelectValue placeholder="Filter people" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="missing-email-and-phone">Missing email and phone</SelectItem>
                    <SelectItem value="missing-email">Missing email</SelectItem>
                    <SelectItem value="missing-phone">Missing phone</SelectItem>
                    <SelectItem value="all">All people</SelectItem>
                  </SelectContent>
                </Select>
                <span className="text-sm text-muted-foreground">
                  {peopleToShowInImport.length} people
                </span>
                <span className="text-xs text-muted-foreground ml-auto">Green = has data, gray = missing</span>
              </div>
              <ScrollArea className="h-[320px] border rounded-md shrink-0">
                <div className="p-2 space-y-1 min-h-0">
                  {(() => {
                    const visiblePeopleIds = peopleToShowInImport.slice(0, 200).map((p) => p.id);
                    const allPeopleSelected = visiblePeopleIds.length > 0 && visiblePeopleIds.every((id) => importPeopleSelectedIds.has(id));
                    return (
                      <>
                        <div
                          className="flex items-center gap-2 rounded p-2 bg-muted/60 hover:bg-muted cursor-pointer sticky top-0 z-10"
                          onClick={() => setImportPeopleSelectedIds((prev) => {
                            const next = new Set(prev);
                            if (allPeopleSelected) visiblePeopleIds.forEach((id) => next.delete(id));
                            else visiblePeopleIds.forEach((id) => next.add(id));
                            return next;
                          })}
                        >
                          <Checkbox
                            checked={allPeopleSelected}
                            onCheckedChange={(checked) => {
                              setImportPeopleSelectedIds((prev) => {
                                const next = new Set(prev);
                                if (checked) visiblePeopleIds.forEach((id) => next.add(id));
                                else visiblePeopleIds.forEach((id) => next.delete(id));
                                return next;
                              });
                            }}
                          />
                          <span className="text-sm font-medium text-muted-foreground">Select all ({peopleToShowInImport.length} people)</span>
                        </div>
                        {peopleToShowInImport.slice(0, 200).map((p) => {
                          const displayName = [p.first_name, p.last_name].filter(Boolean).join(' ') || p.companies?.name || 'Unknown';
                          const hasEmail = !!(p.email && String(p.email).trim());
                          const hasPhone = !!(p.phone && String(p.phone).trim());
                          return (
                            <div
                              key={p.id}
                              className="flex items-center gap-2 rounded p-2 hover:bg-muted/50 cursor-pointer"
                              onClick={() => setImportPeopleSelectedIds(prev => {
                                const next = new Set(prev);
                                if (next.has(p.id)) next.delete(p.id);
                                else next.add(p.id);
                                return next;
                              })}
                            >
                              <Checkbox
                                checked={importPeopleSelectedIds.has(p.id)}
                                onCheckedChange={(checked) => {
                                  setImportPeopleSelectedIds(prev => {
                                    const next = new Set(prev);
                                    if (checked) next.add(p.id);
                                    else next.delete(p.id);
                                    return next;
                                  });
                                }}
                              />
                              <Users className="h-4 w-4 text-muted-foreground shrink-0" />
                              <span className="font-medium truncate flex-1 min-w-0">{displayName}</span>
                              {p.companies?.name && (
                                <span className="text-xs text-muted-foreground truncate max-w-[100px] shrink-0">{p.companies.name}</span>
                              )}
                              <span className={hasEmail ? "text-green-600 shrink-0" : "text-muted-foreground shrink-0"} title={hasEmail ? "Has email" : "Missing email"}>
                                <Mail className="h-3.5 w-3.5 inline mr-0.5" />
                                <span className="text-[10px] hidden sm:inline">{hasEmail ? "Email" : "No email"}</span>
                              </span>
                              <span className={hasPhone ? "text-green-600 shrink-0" : "text-muted-foreground shrink-0"} title={hasPhone ? "Has phone" : "Missing phone"}>
                                <Phone className="h-3.5 w-3.5 inline mr-0.5" />
                                <span className="text-[10px] hidden sm:inline">{hasPhone ? "Phone" : "No phone"}</span>
                              </span>
                            </div>
                          );
                        })}
                      </>
                    );
                  })()}
                </div>
              </ScrollArea>
              {peopleToShowInImport.length > 200 && (
                <p className="text-xs text-muted-foreground">Showing first 200. Select from list above.</p>
              )}
              <div className="flex items-center gap-2">
                <Checkbox
                  id="import-people-auto-run"
                  checked={importAutoRun}
                  onCheckedChange={(v) => setImportAutoRun(!!v)}
                />
                <Label htmlFor="import-people-auto-run" className="text-sm cursor-pointer">
                  Start enrichment after adding
                </Label>
              </div>
              <Button
                className="w-full"
                disabled={importPeopleSelectedIds.size === 0 || importFromPeopleMutation.isPending}
                onClick={() => importFromPeopleMutation.mutate({
                  personIds: Array.from(importPeopleSelectedIds),
                  autoRun: importAutoRun,
                })}
              >
                {importFromPeopleMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4 mr-2" />
                )}
                Add {importPeopleSelectedIds.size} to queue
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Leads</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{filteredItems.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{pendingCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Enriched</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{enrichedCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Ready for CRM</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{readyForCRMCount}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Actions */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Enrichment Queue</CardTitle>
            <div className="flex items-center gap-2">
              <Input
                placeholder="Search leads..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-64"
              />
              <Select value={statusFilter} onValueChange={(v: any) => setStatusFilter(v)}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="enriching">Enriching</SelectItem>
                  <SelectItem value="enriched">Enriched</SelectItem>
                  <SelectItem value="ready_for_crm">Ready for CRM</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {selectedItems.size > 0 && (
            <div className="mb-4 p-3 bg-muted rounded-lg flex items-center justify-between">
              <span className="text-sm font-medium">
                {selectedItems.size} item{selectedItems.size > 1 ? 's' : ''} selected
              </span>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => enrichMutation.mutate(Array.from(selectedItems))}
                  disabled={!canEnrich || enrichMutation.isPending}
                >
                  <Sparkles className="h-4 w-4 mr-2" />
                  Enrich
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => extractEmailsMutation.mutate(Array.from(selectedItems))}
                  disabled={!canExtractEmails || extractEmailsMutation.isPending}
                >
                  <Mail className="h-4 w-4 mr-2" />
                  Extract Emails
                </Button>
                <Button
                  size="sm"
                  variant="default"
                  onClick={() => moveToCRMMutation.mutate(Array.from(selectedItems))}
                  disabled={!canMoveToCRM || moveToCRMMutation.isPending}
                >
                  <ArrowRight className="h-4 w-4 mr-2" />
                  Move to CRM
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => deleteMutation.mutate(Array.from(selectedItems))}
                  disabled={deleteMutation.isPending}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </Button>
              </div>
            </div>
          )}

          {isLoading ? (
            <div className="text-center py-12">
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
              <p className="text-muted-foreground">Loading enrichment queue...</p>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="text-center py-12">
              <Wand2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No leads in enrichment queue</p>
              <Button
                className="mt-4"
                onClick={() => setAddLeadDialogOpen(true)}
              >
                Add First Lead
              </Button>
            </div>
          ) : (
            <ScrollArea className="h-[600px]">
              <div className="space-y-3">
                {filteredItems.map((item) => (
                  <Card
                    key={item.id}
                    className={`cursor-pointer transition-colors ${
                      selectedItems.has(item.id) ? 'border-primary bg-primary/5' : ''
                    }`}
                    onClick={() => {
                      const newSelected = new Set(selectedItems);
                      if (newSelected.has(item.id)) {
                        newSelected.delete(item.id);
                      } else {
                        newSelected.add(item.id);
                      }
                      setSelectedItems(newSelected);
                    }}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-3">
                            <Checkbox
                              checked={selectedItems.has(item.id)}
                              onCheckedChange={(checked) => {
                                const newSelected = new Set(selectedItems);
                                if (checked) {
                                  newSelected.add(item.id);
                                } else {
                                  newSelected.delete(item.id);
                                }
                                setSelectedItems(newSelected);
                              }}
                              onClick={(e) => e.stopPropagation()}
                            />
                            <h3 className="font-semibold text-lg">{item.name}</h3>
                            {getStatusBadge(item.enrichment_status)}
                            {item.email_extraction_status === 'extracted' && item.extracted_email && (
                              <Badge variant="outline" className="bg-green-50">
                                <Mail className="h-3 w-3 mr-1" />
                                Email Found
                              </Badge>
                            )}
                          </div>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-muted-foreground">
                            {item.website && (
                              <div className="flex items-center gap-2">
                                <Globe className="h-4 w-4" />
                                <a href={item.website} target="_blank" rel="noopener noreferrer" className="hover:underline" onClick={(e) => e.stopPropagation()}>
                                  {item.website}
                                </a>
                              </div>
                            )}
                            {item.email && (
                              <div className="flex items-center gap-2">
                                <Mail className="h-4 w-4" />
                                {item.email}
                              </div>
                            )}
                            {item.extracted_email && (
                              <div className="flex items-center gap-2">
                                <Mail className="h-4 w-4 text-green-600" />
                                {item.extracted_email}
                              </div>
                            )}
                            {item.industry && (
                              <div className="flex items-center gap-2">
                                <Building2 className="h-4 w-4" />
                                {item.industry}
                              </div>
                            )}
                          </div>
                          {item.description && (
                            <p className="text-sm text-muted-foreground line-clamp-2">{item.description}</p>
                          )}
                          {item.enrichment_errors && item.enrichment_errors.length > 0 && (
                            <Alert variant="destructive">
                              <AlertCircle className="h-4 w-4" />
                              <AlertDescription>
                                {item.enrichment_errors.join(', ')}
                              </AlertDescription>
                            </Alert>
                          )}
                          <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            <span>Added: {format(new Date(item.created_at), 'MMM d, yyyy')}</span>
                            {item.enriched_at && (
                              <span>Enriched: {format(new Date(item.enriched_at), 'MMM d, yyyy')}</span>
                            )}
                            <span>Source: {item.source}</span>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
