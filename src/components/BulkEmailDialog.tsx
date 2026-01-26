import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Send, User, Info, Sparkles, Mail, ChevronDown, Tag, Code, Eye, Bot } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { PersonaSelector, type MarketingPersona } from "./email/PersonaSelector";
import { TagInput } from "@/components/ui/tag-input";
import { useCompanyTags } from "@/hooks/use-company-tags";
import { RichTextEditor } from "./email/RichTextEditor";
import { EmailTemplateSelector, EMAIL_TEMPLATES, type EmailTemplate } from "./email/EmailTemplateSelector";
import { FileAttachmentSelector } from "./email/FileAttachmentSelector";

interface BulkEmailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedPeople: Array<{
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    company_id?: string;
    companies?: {
      id?: string;
      name?: string;
      tags?: string[];
    };
  }>;
}

export default function BulkEmailDialog({ open, onOpenChange, selectedPeople }: BulkEmailDialogProps) {
  const { toast } = useToast();
  const { allSuggestions } = useCompanyTags();
  const [campaignName, setCampaignName] = useState("");
  const [subject, setSubject] = useState("");
  const [bodyHtml, setBodyHtml] = useState("");
  const [bodyText, setBodyText] = useState("");
  const [sender, setSender] = useState<'gmail' | 'gmail_direct' | 'resend' | 'smtp' | 'sendgrid'>('resend');
  const [senderConnectionId, setSenderConnectionId] = useState<string>("");
  const [sending, setSending] = useState(false);
  const [aiContext, setAiContext] = useState("");
  const [generatingAi, setGeneratingAi] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [testEmailDialogOpen, setTestEmailDialogOpen] = useState(false);
  const [testEmailAddress, setTestEmailAddress] = useState("");
  const [sendingTest, setSendingTest] = useState(false);
  const [testRecipientId, setTestRecipientId] = useState<string | null>(null);
  const [selectedPersonaId, setSelectedPersonaId] = useState<string | null>(null);
  const [selectedPersona, setSelectedPersona] = useState<MarketingPersona | null>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [filteredRecipients, setFilteredRecipients] = useState(selectedPeople);
  const [template, setTemplate] = useState<EmailTemplate>('blank');
  const [attachments, setAttachments] = useState<any[]>([]);
  const [enableAutoResponder, setEnableAutoResponder] = useState(false);
  const [generatingPersonalized, setGeneratingPersonalized] = useState(false);
  const [personalizedEmails, setPersonalizedEmails] = useState<Record<string, { subject: string; bodyHtml: string; bodyText: string }>>({});
  const [usePersonalizedEmails, setUsePersonalizedEmails] = useState(false);

  // Fetch email connections
  const { data: connections } = useQuery({
    queryKey: ['crm-connections'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('crm_connections')
        .select('*')
        .eq('status', 'active')
        .in('provider', ['gmail', 'gmail_direct', 'outlook', 'smtp', 'resend', 'sendgrid'])
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
  });

  // Fetch business profile for sender display
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

  // Set default sender when connections load
  useEffect(() => {
    if (connections && connections.length > 0 && !senderConnectionId) {
      // Prefer resend, then sendgrid, then gmail, then smtp
      const preferred = connections.find(c => c.provider === 'resend') ||
                       connections.find(c => c.provider === 'sendgrid') ||
                       connections.find(c => c.provider === 'gmail' || c.provider === 'gmail_direct') ||
                       connections.find(c => c.provider === 'smtp') ||
                       connections[0];
      
      if (preferred) {
        setSenderConnectionId(preferred.id);
        setSender(preferred.provider as 'gmail' | 'gmail_direct' | 'resend' | 'smtp' | 'sendgrid');
      }
    }
  }, [connections, senderConnectionId]);

  // Fetch companies with tags for filtering
  const { data: companiesWithTags } = useQuery({
    queryKey: ['companies-for-tag-filter'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('companies')
        .select('id, name, tags');
      if (error) throw error;
      return data || [];
    },
  });

  // Collect all available tags from multiple sources
  const allAvailableTags = new Set<string>();
  
  // Add suggestions from useCompanyTags hook
  (allSuggestions || []).forEach(tag => allAvailableTags.add(tag));
  
  // Add tags from companies
  (companiesWithTags || []).forEach(company => {
    (company.tags || []).forEach((tag: string) => {
      if (tag && typeof tag === 'string') allAvailableTags.add(tag);
    });
  });
  
  // Add tags from selected people (if they have tags property)
  selectedPeople.forEach((person: any) => {
    if (person.tags && Array.isArray(person.tags)) {
      person.tags.forEach((tag: string) => {
        if (tag && typeof tag === 'string') allAvailableTags.add(tag);
      });
    }
    // Also check company tags if person has companies relation
    if (person.companies?.tags && Array.isArray(person.companies.tags)) {
      person.companies.tags.forEach((tag: string) => {
        if (tag && typeof tag === 'string') allAvailableTags.add(tag);
      });
    }
  });

  // Filter recipients by selected tags (check both person tags and company tags)
  useEffect(() => {
    if (selectedTags.length === 0) {
      setFilteredRecipients(selectedPeople);
      return;
    }

    // Get company IDs that match selected tags
    const matchingCompanyIds = new Set(
      (companiesWithTags || [])
        .filter(company => {
          const companyTags = company.tags || [];
          return selectedTags.some(tag => companyTags.includes(tag));
        })
        .map(company => company.id)
    );

    // Filter people whose companies OR person tags match the selected tags
    const filtered = selectedPeople.filter((person: any) => {
      // Check person's own tags
      const personTags = person.tags || [];
      const hasPersonTag = selectedTags.some(tag => personTags.includes(tag));
      
      // Check company tags
      const hasCompanyTag = person.company_id && matchingCompanyIds.has(person.company_id);
      
      return hasPersonTag || hasCompanyTag;
    });

    setFilteredRecipients(filtered);
  }, [selectedTags, selectedPeople, companiesWithTags]);

  // Personalize text with variables
  const personalizeText = (template: string, person: typeof selectedPeople[0]) => {
    return template
      .replace(/\{\{firstName\}\}/g, person.first_name || '')
      .replace(/\{\{lastName\}\}/g, person.last_name || '')
      .replace(/\{\{fullName\}\}/g, `${person.first_name} ${person.last_name}`.trim() || '');
  };

  const handlePersonaChange = (persona: MarketingPersona | null, personaContext: string) => {
    setSelectedPersonaId(persona?.id || null);
    setSelectedPersona(persona);
    if (personaContext) {
      setAiContext(personaContext);
    }
  };

  const handleGenerateWithAI = async () => {
    if (selectedPeople.length === 0) {
      toast({
        title: "No recipients",
        description: "Please select at least one person to generate email for",
        variant: "destructive",
      });
      return;
    }

    try {
      setGeneratingAi(true);
      const firstPerson = selectedPeople[0];
      const companyData = firstPerson.company_id && companiesData?.[firstPerson.company_id];
      
      const { data, error } = await supabase.functions.invoke('generate-email-with-ai', {
        body: {
          recipientName: `${firstPerson.first_name} ${firstPerson.last_name}`.trim(),
          recipientEmail: firstPerson.email,
          companyId: firstPerson.company_id,
          companyData: companyData ? {
            name: companyData.name,
            description: companyData.description,
            industry: companyData.industry,
            website: companyData.website,
            enrichment_data: companyData.enrichment_data,
            recent_news: companyData.recent_news,
            funding_stage: companyData.funding_stage,
            funding_total: companyData.funding_total,
            employee_count: companyData.employee_count,
            tech_stack: companyData.tech_stack,
            key_executives: companyData.key_executives,
          } : undefined,
          context: aiContext || undefined,
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
          title: "Email generated",
          description: "AI has generated your email content. You can edit it before sending.",
        });
      }
    } catch (error: any) {
      console.error('Error generating email:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to generate email with AI",
        variant: "destructive",
      });
    } finally {
      setGeneratingAi(false);
    }
  };

  const handleGeneratePersonalizedForAll = async () => {
    const recipientsToUse = selectedTags.length > 0 ? filteredRecipients : selectedPeople;
    
    if (recipientsToUse.length === 0) {
      toast({
        title: "No recipients",
        description: "Please select at least one person to generate emails for",
        variant: "destructive",
      });
      return;
    }

    if (recipientsToUse.length > 100) {
      toast({
        title: "Too many recipients",
        description: "Please select 100 or fewer recipients for personalized email generation. For larger campaigns, consider using the template-based approach.",
        variant: "destructive",
      });
      return;
    }

    try {
      setGeneratingPersonalized(true);
      
      // Prepare recipients with company data and tags
      const recipientsWithCompanyData = recipientsToUse.map((person: any) => {
        const companyData = person.company_id && companiesData?.[person.company_id];
        const personTags = (person.tags && Array.isArray(person.tags)) ? person.tags : [];
        const companyTags = (person.companies?.tags && Array.isArray(person.companies.tags)) ? person.companies.tags : [];
        const allPersonTags = [...personTags, ...companyTags];
        
        return {
          personId: person.id,
          firstName: person.first_name,
          lastName: person.last_name,
          email: person.email,
          companyId: person.company_id,
          tags: allPersonTags, // Include tags for AI personalization
          companyData: companyData ? {
            name: companyData.name,
            description: companyData.description,
            industry: companyData.industry,
            website: companyData.website,
            enrichment_data: companyData.enrichment_data,
            recent_news: companyData.recent_news,
            funding_stage: companyData.funding_stage,
            funding_total: companyData.funding_total,
            employee_count: companyData.employee_count,
            tech_stack: companyData.tech_stack,
            key_executives: companyData.key_executives,
            tags: companyData.tags || [], // Include company tags
          } : undefined,
        };
      });

      const { data, error } = await supabase.functions.invoke('generate-bulk-personalized-emails', {
        body: {
          recipients: recipientsWithCompanyData,
          context: aiContext || undefined,
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

      if (data?.emails && Array.isArray(data.emails)) {
        const emailsMap: Record<string, { subject: string; bodyHtml: string; bodyText: string }> = {};
        data.emails.forEach((email: any) => {
          if (email.personId) {
            emailsMap[email.personId] = {
              subject: email.subject,
              bodyHtml: email.bodyHtml || `<p>${email.body.replace(/\n/g, '</p><p>')}</p>`,
              bodyText: email.body || email.bodyText,
            };
          }
        });

        setPersonalizedEmails(emailsMap);
        setUsePersonalizedEmails(true);
        
        toast({
          title: "Personalized emails generated",
          description: `Generated unique emails for ${Object.keys(emailsMap).length} recipients based on their company information`,
        });
      }
    } catch (error: any) {
      console.error('Error generating personalized emails:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to generate personalized emails",
        variant: "destructive",
      });
    } finally {
      setGeneratingPersonalized(false);
    }
  };

  const handleSendTest = async () => {
    if (!testEmailAddress.trim()) {
      toast({
        title: "Missing email",
        description: "Please enter a test email address",
        variant: "destructive",
      });
      return;
    }

    if (!senderConnectionId) {
      toast({
        title: "No sender",
        description: "Please select an email account",
        variant: "destructive",
      });
      return;
    }

    const recipientsToUse = selectedTags.length > 0 ? filteredRecipients : selectedPeople;
    
    if (recipientsToUse.length === 0) {
      toast({
        title: "No recipients",
        description: "Please select at least one person for personalization context",
        variant: "destructive",
      });
      return;
    }

    // Determine which recipient to use for testing
    const testPerson = testRecipientId 
      ? recipientsToUse.find(p => p.id === testRecipientId) || recipientsToUse[0]
      : recipientsToUse[0];

    // Check if we have personalized email for this recipient
    const hasPersonalizedEmail = usePersonalizedEmails && personalizedEmails[testPerson.id];

    if (!hasPersonalizedEmail && (!subject.trim() || !bodyText.trim())) {
      toast({
        title: "Missing content",
        description: "Please fill in subject and body, or generate personalized emails first",
        variant: "destructive",
      });
      return;
    }

    try {
      setSendingTest(true);

      // Get user profile for signature
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

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

      // Use personalized email if available, otherwise use template with variables
      let testSubject: string;
      let testBodyHtml: string;
      let testBodyText: string;

      if (hasPersonalizedEmail) {
        const personalized = personalizedEmails[testPerson.id];
        testSubject = personalized.subject;
        testBodyHtml = personalized.bodyHtml + signatureHtml;
        testBodyText = personalized.bodyText + signatureText;
      } else {
        testSubject = personalizeText(subject, testPerson);
        testBodyHtml = personalizeText(bodyHtml || `<p>${bodyText.replace(/\n/g, '</p><p>')}</p>`, testPerson) + signatureHtml;
        testBodyText = personalizeText(bodyText, testPerson) + signatureText;
      }

      const { error } = await supabase.functions.invoke('send-crm-email', {
        body: {
          toEmail: testEmailAddress,
          toName: 'Test Recipient',
          subject: testSubject,
          bodyHtml: testBodyHtml,
          bodyText: testBodyText,
          sender,
          attachments: attachments.length > 0 ? attachments : undefined,
        },
      });

      if (error) throw error;

      toast({
        title: "Test email sent",
        description: `Test email sent to ${testEmailAddress}${hasPersonalizedEmail ? ` (personalized for ${testPerson.first_name} ${testPerson.last_name})` : ` (template-based for ${testPerson.first_name} ${testPerson.last_name})`}`,
      });

      setTestEmailDialogOpen(false);
      setTestEmailAddress("");
      setTestRecipientId(null);
    } catch (error: any) {
      console.error('Error sending test email:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to send test email",
        variant: "destructive",
      });
    } finally {
      setSendingTest(false);
    }
  };

  const handleSend = async () => {
    if (!campaignName.trim() || !subject.trim() || !bodyText.trim()) {
      toast({
        title: "Missing fields",
        description: "Please fill in campaign name, subject, and body",
        variant: "destructive",
      });
      return;
    }

    if (!senderConnectionId) {
      toast({
        title: "No sender selected",
        description: "Please select an email account to send from",
        variant: "destructive",
      });
      return;
    }

    const recipientsToUse = selectedTags.length > 0 ? filteredRecipients : selectedPeople;
    
    if (recipientsToUse.length === 0) {
      toast({
        title: "No recipients",
        description: selectedTags.length > 0 
          ? "No recipients match the selected tags. Please adjust your tag filters."
          : "Please select at least one person to send to",
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

      // Create campaign with tags (use selected tags for campaign categorization)
      const campaignTags = selectedTags.length > 0 ? selectedTags : null;
      
      const { data: campaign, error: campaignError } = await supabase
        .from('email_campaigns')
        .insert({
          user_id: user.id,
          name: campaignName,
          subject_template: subject,
          body_html_template: (bodyHtml || `<p>${bodyText.replace(/\n/g, '</p><p>')}</p>`) + signatureHtml,
          body_text_template: bodyText + signatureText,
          sender_connection_id: senderConnectionId,
          status: 'draft',
          total_recipients: recipientsToUse.length,
          tags: campaignTags, // Store tags with campaign for future filtering
        })
        .select()
        .single();

      if (campaignError) throw campaignError;

      // Create recipients with personalized content
      const recipients = recipientsToUse
        .filter(person => person.email) // Only include people with emails
        .map(person => ({
          campaign_id: campaign.id,
          person_id: person.id,
          email: person.email,
          name: `${person.first_name} ${person.last_name}`.trim(),
          personalized_subject: personalizeText(subject, person),
          personalized_body_html: personalizeText((bodyHtml || `<p>${bodyText.replace(/\n/g, '</p><p>')}</p>`) + signatureHtml, person),
          personalized_body_text: personalizeText(bodyText + signatureText, person),
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

      // Call edge function to start sending (with attachments if any)
      const { error: sendError } = await supabase.functions.invoke('send-bulk-emails', {
        body: { 
          campaignId: campaign.id,
          attachments: attachments.length > 0 ? attachments : undefined,
        },
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
      setBodyHtml("");
      setBodyText("");
      setSenderConnectionId("");
      setSelectedTags([]);
      setTemplate('blank');
      setAttachments([]);
      setEnableAutoResponder(false);
      setPersonalizedEmails({});
      setUsePersonalizedEmails(false);

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
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle>Send Bulk Email</DialogTitle>
          <DialogDescription>
            Send personalized emails to {selectedTags.length > 0 ? filteredRecipients.length : selectedPeople.length} {selectedTags.length > 0 ? 'filtered' : 'selected'} {selectedPeople.length === 1 ? 'person' : 'people'}
            {selectedTags.length > 0 && (
              <span className="text-muted-foreground"> (filtered by {selectedTags.length} tag{selectedTags.length > 1 ? 's' : ''})</span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          <div className="space-y-6">
          {/* Tag Filter - Enhanced for Visibility */}
          <div className="space-y-3 rounded-lg border bg-muted/30 p-4">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-2 text-base font-semibold">
                <Tag className="h-5 w-5 text-primary" />
                Filter & Personalize by Tags
              </Label>
              {selectedTags.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() => setSelectedTags([])}
                >
                  Clear All
                </Button>
              )}
            </div>
            <div className="space-y-2">
              <TagInput
                tags={selectedTags}
                onTagsChange={setSelectedTags}
                suggestions={Array.from(allAvailableTags).sort()}
                placeholder="Type to search tags (e.g., translational services, mosque, SaaS, FinTech)..."
                maxTags={20}
              />
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Info className="h-3 w-3" />
                <span>
                  {allAvailableTags.size > 0 
                    ? `${allAvailableTags.size} tags available. Tags help filter recipients AND personalize emails based on their industry/business type.`
                    : 'No tags found. Tags will be available after companies are enriched.'}
                </span>
              </div>
            </div>
            {selectedTags.length > 0 && (
              <div className="space-y-2 pt-2 border-t">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">
                    Filtered Recipients: {filteredRecipients.length} of {selectedPeople.length}
                  </span>
                  <Badge variant="secondary" className="gap-1">
                    <Tag className="h-3 w-3" />
                    {selectedTags.length} tag{selectedTags.length > 1 ? 's' : ''} selected
                  </Badge>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {selectedTags.map((tag) => (
                    <Badge key={tag} variant="default" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>
                {filteredRecipients.length === 0 && (
                  <p className="text-xs text-amber-600 font-medium">
                    ⚠️ No recipients match the selected tags. Clear tags or select different tags.
                  </p>
                )}
                {filteredRecipients.length > 0 && (
                  <p className="text-xs text-green-600 dark:text-green-400">
                    ✓ {filteredRecipients.length} recipient{filteredRecipients.length > 1 ? 's' : ''} will receive personalized emails based on their tags and company information.
                  </p>
                )}
              </div>
            )}
          </div>
          {/* AI Email Generator */}
          <Collapsible open={aiOpen} onOpenChange={setAiOpen}>
            <div className="rounded-lg border bg-gradient-to-br from-primary/5 to-primary/10 p-4">
              <CollapsibleTrigger asChild>
                <Button
                  variant="ghost"
                  className="w-full flex items-center justify-between p-0 h-auto hover:bg-transparent"
                >
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-primary" />
                    <span className="font-medium">AI Email Generator</span>
                  </div>
                  <ChevronDown className={`h-4 w-4 transition-transform ${aiOpen ? 'rotate-180' : ''}`} />
                </Button>
              </CollapsibleTrigger>
              
              <CollapsibleContent className="space-y-3 mt-4">
                <PersonaSelector
                  value={selectedPersonaId}
                  onChange={handlePersonaChange}
                  disabled={generatingAi}
                />

                <div className="space-y-2">
                  <Label htmlFor="ai_context">Additional Context {selectedPersona ? '(auto-filled from persona)' : '(Optional)'}</Label>
                  <Textarea
                    id="ai_context"
                    value={aiContext}
                    onChange={(e) => setAiContext(e.target.value)}
                    placeholder="e.g., Focus on our new AI features, mention their recent Series A funding..."
                    className="min-h-[80px] bg-background"
                  />
                  <p className="text-xs text-muted-foreground">
                    {selectedPersona 
                      ? `Using "${selectedPersona.name}" persona marketing context` 
                      : 'Provide additional context to help AI personalize the email'}
                  </p>
                </div>
                
                {previewPerson && (
                  <div className="rounded-md bg-muted/50 p-3 text-sm">
                    <p className="text-muted-foreground">
                      <strong>Using context from:</strong> {previewPerson.first_name} {previewPerson.last_name}
                    </p>
                  </div>
                )}

                <div className="space-y-2">
                <Button
                  onClick={handleGenerateWithAI}
                    disabled={generatingAi || generatingPersonalized || selectedPeople.length === 0}
                  className="w-full"
                >
                  {generatingAi ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4 mr-2" />
                        Generate Email Template (Single)
                    </>
                  )}
                </Button>
                  
                  <Button
                    onClick={handleGeneratePersonalizedForAll}
                    disabled={generatingAi || generatingPersonalized || (selectedTags.length > 0 ? filteredRecipients.length : selectedPeople.length) === 0}
                    variant="outline"
                    className="w-full"
                  >
                    {generatingPersonalized ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Generating for {selectedTags.length > 0 ? filteredRecipients.length : selectedPeople.length} recipients...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4 mr-2" />
                        Generate Personalized Emails for All ({selectedTags.length > 0 ? filteredRecipients.length : selectedPeople.length})
                      </>
                    )}
                  </Button>
                  {usePersonalizedEmails && Object.keys(personalizedEmails).length > 0 && (
                    <p className="text-xs text-green-600 dark:text-green-400">
                      ✓ {Object.keys(personalizedEmails).length} personalized emails ready. Each email is customized based on company information.
                    </p>
                  )}
                </div>
              </CollapsibleContent>
            </div>
          </Collapsible>

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
            <Select 
              value={senderConnectionId} 
              onValueChange={(value) => {
                const conn = connections?.find(c => c.id === value);
                if (conn) {
                  setSenderConnectionId(conn.id);
                  setSender(conn.provider as 'gmail' | 'gmail_direct' | 'resend' | 'smtp' | 'sendgrid');
                }
              }}
            >
              <SelectTrigger id="sender">
                <SelectValue placeholder="Select email account" />
              </SelectTrigger>
              <SelectContent>
                {connections?.some(c => c.provider === 'resend' && c.status === 'active') && (
                  <SelectItem value={connections.find(c => c.provider === 'resend')?.id || ''}>
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
                  <SelectItem value={connections.find(c => c.provider === 'sendgrid')?.id || ''}>
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
                  <SelectItem value={connections.find(c => c.provider === 'gmail' || c.provider === 'gmail_direct')?.id || ''}>
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
                  <SelectItem value={connections.find(c => c.provider === 'smtp')?.id || ''}>
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
              disabled={sending || generatingAi}
            />
          </div>

          <EmailTemplateSelector
            value={template}
            onChange={setTemplate}
            disabled={sending || generatingAi}
          />

          <FileAttachmentSelector
            selectedFiles={attachments}
            onFilesChange={setAttachments}
            disabled={sending || generatingAi}
          />

          <div className="space-y-2">
            <Label htmlFor="subject">Subject Line</Label>
            <Input
              id="subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g., Quick question for {{firstName}}"
            />
          </div>

          <div className="flex justify-between items-center">
            <Label>Email Content</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setTestEmailDialogOpen(true)}
                disabled={sending || (!subject.trim() && !usePersonalizedEmails) || (!bodyText.trim() && !usePersonalizedEmails) || !senderConnectionId}
                className="border-primary/50 hover:bg-primary/10"
              >
                <Mail className="mr-2 h-3 w-3" />
                Test Email
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleGenerateWithAI}
                disabled={generatingAi || sending || selectedPeople.length === 0}
              >
                {generatingAi ? (
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
                disabled={sending || generatingAi}
              placeholder="Hi {{firstName}},&#10;&#10;I noticed..."
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
                disabled={sending || generatingAi}
                rows={12}
                className="resize-none font-mono text-sm"
              />
            </TabsContent>
          </Tabs>
            <p className="text-xs text-muted-foreground">
            Use variables like {'{{firstName}}'}, {'{{lastName}}'}, {'{{fullName}}'} to personalize emails. Signature will be added automatically.
            </p>

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
                  <div className="mt-1 whitespace-pre-wrap text-muted-foreground" dangerouslySetInnerHTML={{ __html: personalizeText(bodyHtml || `<p>${bodyText.replace(/\n/g, '</p><p>')}</p>`, previewPerson) || 'No body' }} />
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
        </div>

        <div className="flex justify-between gap-3 px-6 pb-6 pt-4 border-t shrink-0 bg-muted/30">
          <Button
            variant="outline"
            onClick={() => setTestEmailDialogOpen(true)}
            disabled={sending || (!subject.trim() && !usePersonalizedEmails) || (!bodyText.trim() && !usePersonalizedEmails) || !senderConnectionId}
            className="border-primary/50 hover:bg-primary/10"
          >
            <Mail className="h-4 w-4 mr-2" />
            Send Test Email
            {(!subject.trim() || !bodyText.trim() || !senderConnectionId) && !usePersonalizedEmails && (
              <span className="ml-2 text-xs text-muted-foreground">(Fill subject & body first)</span>
            )}
          </Button>
          
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={sending}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleSend} 
              disabled={sending || !campaignName.trim() || (!subject.trim() && !usePersonalizedEmails) || (!bodyText.trim() && !usePersonalizedEmails) || !senderConnectionId}
            >
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
        </div>
        
        {/* Test Email Dialog */}
        <AlertDialog open={testEmailDialogOpen} onOpenChange={(open) => {
          setTestEmailDialogOpen(open);
          if (!open) {
            setTestEmailAddress("");
            setTestRecipientId(null);
          }
        }}>
          <AlertDialogContent className="sm:max-w-[500px]">
            <AlertDialogHeader>
              <AlertDialogTitle>Send Test Email</AlertDialogTitle>
              <AlertDialogDescription>
                Send a test email to preview how your campaign will look. {usePersonalizedEmails && Object.keys(personalizedEmails).length > 0 
                  ? 'You can select which recipient\'s personalized email to test.'
                  : 'The email will use the template with variables personalized for the selected recipient.'}
              </AlertDialogDescription>
            </AlertDialogHeader>
            
            <div className="space-y-4 py-4">
              <div className="space-y-2">
              <Label htmlFor="test_email">Test Email Address</Label>
              <Input
                id="test_email"
                type="email"
                value={testEmailAddress}
                onChange={(e) => setTestEmailAddress(e.target.value)}
                placeholder="your@email.com"
              />
              </div>

              {(selectedTags.length > 0 ? filteredRecipients : selectedPeople).length > 1 && (
                <div className="space-y-2">
                  <Label htmlFor="test_recipient">Test With Recipient (Optional)</Label>
                  <Select
                    value={testRecipientId || (selectedTags.length > 0 ? filteredRecipients[0]?.id : selectedPeople[0]?.id) || ''}
                    onValueChange={(value) => setTestRecipientId(value)}
                  >
                    <SelectTrigger id="test_recipient">
                      <SelectValue placeholder="Select recipient..." />
                    </SelectTrigger>
                    <SelectContent>
                      {(selectedTags.length > 0 ? filteredRecipients : selectedPeople).map((person) => {
                        const hasPersonalized = usePersonalizedEmails && personalizedEmails[person.id];
                        return (
                          <SelectItem key={person.id} value={person.id}>
                            <div className="flex items-center justify-between w-full">
                              <span>
                                {person.first_name} {person.last_name}
                                {person.companies?.name && ` (${person.companies.name})`}
                              </span>
                              {hasPersonalized && (
                                <Badge variant="secondary" className="ml-2 text-xs">
                                  Personalized
                                </Badge>
                              )}
                            </div>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    {(() => {
                      const selectedRecipient = testRecipientId 
                        ? (selectedTags.length > 0 ? filteredRecipients : selectedPeople).find(p => p.id === testRecipientId)
                        : (selectedTags.length > 0 ? filteredRecipients : selectedPeople)[0];
                      const hasPersonalized = selectedRecipient && usePersonalizedEmails && personalizedEmails[selectedRecipient.id];
                      return hasPersonalized 
                        ? `✓ Will send personalized email for ${selectedRecipient?.first_name} ${selectedRecipient?.last_name}`
                        : `Will send template-based email personalized for ${selectedRecipient?.first_name} ${selectedRecipient?.last_name}`;
                    })()}
                  </p>
                </div>
              )}

              {usePersonalizedEmails && Object.keys(personalizedEmails).length > 0 && (
                <div className="rounded-lg border bg-muted/50 p-3">
                  <div className="flex items-center gap-2 text-sm">
                    <Sparkles className="h-4 w-4 text-primary" />
                    <span className="font-medium">
                      {Object.keys(personalizedEmails).length} personalized emails available
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Each recipient will receive a unique email customized based on their company information.
                  </p>
                </div>
              )}
            </div>

            <AlertDialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setTestEmailDialogOpen(false);
                  setTestEmailAddress("");
                  setTestRecipientId(null);
                }}
                disabled={sendingTest}
              >
                Cancel
              </Button>
              <Button onClick={handleSendTest} disabled={sendingTest || !testEmailAddress.trim()}>
                {sendingTest ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Mail className="h-4 w-4 mr-2" />
                    Send Test Email
                  </>
                )}
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DialogContent>
    </Dialog>
  );
}