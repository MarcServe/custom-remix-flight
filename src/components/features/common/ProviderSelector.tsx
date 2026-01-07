import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Sparkles, TrendingUp } from 'lucide-react';

export interface ProviderConfig {
  provider: 'openai' | 'perplexity';
  model?: string;
}

interface ProviderSelectorProps {
  value: ProviderConfig;
  onChange: (value: ProviderConfig) => void;
  showCost?: boolean;
}

const MODELS: Record<string, Array<{ value: string; label: string; description: string }>> = {
  openai: [
    { value: 'gpt-4o-mini', label: 'GPT-4o Mini', description: 'Fast & efficient' },
    { value: 'gpt-4o', label: 'GPT-4o', description: 'Most capable' },
  ],
  perplexity: [
    { value: 'sonar', label: 'Sonar', description: 'Fast with online search' },
    { value: 'sonar-pro', label: 'Sonar Pro', description: 'Most capable with search' },
  ],
};

export function ProviderSelector({ value, onChange, showCost = false }: ProviderSelectorProps) {
  const currentModels = MODELS[value.provider] || MODELS.openai;
  const getDefaultModel = (provider: 'openai' | 'perplexity') => {
    if (provider === 'perplexity') return 'sonar';
    return 'gpt-4o-mini';
  };
  const defaultModel = getDefaultModel(value.provider);

  const handleProviderChange = (newProvider: 'openai' | 'perplexity') => {
    onChange({
      provider: newProvider,
      model: MODELS[newProvider][0].value,
    });
  };

  const handleModelChange = (newModel: string) => {
    onChange({
      ...value,
      model: newModel,
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          AI Provider
        </CardTitle>
        <CardDescription>
          Choose which AI provider to use for generating content
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3">
          <Label>Provider</Label>
          <RadioGroup
            value={value.provider}
            onValueChange={handleProviderChange}
            className="grid grid-cols-1 gap-3"
          >
            <div className="flex items-center space-x-3 rounded-lg border p-4 cursor-pointer hover:bg-accent/50 transition-colors">
              <RadioGroupItem value="openai" id="openai" />
              <Label htmlFor="openai" className="flex-1 cursor-pointer">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold">OpenAI</div>
                    <div className="text-sm text-muted-foreground">GPT models</div>
                  </div>
                  <Badge variant="secondary" className="ml-2">
                    <Sparkles className="h-3 w-3 mr-1" />
                    Advanced
                  </Badge>
                </div>
              </Label>
            </div>

            <div className="flex items-center space-x-3 rounded-lg border p-4 cursor-pointer hover:bg-accent/50 transition-colors">
              <RadioGroupItem value="perplexity" id="perplexity" />
              <Label htmlFor="perplexity" className="flex-1 cursor-pointer">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold">Perplexity</div>
                    <div className="text-sm text-muted-foreground">Real-time search</div>
                  </div>
                  <Badge variant="secondary" className="ml-2">
                    <TrendingUp className="h-3 w-3 mr-1" />
                    Online
                  </Badge>
                </div>
              </Label>
            </div>
          </RadioGroup>
        </div>

        <div className="space-y-2">
          <Label htmlFor="model">Model</Label>
          <Select
            value={value.model || defaultModel}
            onValueChange={handleModelChange}
          >
            <SelectTrigger id="model">
              <SelectValue placeholder="Select model" />
            </SelectTrigger>
            <SelectContent>
              {currentModels.map((model) => (
                <SelectItem key={model.value} value={model.value}>
                  <div className="flex flex-col">
                    <span className="font-medium">{model.label}</span>
                    <span className="text-xs text-muted-foreground">
                      {model.description}
                    </span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {showCost && (
          <div className="rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">
            <p className="font-medium mb-1">Cost Estimate</p>
            <p className="text-xs">
              {value.provider === 'perplexity'
                ? 'Perplexity API costs will apply (includes real-time search)'
                : 'OpenAI API costs will apply based on usage'}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
