import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Sparkles, TrendingUp, AlertCircle, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Company } from '@/lib/api/companies';

interface ProspectAnalyzerProps {
  companies: Company[];
  onAnalysisComplete?: () => void;
}

export function ProspectAnalyzer({ companies, onAnalysisComplete }: ProspectAnalyzerProps) {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const { toast } = useToast();

  const handleAnalyze = async () => {
    setIsAnalyzing(true);
    try {
      const companyIds = companies.map(c => c.id);
      
      const { data, error } = await supabase.functions.invoke('analyze-prospects', {
        body: { companyIds }
      });

      if (error) throw error;

      toast({
        title: 'Analysis Complete',
        description: `Analyzed ${data.analyzed} prospects and categorized them by temperature.`,
      });

      onAnalysisComplete?.();
    } catch (error) {
      console.error('Analysis error:', error);
      toast({
        title: 'Analysis Failed',
        description: error instanceof Error ? error.message : 'Failed to analyze prospects',
        variant: 'destructive',
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const unanalyzedCount = companies.filter(c => !c.temperature).length;
  const hotCount = companies.filter(c => c.temperature === 'hot').length;
  const warmCount = companies.filter(c => c.temperature === 'warm').length;
  const coldCount = companies.filter(c => c.temperature === 'cold').length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          AI Prospect Analyzer
        </CardTitle>
        <CardDescription>
          Automatically categorize prospects as Hot/Warm/Cold and get AI-powered next actions
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Unanalyzed</p>
            <p className="text-2xl font-bold">{unanalyzedCount}</p>
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-red-500" />
              <p className="text-sm text-muted-foreground">Hot</p>
            </div>
            <p className="text-2xl font-bold text-red-600">{hotCount}</p>
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-orange-500" />
              <p className="text-sm text-muted-foreground">Warm</p>
            </div>
            <p className="text-2xl font-bold text-orange-600">{warmCount}</p>
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-blue-500" />
              <p className="text-sm text-muted-foreground">Cold</p>
            </div>
            <p className="text-2xl font-bold text-blue-600">{coldCount}</p>
          </div>
        </div>

        <Button 
          onClick={handleAnalyze} 
          disabled={isAnalyzing || unanalyzedCount === 0}
          className="w-full"
        >
          {isAnalyzing ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Analyzing...
            </>
          ) : (
            <>
              <TrendingUp className="mr-2 h-4 w-4" />
              Analyze {unanalyzedCount} Prospects
            </>
          )}
        </Button>

        {unanalyzedCount === 0 && companies.length > 0 && (
          <div className="flex items-start gap-2 p-3 bg-muted rounded-lg">
            <AlertCircle className="h-4 w-4 mt-0.5 text-muted-foreground" />
            <div className="text-sm text-muted-foreground">
              <p className="font-medium">All prospects analyzed</p>
              <p className="text-xs mt-1">Companies are automatically re-analyzed when data changes significantly.</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function TemperatureBadge({ temperature }: { temperature?: 'hot' | 'warm' | 'cold' }) {
  if (!temperature) return null;

  const config = {
    hot: { label: 'Hot', className: 'bg-red-100 text-red-700 border-red-200' },
    warm: { label: 'Warm', className: 'bg-orange-100 text-orange-700 border-orange-200' },
    cold: { label: 'Cold', className: 'bg-blue-100 text-blue-700 border-blue-200' },
  };

  const { label, className } = config[temperature];

  return (
    <Badge variant="outline" className={className}>
      {label}
    </Badge>
  );
}

export function SuggestedActions({ actions }: { actions?: Array<{ action: string; priority: string; reason: string }> }) {
  if (!actions || actions.length === 0) return null;

  const priorityConfig = {
    high: 'text-red-600 bg-red-50',
    medium: 'text-orange-600 bg-orange-50',
    low: 'text-blue-600 bg-blue-50',
  };

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">Suggested Next Actions:</p>
      <div className="space-y-2">
        {actions.map((action, idx) => (
          <div key={idx} className="flex items-start gap-2 p-2 rounded-lg border bg-card">
            <Badge 
              variant="outline" 
              className={priorityConfig[action.priority as keyof typeof priorityConfig] || ''}
            >
              {action.priority}
            </Badge>
            <div className="flex-1 text-sm">
              <p className="font-medium">{action.action}</p>
              <p className="text-xs text-muted-foreground mt-1">{action.reason}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}