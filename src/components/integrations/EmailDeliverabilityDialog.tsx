import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface ContentAnalysis {
  score: number;
  issues: string[];
  recommendations: string[];
  spamRisk: 'low' | 'medium' | 'high';
}

interface EmailDeliverabilityDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EmailDeliverabilityDialog({
  open,
  onOpenChange,
}: EmailDeliverabilityDialogProps) {
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<ContentAnalysis | null>(null);
  const { toast } = useToast();

  const handleAnalyze = async () => {
    if (!subject.trim() || !body.trim()) {
      toast({
        title: "Missing content",
        description: "Please enter both subject and body",
        variant: "destructive",
      });
      return;
    }

    setIsAnalyzing(true);
    try {
      const { data, error } = await supabase.functions.invoke('check-email-deliverability', {
        body: {
          emailContent: {
            subject,
            body
          }
        }
      });

      if (error) throw error;

      setAnalysis(data.contentAnalysis);
      toast({
        title: "Analysis complete",
        description: `Your email scored ${data.contentScore}/100`,
      });
    } catch (error: any) {
      toast({
        title: "Analysis failed",
        description: error.message || "Unable to analyze email",
        variant: "destructive",
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-success";
    if (score >= 60) return "text-warning";
    return "text-destructive";
  };

  const getRiskBadge = (risk: string) => {
    switch (risk) {
      case 'low':
        return <Badge className="bg-success/10 text-success border-success/20">Low Risk ✓</Badge>;
      case 'medium':
        return <Badge className="bg-warning/10 text-warning border-warning/20">Medium Risk</Badge>;
      case 'high':
        return <Badge variant="destructive">High Risk</Badge>;
      default:
        return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Test Email Content</DialogTitle>
          <DialogDescription>
            Check your email for spam triggers and get tips to improve delivery
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="test-subject">Subject Line</Label>
            <Input
              id="test-subject"
              placeholder="Enter your email subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              disabled={isAnalyzing}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="test-body">Email Message</Label>
            <Textarea
              id="test-body"
              placeholder="Paste your email content here..."
              value={body}
              onChange={(e) => setBody(e.target.value)}
              disabled={isAnalyzing}
              rows={6}
              className="resize-none"
            />
          </div>

          <Button
            onClick={handleAnalyze}
            disabled={isAnalyzing || !subject.trim() || !body.trim()}
            className="w-full"
          >
            {isAnalyzing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Analyzing...
              </>
            ) : (
              'Check Email'
            )}
          </Button>

          {analysis && (
            <div className="space-y-4 pt-4 border-t">
              <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                <div>
                  <div className="text-sm text-muted-foreground">Score</div>
                  <div className={`text-3xl font-bold ${getScoreColor(analysis.score)}`}>
                    {analysis.score}/100
                  </div>
                </div>
                {getRiskBadge(analysis.spamRisk)}
              </div>

              {analysis.issues.length > 0 && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <div className="font-medium mb-2">Things to fix:</div>
                    <ul className="list-disc pl-4 space-y-1 text-sm">
                      {analysis.issues.map((issue, index) => (
                        <li key={index}>{issue}</li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}

              {analysis.recommendations.length > 0 && (
                <Alert className="border-success/50 bg-success/5">
                  <CheckCircle2 className="h-4 w-4 text-success" />
                  <AlertDescription>
                    <div className="font-medium mb-2">What's working well:</div>
                    <ul className="space-y-1 text-sm">
                      {analysis.recommendations.map((rec, index) => (
                        <li key={index}>✓ {rec}</li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}

              <div className="text-xs text-muted-foreground bg-muted/30 p-3 rounded">
                <strong>Quick tips:</strong>
                <ul className="list-disc pl-4 mt-1 space-y-1">
                  <li>Avoid spam words like "free", "guaranteed", "click now"</li>
                  <li>Keep subjects short (30-50 characters)</li>
                  <li>Don't use ALL CAPS or too many exclamation marks!!!</li>
                  <li>Personalize with names when possible</li>
                  <li>Limit links (5 or fewer is best)</li>
                </ul>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
