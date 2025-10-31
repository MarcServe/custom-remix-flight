import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Mail, Layers, Clock, Calendar, Copy, TrendingUp } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

interface SequenceStep {
  subject: string;
  body: string;
  delay_days?: number;
}

interface SequenceDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sequence: {
    id: string;
    name: string;
    steps?: SequenceStep[];
    segment_filters?: {
      industry?: string;
      geography?: string;
      size?: string;
    };
    provider?: string;
    model?: string;
    created_at?: string;
    custom_instructions?: string;
  };
}

export function SequenceDetailsDialog({
  open,
  onOpenChange,
  sequence,
}: SequenceDetailsDialogProps) {
  const { toast } = useToast();

  const copyToClipboard = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied!",
      description: `${type} copied to clipboard`,
    });
  };

  const steps = sequence.steps || [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[90vh] flex flex-col overflow-hidden p-0">
        <DialogHeader className="shrink-0 px-6 pt-6 pb-4 border-b">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg bg-gradient-primary flex items-center justify-center">
              <Mail className="h-6 w-6 text-white" />
            </div>
            <div>
              <DialogTitle className="text-2xl">{sequence.name}</DialogTitle>
              <DialogDescription className="text-sm mt-1">
                {steps.length}-step email sequence
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1">
          <div className="px-6 py-4 space-y-6">
            {/* Sequence Metadata */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {sequence.segment_filters?.industry && (
                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground uppercase tracking-wide">Industry</div>
                  <div className="text-sm font-semibold">{sequence.segment_filters.industry}</div>
                </div>
              )}
              {sequence.segment_filters?.geography && (
                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground uppercase tracking-wide">Geography</div>
                  <div className="text-sm font-semibold">{sequence.segment_filters.geography}</div>
                </div>
              )}
              {sequence.segment_filters?.size && (
                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground uppercase tracking-wide">Company Size</div>
                  <div className="text-sm font-semibold">{sequence.segment_filters.size}</div>
                </div>
              )}
              {sequence.created_at && (
                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground uppercase tracking-wide">Created</div>
                  <div className="text-sm font-semibold">
                    {format(new Date(sequence.created_at), "MMM d, yyyy")}
                  </div>
                </div>
              )}
            </div>

            {/* Custom Instructions */}
            {sequence.custom_instructions && (
              <Card className="bg-muted/50">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Custom Instructions</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{sequence.custom_instructions}</p>
                </CardContent>
              </Card>
            )}

            <Separator />

            {/* Sequence Steps */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Layers className="h-5 w-5 text-primary" />
                <h3 className="text-lg font-semibold">Email Steps</h3>
              </div>

              {steps.map((step, idx) => (
                <Card key={idx} className="border-2 hover:border-primary/50 transition-all">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-gradient-primary flex items-center justify-center">
                          <span className="text-white font-bold">{idx + 1}</span>
                        </div>
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant="outline" className="font-mono text-xs">
                              Step {idx + 1}
                            </Badge>
                            {step.delay_days !== undefined && step.delay_days > 0 && (
                              <Badge variant="secondary" className="text-xs">
                                <Clock className="h-3 w-3 mr-1" />
                                {step.delay_days}d delay
                              </Badge>
                            )}
                          </div>
                          <CardTitle className="text-base font-semibold">{step.subject}</CardTitle>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyToClipboard(step.subject, "Subject")}
                        className="shrink-0"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="rounded-lg border bg-muted/50 p-4">
                      <div className="prose prose-sm max-w-none">
                        <div className="whitespace-pre-wrap text-sm leading-relaxed">
                          {step.body}
                        </div>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyToClipboard(step.body, "Email body")}
                      className="w-full"
                    >
                      <Copy className="h-4 w-4 mr-2" />
                      Copy Email Body
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* AI Generation Details */}
            {(sequence.provider || sequence.model) && (
              <>
                <Separator />
                <Card className="bg-primary/5">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-primary" />
                      Generation Details
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4">
                      {sequence.provider && (
                        <div className="space-y-1">
                          <div className="text-xs text-muted-foreground uppercase tracking-wide">Provider</div>
                          <div className="text-sm font-semibold capitalize">{sequence.provider}</div>
                        </div>
                      )}
                      {sequence.model && (
                        <div className="space-y-1">
                          <div className="text-xs text-muted-foreground uppercase tracking-wide">Model</div>
                          <div className="text-sm font-semibold">{sequence.model}</div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
