import { useState } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Mail, Clock, Edit2, Save, X, Send, Loader2, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface PersonalizedEmail {
  subject: string;
  body: string;
  delayDays?: number;
  stepNumber: number;
}

interface SequencePreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyName: string;
  companySequenceId: string;
  personalizedEmails: PersonalizedEmail[];
  sendImmediately?: boolean;
}

export function SequencePreviewDialog({
  open,
  onOpenChange,
  companyName,
  companySequenceId,
  personalizedEmails: initialEmails,
  sendImmediately = false,
}: SequencePreviewDialogProps) {
  const [emails, setEmails] = useState<PersonalizedEmail[]>(initialEmails);
  const [editingStep, setEditingStep] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const { toast } = useToast();

  const handleEditStep = (stepNumber: number) => {
    setEditingStep(stepNumber);
  };

  const handleCancelEdit = () => {
    setEditingStep(null);
    // Reset to original emails
    setEmails(initialEmails);
  };

  const handleSaveEdit = (stepNumber: number) => {
    setEditingStep(null);
    toast({
      title: "Changes saved",
      description: "Step updated successfully",
    });
  };

  const updateEmail = (stepNumber: number, field: 'subject' | 'body' | 'delayDays', value: string | number) => {
    setEmails(prev => prev.map(email => 
      email.stepNumber === stepNumber 
        ? { ...email, [field]: value }
        : email
    ));
  };

  const handleStartSequence = async () => {
    setIsSaving(true);
    
    try {
      // Update the personalized emails in the database
      const { error: updateError } = await supabase
        .from('company_sequences')
        .update({
          personalized_emails: emails as any,
          updated_at: new Date().toISOString(),
        })
        .eq('id', companySequenceId);

      if (updateError) throw updateError;

      // If sendImmediately is true, send the first email and activate
      if (sendImmediately) {
        setIsSending(true);
        
        const { data: sendData, error: sendError } = await supabase.functions.invoke(
          'send-sequence-email',
          {
            body: {
              companySequenceId,
              stepNumber: 0,
            },
          }
        );

        if (sendError) throw sendError;

        // Update status to active
        const { error: statusError } = await supabase
          .from('company_sequences')
          .update({ status: 'active' })
          .eq('id', companySequenceId);

        if (statusError) throw statusError;

        toast({
          title: "Sequence started!",
          description: "First email sent and sequence activated",
        });
      } else {
        toast({
          title: "Sequence saved",
          description: "All changes have been saved",
        });
      }

      onOpenChange(false);
    } catch (error: any) {
      console.error('Error starting sequence:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to start sequence",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
      setIsSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[90vh] flex flex-col overflow-hidden p-0">
        <DialogHeader className="shrink-0 px-6 pt-6 pb-4 border-b">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg bg-gradient-primary flex items-center justify-center">
              <Mail className="h-6 w-6 text-white" />
            </div>
            <div>
              <DialogTitle className="text-2xl">Preview Sequence</DialogTitle>
              <DialogDescription className="text-sm mt-1">
                Review and edit emails for {companyName} before sending
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1 px-6">
          <div className="space-y-4 py-4">
            {/* Info Banner */}
            <div className="flex items-center gap-2 p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
              <CheckCircle2 className="h-5 w-5 text-blue-600 flex-shrink-0" />
              <div className="text-sm">
                <p className="font-medium text-blue-600">Review each step carefully</p>
                <p className="text-muted-foreground">
                  You can edit any step before starting the sequence. Click the edit icon to make changes.
                </p>
              </div>
            </div>

            {/* Email Steps */}
            {emails.map((email, idx) => {
              const isEditing = editingStep === email.stepNumber;
              const isFirst = idx === 0;

              return (
                <Card 
                  key={email.stepNumber}
                  className={`border-2 transition-all ${
                    isFirst ? 'border-primary shadow-lg' : 'border-muted'
                  }`}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                          isFirst ? 'bg-gradient-primary' : 'bg-muted'
                        }`}>
                          <span className={`font-bold ${
                            isFirst ? 'text-white' : 'text-muted-foreground'
                          }`}>
                            {idx + 1}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="font-mono text-xs">
                            Step {idx + 1}
                          </Badge>
                          {email.delayDays !== undefined && email.delayDays > 0 && (
                            <Badge variant="secondary" className="text-xs">
                              <Clock className="h-3 w-3 mr-1" />
                              {email.delayDays}d delay
                            </Badge>
                          )}
                          {isFirst && (
                            <Badge className="bg-primary text-xs">
                              Will send first
                            </Badge>
                          )}
                        </div>
                      </div>

                      {!isEditing ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditStep(email.stepNumber)}
                        >
                          <Edit2 className="h-4 w-4 mr-2" />
                          Edit
                        </Button>
                      ) : (
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleCancelEdit}
                          >
                            <X className="h-4 w-4 mr-2" />
                            Cancel
                          </Button>
                          <Button
                            variant="default"
                            size="sm"
                            onClick={() => handleSaveEdit(email.stepNumber)}
                          >
                            <Save className="h-4 w-4 mr-2" />
                            Save
                          </Button>
                        </div>
                      )}
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-4">
                    {isEditing ? (
                      <>
                        <div className="space-y-2">
                          <Label htmlFor={`subject-${email.stepNumber}`}>Subject</Label>
                          <Input
                            id={`subject-${email.stepNumber}`}
                            value={email.subject}
                            onChange={(e) => updateEmail(email.stepNumber, 'subject', e.target.value)}
                            placeholder="Email subject"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor={`body-${email.stepNumber}`}>Email Body</Label>
                          <Textarea
                            id={`body-${email.stepNumber}`}
                            value={email.body}
                            onChange={(e) => updateEmail(email.stepNumber, 'body', e.target.value)}
                            className="min-h-[200px] font-mono text-sm"
                            placeholder="Email body"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor={`delay-${email.stepNumber}`}>Delay (days)</Label>
                          <Input
                            id={`delay-${email.stepNumber}`}
                            type="number"
                            min="0"
                            value={email.delayDays || 0}
                            onChange={(e) => updateEmail(email.stepNumber, 'delayDays', parseInt(e.target.value) || 0)}
                            className="w-32"
                          />
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="space-y-2">
                          <Label className="text-xs text-muted-foreground uppercase">Subject</Label>
                          <p className="font-semibold">{email.subject}</p>
                        </div>

                        <Separator />

                        <div className="space-y-2">
                          <Label className="text-xs text-muted-foreground uppercase">Email Body</Label>
                          <div className="rounded-lg border bg-muted/50 p-4">
                            <div className="whitespace-pre-wrap text-sm leading-relaxed">
                              {email.body}
                            </div>
                          </div>
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </ScrollArea>

        {/* Footer Actions */}
        <div className="shrink-0 px-6 py-4 border-t bg-muted/50">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {sendImmediately 
                ? "The first email will be sent immediately when you start the sequence"
                : "The sequence will be saved as draft and ready to start manually"
              }
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSaving || isSending}
              >
                Cancel
              </Button>
              <Button
                onClick={handleStartSequence}
                disabled={isSaving || isSending || editingStep !== null}
              >
                {(isSaving || isSending) && (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                )}
                {isSending ? 'Starting...' : sendImmediately ? 'Start & Send' : 'Save Sequence'}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
