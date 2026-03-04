import { useState, useEffect, useMemo, useRef, forwardRef, useImperativeHandle } from "react";
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
import { Loader2, Send, User, Info, Sparkles, Mail, ChevronDown, Tag, Code, Eye, Bot, Calendar as CalendarIcon, Clock, X, Save, FileText, RefreshCw, Plus, Minus, Filter, FlaskConical, ExternalLink, Edit2, Upload } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useUpdateSequence } from "@/hooks/use-sequences";
import { PersonaSelector, type MarketingPersona } from "./email/PersonaSelector";
import { TagInput } from "@/components/ui/tag-input";
import { useCompanyTags } from "@/hooks/use-company-tags";
import { RichTextEditor } from "./email/RichTextEditor";
import { EmailTemplateSelector, EMAIL_TEMPLATES, type EmailTemplate } from "./email/EmailTemplateSelector";
import { FileAttachmentSelector } from "./email/FileAttachmentSelector";
import { EmailTemplatePreview, type EmailTemplatePreviewStyle } from "./email/EmailTemplatePreview";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";

export interface BulkEmailDialogHandle {
  addRecipientsFromSelection: () => Promise<void>;
  replaceRecipientsWithSelection: () => Promise<void>;
}

function previewBodyToHtml(text: string): string {
  const raw = (text || '').trim();
  if (!raw) return '';
  if (raw.includes('<p>') || raw.includes('<div') || raw.includes('<ul') || raw.includes('<ol')) return raw;
  const blocks = raw.split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean);
  const out: string[] = [];
  for (const block of blocks) {
    const lines = block.split(/\n/).map((l) => l.trimEnd());
    const listMatch = lines.every((l) => /^(\s*)([-*•]\s*|(\d+\.)\s)/.test(l) || l === '');
    if (listMatch && lines.some(Boolean)) {
      const items = lines.filter(Boolean).map((l) => l.replace(/^(\s*)([-*•]\s*|(\d+\.)\s)/, '').trim());
      if (items.length) out.push('<ul style="margin:12px 0;padding-left:20px;">' + items.map((i) => `<li style="margin-bottom:6px;">${i.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</li>`).join('') + '</ul>');
    } else {
      const para = lines.map((l) => l.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')).join('<br>');
      if (para) out.push(`<p style="margin:0 0 12px 0;line-height:1.5;">${para}</p>`);
    }
  }
  return out.join('');
}

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

