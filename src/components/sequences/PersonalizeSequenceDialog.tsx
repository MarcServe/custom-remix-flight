import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useSequences } from "@/hooks/use-sequences";
import { usePersonalizeSequence } from "@/hooks/use-company-sequences";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Sparkles, Mail } from "lucide-react";

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
  const [sendImmediately, setSendImmediately] = useState(false);
  const [isSending, setIsSending] = useState(false);

  const { data: sequencesData, isLoading: isLoadingSequences } = useSequences();
  const personalizeSequence = usePersonalizeSequence();
  const { toast } = useToast();

  const sequences = sequencesData?.data || [];

  const handlePersonalize = async () => {
    if (!selectedSequenceId) return;

    try {
      const result = await personalizeSequence.mutateAsync({
        sequenceId: selectedSequenceId,
        companyId,
        contactId,
        tone,
      });

      // If user wants to send immediately, trigger the send function
      if (sendImmediately && result?.data) {
        const companySequenceId = (result.data as any).companySequenceId;
        if (companySequenceId) {
          setIsSending(true);
          try {
            const { data: sendData, error: sendError } = await supabase.functions.invoke(
              'send-sequence-emails',
              {
                body: {
                  companySequenceId,
                  startFromStep: 0,
                },
              }
            );

            if (sendError) throw sendError;

            const contactName = (result.data as any).contact?.name || 'contact';
            toast({
              title: 'Sequence Started!',
              description: `First email sent to ${contactName}. Remaining emails will be sent according to the schedule.`,
            });
          } catch (sendError: any) {
            console.error('Error sending sequence:', sendError);
            toast({
              title: 'Sequence Created',
              description: 'Sequence was personalized but failed to send. You can send it manually from the sequences page.',
              variant: 'destructive',
            });
          } finally {
            setIsSending(false);
          }
        }
      }

      onOpenChange(false);
      setSelectedSequenceId("");
      setTone('professional');
      setSendImmediately(false);
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

          <div className="flex items-center space-x-2 pt-2">
            <Checkbox
              id="sendImmediately"
              checked={sendImmediately}
              onCheckedChange={(checked) => setSendImmediately(checked as boolean)}
            />
            <Label
              htmlFor="sendImmediately"
              className="text-sm font-normal cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4" />
                <span>Start sending emails immediately (via Gmail OAuth)</span>
              </div>
            </Label>
          </div>
        </div>

        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSending}>
            Cancel
          </Button>
          <Button
            onClick={handlePersonalize}
            disabled={!selectedSequenceId || personalizeSequence.isPending || isSending}
          >
            {(personalizeSequence.isPending || isSending) && (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            )}
            {isSending ? 'Sending...' : sendImmediately ? 'Personalize & Send' : 'Personalize & Create'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
