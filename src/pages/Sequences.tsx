import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Mail, Layers, Sparkles, Loader2, ExternalLink, TrendingUp, Trash2, Clock, Copy, ChevronDown, ChevronUp, Users } from "lucide-react";
import { ProviderSelector } from "@/components/features/common/ProviderSelector";
import { useGenerateSequence, useSequences, useDeleteSequence } from "@/hooks/use-sequences";
import { useCompanySequences, useUpdateSequenceStatus, useDeleteCompanySequence } from "@/hooks/use-company-sequences";
import { useProviderStore } from "@/stores/provider-store";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PersonalizedSequenceCard } from "@/components/sequences/PersonalizedSequenceCard";

export default function Sequences() {
  const [size, setSize] = useState("");
  const [geography, setGeography] = useState("");
  const [industry, setIndustry] = useState("");
  const [steps, setSteps] = useState("3");
  const [tone, setTone] = useState<"professional" | "casual" | "technical">("professional");
  const [expandedSteps, setExpandedSteps] = useState<number[]>([]);
  const { toast } = useToast();

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

  const generateMutation = useGenerateSequence();
  const { data: sequencesData, isLoading } = useSequences();
  const deleteMutation = useDeleteSequence();
  const { data: companySequencesData, isLoading: isLoadingCompanySequences } = useCompanySequences();
  const updateSequenceStatus = useUpdateSequenceStatus();
  const deleteCompanySequence = useDeleteCompanySequence();

  const handleGenerate = async () => {
    const { data } = await generateMutation.mutateAsync({
      size,
      geography,
      industry,
      steps: parseInt(steps),
      tone,
      provider: providerConfig.provider,
      model: providerConfig.model,
    });

    if (data) {
      // Expand all steps by default
      setExpandedSteps(data.sequence.map((_, idx) => idx));
      // Reset form
      setSize("");
      setGeography("");
      setIndustry("");
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm("Are you sure you want to delete this sequence?")) {
      await deleteMutation.mutateAsync(id);
    }
  };

  const copyToClipboard = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied!",
      description: `${type} copied to clipboard`,
    });
  };

  const toggleStep = (idx: number) => {
    setExpandedSteps(prev => 
      prev.includes(idx) ? prev.filter(i => i !== idx) : [...prev, idx]
    );
  };

  const isFormValid = size && geography && industry;
  const isGenerating = generateMutation.isPending;
  const result = generateMutation.data?.data;
  const sequences = sequencesData?.data || [];
  const companySequences = companySequencesData?.data || [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      {/* Hero Section */}
      <div className="relative overflow-hidden border-b bg-gradient-to-br from-primary/10 via-primary/5 to-transparent backdrop-blur-sm">
        <div className="absolute inset-0 bg-grid-white/[0.02] pointer-events-none" />
        <div className="relative px-6 py-12">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-primary flex items-center justify-center shadow-lg">
                <Mail className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-br from-foreground to-foreground/70 bg-clip-text text-transparent">
                  Email Sequences
                </h1>
                <p className="text-muted-foreground mt-1">
                  AI-powered automated campaigns tailored to your target segments
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            {/* Generation Form */}
            <Card className="border-2 hover:border-primary/50 transition-all shadow-lg bg-gradient-to-br from-card via-card to-primary/5">
              <CardHeader className="pb-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-gradient-primary flex items-center justify-center shadow-sm">
                      <Sparkles className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <CardTitle className="text-xl">Generate New Sequence</CardTitle>
                      <CardDescription className="mt-1">
                        Create AI-generated emails for a specific segment
                      </CardDescription>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="seq-size" className="text-sm font-medium flex items-center gap-2">
                      <Layers className="h-4 w-4 text-primary" />
                      Company Size
                    </Label>
                    <Select value={size} onValueChange={setSize}>
                      <SelectTrigger id="seq-size" className="h-10">
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
                    <Label htmlFor="seq-geography" className="text-sm font-medium">Geography</Label>
                    <Input
                      id="seq-geography"
                      placeholder="e.g., United Kingdom, US"
                      value={geography}
                      onChange={(e) => setGeography(e.target.value)}
                      className="h-10"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="seq-industry" className="text-sm font-medium">Industry</Label>
                    <Input
                      id="seq-industry"
                      placeholder="e.g., Fintech, SaaS"
                      value={industry}
                      onChange={(e) => setIndustry(e.target.value)}
                      className="h-10"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="seq-tone" className="text-sm font-medium">Tone</Label>
                    <Select value={tone} onValueChange={(v) => setTone(v as any)}>
                      <SelectTrigger id="seq-tone" className="h-10">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="professional">Professional</SelectItem>
                        <SelectItem value="casual">Casual</SelectItem>
                        <SelectItem value="technical">Technical</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="seq-steps" className="text-sm font-medium">Number of Steps</Label>
                  <Select value={steps} onValueChange={setSteps}>
                    <SelectTrigger id="seq-steps" className="h-10">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="3">3 steps</SelectItem>
                      <SelectItem value="4">4 steps</SelectItem>
                      <SelectItem value="5">5 steps</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Button
                  onClick={handleGenerate}
                  disabled={!isFormValid || isGenerating}
                  className="w-full h-12 text-base bg-gradient-primary hover:opacity-90 transition-opacity shadow-lg"
                  size="lg"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Generating your sequence...
                    </>
                  ) : (
                    <>
                      <Sparkles className="mr-2 h-5 w-5" />
                      Generate Sequence
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>

            {/* Generated Sequence Display */}
            {result && (
              <>
                <Card className="border-2 border-primary/20 shadow-xl bg-gradient-to-br from-card to-primary/5">
                  <CardHeader className="pb-4">
                    <div className="flex items-center gap-3">
                      <Badge className="bg-gradient-primary text-base px-3 py-1">
                        <Sparkles className="h-4 w-4 mr-1" />
                        Generated
                      </Badge>
                      <div>
                        <CardTitle className="text-xl">{result.name}</CardTitle>
                        <CardDescription className="text-xs mt-1">
                          {result.sequence.length}-step email sequence
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Timeline Visualization */}
                    <div className="relative space-y-4">
                      {result.sequence.map((step: any, idx: number) => (
                        <div key={idx} className="relative">
                          {/* Timeline Connector */}
                          {idx < result.sequence.length - 1 && (
                            <div className="absolute left-6 top-16 bottom-0 w-0.5 bg-gradient-to-b from-primary via-primary/50 to-transparent" />
                          )}
                          
                          <Collapsible 
                            open={expandedSteps.includes(idx)}
                            onOpenChange={() => toggleStep(idx)}
                          >
                            <div className="relative rounded-xl border-2 bg-gradient-to-br from-card to-card/50 hover:border-primary/50 transition-all shadow-md overflow-hidden">
                              {/* Step Header */}
                              <CollapsibleTrigger asChild>
                                <div className="p-4 cursor-pointer hover:bg-primary/5 transition-colors">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-4 flex-1 min-w-0">
                                      <div className="w-12 h-12 rounded-lg bg-gradient-primary flex items-center justify-center shadow-lg shrink-0">
                                        <span className="text-white font-bold text-lg">{idx + 1}</span>
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                          <Badge variant="outline" className="font-mono text-xs">
                                            Step {idx + 1}
                                          </Badge>
                                          {step.delayDays > 0 && (
                                            <Badge variant="secondary" className="text-xs">
                                              <Clock className="h-3 w-3 mr-1" />
                                              +{step.delayDays} days
                                            </Badge>
                                          )}
                                        </div>
                                        <div className="font-semibold text-sm truncate">
                                          {step.subject}
                                        </div>
                                      </div>
                                    </div>
                                    <Button 
                                      variant="ghost" 
                                      size="sm"
                                      className="shrink-0"
                                    >
                                      {expandedSteps.includes(idx) ? (
                                        <ChevronUp className="h-4 w-4" />
                                      ) : (
                                        <ChevronDown className="h-4 w-4" />
                                      )}
                                    </Button>
                                  </div>
                                </div>
                              </CollapsibleTrigger>

                              {/* Step Body */}
                              <CollapsibleContent>
                                <Separator />
                                <div className="p-4 space-y-3 bg-muted/30">
                                  <div className="flex items-center justify-between">
                                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                                      Email Body
                                    </span>
                                    <div className="flex gap-2">
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => copyToClipboard(step.subject, "Subject")}
                                        className="h-7 text-xs"
                                      >
                                        <Copy className="h-3 w-3 mr-1" />
                                        Subject
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => copyToClipboard(step.body, "Body")}
                                        className="h-7 text-xs"
                                      >
                                        <Copy className="h-3 w-3 mr-1" />
                                        Body
                                      </Button>
                                    </div>
                                  </div>
                                  <div className="rounded-lg bg-background/80 p-4 text-sm text-foreground whitespace-pre-wrap leading-relaxed shadow-inner">
                                    {step.body}
                                  </div>
                                </div>
                              </CollapsibleContent>
                            </div>
                          </Collapsible>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Generation Stats */}
                {result.usage && (
                  <Card className="border shadow-md">
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center gap-2 text-lg">
                        <TrendingUp className="h-5 w-5 text-primary" />
                        Generation Details
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="space-y-1">
                          <div className="text-xs text-muted-foreground uppercase tracking-wide">Provider</div>
                          <div className="text-base font-bold capitalize">{result.provider}</div>
                        </div>
                        <div className="space-y-1">
                          <div className="text-xs text-muted-foreground uppercase tracking-wide">Model</div>
                          <div className="text-sm font-semibold">{result.model}</div>
                        </div>
                        <div className="space-y-1">
                          <div className="text-xs text-muted-foreground uppercase tracking-wide">Tokens</div>
                          <div className="text-base font-bold font-mono">{result.usage.totalTokens.toLocaleString()}</div>
                        </div>
                        <div className="space-y-1">
                          <div className="text-xs text-muted-foreground uppercase tracking-wide">Cost</div>
                          <div className="text-base font-bold text-primary">${result.usage.estimatedCost.toFixed(4)}</div>
                        </div>
                      </div>
                      {result.traceUrl && (
                        <a
                          href={result.traceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-primary hover:underline inline-flex items-center gap-1 mt-4"
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

            {/* Saved Sequences */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold">Saved Sequences</h2>
                <Badge variant="secondary" className="text-sm">
                  {sequences.length} total
                </Badge>
              </div>
              {isLoading ? (
                <Card className="shadow-md">
                  <CardContent className="py-16 flex items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </CardContent>
                </Card>
              ) : sequences.length === 0 ? (
                <Card className="border-2 border-dashed shadow-md">
                  <CardContent className="py-16 text-center">
                    <div className="mx-auto w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                      <Mail className="h-8 w-8 text-primary/40" />
                    </div>
                    <h3 className="text-lg font-semibold mb-2">No sequences yet</h3>
                    <p className="text-muted-foreground text-sm">
                      Generate your first email sequence above to get started
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  {sequences.map((sequence: any) => (
                    <Card 
                      key={sequence.id} 
                      className="group transition-all hover:shadow-xl hover:scale-[1.02] border-2 hover:border-primary/50 bg-gradient-to-br from-card to-card/50 overflow-hidden"
                    >
                      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-primary" />
                      <CardHeader className="pb-3">
                        <div className="flex items-start gap-4">
                          <div className="w-12 h-12 rounded-lg bg-gradient-primary flex items-center justify-center shadow-lg shrink-0 group-hover:scale-110 transition-transform">
                            <Mail className="h-6 w-6 text-white" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <CardTitle className="text-base truncate mb-1">
                              {sequence.name}
                            </CardTitle>
                            {sequence.segment_filters && (
                              <div className="flex flex-wrap gap-1.5">
                                <Badge variant="secondary" className="text-xs">
                                  {sequence.segment_filters.industry}
                                </Badge>
                                <Badge variant="outline" className="text-xs">
                                  {sequence.segment_filters.geography}
                                </Badge>
                              </div>
                            )}
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 text-sm font-medium">
                            <Layers className="h-4 w-4 text-primary" />
                            {sequence.steps?.length || 0} steps
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDelete(sequence.id)}
                            disabled={deleteMutation.isPending}
                            className="h-8 hover:bg-destructive/10 hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                        {sequence.steps?.[0] && (
                          <div className="text-xs border-t pt-3 space-y-1">
                            <div className="text-muted-foreground font-medium">First email:</div>
                            <div className="text-foreground truncate font-medium">
                              {sequence.steps[0].subject}
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Provider Selector */}
          <div className="lg:sticky lg:top-6 h-fit">
            <ProviderSelector
              value={providerConfig}
              onChange={(config) => setProviderConfig(config as any)}
              showCost
            />
          </div>
        </div>
      </div>
    </div>
  );
}