const BulkEmailDialog = forwardRef<BulkEmailDialogHandle, BulkEmailDialogProps>(function BulkEmailDialog({ open, onOpenChange, selectedPeople, initialDraftId }, ref) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { allSuggestions } = useCompanyTags();
  const [campaignName, setCampaignName] = useState("");
  const [subject, setSubject] = useState("");
  const [bodyHtml, setBodyHtml] = useState("");
  const [bodyText, setBodyText] = useState("");
  const [sender, setSender] = useState<'gmail' | 'gmail_direct' | 'resend' | 'smtp' | 'sendgrid'>('resend');
  const [senderConnectionId, setSenderConnectionId] = useState<string>("");
  const [senderProfileId, setSenderProfileId] = useState<string>("");
  const [sending, setSending] = useState(false);
  const [aiContext, setAiContext] = useState("");
  const [generatingAi, setGeneratingAi] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [testEmailDialogOpen, setTestEmailDialogOpen] = useState(false);
  const [testEmailAddress, setTestEmailAddress] = useState("");
  const [sendingTest, setSendingTest] = useState(false);
  const [testRecipientId, setTestRecipientId] = useState<string | null>(null);
  const [testEmailVariant, setTestEmailVariant] = useState<'A' | 'B'>('A');
  const testEmailVariantRef = useRef<'A' | 'B'>('A');
  const [selectedPersonaId, setSelectedPersonaId] = useState<string | null>(null);
  const [selectedPersona, setSelectedPersona] = useState<MarketingPersona | null>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [filteredRecipients, setFilteredRecipients] = useState(selectedPeople);
  const [template, setTemplate] = useState<EmailTemplate>('blank');
  const [attachments, setAttachments] = useState<any[]>([]);
  const [enableAutoResponder, setEnableAutoResponder] = useState(false);
  const [autoFollowUpEnabled, setAutoFollowUpEnabled] = useState(true);
  const [followUpSequenceId, setFollowUpSequenceId] = useState<string>("");
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
  // A/B test (body): variant B and split
  const [abTestEnabled, setAbTestEnabled] = useState(false);
  const [abSectionOpen, setAbSectionOpen] = useState(false); // expand/collapse Variant B form (independent of on/off)
  const [abSubjectB, setAbSubjectB] = useState("");
  const [abBodyHtmlB, setAbBodyHtmlB] = useState("");
  const [abBodyTextB, setAbBodyTextB] = useState("");
  const [abTrafficSplit, setAbTrafficSplit] = useState(50);
  const [abWinnerMetric, setAbWinnerMetric] = useState<'open_rate' | 'click_rate' | 'reply_rate'>('open_rate');
  const [creatingSequenceFromBody, setCreatingSequenceFromBody] = useState(false);
  const [headerImageUrl, setHeaderImageUrl] = useState("");
  const [uploadingHeaderImage, setUploadingHeaderImage] = useState(false);
  const headerImageFileRef = useRef<HTMLInputElement>(null);

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
  // Always use filteredRecipients so the list is editable (add/remove) in the dialog
  const recipientsToUse = useMemo(() => {
    let baseRecipients = filteredRecipients;
    
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
  }, [filteredRecipients, excludedRecipients]);

  // Synthetic recipient ids (rec-*) are not valid UUIDs; use null for person_id in DB inserts.
  const personIdForDb = (person: { id?: string }) =>
    person?.id && !String(person.id).startsWith('rec-') ? person.id : null;

  // Check for duplicate emails (people who already received emails in previous campaigns)
  const { data: duplicateRecipients } = useQuery({
    queryKey: ['duplicate-recipients', recipientsToUse.map(p => p.id).sort().join(',')],
    queryFn: async () => {
      if (recipientsToUse.length === 0) return [];
      
      // Only real UUIDs (exclude synthetic "rec-*" ids) for person_id query
      const personIds = recipientsToUse
        .filter(p => p.id && !String(p.id).startsWith('rec-'))
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

  // Fetch email connections (all senders: multiple Resend/SendGrid per user)
  const { data: connections } = useQuery({
    queryKey: ['crm-connections'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      const { data, error } = await supabase
        .from('crm_connections')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .in('provider', ['gmail', 'gmail_direct', 'outlook', 'smtp', 'resend', 'sendgrid'])
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: open,
  });

  // Fetch business profile for sender display
  const { data: businessProfile } = useQuery({
    queryKey: ['business-profile'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      
      const { data } = await supabase
        .from('business_profiles')
        .select('company_name, email_header_name, email_template_style, email_logo_url, email_brand_color, email_footer_text, email_signature, email_footer_image_url, email_footer_logo_url, email_sender_image_url, email_sender_name, email_sender_title, email_sender_email, website')
        .eq('user_id', user.id)
        .maybeSingle();
      return data;
    },
  });

  const { data: userProfile } = useQuery({
    queryKey: ['user-profile-preview'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data } = await supabase
        .from('profiles')
        .select('full_name, job_title, email, avatar_url')
        .eq('id', user.id)
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
        .select('id, name, created_at, updated_at, total_recipients, subject_template, body_html_template, body_text_template, sender_connection_id, sender_profile_id, scheduled_at, tags, auto_follow_up_enabled, follow_up_sequence_id, ab_test_enabled, ab_subject_b, ab_body_html_b, ab_body_text_b, ab_traffic_split, ab_winner_metric, header_image_url')
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

  // Email sequences for campaign auto follow-up (reminders when no response) — include steps for dropdown preview
  const { data: followUpSequences = [] } = useQuery({
    queryKey: ['email-sequences-follow-up'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      const { data, error } = await supabase
        .from('email_sequences')
        .select('id, name, steps')
        .order('name');
      if (error) return [];
      return data || [];
    },
    enabled: open,
  });

  const selectedFollowUpSequence = followUpSequenceId
    ? followUpSequences.find((s: { id: string }) => s.id === followUpSequenceId)
    : null;

  const [editingFollowUpSequenceName, setEditingFollowUpSequenceName] = useState(false);
  const [followUpSequenceNameEdit, setFollowUpSequenceNameEdit] = useState("");
  const updateSequence = useUpdateSequence();

  // Sender profiles for "Send as" (e.g. TALKWEB, Biz Boosters)
  const { data: senderProfiles = [] } = useQuery({
    queryKey: ['sender-profiles-bulk'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      const { data, error } = await supabase
        .from('sender_profiles')
        .select('id, name, display_name, logo_url, brand_color, sender_name, sender_email, sender_title, template_style, footer_text, signature, footer_image_url, footer_logo_url, sender_image_url, website_url')
        .eq('user_id', user.id)
        .order('sort_order', { ascending: true })
        .order('name', { ascending: true });
      if (error) throw error;
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
  const hasRestoredLocalDraft = useRef(false);
  const contentOnlyEditRef = useRef(false); // true when editing a sending/completed campaign (update content only, don't replace recipients)
  const BULK_EMAIL_DRAFT_KEY = 'leadgenie_bulk_email_draft';

  const draftSnapshotRef = useRef({
    campaignName: '',
    subject: '',
    bodyHtml: '',
    bodyText: '',
    senderConnectionId: '',
    senderProfileId: '',
    selectedTags: [] as string[],
    scheduleEnabled: false,
    scheduledDate: null as string | null,
    scheduledTime: '09:00',
    scheduledTimezone: 'UTC',
    autoFollowUpEnabled: true,
    followUpSequenceId: '',
  });

  useEffect(() => {
    draftSnapshotRef.current = {
      campaignName,
      subject,
      bodyHtml,
      bodyText,
      senderConnectionId,
      senderProfileId,
      selectedTags,
      scheduleEnabled,
      scheduledDate: scheduledDate?.toISOString() ?? null,
      scheduledTime,
      scheduledTimezone,
      autoFollowUpEnabled,
      followUpSequenceId,
    };
  }, [campaignName, subject, bodyHtml, bodyText, senderConnectionId, senderProfileId, selectedTags, scheduleEnabled, scheduledDate, scheduledTime, scheduledTimezone, autoFollowUpEnabled, followUpSequenceId]);

  useEffect(() => {
    if (!open) {
      setDraftId(null);
      setLoadDraftOpen(false);
      prevSelectedPeopleRef.current = selectedPeople;
      hasAutoLoadedDraft.current = false;
      hasRestoredLocalDraft.current = false;
      contentOnlyEditRef.current = false;
      localStorage.removeItem('leadgenie_draft_recipients');
      // Persist current form to localStorage on close (so we can restore later)
      try {
        const payload = {
          ...draftSnapshotRef.current,
          savedAt: new Date().toISOString(),
        };
        localStorage.setItem(BULK_EMAIL_DRAFT_KEY, JSON.stringify(payload));
      } catch {
        // ignore
      }
    } else {
      // Dedupe by email so no duplicate is ever shown; keep first occurrence
      const dedupeByEmail = (list: typeof selectedPeople) => {
        const seen = new Set<string>();
        return list.filter((p) => {
          const e = p.email?.toLowerCase().trim();
          if (!e) return false;
          if (seen.has(e)) return false;
          seen.add(e);
          return true;
        });
      };
      const dedupedPeople = dedupeByEmail(selectedPeople);
      // When dialog opens, initialize filteredRecipients with selectedPeople (deduped)
      if (prevSelectedPeopleRef.current.length === 0 && dedupedPeople.length > 0) {
        setFilteredRecipients(dedupedPeople);
      } else if (dedupedPeople.length > prevSelectedPeopleRef.current.length) {
        // Dialog is already open and new people were added - merge into filteredRecipients (no duplicate emails)
        setFilteredRecipients(prev => {
          const existingEmails = new Set(prev.map(p => p.email?.toLowerCase().trim()).filter(Boolean));
          const newPeople = dedupedPeople.filter(p => {
            const e = p.email?.toLowerCase().trim();
            return e && !existingEmails.has(e);
          });
          return newPeople.length > 0 ? [...prev, ...newPeople] : prev;
        });
      }
      prevSelectedPeopleRef.current = dedupedPeople;
      // Restore draft from localStorage when opening without a server draft
      if (!initialDraftId && !hasRestoredLocalDraft.current) {
        hasRestoredLocalDraft.current = true;
        const t = setTimeout(() => {
          try {
            const raw = localStorage.getItem(BULK_EMAIL_DRAFT_KEY);
            if (!raw) return;
            const data = JSON.parse(raw) as typeof draftSnapshotRef.current & { savedAt?: string };
            const hasContent = (data.campaignName?.trim() || data.subject?.trim() || data.bodyText?.trim());
            if (!hasContent) return;
            setCampaignName(data.campaignName || '');
            setSubject(data.subject || '');
            setBodyHtml(data.bodyHtml || '');
            setBodyText(data.bodyText || '');
            if (data.senderConnectionId) setSenderConnectionId(data.senderConnectionId);
            if (data.senderProfileId) setSenderProfileId(data.senderProfileId);
            if (Array.isArray(data.selectedTags)) setSelectedTags(data.selectedTags);
            setScheduleEnabled(!!data.scheduleEnabled);
            setScheduledDate(data.scheduledDate ? new Date(data.scheduledDate) : undefined);
            setScheduledTime(data.scheduledTime || '09:00');
            if (data.scheduledTimezone) setScheduledTimezone(data.scheduledTimezone);
            setAutoFollowUpEnabled(data.autoFollowUpEnabled !== false);
            setFollowUpSequenceId(data.followUpSequenceId || '');
            toast({ title: 'Draft restored', description: 'Your previous campaign has been restored from this device.' });
          } catch {
            // ignore
          }
        }, 300);
        return () => clearTimeout(t);
      }
    }
  }, [open, selectedPeople, initialDraftId, toast]);

  // Debounced persist to localStorage while dialog is open
  useEffect(() => {
    if (!open) return;
    const id = setTimeout(() => {
      try {
        const payload = {
          ...draftSnapshotRef.current,
          savedAt: new Date().toISOString(),
        };
        localStorage.setItem(BULK_EMAIL_DRAFT_KEY, JSON.stringify(payload));
      } catch {
        // ignore
      }
    }, 1500);
    return () => clearTimeout(id);
  }, [open, campaignName, subject, bodyHtml, bodyText, senderConnectionId, senderProfileId, selectedTags, scheduleEnabled, scheduledDate, scheduledTime, scheduledTimezone, autoFollowUpEnabled, followUpSequenceId]);

  // Persist to localStorage on page unload (e.g. tab close) so draft is not lost
  useEffect(() => {
    const onBeforeUnload = () => {
      try {
        localStorage.setItem(BULK_EMAIL_DRAFT_KEY, JSON.stringify({
          ...draftSnapshotRef.current,
          savedAt: new Date().toISOString(),
        }));
      } catch {
        // ignore
      }
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, []);

  // Reset load flag when initialDraftId changes so we load the new campaign (not skip because we already loaded a previous one)
  const prevInitialDraftIdRef = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    if (open && initialDraftId !== prevInitialDraftIdRef.current) {
      prevInitialDraftIdRef.current = initialDraftId;
      hasAutoLoadedDraft.current = false;
      // Clear recipients immediately so we don't show the previous campaign's list while loading
      setFilteredRecipients([]);
      localStorage.removeItem('leadgenie_draft_recipients');
    }
  }, [open, initialDraftId]);

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
            .select('id, name, created_at, updated_at, total_recipients, subject_template, body_html_template, body_text_template, sender_connection_id, sender_profile_id, scheduled_at, tags, auto_follow_up_enabled, follow_up_sequence_id, status, ab_test_enabled, ab_subject_b, ab_body_html_b, ab_body_text_b, ab_traffic_split, ab_winner_metric, header_image_url')
            .eq('id', initialDraftId)
            .in('status', ['draft', 'scheduled', 'sending', 'paused', 'completed'])
            .single();

          if (error || !draftData) {
            console.error('Error fetching campaign:', error);
            toast({
              title: "Error",
              description: "Failed to load campaign. It may have been deleted.",
              variant: "destructive",
            });
            return;
          }

          hasAutoLoadedDraft.current = true;
          contentOnlyEditRef.current = ['sending', 'paused', 'completed'].includes((draftData as any).status?.toLowerCase?.() ?? '');
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

      // Try to find in draftCampaigns first (faster for drafts), otherwise fetch directly (covers scheduled, sending, completed)
      if (draftCampaigns && draftCampaigns.length > 0) {
        const draftToLoad = draftCampaigns.find((d: any) => d.id === initialDraftId);
        if (draftToLoad) {
          hasAutoLoadedDraft.current = true;
          contentOnlyEditRef.current = false;
          setTimeout(() => {
            handleLoadDraft(draftToLoad);
          }, 150);
        } else {
          loadDraftById();
        }
      } else {
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
  // Only applies tag filtering on top of the current filteredRecipients base.
  // When no tags are selected, restore the full base list (selectedPeople if non-empty,
  // otherwise keep whatever was loaded via Add/Replace/draft).
  const prevTagsRef = useRef<string[]>([]);
  const unfilteredRecipientsRef = useRef<typeof selectedPeople>(filteredRecipients);

  useEffect(() => {
    if (selectedTags.length === 0 && prevTagsRef.current.length > 0) {
      setFilteredRecipients(unfilteredRecipientsRef.current);
    }
    if (selectedTags.length === 0) {
      prevTagsRef.current = selectedTags;
      return;
    }
    prevTagsRef.current = selectedTags;
    // Snapshot the base list before filtering so we can restore it when tags are cleared
    if (selectedTags.length > 0) {
      unfilteredRecipientsRef.current = filteredRecipients.length > 0 ? filteredRecipients : selectedPeople;
    }
    const base = unfilteredRecipientsRef.current;

    const matchingCompanyIds = new Set(
      (companiesWithTags || [])
        .filter(company => {
          const companyTags = company.tags || [];
          return selectedTags.some(tag => companyTags.includes(tag));
        })
        .map(company => company.id)
    );

    const filtered = base.filter((person: any) => {
      const personTags = person.tags || [];
      const hasPersonTag = selectedTags.some(tag => personTags.includes(tag));
      const hasCompanyTag = person.company_id && matchingCompanyIds.has(person.company_id);
      return hasPersonTag || hasCompanyTag;
    });

    setFilteredRecipients(filtered);
  }, [selectedTags, companiesWithTags]);

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
    if (recipientsToUse.length === 0) {
      toast({
        title: "No recipients",
        description: "Please select at least one person to generate email for",
        variant: "destructive",
      });
      return;
    }

    try {
      setGeneratingAi(true);
      const firstPerson = recipientsToUse[0];
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
        if (abTestEnabled) {
          setAbSubjectB(data.subject);
          setAbBodyTextB(data.body);
          setAbBodyHtmlB(data.body ? previewBodyToHtml(data.body) : '');
        }
        toast({
          title: "Email generated",
          description: abTestEnabled
            ? "Variant A and B prefilled. Edit either variant before sending."
            : "AI has generated your email content. You can edit it before sending.",
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
        const contentOnly = contentOnlyEditRef.current;
        // Update existing campaign (content only for sending/completed; full update for draft/scheduled)
        const updatePayload: Record<string, unknown> = {
          name: campaignName,
          subject_template: subject,
          body_html_template: bodyHtml || `<p>${bodyText.replace(/\n/g, '</p><p>')}</p>`,
          body_text_template: bodyText,
          sender_connection_id: senderConnectionId,
          sender_profile_id: senderProfileId || null,
          tags: campaignTags,
          auto_follow_up_enabled: autoFollowUpEnabled,
          follow_up_sequence_id: followUpSequenceId || null,
          updated_at: new Date().toISOString(),
          ab_test_enabled: abTestEnabled,
          ab_subject_b: abSubjectB?.trim() || null,
          ab_body_html_b: (abBodyTextB?.trim() || abBodyHtmlB?.trim()) ? (abBodyHtmlB || (abBodyTextB ? previewBodyToHtml(abBodyTextB) : null)) : null,
          ab_body_text_b: abBodyTextB?.trim() || null,
          ab_traffic_split: abTestEnabled ? abTrafficSplit : 50,
          ab_winner_metric: abTestEnabled ? abWinnerMetric : null,
          header_image_url: headerImageUrl.trim() || null,
        };
        if (!contentOnly) {
          updatePayload.scheduled_at = scheduledAt;
          updatePayload.total_recipients = recipientsToUse.length;
        }
        const { error: updateError } = await supabase
          .from('email_campaigns')
          .update(updatePayload)
          .eq('id', draftId);

        if (updateError) throw updateError;

        if (!contentOnly) {
          // Update recipients - delete old ones and add new ones (draft/scheduled only)
          await supabase
            .from('email_campaign_recipients')
            .delete()
            .eq('campaign_id', draftId);

          const useAb = abTestEnabled && (abSubjectB?.trim() || abBodyHtmlB?.trim() || abBodyTextB?.trim());
          const bodyHtmlA = bodyHtml || previewBodyToHtml(bodyText) || `<p>${bodyText.replace(/\n/g, '</p><p>')}</p>`;
          const bodyTextB = abBodyTextB || bodyText;
          const bodyHtmlB = abBodyHtmlB || (bodyTextB ? previewBodyToHtml(bodyTextB) : '');
          const recipients = recipientsToUse
            .filter(person => person.email)
            .map((person: any) => {
              const variant = useAb ? (Math.random() * 100 < abTrafficSplit ? 'A' : 'B') : null;
              const subj = variant === 'B' ? (abSubjectB || subject) : subject;
              const text = variant === 'B' ? bodyTextB : bodyText;
              const htmlForDb = variant === 'B' ? bodyHtmlB : bodyHtmlA;
              return {
                campaign_id: draftId,
                person_id: personIdForDb(person),
                email: person.email,
                name: `${person.first_name} ${person.last_name}`.trim(),
                personalized_subject: personalizeText(subj, person),
                personalized_body_html: personalizeText(htmlForDb, person),
                personalized_body_text: personalizeText(text, person),
                status: 'pending',
                email_period: 'new',
                ...(variant && { ab_variant: variant }),
              };
            });

          const { error: recipientsError } = await supabase
            .from('email_campaign_recipients')
            .insert(recipients);

          if (recipientsError) throw recipientsError;

          toast({
            title: "Draft updated",
            description: `Draft "${campaignName}" has been saved with ${recipients.length} recipients`,
          });
        } else {
          toast({
            title: "Content updated",
            description: `Campaign "${campaignName}" subject and body saved. Use Reschedule in Campaigns to set a new send time.`,
          });
        }
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
            sender_profile_id: senderProfileId || null,
            status: 'draft',
            scheduled_at: scheduledAt,
            total_recipients: recipientsToUse.length,
            tags: campaignTags,
            auto_follow_up_enabled: autoFollowUpEnabled,
            follow_up_sequence_id: followUpSequenceId || null,
            ab_test_enabled: abTestEnabled,
            ab_subject_b: abSubjectB?.trim() || null,
            ab_body_html_b: (abBodyTextB?.trim() || abBodyHtmlB?.trim()) ? (abBodyHtmlB || (abBodyTextB ? previewBodyToHtml(abBodyTextB) : null)) : null,
            ab_body_text_b: abBodyTextB?.trim() || null,
            ab_traffic_split: abTestEnabled ? abTrafficSplit : 50,
            ab_winner_metric: abTestEnabled ? abWinnerMetric : null,
            header_image_url: headerImageUrl.trim() || null,
          })
          .select()
          .single();

        if (campaignError) throw campaignError;

        setDraftId(campaign.id);

        const useAbDraft = abTestEnabled && (abSubjectB?.trim() || abBodyHtmlB?.trim() || abBodyTextB?.trim());
        const bodyHtmlADraft = bodyHtml || previewBodyToHtml(bodyText) || `<p>${bodyText.replace(/\n/g, '</p><p>')}</p>`;
        const bodyTextBDraft = abBodyTextB || bodyText;
        const bodyHtmlBDraft = abBodyHtmlB || (bodyTextBDraft ? previewBodyToHtml(bodyTextBDraft) : '');
        // Create recipients (person_id must be a real UUID; synthetic "rec-*" ids are null)
        const recipients = recipientsToUse
          .filter(person => person.email)
          .map((person: any) => {
            const variant = useAbDraft ? (Math.random() * 100 < abTrafficSplit ? 'A' : 'B') : null;
            const subj = variant === 'B' ? (abSubjectB || subject) : subject;
            const text = variant === 'B' ? bodyTextBDraft : bodyText;
            const htmlForDb = variant === 'B' ? bodyHtmlBDraft : bodyHtmlADraft;
            return {
              campaign_id: campaign.id,
              person_id: personIdForDb(person),
              email: person.email,
              name: `${person.first_name} ${person.last_name}`.trim(),
              personalized_subject: personalizeText(subj, person),
              personalized_body_html: personalizeText(htmlForDb, person),
              personalized_body_text: personalizeText(text, person),
              status: 'pending',
              email_period: 'new',
              ...(variant && { ab_variant: variant }),
            };
          });

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

  const handleHeaderImageUpload = async (file: File) => {
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "File too large", description: "Please select an image under 5MB.", variant: "destructive" });
      return;
    }
    const validTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!validTypes.includes(file.type)) {
      toast({ title: "Invalid file type", description: "JPG, PNG, WEBP, or GIF only.", variant: "destructive" });
      return;
    }
    try {
      setUploadingHeaderImage(true);
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser?.id) throw new Error("Not authenticated");
      const ext = file.name.split(".").pop() || "jpg";
      const fileName = `${authUser.id}/campaign-header/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from("email-branding").upload(fileName, file, { upsert: true });
      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from("email-branding").getPublicUrl(fileName);
      setHeaderImageUrl(data.publicUrl);
      toast({ title: "Header image uploaded" });
    } catch (err: any) {
      toast({ title: "Upload failed", description: err?.message || "Failed to upload.", variant: "destructive" });
    } finally {
      setUploadingHeaderImage(false);
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
      setSenderProfileId(draft.sender_profile_id || '');
      setHeaderImageUrl((draft as any).header_image_url || '');
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

      setAutoFollowUpEnabled(draft.auto_follow_up_enabled !== false);
      setFollowUpSequenceId(draft.follow_up_sequence_id || "");

      const abEnabled = !!(draft as any).ab_test_enabled;
      setAbTestEnabled(abEnabled);
      setAbSectionOpen(abEnabled || !!(draft as any).ab_subject_b || !!(draft as any).ab_body_text_b);
      setAbSubjectB((draft as any).ab_subject_b ?? "");
      setAbBodyHtmlB((draft as any).ab_body_html_b ?? "");
      setAbBodyTextB((draft as any).ab_body_text_b ?? "");
      setAbTrafficSplit(typeof (draft as any).ab_traffic_split === 'number' ? (draft as any).ab_traffic_split : 50);
      const metric = (draft as any).ab_winner_metric;
      setAbWinnerMetric(metric === 'click_rate' || metric === 'reply_rate' ? metric : 'open_rate');

      // Load recipients. Support rows without person_id (e.g. added from Campaign Details) for all campaign types.
      const isContentOnlyEdit = ['sending', 'completed'].includes((draft as any).status?.toLowerCase?.() ?? '');
      let newRecipients: Array<{ id: string; first_name: string; last_name: string; email: string; company_id?: string; companies?: any }> = [];

      // Load ALL recipient rows for this campaign (no status filter) so we never show 0 when rows exist.
      // Some rows may have been stored with null/different status or added from Campaign Details.
      const { data: recipientRows, error: recError } = await supabase
        .from('email_campaign_recipients')
        .select('id, person_id, email, name')
        .eq('campaign_id', draft.id);

      if (recError) {
        console.error('Error loading recipients:', recError);
      } else if ((draft.total_recipients ?? 0) > 0 && (!recipientRows || recipientRows.length === 0)) {
        console.warn('[BulkEmailDialog] Campaign has total_recipients =', draft.total_recipients, 'but email_campaign_recipients returned 0 rows for campaign_id', draft.id, '- possible RLS or data mismatch');
      }
      if (recipientRows && recipientRows.length > 0) {
        const personIds = [...new Set((recipientRows as any[]).map((r: any) => r.person_id).filter(Boolean))];
        let peopleMap: Record<string, any> = {};
        if (personIds.length > 0) {
          const { data: peopleData } = await supabase
            .from('people')
            .select('id, first_name, last_name, email, company_id, companies(id, name, tags)')
            .in('id', personIds);
          if (peopleData) peopleData.forEach((p: any) => { peopleMap[p.id] = p; });
        }
        const seenKeys = new Set<string>();
        for (const r of recipientRows as any[]) {
          const existingKey = r.person_id ? r.person_id : 'rec-' + r.id;
          if (seenKeys.has(existingKey)) continue;
          seenKeys.add(existingKey);
          if (r.person_id && peopleMap[r.person_id]) {
            const p = peopleMap[r.person_id];
            newRecipients.push({
              id: p.id,
              first_name: p.first_name ?? '',
              last_name: p.last_name ?? '',
              email: p.email ?? r.email,
              company_id: p.company_id,
              companies: p.companies,
            });
          } else {
            const parts = (r.name || '').trim().split(/\s+/);
            newRecipients.push({
              id: 'rec-' + r.id,
              first_name: parts[0] || r.email || '',
              last_name: parts.slice(1).join(' ') || '',
              email: r.email,
            });
          }
        }
      }

      // Replace recipients with this campaign's list (do not merge with previous campaign's recipients)
      setFilteredRecipients(newRecipients);

      const totalShown = newRecipients.length;
      toast({
        title: isContentOnlyEdit ? "Campaign loaded for editing" : "Draft loaded",
        description: isContentOnlyEdit
          ? `"${draft.name}" — ${totalShown} recipients (content only; manage recipients in Campaign Details)`
          : `Loaded draft "${draft.name}" with ${totalShown} recipients`,
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

  const createSequenceFromEmailBody = async () => {
    const plainBody = (bodyText || '').trim() || (bodyHtml ? bodyHtml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() : '');
    if (!plainBody) {
      toast({ title: "No email content", description: "Add subject and email body first, then create a sequence from it.", variant: "destructive" });
      return;
    }
    const content = subject.trim() ? `Subject: ${subject}\n\n${plainBody}` : plainBody;
    setCreatingSequenceFromBody(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL ?? 'https://kgndpwzqohepotahnfeo.supabase.co'}/functions/v1/sequence-chat`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
          body: JSON.stringify({ messages: [{ role: 'user', content }], extractedParams: {} }),
        }
      );
      if (!response.ok || !response.body) throw new Error('Failed to create sequence');
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = '';
      let newSequenceId: string | null = null;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });
        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf('\n')) !== -1) {
          const line = textBuffer.slice(0, newlineIndex).replace(/\r$/, '');
          textBuffer = textBuffer.slice(newlineIndex + 1);
          if (!line.startsWith('data: ') || line.trim() === 'data: [DONE]') continue;
          try {
            const parsed = JSON.parse(line.slice(6).trim());
            if (parsed.sequence?.sequenceId) {
              newSequenceId = parsed.sequence.sequenceId;
              setFollowUpSequenceId(parsed.sequence.sequenceId);
              queryClient.invalidateQueries({ queryKey: ['email-sequences-follow-up'] });
              queryClient.invalidateQueries({ queryKey: ['sequences'] });
            }
          } catch {
            // ignore parse errors for non-JSON lines
          }
        }
      }
      if (newSequenceId) {
        toast({ title: "Sequence created", description: "Follow-up sequence was generated from your email and selected below." });
      } else {
        toast({ title: "Sequence creation", description: "No sequence was returned. Try again or create one from the Sequences page.", variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "Error", description: err?.message || "Failed to create sequence from email body", variant: "destructive" });
    } finally {
      setCreatingSequenceFromBody(false);
    }
  };

  const [replacingRecipients, setReplacingRecipients] = useState(false);

  type Recipient = { id: string; first_name: string; last_name: string; email: string; company_id?: string; companies?: { id?: string; name?: string; tags?: string[] } };

  const resolveRecipientsFromLocalStorage = async (): Promise<Recipient[] | null> => {
    const preparedRaw = localStorage.getItem('leadgenie_draft_recipients');
    if (preparedRaw) {
      let list: Recipient[] = [];
      try { list = JSON.parse(preparedRaw); } catch { list = []; }
      if (list.length > 0) return list;
    }

    const personIdsRaw = localStorage.getItem('leadgenie_selected_people_ids');
    const companyIdsRaw = localStorage.getItem('leadgenie_selected_company_ids');
    const personIds: string[] = personIdsRaw ? JSON.parse(personIdsRaw) : [];
    const companyIds: string[] = companyIdsRaw ? JSON.parse(companyIdsRaw) : [];

    if (personIds.length === 0 && companyIds.length === 0) return null;

    const merged: Recipient[] = [];
    const seen = new Set<string>();

    if (personIds.length > 0) {
      const { data: byPerson } = await supabase
        .from('people')
        .select('id, first_name, last_name, email, company_id, companies(id, name, tags)')
        .in('id', personIds);
      if (byPerson) {
        for (const p of byPerson as any[]) {
          if (p.email && !seen.has(p.email.toLowerCase().trim())) {
            seen.add(p.email.toLowerCase().trim());
            merged.push({ id: p.id, first_name: p.first_name ?? '', last_name: p.last_name ?? '', email: p.email, company_id: p.company_id, companies: p.companies });
          }
        }
      }
    }

    if (companyIds.length > 0) {
      const { data: { user } } = await supabase.auth.getUser();
      // Fetch people already linked to these companies
      const { data: byCompany } = await supabase
        .from('people')
        .select('id, first_name, last_name, email, company_id, companies(id, name, tags)')
        .in('company_id', companyIds)
        .not('email', 'is', null);
      if (byCompany) {
        for (const p of byCompany as any[]) {
          if (p.email && !seen.has(p.email.toLowerCase().trim())) {
            seen.add(p.email.toLowerCase().trim());
            merged.push({ id: p.id, first_name: p.first_name ?? '', last_name: p.last_name ?? '', email: p.email, company_id: p.company_id, companies: p.companies });
          }
        }
      }
      // Also resolve company-level emails (general_email / contacts) that don't have person records yet
      const { data: companiesData } = await supabase
        .from('companies')
        .select('id, name, tags, general_email, contacts(*)')
        .in('id', companyIds);
      if (companiesData) {
        for (const company of companiesData as any[]) {
          const contactWithEmail = company.contacts?.find((c: any) => c.email);
          const companyEmail = contactWithEmail?.email || company.general_email;
          if (!companyEmail || seen.has(companyEmail.toLowerCase().trim())) continue;
          // Try to find or create a person record for this email
          const { data: existPerson } = await supabase.from('people').select('id, first_name, last_name, email, company_id, companies(id, name, tags)').ilike('email', companyEmail).maybeSingle();
          if (existPerson) {
            if (existPerson.company_id !== company.id) await supabase.from('people').update({ company_id: company.id }).eq('id', existPerson.id);
            seen.add(existPerson.email.toLowerCase().trim());
            merged.push({ id: existPerson.id, first_name: existPerson.first_name ?? '', last_name: existPerson.last_name ?? '', email: existPerson.email, company_id: company.id, companies: existPerson.companies ?? { id: company.id, name: company.name, tags: company.tags || [] } });
          } else if (user) {
            const nameParts = contactWithEmail?.name ? contactWithEmail.name.trim().split(' ') : company.name.trim().split(' ');
            const { data: newP } = await supabase.from('people').insert({ first_name: nameParts[0] || company.name, last_name: nameParts.slice(1).join(' ') || '', email: companyEmail, company_id: company.id, user_id: user.id }).select('id, first_name, last_name, email, company_id').single();
            if (newP) {
              seen.add(newP.email.toLowerCase().trim());
              merged.push({ id: newP.id, first_name: newP.first_name ?? '', last_name: newP.last_name ?? '', email: newP.email, company_id: company.id, companies: { id: company.id, name: company.name, tags: company.tags || [] } });
            }
          }
        }
      }
    }

    return merged;
  };

  const replaceRecipientsWithSelection = async () => {
    setReplacingRecipients(true);
    try {
      const resolved = await resolveRecipientsFromLocalStorage();
      if (resolved === null) {
        toast({
          title: "Open Companies or People to select recipients",
          description: "A new tab will open. Select companies or people there, then return here and click Replace again to load them.",
        });
        const path = window.location.pathname;
        const basePath = path !== '/' && path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '';
        const companiesUrl = window.location.origin + (basePath ? basePath + '/' : '/') + 'companies';
        window.open(companiesUrl, '_blank');
        return;
      }
      setFilteredRecipients(resolved);
      unfilteredRecipientsRef.current = resolved;
      setSelectedTags([]);
      toast({
        title: "Recipients updated",
        description: `Replaced with ${resolved.length} recipient(s) from your current selection. Save draft to keep this list.`,
      });
    } catch (e: any) {
      toast({ title: "Error", description: e?.message ?? "Failed to load selection", variant: "destructive" });
    } finally {
      setReplacingRecipients(false);
    }
  };

  const removeRecipient = (personId: string) => {
    setFilteredRecipients((prev) => prev.filter((p) => p.id !== personId));
  };

  const removeDuplicateRecipients = () => {
    setFilteredRecipients((prev) => {
      const seen = new Set<string>();
      const deduplicated = prev.filter((p) => {
        const email = (p.email || "").toLowerCase().trim();
        if (!email) return true; // keep entries without email (rare)
        if (seen.has(email)) return false;
        seen.add(email);
        return true;
      });
      const removed = prev.length - deduplicated.length;
      if (removed > 0) {
        toast({
          title: "Duplicates removed",
          description: `Removed ${removed} duplicate recipient(s). List now has ${deduplicated.length} unique recipients.`,
        });
      } else {
        toast({ title: "No duplicates", description: "The list already contains only unique email addresses." });
      }
      return deduplicated;
    });
  };

  const removeDuplicateWarningRecipientsFromList = () => {
    if (!duplicateRecipients?.length) return;
    const idsToRemove = new Set(duplicateRecipients.map((d: any) => d.personId).filter(Boolean));
    const emailsToRemove = new Set(
      duplicateRecipients.map((d: any) => d.email?.toLowerCase?.()?.trim()).filter(Boolean)
    );
    setFilteredRecipients((prev) =>
      prev.filter(
        (p) =>
          !idsToRemove.has(p.id) &&
          !(p.email && emailsToRemove.has(p.email.toLowerCase().trim()))
      )
    );
    toast({
      title: "Removed from list",
      description: `Removed ${duplicateRecipients.length} recipient(s) who already received a previous campaign.`,
    });
  };

  const addRecipientsFromSelection = async () => {
    setReplacingRecipients(true);
    try {
      const resolved = await resolveRecipientsFromLocalStorage();
      if (resolved === null) {
        toast({
          title: "Select recipients first",
          description: "Open Companies or People, select contacts, then return here and click Add.",
        });
        const path = window.location.pathname;
        const basePath = path !== '/' && path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '';
        const companiesUrl = window.location.origin + (basePath ? basePath + '/' : '/') + 'companies';
        window.open(companiesUrl, '_blank');
        return;
      }
      const existingEmails = new Set(filteredRecipients.map((p) => p.email?.toLowerCase().trim()));
      const newRecipients = resolved.filter((p) => !existingEmails.has(p.email?.toLowerCase().trim()));
      setFilteredRecipients((prev) => {
        const updated = newRecipients.length === 0 ? prev : [...prev, ...newRecipients];
        unfilteredRecipientsRef.current = updated;
        return updated;
      });
      toast({
        title: "Recipients added",
        description: newRecipients.length
          ? `Added ${newRecipients.length} recipient(s) from your selection.`
          : "No new recipients (all were already in the list).",
      });
    } catch (e: any) {
      toast({ title: "Error", description: e?.message ?? "Failed to load selection", variant: "destructive" });
    } finally {
      setReplacingRecipients(false);
    }
  };

  useImperativeHandle(ref, () => ({
    addRecipientsFromSelection,
    replaceRecipientsWithSelection,
  }), [addRecipientsFromSelection, replaceRecipientsWithSelection]);

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

      // Use A or B variant when A/B test is enabled (read from ref so we use the value selected in the dialog, not stale state)
      const chosenVariant = testEmailVariantRef.current;
      const hasVariantBContent = !!(abSubjectB?.trim() || abBodyTextB?.trim() || abBodyHtmlB?.trim());
      const useVariantB = abTestEnabled && chosenVariant === 'B' && hasVariantBContent;
      const subjectForTest = useVariantB ? (abSubjectB || subject) : subject;
      const bodyTextForTest = useVariantB ? (abBodyTextB || bodyText) : bodyText;

      // Use personalized email if available, otherwise use template with variables
      let testSubject: string;
      let testBodyHtml: string;
      let testBodyText: string;

      if (hasPersonalizedEmail && !useVariantB) {
        const personalized = personalizedEmails[testPerson.id];
        testSubject = personalized.subject;
        testBodyHtml = personalized.bodyHtml;
        testBodyText = personalized.bodyText;
      } else {
        testSubject = personalizeText(subjectForTest, testPerson);
        testBodyText = personalizeText(bodyTextForTest, testPerson);
        // Same mechanism for A and B: send HTML + text so server uses same path (Variant A mechanism for both)
        const bodyHtmlForTest = useVariantB
          ? (abBodyHtmlB || (abBodyTextB ? previewBodyToHtml(abBodyTextB) : '') || bodyText)
          : (bodyHtml || previewBodyToHtml(bodyText) || `<p>${bodyText.replace(/\n/g, '</p><p>')}</p>`);
        testBodyHtml = personalizeText(bodyHtmlForTest, testPerson);
      }

      const payload: Record<string, unknown> = {
        toEmail: testEmailAddress,
        toName: 'Test Recipient',
        subject: testSubject,
        bodyText: testBodyText,
        sender,
        senderConnectionId: senderConnectionId || undefined,
        sender_profile_id: senderProfileId || undefined,
        attachments: attachments.length > 0 ? attachments : undefined,
      };
      if (testBodyHtml !== undefined) payload.bodyHtml = testBodyHtml;

      const { data: invokeData, error } = await supabase.functions.invoke('send-crm-email', {
        body: payload,
      });

      if (error) {
        let msg = (invokeData as any)?.error ?? error?.message ?? "Edge Function returned a non-2xx status code";
        const ctx = (error as { context?: Response })?.context;
        if (ctx && typeof (ctx as Response).json === "function") {
          try {
            const body = await (ctx as Response).json();
            if (body && typeof body === "object" && typeof body.error === "string") msg = body.error;
          } catch (_) {}
        }
        throw new Error(msg);
      }

      toast({
        title: "Test email sent",
        description: `Test email (Variant ${chosenVariant}) sent to ${testEmailAddress}${hasPersonalizedEmail && !useVariantB ? ` (personalized for ${testPerson.first_name} ${testPerson.last_name})` : ` (for ${testPerson.first_name} ${testPerson.last_name})`}`,
      });

      setTestEmailDialogOpen(false);
      setTestEmailAddress("");
      setTestRecipientId(null);
      setTestEmailVariant('A');
      testEmailVariantRef.current = 'A';
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

      // Content-only edit (paused/sending/completed): update campaign only, do not replace recipients. Close so user can Resume from campaign view.
      const contentOnly = contentOnlyEditRef.current;
      if (draftId && contentOnly) {
        const updatePayload: Record<string, unknown> = {
          name: campaignName,
          subject_template: subject,
          body_html_template: bodyHtml || `<p>${bodyText.replace(/\n/g, '</p><p>')}</p>`,
          body_text_template: bodyText,
          sender_connection_id: senderConnectionId,
          sender_profile_id: senderProfileId || null,
          tags: campaignTags,
          auto_follow_up_enabled: autoFollowUpEnabled,
          follow_up_sequence_id: followUpSequenceId || null,
          updated_at: new Date().toISOString(),
          ab_test_enabled: abTestEnabled,
          ab_subject_b: abSubjectB?.trim() || null,
          ab_body_html_b: (abBodyTextB?.trim() || abBodyHtmlB?.trim()) ? (abBodyHtmlB || (abBodyTextB ? previewBodyToHtml(abBodyTextB) : null)) : null,
          ab_body_text_b: abBodyTextB?.trim() || null,
          ab_traffic_split: abTestEnabled ? abTrafficSplit : 50,
          ab_winner_metric: abTestEnabled ? abWinnerMetric : null,
          header_image_url: headerImageUrl.trim() || null,
        };
        if (scheduleEnabled && scheduledAt) {
          updatePayload.status = 'scheduled';
          updatePayload.scheduled_at = scheduledAt;
        }
        // If not scheduling, keep status as paused so they can click Resume
        const { error: contentUpdateError } = await supabase
          .from('email_campaigns')
          .update(updatePayload)
          .eq('id', draftId);
        if (contentUpdateError) throw contentUpdateError;

        if (scheduleEnabled && scheduledAt && scheduledDateTime) {
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
            title: "Content saved & scheduled",
            description: `Campaign will resume sending at ${formattedDate}. No new campaign created—same recipients.`,
          });
        } else {
          toast({
            title: "Content saved",
            description: "Close this dialog and click Resume on the campaign to continue sending to remaining recipients.",
          });
        }
        queryClient.invalidateQueries({ queryKey: ['email-campaigns'] });
        onOpenChange(false);
        setSending(false);
        return;
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
            sender_profile_id: senderProfileId || null,
            status: campaignStatus,
            scheduled_at: scheduledAt,
            total_recipients: recipientsToUse.length,
            tags: campaignTags,
            auto_follow_up_enabled: autoFollowUpEnabled,
            follow_up_sequence_id: followUpSequenceId || null,
            updated_at: new Date().toISOString(),
            ab_test_enabled: abTestEnabled,
            ab_subject_b: abSubjectB?.trim() || null,
            ab_body_html_b: (abBodyTextB?.trim() || abBodyHtmlB?.trim()) ? (abBodyHtmlB || (abBodyTextB ? previewBodyToHtml(abBodyTextB) : null)) : null,
            ab_body_text_b: abBodyTextB?.trim() || null,
            ab_traffic_split: abTestEnabled ? abTrafficSplit : 50,
            ab_winner_metric: abTestEnabled ? abWinnerMetric : null,
            header_image_url: headerImageUrl.trim() || null,
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
            sender_profile_id: senderProfileId || null,
            status: campaignStatus,
            scheduled_at: scheduledAt,
            total_recipients: recipientsToUse.length,
            tags: campaignTags,
            auto_follow_up_enabled: autoFollowUpEnabled,
            follow_up_sequence_id: followUpSequenceId || null,
            ab_test_enabled: abTestEnabled,
            ab_subject_b: abSubjectB?.trim() || null,
            ab_body_html_b: (abBodyTextB?.trim() || abBodyHtmlB?.trim()) ? (abBodyHtmlB || (abBodyTextB ? previewBodyToHtml(abBodyTextB) : null)) : null,
            ab_body_text_b: abBodyTextB?.trim() || null,
            ab_traffic_split: abTestEnabled ? abTrafficSplit : 50,
            ab_winner_metric: abTestEnabled ? abWinnerMetric : null,
            header_image_url: headerImageUrl.trim() || null,
          })
          .select()
          .single();

        if (campaignError) throw campaignError;
        campaign = newCampaign;
      }

      const useAbSend = abTestEnabled && (abSubjectB?.trim() || abBodyHtmlB?.trim() || abBodyTextB?.trim());
      const bodyHtmlASend = bodyHtml || previewBodyToHtml(bodyText) || `<p>${bodyText.replace(/\n/g, '</p><p>')}</p>`;
      const bodyTextBSend = abBodyTextB || bodyText;
      const bodyHtmlBSend = abBodyHtmlB || (bodyTextBSend ? previewBodyToHtml(bodyTextBSend) : '');
      // Create recipients with personalized content (same mechanism for A and B: store HTML + text)
      const recipients = recipientsToUse
        .filter(person => person.email) // Only include people with emails
        .map((person: any) => {
          const variant = useAbSend ? (Math.random() * 100 < abTrafficSplit ? 'A' : 'B') : null;
          const subj = variant === 'B' ? (abSubjectB || subject) : subject;
          const text = variant === 'B' ? bodyTextBSend : bodyText;
          const htmlForDb = variant === 'B' ? bodyHtmlBSend : bodyHtmlASend;
          return {
            campaign_id: campaign.id,
            person_id: personIdForDb(person),
            email: person.email,
            name: `${person.first_name} ${person.last_name}`.trim(),
            personalized_subject: personalizeText(subj, person),
            personalized_body_html: personalizeText(htmlForDb, person),
            personalized_body_text: personalizeText(text, person),
            status: 'pending',
            email_period: 'new', // Mark as new email
            ...(variant && { ab_variant: variant }),
          };
        });

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
      setSenderProfileId("");
      setHeaderImageUrl("");
      setSelectedTags([]);
      setTemplate('blank');
      setAbTestEnabled(false);
      setAbSectionOpen(false);
      setAbSubjectB("");
      setAbBodyHtmlB("");
      setAbBodyTextB("");
      setAbTrafficSplit(50);
      setAbWinnerMetric('open_rate');
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
      setAutoFollowUpEnabled(true);
      setFollowUpSequenceId("");
      setExcludedCampaignIds([]);
      setDraftId(null);
      try {
        localStorage.removeItem(BULK_EMAIL_DRAFT_KEY);
      } catch {
        // ignore
      }

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

  const previewPerson = recipientsToUse[0];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle>Send Bulk Email</DialogTitle>
          <DialogDescription className="space-y-1">
            <span>
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
            </span>
            <p className="text-xs text-muted-foreground pt-0.5">
              Use filters below to exclude recipients from previous campaigns and avoid duplicate sends. Duplicate emails in the list are removed automatically.
            </p>
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
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-3 border-amber-400 dark:border-amber-600 text-amber-800 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-900/40"
                    onClick={removeDuplicateWarningRecipientsFromList}
                  >
                    <Minus className="h-4 w-4 mr-1" />
                    Remove duplicate{duplicateRecipients.length > 1 ? 's' : ''} from list
                  </Button>
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
                    disabled={generatingAi || generatingPersonalized || recipientsToUse.length === 0}
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

          <Collapsible open={abSectionOpen} onOpenChange={setAbSectionOpen}>
            <div className={`rounded-lg border-2 p-3 space-y-3 transition-colors ${abTestEnabled ? 'border-primary bg-primary/10' : 'border-border bg-muted/30'}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-3">
                  <CollapsibleTrigger asChild>
                    <Button type="button" variant="ghost" size="sm" className="flex items-center gap-2 font-medium">
                      <FlaskConical className={`h-4 w-4 ${abTestEnabled ? 'text-primary' : ''}`} />
                      A/B test (body)
                      {abSectionOpen ? null : <ChevronDown className="h-4 w-4" />}
                    </Button>
                  </CollapsibleTrigger>
                  <div className="flex items-center gap-2">
                    <Switch
                      id="ab-test-enabled"
                      checked={abTestEnabled}
                      onCheckedChange={(checked) => {
                        setAbTestEnabled(checked);
                        if (checked) setAbSectionOpen(true);
                      }}
                    />
                    <Label htmlFor="ab-test-enabled" className={`text-sm cursor-pointer ${abTestEnabled ? 'font-semibold text-primary' : 'font-normal text-muted-foreground'}`}>
                      Use A/B test when sending
                    </Label>
                    <Badge variant={abTestEnabled ? 'default' : 'secondary'} className={abTestEnabled ? 'bg-primary' : ''}>
                      {abTestEnabled ? 'ON' : 'OFF'}
                    </Badge>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Split:</span>
                  <Select value={String(abTrafficSplit)} onValueChange={(v) => setAbTrafficSplit(Number(v))}>
                    <SelectTrigger className="w-[100px] h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="50">50% / 50%</SelectItem>
                      <SelectItem value="60">60% / 40%</SelectItem>
                      <SelectItem value="70">70% / 30%</SelectItem>
                      <SelectItem value="80">80% / 20%</SelectItem>
                      <SelectItem value="33">33% / 67%</SelectItem>
                      <SelectItem value="40">40% / 60%</SelectItem>
                    </SelectContent>
                  </Select>
                  <span className="text-xs text-muted-foreground">Winner by:</span>
                  <Select value={abWinnerMetric} onValueChange={(v: 'open_rate' | 'click_rate' | 'reply_rate') => setAbWinnerMetric(v)}>
                    <SelectTrigger className="w-[120px] h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="open_rate">Open rate</SelectItem>
                      <SelectItem value="click_rate">Click rate</SelectItem>
                      <SelectItem value="reply_rate">Reply rate</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <CollapsibleContent className="space-y-3 pt-2">
                <div className="rounded-md bg-muted/50 p-3 space-y-2 text-sm">
                  <p className="font-medium text-foreground">How A/B testing works</p>
                  <ul className="text-muted-foreground space-y-1 list-disc list-inside">
                    <li><strong>Variant A</strong> = subject and email body in the section above (main compose).</li>
                    <li><strong>Variant B</strong> = subject and body in the fields below.</li>
                    <li>When you send, each recipient gets either A or B at random (e.g. 50% / 50%).</li>
                    <li>After the campaign, open the campaign in Campaigns to see which variant won (by open rate, click rate, or reply rate).</li>
                  </ul>
                  <p className="text-xs text-muted-foreground pt-1">
                    <strong>Preview Variant B:</strong> Scroll down to the &quot;Preview for [recipient]&quot; section (below the email body) — when A/B is on and Variant B has content, you&apos;ll see <strong>Variant A</strong> and <strong>Variant B</strong> tabs there.
                  </p>
                  <p className="text-xs text-muted-foreground pt-1">
                    <strong>Test Variant B:</strong> Click &quot;Send Test Email&quot; (or &quot;Test Email&quot;), then choose &quot;Send test as: Variant B&quot; to send yourself the alternative. Send both A and B to compare in your inbox before going live.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Variant B — Subject</Label>
                  <Input
                    value={abSubjectB}
                    onChange={(e) => setAbSubjectB(e.target.value)}
                    placeholder="Alternative subject line"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Variant B — Body</Label>
                  <Textarea
                    value={abBodyTextB}
                    onChange={(e) => setAbBodyTextB(e.target.value)}
                    placeholder="Alternative email body (same placeholders: {{firstName}}, {{companyName}}, etc.)"
                    className="min-h-[120px] bg-background"
                  />
                </div>
              </CollapsibleContent>
            </div>
          </Collapsible>

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
                {connections
                  ?.filter((c) => c.status === 'active')
                  .map((conn) => {
                    const fromEmail = conn.from_email || '';
                    const matchProfile = senderProfiles.find(
                      (p: { sender_email?: string }) => p.sender_email && fromEmail && String(p.sender_email).toLowerCase() === fromEmail.toLowerCase()
                    );
                    const displayName = matchProfile?.sender_name || matchProfile?.display_name || matchProfile?.name || businessProfile?.company_name || 'Your Business';
                    const providerLabel =
                      conn.provider === 'resend'
                        ? 'Resend'
                        : conn.provider === 'sendgrid'
                          ? 'SendGrid'
                          : conn.provider === 'smtp'
                            ? 'SMTP Direct'
                            : conn.provider === 'gmail' || conn.provider === 'gmail_direct'
                              ? 'Gmail'
                              : conn.provider === 'outlook'
                                ? 'Outlook'
                                : conn.provider;
                    const icon =
                      conn.provider === 'resend' ? '🚀' : conn.provider === 'sendgrid' ? '📬' : conn.provider === 'smtp' ? '⚙️' : conn.provider === 'gmail' || conn.provider === 'gmail_direct' ? '📧' : '✉️';
                    return (
                      <SelectItem key={conn.id} value={conn.id}>
                        <div className="flex items-center gap-2">
                          <span>{icon}</span>
                          <div>
                            <div className="font-medium">{providerLabel}</div>
                            <div className="text-xs text-muted-foreground">
                              {displayName} &lt;{fromEmail || 'Connected account'}&gt;
                            </div>
                          </div>
                        </div>
                      </SelectItem>
                    );
                  })}
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

          <div className="space-y-2">
            <Label>Header image (optional)</Label>
            <p className="text-xs text-muted-foreground">
              Override the email branding logo for this campaign. Leave empty to use your sender profile or default branding.
            </p>
            <div className="flex gap-2">
              <Input
                value={headerImageUrl}
                onChange={(e) => setHeaderImageUrl(e.target.value)}
                placeholder="https://… or upload below"
                className="flex-1"
              />
              <input
                ref={headerImageFileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleHeaderImageUpload(f); e.target.value = ""; }}
              />
              <Button type="button" variant="outline" size="sm" onClick={() => headerImageFileRef.current?.click()} disabled={uploadingHeaderImage}>
                {uploadingHeaderImage ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              </Button>
              {headerImageUrl ? (
                <Button type="button" variant="ghost" size="sm" onClick={() => setHeaderImageUrl("")}>Clear</Button>
              ) : null}
            </div>
            {headerImageUrl ? (
              <div className="rounded border p-2 bg-muted/30">
                <p className="text-xs text-muted-foreground mb-1">Preview (shown at top of email):</p>
                <img src={headerImageUrl} alt="" className="max-h-16 w-auto object-contain rounded" onError={() => {}} />
              </div>
            ) : null}
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

          {/* Auto follow-up: reminders when no response */}
          <div className="space-y-3 rounded-lg border bg-muted/30 p-4">
            <div className="flex items-center justify-between">
              <div className="flex flex-col gap-0.5">
                <Label htmlFor="auto-follow-up" className="cursor-pointer font-medium">
                  Auto follow-up
                </Label>
                <p className="text-xs text-muted-foreground">
                  Send reminder emails when recipients don&apos;t respond (via sequence)
                </p>
              </div>
              <Switch
                id="auto-follow-up"
                checked={autoFollowUpEnabled}
                onCheckedChange={setAutoFollowUpEnabled}
                disabled={sending || generatingAi}
              />
            </div>
            {autoFollowUpEnabled && (
              <div className="space-y-2 pt-2">
                <Label>Follow-up sequence</Label>
                <Select
                  value={followUpSequenceId || "none"}
                  onValueChange={(v) => setFollowUpSequenceId(v === "none" ? "" : v)}
                  disabled={sending || generatingAi}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select sequence for reminders..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No follow-up sequence</SelectItem>
                    {followUpSequences.map((seq: { id: string; name: string }) => (
                      <SelectItem key={seq.id} value={seq.id}>
                        {seq.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Recipients who don&apos;t reply will get follow-up steps from this sequence (no-reply rules apply).
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={createSequenceFromEmailBody}
                  disabled={creatingSequenceFromBody || sending || generatingAi || !(bodyText?.trim() || (bodyHtml && bodyHtml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()))}
                  className="mt-2 border-primary/50 hover:bg-primary/10"
                >
                  {creatingSequenceFromBody ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Creating sequence...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4 mr-2" />
                      Create sequence from email body
                    </>
                  )}
                </Button>
                <p className="text-xs text-muted-foreground">
                  AI will infer audience and steps from your email content and add the new sequence above.
                </p>
                {selectedFollowUpSequence && (
                  <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold">Sequence preview</span>
                      <a
                        href="/sequences"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-primary hover:underline inline-flex items-center gap-1"
                      >
                        <ExternalLink className="h-3 w-3" />
                        View or edit sequence
                      </a>
                    </div>
                    <div className="flex items-center gap-2 group">
                      {editingFollowUpSequenceName ? (
                        <Input
                          value={followUpSequenceNameEdit}
                          onChange={(e) => setFollowUpSequenceNameEdit(e.target.value)}
                          onBlur={async () => {
                            const trimmed = followUpSequenceNameEdit.trim() || selectedFollowUpSequence.name;
                            setEditingFollowUpSequenceName(false);
                            if (trimmed !== selectedFollowUpSequence.name) {
                              try {
                                await updateSequence.mutateAsync({
                                  id: selectedFollowUpSequence.id,
                                  updates: { name: trimmed },
                                });
                                queryClient.invalidateQueries({ queryKey: ['email-sequences-follow-up'] });
                              } catch {
                                setFollowUpSequenceNameEdit(selectedFollowUpSequence.name);
                              }
                            }
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                            if (e.key === "Escape") {
                              setFollowUpSequenceNameEdit(selectedFollowUpSequence.name);
                              setEditingFollowUpSequenceName(false);
                              (e.target as HTMLInputElement).blur();
                            }
                          }}
                          className="h-8 text-sm font-medium"
                          autoFocus
                        />
                      ) : (
                        <>
                          <span className="text-sm font-medium truncate flex-1 min-w-0">
                            {selectedFollowUpSequence.name}
                          </span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => {
                              setFollowUpSequenceNameEdit(selectedFollowUpSequence.name);
                              setEditingFollowUpSequenceName(true);
                            }}
                            title="Edit sequence title"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </Button>
                        </>
                      )}
                    </div>
                    <div className="space-y-1.5 max-h-[200px] overflow-y-auto">
                      {(() => {
                        const steps = selectedFollowUpSequence.steps;
                        if (!steps || !Array.isArray(steps) || steps.length === 0) {
                          return <p className="text-xs text-muted-foreground">No steps in this sequence.</p>;
                        }
                        return steps.map((step: unknown, idx: number) => {
                          let parsed: { subject?: string; body?: string; delayDays?: number } = {};
                          try {
                            parsed = typeof step === 'string' ? JSON.parse(step) : (step as object) || {};
                          } catch {
                            parsed = {};
                          }
                          const subject = parsed.subject || '(No subject)';
                          const bodyPreview = (parsed.body || '')
                            .replace(/<[^>]+>/g, ' ')
                            .replace(/\s+/g, ' ')
                            .trim()
                            .slice(0, 80);
                          return (
                            <div key={idx} className="text-xs border-l-2 border-primary/50 pl-2 py-0.5">
                              <span className="font-medium text-muted-foreground">Step {idx + 1}</span>
                              {parsed.delayDays != null && parsed.delayDays > 0 && (
                                <span className="text-muted-foreground ml-1">(Day {parsed.delayDays})</span>
                              )}
                              <div className="font-medium mt-0.5">{subject}</div>
                              {bodyPreview && <div className="text-muted-foreground truncate">{bodyPreview}{bodyPreview.length >= 80 ? '…' : ''}</div>}
                            </div>
                          );
                        });
                      })()}
                    </div>
                  </div>
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
            {abTestEnabled && (
              <div className="flex items-center gap-2 text-sm font-medium text-primary">
                <span className="rounded bg-primary/10 px-2 py-0.5">Variant A</span>
                <span className="text-muted-foreground font-normal">— main email (subject & body below)</span>
              </div>
            )}
            <Label htmlFor="subject">{abTestEnabled ? 'Variant A — Subject' : 'Subject Line'}</Label>
            <Input
              id="subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g., Quick question for {{firstName}}"
            />
          </div>

          <div className="flex justify-between items-center">
            <Label>{abTestEnabled ? 'Variant A — Email body' : 'Email Content'}</Label>
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
                disabled={generatingAi || sending || recipientsToUse.length === 0}
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

          {previewPerson && (() => {
            const sp = senderProfiles.find(p => p.id === senderProfileId);
            const previewTemplate: EmailTemplatePreviewStyle =
              (sp?.template_style as EmailTemplatePreviewStyle) ||
              (businessProfile?.email_template_style as EmailTemplatePreviewStyle) ||
              'professional';
            const previewBrandColor = sp?.brand_color || businessProfile?.email_brand_color || '#4b5cf6';
            const previewLogoUrl = sp?.logo_url || businessProfile?.email_logo_url || undefined;
            const previewHeaderName = sp?.display_name || businessProfile?.email_header_name || undefined;
            const previewCompanyName = businessProfile?.company_name || undefined;
            const previewSenderName = sp?.sender_name || businessProfile?.email_sender_name || userProfile?.full_name || 'John Doe';
            const previewSenderTitle = sp?.sender_title || businessProfile?.email_sender_title || userProfile?.job_title || '';
            const previewSenderEmail = sp?.sender_email || businessProfile?.email_sender_email || userProfile?.email || '';
            const previewFooterText = sp?.footer_text || businessProfile?.email_footer_text || undefined;
            const previewFooterImage = sp?.footer_logo_url || sp?.logo_url || businessProfile?.email_footer_logo_url || businessProfile?.email_logo_url || undefined;
            const previewWebsiteUrl = sp?.website_url || businessProfile?.website || undefined;
            const previewSenderImageUrl = sp?.sender_image_url || businessProfile?.email_sender_image_url || userProfile?.avatar_url || undefined;
            const previewSignature = (sp?.signature ?? businessProfile?.email_signature ?? '')?.trim() || undefined;
            const previewSubjectA = personalizeText(subject, previewPerson) || 'No subject';
            const previewBodyA = personalizeText(bodyHtml || previewBodyToHtml(bodyText), previewPerson) || '<p>Your email body will appear here...</p>';
            const bodyHtmlB = abBodyHtmlB || (abBodyTextB ? previewBodyToHtml(abBodyTextB) : '');
            const previewSubjectB = personalizeText(abSubjectB || subject, previewPerson) || 'No subject';
            const previewBodyB = personalizeText(bodyHtmlB || previewBodyA, previewPerson) || '<p>Variant B body...</p>';
            const showAbPreviews = (abSubjectB?.trim() || abBodyTextB?.trim()) ? true : false;

            return (
              <div className="rounded-lg border bg-muted/50 p-4 space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Eye className="h-4 w-4" />
                  Preview for {previewPerson.first_name} {previewPerson.last_name}
                  {sp && <Badge variant="secondary" className="text-xs">{sp.name}</Badge>}
                </div>
                {showAbPreviews ? (
                  <Tabs defaultValue="previewA" className="w-full">
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="previewA">Variant A</TabsTrigger>
                      <TabsTrigger value="previewB">Variant B</TabsTrigger>
                    </TabsList>
                    <TabsContent value="previewA" className="mt-3 space-y-2">
                      <div className="text-sm">
                        <strong>Subject:</strong> {previewSubjectA}
                      </div>
                      <div className="rounded-lg border bg-muted/20 p-3 overflow-auto max-h-[400px]">
                        <EmailTemplatePreview
                          template={previewTemplate}
                          brandColor={previewBrandColor}
                          logoUrl={previewLogoUrl}
                          companyName={previewCompanyName}
                          headerName={previewHeaderName}
                          senderName={previewSenderName}
                          senderTitle={previewSenderTitle}
                          senderEmail={previewSenderEmail}
                          footerText={previewFooterText}
                          footerImageUrl={previewFooterImage}
                          senderImageUrl={previewSenderImageUrl}
                          websiteUrl={previewWebsiteUrl}
                          signature={previewSignature}
                          bodyHtml={previewBodyA}
                        />
                      </div>
                    </TabsContent>
                    <TabsContent value="previewB" className="mt-3 space-y-2">
                      <div className="text-sm">
                        <strong>Subject:</strong> {previewSubjectB}
                      </div>
                      <div className="rounded-lg border bg-muted/20 p-3 overflow-auto max-h-[400px]">
                        <EmailTemplatePreview
                          template={previewTemplate}
                          brandColor={previewBrandColor}
                          logoUrl={previewLogoUrl}
                          companyName={previewCompanyName}
                          headerName={previewHeaderName}
                          senderName={previewSenderName}
                          senderTitle={previewSenderTitle}
                          senderEmail={previewSenderEmail}
                          footerText={previewFooterText}
                          footerImageUrl={previewFooterImage}
                          senderImageUrl={previewSenderImageUrl}
                          websiteUrl={previewWebsiteUrl}
                          signature={previewSignature}
                          bodyHtml={previewBodyB}
                        />
                      </div>
                    </TabsContent>
                  </Tabs>
                ) : (
                  <>
                    <div className="text-sm">
                      <div className="mb-2">
                        <strong>Subject:</strong> {previewSubjectA}
                      </div>
                    </div>
                    <div className="rounded-lg border bg-muted/20 p-3 overflow-auto max-h-[500px]">
                      <EmailTemplatePreview
                        template={previewTemplate}
                        brandColor={previewBrandColor}
                        logoUrl={previewLogoUrl}
                        companyName={previewCompanyName}
                        headerName={previewHeaderName}
                        senderName={previewSenderName}
                        senderTitle={previewSenderTitle}
                        senderEmail={previewSenderEmail}
                        footerText={previewFooterText}
                        footerImageUrl={previewFooterImage}
                        senderImageUrl={previewSenderImageUrl}
                        websiteUrl={previewWebsiteUrl}
                        signature={previewSignature}
                        bodyHtml={previewBodyA}
                      />
                    </div>
                  </>
                )}
              </div>
            );
          })()}

          <div className="rounded-lg border p-4">
            <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4" />
                <span className="text-sm font-medium">Selected Recipients</span>
                <Badge variant="secondary">{recipientsToUse.length}</Badge>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addRecipientsFromSelection}
                  disabled={replacingRecipients}
                  className="shrink-0"
                  title="Merge your selection into the current list"
                >
                  {replacingRecipients ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="h-4 w-4 mr-1" />
                  )}
                  Add
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={replaceRecipientsWithSelection}
                  disabled={replacingRecipients}
                  title="Replace the entire list with your selection"
                >
                  <RefreshCw className="h-4 w-4 mr-1" />
                  Replace All
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={removeDuplicateRecipients}
                  disabled={recipientsToUse.length === 0}
                  title="Remove duplicate recipients (by email address)"
                >
                  <Filter className="h-4 w-4 mr-1" />
                  Remove duplicates
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground"
                  onClick={() => {
                    window.open(window.location.origin + '/companies', '_blank');
                    toast({ title: "Companies page opened", description: "Select companies, then return here and click Add or Replace All." });
                  }}
                >
                  Open Companies
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground"
                  onClick={() => {
                    window.open(window.location.origin + '/people', '_blank');
                    toast({ title: "People page opened", description: "Select people, then return here and click Add or Replace All." });
                  }}
                >
                  Open People
                </Button>
              </div>
            </div>
            <div className="max-h-32 overflow-y-auto space-y-1">
              {recipientsToUse.map((person) => (
                <div
                  key={person.id}
                  className="flex items-center justify-between gap-2 py-1 pr-1 rounded hover:bg-muted/50 group"
                >
                  <span className="text-sm text-muted-foreground truncate min-w-0">
                    {person.first_name} {person.last_name}
                    {person.email && (
                      <span className="text-muted-foreground/80"> ({person.email})</span>
                    )}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0 opacity-70 hover:opacity-100 hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => removeRecipient(person.id)}
                    aria-label={`Remove ${person.first_name} ${person.last_name}`}
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Use <Plus className="h-3 w-3 inline" /> Add to merge from Companies/People; use <Minus className="h-3 w-3 inline" /> to remove from the list. Use Remove duplicates to clean the list by email.
              {draftId && " Save draft to keep changes."}
            </p>
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
        <AlertDialog open={testEmailDialogOpen}         onOpenChange={(open) => {
          setTestEmailDialogOpen(open);
          if (open) {
            testEmailVariantRef.current = testEmailVariant;
          } else {
            setTestEmailAddress("");
            setTestRecipientId(null);
            setTestEmailVariant('A');
            testEmailVariantRef.current = 'A';
          }
        }}>
          <AlertDialogContent className="sm:max-w-[500px]">
            <AlertDialogHeader>
              <AlertDialogTitle>Send Test Email</AlertDialogTitle>
              <AlertDialogDescription>
                Send a test email to preview how your campaign will look.
                {abTestEnabled && " Choose Variant A or B below to test either version."}
                {usePersonalizedEmails && Object.keys(personalizedEmails).length > 0 
                  ? ' You can select which recipient\'s personalized email to test.'
                  : ' The email will use the template with variables personalized for the selected recipient.'}
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

              {abTestEnabled && (
                <div className="space-y-2">
                  <Label>Send test as</Label>
                  <Select
                    value={testEmailVariant}
                    onValueChange={(v: 'A' | 'B') => {
                      setTestEmailVariant(v);
                      testEmailVariantRef.current = v;
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Choose variant" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="A">Variant A (main subject & body)</SelectItem>
                      <SelectItem
                        value="B"
                        disabled={!abSubjectB?.trim() && !abBodyTextB?.trim() && !abBodyHtmlB?.trim()}
                      >
                        Variant B (alternative subject & body)
                        {(!abSubjectB?.trim() && !abBodyTextB?.trim() && !abBodyHtmlB?.trim()) && " — add content above"}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Send yourself both variants to compare before launching the campaign.
                  </p>
                </div>
              )}

              {recipientsToUse.length > 1 && (
                <div className="space-y-2">
                  <Label htmlFor="test_recipient">Test With Recipient (Optional)</Label>
                  <Select
                    value={testRecipientId || recipientsToUse[0]?.id || ''}
                    onValueChange={(value) => setTestRecipientId(value)}
                  >
                    <SelectTrigger id="test_recipient">
                      <SelectValue placeholder="Select recipient..." />
                    </SelectTrigger>
                    <SelectContent>
                      {recipientsToUse.map((person) => {
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
                        ? recipientsToUse.find(p => p.id === testRecipientId)
                        : recipientsToUse[0];
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
});

export default BulkEmailDialog;