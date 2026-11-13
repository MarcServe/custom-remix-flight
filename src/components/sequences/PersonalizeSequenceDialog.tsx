import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { useSequences } from "@/hooks/use-sequences";
import { usePersonalizeSequence } from "@/hooks/use-company-sequences";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Sparkles, Send, Mail, AlertTriangle } from "lucide-react";

interface PersonalizeSequenceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string;
  companyName: string;
  contactId?: string;
  defaultSendImmediately?: boolean;
  defaultSequenceId?: string;
}

interface EmailConnection {
  id: string;
  provider: string;
  from_email: string | null;
  status: string;
  tracking_enabled: boolean | null;
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
  const [sendImmediately, setSendImmediately] = useState(defaultSendImmediately);
  const [selectedConnectionId, setSelectedConnectionId] = useState<string>("");

  const { data: sequencesData, isLoading: isLoadingSequences } = useSequences();
  const personalizeSequence = usePersonalizeSequence();
  const { toast } = useToast();

  const sequences = sequencesData?.data || [];

  // Fetch available email connections
  const { data: emailConnections, isLoading: isLoadingConnections } = useQuery({
    queryKey: ['email-connections-for-sending'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      
      const { data: connections, error } = await supabase
        .from('crm_connections')
        .select('id, provider, from_email, status, tracking_enabled')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .in('provider', ['gmail', 'gmail_direct', 'sendgrid', 'resend', 'smtp']);
      
      if (error) {
        console.error('Error fetching email connections:', error);
        return [];
      }
      
      return (connections || []) as EmailConnection[];
    },
    enabled: open,
  });

  // Auto-select first connection when loaded
  useEffect(() => {
    if (emailConnections && emailConnections.length > 0 && !selectedConnectionId) {
      // Prefer connections with tracking enabled
      const withTracking = emailConnections.find(c => c.tracking_enabled);
      setSelectedConnectionId(withTracking?.id || emailConnections[0].id);
    }
  }, [emailConnections, selectedConnectionId]);

  // Sync with props when dialog opens
  useEffect(() => {
    if (open) {
      if (defaultSequenceId) {
        setSelectedSequenceId(defaultSequenceId);
      }
      setSendImmediately(defaultSendImmediately);
    }
  }, [open, defaultSequenceId, defaultSendImmediately]);

  const selectedConnection = emailConnections?.find(c => c.id === selectedConnectionId);

  const getProviderLabel = (provider: string) => {
    switch (provider) {
      case 'gmail_direct': return 'Gmail OAuth';
      case 'gmail': return 'Gmail (Nango)';
      case 'sendgrid': return 'SendGrid';
      case 'resend': return 'Resend';
      case 'smtp': return 'SMTP';
      default: return provider;
    }
  };

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
        const companySequenceId = (result.data as any).companySequenceId;
        const contactName = (result.data as any).contact?.name || 'contact';
        const timestamp = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

        // If send immediately is enabled, set status to active first, then send the first email
        if (sendImmediately && companySequenceId) {
          try {
            // Update status to active FIRST (fix race condition)
            await supabase
              .from('company_sequences')
              .update({ status: 'active' })
              .eq('id', companySequenceId);

            // Send the first email with selected connection
            const { error: sendError } = await supabase.functions.invoke('send-sequence-email', {
              body: { 
                companySequenceId, 
                stepNumber: 0,
                connectionId: selectedConnectionId || undefined 
              }
            });

            if (sendError) {
              // Revert to draft if sending failed
              await supabase
                .from('company_sequences')
                .update({ status: 'draft' })
                .eq('id', companySequenceId);

              console.error('Error sending first email:', sendError);
              toast({
                title: 'Sequence Created',
                description: `Sequence created but failed to send first email: ${sendError.message}`,
                variant: 'destructive',
              });
            } else {
              toast({
                title: 'Sequence Sent!',
                description: `First email sent to ${companyName} (${contactName}) via ${selectedConnection ? getProviderLabel(selectedConnection.provider) : 'default provider'}. Campaign is now active.`,
              });
            }
          } catch (sendError) {
            console.error('Error in send immediately flow:', sendError);
            toast({
              title: 'Sequence Created',
              description: `Sequence created for ${companyName} but couldn't send first email.`,
            });
          }
        } else {
          toast({
            title: 'Sequence Created!',
            description: `Personalized sequence created for ${companyName} (${contactName}) at ${timestamp}. Find it in your Campaigns page.`,
          });
        }
      }

      onOpenChange(false);
      setSelectedSequenceId("");
      setTone('professional');
      setSendImmediately(false);
      setSelectedConnectionId("");
    } catch (error) {
      console.error('Error personalizing sequence:', error);
      toast({
        title: 'Personalization failed',
        description: error instanceof Error ? error.message : 'Could not personalize this sequence. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const hasConnections = emailConnections && emailConnections.length > 0;

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
          {/* Email Provider Selector */}
          <div className="space-y-2">
            <Label htmlFor="email-provider" className="flex items-center gap-2">
              <Mail className="h-4 w-4" />
              Send From
            </Label>
            {isLoadingConnections ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading email accounts...
              </div>
            ) : !hasConnections ? (
              <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-md text-sm">
                <AlertTriangle className="h-4 w-4 text-destructive" />
                <span>No email accounts connected. Please connect an email provider in Integrations.</span>
              </div>
            ) : (
              <Select value={selectedConnectionId} onValueChange={setSelectedConnectionId}>
                <SelectTrigger id="email-provider">
                  <SelectValue placeholder="Select email account" />
                </SelectTrigger>
                <SelectContent>
                  {emailConnections.map((connection) => (
                    <SelectItem key={connection.id} value={connection.id}>
                      <div className="flex items-center gap-2">
                        <span>{connection.from_email || 'No email set'}</span>
                        <Badge variant="outline" className="text-xs">
                          {getProviderLabel(connection.provider)}
                        </Badge>
                        {connection.tracking_enabled && (
                          <Badge variant="secondary" className="text-xs">
                            Tracking
                          </Badge>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {selectedConnection && (
              <p className="text-xs text-muted-foreground">
                Emails will be sent from <strong>{selectedConnection.from_email}</strong> via {getProviderLabel(selectedConnection.provider)}
                {selectedConnection.tracking_enabled ? ' with open/click tracking' : ' (no tracking)'}
              </p>
            )}
          </div>

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
              id="send-immediately"
              checked={sendImmediately} 
              onCheckedChange={(checked) => setSendImmediately(!!checked)} 
            />
            <Label htmlFor="send-immediately" className="text-sm font-normal cursor-pointer">
              Send first email immediately
            </Label>
          </div>
        </div>

        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handlePersonalize}
            disabled={!selectedSequenceId || personalizeSequence.isPending || (sendImmediately && !hasConnections)}
          >
            {personalizeSequence.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : sendImmediately ? (
              <Send className="h-4 w-4 mr-2" />
            ) : null}
            {sendImmediately ? 'Create & Send' : 'Create Draft Sequence'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
