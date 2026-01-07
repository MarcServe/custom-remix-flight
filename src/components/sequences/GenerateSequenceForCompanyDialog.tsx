import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Sparkles, Mail, TrendingUp } from "lucide-react";
import { useGenerateSequence } from "@/hooks/use-sequences";
import { useProviderStore } from "@/stores/provider-store";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";

interface GenerateSequenceForCompanyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string;
  companyName: string;
  companyDescription?: string;
  companySize?: string;
  companyGeography?: string;
  companyIndustry?: string;
}

export function GenerateSequenceForCompanyDialog({
  open,
  onOpenChange,
  companyId,
  companyName,
  companyDescription,
  companySize,
  companyGeography,
  companyIndustry,
}: GenerateSequenceForCompanyDialogProps) {
  const [size, setSize] = useState(companySize || "");
  const [geography, setGeography] = useState(companyGeography || "");
  const [industry, setIndustry] = useState(companyIndustry || "");
  const [steps, setSteps] = useState("3");
  const [tone, setTone] = useState<"professional" | "casual" | "technical">("professional");
  const [customInstructions, setCustomInstructions] = useState("");

  const { defaultProvider, defaultModels } = useProviderStore();
  const [providerConfig, setProviderConfig] = useState({
    provider: defaultProvider,
    model: defaultModels[defaultProvider] as string | undefined,
  });

  const generateMutation = useGenerateSequence();
  const { toast } = useToast();

  // Update form when company data changes
  useEffect(() => {
    setSize(companySize || "");
    setGeography(companyGeography || "");
    setIndustry(companyIndustry || "");
    
    // Build context-aware custom instructions
    if (companyDescription) {
      const baseInstructions = `Generate a personalized sequence for ${companyName}. Company context: ${companyDescription}`;
      setCustomInstructions(baseInstructions);
    }
  }, [companyName, companyDescription, companySize, companyGeography, companyIndustry]);

  // Sync provider config with store changes
  useEffect(() => {
    setProviderConfig({
      provider: defaultProvider,
      model: defaultModels[defaultProvider] as string | undefined,
    });
  }, [defaultProvider, defaultModels]);

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
    });

    if (data) {
      toast({
        title: "Sequence Generated!",
        description: `Created a ${data.sequence.length}-step sequence for ${companyName}. View it in the Sequences page.`,
      });
      onOpenChange(false);
      
      // Reset form
      setSteps("3");
      setTone("professional");
      setCustomInstructions("");
    }
  };

  const isFormValid = size && geography && industry;
  const isGenerating = generateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Sparkles className="h-5 w-5 text-primary" />
            Generate Sequence for {companyName}
          </DialogTitle>
          <DialogDescription>
            Create a personalized AI-generated email sequence tailored to this company's profile.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-4">
          {/* Company Context Badge */}
          <div className="rounded-lg bg-primary/5 p-3 border border-primary/10">
            <p className="text-xs font-medium text-muted-foreground mb-2">Company Context</p>
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">{companyName}</Badge>
              {companyIndustry && <Badge variant="outline">{companyIndustry}</Badge>}
              {companySize && <Badge variant="outline">{companySize}</Badge>}
              {companyGeography && <Badge variant="outline">{companyGeography}</Badge>}
            </div>
          </div>

          {/* Sequence Configuration */}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="comp-size" className="text-sm font-medium">
                Company Size
              </Label>
              <Select value={size} onValueChange={setSize}>
                <SelectTrigger id="comp-size" className="h-10">
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
              <Label htmlFor="comp-geography" className="text-sm font-medium">
                Geography
              </Label>
              <Input
                id="comp-geography"
                placeholder="e.g., United Kingdom, US"
                value={geography}
                onChange={(e) => setGeography(e.target.value)}
                className="h-10"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="comp-industry" className="text-sm font-medium">
                Industry
              </Label>
              <Input
                id="comp-industry"
                placeholder="e.g., Fintech, SaaS"
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
                className="h-10"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="comp-tone" className="text-sm font-medium">
                Tone
              </Label>
              <Select value={tone} onValueChange={(v) => setTone(v as any)}>
                <SelectTrigger id="comp-tone" className="h-10">
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
            <Label htmlFor="comp-steps" className="text-sm font-medium">
              Number of Steps
            </Label>
            <Select value={steps} onValueChange={setSteps}>
              <SelectTrigger id="comp-steps" className="h-10">
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
            <Label htmlFor="comp-instructions" className="text-sm font-medium">
              Custom Instructions
            </Label>
            <Textarea
              id="comp-instructions"
              placeholder="Add specific instructions for this sequence..."
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
            <Label htmlFor="comp-provider" className="text-sm font-medium">
              AI Provider
            </Label>
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
              <SelectTrigger id="comp-provider" className="h-10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="openai">
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4" />
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
            <Label htmlFor="comp-model" className="text-sm font-medium">
              Model
            </Label>
            <Select
              value={providerConfig.model}
              onValueChange={(value) => setProviderConfig({ ...providerConfig, model: value })}
            >
              <SelectTrigger id="comp-model" className="h-10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
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

        <div className="flex gap-2 justify-end pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isGenerating}>
            Cancel
          </Button>
          <Button onClick={handleGenerate} disabled={!isFormValid || isGenerating}>
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                Generate Sequence
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
