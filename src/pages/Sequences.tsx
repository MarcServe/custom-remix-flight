import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Mail, Layers, Sparkles, Loader2, ExternalLink, TrendingUp, Trash2 } from "lucide-react";
import { ProviderSelector } from "@/components/features/common/ProviderSelector";
import { useGenerateSequence, useSequences, useDeleteSequence } from "@/hooks/use-sequences";
import { useProviderStore } from "@/stores/provider-store";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

export default function Sequences() {
  const [size, setSize] = useState("");
  const [geography, setGeography] = useState("");
  const [industry, setIndustry] = useState("");
  const [steps, setSteps] = useState("3");
  const [tone, setTone] = useState<"professional" | "casual" | "technical">("professional");

  const { defaultProvider, defaultModels } = useProviderStore();
  const [providerConfig, setProviderConfig] = useState({
    provider: defaultProvider,
    model: defaultModels[defaultProvider] as string | undefined,
  });

  const generateMutation = useGenerateSequence();
  const { data: sequencesData, isLoading } = useSequences();
  const deleteMutation = useDeleteSequence();

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

  const isFormValid = size && geography && industry;
  const isGenerating = generateMutation.isPending;
  const result = generateMutation.data?.data;
  const sequences = sequencesData?.data || [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Email Sequences</h1>
        <p className="text-muted-foreground mt-1">
          AI-powered automated email campaigns tailored to your target segments
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                Generate New Sequence
              </CardTitle>
              <CardDescription>
                Create an AI-generated email sequence for a specific segment
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="seq-size">Company Size</Label>
                  <Select value={size} onValueChange={setSize}>
                    <SelectTrigger id="seq-size">
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
                  <Label htmlFor="seq-geography">Geography</Label>
                  <Input
                    id="seq-geography"
                    placeholder="e.g., United Kingdom, US"
                    value={geography}
                    onChange={(e) => setGeography(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="seq-industry">Industry</Label>
                  <Input
                    id="seq-industry"
                    placeholder="e.g., Fintech, SaaS"
                    value={industry}
                    onChange={(e) => setIndustry(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="seq-tone">Tone</Label>
                  <Select value={tone} onValueChange={(v) => setTone(v as any)}>
                    <SelectTrigger id="seq-tone">
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
                <Label htmlFor="seq-steps">Number of Steps</Label>
                <Select value={steps} onValueChange={setSteps}>
                  <SelectTrigger id="seq-steps">
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
                className="w-full"
                size="lg"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Generate Sequence
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {result && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>Generated Sequence</CardTitle>
                  <CardDescription>{result.name}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {result.sequence.map((step: any, idx: number) => (
                    <div key={idx} className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">Step {idx + 1}</Badge>
                        {step.delayDays > 0 && (
                          <span className="text-xs text-muted-foreground">
                            +{step.delayDays} days
                          </span>
                        )}
                      </div>
                      <div className="rounded-lg border p-4 space-y-2">
                        <div className="font-semibold text-sm">Subject: {step.subject}</div>
                        <Separator />
                        <div className="text-sm text-muted-foreground whitespace-pre-wrap">
                          {step.body}
                        </div>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {result.usage && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <TrendingUp className="h-5 w-5" />
                      Generation Details
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <div className="text-muted-foreground">Provider</div>
                        <div className="font-medium capitalize">{result.provider}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Model</div>
                        <div className="font-medium text-xs">{result.model}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Tokens Used</div>
                        <div className="font-medium">{result.usage.totalTokens.toLocaleString()}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Cost</div>
                        <div className="font-medium">${result.usage.estimatedCost.toFixed(4)}</div>
                      </div>
                    </div>
                    {result.traceUrl && (
                      <a
                        href={result.traceUrl}
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

          <div>
            <h2 className="text-xl font-semibold mb-4">Saved Sequences</h2>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : sequences.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  No sequences yet. Generate your first one above!
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {sequences.map((sequence: any) => (
                  <Card key={sequence.id} className="transition-all hover:shadow-md">
                    <CardHeader>
                      <div className="flex items-start gap-4">
                        <div className="rounded-lg bg-primary/10 p-3">
                          <Mail className="h-6 w-6 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <CardTitle className="text-lg truncate">{sequence.name}</CardTitle>
                          {sequence.segment_filters && (
                            <p className="text-sm text-muted-foreground mt-1">
                              {sequence.segment_filters.industry} • {sequence.segment_filters.geography}
                            </p>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Layers className="h-4 w-4" />
                          {sequence.steps?.length || 0} steps
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDelete(sequence.id)}
                          disabled={deleteMutation.isPending}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      {sequence.steps?.[0] && (
                        <div className="text-xs text-muted-foreground border-t pt-2">
                          <div className="font-medium">First email:</div>
                          <div className="truncate">{sequence.steps[0].subject}</div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
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
