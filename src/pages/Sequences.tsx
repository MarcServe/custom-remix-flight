import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Mail, Layers, Sparkles, Loader2, ExternalLink, TrendingUp, Trash2, Clock, Copy, ChevronDown, ChevronUp, Users, Eye, Building2 } from "lucide-react";
import { useGenerateSequence, useSequences, useDeleteSequence } from "@/hooks/use-sequences";
import { useCompanySequences, useUpdateSequenceStatus, useDeleteCompanySequence } from "@/hooks/use-company-sequences";
import { useProviderStore } from "@/stores/provider-store";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { PersonalizedSequenceCard } from "@/components/sequences/PersonalizedSequenceCard";
import { SequenceChatCard } from "@/components/features/sequences/SequenceChatCard";
import { AutomationMetrics } from "@/components/sequences/AutomationMetrics";
import { SequenceDetailsDialog } from "@/components/sequences/SequenceDetailsDialog";
import { PersonalizeSequenceDialog } from "@/components/sequences/PersonalizeSequenceDialog";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

export default function Sequences() {
  const [size, setSize] = useState("");
  const [geography, setGeography] = useState("");
  const [industry, setIndustry] = useState("");
  const [steps, setSteps] = useState("3");
  const [tone, setTone] = useState<"professional" | "casual" | "technical">("professional");
  const [customInstructions, setCustomInstructions] = useState("");
  const [autoRespond, setAutoRespond] = useState(false);
  const [useEmailBranding, setUseEmailBranding] = useState(true);
  const [sendImmediately, setSendImmediately] = useState(false);
  const [expandedSteps, setExpandedSteps] = useState<number[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>("");
  const [selectedSequence, setSelectedSequence] = useState<any>(null);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [personalizeDialogOpen, setPersonalizeDialogOpen] = useState(false);
  const [personalizeCompanyId, setPersonalizeCompanyId] = useState<string>("");
  const [personalizeCompanyName, setPersonalizeCompanyName] = useState<string>("");
  const [companySelectorOpen, setCompanySelectorOpen] = useState(false);
  const [pendingSequenceId, setPendingSequenceId] = useState<string>("");
  const { toast } = useToast();

  const scrollToAssistant = () => {
    document.getElementById('ai-assistant')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

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

  // Fetch companies for selector
  const { data: companiesData } = useQuery({
    queryKey: ['companies-for-sequence'],
    queryFn: async () => {
      const { data } = await supabase
        .from('companies')
        .select('id, name, industry, geography, size')
        .order('name');
      return data || [];
    },
  });

  // Auto-fill when company is selected
  useEffect(() => {
    if (selectedCompanyId && companiesData) {
      const company = companiesData.find(c => c.id === selectedCompanyId);
      if (company) {
        if (company.industry) setIndustry(company.industry);
        if (company.geography) setGeography(company.geography);
        if (company.size) setSize(company.size);
      }
    }
  }, [selectedCompanyId, companiesData]);

  const handleGenerate = async () => {
    const { data } = await generateMutation.mutateAsync({
      size,
      geography,
      industry,
      steps: parseInt(steps),
      tone,
      provider: providerConfig.provider,
      model: providerConfig.model,
      customInstructions: customInstructions || undefined,
      autoRespond,
      use_email_branding: useEmailBranding,
    });

    if (data) {
      // Expand all steps by default
      setExpandedSteps(data.sequence.map((_, idx) => idx));
      // Reset form
      setSize("");
      setGeography("");
      setIndustry("");
      setCustomInstructions("");
      setSendImmediately(false);
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
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-gradient-primary flex items-center justify-center shadow-lg">
                  <Mail className="h-6 w-6 text-purple-500" />
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
              <Button 
                onClick={scrollToAssistant}
                size="lg"
                className="gap-2 shadow-lg"
              >
                <Sparkles className="h-5 w-5" />
                AI Sequence Assistant
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="space-y-6">
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
                {/* Company Selector */}
                <div className="space-y-2">
                  <Label htmlFor="seq-company" className="text-sm font-medium flex items-center gap-2">
                    <Users className="h-4 w-4 text-primary" />
                    Select Company (Optional - Auto-fills fields)
                  </Label>
                  <Select value={selectedCompanyId || undefined} onValueChange={setSelectedCompanyId}>
                    <SelectTrigger id="seq-company" className="h-10">
                      <SelectValue placeholder="Choose a company from your CRM" />
                    </SelectTrigger>
                    <SelectContent>
                      {companiesData?.map((company) => (
                        <SelectItem key={company.id} value={company.id}>
                          {company.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedCompanyId && (
                    <p className="text-xs text-muted-foreground">
                      Company details will auto-fill below. You can still modify them.
                    </p>
                  )}
                </div>

                <Separator />

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

                <div className="space-y-2">
                  <Label htmlFor="seq-instructions" className="text-sm font-medium">
                    Custom Instructions (Optional)
                  </Label>
                  <Textarea
                    id="seq-instructions"
                    placeholder="e.g., Focus on ROI and cost savings, mention our Q4 product launch, target CTOs and technical decision-makers, use case studies from financial sector..."
                    value={customInstructions}
                    onChange={(e) => setCustomInstructions(e.target.value)}
                    className="min-h-[100px] resize-none"
                    maxLength={500}
                  />
                  <p className="text-xs text-muted-foreground">
                    {customInstructions.length}/500 characters
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="seq-provider" className="text-sm font-medium">AI Provider</Label>
                  <Select
                    value={providerConfig.provider}
                    onValueChange={(value: 'openai' | 'perplexity') => {
                      const defaultModels: Record<string, string> = {
                        openai: 'gpt-4o-mini',
                        perplexity: 'sonar',
                      };
                      setProviderConfig({
                        provider: value,
                        model: defaultModels[value],
                      });
                    }}
                  >
                    <SelectTrigger id="seq-provider" className="h-10">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="openai">
                        <div className="flex items-center gap-2">
                          <Sparkles className="h-4 w-4" />
                          <span>OpenAI (GPT)</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="perplexity">
                        <div className="flex items-center gap-2">
                          <TrendingUp className="h-4 w-4" />
                          <span>Perplexity (Search)</span>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="seq-model" className="text-sm font-medium">Model</Label>
                  <Select
                    value={providerConfig.model}
                    onValueChange={(value) => setProviderConfig({ ...providerConfig, model: value })}
                  >
                    <SelectTrigger id="seq-model" className="h-10">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {providerConfig.provider === 'openai' && (
                        <>
                          <SelectItem value="gpt-4o-mini">GPT-4o Mini (Efficient)</SelectItem>
                          <SelectItem value="gpt-4o">GPT-4o (Most Capable)</SelectItem>
                        </>
                      )}
                      {providerConfig.provider === 'perplexity' && (
                        <>
                          <SelectItem value="sonar">Sonar (Fast with search)</SelectItem>
                          <SelectItem value="sonar-pro">Sonar Pro (Advanced with search)</SelectItem>
                        </>
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between p-4 rounded-lg border bg-muted/50">
                  <div className="space-y-0.5">
                    <Label htmlFor="auto-respond" className="text-sm font-medium cursor-pointer">
                      Enable Auto-Response
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      AI will automatically respond to interested prospects without manual review
                    </p>
                  </div>
                  <Switch
                    id="auto-respond"
                    checked={autoRespond}
                    onCheckedChange={setAutoRespond}
                  />
                </div>

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between p-4 rounded-lg border bg-muted/50">
                  <div className="space-y-0.5">
                    <Label htmlFor="use-email-branding" className="text-sm font-medium cursor-pointer">
                      Use email branding template
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Wrap sequence emails in your logo, footer, and style so recipients recognize your brand (same as campaigns)
                    </p>
                  </div>
                  <Switch
                    id="use-email-branding"
                    checked={useEmailBranding}
                    onCheckedChange={setUseEmailBranding}
                  />
                </div>

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between p-4 rounded-lg border bg-muted/50">
                  <div className="space-y-0.5">
                    <Label htmlFor="send-immediately" className="text-sm font-medium cursor-pointer">
                      Send First Email Immediately
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      When applying to a company, automatically send the first email and activate the sequence
                    </p>
                  </div>
                  <Switch
                    id="send-immediately"
                    checked={sendImmediately}
                    onCheckedChange={setSendImmediately}
                  />
                </div>

                <Button
                  onClick={handleGenerate}
                  disabled={!isFormValid || isGenerating}
                  className="w-full h-12 text-base"
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
                                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
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
                                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
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

                {/* Apply to Company Section */}
                <Card className="border-2 border-primary/20 shadow-md" data-apply-section>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Building2 className="h-5 w-5 text-primary" />
                      Apply to Company
                    </CardTitle>
                    <CardDescription>
                      Select a company to personalize and send this sequence
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="apply-company">Select Company</Label>
                      <Select
                        value={personalizeCompanyId}
                        onValueChange={(value) => {
                          setPersonalizeCompanyId(value);
                          const company = companiesData?.find(c => c.id === value);
                          setPersonalizeCompanyName(company?.name || "");
                        }}
                      >
                        <SelectTrigger id="apply-company">
                          <SelectValue placeholder="Choose a company" />
                        </SelectTrigger>
                        <SelectContent>
                          {companiesData?.map((company) => (
                            <SelectItem key={company.id} value={company.id}>
                              {company.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button
                      onClick={() => setPersonalizeDialogOpen(true)}
                      disabled={!personalizeCompanyId}
                      className="w-full"
                    >
                      <Sparkles className="h-4 w-4 mr-2" />
                      {sendImmediately ? 'Personalize & Send' : 'Personalize Sequence'}
                    </Button>
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

            {/* Automation Metrics */}
            <AutomationMetrics />

            {/* Saved Sequences */}
            <div id="saved-sequences" className="space-y-4 scroll-mt-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
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
                      className="group transition-all hover:shadow-xl hover:scale-[1.02] border-2 hover:border-primary/50 bg-gradient-to-br from-card to-card/50 overflow-hidden cursor-pointer"
                      onClick={() => {
                        setSelectedSequence(sequence);
                        setDetailsDialogOpen(true);
                      }}
                    >
                      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-primary" />
                      <CardHeader className="pb-3">
                        <div className="flex items-start gap-4">
                          <div className="w-12 h-12 rounded-lg bg-gradient-primary flex items-center justify-center shadow-lg shrink-0 group-hover:scale-110 transition-transform">
                            <Mail className="h-6 w-6 text-white" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <CardTitle className="text-base truncate mb-1 flex items-center gap-2">
                              {sequence.name}
                              <Eye className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" />
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
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <div className="flex items-center gap-2 text-sm font-medium">
                            <Layers className="h-4 w-4 text-primary" />
                            {sequence.steps?.length || 0} steps
                          </div>
                          <div className="flex items-center gap-1">
                            <Button
                              size="sm"
                              variant="default"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedSequence(sequence);
                                setPendingSequenceId(sequence.id);
                                setCompanySelectorOpen(true);
                              }}
                              className="h-8 text-xs"
                            >
                              <Sparkles className="h-3 w-3 mr-1" />
                              Start
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDelete(sequence.id);
                              }}
                              disabled={deleteMutation.isPending}
                              className="h-8 hover:bg-destructive/10 hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                        {sequence.steps?.[0] && (
                          <div className="text-xs border-t pt-3 space-y-1">
                            <div className="text-muted-foreground font-medium">First email:</div>
                            <div className="text-foreground truncate font-medium">
                              {(() => {
                                const step = sequence.steps[0];
                                const parsedStep = typeof step === 'string' ? JSON.parse(step) : step;
                                return parsedStep.subject || 'No subject';
                              })()}
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>

            {/* AI Sequence Builder - Full Width at Bottom */}
            <div id="ai-assistant" className="space-y-4 scroll-mt-8">
              <div className="flex items-center gap-3">
                <div className="h-1 flex-1 bg-gradient-to-r from-transparent via-primary/50 to-transparent rounded-full" />
                <h2 className="text-2xl font-bold flex items-center gap-2">
                  <Sparkles className="h-6 w-6 text-primary animate-pulse" />
                  AI Sequence Assistant
                </h2>
                <div className="h-1 flex-1 bg-gradient-to-r from-transparent via-primary/50 to-transparent rounded-full" />
              </div>
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-primary/10 to-primary/5 rounded-2xl blur-xl" />
                <div className="relative h-[600px]">
                  <SequenceChatCard />
                </div>
              </div>
            </div>
          </div>
        </div>

      {/* Sequence Details Dialog */}
      {selectedSequence && (
        <SequenceDetailsDialog
          open={detailsDialogOpen}
          onOpenChange={setDetailsDialogOpen}
          sequence={selectedSequence}
        />
      )}

      {/* Company Selector Dialog for Saved Sequences */}
      <Dialog open={companySelectorOpen} onOpenChange={setCompanySelectorOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Select Company</DialogTitle>
            <DialogDescription>
              Choose a company to personalize this sequence for
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="company-selector">Company</Label>
              <Select
                value={personalizeCompanyId}
                onValueChange={(value) => {
                  setPersonalizeCompanyId(value);
                  const company = companiesData?.find(c => c.id === value);
                  setPersonalizeCompanyName(company?.name || "");
                }}
              >
                <SelectTrigger id="company-selector">
                  <SelectValue placeholder="Choose a company" />
                </SelectTrigger>
                <SelectContent>
                  {companiesData?.map((company) => (
                    <SelectItem key={company.id} value={company.id}>
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4" />
                        {company.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <Button
              variant="outline"
              onClick={() => {
                setCompanySelectorOpen(false);
                setPersonalizeCompanyId("");
                setPersonalizeCompanyName("");
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (!personalizeCompanyId) {
                  toast({
                    title: "No Company Selected",
                    description: "Please select a company to continue",
                    variant: "destructive",
                  });
                  return;
                }
                setCompanySelectorOpen(false);
                setPersonalizeDialogOpen(true);
              }}
              disabled={!personalizeCompanyId}
            >
              Continue
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Personalize Sequence Dialog */}
      {personalizeCompanyId && personalizeCompanyName && (
        <PersonalizeSequenceDialog
          open={personalizeDialogOpen}
          onOpenChange={(open) => {
            setPersonalizeDialogOpen(open);
            if (!open) {
              setPersonalizeCompanyId("");
              setPersonalizeCompanyName("");
              setSelectedSequence(null);
              setPendingSequenceId("");
            }
          }}
          companyId={personalizeCompanyId}
          companyName={personalizeCompanyName}
          defaultSendImmediately={sendImmediately}
          defaultSequenceId={pendingSequenceId || selectedSequence?.id}
        />
      )}
    </div>
  );
}
