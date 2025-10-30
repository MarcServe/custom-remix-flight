import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Mail, Layers, Sparkles, Loader2, Send } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Sequences() {
  const [size, setSize] = useState("");
  const [geography, setGeography] = useState("");
  const [industry, setIndustry] = useState("");
  const [steps, setSteps] = useState("3");
  const [tone, setTone] = useState("professional");
  const [isGenerating, setIsGenerating] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: sequences, isLoading } = useQuery({
    queryKey: ["sequences"],
    queryFn: async () => {
      const { data } = await supabase
        .from("email_sequences")
        .select("*")
        .order("created_at", { ascending: false });
      return data || [];
    },
  });

  const handleGenerate = async () => {
    if (!size || !geography || !industry) {
      toast({
        title: "Missing fields",
        description: "Please fill in all segment criteria",
        variant: "destructive",
      });
      return;
    }

    setIsGenerating(true);

    try {
      const { data, error } = await supabase.functions.invoke("generate-sequence", {
        body: { size, geography, industry, steps: parseInt(steps), tone },
      });

      if (error) throw error;

      toast({
        title: "Sequence generated",
        description: `Created ${data.sequence.length}-step sequence: ${data.name}`,
      });

      queryClient.invalidateQueries({ queryKey: ["sequences"] });
      
      // Reset form
      setSize("");
      setGeography("");
      setIndustry("");
      setSteps("3");
      setTone("professional");
    } catch (error: any) {
      toast({
        title: "Generation failed",
        description: error.message || "Failed to generate sequence",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  if (isLoading) {
    return <div className="flex items-center justify-center h-96">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Email Sequences</h1>
        <p className="text-muted-foreground">AI-powered automated email campaigns</p>
      </div>

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
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
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
                placeholder="e.g., UK, US"
                value={geography}
                onChange={(e) => setGeography(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="seq-industry">Industry</Label>
              <Input
                id="seq-industry"
                placeholder="e.g., Fintech"
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="seq-tone">Tone</Label>
              <Select value={tone} onValueChange={setTone}>
                <SelectTrigger id="seq-tone">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="professional">Professional</SelectItem>
                  <SelectItem value="casual">Casual</SelectItem>
                  <SelectItem value="friendly">Friendly</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="space-y-2 flex-1">
              <Label htmlFor="seq-steps">Number of Steps</Label>
              <Select value={steps} onValueChange={setSteps}>
                <SelectTrigger id="seq-steps">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="2">2 steps</SelectItem>
                  <SelectItem value="3">3 steps</SelectItem>
                  <SelectItem value="4">4 steps</SelectItem>
                  <SelectItem value="5">5 steps</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button
              onClick={handleGenerate}
              disabled={isGenerating}
              className="mt-8"
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
          </div>
        </CardContent>
      </Card>

      <div>
        <h2 className="text-xl font-semibold mb-4">Your Sequences</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {sequences?.map((sequence) => (
            <Card key={sequence.id} className="transition-all hover:shadow-md">
              <CardHeader>
                <div className="flex items-start gap-4">
                  <div className="rounded-lg bg-primary/10 p-3">
                    <Mail className="h-6 w-6 text-primary" />
                  </div>
                  <div className="flex-1">
                    <CardTitle className="text-lg">{sequence.name}</CardTitle>
                    {sequence.segment_filters && typeof sequence.segment_filters === 'object' && (
                      <p className="text-sm text-muted-foreground mt-1">
                        {(sequence.segment_filters as any).industry} • {(sequence.segment_filters as any).geography}
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
                  <Button size="sm" variant="outline">
                    <Send className="h-4 w-4 mr-2" />
                    Preview
                  </Button>
                </div>
                {sequence.steps && Array.isArray(sequence.steps) && sequence.steps.length > 0 && (
                  <div className="text-xs text-muted-foreground border-t pt-2">
                    <div className="font-medium">First email:</div>
                    <div className="truncate">{(sequence.steps[0] as any).subject}</div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
