import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useSequences } from "@/hooks/use-sequences";
import { usePersonalizeSequence } from "@/hooks/use-company-sequences";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Sparkles } from "lucide-react";

interface PersonalizeSequenceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string;
  companyName: string;
  contactId?: string;
  defaultSendImmediately?: boolean;
  defaultSequenceId?: string;
}

export function PersonalizeSequenceDialog({
  open,
  onOpenChange,
  companyId,
  companyName,
  contactId,
  defaultSendImmediately = false,
  defaultSequenceId,
}: PersonalizeSequenceDialogProps) {
  const [selectedSequenceId, setSelectedSequenceId] = useState<string>(defaultSequenceId || "");
  const [tone, setTone] = useState<'professional' | 'casual' | 'technical'>('professional');

  const { data: sequencesData, isLoading: isLoadingSequences } = useSequences();
  const personalizeSequence = usePersonalizeSequence();
  const { toast } = useToast();

  const sequences = sequencesData?.data || [];

  // Sync with props when dialog opens
  useEffect(() => {
    if (open && defaultSequenceId) {
      setSelectedSequenceId(defaultSequenceId);
    }
  }, [open, defaultSequenceId]);

  const handlePersonalize = async () => {
    if (!selectedSequenceId) return;

    try {
      const result = await personalizeSequence.mutateAsync({
        sequenceId: selectedSequenceId,
        companyId,
        contactId,
        tone,
      });

      if (result?.data) {
        const contactName = (result.data as any).contact?.name || 'contact';
        toast({
          title: 'Sequence Created!',
          description: `Personalized sequence created as draft for ${contactName}. Review and activate it from the Sequences page.`,
        });
      }

      onOpenChange(false);
      setSelectedSequenceId("");
      setTone('professional');
    } catch (error) {
      console.error('Error personalizing sequence:', error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Personalize Sequence for {companyName}
          </DialogTitle>
          <DialogDescription>
            Create a personalized email sequence tailored to this company's profile and enrichment data.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="sequence">Select Sequence Template</Label>
            <Select value={selectedSequenceId} onValueChange={setSelectedSequenceId}>
              <SelectTrigger id="sequence">
                <SelectValue placeholder={isLoadingSequences ? "Loading..." : "Choose a sequence"} />
              </SelectTrigger>
              <SelectContent>
                {sequences.map((seq: any) => (
                  <SelectItem key={seq.id} value={seq.id}>
                    {seq.name} ({seq.steps?.length || 0} steps)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="tone">Tone</Label>
            <Select value={tone} onValueChange={(v: any) => setTone(v)}>
              <SelectTrigger id="tone">
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

        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handlePersonalize}
            disabled={!selectedSequenceId || personalizeSequence.isPending}
          >
            {personalizeSequence.isPending && (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            )}
            Create Draft Sequence
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
