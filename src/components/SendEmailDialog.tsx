import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Send, Sparkles, Code, Eye, Bot, Tag } from "lucide-react";
import { RichTextEditor } from "./email/RichTextEditor";
import { EmailTemplateSelector, EMAIL_TEMPLATES, type EmailTemplate } from "./email/EmailTemplateSelector";
import { FileAttachmentSelector } from "./email/FileAttachmentSelector";
import { PersonaSelector, type MarketingPersona } from "./email/PersonaSelector";
import { TagInput } from "@/components/ui/tag-input";
import { useCompanyTags } from "@/hooks/use-company-tags";

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
  const [bodyHtml, setBodyHtml] = useState("");
  const [bodyText, setBodyText] = useState("");
  const [context, setContext] = useState("");
  const [sender, setSender] = useState<'gmail' | 'gmail_direct' | 'resend' | 'smtp' | 'sendgrid'>('resend');
  const [template, setTemplate] = useState<EmailTemplate>('blank');
  const [enableAutoResponder, setEnableAutoResponder] = useState(false);
  const [attachments, setAttachments] = useState<any[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedPersonaId, setSelectedPersonaId] = useState<string | null>(null);
  const [selectedPersona, setSelectedPersona] = useState<MarketingPersona | null>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [senderProfileId, setSenderProfileId] = useState<string>("");
  const { toast } = useToast();
  const { allSuggestions } = useCompanyTags();

  const { data: connections } = useQuery({
    queryKey: ['email-connections'],
    queryFn: async () => {
      const { data } = await supabase
        .from('crm_connections')
        .select('provider, status, from_email')
        .eq('status', 'active')
        .in('provider', ['gmail', 'gmail_direct', 'outlook', 'smtp', 'resend', 'sendgrid']);
      return data || [];
    },
  });

  const { data: businessProfile } = useQuery({
    queryKey: ['business-profile'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      
      const { data } = await supabase
        .from('business_profiles')
        .select('company_name')
        .eq('user_id', user.id)
        .maybeSingle();
      return data;
    },
  });

  const { data: senderProfiles = [] } = useQuery({
    queryKey: ['sender-profiles-single'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      const { data, error } = await supabase
        .from('sender_profiles')
        .select('id, name, display_name, sender_name, sender_email')
        .eq('user_id', user.id)
        .order('sort_order', { ascending: true })
        .order('name', { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  // Apply template when changed
  useEffect(() => {
    if (template !== 'blank') {
      const templateData = EMAIL_TEMPLATES[template];
      let processedSubject = templateData.subject;
      let processedBody = templateData.body;

      // Replace variables (case-insensitive to match {{firstName}}, {{FirstName}}, etc.)
      const firstName = recipientName.split(' ')[0];
      processedSubject = processedSubject.replace(/{{firstName}}/gi, firstName);
      processedBody = processedBody.replace(/{{firstName}}/gi, firstName);
      processedBody = processedBody.replace(/{{companyName}}/gi, companyId ? 'your company' : 'your team');

      setSubject(processedSubject);
      setBodyHtml(processedBody);
      setBodyText(processedBody.replace(/<[^>]+>/g, ''));
    }
  }, [template, recipientName, companyId]);

  const handlePersonaChange = (persona: MarketingPersona | null, personaContext: string) => {
    setSelectedPersonaId(persona?.id || null);
    setSelectedPersona(persona);
    if (personaContext) {
      setContext(personaContext);
    }
  };

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
          persona: selectedPersona ? {
            product_focus: selectedPersona.product_focus,
            value_proposition: selectedPersona.value_proposition,
            email_tone: selectedPersona.email_tone,
            talking_points: selectedPersona.talking_points,
            call_to_action: selectedPersona.call_to_action,
            email_signature_override: selectedPersona.email_signature_override,
          } : undefined,
        },
      });

      if (error) throw error;

      if (data?.subject && data?.body) {
        setSubject(data.subject);
        setBodyHtml(`<p>${data.body.replace(/\n/g, '</p><p>')}</p>`);
        setBodyText(data.body);
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
    if (!subject.trim() || !bodyText.trim()) {
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
          bodyHtml,
          bodyText,
          companyId,
          contactId,
          sender,
          sender_profile_id: senderProfileId || undefined,
          enableAutoResponder,
          attachments: attachments.length > 0 ? attachments : undefined,
          tags: selectedTags.length > 0 ? selectedTags : undefined,
        },
      });

      if (error) throw error;

      toast({
        title: "Email Sent",
        description: `Email successfully sent to ${recipientName}`,
      });

      // Reset form and close dialog
      setSubject("");
      setBodyHtml("");
      setBodyText("");
      setContext("");
      setTemplate('blank');
      setEnableAutoResponder(false);
      setAttachments([]);
      setSelectedTags([]);
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
          <DialogDescription>
            Compose and send an email to your contact
          </DialogDescription>
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
              <Select value={sender} onValueChange={(value) => setSender(value as 'gmail' | 'gmail_direct' | 'resend' | 'smtp' | 'sendgrid')}>
                <SelectTrigger id="sender">
                  <SelectValue placeholder="Select sender..." />
                </SelectTrigger>
                <SelectContent>
                  {connections?.some(c => c.provider === 'resend' && c.status === 'active') && (
                    <SelectItem value="resend">
                      <div className="flex items-center gap-2">
                        <span>🚀</span>
                        <div>
                          <div className="font-medium">Resend</div>
                          <div className="text-xs text-muted-foreground">
                            {businessProfile?.company_name || 'Your Business'} &lt;{connections.find(c => c.provider === 'resend')?.from_email}&gt;
                          </div>
                        </div>
                      </div>
                    </SelectItem>
                  )}
                  {connections?.some(c => c.provider === 'sendgrid' && c.status === 'active') && (
                    <SelectItem value="sendgrid">
                      <div className="flex items-center gap-2">
                        <span>📬</span>
                        <div>
                          <div className="font-medium">SendGrid</div>
                          <div className="text-xs text-muted-foreground">
                            {businessProfile?.company_name || 'Your Business'} &lt;{connections.find(c => c.provider === 'sendgrid')?.from_email}&gt;
                          </div>
                        </div>
                      </div>
                    </SelectItem>
                  )}
                  {connections?.some(c => (c.provider === 'gmail' || c.provider === 'gmail_direct') && c.status === 'active') && (
                    <SelectItem value="gmail_direct">
                      <div className="flex items-center gap-2">
                        <span>📧</span>
                        <div>
                          <div className="font-medium">Gmail</div>
                          <div className="text-xs text-muted-foreground">
                            {connections.find(c => c.provider === 'gmail' || c.provider === 'gmail_direct')?.from_email || 'Connected account'}
                          </div>
                        </div>
                      </div>
                    </SelectItem>
                  )}
                  {connections?.some(c => c.provider === 'smtp' && c.status === 'active') && (
                    <SelectItem value="smtp">
                      <div className="flex items-center gap-2">
                        <span>⚙️</span>
                        <div>
                          <div className="font-medium">SMTP Direct</div>
                          <div className="text-xs text-muted-foreground">
                            {businessProfile?.company_name || 'Your Business'} &lt;{connections.find(c => c.provider === 'smtp')?.from_email}&gt;
                          </div>
                        </div>
                      </div>
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
              {sender === 'resend' && (
                <p className="text-xs text-muted-foreground">
                  ✓ Tracking enabled • Opens, clicks & replies monitored
                </p>
              )}
              {sender === 'sendgrid' && (
                <p className="text-xs text-muted-foreground">
                  ✓ Enterprise delivery • Full engagement tracking
                </p>
              )}
              {(sender === 'gmail' || sender === 'gmail_direct') && (
                <p className="text-xs text-muted-foreground">
                  ✓ Email will appear in your Gmail Sent folder
                </p>
              )}
              {sender === 'smtp' && (
                <p className="text-xs text-muted-foreground">
                  ✓ Direct SMTP delivery • No tracking
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Sender Profile</Label>
              <Select value={senderProfileId || 'default'} onValueChange={(v) => setSenderProfileId(v === 'default' ? '' : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose sender profile" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">
                    <div className="flex flex-col">
                      <span className="font-medium">Default</span>
                      <span className="text-xs text-muted-foreground">{businessProfile?.company_name || 'Your company'}</span>
                    </div>
                  </SelectItem>
                  {senderProfiles.map((p: any) => (
                    <SelectItem key={p.id} value={p.id}>
                      <div className="flex flex-col">
                        <span className="font-medium">{p.name || p.display_name || 'Unnamed profile'}</span>
                        <span className="text-xs text-muted-foreground">
                          {p.sender_name && p.sender_email ? `${p.sender_name} · ${p.sender_email}` : p.sender_email || p.display_name || ''}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Brand identity, name, and logo shown to recipients. Manage profiles in Email Branding.
              </p>
            </div>

            <div className="flex items-center justify-between space-x-2 p-4 rounded-lg border bg-muted/50">
              <div className="flex items-center gap-3">
                <Bot className="h-5 w-5 text-primary" />
                <div className="flex flex-col">
                  <Label htmlFor="auto-responder" className="cursor-pointer font-medium">
                    Enable AI Auto-Responder
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Automatically generate and send AI-powered replies to incoming responses
                  </p>
                </div>
              </div>
              <Switch
                id="auto-responder"
                checked={enableAutoResponder}
                onCheckedChange={setEnableAutoResponder}
                disabled={isSending || isGenerating}
              />
            </div>

            <PersonaSelector
              value={selectedPersonaId}
              onChange={handlePersonaChange}
              disabled={isSending || isGenerating}
            />

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Tag className="h-4 w-4" />
                Tags (Optional)
              </Label>
              <TagInput
                tags={selectedTags}
                onTagsChange={setSelectedTags}
                suggestions={allSuggestions}
                placeholder="Add tags for tracking/categorization..."
                maxTags={10}
              />
              <p className="text-xs text-muted-foreground">
                Tags help categorize and track this email campaign
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="context">AI Context {selectedPersona ? '(auto-filled from persona)' : '(Optional)'}</Label>
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

            <EmailTemplateSelector
              value={template}
              onChange={setTemplate}
              disabled={isSending || isGenerating}
            />

            <FileAttachmentSelector
              selectedFiles={attachments}
              onFilesChange={setAttachments}
              disabled={isSending || isGenerating}
            />

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

            <Tabs defaultValue="editor" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="editor">
                  <Eye className="mr-2 h-4 w-4" />
                  Editor
                </TabsTrigger>
                <TabsTrigger value="html">
                  <Code className="mr-2 h-4 w-4" />
                  HTML
                </TabsTrigger>
              </TabsList>
              <TabsContent value="editor" className="mt-4">
                <RichTextEditor
                  content={bodyHtml}
                  onChange={(html, text) => {
                    setBodyHtml(html);
                    setBodyText(text);
                  }}
                  disabled={isSending || isGenerating}
                />
              </TabsContent>
              <TabsContent value="html" className="mt-4">
                <Textarea
                  placeholder="HTML content..."
                  value={bodyHtml}
                  onChange={(e) => {
                    setBodyHtml(e.target.value);
                    setBodyText(e.target.value.replace(/<[^>]+>/g, ''));
                  }}
                  disabled={isSending || isGenerating}
                  rows={12}
                  className="resize-none font-mono text-sm"
                />
              </TabsContent>
            </Tabs>
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
