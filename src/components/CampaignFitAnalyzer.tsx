import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
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
} from "lucide-react";

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

export function CampaignFitAnalyzer() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<AnalysisResponse | null>(null);
  
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
    if (!campaignType || !productFocus) {
      toast({
        title: "Missing Information",
        description: "Please provide campaign type and product focus.",
        variant: "destructive",
      });
      return;
    }
    analysisMutation.mutate();
  };

  const resetForm = () => {
    setResults(null);
    setCampaignType("");
    setTargetIndustries([]);
    setTargetSizes([]);
    setTargetGeographies([]);
    setProductFocus("");
    setIdealCustomerProfile("");
  };

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
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Campaign Fit Analyzer
          </DialogTitle>
          <DialogDescription>
            Find the best companies from your list for a specific marketing campaign
          </DialogDescription>
        </DialogHeader>

        {!results ? (
          <ScrollArea className="flex-1 pr-4">
            <div className="space-y-6 py-4">
              {/* Campaign Details */}
              <div className="space-y-4">
                <h3 className="font-medium flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  Campaign Details
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="campaignType">Campaign Type *</Label>
                    <Input
                      id="campaignType"
                      placeholder="e.g., Product Launch, Demo Outreach, Content Promotion"
                      value={campaignType}
                      onChange={(e) => setCampaignType(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="productFocus">Product/Service Focus *</Label>
                    <Input
                      id="productFocus"
                      placeholder="e.g., CRM Software, Marketing Automation"
                      value={productFocus}
                      onChange={(e) => setProductFocus(e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="icp">Ideal Customer Profile</Label>
                  <Textarea
                    id="icp"
                    placeholder="Describe your ideal customer... e.g., Mid-market B2B SaaS companies with 50-500 employees looking to scale their sales operations"
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

              <Button 
                onClick={handleAnalyze} 
                disabled={analysisMutation.isPending}
                className="w-full"
              >
                {analysisMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Analyzing Companies...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Analyze My Companies
                  </>
                )}
              </Button>
            </div>
          </ScrollArea>
        ) : (
          <ScrollArea className="flex-1 pr-4">
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
                <div className="flex items-center justify-between">
                  <h3 className="font-medium">Company Rankings</h3>
                  <span className="text-sm text-muted-foreground">
                    {results.summary.hasContacts} with email contacts
                  </span>
                </div>

                {results.results.slice(0, 20).map((result, index) => (
                  <Card key={result.companyId} className={index < 3 ? 'border-primary/30' : ''}>
                    <CardContent className="py-3">
                      <div className="flex items-start gap-3">
                        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-muted text-sm font-medium">
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
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">
                            {result.fitReason}
                          </p>
                          <div className="flex items-center gap-1 mt-2 text-xs text-primary">
                            <ArrowRight className="h-3 w-3" />
                            {result.recommendedApproach}
                          </div>
                        </div>
                        <Progress value={result.fitScore} className="w-16 h-2" />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <div className="flex gap-2">
                <Button variant="outline" onClick={resetForm} className="flex-1">
                  New Analysis
                </Button>
                <Button 
                  onClick={() => {
                    // Copy high-fit company names to clipboard
                    const highFit = results.results
                      .filter(r => r.priority === 'high')
                      .map(r => r.companyName)
                      .join('\n');
                    navigator.clipboard.writeText(highFit);
                    toast({ title: "Copied!", description: "High-fit company names copied to clipboard" });
                  }}
                  className="flex-1"
                >
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Copy High-Fit List
                </Button>
              </div>
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
}