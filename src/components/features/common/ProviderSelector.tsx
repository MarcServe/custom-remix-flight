import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Zap } from 'lucide-react';

interface ProviderConfig {
  provider: 'lovable' | 'openai';
  model?: string;
}

interface ProviderSelectorProps {
  value: ProviderConfig;
  onChange: (value: ProviderConfig) => void;
  showCost?: boolean;
}

const MODELS = {
  lovable: [
    { value: 'google/gemini-2.5-flash', label: 'Gemini 2.5 Flash', description: 'Fast & balanced' },
    { value: 'google/gemini-2.5-pro', label: 'Gemini 2.5 Pro', description: 'Most powerful' },
    { value: 'google/gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash Lite', description: 'Fastest & cheapest' },
  ],
  openai: [
    { value: 'gpt-4o-mini', label: 'GPT-4o Mini', description: 'Fast & efficient' },
    { value: 'gpt-4o', label: 'GPT-4o', description: 'Most capable' },
  ],
};

export function ProviderSelector({ value, onChange, showCost = false }: ProviderSelectorProps) {
  const currentModels = MODELS[value.provider];
  const defaultModel = value.provider === 'lovable' 
    ? 'google/gemini-2.5-flash' 
    : 'gpt-4o-mini';

  const handleProviderChange = (newProvider: 'lovable' | 'openai') => {
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
              <RadioGroupItem value="lovable" id="lovable" />
              <Label htmlFor="lovable" className="flex-1 cursor-pointer">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold">Lovable AI</div>
                    <div className="text-sm text-muted-foreground">Google Gemini models</div>
                  </div>
                  <Badge variant="secondary" className="ml-2">
                    <Zap className="h-3 w-3 mr-1" />
                    Fast
                  </Badge>
                </div>
              </Label>
            </div>

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
              {value.provider === 'lovable'
                ? 'Lovable AI credits will be used for this request'
                : 'OpenAI API costs will apply based on usage'}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
