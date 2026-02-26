import { useState, useMemo } from "react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Mail, Layers, Clock, Calendar, Copy, TrendingUp, Edit2, Save, X, Sparkles, RefreshCw, Loader2, Palette } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { useUpdateSequence } from "@/hooks/use-sequences";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";

interface SequenceStep {
  subject: string;
  body: string;
  delayDays?: number;
  automation_rule?: {
    type: 'wait_for_open' | 'wait_for_click' | 'time_based' | 'none';
    wait_hours?: number;
  };
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
    use_email_branding?: boolean;
  };
}

export function SequenceDetailsDialog({
  open,
  onOpenChange,
  sequence,
}: SequenceDetailsDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editMode, setEditMode] = useState(false);
  const [editedSteps, setEditedSteps] = useState<SequenceStep[]>([]);
  const [editingInstructions, setEditingInstructions] = useState(false);
  const [customInstructions, setCustomInstructions] = useState(sequence.custom_instructions || '');
  const [useEmailBranding, setUseEmailBranding] = useState(sequence.use_email_branding !== false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const updateSequence = useUpdateSequence();

  // Reset state when sequence changes
  useMemo(() => {
    setCustomInstructions(sequence.custom_instructions || '');
    setEditingInstructions(false);
    setUseEmailBranding(sequence.use_email_branding !== false);
  }, [sequence.id, sequence.custom_instructions, sequence.use_email_branding]);

  const copyToClipboard = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied!",
      description: `${type} copied to clipboard`,
    });
  };

  // Parse steps - they may be stored as JSON strings in the database
  const steps = useMemo(() => {
    if (!sequence.steps || sequence.steps.length === 0) return [];
    
    return sequence.steps.map(step => {
      // If step is a string, parse it
      if (typeof step === 'string') {
        try {
          return JSON.parse(step);
        } catch (e) {
          console.error('Failed to parse step:', e);
          return step;
        }
      }
      // Already an object
      return step;
    });
  }, [sequence.steps]);

  const handleEditClick = () => {
    setEditedSteps(JSON.parse(JSON.stringify(steps)));
    setEditMode(true);
  };

  const handleCancelEdit = () => {
    setEditMode(false);
    setEditedSteps([]);
  };

  const handleSave = async () => {
    try {
      await updateSequence.mutateAsync({
        id: sequence.id,
        updates: { steps: editedSteps },
      });
      setEditMode(false);
      toast({
        title: "Success",
        description: "Sequence updated successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update sequence",
        variant: "destructive",
      });
    }
  };

  const handleSaveInstructions = async () => {
    try {
      await updateSequence.mutateAsync({
        id: sequence.id,
        updates: { custom_instructions: customInstructions },
      });
      setEditingInstructions(false);
      toast({
        title: "Success",
        description: "Custom instructions saved",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save instructions",
        variant: "destructive",
      });
    }
  };

  const handleRegenerateSequence = async () => {
    setIsRegenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-sequence', {
        body: {
          size: sequence.segment_filters?.size || 'Any',
          geography: sequence.segment_filters?.geography || 'Any',
          industry: sequence.segment_filters?.industry || 'Any',
          customInstructions: customInstructions,
          steps: steps.length || 4,
        }
      });

      if (error) throw error;

      if (data?.sequence) {
        // Update the sequence with the new steps
        await updateSequence.mutateAsync({
          id: sequence.id,
          updates: { 
            steps: data.sequence,
            custom_instructions: customInstructions,
          },
        });
        
        // Invalidate queries to refresh data
        queryClient.invalidateQueries({ queryKey: ['sequences'] });
        
        toast({
          title: "Sequence Regenerated!",
          description: `Updated ${data.sequence.length} email steps with new instructions`,
        });
        setEditingInstructions(false);
      }
    } catch (error) {
      console.error('Error regenerating sequence:', error);
      toast({
        title: "Error",
        description: "Failed to regenerate sequence",
        variant: "destructive",
      });
    } finally {
      setIsRegenerating(false);
    }
  };

  const updateStep = (idx: number, field: string, value: any) => {
    const updated = [...editedSteps];
    if (field === 'automation_rule.type') {
      updated[idx].automation_rule = {
        ...updated[idx].automation_rule,
        type: value,
        wait_hours: updated[idx].automation_rule?.wait_hours || 24,
      };
    } else if (field === 'automation_rule.wait_hours') {
      updated[idx].automation_rule = {
        ...updated[idx].automation_rule!,
        wait_hours: parseInt(value) || 0,
      };
    } else {
      updated[idx] = { ...updated[idx], [field]: value };
    }
    setEditedSteps(updated);
  };

  const displaySteps = editMode ? editedSteps : steps;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[90vh] flex flex-col overflow-hidden p-0">
        <DialogHeader className="shrink-0 px-6 pt-6 pb-4 border-b">
          <div className="flex items-center justify-between">
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
            <div className="flex gap-2">
              {!editMode ? (
                <Button onClick={handleEditClick} variant="outline">
                  <Edit2 className="h-4 w-4 mr-2" />
                  Edit Steps
                </Button>
              ) : (
                <>
                  <Button onClick={handleCancelEdit} variant="outline">
                    <X className="h-4 w-4 mr-2" />
                    Cancel
                  </Button>
                  <Button onClick={handleSave} disabled={updateSequence.isPending}>
                    <Save className="h-4 w-4 mr-2" />
                    {updateSequence.isPending ? "Saving..." : "Save Changes"}
                  </Button>
                </>
              )}
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

            {/* Custom Instructions - Always show with edit capability */}
            <Card className="bg-muted/50 border-dashed">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-primary" />
                    Custom Instructions
                  </CardTitle>
                  {!editingInstructions ? (
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => setEditingInstructions(true)}
                    >
                      <Edit2 className="h-3 w-3 mr-1" />
                      Edit
                    </Button>
                  ) : (
                    <div className="flex gap-2">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => {
                          setEditingInstructions(false);
                          setCustomInstructions(sequence.custom_instructions || '');
                        }}
                      >
                        Cancel
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={handleSaveInstructions}
                        disabled={updateSequence.isPending}
                      >
                        <Save className="h-3 w-3 mr-1" />
                        Save
                      </Button>
                      <Button 
                        size="sm" 
                        onClick={handleRegenerateSequence}
                        disabled={isRegenerating}
                      >
                        {isRegenerating ? (
                          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                        ) : (
                          <RefreshCw className="h-3 w-3 mr-1" />
                        )}
                        Regenerate
                      </Button>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {editingInstructions ? (
                  <div className="space-y-2">
                    <Textarea
                      value={customInstructions}
                      onChange={(e) => setCustomInstructions(e.target.value)}
                      placeholder="e.g., Focus on ROI and cost savings, mention our 30-day free trial, use specific industry terminology..."
                      className="min-h-[100px]"
                    />
                    <p className="text-xs text-muted-foreground">
                      Edit instructions and click "Save" to update, or "Regenerate" to create new email content with these instructions.
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {sequence.custom_instructions || 'No custom instructions set. Click Edit to add instructions for this sequence.'}
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Email branding - match campaigns for consistent look */}
            <Card className="bg-muted/50 border-dashed">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Palette className="h-4 w-4 text-primary" />
                  Email branding template
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium">Use email branding template</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Wrap sequence emails in your logo, footer, and style so recipients recognize your brand (same as campaigns).
                    </p>
                  </div>
                  <Switch
                    checked={useEmailBranding}
                    onCheckedChange={async (checked) => {
                      setUseEmailBranding(checked);
                      try {
                        await updateSequence.mutateAsync({
                          id: sequence.id,
                          updates: { use_email_branding: checked },
                        });
                        toast({
                          title: "Saved",
                          description: checked ? "Sequence emails will use your branding template." : "Sequence emails will be sent as plain content.",
                        });
                      } catch {
                        setUseEmailBranding(!checked);
                        toast({
                          title: "Error",
                          description: "Failed to update setting",
                          variant: "destructive",
                        });
                      }
                    }}
                  />
                </div>
              </CardContent>
            </Card>

            <Separator />

            {/* Sequence Steps */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Layers className="h-5 w-5 text-primary" />
                <h3 className="text-lg font-semibold">Email Steps</h3>
                {editMode && (
                  <Badge variant="secondary" className="ml-2">Edit Mode</Badge>
                )}
              </div>

              {displaySteps.map((step, idx) => (
                <Card key={idx} className={`border-2 transition-all ${editMode ? 'border-primary' : 'hover:border-primary/50'}`}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-gradient-primary flex items-center justify-center">
                          <span className="text-white font-bold">{idx + 1}</span>
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge variant="outline" className="font-mono text-xs">
                              Step {idx + 1}
                            </Badge>
                          </div>
                          {editMode ? (
                            <Input
                              value={step.subject}
                              onChange={(e) => updateStep(idx, 'subject', e.target.value)}
                              className="font-semibold"
                              placeholder="Email subject"
                            />
                          ) : (
                            <CardTitle className="text-base font-semibold">{step.subject}</CardTitle>
                          )}
                        </div>
                      </div>
                      {!editMode && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copyToClipboard(step.subject, "Subject")}
                          className="shrink-0"
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Email Body */}
                    {editMode ? (
                      <div className="space-y-2">
                        <Label>Email Body</Label>
                        <Textarea
                          value={step.body}
                          onChange={(e) => updateStep(idx, 'body', e.target.value)}
                          className="min-h-[150px] font-mono text-sm"
                          placeholder="Email body"
                        />
                      </div>
                    ) : (
                      <div className="rounded-lg border bg-muted/50 p-4">
                        <div className="prose prose-sm max-w-none">
                          <div className="whitespace-pre-wrap text-sm leading-relaxed">
                            {step.body}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Delay and Automation Settings */}
                    {editMode ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t">
                        <div className="space-y-2">
                          <Label htmlFor={`delay-${idx}`}>Delay Days</Label>
                          <Input
                            id={`delay-${idx}`}
                            type="number"
                            min="0"
                            value={step.delayDays || 0}
                            onChange={(e) => updateStep(idx, 'delayDays', parseInt(e.target.value) || 0)}
                            placeholder="0"
                          />
                          <p className="text-xs text-muted-foreground">Days to wait before sending this step</p>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor={`automation-${idx}`}>Automation Rule</Label>
                          <Select
                            value={step.automation_rule?.type || 'none'}
                            onValueChange={(value) => updateStep(idx, 'automation_rule.type', value)}
                          >
                            <SelectTrigger id={`automation-${idx}`}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">No automation</SelectItem>
                              <SelectItem value="time_based">Time-based (use delay)</SelectItem>
                              <SelectItem value="wait_for_open">Wait for open</SelectItem>
                              <SelectItem value="wait_for_click">Wait for click</SelectItem>
                            </SelectContent>
                          </Select>
                          {step.automation_rule?.type && step.automation_rule.type !== 'none' && step.automation_rule.type !== 'time_based' && (
                            <div className="space-y-2 mt-2">
                              <Label htmlFor={`wait-hours-${idx}`}>Wait Hours</Label>
                              <Input
                                id={`wait-hours-${idx}`}
                                type="number"
                                min="1"
                                value={step.automation_rule.wait_hours || 24}
                                onChange={(e) => updateStep(idx, 'automation_rule.wait_hours', e.target.value)}
                                placeholder="24"
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="flex gap-2 pt-2">
                        {step.delayDays !== undefined && step.delayDays > 0 && (
                          <Badge variant="secondary" className="text-xs">
                            <Clock className="h-3 w-3 mr-1" />
                            {step.delayDays}d delay
                          </Badge>
                        )}
                        {step.automation_rule && step.automation_rule.type !== 'none' && (
                          <Badge variant="outline" className="text-xs">
                            {step.automation_rule.type === 'time_based' && 'Time-based'}
                            {step.automation_rule.type === 'wait_for_open' && `Wait for open (${step.automation_rule.wait_hours}h)`}
                            {step.automation_rule.type === 'wait_for_click' && `Wait for click (${step.automation_rule.wait_hours}h)`}
                          </Badge>
                        )}
                      </div>
                    )}

                    {!editMode && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copyToClipboard(step.body, "Email body")}
                        className="w-full"
                      >
                        <Copy className="h-4 w-4 mr-2" />
                        Copy Email Body
                      </Button>
                    )}
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
