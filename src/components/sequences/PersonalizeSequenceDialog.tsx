import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useSequences } from "@/hooks/use-sequences";
import { usePersonalizeSequence } from "@/hooks/use-company-sequences";
import { Loader2, Sparkles } from "lucide-react";

interface PersonalizeSequenceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string;
  companyName: string;
  contactId?: string;
}

export function PersonalizeSequenceDialog({
  open,
  onOpenChange,
  companyId,
  companyName,
  contactId,
}: PersonalizeSequenceDialogProps) {
  const [selectedSequenceId, setSelectedSequenceId] = useState<string>("");
  const [tone, setTone] = useState<'professional' | 'casual' | 'technical'>('professional');

  const { data: sequencesData, isLoading: isLoadingSequences } = useSequences();
  const personalizeSequence = usePersonalizeSequence();

  const sequences = sequencesData?.data || [];

  const handlePersonalize = async () => {
    if (!selectedSequenceId) return;

    await personalizeSequence.mutateAsync({
      sequenceId: selectedSequenceId,
      companyId,
      contactId,
      tone,
    });

    onOpenChange(false);
    setSelectedSequenceId("");
    setTone('professional');
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
            {personalizeSequence.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Personalize & Create
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
