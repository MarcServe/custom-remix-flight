import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { TagInput } from "@/components/ui/tag-input";
import { useToast } from "@/hooks/use-toast";
import {
  Target,
  Loader2,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Building2,
  TrendingUp,
  Users,
  Mail,
  Upload,
  FileText,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { DialogFooter } from "@/components/ui/dialog";

interface CampaignFitResult {
  companyId: string;
  companyName: string;
  fitScore: number;
  fitReason: string;
  recommendedApproach: string;
  priority: 'high' | 'medium' | 'low';
}

interface AnalysisResponse {
  success: boolean;
  results: CampaignFitResult[];
  summary: {
    totalAnalyzed: number;
    highFit: number;
    mediumFit: number;
    lowFit: number;
    avgFitScore: number;
    hasContacts: number;
  };
  aiInsights: string;
}

export function CampaignFitAnalyzer({ onOpenBulkEmail }: { onOpenBulkEmail?: (companyIds: string[]) => void } = {}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<AnalysisResponse | null>(null);
  const [selectedCompanyIds, setSelectedCompanyIds] = useState<Set<string>>(new Set());
  const [saveToNotesOpen, setSaveToNotesOpen] = useState(false);
  const [saveToNotesTitle, setSaveToNotesTitle] = useState("");
  const [saveToNotesContent, setSaveToNotesContent] = useState("");
  const [showOnlyAligned, setShowOnlyAligned] = useState(true);

  const [categoryOrCampaign, setCategoryOrCampaign] = useState("");
  const [campaignType, setCampaignType] = useState("");
  const [targetIndustries, setTargetIndustries] = useState<string[]>([]);
  const [targetSizes, setTargetSizes] = useState<string[]>([]);
  const [targetGeographies, setTargetGeographies] = useState<string[]>([]);
  const [productFocus, setProductFocus] = useState("");
  const [idealCustomerProfile, setIdealCustomerProfile] = useState("");

  const analysisMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('analyze-campaign-fit', {
        body: {
          categoryOrCampaign: categoryOrCampaign.trim() || undefined,
          campaignType,
          targetIndustries,
          targetSizes,
          targetGeographies,
          productFocus,
          idealCustomerProfile,
        },
      });
      if (error) throw error;
      return data as AnalysisResponse;
    },
    onSuccess: (data) => {
      setResults(data);
      toast({
        title: "Analysis Complete",
        description: `Analyzed ${data.summary.totalAnalyzed} companies, found ${data.summary.highFit} high-fit prospects.`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Analysis Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleAnalyze = () => {
    const hasCategory = categoryOrCampaign.trim().length > 0;
    const hasLegacy = campaignType.trim() && productFocus.trim();
    if (!hasCategory && !hasLegacy) {
      toast({
        title: "Missing Information",
        description: "Enter your target category in plain English (e.g. Mental Health and Learning Disability), or fill in Campaign Type and Product Focus.",
        variant: "destructive",
      });
      return;
    }
    analysisMutation.mutate();
  };

  const resetForm = () => {
    setResults(null);
    setSelectedCompanyIds(new Set());
    setCategoryOrCampaign("");
    setCampaignType("");
    setTargetIndustries([]);
    setTargetSizes([]);
    setTargetGeographies([]);
    setProductFocus("");
    setIdealCustomerProfile("");
  };

  const hasNoEmail = (result: CampaignFitResult) =>
    result.fitReason.includes("No email contact");

  const noEmailResults = results?.results.filter(hasNoEmail) ?? [];
  const selectedNoEmail = results?.results.filter(
    (r) => selectedCompanyIds.has(r.companyId) && hasNoEmail(r)
  ) ?? [];
  const alignedResults = results?.results.filter((r) => r.priority === 'high' || r.priority === 'medium') ?? [];
  const displayResults = results && showOnlyAligned ? alignedResults : (results?.results ?? []);

  const sendToEnrichmentMutation = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const ids = selectedNoEmail.map((r) => r.companyId);
      if (ids.length === 0) throw new Error("No companies without email selected");
      const { data: companies, error: fetchErr } = await supabase
        .from("companies")
        .select("id, name, website, industry, geography, general_email, company_phone")
        .in("id", ids);
      if (fetchErr) throw fetchErr;
      const toInsert = (companies || []).filter(
        (c) => !(c.general_email && String(c.general_email).trim())
      );
      if (toInsert.length === 0) {
        toast({ title: "No missing emails", description: "Selected companies already have emails.", variant: "destructive" });
        return { count: 0 };
      }
      const inserts = toInsert.map((c) => ({
        user_id: user.id,
        name: c.name,
        website: c.website || null,
        industry: c.industry || null,
        geography: c.geography || null,
        email: c.general_email || null,
        phone: c.company_phone || null,
        source: "import",
        source_metadata: { from: "campaign_fit_analyzer", company_id: c.id },
        enrichment_status: "pending",
        email_extraction_status: c.website ? "pending" : "not_needed",
      }));
      const { error } = await (supabase as any).from("enrichment_queue").insert(inserts);
      if (error) throw error;
      return { count: inserts.length };
    },
    onSuccess: (data) => {
      if (data.count > 0) {
        queryClient.invalidateQueries({ queryKey: ["enrichment-queue"] });
        toast({ title: "Sent to Enrichment", description: `${data.count} companies added to Enrichment Queue. Run enrichment on the Enrichment page.` });
      }
    },
    onError: (e: any) => {
      const msg = e?.message || "";
      const hint = msg.includes("enrichment_queue") || msg.includes("schema cache")
        ? " Run the migration that creates the enrichment_queue table (e.g. supabase db push) and ensure the Enrichment page loads."
        : "";
      toast({ title: "Error", description: msg + hint, variant: "destructive" });
    },
  });

  const handleBulkEmail = () => {
    const ids = Array.from(selectedCompanyIds);
    if (ids.length === 0) {
      toast({ title: "No selection", description: "Select at least one company.", variant: "destructive" });
      return;
    }
    onOpenBulkEmail?.(ids);
  };

  const openSaveToNotes = () => {
    if (!results) return;
    const dateStr = new Date().toISOString().slice(0, 10);
    setSaveToNotesTitle(`Campaign Fit Analysis ${dateStr}`);
    const lines = [
      `Campaign Fit Analysis – ${dateStr}`,
      `Summary: ${results.summary.totalAnalyzed} analyzed, ${results.summary.highFit} high fit, ${results.summary.mediumFit} medium fit, ${results.summary.avgFitScore} avg score.`,
      results.aiInsights ? `\nAI Strategy:\n${results.aiInsights}` : "",
      "\nCompany rankings:",
      ...results.results.map((r, i) => `${i + 1}. ${r.companyName} – ${r.priority.toUpperCase()} (${r.fitScore}) – ${r.fitReason}`),
    ];
    setSaveToNotesContent(lines.filter(Boolean).join("\n"));
    setSaveToNotesOpen(true);
  };

  const saveToNotesMutation = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const { error } = await (supabase as any)
        .from("crm_notes")
        .insert({
          user_id: user.id,
          title: saveToNotesTitle.trim() || "Campaign Fit Analysis",
          content: saveToNotesContent.trim() || "",
          source: "campaign_fit_analyzer",
          source_metadata: { summary: results?.summary },
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crm-notes"] });
      setSaveToNotesOpen(false);
      toast({ title: "Saved to Notes", description: "Find it under Outreach → Notes. Use it when creating campaigns." });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-green-500/10 text-green-600 border-green-200';
      case 'medium': return 'bg-yellow-500/10 text-yellow-600 border-yellow-200';
      case 'low': return 'bg-gray-500/10 text-gray-600 border-gray-200';
      default: return '';
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) resetForm(); }}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Target className="h-4 w-4" />
          Campaign Fit Analysis
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Campaign Fit Analyzer
          </DialogTitle>
          <DialogDescription>
            Type your target category in plain English. Only companies that match this category will appear as high or medium fit.
          </DialogDescription>
        </DialogHeader>

        {!results ? (
          <>
            <ScrollArea className="flex-1 pr-4 min-h-0">
              <div className="space-y-6 py-4">
                {/* Primary: Category in plain English */}
                <div className="space-y-2">
                  <Label htmlFor="categoryOrCampaign">Target category or campaign (plain English) *</Label>
                  <Input
                    id="categoryOrCampaign"
                    placeholder="e.g. Mental Health and Learning Disability, B2B SaaS, Sustainable Packaging, Care Homes"
                    value={categoryOrCampaign}
                    onChange={(e) => setCategoryOrCampaign(e.target.value)}
                    className="font-medium"
                  />
                  <p className="text-xs text-muted-foreground">
                    AI will analyse your companies and show only those aligned to this category. Unrelated companies (e.g. retail when you want care sector) will be scored low.
                  </p>
                </div>

                {/* Optional refinement */}
                <div className="space-y-4">
                  <h3 className="font-medium flex items-center gap-2 text-muted-foreground">
                    <Sparkles className="h-4 w-4" />
                    Optional: refine with campaign details
                  </h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="campaignType">Campaign type</Label>
                      <Input
                        id="campaignType"
                        placeholder="e.g. Product Launch, Demo Outreach"
                        value={campaignType}
                        onChange={(e) => setCampaignType(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="productFocus">Product / service focus</Label>
                      <Input
                        id="productFocus"
                        placeholder="e.g. CRM Software, Care Management"
                        value={productFocus}
                        onChange={(e) => setProductFocus(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="icp">Ideal customer profile</Label>
                    <Textarea
                      id="icp"
                      placeholder="e.g. Mid-market care providers with 50–500 employees"
                      value={idealCustomerProfile}
                      onChange={(e) => setIdealCustomerProfile(e.target.value)}
                      className="min-h-[80px]"
                    />
                  </div>
                </div>

                <Separator />

                {/* Targeting Criteria */}
                <div className="space-y-4">
                  <h3 className="font-medium flex items-center gap-2">
                    <Users className="h-4 w-4 text-primary" />
                    Targeting Criteria
                  </h3>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Target Industries</Label>
                      <TagInput
                        tags={targetIndustries}
                        onTagsChange={setTargetIndustries}
                        placeholder="Add industries (e.g., Technology, Healthcare, Finance)"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Target Company Sizes</Label>
                      <TagInput
                        tags={targetSizes}
                        onTagsChange={setTargetSizes}
                        placeholder="Add sizes (e.g., 50-200, Enterprise, SMB)"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Target Geographies</Label>
                      <TagInput
                        tags={targetGeographies}
                        onTagsChange={setTargetGeographies}
                        placeholder="Add locations (e.g., United States, Europe, APAC)"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </ScrollArea>
            
            {/* Fixed Footer with Action Buttons */}
            <div className="shrink-0 border-t pt-4 mt-4 flex gap-2">
              <Button 
                variant="outline"
                onClick={() => setOpen(false)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button 
                onClick={handleAnalyze} 
                disabled={analysisMutation.isPending || (!categoryOrCampaign.trim() && (!campaignType.trim() || !productFocus.trim()))}
                className="flex-1"
              >
                {analysisMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Analyze My Companies
                  </>
                )}
              </Button>
            </div>
          </>
        ) : (
          <>
            <ScrollArea className="flex-1 pr-4 min-h-0">
              <div className="space-y-6 py-4">
                {/* Summary Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Card>
                    <CardContent className="pt-4 text-center">
                      <div className="text-2xl font-bold text-primary">{results.summary.totalAnalyzed}</div>
                      <div className="text-xs text-muted-foreground">Analyzed</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4 text-center">
                      <div className="text-2xl font-bold text-green-600">{results.summary.highFit}</div>
                      <div className="text-xs text-muted-foreground">High Fit</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4 text-center">
                      <div className="text-2xl font-bold text-yellow-600">{results.summary.mediumFit}</div>
                      <div className="text-xs text-muted-foreground">Medium Fit</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4 text-center">
                      <div className="text-2xl font-bold">{results.summary.avgFitScore}</div>
                      <div className="text-xs text-muted-foreground">Avg Score</div>
                    </CardContent>
                  </Card>
                </div>

                {/* AI Insights */}
                {results.aiInsights && (
                  <Card className="border-primary/20 bg-primary/5">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Sparkles className="h-4 w-4" />
                        AI Campaign Strategy
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm whitespace-pre-line">{results.aiInsights}</p>
                    </CardContent>
                  </Card>
                )}

                <Separator />

                {/* Results List */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <h3 className="font-medium">Company Rankings</h3>
                    <div className="flex items-center gap-3 flex-wrap">
                      <label className="flex items-center gap-2 text-sm cursor-pointer">
                        <Checkbox
                          checked={showOnlyAligned}
                          onCheckedChange={(c) => setShowOnlyAligned(!!c)}
                        />
                        <span>Show only aligned (high + medium)</span>
                      </label>
                      <span className="text-sm text-muted-foreground">
                        {results.summary.hasContacts} with email · {noEmailResults.length} without email
                      </span>
                    </div>
                  </div>
                  {showOnlyAligned && alignedResults.length === 0 && (
                    <p className="text-sm text-muted-foreground rounded-lg border bg-muted/30 p-3">
                      No companies in your list match this category. Try a different category or add more companies.
                    </p>
                  )}

                  {/* Select all / Select no-email only */}
                  <div className="flex items-center gap-3 rounded-lg border bg-muted/50 p-2 flex-wrap">
                    <Checkbox
                      checked={displayResults.length > 0 && displayResults.every((r) => selectedCompanyIds.has(r.companyId))}
                      onCheckedChange={(checked) => {
                        setSelectedCompanyIds((prev) => {
                          const next = new Set(prev);
                          if (checked) displayResults.forEach((r) => next.add(r.companyId));
                          else displayResults.forEach((r) => next.delete(r.companyId));
                          return next;
                        });
                      }}
                    />
                    <span className="text-sm font-medium">Select all visible ({displayResults.length})</span>
                    <Checkbox
                      checked={noEmailResults.length > 0 && noEmailResults.every((r) => selectedCompanyIds.has(r.companyId))}
                      onCheckedChange={(checked) => {
                        setSelectedCompanyIds((prev) => {
                          const next = new Set(prev);
                          if (checked) noEmailResults.forEach((r) => next.add(r.companyId));
                          else noEmailResults.forEach((r) => next.delete(r.companyId));
                          return next;
                        });
                      }}
                    />
                    <span className="text-sm font-medium">Select no-email only ({noEmailResults.length})</span>
                    {selectedCompanyIds.size > 0 && (
                      <span className="text-xs text-muted-foreground ml-auto">{selectedCompanyIds.size} selected</span>
                    )}
                  </div>

                  <ScrollArea className="h-[280px] border rounded-md">
                    <div className="p-2 space-y-2">
                      {displayResults.map((result, index) => (
                        <Card key={result.companyId} className={index < 3 ? "border-primary/30" : ""}>
                          <CardContent className="py-3">
                            <div className="flex items-start gap-3">
                              <Checkbox
                                checked={selectedCompanyIds.has(result.companyId)}
                                onCheckedChange={(checked) => {
                                  setSelectedCompanyIds((prev) => {
                                    const next = new Set(prev);
                                    if (checked) next.add(result.companyId);
                                    else next.delete(result.companyId);
                                    return next;
                                  });
                                }}
                              />
                              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-muted text-sm font-medium shrink-0">
                                {index + 1}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-medium">{result.companyName}</span>
                                  <Badge variant="outline" className={getPriorityColor(result.priority)}>
                                    {result.priority.toUpperCase()}
                                  </Badge>
                                  <span className="text-sm text-muted-foreground">
                                    Score: {result.fitScore}
                                  </span>
                                  {hasNoEmail(result) && (
                                    <span className="text-xs text-amber-600">No email</span>
                                  )}
                                </div>
                                <p className="text-sm text-muted-foreground mt-1">
                                  {result.fitReason}
                                </p>
                                <div className="flex items-center gap-1 mt-2 text-xs text-primary">
                                  <ArrowRight className="h-3 w-3" />
                                  {result.recommendedApproach}
                                </div>
                              </div>
                              <Progress value={result.fitScore} className="w-16 h-2 shrink-0" />
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              </div>
            </ScrollArea>
            
            {/* Fixed Footer with Action Buttons */}
            <div className="shrink-0 border-t pt-4 mt-4 flex flex-wrap gap-2">
              <Button variant="outline" onClick={resetForm} className="flex-1 min-w-[120px]">
                New Analysis
              </Button>
              <Button
                variant="outline"
                onClick={() => sendToEnrichmentMutation.mutate()}
                disabled={selectedNoEmail.length === 0 || sendToEnrichmentMutation.isPending}
                className="flex-1 min-w-[120px]"
                title="Add selected companies without email to Enrichment Queue for email extraction"
              >
                {sendToEnrichmentMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4 mr-2" />
                )}
                Send to Enrichment ({selectedNoEmail.length})
              </Button>
              {onOpenBulkEmail && (
                <>
                  <Button
                    variant="default"
                    onClick={() => onOpenBulkEmail(alignedResults.map((r) => r.companyId))}
                    disabled={alignedResults.length === 0}
                    className="flex-1 min-w-[140px]"
                    title="Compose bulk email for all high- and medium-fit companies. Use filters in the dialog to exclude previous campaigns and avoid duplicates."
                  >
                    <Mail className="h-4 w-4 mr-2" />
                    Bulk email all aligned ({alignedResults.length})
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleBulkEmail}
                    disabled={selectedCompanyIds.size === 0}
                    className="flex-1 min-w-[120px]"
                    title="Compose bulk email for selected companies only. Use filters in the dialog to exclude previous campaigns and avoid duplicates."
                  >
                    <Mail className="h-4 w-4 mr-2" />
                    Bulk email selected ({selectedCompanyIds.size})
                  </Button>
                </>
              )}
              <Button
                onClick={() => {
                  const highFit = results.results
                    .filter((r) => r.priority === "high")
                    .map((r) => r.companyName)
                    .join("\n");
                  navigator.clipboard.writeText(highFit);
                  toast({ title: "Copied!", description: "High-fit company names copied to clipboard" });
                }}
                variant="outline"
                className="flex-1 min-w-[120px]"
              >
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Copy High-Fit List
              </Button>
              <Button
                onClick={openSaveToNotes}
                variant="outline"
                className="flex-1 min-w-[120px]"
                title="Save analysis to CRM Notes for use in campaigns"
              >
                <FileText className="h-4 w-4 mr-2" />
                Save to Notes
              </Button>
              <Button onClick={() => setOpen(false)} className="flex-1 min-w-[120px]">
                Close
              </Button>
            </div>
          </>
        )}
      </DialogContent>

      {/* Save to Notes dialog */}
      <Dialog open={saveToNotesOpen} onOpenChange={setSaveToNotesOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Save to Notes</DialogTitle>
            <DialogDescription>Save this analysis to CRM Notes. You can use it later when creating campaigns (e.g. paste company list).</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="save-notes-title">Title</Label>
              <Input
                id="save-notes-title"
                value={saveToNotesTitle}
                onChange={(e) => setSaveToNotesTitle(e.target.value)}
                placeholder="e.g. Campaign Fit - High fit list"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="save-notes-content">Content</Label>
              <Textarea
                id="save-notes-content"
                value={saveToNotesContent}
                onChange={(e) => setSaveToNotesContent(e.target.value)}
                className="min-h-[200px] resize-y font-mono text-sm"
                placeholder="Analysis summary and company list..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveToNotesOpen(false)}>Cancel</Button>
            <Button onClick={() => saveToNotesMutation.mutate()} disabled={saveToNotesMutation.isPending}>
              {saveToNotesMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Save to Notes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}