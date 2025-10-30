import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sparkles, Loader2, Building2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

export default function LeadFinder() {
  const [size, setSize] = useState("");
  const [geography, setGeography] = useState("");
  const [industry, setIndustry] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [dryRun, setDryRun] = useState(true);
  const [results, setResults] = useState<any[]>([]);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleSearch = async () => {
    if (!size || !geography || !industry) {
      toast({
        title: "Missing fields",
        description: "Please fill in all search criteria",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    setResults([]);

    try {
      const { data, error } = await supabase.functions.invoke("lead-finder", {
        body: { size, geography, industry, dryRun },
      });

      if (error) throw error;

      setResults(data.leads || []);
      toast({
        title: dryRun ? "Preview ready" : "Leads inserted",
        description: dryRun 
          ? `Found ${data.leads?.length || 0} potential leads`
          : `Successfully added ${data.inserted || 0} companies to your CRM`,
      });

      if (!dryRun) {
        queryClient.invalidateQueries({ queryKey: ["companies"] });
        queryClient.invalidateQueries({ queryKey: ["pipeline-stats"] });
      }
    } catch (error: any) {
      toast({
        title: "Search failed",
        description: error.message || "Failed to find leads. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <Sparkles className="h-8 w-8 text-primary" />
          AI Lead Finder
        </h1>
        <p className="text-muted-foreground">
          Find and enrich company leads using AI-powered web search
        </p>
      </div>

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
                placeholder="e.g., UK, US, EU"
                value={geography}
                onChange={(e) => setGeography(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="industry">Industry</Label>
              <Input
                id="industry"
                placeholder="e.g., Fintech, SaaS"
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
              />
            </div>
          </div>

          <div className="flex items-center gap-4 pt-2">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="dryRun"
                checked={dryRun}
                onChange={(e) => setDryRun(e.target.checked)}
                className="h-4 w-4"
              />
              <Label htmlFor="dryRun" className="cursor-pointer">
                Dry run (preview only)
              </Label>
            </div>

            <Button
              onClick={handleSearch}
              disabled={isLoading}
              className="ml-auto"
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
          </div>
        </CardContent>
      </Card>

      {results.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Results ({results.length} companies)</CardTitle>
            <CardDescription>
              {dryRun
                ? "Preview of companies found. Uncheck 'Dry run' to insert them into your CRM."
                : "These companies have been added to your CRM"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {results.map((company, idx) => (
                <div
                  key={idx}
                  className="flex items-start gap-4 rounded-lg border p-4 transition-colors hover:bg-muted/50"
                >
                  <div className="rounded-lg bg-primary/10 p-3">
                    <Building2 className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 space-y-1">
                    <h3 className="font-semibold">{company.name}</h3>
                    {company.website && (
                      <a
                        href={company.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-primary hover:underline"
                      >
                        {company.website}
                      </a>
                    )}
                    {company.description && (
                      <p className="text-sm text-muted-foreground">
                        {company.description}
                      </p>
                    )}
                    <div className="flex flex-wrap gap-2 pt-2">
                      {company.industry && (
                        <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                          {company.industry}
                        </span>
                      )}
                      {company.size && (
                        <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium">
                          {company.size}
                        </span>
                      )}
                      {company.geography && (
                        <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium">
                          {company.geography}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
