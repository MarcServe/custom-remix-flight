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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Mail, Layers, Clock, Calendar, Copy, TrendingUp, Edit2, Save, X, Sparkles, RefreshCw, Loader2, Palette, Repeat, FileText, ChevronDown } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { useUpdateSequence } from "@/hooks/use-sequences";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";

interface SequenceStep {
  subject: string;
  body: string;
  description?: string;
  delayDays?: number;
  automation_rule?: {
    type: 'wait_for_open' | 'wait_for_click' | 'time_based' | 'none' | 'no_open' | 'opened_not_clicked' | 'clicked_not_replied' | 'no_reply_after_open';
    wait_hours?: number;
  };
}

interface SequenceDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called with the updated sequence after a successful save so the parent can refresh (e.g. update selected sequence). */
  onSequenceUpdated?: (updated: { id: string; name: string; [key: string]: unknown }) => void;
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
    repeat_sequence?: boolean;
    repeat_after_days?: number;
    repeat_only_for?: string;
    description?: string | null;
  };
}

const REPEAT_ONLY_FOR_OPTIONS: { value: string; label: string }[] = [
  { value: 'all', label: 'Everyone (no filter)' },
  { value: 'not_opened', label: 'Not opened at all' },
  { value: 'opened_not_clicked', label: 'Opened but not clicked' },
  { value: 'clicked_not_replied', label: 'Clicked but no reply' },
  { value: 'no_reply', label: 'No reply (any engagement)' },
];

function parseRepeatOnlyFor(raw: string | undefined): string[] {
  if (!raw || !raw.trim()) return ['no_reply'];
  const s = raw.trim();
  if (s.startsWith('[')) {
    try {
      const arr = JSON.parse(s);
      return Array.isArray(arr) ? arr.filter((x: unknown) => typeof x === 'string') : [s];
    } catch {
      return [s];
    }
  }
  return [s];
}

function serializeRepeatOnlyFor(options: string[]): string {
  if (options.length === 0) return 'no_reply';
  if (options.length === 1) return options[0];
  return JSON.stringify(options);
}

