import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Send, User, Info } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

interface BulkEmailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedPeople: Array<{
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    company_id?: string;
  }>;
}

export default function BulkEmailDialog({ open, onOpenChange, selectedPeople }: BulkEmailDialogProps) {
  const { toast } = useToast();
  const [campaignName, setCampaignName] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sender, setSender] = useState<string>("");
  const [sending, setSending] = useState(false);

  // Fetch email connections
  const { data: connections } = useQuery({
    queryKey: ['crm-connections'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('crm_connections')
        .select('*')
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
  });

  // Personalize text with variables
  const personalizeText = (template: string, person: typeof selectedPeople[0]) => {
    return template
      .replace(/\{\{firstName\}\}/g, person.first_name || '')
      .replace(/\{\{lastName\}\}/g, person.last_name || '')
      .replace(/\{\{fullName\}\}/g, `${person.first_name} ${person.last_name}`.trim() || '');
  };

  const insertVariable = (variable: string) => {
    setBody(body + `{{${variable}}}`);
  };

  const handleSend = async () => {
    if (!campaignName.trim() || !subject.trim() || !body.trim()) {
      toast({
        title: "Missing fields",
        description: "Please fill in campaign name, subject, and body",
        variant: "destructive",
      });
      return;
    }

    if (!sender) {
      toast({
        title: "No sender selected",
        description: "Please select an email account to send from",
        variant: "destructive",
      });
      return;
    }

    if (selectedPeople.length === 0) {
      toast({
        title: "No recipients",
        description: "Please select at least one person to send to",
        variant: "destructive",
      });
      return;
    }

    try {
      setSending(true);

      // Get user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Get user profile and business profile for signature
      const { data: userProfile } = await supabase
        .from('profiles')
        .select('full_name, job_title')
        .eq('id', user.id)
        .single();

      const { data: businessProfile } = await supabase
        .from('business_profiles')
        .select('company_name')
        .eq('user_id', user.id)
        .single();

      // Build signature
      const signatureText = `\n\nBest regards,\n${userProfile?.full_name || 'Team'}\n${userProfile?.job_title ? `${userProfile.job_title}\n` : ''}${businessProfile?.company_name || ''}`;
      const signatureHtml = `<br><br><p>Best regards,<br><strong>${userProfile?.full_name || 'Team'}</strong><br>${userProfile?.job_title ? `${userProfile.job_title}<br>` : ''}${businessProfile?.company_name || ''}</p>`;

      // Create campaign
      const { data: campaign, error: campaignError } = await supabase
        .from('email_campaigns')
        .insert({
          user_id: user.id,
          name: campaignName,
          subject_template: subject,
          body_html_template: `<p>${body.replace(/\n/g, '</p><p>')}</p>${signatureHtml}`,
          body_text_template: body + signatureText,
          sender_connection_id: sender,
          status: 'draft',
          total_recipients: selectedPeople.length,
        })
        .select()
        .single();

      if (campaignError) throw campaignError;

      // Create recipients with personalized content
      const recipients = selectedPeople
        .filter(person => person.email) // Only include people with emails
        .map(person => ({
          campaign_id: campaign.id,
          person_id: person.id,
          email: person.email,
          name: `${person.first_name} ${person.last_name}`.trim(),
          personalized_subject: personalizeText(subject, person),
          personalized_body_html: personalizeText(`<p>${body.replace(/\n/g, '</p><p>')}</p>${signatureHtml}`, person),
          personalized_body_text: personalizeText(body + signatureText, person),
          status: 'pending',
        }));

      const { error: recipientsError } = await supabase
        .from('email_campaign_recipients')
        .insert(recipients);

      if (recipientsError) throw recipientsError;

      // Start sending
      toast({
        title: "Campaign created",
        description: "Starting to send emails...",
      });

      // Call edge function to start sending
      const { error: sendError } = await supabase.functions.invoke('send-bulk-emails', {
        body: { campaignId: campaign.id },
      });

      if (sendError) {
        console.error('Send error:', sendError);
        // Don't throw - campaign is created, just mark it
        await supabase
          .from('email_campaigns')
          .update({ status: 'failed' })
          .eq('id', campaign.id);
        
        throw new Error('Failed to start sending emails');
      }

      toast({
        title: "Campaign started",
        description: `Sending emails to ${recipients.length} recipients`,
      });

      onOpenChange(false);
      
      // Reset form
      setCampaignName("");
      setSubject("");
      setBody("");
      setSender("");

    } catch (error: any) {
      console.error('Error creating campaign:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to create campaign",
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  const previewPerson = selectedPeople[0];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Send Bulk Email</DialogTitle>
          <DialogDescription>
            Send personalized emails to {selectedPeople.length} selected {selectedPeople.length === 1 ? 'person' : 'people'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="space-y-2">
            <Label htmlFor="campaign_name">Campaign Name</Label>
            <Input
              id="campaign_name"
              value={campaignName}
              onChange={(e) => setCampaignName(e.target.value)}
              placeholder="e.g., Q1 Outreach Campaign"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="sender">Send From</Label>
            <Select value={sender} onValueChange={setSender}>
              <SelectTrigger id="sender">
                <SelectValue placeholder="Select email account" />
              </SelectTrigger>
              <SelectContent>
                {connections?.map((conn) => (
                  <SelectItem key={conn.id} value={conn.id}>
                    {conn.provider === 'smtp' ? conn.from_email : `${conn.provider} (${(conn.metadata as any)?.email || 'Connected'})`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="subject">Subject Line</Label>
            <Input
              id="subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g., Quick question for {{firstName}}"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="body">Email Body</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => insertVariable('firstName')}
                >
                  +firstName
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => insertVariable('lastName')}
                >
                  +lastName
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => insertVariable('fullName')}
                >
                  +fullName
                </Button>
              </div>
            </div>
            <Textarea
              id="body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Hi {{firstName}},&#10;&#10;I noticed..."
              className="min-h-[200px]"
            />
            <p className="text-xs text-muted-foreground">
              Use variables like {'{{firstName}}'} to personalize emails. Signature will be added automatically.
            </p>
          </div>

          {previewPerson && (
            <div className="rounded-lg border bg-muted/50 p-4 space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Info className="h-4 w-4" />
                Preview for {previewPerson.first_name} {previewPerson.last_name}
              </div>
              <div className="space-y-2 text-sm">
                <div>
                  <strong>Subject:</strong>{' '}
                  {personalizeText(subject, previewPerson) || 'No subject'}
                </div>
                <div>
                  <strong>Body:</strong>
                  <div className="mt-1 whitespace-pre-wrap text-muted-foreground">
                    {personalizeText(body, previewPerson) || 'No body'}
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="rounded-lg border p-4">
            <div className="flex items-center gap-2 mb-3">
              <User className="h-4 w-4" />
              <span className="text-sm font-medium">Selected Recipients</span>
              <Badge variant="secondary">{selectedPeople.length}</Badge>
            </div>
            <div className="max-h-32 overflow-y-auto space-y-1">
              {selectedPeople.map((person) => (
                <div key={person.id} className="text-sm text-muted-foreground">
                  {person.first_name} {person.last_name} {person.email && `(${person.email})`}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={sending}
          >
            Cancel
          </Button>
          <Button onClick={handleSend} disabled={sending}>
            {sending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Send Campaign
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}