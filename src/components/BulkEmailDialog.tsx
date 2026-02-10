import { useState, useEffect, useMemo, useRef } from "react";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Send, User, Info, Sparkles, Mail, ChevronDown, Tag, Code, Eye, Bot, Calendar as CalendarIcon, Clock, X, Save, FileText } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { PersonaSelector, type MarketingPersona } from "./email/PersonaSelector";
import { TagInput } from "@/components/ui/tag-input";
import { useCompanyTags } from "@/hooks/use-company-tags";
import { RichTextEditor } from "./email/RichTextEditor";
import { EmailTemplateSelector, EMAIL_TEMPLATES, type EmailTemplate } from "./email/EmailTemplateSelector";
import { FileAttachmentSelector } from "./email/FileAttachmentSelector";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";

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
  initialDraftId?: string | null; // Optional: draft ID to auto-load when dialog opens
}

export default function BulkEmailDialog({ open, onOpenChange, selectedPeople, initialDraftId }: BulkEmailDialogProps) {
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
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [scheduledDate, setScheduledDate] = useState<Date | undefined>(undefined);
  const [scheduledTime, setScheduledTime] = useState<string>("09:00");
  const [scheduledTimezone, setScheduledTimezone] = useState<string>(() => {
    // Get user's timezone or default to UTC
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
      return 'UTC';
    }
  });
  const [excludedCampaignIds, setExcludedCampaignIds] = useState<string[]>([]);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [savingDraft, setSavingDraft] = useState(false);
  const [loadDraftOpen, setLoadDraftOpen] = useState(false);

  // Fetch previous campaigns for exclusion
  const { data: previousCampaigns } = useQuery({
    queryKey: ['previous-campaigns'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data, error } = await supabase
        .from('email_campaigns')
        .select('id, name, created_at, total_recipients')
        .eq('user_id', user.id)
        .in('status', ['completed', 'scheduled', 'sending'])
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        console.error('Error fetching campaigns:', error);
        return [];
      }

      return data || [];
    },
    enabled: open,
  });

  // Get recipients who received emails from excluded campaigns
  const { data: excludedRecipients } = useQuery({
    queryKey: ['excluded-recipients', excludedCampaignIds.sort().join(',')],
    queryFn: async () => {
      if (excludedCampaignIds.length === 0) return new Set<string>();

      const { data, error } = await supabase
        .from('email_campaign_recipients')
        .select('person_id, email')
        .in('campaign_id', excludedCampaignIds)
        .in('status', ['sent', 'opened', 'clicked']);

      if (error) {
        console.error('Error fetching excluded recipients:', error);
        return new Set<string>();
      }

      // Create a set of person IDs and emails to exclude
      const excludedSet = new Set<string>();
      (data || []).forEach((recipient: any) => {
        if (recipient.person_id) {
          excludedSet.add(recipient.person_id);
        }
        if (recipient.email) {
          excludedSet.add(recipient.email.toLowerCase().trim());
        }
      });

      return excludedSet;
    },
    enabled: excludedCampaignIds.length > 0 && open,
  });

  // Get recipients to use (filtered by tags and excluded campaigns)
  // Note: This must be after excludedRecipients query but before duplicateRecipients query
  // When a draft is loaded (draftId exists), use filteredRecipients which includes draft recipients
  // Otherwise, use selectedPeople when no tag filters, or filteredRecipients when tag filters are active
  const recipientsToUse = useMemo(() => {
    let baseRecipients: typeof selectedPeople;
    
    // If draft is loaded, always use filteredRecipients (includes draft recipients + newly added people)
    // Otherwise, use selectedPeople when no tag filters, or filteredRecipients when tag filters are active
    if (draftId) {
      baseRecipients = filteredRecipients;
    } else {
      baseRecipients = selectedTags.length > 0 ? filteredRecipients : selectedPeople;
    }
    
    // Filter out recipients from excluded campaigns
    if (excludedRecipients && excludedRecipients.size > 0) {
      baseRecipients = baseRecipients.filter((person: any) => {
        // Check by person ID
        if (person.id && excludedRecipients.has(person.id)) {
          return false;
        }
        // Check by email
        if (person.email && excludedRecipients.has(person.email.toLowerCase().trim())) {
          return false;
        }
        return true;
      });
    }
    
    return baseRecipients;
  }, [selectedTags, filteredRecipients, selectedPeople, excludedRecipients, draftId]);

  // Check for duplicate emails (people who already received emails in previous campaigns)
  const { data: duplicateRecipients } = useQuery({
    queryKey: ['duplicate-recipients', recipientsToUse.map(p => p.id).sort().join(',')],
    queryFn: async () => {
      if (recipientsToUse.length === 0) return [];
      
      const personIds = recipientsToUse
        .filter(p => p.id)
        .map(p => p.id);
      
      if (personIds.length === 0) return [];

      // Get user to filter by user's campaigns only
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      // Query for recipients that have already been sent emails
      // Check by person_id (primary method)
      const { data, error } = await supabase
        .from('email_campaign_recipients')
        .select(`
          person_id,
          email,
          status,
          sent_at,
          email_campaigns!inner (
            id,
            name,
            created_at,
            user_id
          )
        `)
        .in('person_id', personIds)
        .in('status', ['sent', 'opened', 'clicked'])
        .eq('email_campaigns.user_id', user.id)
        .order('sent_at', { ascending: false });

      if (error) {
        console.error('Error checking duplicates:', error);
        return [];
      }

      // Group by person_id or email to get the most recent campaign for each person
      const duplicatesMap = new Map<string, any>();
      if (data) {
        data.forEach((recipient: any) => {
          // Use person_id as primary key, fallback to email
          const key = recipient.person_id || recipient.email?.toLowerCase().trim();
          if (key && !duplicatesMap.has(key)) {
            duplicatesMap.set(key, {
              personId: recipient.person_id,
              email: recipient.email,
              status: recipient.status,
              sentAt: recipient.sent_at,
              campaignName: recipient.email_campaigns?.name,
              campaignId: recipient.email_campaigns?.id,
              campaignCreatedAt: recipient.email_campaigns?.created_at,
            });
          }
        });
      }

      return Array.from(duplicatesMap.values());
    },
    enabled: recipientsToUse.length > 0 && open,
  });

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
        .select('company_name, email_template_style, email_logo_url, email_brand_color, email_footer_text, email_signature')
        .eq('user_id', user.id)
        .maybeSingle();
      return data;
    },
  });
  // Fetch draft campaigns for loading
  const { data: draftCampaigns } = useQuery({
    queryKey: ['draft-campaigns'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data, error } = await supabase
        .from('email_campaigns')
        .select('id, name, created_at, updated_at, total_recipients, subject_template, body_html_template, body_text_template, sender_connection_id, scheduled_at, tags')
        .eq('user_id', user.id)
        .eq('status', 'draft')
        .order('updated_at', { ascending: false })
        .limit(50);

      if (error) {
        console.error('Error fetching drafts:', error);
        return [];
      }

      return data || [];
    },
    enabled: open,
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

  // Clear draftId when dialog closes
  // Track previous selectedPeople to detect when new people are added while dialog is open
  const prevSelectedPeopleRef = useRef<typeof selectedPeople>(selectedPeople);
  const hasAutoLoadedDraft = useRef(false);

  useEffect(() => {
    if (!open) {
      setDraftId(null);
      setLoadDraftOpen(false);
      prevSelectedPeopleRef.current = selectedPeople;
      hasAutoLoadedDraft.current = false; // Reset when dialog closes
    } else {
      // When dialog opens, initialize filteredRecipients with selectedPeople
      if (prevSelectedPeopleRef.current.length === 0 && selectedPeople.length > 0) {
        setFilteredRecipients(selectedPeople);
      } else if (selectedPeople.length > prevSelectedPeopleRef.current.length) {
        // Dialog is already open and new people were added - merge into filteredRecipients
        // This preserves draft recipients while adding newly selected people
        setFilteredRecipients(prev => {
          const existingIds = new Set(prev.map(p => p.id));
          const newPeople = selectedPeople.filter(p => !existingIds.has(p.id));
          return newPeople.length > 0 ? [...prev, ...newPeople] : prev;
        });
      }
      prevSelectedPeopleRef.current = selectedPeople;
    }
  }, [open, selectedPeople]);

  // Auto-load draft when initialDraftId is provided
  useEffect(() => {
    if (open && initialDraftId && !hasAutoLoadedDraft.current) {
      // Fetch draft data directly
      const loadDraftById = async () => {
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) return;

          const { data: draftData, error } = await supabase
            .from('email_campaigns')
            .select('id, name, created_at, updated_at, total_recipients, subject_template, body_html_template, body_text_template, sender_connection_id, scheduled_at, tags')
            .eq('id', initialDraftId)
            .eq('status', 'draft')
            .single();

          if (error || !draftData) {
            console.error('Error fetching draft:', error);
            toast({
              title: "Error",
              description: "Failed to load draft. It may have been deleted or is no longer a draft.",
              variant: "destructive",
            });
            return;
          }

          hasAutoLoadedDraft.current = true;
          // Use setTimeout to ensure dialog is fully open before loading
          setTimeout(() => {
            handleLoadDraft(draftData);
          }, 150);
        } catch (error) {
          console.error('Error loading draft:', error);
          toast({
            title: "Error",
            description: "Failed to load draft",
            variant: "destructive",
          });
        }
      };

      // Try to find in draftCampaigns first (faster), otherwise fetch directly
      if (draftCampaigns && draftCampaigns.length > 0) {
        const draftToLoad = draftCampaigns.find((d: any) => d.id === initialDraftId);
        if (draftToLoad) {
          hasAutoLoadedDraft.current = true;
          setTimeout(() => {
            handleLoadDraft(draftToLoad);
          }, 150);
        } else {
          // Not in the list, fetch it directly
          loadDraftById();
        }
      } else {
        // Drafts not loaded yet, fetch directly
        loadDraftById();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialDraftId, draftCampaigns]);

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

  // Fetch full company data for selected people's companies
  const companyIds = Array.from(new Set(
    selectedPeople
      .map(p => p.company_id)
      .filter(Boolean) as string[]
  ));

  const { data: companiesDataArray } = useQuery({
    queryKey: ['companies-data-for-email', companyIds],
    queryFn: async () => {
      if (companyIds.length === 0) return [];
      
      const { data, error } = await supabase
        .from('companies')
        .select('id, name, description, industry, website, enrichment_data, recent_news, funding_stage, funding_total, employee_count, tech_stack, key_executives, tags')
        .in('id', companyIds);
      
      if (error) throw error;
      return data || [];
    },
    enabled: companyIds.length > 0,
  });

  // Create a map of company_id -> company data for easy lookup
  // First, use company data from people.companies if available (for companies page flow)
  // Then merge with queried data for completeness
  const companiesData = useMemo(() => {
    const map: Record<string, any> = {};
    
    // First, extract company data from people.companies (includes overview and tags)
    selectedPeople.forEach((person: any) => {
      if (person.company_id && person.companies) {
        map[person.company_id] = {
          ...person.companies, // This includes all company overview data and tags
        };
      }
    });
    
    // Then merge with queried data (for fresh data or missing fields)
    if (companiesDataArray) {
      companiesDataArray.forEach(company => {
        if (company.id) {
          map[company.id] = {
            ...map[company.id], // Preserve data from people.companies
            ...company, // Override with fresh queried data
          };
        }
      });
    }
    
    return map;
  }, [companiesDataArray, selectedPeople]);

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

  // Personalize text with variables (case-insensitive to match {{firstName}}, {{FirstName}}, etc.)
  const personalizeText = (template: string, person: typeof selectedPeople[0]) => {
    return template
      .replace(/\{\{firstName\}\}/gi, person.first_name || '')
      .replace(/\{\{lastName\}\}/gi, person.last_name || '')
      .replace(/\{\{fullName\}\}/gi, `${person.first_name} ${person.last_name}`.trim() || '');
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
        description: `Personalized email generation is limited to 100 recipients. You selected ${recipientsToUse.length}. Please reduce the selection or use the template-based approach for larger campaigns.`,
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

  const handleSaveDraft = async () => {
    if (!campaignName.trim()) {
      toast({
        title: "Missing campaign name",
        description: "Please enter a campaign name to save as draft",
        variant: "destructive",
      });
      return;
    }

    try {
      setSavingDraft(true);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Use filteredRecipients when draft is loaded, otherwise use selectedPeople/filteredRecipients based on tag filters
      const recipientsToUse = draftId ? filteredRecipients : (selectedTags.length > 0 ? filteredRecipients : selectedPeople);
      
      // Get user profile and business profile for signature
      const { data: userProfile } = await supabase
        .from('profiles')
        .select('full_name, job_title')
        .eq('id', user.id)
        .single();

      const { data: businessProfile } = await supabase
        .from('business_profiles')
        .select('company_name, email_signature')
        .eq('user_id', user.id)
        .single();

      // Build signature
      const signatureText = businessProfile?.email_signature 
        ? businessProfile.email_signature.replace(/<[^>]+>/g, '')
        : `\n\nBest regards,\n${userProfile?.full_name || 'Team'}\n${userProfile?.job_title ? `${userProfile.job_title}\n` : ''}${businessProfile?.company_name || ''}`;
      const signatureHtml = businessProfile?.email_signature 
        ? businessProfile.email_signature
        : `<br><br><p>Best regards,<br><strong>${userProfile?.full_name || 'Team'}</strong><br>${userProfile?.job_title ? `${userProfile.job_title}<br>` : ''}${businessProfile?.company_name || ''}</p>`;

      const campaignTags = selectedTags.length > 0 ? selectedTags : null;
      
      // Calculate scheduled_at if scheduling is enabled
      let scheduledAt: string | null = null;
      let scheduledDateTime: Date | null = null;
      
      if (scheduleEnabled && scheduledDate) {
        const [hours, minutes] = scheduledTime.split(':').map(Number);
        const dateStr = format(scheduledDate, 'yyyy-MM-dd');
        
        try {
          const approxDate = new Date(`${dateStr}T${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:00Z`);
          let candidate = new Date(approxDate);
          const formatter = new Intl.DateTimeFormat('en-US', {
            timeZone: scheduledTimezone,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
          });
          
          for (let i = 0; i < 10; i++) {
            const parts = formatter.formatToParts(candidate);
            const candidateHour = parseInt(parts.find(p => p.type === 'hour')?.value || '0');
            const candidateMinute = parseInt(parts.find(p => p.type === 'minute')?.value || '0');
            
            if (candidateHour === hours && candidateMinute === minutes) {
              break;
            }
            
            const hourDiff = hours - candidateHour;
            const minuteDiff = minutes - candidateMinute;
            const totalMinutesDiff = hourDiff * 60 + minuteDiff;
            candidate = new Date(candidate.getTime() - totalMinutesDiff * 60 * 1000);
          }
          
          scheduledDateTime = candidate;
        } catch (error) {
          console.error('Error calculating timezone:', error);
          scheduledDateTime = new Date(scheduledDate);
          scheduledDateTime.setHours(hours, minutes, 0, 0);
        }
        
        if (scheduledDateTime < new Date()) {
          scheduledDateTime.setDate(scheduledDateTime.getDate() + 1);
        }
        
        scheduledAt = scheduledDateTime.toISOString();
      }

      if (draftId) {
        // Update existing draft
        const { error: updateError } = await supabase
          .from('email_campaigns')
          .update({
            name: campaignName,
            subject_template: subject,
            body_html_template: bodyHtml || `<p>${bodyText.replace(/\n/g, '</p><p>')}</p>`,
            body_text_template: bodyText,
            sender_connection_id: senderConnectionId,
            scheduled_at: scheduledAt,
            total_recipients: recipientsToUse.length,
            tags: campaignTags,
            updated_at: new Date().toISOString(),
          })
          .eq('id', draftId);

        if (updateError) throw updateError;

        // Update recipients - delete old ones and add new ones
        await supabase
          .from('email_campaign_recipients')
          .delete()
          .eq('campaign_id', draftId);

        const recipients = recipientsToUse
          .filter(person => person.email)
          .map((person: any) => ({
            campaign_id: draftId,
            person_id: person.id,
            email: person.email,
            name: `${person.first_name} ${person.last_name}`.trim(),
            personalized_subject: personalizeText(subject, person),
            personalized_body_html: personalizeText(bodyHtml || `<p>${bodyText.replace(/\n/g, '</p><p>')}</p>`, person),
            personalized_body_text: personalizeText(bodyText, person),
            status: 'pending',
            email_period: 'new',
          }));

        const { error: recipientsError } = await supabase
          .from('email_campaign_recipients')
          .insert(recipients);

        if (recipientsError) throw recipientsError;

        toast({
          title: "Draft updated",
          description: `Draft "${campaignName}" has been saved with ${recipients.length} recipients`,
        });
      } else {
        // Create new draft
        const { data: campaign, error: campaignError } = await supabase
          .from('email_campaigns')
          .insert({
            user_id: user.id,
            name: campaignName,
            subject_template: subject,
            body_html_template: bodyHtml || `<p>${bodyText.replace(/\n/g, '</p><p>')}</p>`,
            body_text_template: bodyText,
            sender_connection_id: senderConnectionId,
            status: 'draft',
            scheduled_at: scheduledAt,
            total_recipients: recipientsToUse.length,
            tags: campaignTags,
          })
          .select()
          .single();

        if (campaignError) throw campaignError;

        setDraftId(campaign.id);

        // Create recipients
        const recipients = recipientsToUse
          .filter(person => person.email)
          .map((person: any) => ({
            campaign_id: campaign.id,
            person_id: person.id,
            email: person.email,
            name: `${person.first_name} ${person.last_name}`.trim(),
            personalized_subject: personalizeText(subject, person),
            personalized_body_html: personalizeText(bodyHtml || `<p>${bodyText.replace(/\n/g, '</p><p>')}</p>`, person),
            personalized_body_text: personalizeText(bodyText, person),
            status: 'pending',
            email_period: 'new',
          }));

        const { error: recipientsError } = await supabase
          .from('email_campaign_recipients')
          .insert(recipients);

        if (recipientsError) throw recipientsError;

        toast({
          title: "Draft saved",
          description: `Draft "${campaignName}" has been saved with ${recipients.length} recipients. You can resume editing later.`,
        });
      }
    } catch (error: any) {
      console.error('Error saving draft:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to save draft",
        variant: "destructive",
      });
    } finally {
      setSavingDraft(false);
    }
  };

  const handleLoadDraft = async (draft: any) => {
    try {
      setLoadDraftOpen(false);
      
      // Load campaign data
      setCampaignName(draft.name || '');
      setSubject(draft.subject_template || '');
      
      // Strip signature from body content when loading
      let loadedBodyHtml = draft.body_html_template || '';
      let loadedBodyText = draft.body_text_template || '';
      
      // Remove common signature patterns (including "AI innovation Studio" and other company info)
      const signaturePatterns = [
        /<br><br><p>Best regards,.*$/is,
        /<br><br>Best regards,.*$/is,
        /<p>Best regards,.*$/is,
        /\n\nBest regards,.*$/is,
        /Best regards,.*$/is,
        /<div class="signature".*$/is,
        /<div class="email-signature".*$/is,
        // Remove company/sender info that might appear before signature
        /AI innovation Studio.*$/is,
        /AI Innovation Studio.*$/is,
        /michael orji.*$/is,
        /Michael Orji.*$/is,
        /AI Founding Engineer.*$/is,
        /Biz Boosters Ltd.*$/is,
        /biz boosters.*$/is,
        // Remove any trailing content after "Best regards" that looks like signature
        /(Best regards,?\s*[\n\r]*.*?michael.*?orji.*?)/is,
        /(Best regards,?\s*[\n\r]*.*?AI.*?Engineer.*?)/is,
        /(Best regards,?\s*[\n\r]*.*?Biz.*?Boosters.*?)/is,
      ];
      
      for (const pattern of signaturePatterns) {
        loadedBodyHtml = loadedBodyHtml.replace(pattern, '').trim();
        loadedBodyText = loadedBodyText.replace(pattern, '').trim();
      }
      
      // Additional cleanup: Remove any trailing signature-like content
      // Remove multiple newlines/breaks followed by name/company patterns
      loadedBodyHtml = loadedBodyHtml.replace(/(<br\s*\/?>|\n){2,}.*?(michael|orji|biz boosters|founding engineer|AI innovation|innovation studio).*$/is, '').trim();
      loadedBodyText = loadedBodyText.replace(/(\n|\r){2,}.*?(michael|orji|biz boosters|founding engineer|AI innovation|innovation studio).*$/is, '').trim();
      
      setBodyHtml(loadedBodyHtml);
      setBodyText(loadedBodyText);
      setSenderConnectionId(draft.sender_connection_id || '');
      setDraftId(draft.id);
      
      if (draft.scheduled_at) {
        setScheduleEnabled(true);
        const scheduledDate = new Date(draft.scheduled_at);
        setScheduledDate(scheduledDate);
        setScheduledTime(format(scheduledDate, 'HH:mm'));
        // scheduled_timezone column doesn't exist - removed
      }
      
      if (draft.tags && Array.isArray(draft.tags)) {
        setSelectedTags(draft.tags);
      }

      // Load recipients
      const { data: recipients, error: recipientsError } = await supabase
        .from('email_campaign_recipients')
        .select('person_id, people!inner(id, first_name, last_name, email, company_id, companies(id, name, tags))')
        .eq('campaign_id', draft.id)
        .eq('status', 'pending');

      if (recipientsError) {
        console.error('Error loading recipients:', recipientsError);
      } else if (recipients && recipients.length > 0) {
        // Merge with current filteredRecipients (which may include newly added people)
        // This allows adding new contacts to a loaded draft
        const existingIds = new Set(filteredRecipients.map(p => p.id));
        const newRecipients = recipients
          .map((r: any) => r.people)
          .filter((p: any) => p && !existingIds.has(p.id))
          .map((p: any) => ({
            id: p.id,
            first_name: p.first_name,
            last_name: p.last_name,
            email: p.email,
            company_id: p.company_id,
            companies: p.companies,
          }));
        
        if (newRecipients.length > 0) {
          // Merge draft recipients with current recipients (preserving any newly added people)
          setFilteredRecipients([...filteredRecipients, ...newRecipients]);
        }
      }

      toast({
        title: "Draft loaded",
        description: `Loaded draft "${draft.name}" with ${draft.total_recipients || 0} recipients`,
      });
    } catch (error: any) {
      console.error('Error loading draft:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to load draft",
        variant: "destructive",
      });
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
        .select('company_name, email_signature')
        .eq('user_id', user.id)
        .single();

      // Build signature - use branded signature from business profile if available
      // Note: The backend will apply full branding template, so this is just for preview
      const signatureText = businessProfile?.email_signature 
        ? businessProfile.email_signature.replace(/<[^>]+>/g, '') // Strip HTML for text version
        : `\n\nBest regards,\n${userProfile?.full_name || 'Team'}\n${userProfile?.job_title ? `${userProfile.job_title}\n` : ''}${businessProfile?.company_name || ''}`;
      const signatureHtml = businessProfile?.email_signature 
        ? businessProfile.email_signature
        : `<br><br><p>Best regards,<br><strong>${userProfile?.full_name || 'Team'}</strong><br>${userProfile?.job_title ? `${userProfile.job_title}<br>` : ''}${businessProfile?.company_name || ''}</p>`;

      // Use personalized email if available, otherwise use template with variables
      let testSubject: string;
      let testBodyHtml: string;
      let testBodyText: string;

      if (hasPersonalizedEmail) {
        const personalized = personalizedEmails[testPerson.id];
        testSubject = personalized.subject;
        // Don't append signature - backend's renderEmailTemplate will add it with proper branding
        testBodyHtml = personalized.bodyHtml;
        testBodyText = personalized.bodyText;
      } else {
        testSubject = personalizeText(subject, testPerson);
        // Don't append signature - backend's renderEmailTemplate will add it with proper branding
        testBodyHtml = personalizeText(bodyHtml || `<p>${bodyText.replace(/\n/g, '</p><p>')}</p>`, testPerson);
        testBodyText = personalizeText(bodyText, testPerson);
      }

      const { error } = await supabase.functions.invoke('send-crm-email', {
        body: {
          toEmail: testEmailAddress,
          toName: 'Test Recipient',
          subject: testSubject,
          bodyHtml: testBodyHtml,
          bodyText: testBodyText,
          sender,
          senderConnectionId: senderConnectionId || undefined, // Pass the specific connection ID
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
      // Extract more detailed error message
      let errorMessage = "Failed to send test email";
      if (error.message) {
        errorMessage = error.message;
      } else if (error.error) {
        errorMessage = typeof error.error === 'string' ? error.error : error.error?.message || errorMessage;
      } else if (error.data?.error) {
        errorMessage = error.data.error;
      }
      
      toast({
        title: "Error",
        description: errorMessage,
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
        .select('company_name, email_signature')
        .eq('user_id', user.id)
        .single();

      // Build signature - use branded signature from business profile if available
      // Note: The backend will apply full branding template, so this is just for preview/storage
      const signatureText = businessProfile?.email_signature 
        ? businessProfile.email_signature.replace(/<[^>]+>/g, '') // Strip HTML for text version
        : `\n\nBest regards,\n${userProfile?.full_name || 'Team'}\n${userProfile?.job_title ? `${userProfile.job_title}\n` : ''}${businessProfile?.company_name || ''}`;
      const signatureHtml = businessProfile?.email_signature 
        ? businessProfile.email_signature
        : `<br><br><p>Best regards,<br><strong>${userProfile?.full_name || 'Team'}</strong><br>${userProfile?.job_title ? `${userProfile.job_title}<br>` : ''}${businessProfile?.company_name || ''}</p>`;

      // Create campaign with tags (use selected tags for campaign categorization)
      const campaignTags = selectedTags.length > 0 ? selectedTags : null;
      
      // Calculate scheduled_at if scheduling is enabled
      let scheduledAt: string | null = null;
      let campaignStatus: 'draft' | 'scheduled' = 'draft';
      let scheduledDateTime: Date | null = null;
      
      if (scheduleEnabled && scheduledDate) {
        // Combine date and time in the selected timezone
        const [hours, minutes] = scheduledTime.split(':').map(Number);
        const dateStr = format(scheduledDate, 'yyyy-MM-dd');
        
        try {
          // Convert local date/time in target timezone to UTC
          // Method: Use iterative approach to find the UTC time that produces our desired local time
          
          // Start with an approximate UTC date
          const approxDate = new Date(`${dateStr}T${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:00Z`);
          
          // Use binary search approach: adjust until we get the right local time in target timezone
          let candidate = new Date(approxDate);
          const formatter = new Intl.DateTimeFormat('en-US', {
            timeZone: scheduledTimezone,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
          });
          
          // Try a few iterations to find the right UTC time
          for (let i = 0; i < 10; i++) {
            const parts = formatter.formatToParts(candidate);
            const candidateHour = parseInt(parts.find(p => p.type === 'hour')?.value || '0');
            const candidateMinute = parseInt(parts.find(p => p.type === 'minute')?.value || '0');
            
            if (candidateHour === hours && candidateMinute === minutes) {
              break; // Found it!
            }
            
            // Calculate adjustment needed
            const hourDiff = hours - candidateHour;
            const minuteDiff = minutes - candidateMinute;
            const totalMinutesDiff = hourDiff * 60 + minuteDiff;
            
            // Adjust candidate (subtract because we're going from local to UTC)
            candidate = new Date(candidate.getTime() - totalMinutesDiff * 60 * 1000);
          }
          
          scheduledDateTime = candidate;
          
        } catch (error) {
          console.error('Error calculating timezone:', error);
          // Fallback: use the date/time as-is (will be interpreted as local time)
          scheduledDateTime = new Date(scheduledDate);
          scheduledDateTime.setHours(hours, minutes, 0, 0);
        }
        
        // If scheduled time is in the past, schedule for tomorrow at the same time
        if (scheduledDateTime < new Date()) {
          scheduledDateTime.setDate(scheduledDateTime.getDate() + 1);
        }
        
        scheduledAt = scheduledDateTime.toISOString();
        campaignStatus = 'scheduled';
      }
      
      let campaign;
      
      if (draftId) {
        // Update existing draft and change status
        const { data: updatedCampaign, error: updateError } = await supabase
          .from('email_campaigns')
          .update({
            name: campaignName,
            subject_template: subject,
            body_html_template: bodyHtml || `<p>${bodyText.replace(/\n/g, '</p><p>')}</p>`,
            body_text_template: bodyText,
            sender_connection_id: senderConnectionId,
            status: campaignStatus,
            scheduled_at: scheduledAt,
            total_recipients: recipientsToUse.length,
            tags: campaignTags,
            updated_at: new Date().toISOString(),
          })
          .eq('id', draftId)
          .select()
          .single();

        if (updateError) throw updateError;
        campaign = updatedCampaign;

        // Update recipients - delete old ones and add new ones
        await supabase
          .from('email_campaign_recipients')
          .delete()
          .eq('campaign_id', draftId);
      } else {
        // Create new campaign
        const { data: newCampaign, error: campaignError } = await supabase
          .from('email_campaigns')
          .insert({
            user_id: user.id,
            name: campaignName,
            subject_template: subject,
            body_html_template: bodyHtml || `<p>${bodyText.replace(/\n/g, '</p><p>')}</p>`,
            body_text_template: bodyText,
            sender_connection_id: senderConnectionId,
            status: campaignStatus,
            scheduled_at: scheduledAt,
            total_recipients: recipientsToUse.length,
            tags: campaignTags,
          })
          .select()
          .single();

        if (campaignError) throw campaignError;
        campaign = newCampaign;
      }

      // Create recipients with personalized content
      const recipients = recipientsToUse
        .filter(person => person.email) // Only include people with emails
        .map((person: any) => ({
          campaign_id: campaign.id,
          person_id: person.id,
          email: person.email,
          name: `${person.first_name} ${person.last_name}`.trim(),
          personalized_subject: personalizeText(subject, person),
          personalized_body_html: personalizeText(bodyHtml || `<p>${bodyText.replace(/\n/g, '</p><p>')}</p>`, person),
          personalized_body_text: personalizeText(bodyText, person),
          status: 'pending',
          email_period: 'new', // Mark as new email
        }));

      const { error: recipientsError } = await supabase
        .from('email_campaign_recipients')
        .insert(recipients);

      if (recipientsError) throw recipientsError;

      // Start sending immediately if not scheduled
      if (campaignStatus === 'scheduled' && scheduledDateTime) {
        // Format the scheduled time in the selected timezone for display
        const tzAbbr = new Date().toLocaleString('en-US', { timeZone: scheduledTimezone, timeZoneName: 'short' }).split(' ').pop() || '';
        const formattedDate = scheduledDateTime.toLocaleString('en-US', {
          timeZone: scheduledTimezone,
          month: 'long',
          day: 'numeric',
          year: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
        });
        
        toast({
          title: "Campaign scheduled",
          description: `Campaign will be sent to ${recipients.length} recipients on ${formattedDate} ${tzAbbr}`,
        });
      } else {
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
      }

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
      setScheduleEnabled(false);
      setScheduledDate(undefined);
      setScheduledTime("09:00");
      setScheduledTimezone(() => {
        try {
          return Intl.DateTimeFormat().resolvedOptions().timeZone;
        } catch {
          return 'UTC';
        }
      });
      setExcludedCampaignIds([]);
      setDraftId(null);

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
            Send personalized emails to {recipientsToUse.length} {selectedTags.length > 0 ? 'filtered' : 'selected'} {recipientsToUse.length === 1 ? 'person' : 'people'}
            {selectedTags.length > 0 && (
              <span className="text-muted-foreground"> (filtered by {selectedTags.length} tag{selectedTags.length > 1 ? 's' : ''})</span>
            )}
            {excludedCampaignIds.length > 0 && (
              <span className="text-blue-600 dark:text-blue-400 font-medium">
                {' • '}{excludedRecipients?.size || 0} excluded from {excludedCampaignIds.length} previous campaign{excludedCampaignIds.length > 1 ? 's' : ''}
              </span>
            )}
            {duplicateRecipients && duplicateRecipients.length > 0 && (
              <span className="text-amber-600 dark:text-amber-400 font-medium">
                {' • '}{duplicateRecipients.length} already received email{duplicateRecipients.length > 1 ? 's' : ''}
              </span>
            )}
          </DialogDescription>
        </DialogHeader>
        
        {/* Load Draft Button */}
        {draftCampaigns && draftCampaigns.length > 0 && (
          <div className="flex justify-end px-6 pb-2 border-b">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setLoadDraftOpen(true)}
              disabled={sending || savingDraft}
            >
              <FileText className="h-4 w-4 mr-2" />
              Load Draft ({draftCampaigns.length})
            </Button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-6 py-4">
          <div className="space-y-6">
          {/* Campaign Exclusion Section - More Prominent */}
          {previousCampaigns && previousCampaigns.length > 0 && (
            <Collapsible defaultOpen={true}>
              <CollapsibleTrigger className="flex items-center justify-between w-full p-4 rounded-lg border-2 border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30 hover:bg-blue-100 dark:hover:bg-blue-950/50 transition-colors">
                <div className="flex items-center gap-2">
                  <Info className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  <span className="font-semibold text-sm text-blue-900 dark:text-blue-100">Prevent Double-Sending: Exclude Recipients from Previous Campaigns</span>
                  {excludedCampaignIds.length > 0 && (
                    <Badge variant="default" className="ml-2 bg-blue-600">
                      {excludedCampaignIds.length} campaign{excludedCampaignIds.length > 1 ? 's' : ''} selected
                    </Badge>
                  )}
                </div>
                <ChevronDown className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-3 space-y-3 p-4 bg-muted/30 rounded-lg border">
                <p className="text-sm font-medium text-foreground mb-3">
                  💡 Smart Exclusion: Select campaigns to automatically exclude their recipients and prevent double-sending.
                </p>
                <p className="text-xs text-muted-foreground mb-3">
                  Recent campaigns with overlapping recipients are highlighted. We recommend excluding campaigns sent in the last 30 days.
                </p>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {previousCampaigns.map((campaign: any) => {
                    const isExcluded = excludedCampaignIds.includes(campaign.id);
                    const excludedCount = excludedRecipients?.size || 0;
                    const campaignDate = new Date(campaign.created_at);
                    const daysAgo = Math.floor((Date.now() - campaignDate.getTime()) / (1000 * 60 * 60 * 24));
                    const isRecent = daysAgo <= 30; // Highlight campaigns from last 30 days
                    const isVeryRecent = daysAgo <= 7; // Auto-suggest campaigns from last 7 days
                    
                    return (
                      <div
                        key={campaign.id}
                        className={`flex items-center justify-between p-3 rounded-lg border transition-colors cursor-pointer ${
                          isRecent 
                            ? 'border-blue-300 dark:border-blue-700 bg-blue-50/50 dark:bg-blue-950/20' 
                            : 'border hover:bg-muted/50'
                        } ${isExcluded ? 'bg-green-50 dark:bg-green-950/20 border-green-300 dark:border-green-700' : ''}`}
                        onClick={() => {
                          if (isExcluded) {
                            setExcludedCampaignIds(excludedCampaignIds.filter(id => id !== campaign.id));
                          } else {
                            setExcludedCampaignIds([...excludedCampaignIds, campaign.id]);
                          }
                        }}
                      >
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <input
                            type="checkbox"
                            checked={isExcluded}
                            onChange={() => {
                              if (isExcluded) {
                                setExcludedCampaignIds(excludedCampaignIds.filter(id => id !== campaign.id));
                              } else {
                                setExcludedCampaignIds([...excludedCampaignIds, campaign.id]);
                              }
                            }}
                            className="rounded w-4 h-4"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="font-medium text-sm truncate">{campaign.name}</p>
                              {isVeryRecent && !isExcluded && (
                                <Badge variant="outline" className="text-xs bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300">
                                  Recent
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {campaign.total_recipients || 0} recipients • {daysAgo === 0 ? 'Today' : daysAgo === 1 ? 'Yesterday' : `${daysAgo} days ago`}
                            </p>
                          </div>
                        </div>
                        {isExcluded && excludedCount > 0 && (
                          <Badge variant="default" className="ml-2 text-xs bg-green-600">
                            {excludedCount} excluded
                          </Badge>
                        )}
                      </div>
                    );
                  })}
                </div>
                {/* Auto-suggest button for recent campaigns */}
                {previousCampaigns.some((c: any) => {
                  const daysAgo = Math.floor((Date.now() - new Date(c.created_at).getTime()) / (1000 * 60 * 60 * 24));
                  return daysAgo <= 7 && !excludedCampaignIds.includes(c.id);
                }) && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const recentCampaignIds = previousCampaigns
                        .filter((c: any) => {
                          const daysAgo = Math.floor((Date.now() - new Date(c.created_at).getTime()) / (1000 * 60 * 60 * 24));
                          return daysAgo <= 7 && !excludedCampaignIds.includes(c.id);
                        })
                        .map((c: any) => c.id);
                      if (recentCampaignIds.length > 0) {
                        setExcludedCampaignIds([...excludedCampaignIds, ...recentCampaignIds]);
                      }
                    }}
                    className="w-full"
                  >
                    <Sparkles className="h-3 w-3 mr-2" />
                    Auto-Exclude Recent Campaigns (Last 7 Days)
                  </Button>
                )}
                {excludedCampaignIds.length > 0 && (
                  <div className="rounded-lg border border-blue-500/50 bg-blue-50 dark:bg-blue-950/20 p-3">
                    <p className="text-sm text-blue-900 dark:text-blue-100">
                      <strong>{excludedRecipients?.size || 0} recipient{excludedRecipients?.size !== 1 ? 's' : ''}</strong> will be excluded from this campaign.
                    </p>
                  </div>
                )}
              </CollapsibleContent>
            </Collapsible>
          )}

          {/* Duplicate Email Warning */}
          {duplicateRecipients && duplicateRecipients.length > 0 && (
            <div className="rounded-lg border border-amber-500/50 bg-amber-50 dark:bg-amber-950/20 p-4">
              <div className="flex items-start gap-3">
                <Info className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold text-amber-900 dark:text-amber-100">
                      Duplicate Email Warning
                    </h4>
                    <Badge variant="outline" className="bg-amber-100 dark:bg-amber-900/30 text-amber-900 dark:text-amber-100 border-amber-300 dark:border-amber-700">
                      {duplicateRecipients.length} duplicate{duplicateRecipients.length > 1 ? 's' : ''}
                    </Badge>
                  </div>
                  <p className="text-sm text-amber-800 dark:text-amber-200">
                    {duplicateRecipients.length} {duplicateRecipients.length === 1 ? 'person has' : 'people have'} already received an email from a previous campaign. Sending again may be considered spam.
                  </p>
                  <details className="text-xs">
                    <summary className="cursor-pointer text-amber-700 dark:text-amber-300 hover:text-amber-900 dark:hover:text-amber-100 font-medium">
                      View duplicate recipients ({duplicateRecipients.length})
                    </summary>
                    <div className="mt-2 space-y-1.5 max-h-40 overflow-y-auto">
                      {duplicateRecipients.map((dup: any) => {
                        const person = recipientsToUse.find((p: any) => p.id === dup.personId);
                        const sentDate = dup.sentAt ? new Date(dup.sentAt).toLocaleDateString() : 'Unknown date';
                        return (
                          <div key={dup.personId} className="flex items-center justify-between p-2 bg-white dark:bg-gray-800 rounded border border-amber-200 dark:border-amber-800">
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm truncate">
                                {person ? `${person.first_name} ${person.last_name}` : dup.email}
                              </p>
                              <p className="text-xs text-muted-foreground truncate">
                                {dup.campaignName || 'Previous campaign'} • Sent {sentDate}
                              </p>
                            </div>
                            <Badge variant="outline" className="ml-2 text-xs">
                              {dup.status}
                            </Badge>
                          </div>
                        );
                      })}
                    </div>
                  </details>
                </div>
              </div>
            </div>
          )}
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
                    disabled={generatingAi || generatingPersonalized || recipientsToUse.length === 0}
                    variant="outline"
                    className="w-full"
                  >
                    {generatingPersonalized ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Generating for {recipientsToUse.length} recipients...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4 mr-2" />
                        Generate Personalized Emails for All ({recipientsToUse.length})
                        {recipientsToUse.length > 100 && (
                          <span className="ml-2 text-xs text-amber-600">(Limit: 100)</span>
                        )}
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

          {/* Schedule Sending */}
          <div className="space-y-3 rounded-lg border bg-muted/30 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CalendarIcon className="h-5 w-5 text-primary" />
                <Label htmlFor="schedule-enabled" className="cursor-pointer font-medium">
                  Schedule Sending
                </Label>
              </div>
              <Switch
                id="schedule-enabled"
                checked={scheduleEnabled}
                onCheckedChange={setScheduleEnabled}
                disabled={sending || generatingAi}
              />
            </div>
            
            {scheduleEnabled && (
              <div className="space-y-3 pt-2">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="schedule-date">Date</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          id="schedule-date"
                          variant="outline"
                          className="w-full justify-start text-left font-normal"
                          disabled={sending || generatingAi}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {scheduledDate ? format(scheduledDate, "PPP") : "Pick a date"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={scheduledDate}
                          onSelect={(date) => setScheduledDate(date)}
                          disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="schedule-time">Time</Label>
                    <div className="relative">
                      <Clock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="schedule-time"
                        type="time"
                        value={scheduledTime}
                        onChange={(e) => setScheduledTime(e.target.value)}
                        className="pl-9"
                        disabled={sending || generatingAi}
                      />
                    </div>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="schedule-timezone">Timezone</Label>
                  <Select
                    value={scheduledTimezone}
                    onValueChange={setScheduledTimezone}
                    disabled={sending || generatingAi}
                  >
                    <SelectTrigger id="schedule-timezone">
                      <SelectValue>
                        {(() => {
                          try {
                            const tz = scheduledTimezone;
                            const offset = new Date().toLocaleString('en-US', { timeZone: tz, timeZoneName: 'short' }).split(' ').pop() || '';
                            return `${tz.replace(/_/g, ' ')} (${offset})`;
                          } catch {
                            return scheduledTimezone;
                          }
                        })()}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent className="max-h-[300px]">
                      {(() => {
                        try {
                          // @ts-ignore - supportedValuesOf is available in modern browsers
                          return Intl.supportedValuesOf('timeZone')
                            .sort()
                            .map((tz) => {
                              try {
                                const now = new Date();
                                const offset = now.toLocaleString('en-US', { timeZone: tz, timeZoneName: 'short' }).split(' ').pop() || '';
                                const displayName = tz.replace(/_/g, ' ');
                                return (
                                  <SelectItem key={tz} value={tz}>
                                    {displayName} ({offset})
                                  </SelectItem>
                                );
                              } catch {
                                return (
                                  <SelectItem key={tz} value={tz}>
                                    {tz.replace(/_/g, ' ')}
                                  </SelectItem>
                                );
                              }
                            });
                        } catch {
                          // Fallback to common timezones if supportedValuesOf is not available
                          return [
                            'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
                            'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Asia/Dubai', 'Asia/Kolkata',
                            'Asia/Singapore', 'Asia/Tokyo', 'Asia/Shanghai', 'Australia/Sydney', 'UTC'
                          ].map((tz) => (
                            <SelectItem key={tz} value={tz}>
                              {tz.replace(/_/g, ' ')}
                            </SelectItem>
                          ));
                        }
                      })()}
                    </SelectContent>
                  </Select>
                </div>
                
                {scheduledDate && (
                  <p className="text-xs text-muted-foreground">
                    Campaign will be sent on {format(scheduledDate, "PPP")} at {scheduledTime} {(() => {
                      try {
                        const offset = new Date().toLocaleString('en-US', { timeZone: scheduledTimezone, timeZoneName: 'short' }).split(' ').pop() || '';
                        return `(${scheduledTimezone.replace(/_/g, ' ')} ${offset})`;
                      } catch {
                        return `(${scheduledTimezone})`;
                      }
                    })()}
                    {(() => {
                      try {
                        const [hours, minutes] = scheduledTime.split(':').map(Number);
                        const dateStr = format(scheduledDate, 'yyyy-MM-dd');
                        const testDate = new Date(`${dateStr}T${scheduledTime}:00`);
                        const tzTestDate = new Date(testDate.toLocaleString('en-US', { timeZone: scheduledTimezone }));
                        if (tzTestDate < new Date()) {
                          return <span className="text-amber-600 ml-1">(tomorrow at the same time)</span>;
                        }
                      } catch {}
                      return null;
                    })()}
                  </p>
                )}
              </div>
            )}
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
              variant="outline"
              onClick={handleSaveDraft}
              disabled={savingDraft || sending || !campaignName.trim()}
            >
              {savingDraft ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save Draft
                </>
              )}
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
        
        {/* Load Draft Dialog */}
        <AlertDialog open={loadDraftOpen} onOpenChange={setLoadDraftOpen}>
          <AlertDialogContent className="sm:max-w-[600px]">
            <AlertDialogHeader>
              <AlertDialogTitle>Load Draft Campaign</AlertDialogTitle>
              <AlertDialogDescription>
                Select a draft to continue editing. Recipients from the draft will be added to your current selection.
              </AlertDialogDescription>
            </AlertDialogHeader>
            
            <div className="space-y-2 max-h-[400px] overflow-y-auto py-4">
              {draftCampaigns && draftCampaigns.length > 0 ? (
                draftCampaigns.map((draft: any) => (
                  <div
                    key={draft.id}
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 cursor-pointer"
                    onClick={() => handleLoadDraft(draft)}
                  >
                    <div className="flex-1">
                      <div className="font-medium">{draft.name}</div>
                      <div className="text-sm text-muted-foreground mt-1">
                        {draft.total_recipients || 0} recipients • Created {new Date(draft.created_at).toLocaleDateString()}
                        {draft.updated_at && draft.updated_at !== draft.created_at && (
                          <span> • Updated {new Date(draft.updated_at).toLocaleDateString()}</span>
                        )}
                      </div>
                      {draft.subject_template && (
                        <div className="text-xs text-muted-foreground mt-1 truncate">
                          Subject: {draft.subject_template}
                        </div>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleLoadDraft(draft);
                      }}
                    >
                      Load
                    </Button>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No draft campaigns found
                </div>
              )}
            </div>

            <AlertDialogFooter>
              <Button
                variant="outline"
                onClick={() => setLoadDraftOpen(false)}
              >
                Cancel
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DialogContent>
    </Dialog>
  );
}