export function SequenceDetailsDialog({
  open,
  onOpenChange,
  onSequenceUpdated,
  sequence,
}: SequenceDetailsDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editMode, setEditMode] = useState(false);
  const [editedSteps, setEditedSteps] = useState<SequenceStep[]>([]);
  const [editingInstructions, setEditingInstructions] = useState(false);
  const [customInstructions, setCustomInstructions] = useState(sequence.custom_instructions || '');
  const [useEmailBranding, setUseEmailBranding] = useState(sequence.use_email_branding !== false);
  const [repeatSequence, setRepeatSequence] = useState(sequence.repeat_sequence === true);
  const [repeatAfterDays, setRepeatAfterDays] = useState(Math.max(1, Math.min(30, sequence.repeat_after_days ?? 5)));
  const [repeatOnlyForOptions, setRepeatOnlyForOptions] = useState<string[]>(() =>
    parseRepeatOnlyFor(sequence.repeat_only_for)
  );
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [editedName, setEditedName] = useState(sequence.name || '');
  const [editingDescription, setEditingDescription] = useState(false);
  const [description, setDescription] = useState(sequence.description ?? '');
  const [editingMetadata, setEditingMetadata] = useState(false);
  const [metadataIndustry, setMetadataIndustry] = useState(sequence.segment_filters?.industry ?? '');
  const [metadataGeography, setMetadataGeography] = useState(sequence.segment_filters?.geography ?? '');
  const [metadataSize, setMetadataSize] = useState(sequence.segment_filters?.size ?? '');
  const updateSequence = useUpdateSequence();

  // Reset state when sequence changes
  useMemo(() => {
    setCustomInstructions(sequence.custom_instructions || '');
    setEditingInstructions(false);
    setUseEmailBranding(sequence.use_email_branding !== false);
    setRepeatSequence(sequence.repeat_sequence === true);
    setRepeatAfterDays(Math.max(1, Math.min(30, sequence.repeat_after_days ?? 5)));
    setRepeatOnlyForOptions(parseRepeatOnlyFor(sequence.repeat_only_for));
    setEditedName(sequence.name || '');
    setDescription(sequence.description ?? '');
    setMetadataIndustry(sequence.segment_filters?.industry ?? '');
    setMetadataGeography(sequence.segment_filters?.geography ?? '');
    setMetadataSize(sequence.segment_filters?.size ?? '');
  }, [sequence.id, sequence.custom_instructions, sequence.use_email_branding, sequence.repeat_sequence, sequence.repeat_after_days, sequence.repeat_only_for, sequence.name, sequence.description, sequence.segment_filters]);

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
      const result = await updateSequence.mutateAsync({
        id: sequence.id,
        updates: { steps: editedSteps },
      });
      setEditMode(false);
      if (result?.data && onSequenceUpdated) onSequenceUpdated(result.data as { id: string; name: string; [key: string]: unknown });
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
      const result = await updateSequence.mutateAsync({
        id: sequence.id,
        updates: { custom_instructions: customInstructions },
      });
      setEditingInstructions(false);
      if (result?.data && onSequenceUpdated) onSequenceUpdated(result.data as { id: string; name: string; [key: string]: unknown });
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
              <div className="min-w-0 flex-1">
                {editingName ? (
                  <Input
                    value={editedName}
                    onChange={(e) => setEditedName(e.target.value)}
                    onBlur={async () => {
                      const trimmed = editedName.trim() || sequence.name;
                      setEditedName(trimmed);
                      setEditingName(false);
                      if (trimmed !== sequence.name) {
                        try {
                          const result = await updateSequence.mutateAsync({ id: sequence.id, updates: { name: trimmed } });
                          if (result?.data && onSequenceUpdated) onSequenceUpdated(result.data as { id: string; name: string; [key: string]: unknown });
                          toast({ title: "Saved", description: "Sequence title updated." });
                        } catch {
                          setEditedName(sequence.name || '');
                        }
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                      if (e.key === 'Escape') {
                        setEditedName(sequence.name || '');
                        setEditingName(false);
                        (e.target as HTMLInputElement).blur();
                      }
                    }}
                    className="text-2xl font-semibold h-10"
                    autoFocus
                  />
                ) : (
                  <div className="flex items-center gap-2 flex-wrap">
                    <DialogTitle className="text-2xl truncate">{sequence.name}</DialogTitle>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="shrink-0"
                      onClick={() => {
                        setEditedName(sequence.name || '');
                        setEditingName(true);
                      }}
                    >
                      <Edit2 className="h-4 w-4 mr-1" />
                      Edit title
                    </Button>
                  </div>
                )}
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
            {/* Sequence Metadata - editable Industry, Geography, Company Size */}
            <div className="flex items-center justify-between gap-4">
              <h3 className="text-sm font-medium text-muted-foreground">Sequence details</h3>
              {!editingMetadata ? (
                <Button variant="outline" size="sm" onClick={() => setEditingMetadata(true)}>
                  <Edit2 className="h-3 w-3 mr-1" />
                  Edit
                </Button>
              ) : (
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setEditingMetadata(false);
                      setMetadataIndustry(sequence.segment_filters?.industry ?? '');
                      setMetadataGeography(sequence.segment_filters?.geography ?? '');
                      setMetadataSize(sequence.segment_filters?.size ?? '');
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={updateSequence.isPending}
                    onClick={async () => {
                      try {
                        const result = await updateSequence.mutateAsync({
                          id: sequence.id,
                          updates: {
                            segment_filters: {
                              ...(typeof sequence.segment_filters === 'object' && sequence.segment_filters ? sequence.segment_filters : {}),
                              industry: metadataIndustry.trim() || undefined,
                              geography: metadataGeography.trim() || undefined,
                              size: metadataSize.trim() || undefined,
                            },
                          },
                        });
                        setEditingMetadata(false);
                        if (result?.data && onSequenceUpdated) onSequenceUpdated(result.data as { id: string; name: string; [key: string]: unknown });
                        toast({ title: "Saved", description: "Industry, geography, and company size updated." });
                      } catch (err) {
                        toast({
                          title: "Error",
                          description: err instanceof Error ? err.message : "Failed to save sequence details",
                          variant: "destructive",
                        });
                      }
                    }}
                  >
                    <Save className="h-3 w-3 mr-1" />
                    Save
                  </Button>
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground uppercase tracking-wide">Industry</Label>
                {editingMetadata ? (
                  <Input
                    value={metadataIndustry}
                    onChange={(e) => setMetadataIndustry(e.target.value)}
                    placeholder="e.g. Healthcare, Tech"
                    className="text-sm font-semibold"
                  />
                ) : (
                  <div className="text-sm font-semibold">{sequence.segment_filters?.industry || '—'}</div>
                )}
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground uppercase tracking-wide">Geography</Label>
                {editingMetadata ? (
                  <Input
                    value={metadataGeography}
                    onChange={(e) => setMetadataGeography(e.target.value)}
                    placeholder="e.g. North America, UK"
                    className="text-sm font-semibold"
                  />
                ) : (
                  <div className="text-sm font-semibold">{sequence.segment_filters?.geography || '—'}</div>
                )}
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground uppercase tracking-wide">Company Size</Label>
                {editingMetadata ? (
                  <Input
                    value={metadataSize}
                    onChange={(e) => setMetadataSize(e.target.value)}
                    placeholder="e.g. 11-50, 51-200"
                    className="text-sm font-semibold"
                  />
                ) : (
                  <div className="text-sm font-semibold">{sequence.segment_filters?.size || '—'}</div>
                )}
              </div>
              {sequence.created_at && (
                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground uppercase tracking-wide">Created</div>
                  <div className="text-sm font-semibold">
                    {format(new Date(sequence.created_at), "MMM d, yyyy")}
                  </div>
                </div>
              )}
            </div>

            {/* Description - your notes only; not used by AI */}
            <Card className="bg-muted/50 border-dashed">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-sm flex items-center gap-2">
                      <FileText className="h-4 w-4 text-primary" />
                      Your notes
                    </CardTitle>
                    <p className="text-xs text-muted-foreground mt-1 font-normal">
                      Optional. For your reference only—so you can find and recognize this sequence later (e.g. which campaign or audience). Not used by the AI.
                    </p>
                  </div>
                  {!editingDescription ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setEditingDescription(true)}
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
                          setEditingDescription(false);
                          setDescription(sequence.description ?? '');
                        }}
                      >
                        Cancel
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={async () => {
                          try {
                            const result = await updateSequence.mutateAsync({
                              id: sequence.id,
                              updates: { description: description.trim() || null },
                            });
                            setEditingDescription(false);
                            if (result?.data && onSequenceUpdated) onSequenceUpdated(result.data as { id: string; name: string; [key: string]: unknown });
                            toast({ title: "Saved", description: "Description updated." });
                          } catch (err) {
                            toast({
                              title: "Error",
                              description: err instanceof Error ? err.message : "Failed to save description",
                              variant: "destructive",
                            });
                          }
                        }}
                        disabled={updateSequence.isPending}
                      >
                        <Save className="h-3 w-3 mr-1" />
                        Save
                      </Button>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {editingDescription ? (
                  <Textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="e.g. Q1 healthcare campaign, UK. TalkWeb launch follow-up."
                    className="min-h-[80px] resize-y"
                    disabled={updateSequence.isPending}
                  />
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {sequence.description?.trim() ? (
                      <span className="whitespace-pre-wrap">{sequence.description}</span>
                    ) : (
                      "Nothing here yet. Click Edit to add a short note so you can tell this sequence apart when you have many."
                    )}
                  </p>
                )}
              </CardContent>
            </Card>

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
                      Wrap sequence emails in your logo, footer, and style so recipients recognize your brand (same as campaigns). Do not add a signature in the step body—it is added automatically from your email branding.
                    </p>
                  </div>
                  <Switch
                    checked={useEmailBranding}
                    onCheckedChange={async (checked) => {
                      setUseEmailBranding(checked);
                      try {
                        const result = await updateSequence.mutateAsync({
                          id: sequence.id,
                          updates: { use_email_branding: checked },
                        });
                        if (result?.data && onSequenceUpdated) onSequenceUpdated(result.data as { id: string; name: string; [key: string]: unknown });
                        toast({
                          title: "Saved",
                          description: checked ? "Sequence emails will use your branding template." : "Sequence emails will be sent as plain content.",
                        });
                      } catch (err) {
                        setUseEmailBranding(!checked);
                        toast({
                          title: "Error",
                          description: err instanceof Error ? err.message : "Failed to update setting",
                          variant: "destructive",
                        });
                      }
                    }}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Repeat sequence - restart after completion */}
            <Card className="bg-muted/50 border-dashed">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Repeat className="h-4 w-4 text-primary" />
                  Repeat sequence
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium">Restart sequence after completion</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      When on, the sequence starts again after the set number of days once all steps are sent.
                    </p>
                  </div>
                  <Switch
                    checked={repeatSequence}
                    onCheckedChange={async (checked) => {
                      setRepeatSequence(checked);
                      try {
                        const result = await updateSequence.mutateAsync({
                          id: sequence.id,
                          updates: { repeat_sequence: checked, repeat_after_days: repeatAfterDays, repeat_only_for: serializeRepeatOnlyFor(repeatOnlyForOptions) },
                        });
                        if (result?.data && onSequenceUpdated) onSequenceUpdated(result.data as { id: string; name: string; [key: string]: unknown });
                        toast({
                          title: "Saved",
                          description: checked ? `Sequence will restart after ${repeatAfterDays} days.` : "Sequence will not repeat.",
                        });
                      } catch (err) {
                        setRepeatSequence(!checked);
                        toast({
                          title: "Error",
                          description: err instanceof Error ? err.message : "Failed to update repeat setting",
                          variant: "destructive",
                        });
                      }
                    }}
                  />
                </div>
                {repeatSequence && (
                  <div className="space-y-3 pt-2 border-t">
                    <div className="flex items-center gap-3">
                      <Label className="text-xs whitespace-nowrap">Restart after (days)</Label>
                      <Input
                        type="number"
                        min={1}
                        max={30}
                        value={repeatAfterDays}
                        onChange={(e) => setRepeatAfterDays(Math.max(1, Math.min(30, parseInt(e.target.value) || 5)))}
                        onBlur={async () => {
                          try {
                            const result = await updateSequence.mutateAsync({
                              id: sequence.id,
                              updates: { repeat_sequence: true, repeat_after_days: repeatAfterDays, repeat_only_for: serializeRepeatOnlyFor(repeatOnlyForOptions) },
                            });
                            if (result?.data && onSequenceUpdated) onSequenceUpdated(result.data as { id: string; name: string; [key: string]: unknown });
                            toast({ title: "Saved", description: `Repeat after ${repeatAfterDays} days.` });
                          } catch (err) {
                            toast({
                              title: "Error",
                              description: err instanceof Error ? err.message : "Failed to update",
                              variant: "destructive",
                            });
                          }
                        }}
                        className="w-20"
                      />
                      <span className="text-xs text-muted-foreground">days</span>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label className="text-xs">Repeat only for</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className="w-full max-w-xs justify-between font-normal">
                            <span className="truncate">
                              {repeatOnlyForOptions.length === 0
                                ? "Select…"
                                : repeatOnlyForOptions.length === 1
                                  ? REPEAT_ONLY_FOR_OPTIONS.find((o) => o.value === repeatOnlyForOptions[0])?.label ?? repeatOnlyForOptions[0]
                                  : `${repeatOnlyForOptions.length} selected`}
                            </span>
                            <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-2" align="start">
                          <div className="space-y-2 max-h-[280px] overflow-y-auto">
                            {REPEAT_ONLY_FOR_OPTIONS.map((opt) => (
                              <label
                                key={opt.value}
                                className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm cursor-pointer hover:bg-muted/60"
                              >
                                <Checkbox
                                  checked={repeatOnlyForOptions.includes(opt.value)}
                                  onCheckedChange={(checked) => {
                                    const next = checked
                                      ? [...repeatOnlyForOptions, opt.value]
                                      : repeatOnlyForOptions.filter((v) => v !== opt.value);
                                    if (next.length === 0) return;
                                    setRepeatOnlyForOptions(next);
                                    updateSequence.mutateAsync({
                                      id: sequence.id,
                                      updates: {
                                        repeat_sequence: true,
                                        repeat_after_days: repeatAfterDays,
                                        repeat_only_for: serializeRepeatOnlyFor(next),
                                      },
                                    }).then((result) => {
                                      if (result?.data && onSequenceUpdated) onSequenceUpdated(result.data as { id: string; name: string; [key: string]: unknown });
                                      toast({ title: "Saved", description: "Repeat eligibility updated." });
                                    }).catch((err) => {
                                      toast({
                                        title: "Error",
                                        description: err instanceof Error ? err.message : "Failed to update",
                                        variant: "destructive",
                                      });
                                    });
                                  }}
                                />
                                <span>{opt.label}</span>
                              </label>
                            ))}
                          </div>
                          <p className="text-xs text-muted-foreground mt-2 pt-2 border-t">
                            Restart if the contact matches <strong>any</strong> of the selected options.
                          </p>
                        </PopoverContent>
                      </Popover>
                      <p className="text-xs text-muted-foreground">
                        Only restart for contacts matching any selected engagement. Others are marked completed so you don’t re-send to people who already replied or clicked.
                      </p>
                    </div>
                  </div>
                )}
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
                          {editMode && (
                            <div className="mt-2 space-y-1">
                              <Label className="text-xs text-muted-foreground">Step description (for your reference)</Label>
                              <Input
                                value={step.description ?? ''}
                                onChange={(e) => updateStep(idx, 'description', e.target.value)}
                                placeholder="e.g. Intro email, Follow-up 1, Final reminder"
                                className="text-sm"
                              />
                            </div>
                          )}
                          {!editMode && (step.description ?? '').trim() && (
                            <p className="text-sm text-muted-foreground mt-1">{step.description}</p>
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
                              <SelectItem value="time_based">Time-based (use delay days)</SelectItem>
                              <SelectItem value="no_open">Send if no open after wait</SelectItem>
                              <SelectItem value="opened_not_clicked">Send if opened but not clicked after wait</SelectItem>
                              <SelectItem value="no_reply_after_open">Send if no reply after open (after wait)</SelectItem>
                              <SelectItem value="clicked_not_replied">Send if clicked but no reply (after wait)</SelectItem>
                              <SelectItem value="wait_for_open">Wait for open (legacy)</SelectItem>
                              <SelectItem value="wait_for_click">Wait for click (legacy)</SelectItem>
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
                            {step.automation_rule.type === 'no_open' && `If no open after ${step.automation_rule.wait_hours ?? 24}h`}
                            {step.automation_rule.type === 'opened_not_clicked' && `If opened, no click after ${step.automation_rule.wait_hours ?? 24}h`}
                            {step.automation_rule.type === 'no_reply_after_open' && `If no reply after open (${step.automation_rule.wait_hours ?? 24}h)`}
                            {step.automation_rule.type === 'clicked_not_replied' && `If clicked, no reply (${step.automation_rule.wait_hours ?? 24}h)`}
                            {step.automation_rule.type === 'wait_for_open' && `Wait for open (${step.automation_rule.wait_hours ?? 24}h)`}
                            {step.automation_rule.type === 'wait_for_click' && `Wait for click (${step.automation_rule.wait_hours ?? 24}h)`}
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
