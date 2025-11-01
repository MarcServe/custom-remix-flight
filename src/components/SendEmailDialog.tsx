import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Send, Sparkles } from "lucide-react";

interface SendEmailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recipientEmail: string;
  recipientName: string;
  companyId?: string;
  contactId?: string;
}

export function SendEmailDialog({
  open,
  onOpenChange,
  recipientEmail,
  recipientName,
  companyId,
  contactId,
}: SendEmailDialogProps) {
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [context, setContext] = useState("");
  const [sender, setSender] = useState<'gmail' | 'resend'>('resend');
  const [isSending, setIsSending] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const { toast } = useToast();

  const { data: connections } = useQuery({
    queryKey: ['email-connections'],
    queryFn: async () => {
      const { data } = await supabase
        .from('crm_connections')
        .select('provider, status, from_email')
        .eq('status', 'active')
        .in('provider', ['gmail', 'outlook']);
      return data || [];
    },
  });

  const handleGenerateWithAI = async () => {
    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-email-with-ai", {
        body: {
          recipientName,
          recipientEmail,
          companyId,
          contactId,
          context: context.trim() || undefined,
        },
      });

      if (error) throw error;

      if (data?.subject && data?.body) {
        setSubject(data.subject);
        setBody(data.body);
        toast({
          title: "Email Generated",
          description: "AI has drafted an email based on your business profile and the prospect's information",
        });
      }
    } catch (error: any) {
      console.error("Error generating email:", error);
      toast({
        title: "Failed to Generate Email",
        description: error.message || "An error occurred while generating the email",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSend = async () => {
    if (!subject.trim() || !body.trim()) {
      toast({
        title: "Validation Error",
        description: "Please fill in both subject and message",
        variant: "destructive",
      });
      return;
    }

    setIsSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-crm-email", {
        body: {
          toEmail: recipientEmail,
          toName: recipientName,
          subject,
          body,
          companyId,
          contactId,
          sender,
        },
      });

      if (error) throw error;

      toast({
        title: "Email Sent",
        description: `Email successfully sent to ${recipientName}`,
      });

      // Reset form and close dialog
      setSubject("");
      setBody("");
      onOpenChange(false);
    } catch (error: any) {
      console.error("Error sending email:", error);
      toast({
        title: "Failed to Send Email",
        description: error.message || "An error occurred while sending the email",
        variant: "destructive",
      });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle>Send Email to {recipientName}</DialogTitle>
        </DialogHeader>
        
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="to">To</Label>
              <Input
                id="to"
                value={`${recipientName} <${recipientEmail}>`}
                disabled
                className="bg-muted"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="sender">Send From</Label>
              <Select value={sender} onValueChange={(value) => setSender(value as 'gmail' | 'resend')}>
                <SelectTrigger id="sender">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="resend">
                    <div className="flex items-center gap-2">
                      <span>📧</span>
                      <div>
                        <div className="font-medium">Resend (Default)</div>
                        <div className="text-xs text-muted-foreground">Reliable delivery service</div>
                      </div>
                    </div>
                  </SelectItem>
                  {connections?.some(c => c.provider === 'gmail') && (
                    <SelectItem value="gmail">
                      <div className="flex items-center gap-2">
                        <span>📬</span>
                        <div>
                          <div className="font-medium">Gmail</div>
                          <div className="text-xs text-muted-foreground">
                            {connections.find(c => c.provider === 'gmail')?.from_email || 'Connected account'}
                          </div>
                        </div>
                      </div>
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
              {sender === 'gmail' && (
                <p className="text-xs text-muted-foreground">
                  ✓ Email will appear in your Gmail Sent folder
                </p>
              )}
              {sender === 'resend' && (
                <p className="text-xs text-muted-foreground">
                  ✓ Reliable delivery • Won't appear in your Gmail Sent folder
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="context">AI Context (Optional)</Label>
              <Textarea
                id="context"
                placeholder="Add any context or instructions to guide the AI (e.g., mention a recent conversation, specific pain points, upcoming event...)"
                value={context}
                onChange={(e) => setContext(e.target.value)}
                disabled={isSending || isGenerating}
                rows={3}
                className="resize-none text-sm"
              />
            </div>

            <div className="flex justify-between items-center">
              <Label>Email Content</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleGenerateWithAI}
                disabled={isGenerating || isSending}
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-3 w-3" />
                    Generate with AI
                  </>
                )}
              </Button>
            </div>

            <div className="space-y-2">
              <Label htmlFor="subject">Subject</Label>
              <Input
                id="subject"
                placeholder="Enter email subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                disabled={isSending || isGenerating}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="body">Message</Label>
              <Textarea
                id="body"
                placeholder="Write your message here..."
                value={body}
                onChange={(e) => setBody(e.target.value)}
                disabled={isSending || isGenerating}
                rows={10}
                className="resize-none"
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 px-6 pb-6 pt-4 border-t">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSending}
          >
            Cancel
          </Button>
          <Button onClick={handleSend} disabled={isSending}>
            {isSending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Send className="mr-2 h-4 w-4" />
                Send Email
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
