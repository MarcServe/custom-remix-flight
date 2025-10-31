import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Sparkles, Loader2, Building2, ExternalLink, TrendingUp } from "lucide-react";
import { ProviderSelector } from "@/components/features/common/ProviderSelector";
import { useLeadFinder } from "@/hooks/use-lead-finder";
import { useProviderStore } from "@/stores/provider-store";
import { useUIStore } from "@/stores/ui-store";
import { Badge } from "@/components/ui/badge";

export default function LeadFinder() {
  const [size, setSize] = useState("");
  const [geography, setGeography] = useState("");
  const [industry, setIndustry] = useState("");
  const [dryRun, setDryRun] = useState(true);
  
  const { defaultProvider, defaultModels } = useProviderStore();
  const [providerConfig, setProviderConfig] = useState({
    provider: defaultProvider,
    model: defaultModels[defaultProvider] as string | undefined,
  });

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
    });

    if (data) {
      setLeadFinderResults(data.leads);
    }
  };

  const isFormValid = size && geography && industry;
  const isLoading = leadFinderMutation.isPending;
  const results = leadFinderMutation.data?.data;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <Sparkles className="h-8 w-8 text-primary" />
          AI Lead Finder
        </h1>
        <p className="text-muted-foreground mt-1">
          Find and enrich company leads using AI-powered web search
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Search Criteria</CardTitle>
              <CardDescription>
                Enter the characteristics of companies you want to find
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="size">Company Size</Label>
                  <Select value={size} onValueChange={setSize}>
                    <SelectTrigger id="size">
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

                <div className="space-y-2">
                  <Label htmlFor="geography">Geography</Label>
                  <Input
                    id="geography"
                    placeholder="e.g., United Kingdom, San Francisco"
                    value={geography}
                    onChange={(e) => setGeography(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="industry">Industry</Label>
                  <Input
                    id="industry"
                    placeholder="e.g., Fintech, SaaS, Healthcare"
                    value={industry}
                    onChange={(e) => setIndustry(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex items-center space-x-2 pt-2">
                <Checkbox
                  id="dryRun"
                  checked={dryRun}
                  onCheckedChange={(checked) => setDryRun(checked as boolean)}
                />
                <Label
                  htmlFor="dryRun"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                >
                  Dry run (preview only, don't insert to CRM)
                </Label>
              </div>

              <Button
                onClick={handleSearch}
                disabled={!isFormValid || isLoading}
                className="w-full"
                size="lg"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Searching...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Find Leads
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {results && (
            <>
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Results ({results.leads.length} companies)</CardTitle>
                      <CardDescription className="mt-1">
                        {dryRun
                          ? "Preview mode - these companies won't be added to your CRM"
                          : `Successfully added ${results.inserted} companies to your CRM`}
                      </CardDescription>
                    </div>
                    {results.usage && (
                      <Badge variant="secondary" className="ml-2">
                        ${results.usage.estimatedCost.toFixed(4)}
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {results.leads.map((company: any, idx: number) => (
                      <div
                        key={idx}
                        className="flex items-start gap-4 rounded-lg border p-4 transition-colors hover:bg-accent/50"
                      >
                        <div className="rounded-lg bg-primary/10 p-3">
                          <Building2 className="h-5 w-5 text-primary" />
                        </div>
                        <div className="flex-1 space-y-2">
                          <div className="flex items-start justify-between">
                            <h3 className="font-semibold">{company.name}</h3>
                          </div>
                          {company.website && (
                            <a
                              href={company.website.startsWith('http') ? company.website : `https://${company.website}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm text-primary hover:underline inline-flex items-center gap-1"
                            >
                              {company.website}
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          )}
                          {company.description && (
                            <p className="text-sm text-muted-foreground line-clamp-2">
                              {company.description}
                            </p>
                          )}
                          <div className="flex flex-wrap gap-2">
                            {company.industry && (
                              <Badge variant="default">{company.industry}</Badge>
                            )}
                            {company.size && (
                              <Badge variant="secondary">{company.size}</Badge>
                            )}
                            {company.geography && (
                              <Badge variant="outline">{company.geography}</Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {results.usage && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <TrendingUp className="h-5 w-5" />
                      Request Details
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <div className="text-muted-foreground">Provider</div>
                        <div className="font-medium capitalize">{results.provider}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Model</div>
                        <div className="font-medium text-xs">{results.model}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Tokens Used</div>
                        <div className="font-medium">{results.usage.totalTokens.toLocaleString()}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Cost</div>
                        <div className="font-medium">${results.usage.estimatedCost.toFixed(4)}</div>
                      </div>
                    </div>
                    {results.traceUrl && (
                      <a
                        href={results.traceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-primary hover:underline inline-flex items-center gap-1 mt-3"
                      >
                        View trace in Langfuse
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </div>

        <div>
          <ProviderSelector
            value={providerConfig}
            onChange={(config) => setProviderConfig(config as any)}
            showCost
          />
        </div>
      </div>
    </div>
  );
}
