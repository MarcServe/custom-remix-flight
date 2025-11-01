import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Mail, AlertCircle, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface ContentAnalysis {
  score: number;
  issues: string[];
  recommendations: string[];
  spamRisk: 'low' | 'medium' | 'high';
}

export function EmailDeliverabilityChecker() {
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
        description: `Deliverability score: ${data.contentScore}/100`,
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
    if (score >= 80) return "text-green-600";
    if (score >= 60) return "text-yellow-600";
    return "text-red-600";
  };

  const getRiskBadge = (risk: string) => {
    switch (risk) {
      case 'low':
        return <Badge className="bg-green-100 text-green-800">Low Risk</Badge>;
      case 'medium':
        return <Badge className="bg-yellow-100 text-yellow-800">Medium Risk</Badge>;
      case 'high':
        return <Badge variant="destructive">High Risk</Badge>;
      default:
        return null;
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Mail className="h-5 w-5" />
          <CardTitle>Email Deliverability Checker</CardTitle>
        </div>
        <CardDescription>
          Analyze your email content for spam triggers and deliverability issues
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="check-subject">Subject Line</Label>
          <Input
            id="check-subject"
            placeholder="Enter your email subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            disabled={isAnalyzing}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="check-body">Email Body</Label>
          <Textarea
            id="check-body"
            placeholder="Paste your email content here..."
            value={body}
            onChange={(e) => setBody(e.target.value)}
            disabled={isAnalyzing}
            rows={8}
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
            'Analyze Deliverability'
          )}
        </Button>

        {analysis && (
          <div className="space-y-4 pt-4 border-t">
            <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
              <div>
                <div className="text-sm text-muted-foreground">Content Score</div>
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
                  <div className="font-medium mb-2">Issues Found:</div>
                  <ul className="list-disc pl-4 space-y-1 text-sm">
                    {analysis.issues.map((issue, index) => (
                      <li key={index}>{issue}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            {analysis.recommendations.length > 0 && (
              <Alert>
                <CheckCircle2 className="h-4 w-4" />
                <AlertDescription>
                  <div className="font-medium mb-2">Good Practices:</div>
                  <ul className="space-y-1 text-sm">
                    {analysis.recommendations.map((rec, index) => (
                      <li key={index}>{rec}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            <div className="text-xs text-muted-foreground">
              <strong>Tips to improve:</strong>
              <ul className="list-disc pl-4 mt-1 space-y-1">
                <li>Avoid spam trigger words like "free", "guaranteed", "act now"</li>
                <li>Keep subject lines between 30-50 characters</li>
                <li>Don't use ALL CAPS or excessive punctuation!!!</li>
                <li>Include an unsubscribe option</li>
                <li>Personalize with recipient's name</li>
                <li>Limit the number of links (5 or fewer)</li>
              </ul>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
