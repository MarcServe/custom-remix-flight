import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Sparkles, Loader2, Building2, ExternalLink, Search, Database, Zap, Globe, Mail } from "lucide-react";
import { useLeadFinder } from "@/hooks/use-lead-finder";
import { useProviderStore } from "@/stores/provider-store";
import { useUIStore } from "@/stores/ui-store";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { CompanyDetailsDialog } from "@/components/CompanyDetailsDialog";

export default function LeadFinder() {
  const [size, setSize] = useState("");
  const [geography, setGeography] = useState("");
  const [industry, setIndustry] = useState("");
  const [dryRun, setDryRun] = useState(true);
  const [enrichWithPerplexity, setEnrichWithPerplexity] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState<any>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  
  const { defaultProvider, defaultModels } = useProviderStore();
  const [providerConfig, setProviderConfig] = useState({
    provider: defaultProvider,
    model: defaultModels[defaultProvider] as string | undefined,
  });

  // Sync provider config with store changes
  useEffect(() => {
    setProviderConfig({
      provider: defaultProvider,
      model: defaultModels[defaultProvider] as string | undefined,
    });
  }, [defaultProvider, defaultModels]);

  const { leadFinderResults, setLeadFinderResults } = useUIStore();
  const leadFinderMutation = useLeadFinder();

  const handleSearch = async () => {
    const { data } = await leadFinderMutation.mutateAsync({
      size,
      geography,
      industry,
      dryRun,
      provider: providerConfig.provider,
      model: providerConfig.model,
      enrichWithPerplexity,
    });

    if (data) {
      setLeadFinderResults(data.leads);
    }
  };

  const isFormValid = size && geography && industry;
  const isLoading = leadFinderMutation.isPending;
  const results = leadFinderMutation.data?.data;

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Top Bar */}
      <div className="border-b bg-card/50 backdrop-blur supports-[backdrop-filter]:bg-card/50">
        <div className="flex items-center justify-between h-14 px-6">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10">
              <Search className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h1 className="text-sm font-semibold tracking-tight">AI Lead Finder</h1>
              <p className="text-xs text-muted-foreground">Intelligent company discovery</p>
            </div>
          </div>
          
          {results && (
            <div className="flex items-center gap-4 text-xs">
              <div className="flex items-center gap-2">
                <Database className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="font-mono">{results.leads.length}</span>
                <span className="text-muted-foreground">companies</span>
              </div>
              <Separator orientation="vertical" className="h-4" />
              <div className="flex items-center gap-2">
                <Zap className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="font-mono">${(results.usage.estimatedCost + (results.enrichmentUsage?.estimatedCost || 0)).toFixed(4)}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Search Config */}
        <div className="w-80 border-r bg-card/30 backdrop-blur supports-[backdrop-filter]:bg-card/30 flex flex-col">
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Search Parameters */}
            <div className="space-y-4">
              <div>
                <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                  Search Parameters
                </h2>
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="size" className="text-xs font-medium">Company Size</Label>
                    <Select value={size} onValueChange={setSize}>
                      <SelectTrigger id="size" className="h-9 text-xs">
                        <SelectValue placeholder="Select size" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1-10">1-10 employees</SelectItem>
                        <SelectItem value="11-50">11-50 employees</SelectItem>
                        <SelectItem value="51-200">51-200 employees</SelectItem>
                        <SelectItem value="201-500">201-500 employees</SelectItem>
                        <SelectItem value="500+">500+ employees</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="geography" className="text-xs font-medium">Geography</Label>
                    <Input
                      id="geography"
                      placeholder="e.g., United Kingdom"
                      value={geography}
                      onChange={(e) => setGeography(e.target.value)}
                      className="h-9 text-xs"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="industry" className="text-xs font-medium">Industry</Label>
                    <Input
                      id="industry"
                      placeholder="e.g., Fintech, SaaS"
                      value={industry}
                      onChange={(e) => setIndustry(e.target.value)}
                      className="h-9 text-xs"
                    />
                  </div>
                </div>
              </div>

              <Separator />

              {/* AI Provider */}
              <div className="space-y-3">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  AI Configuration
                </h2>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Provider</Label>
                  <Select 
                    value={providerConfig.provider} 
                    onValueChange={(value: any) => setProviderConfig({
                      provider: value,
                      model: value === 'lovable' ? 'google/gemini-2.5-flash' : 
                             value === 'perplexity' ? 'sonar' : 
                             'gpt-4o-mini'
                    })}
                  >
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="lovable">Lovable AI</SelectItem>
                      <SelectItem value="openai">OpenAI</SelectItem>
                      <SelectItem value="perplexity">Perplexity</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Model</Label>
                  <Select 
                    value={providerConfig.model} 
                    onValueChange={(model) => setProviderConfig({ ...providerConfig, model })}
                  >
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {providerConfig.provider === 'lovable' && (
                        <>
                          <SelectItem value="google/gemini-2.5-flash">Gemini 2.5 Flash</SelectItem>
                          <SelectItem value="google/gemini-2.5-pro">Gemini 2.5 Pro</SelectItem>
                          <SelectItem value="google/gemini-2.5-flash-lite">Gemini Flash Lite</SelectItem>
                        </>
                      )}
                      {providerConfig.provider === 'openai' && (
                        <>
                          <SelectItem value="gpt-4o-mini">GPT-4o Mini</SelectItem>
                          <SelectItem value="gpt-4o">GPT-4o</SelectItem>
                        </>
                      )}
                      {providerConfig.provider === 'perplexity' && (
                        <>
                          <SelectItem value="sonar">Sonar</SelectItem>
                          <SelectItem value="sonar-pro">Sonar Pro</SelectItem>
                        </>
                      )}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Separator />

              {/* Options */}
              <div className="space-y-3">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Options
                </h2>
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="dryRun"
                      checked={dryRun}
                      onCheckedChange={(checked) => setDryRun(checked as boolean)}
                    />
                    <Label htmlFor="dryRun" className="text-xs font-normal cursor-pointer">
                      Preview only (no CRM insert)
                    </Label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="enrichWithPerplexity"
                      checked={enrichWithPerplexity}
                      onCheckedChange={(checked) => setEnrichWithPerplexity(checked as boolean)}
                    />
                    <Label htmlFor="enrichWithPerplexity" className="text-xs font-normal cursor-pointer flex items-center gap-1">
                      <Sparkles className="h-3 w-3 text-primary" />
                      Enrich with Perplexity
                    </Label>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Action Button */}
          <div className="p-6 border-t bg-card/50">
            <Button
              onClick={handleSearch}
              disabled={!isFormValid || isLoading}
              className="w-full h-10"
              size="default"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  <span className="text-xs font-medium">Searching...</span>
                </>
              ) : (
                <>
                  <Search className="mr-2 h-4 w-4" />
                  <span className="text-xs font-medium">Find Companies</span>
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Right Panel - Results */}
        <div className="flex-1 overflow-y-auto">
          {!results ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-center space-y-3 max-w-md">
                <div className="mx-auto w-16 h-16 rounded-2xl bg-primary/5 flex items-center justify-center">
                  <Search className="h-8 w-8 text-primary/40" />
                </div>
                <div>
                  <h3 className="text-sm font-medium text-foreground mb-1">No search results yet</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Configure your search parameters and click "Find Companies" to discover leads
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-6 space-y-4">
              {/* Results Header */}
              <div className="flex items-center justify-between pb-3 border-b">
                <div className="flex items-center gap-3">
                  <h2 className="text-sm font-semibold">Search Results</h2>
                  {results.wasEnriched && (
                    <Badge variant="default" className="h-5 text-xs bg-gradient-primary">
                      <Sparkles className="h-3 w-3 mr-1" />
                      Enriched
                    </Badge>
                  )}
                </div>
                <div className="text-xs text-muted-foreground">
                  {dryRun ? "Preview mode" : `${results.inserted} added to CRM`}
                </div>
              </div>

              {/* Company List */}
              <div className="space-y-3">
                {results.leads.map((company: any, idx: number) => (
                  <div
                    key={idx}
                    className="group relative rounded-lg border bg-card hover:shadow-md hover:border-primary/50 transition-all p-4 cursor-pointer"
                    onClick={() => {
                      setSelectedCompany(company);
                      setDialogOpen(true);
                    }}
                  >
                    <div className="flex gap-4">
                      {/* Company Icon */}
                      <div className="shrink-0">
                        <div className="w-12 h-12 rounded-lg bg-gradient-primary flex items-center justify-center shadow-sm">
                          <Building2 className="h-5 w-5 text-white" />
                        </div>
                      </div>

                      {/* Company Info */}
                      <div className="flex-1 min-w-0 space-y-2">
                        {/* Header */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <h3 className="text-sm font-semibold text-foreground truncate">
                              {company.name}
                            </h3>
                            {company.website && (
                              <a
                                href={company.website.startsWith('http') ? company.website : `https://${company.website}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-primary hover:underline inline-flex items-center gap-1 font-mono"
                              >
                                <Globe className="h-3 w-3" />
                                {company.website}
                                <ExternalLink className="h-2.5 w-2.5" />
                              </a>
                            )}
                          </div>
                          {company.wasEnriched && (
                            <Badge variant="secondary" className="shrink-0 h-5 text-xs">
                              <Sparkles className="h-2.5 w-2.5 mr-1" />
                              Enriched
                            </Badge>
                          )}
                        </div>

                        {/* Description */}
                        {company.description && (
                          <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
                            {company.description}
                          </p>
                        )}

                        {/* Enriched Data */}
                        {(company.products || company.recentNews || company.fundingInfo) && (
                          <div className="space-y-1 pt-1">
                            {company.products && (
                              <div className="text-xs">
                                <span className="font-medium text-foreground">Products:</span>{" "}
                                <span className="text-muted-foreground">{company.products}</span>
                              </div>
                            )}
                            {company.recentNews && (
                              <div className="text-xs">
                                <span className="font-medium text-foreground">News:</span>{" "}
                                <span className="text-muted-foreground">{company.recentNews}</span>
                              </div>
                            )}
                            {company.fundingInfo && (
                              <div className="text-xs">
                                <span className="font-medium text-foreground">Funding:</span>{" "}
                                <span className="text-muted-foreground">{company.fundingInfo}</span>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Meta Badges */}
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {company.primaryContact && (
                            <Badge variant="outline" className="h-5 text-xs bg-cyan-500/10 text-cyan-600 border-cyan-500/20">
                              <Mail className="h-3 w-3 mr-1" />
                              Contact Available
                            </Badge>
                          )}
                          {company.industry && (
                            <Badge variant="outline" className="h-5 text-xs font-mono">
                              {company.industry}
                            </Badge>
                          )}
                          {company.size && (
                            <Badge variant="secondary" className="h-5 text-xs font-mono">
                              {company.size}
                            </Badge>
                          )}
                          {company.employeeCount && (
                            <Badge variant="secondary" className="h-5 text-xs font-mono">
                              {company.employeeCount} emp
                            </Badge>
                          )}
                          {company.geography && (
                            <Badge variant="outline" className="h-5 text-xs font-mono">
                              📍 {company.geography}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Usage Stats Footer */}
              {results.usage && (
                <div className="mt-6 pt-4 border-t">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="space-y-1">
                      <div className="text-xs text-muted-foreground font-medium">Provider</div>
                      <div className="text-xs font-mono capitalize">{results.provider}</div>
                    </div>
                    <div className="space-y-1">
                      <div className="text-xs text-muted-foreground font-medium">Tokens</div>
                      <div className="text-xs font-mono">
                        {(results.usage.totalTokens + (results.enrichmentUsage?.totalTokens || 0)).toLocaleString()}
                      </div>
                    </div>
                    <div className="space-y-1">
                      <div className="text-xs text-muted-foreground font-medium">Cost</div>
                      <div className="text-xs font-mono font-semibold">
                        ${(results.usage.estimatedCost + (results.enrichmentUsage?.estimatedCost || 0)).toFixed(4)}
                      </div>
                    </div>
                    {results.traceUrl && (
                      <div className="space-y-1">
                        <div className="text-xs text-muted-foreground font-medium">Trace</div>
                        <a
                          href={results.traceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-primary hover:underline inline-flex items-center gap-1 font-mono"
                        >
                          View
                          <ExternalLink className="h-2.5 w-2.5" />
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <CompanyDetailsDialog 
        company={selectedCompany}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        isSearching={isLoading}
      />
    </div>
  );
}
