import { useState, useMemo, useRef, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Mail, Users, Send, CheckCircle, XCircle, Clock, Eye, Shield, Zap, FlaskConical, Phone, Plus, Settings, FileText, Edit, Trash2, Building2, Copy, Save, FolderInput, CalendarClock, RotateCcw, RefreshCw } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { PhoneCampaignDialog } from "@/components/PhoneCampaignDialog";
import { PhoneServiceDialog } from "@/components/integrations/PhoneServiceDialog";
import BulkEmailDialog, { type BulkEmailDialogHandle } from "@/components/BulkEmailDialog";
import { format } from "date-fns";
import { useSearchParams, useLocation, useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import EmailDeliverability from "./EmailDeliverability";
import AutomationRules from "./AutomationRules";
import ABTesting from "./ABTesting";

interface Campaign {
  id: string;
  name: string;
  status: string;
  total_recipients: number;
  sent_count: number;
  opened_count: number;
  failed_count: number;
  created_at: string;
  updated_at?: string;
  started_at?: string;
  completed_at?: string;
  scheduled_at?: string | null;
  subject_template?: string;
  body_html_template?: string;
  body_text_template?: string;
  tags?: string[];
  auto_follow_up_enabled?: boolean;
  follow_up_sequence_id?: string | null;
  ab_test_enabled?: boolean;
  ab_winner_metric?: 'open_rate' | 'click_rate' | 'reply_rate' | null;
}

interface CampaignRecipient {
  id: string;
  email: string;
  name: string;
  status: string;
  person_id?: string | null;
  sent_at?: string;
  opened_at?: string;
  clicked_at?: string | null;
  error_message?: string;
  ab_variant?: 'A' | 'B' | null;
}

export default function Campaigns() {
  const queryClient = useQueryClient();
  const location = useLocation();
  const navigate = useNavigate();
  const [selectedCampaign, setSelectedCampaign] = useState<string | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'overview';
  const [phoneCampaignDialogOpen, setPhoneCampaignDialogOpen] = useState(false);
  const [phoneServiceDialogOpen, setPhoneServiceDialogOpen] = useState(false);
  const [bulkEmailDialogOpen, setBulkEmailDialogOpen] = useState(false);
  const [draftToEdit, setDraftToEdit] = useState<string | null>(null);
  const [editingRecipient, setEditingRecipient] = useState<CampaignRecipient | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [removingRecipient, setRemovingRecipient] = useState<CampaignRecipient | null>(null);
  const [removing, setRemoving] = useState(false);
  const [draftToDelete, setDraftToDelete] = useState<string | null>(null);
  const [deletingDraft, setDeletingDraft] = useState(false);
  const [selectedRecipientIds, setSelectedRecipientIds] = useState<Set<string>>(new Set());
  const [clearingList, setClearingList] = useState(false);
  const [bulkRemoving, setBulkRemoving] = useState(false);
  const [clearListConfirmOpen, setClearListConfirmOpen] = useState(false);
  const [addToDraftPending, setAddToDraftPending] = useState(false);
  const addToDraftProcessedRef = useRef(false);
  const bulkEmailDialogRef = useRef<BulkEmailDialogHandle>(null);
  const [draftPickerOpen, setDraftPickerOpen] = useState(false);
  const [draftPickerDrafts, setDraftPickerDrafts] = useState<Campaign[]>([]);
  const [createFromTemplateOpen, setCreateFromTemplateOpen] = useState(false);
  const [cloningFromTemplate, setCloningFromTemplate] = useState(false);
  const [saveAsGroupOpen, setSaveAsGroupOpen] = useState(false);
  const [saveAsGroupName, setSaveAsGroupName] = useState("");
  const [savingAsGroup, setSavingAsGroup] = useState(false);
  const [addFromGroupOpen, setAddFromGroupOpen] = useState(false);
  const [addingFromGroup, setAddingFromGroup] = useState(false);
  const [cancelScheduleConfirmOpen, setCancelScheduleConfirmOpen] = useState(false);
  const [cancellingSchedule, setCancellingSchedule] = useState(false);
  const [showRescheduleDialog, setShowRescheduleDialog] = useState(false);
  const [rescheduleDateTime, setRescheduleDateTime] = useState("");
  const [retryingFailed, setRetryingFailed] = useState(false);
  const [rescheduling, setRescheduling] = useState(false);
  const [enrollFollowUpSequenceId, setEnrollFollowUpSequenceId] = useState<string>("");
  const [enrollingFollowUp, setEnrollingFollowUp] = useState(false);

  const { data: followUpSequences = [] } = useQuery({
    queryKey: ['email-sequences'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('email_sequences')
        .select('id, name')
        .order('name');
      if (error) return [];
      return (data || []) as { id: string; name: string }[];
    },
  });

  const { data: campaigns, isLoading } = useQuery({
    queryKey: ['email-campaigns'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('email_campaigns')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as Campaign[];
    },
    refetchInterval: 5000,
  });

  const addToDraftFromState = (location.state as { addToDraft?: boolean })?.addToDraft === true;
  const addToDraftFromUrl = searchParams.get("addToDraft") === "1";
  const shouldAddToDraft = addToDraftFromState || addToDraftFromUrl;

  const clearAddToDraftParams = () => {
    if (addToDraftFromState) {
      navigate(location.pathname + "?" + searchParams.toString(), { replace: true, state: {} });
    } else if (addToDraftFromUrl) {
      const next = new URLSearchParams(searchParams);
      next.delete("addToDraft");
      setSearchParams(next, { replace: true });
    }
  };

  const openDraftWithRecipients = (draftId: string) => {
    setDraftToEdit(draftId);
    setBulkEmailDialogOpen(true);
    setAddToDraftPending(true);
  };

  useEffect(() => {
    if (!shouldAddToDraft || !campaigns || addToDraftProcessedRef.current) return;
    addToDraftProcessedRef.current = true;
    const drafts = campaigns.filter((c) => c.status?.toLowerCase()?.trim() === "draft");
    clearAddToDraftParams();
    if (drafts.length === 0) {
      toast.error("No drafts found. Create a draft first.");
      return;
    }
    if (drafts.length === 1) {
      openDraftWithRecipients(drafts[0].id);
    } else {
      setDraftPickerDrafts(drafts);
      setDraftPickerOpen(true);
    }
  }, [shouldAddToDraft, campaigns]);

  // After draft dialog opens with addToDraftPending, run addRecipientsFromSelection (selection is in localStorage)
  useEffect(() => {
    if (!bulkEmailDialogOpen || !draftToEdit || !addToDraftPending || !bulkEmailDialogRef.current) return;
    const t = setTimeout(() => {
      bulkEmailDialogRef.current?.addRecipientsFromSelection();
      setAddToDraftPending(false);
    }, 500);
    return () => clearTimeout(t);
  }, [bulkEmailDialogOpen, draftToEdit, addToDraftPending]);

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || !event.data?.type) return;
      if (!bulkEmailDialogOpen || !bulkEmailDialogRef.current) return;
      if (event.data.type === "LEADGENIE_ADD_RECIPIENTS_TO_DRAFT") {
        bulkEmailDialogRef.current.addRecipientsFromSelection();
        window.focus();
      } else if (event.data.type === "LEADGENIE_REPLACE_RECIPIENTS_TO_DRAFT") {
        bulkEmailDialogRef.current.replaceRecipientsWithSelection();
        window.focus();
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [bulkEmailDialogOpen]);

  const { data: recipients } = useQuery({
    queryKey: ['campaign-recipients', selectedCampaign],
    enabled: !!selectedCampaign,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('email_campaign_recipients')
        .select('*')
        .eq('campaign_id', selectedCampaign!)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data as CampaignRecipient[];
    },
  });

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      draft: "secondary",
      scheduled: "outline",
      sending: "default",
      completed: "default",
      failed: "destructive",
    };

    const icons = {
      draft: Clock,
      scheduled: Clock,
      sending: Send,
      completed: CheckCircle,
      failed: XCircle,
    };

    const Icon = icons[status as keyof typeof icons] || Mail;

    return (
      <Badge variant={variants[status] || "secondary"}>
        <Icon className="h-3 w-3 mr-1" />
        {status}
      </Badge>
    );
  };

  const getRecipientStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive"> = {
      pending: "secondary",
      sent: "default",
      failed: "destructive",
      opened: "default",
    };

    return <Badge variant={variants[status] || "secondary"}>{status}</Badge>;
  };

  const selectedCampaignData = useMemo(
    () => campaigns?.find((c) => c.id === selectedCampaign),
    [campaigns, selectedCampaign]
  );
  const failedRecipients = useMemo(
    () => (recipients ?? []).filter((r) => r.status === 'failed'),
    [recipients]
  );
  const pendingRecipientsCount = (recipients ?? []).filter((r) => r.status === 'pending').length;
  const canResendOrReschedule =
    selectedCampaignData &&
    ['sending', 'completed'].includes(selectedCampaignData.status?.toLowerCase?.() ?? '') &&
    (failedRecipients.length > 0 || pendingRecipientsCount > 0);
  const canEditRecipients =
    selectedCampaignData &&
    (["draft", "scheduled", "completed"].includes(selectedCampaignData.status?.toLowerCase?.() ?? "") ||
      canResendOrReschedule);

  const pendingRecipients = useMemo(
    () => (recipients ?? []).filter((r) => r.status === "pending"),
    [recipients]
  );

  // A/B test results: aggregate by ab_variant when campaign had A/B body test
  const abTestResults = useMemo(() => {
    const camp = selectedCampaignData;
    const recs = recipients ?? [];
    if (!camp?.ab_test_enabled || recs.length === 0) return null;
    const withVariant = recs.filter((r): r is CampaignRecipient & { ab_variant: 'A' | 'B' } => r.ab_variant === 'A' || r.ab_variant === 'B');
    if (withVariant.length === 0) return null;
    const sent = (r: CampaignRecipient) => ['sent', 'opened', 'clicked'].includes(r.status?.toLowerCase?.() ?? '') || !!r.sent_at;
    const opened = (r: CampaignRecipient) => !!r.opened_at || ['opened', 'clicked'].includes(r.status?.toLowerCase?.() ?? '');
    const clicked = (r: CampaignRecipient) => !!r.clicked_at || (r.status?.toLowerCase?.() === 'clicked');
    const byVariant = { A: withVariant.filter(r => r.ab_variant === 'A'), B: withVariant.filter(r => r.ab_variant === 'B') };
    const stats = (list: CampaignRecipient[]) => {
      const s = list.filter(sent).length;
      const o = list.filter(opened).length;
      const c = list.filter(clicked).length;
      return { sent: s, opened: o, clicked: c, openRate: s > 0 ? (o / s) * 100 : 0, clickRate: s > 0 ? (c / s) * 100 : 0 };
    };
    const a = stats(byVariant.A);
    const b = stats(byVariant.B);
    const winnerMetric = camp.ab_winner_metric ?? 'open_rate';
    const aVal = winnerMetric === 'open_rate' ? a.openRate : winnerMetric === 'click_rate' ? a.clickRate : 0;
    const bVal = winnerMetric === 'open_rate' ? b.openRate : winnerMetric === 'click_rate' ? b.clickRate : 0;
    const winner = aVal >= bVal ? 'A' : 'B';
    return { byVariant: { A: a, B: b }, winner, winnerMetric };
  }, [selectedCampaignData, recipients]);

  const handleSelectAllRecipients = () => {
    if (selectedRecipientIds.size === pendingRecipients.length) {
      setSelectedRecipientIds(new Set());
    } else {
      setSelectedRecipientIds(new Set(pendingRecipients.map((r) => r.id)));
    }
  };

  const handleClearList = async () => {
    if (!selectedCampaign || pendingRecipients.length === 0) return;
    setClearingList(true);
    try {
      const { error: deleteError } = await supabase
        .from("email_campaign_recipients")
        .delete()
        .eq("campaign_id", selectedCampaign)
        .eq("status", "pending");
      if (deleteError) throw deleteError;
      const remaining = (recipients ?? []).filter((r) => r.status !== "pending");
      const { error: updateError } = await supabase
        .from("email_campaigns")
        .update({ total_recipients: remaining.length })
        .eq("id", selectedCampaign);
      if (updateError) throw updateError;
      toast.success("Recipient list cleared. Add a new list via Continue with new list.");
      setClearListConfirmOpen(false);
      setSelectedRecipientIds(new Set());
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["campaign-recipients", selectedCampaign] }),
        queryClient.invalidateQueries({ queryKey: ["email-campaigns"] }),
      ]);
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to clear list");
    } finally {
      setClearingList(false);
    }
  };

  const handleBulkRemoveRecipients = async () => {
    if (!selectedCampaign || selectedRecipientIds.size === 0) return;
    setBulkRemoving(true);
    try {
      const { error: deleteError } = await supabase
        .from("email_campaign_recipients")
        .delete()
        .in("id", Array.from(selectedRecipientIds));
      if (deleteError) throw deleteError;
      const remainingCount = (recipients ?? []).length - selectedRecipientIds.size;
      const { error: updateError } = await supabase
        .from("email_campaigns")
        .update({ total_recipients: remainingCount })
        .eq("id", selectedCampaign);
      if (updateError) throw updateError;
      toast.success(`${selectedRecipientIds.size} recipient(s) removed`);
      setSelectedRecipientIds(new Set());
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["campaign-recipients", selectedCampaign] }),
        queryClient.invalidateQueries({ queryKey: ["email-campaigns"] }),
      ]);
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to remove recipients");
    } finally {
      setBulkRemoving(false);
    }
  };

  const openCompaniesForNewList = () => {
    window.open(window.location.origin + "/companies", "_blank");
    toast.success("Companies page opened. Select companies there, then come back and click Add Recipients.");
  };

  const openPeopleForNewList = () => {
    window.open(window.location.origin + "/people", "_blank");
    toast.success("People page opened. Select people there, then come back and click Add Recipients.");
  };

  const [addingRecipients, setAddingRecipients] = useState(false);
  const handleAddRecipientsToCampaign = async () => {
    if (!selectedCampaign) return;
    setAddingRecipients(true);
    try {
      // Resolve recipients from localStorage (prepared or ID-based)
      const preparedRaw = localStorage.getItem('leadgenie_draft_recipients');
      let resolved: Array<{ id: string; first_name: string; last_name: string; email: string; company_id?: string }> = [];
      if (preparedRaw) {
        try { resolved = JSON.parse(preparedRaw); } catch { resolved = []; }
        localStorage.removeItem('leadgenie_draft_recipients');
      }
      if (resolved.length === 0) {
        const personIdsRaw = localStorage.getItem('leadgenie_selected_people_ids');
        const companyIdsRaw = localStorage.getItem('leadgenie_selected_company_ids');
        const personIds: string[] = personIdsRaw ? JSON.parse(personIdsRaw) : [];
        const companyIds: string[] = companyIdsRaw ? JSON.parse(companyIdsRaw) : [];
        if (personIds.length > 0) {
          const { data } = await supabase.from('people').select('id, first_name, last_name, email, company_id').in('id', personIds).not('email', 'is', null);
          if (data) resolved.push(...data.map((p: any) => ({ id: p.id, first_name: p.first_name ?? '', last_name: p.last_name ?? '', email: p.email, company_id: p.company_id })));
        }
        if (companyIds.length > 0) {
          const { data: { user } } = await supabase.auth.getUser();
          const { data: byCompany } = await supabase.from('people').select('id, first_name, last_name, email, company_id').in('company_id', companyIds).not('email', 'is', null);
          if (byCompany) resolved.push(...byCompany.map((p: any) => ({ id: p.id, first_name: p.first_name ?? '', last_name: p.last_name ?? '', email: p.email, company_id: p.company_id })));
          const seenEmails = new Set(resolved.map(r => r.email.toLowerCase().trim()));
          const { data: companiesData } = await supabase.from('companies').select('id, name, tags, general_email, contacts(*)').in('id', companyIds);
          if (companiesData && user) {
            for (const company of companiesData as any[]) {
              const contactWithEmail = company.contacts?.find((c: any) => c.email);
              const companyEmail = contactWithEmail?.email || company.general_email;
              if (!companyEmail || seenEmails.has(companyEmail.toLowerCase().trim())) continue;
              const { data: existP } = await supabase.from('people').select('id, first_name, last_name, email').ilike('email', companyEmail).maybeSingle();
              if (existP) {
                seenEmails.add(existP.email.toLowerCase().trim());
                resolved.push({ id: existP.id, first_name: existP.first_name ?? '', last_name: existP.last_name ?? '', email: existP.email, company_id: company.id });
              } else {
                const nameParts = contactWithEmail?.name ? contactWithEmail.name.trim().split(' ') : company.name.trim().split(' ');
                const { data: newP } = await supabase.from('people').insert({ first_name: nameParts[0] || company.name, last_name: nameParts.slice(1).join(' ') || '', email: companyEmail, company_id: company.id, user_id: user.id }).select('id, first_name, last_name, email, company_id').single();
                if (newP) {
                  seenEmails.add(newP.email.toLowerCase().trim());
                  resolved.push({ id: newP.id, first_name: newP.first_name ?? '', last_name: newP.last_name ?? '', email: newP.email, company_id: newP.company_id });
                }
              }
            }
          }
        }
      }
      if (resolved.length === 0) {
        toast.error("No recipients found. Open Companies or People, select contacts, then come back and click Add Recipients.");
        return;
      }
      // Deduplicate against existing recipients
      const existingEmails = new Set((recipients ?? []).map(r => r.email?.toLowerCase().trim()));
      const newRecipients = resolved.filter(r => r.email && !existingEmails.has(r.email.toLowerCase().trim()));
      if (newRecipients.length === 0) {
        toast.info("All selected recipients are already in this campaign.");
        return;
      }
      const subjectTemplate = selectedCampaignData?.subject_template || '';
      const bodyHtmlTemplate = selectedCampaignData?.body_html_template || '';
      const bodyTextTemplate = selectedCampaignData?.body_text_template || '';
      const rows = newRecipients.map(r => {
        const name = [r.first_name, r.last_name].filter(Boolean).join(' ') || r.email;
        const personalizedSubject = subjectTemplate
          .replace(/\{\{firstName\}\}/gi, r.first_name || '')
          .replace(/\{\{lastName\}\}/gi, r.last_name || '')
          .replace(/\{\{fullName\}\}/gi, name)
          .replace(/\{\{email\}\}/gi, r.email || '') || '(subject pending)';
        const personalizedBodyHtml = bodyHtmlTemplate
          .replace(/\{\{firstName\}\}/gi, r.first_name || '')
          .replace(/\{\{lastName\}\}/gi, r.last_name || '')
          .replace(/\{\{fullName\}\}/gi, name)
          .replace(/\{\{email\}\}/gi, r.email || '') || '<p>(body pending)</p>';
        const personalizedBodyText = bodyTextTemplate
          .replace(/\{\{firstName\}\}/gi, r.first_name || '')
          .replace(/\{\{lastName\}\}/gi, r.last_name || '')
          .replace(/\{\{fullName\}\}/gi, name)
          .replace(/\{\{email\}\}/gi, r.email || '') || '(body pending)';
        return {
          campaign_id: selectedCampaign,
          email: r.email,
          name,
          personalized_subject: personalizedSubject,
          personalized_body_html: personalizedBodyHtml,
          personalized_body_text: personalizedBodyText,
          status: 'pending',
        };
      });
      const { error: insertError } = await supabase.from('email_campaign_recipients').insert(rows);
      if (insertError) throw insertError;
      const newTotal = (recipients?.length ?? 0) + newRecipients.length;
      await supabase.from('email_campaigns').update({ total_recipients: newTotal }).eq('id', selectedCampaign);
      toast.success(`Added ${newRecipients.length} recipient(s) to campaign.`);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["campaign-recipients", selectedCampaign] }),
        queryClient.invalidateQueries({ queryKey: ["email-campaigns"] }),
      ]);
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to add recipients");
    } finally {
      setAddingRecipients(false);
    }
  };

  const handleOpenEdit = (r: CampaignRecipient) => {
    setEditingRecipient(r);
    setEditName(r.name);
    setEditEmail(r.email);
  };

  const handleSaveEdit = async () => {
    if (!editingRecipient || !editName.trim() || !editEmail.trim()) return;
    setSavingEdit(true);
    try {
      const { error } = await supabase
        .from("email_campaign_recipients")
        .update({ name: editName.trim(), email: editEmail.trim() })
        .eq("id", editingRecipient.id);
      if (error) throw error;
      toast.success("Recipient updated");
      setEditingRecipient(null);
      await queryClient.invalidateQueries({ queryKey: ["campaign-recipients", selectedCampaign] });
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to update recipient");
    } finally {
      setSavingEdit(false);
    }
  };

  const handleRemoveRecipient = async () => {
    if (!removingRecipient || !selectedCampaign) return;
    setRemoving(true);
    try {
      const { error: deleteError } = await supabase
        .from("email_campaign_recipients")
        .delete()
        .eq("id", removingRecipient.id);
      if (deleteError) throw deleteError;
      const remaining = (recipients ?? []).filter((r) => r.id !== removingRecipient.id);
      const { error: updateError } = await supabase
        .from("email_campaigns")
        .update({ total_recipients: remaining.length })
        .eq("id", selectedCampaign);
      if (updateError) throw updateError;
      toast.success("Recipient removed");
      setRemovingRecipient(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["campaign-recipients", selectedCampaign] }),
        queryClient.invalidateQueries({ queryKey: ["email-campaigns"] }),
      ]);
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to remove recipient");
    } finally {
      setRemoving(false);
    }
  };

  // Filter draft campaigns
  const draftCampaigns = useMemo(() => {
    if (!campaigns) return [];
    return campaigns.filter(c => {
      const status = c.status?.toLowerCase()?.trim();
      return status === 'draft';
    });
  }, [campaigns]);

  const handleDeleteDraft = async () => {
    if (!draftToDelete) return;
    setDeletingDraft(true);
    try {
      const { error: recipientsError } = await supabase
        .from('email_campaign_recipients')
        .delete()
        .eq('campaign_id', draftToDelete);
      if (recipientsError) throw recipientsError;
      const { error: campaignError } = await supabase
        .from('email_campaigns')
        .delete()
        .eq('id', draftToDelete);
      if (campaignError) throw campaignError;
      toast.success('Draft deleted');
      setDraftToDelete(null);
      if (draftToEdit === draftToDelete) {
        setDraftToEdit(null);
        setBulkEmailDialogOpen(false);
      }
      await queryClient.invalidateQueries({ queryKey: ['email-campaigns'] });
    } catch (e: any) {
      toast.error(e?.message ?? 'Failed to delete draft');
    } finally {
      setDeletingDraft(false);
    }
  };

  // Create new draft from any campaign (master draft / template)
  const handleCreateFromTemplate = async (source: Campaign) => {
    setCloningFromTemplate(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('Not authenticated');
        return;
      }
      const { data: newCampaign, error } = await supabase
        .from('email_campaigns')
        .insert({
          user_id: user.id,
          name: `${source.name} (Copy)`,
          status: 'draft',
          subject_template: source.subject_template || '',
          body_html_template: source.body_html_template || '',
          body_text_template: source.body_text_template || '',
          sender_connection_id: (source as any).sender_connection_id ?? null,
          sender_profile_id: (source as any).sender_profile_id ?? null,
          tags: source.tags ?? null,
          auto_follow_up_enabled: (source as any).auto_follow_up_enabled !== false,
          follow_up_sequence_id: (source as any).follow_up_sequence_id ?? null,
          total_recipients: 0,
          sent_count: 0,
          opened_count: 0,
          failed_count: 0,
        })
        .select('id')
        .single();
      if (error) throw error;
      if (!newCampaign?.id) throw new Error('Failed to create draft');
      setCreateFromTemplateOpen(false);
      setDraftToEdit(newCampaign.id);
      setBulkEmailDialogOpen(true);
      await queryClient.invalidateQueries({ queryKey: ['email-campaigns'] });
      toast.success('New draft created from template. Add recipients and edit as needed.');
    } catch (e: any) {
      toast.error(e?.message ?? 'Failed to create draft from template');
    } finally {
      setCloningFromTemplate(false);
    }
  };

  const templateCampaigns = useMemo(() => {
    if (!campaigns) return [];
    return campaigns.filter(c => {
      const status = c.status?.toLowerCase()?.trim();
      return status === 'draft' || status === 'completed' || status === 'sending' || status === 'scheduled';
    });
  }, [campaigns]);

  const { data: recipientGroups = [], refetch: refetchRecipientGroups } = useQuery({
    queryKey: ['recipient-groups'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      const { data, error } = await supabase.from('recipient_groups').select('id, name, description, created_at').eq('user_id', user.id).order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const handleSaveAsGroup = async () => {
    const name = saveAsGroupName.trim();
    if (!name) {
      toast.error('Enter a group name');
      return;
    }
    const toSave = selectedRecipientIds.size > 0
      ? (recipients ?? []).filter(r => selectedRecipientIds.has(r.id))
      : (recipients ?? []);
    if (toSave.length === 0) {
      toast.error('No recipients to save. Select some or save all.');
      return;
    }
    setSavingAsGroup(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      const { data: group, error: groupError } = await supabase.from('recipient_groups').insert({ user_id: user.id, name }).select('id').single();
      if (groupError || !group) throw groupError || new Error('Failed to create group');
      const seen = new Set<string>();
      const members = toSave
        .filter(r => {
          const key = r.email?.trim().toLowerCase();
          if (!key || seen.has(key)) return false;
          seen.add(key);
          return true;
        })
        .map(r => {
          const parts = (r.name || '').trim().split(/\s+/);
          const first_name = parts[0] || null;
          const last_name = parts.length > 1 ? parts.slice(1).join(' ') : null;
          return { group_id: group.id, email: r.email.trim().toLowerCase(), first_name, last_name, company: null, person_id: (r as any).person_id ?? null };
        });
      const { error: membersError } = await supabase.from('recipient_group_members').insert(members);
      if (membersError) throw membersError;
      setSaveAsGroupOpen(false);
      setSaveAsGroupName('');
      await refetchRecipientGroups();
      toast.success(`Saved ${toSave.length} recipient(s) to group "${name}". Use it in campaigns or import to Newsletters.`);
    } catch (e: any) {
      toast.error(e?.message ?? 'Failed to save group');
    } finally {
      setSavingAsGroup(false);
    }
  };

  const handleCancelScheduleCampaign = async () => {
    if (!selectedCampaign) return;
    setCancellingSchedule(true);
    try {
      const { error } = await supabase
        .from('email_campaigns')
        .update({ status: 'draft', scheduled_at: null })
        .eq('id', selectedCampaign);
      if (error) throw error;
      setCancelScheduleConfirmOpen(false);
      setSelectedCampaign(null);
      await queryClient.invalidateQueries({ queryKey: ['email-campaigns'] });
      toast.success('Schedule cancelled. Campaign is back to draft.');
    } catch (e: any) {
      toast.error(e?.message ?? 'Failed to cancel schedule');
    } finally {
      setCancellingSchedule(false);
    }
  };

  const handleRetryFailed = async () => {
    if (!selectedCampaign || failedRecipients.length === 0) return;
    setRetryingFailed(true);
    try {
      const { error: updateRecipients } = await supabase
        .from('email_campaign_recipients')
        .update({ status: 'pending', error_message: null })
        .eq('campaign_id', selectedCampaign)
        .eq('status', 'failed');
      if (updateRecipients) throw updateRecipients;
      const { error: updateCampaign } = await supabase
        .from('email_campaigns')
        .update({ status: 'sending' })
        .eq('id', selectedCampaign);
      if (updateCampaign) throw updateCampaign;
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['campaign-recipients', selectedCampaign] }),
        queryClient.invalidateQueries({ queryKey: ['email-campaigns'] }),
      ]);
      toast.success(`${failedRecipients.length} recipient(s) set to pending. Cron will continue sending shortly.`);
    } catch (e: any) {
      toast.error(e?.message ?? 'Failed to retry');
    } finally {
      setRetryingFailed(false);
    }
  };

  const handleEnrollSentCampaignInFollowUp = async () => {
    const sequenceId = enrollFollowUpSequenceId?.trim() || selectedCampaignData?.follow_up_sequence_id;
    if (!selectedCampaign || !sequenceId) {
      toast.error('Select a follow-up sequence first.');
      return;
    }
    setEnrollingFollowUp(true);
    try {
      const { data: sentRecipients, error: recErr } = await supabase
        .from('email_campaign_recipients')
        .select('id, person_id, personalized_subject, personalized_body_text, sent_at')
        .eq('campaign_id', selectedCampaign)
        .in('status', ['sent', 'opened', 'clicked'])
        .not('person_id', 'is', null);
      if (recErr) throw recErr;
      if (!sentRecipients?.length) {
        toast.error('No sent recipients with contacts found. Follow-up requires recipients linked to people (company).');
        return;
      }
      const personIds = [...new Set(sentRecipients.map((r: any) => r.person_id).filter(Boolean))];
      const { data: peopleData, error: peopleErr } = await supabase
        .from('people')
        .select('id, company_id')
        .in('id', personIds);
      if (peopleErr || !peopleData?.length) {
        toast.error('Could not load contact companies.');
        return;
      }
      const companyByPerson = new Map<string, string>(peopleData.map((p: any) => [p.id, p.company_id]).filter(([, cid]) => cid));
      const { data: seqData, error: seqErr } = await supabase
        .from('email_sequences')
        .select('steps')
        .eq('id', sequenceId)
        .single();
      if (seqErr || !seqData) throw new Error('Sequence not found');
      const steps = Array.isArray(seqData.steps) ? seqData.steps : [];
      const personalizedEmails: { stepNumber: number; subject: string; body: string; delayDays: number }[] = [
        { stepNumber: 0, subject: '(Campaign)', body: '', delayDays: 0 },
      ];
      steps.forEach((step: { subject?: string; body?: string; delayDays?: number }, i: number) => {
        personalizedEmails.push({
          stepNumber: i + 1,
          subject: step?.subject ?? `Follow-up ${i + 1}`,
          body: step?.body ?? '',
          delayDays: typeof step?.delayDays === 'number' ? step.delayDays : (i === 0 ? 3 : (i + 1) * 2),
        });
      });
      const { data: existing } = await supabase
        .from('company_sequences')
        .select('company_id')
        .eq('campaign_id', selectedCampaign);
      const existingCompanies = new Set((existing || []).map((r: any) => r.company_id));
      let enrolled = 0;
      const companyToFirstRecipient = new Map<string, any>();
      for (const r of sentRecipients as any[]) {
        const cid = companyByPerson.get(r.person_id);
        if (!cid || existingCompanies.has(cid)) continue;
        if (!companyToFirstRecipient.has(cid)) companyToFirstRecipient.set(cid, r);
      }
      for (const [companyId, recipient] of companyToFirstRecipient) {
        const { data: newCs, error: csErr } = await supabase
          .from('company_sequences')
          .insert({
            company_id: companyId,
            sequence_id: sequenceId,
            campaign_id: selectedCampaign,
            current_step: 0,
            personalized_emails: personalizedEmails,
            status: 'active',
            automation_rules: {
              enabled: true,
              rules: [
                { type: 'no_reply_after_open', wait_hours: 48 },
                { type: 'no_open', wait_hours: 72 },
              ],
            },
            metadata: { first_email_sent_at: recipient.sent_at || new Date().toISOString(), campaign_recipient_id: recipient.id },
          })
          .select('id')
          .single();
        if (!csErr && newCs?.id) {
          await supabase.from('email_activities').insert({
            company_sequence_id: newCs.id,
            contact_id: null,
            step_number: 0,
            subject: recipient.personalized_subject,
            body: recipient.personalized_body_text ?? null,
            status: 'sent',
            sent_at: recipient.sent_at || new Date().toISOString(),
            metadata: { campaign_id: selectedCampaign, campaign_recipient_id: recipient.id },
          });
          enrolled++;
          existingCompanies.add(companyId);
        }
      }
      await supabase
        .from('email_campaigns')
        .update({ auto_follow_up_enabled: true, follow_up_sequence_id: sequenceId })
        .eq('id', selectedCampaign);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['email-campaigns'] }),
      ]);
      toast.success(
        enrolled > 0
          ? `Enrolled ${enrolled} company/companies in follow-up sequence. They will receive reminder steps per sequence rules.`
          : 'Campaign is now set for follow-up. All sent recipients were already enrolled.'
      );
      setEnrollFollowUpSequenceId('');
    } catch (e: any) {
      toast.error(e?.message ?? 'Failed to enroll in follow-up sequence');
    } finally {
      setEnrollingFollowUp(false);
    }
  };

  const handleRescheduleCampaign = async () => {
    if (!selectedCampaign || !rescheduleDateTime.trim()) return;
    const at = new Date(rescheduleDateTime);
    if (isNaN(at.getTime()) || at <= new Date()) {
      toast.error('Choose a future date and time.');
      return;
    }
    setRescheduling(true);
    try {
      const { error: updateRecipients } = await supabase
        .from('email_campaign_recipients')
        .update({ status: 'pending', error_message: null })
        .eq('campaign_id', selectedCampaign)
        .eq('status', 'failed');
      if (updateRecipients) throw updateRecipients;
      const { error: updateCampaign } = await supabase
        .from('email_campaigns')
        .update({ status: 'scheduled', scheduled_at: at.toISOString() })
        .eq('id', selectedCampaign);
      if (updateCampaign) throw updateCampaign;
      setShowRescheduleDialog(false);
      setRescheduleDateTime('');
      setSelectedCampaign(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['campaign-recipients', selectedCampaign] }),
        queryClient.invalidateQueries({ queryKey: ['email-campaigns'] }),
      ]);
      toast.success(`Campaign rescheduled for ${at.toLocaleString()}. Pending and failed recipients will be sent then.`);
    } catch (e: any) {
      toast.error(e?.message ?? 'Failed to reschedule');
    } finally {
      setRescheduling(false);
    }
  };

  const handleAddFromGroup = async (groupId: string) => {
    if (!selectedCampaign || !selectedCampaignData) return;
    setAddingFromGroup(true);
    try {
      const { data: members, error: membersError } = await supabase.from('recipient_group_members').select('email, first_name, last_name, company, person_id').eq('group_id', groupId);
      if (membersError || !members?.length) {
        toast.error(members?.length === 0 ? 'Group is empty' : 'Failed to load group');
        return;
      }
      const existingEmails = new Set((recipients ?? []).map(r => r.email?.toLowerCase().trim()));
      const newMembers = members.filter((m: any) => m.email && !existingEmails.has(m.email.toLowerCase().trim()));
      if (newMembers.length === 0) {
        toast.info('All group members are already in this campaign.');
        setAddFromGroupOpen(false);
        return;
      }
      const subjectTemplate = selectedCampaignData.subject_template || '';
      const bodyHtmlTemplate = selectedCampaignData.body_html_template || '';
      const bodyTextTemplate = selectedCampaignData.body_text_template || '';
      const rows = newMembers.map((m: any) => {
        const name = [m.first_name, m.last_name].filter(Boolean).join(' ') || m.email;
        return {
          campaign_id: selectedCampaign,
          email: m.email,
          name,
          person_id: m.person_id ?? null,
          personalized_subject: subjectTemplate.replace(/\{\{firstName\}\}/gi, m.first_name || '').replace(/\{\{lastName\}\}/gi, m.last_name || '').replace(/\{\{fullName\}\}/gi, name).replace(/\{\{email\}\}/gi, m.email || '') || '(subject pending)',
          personalized_body_html: bodyHtmlTemplate.replace(/\{\{firstName\}\}/gi, m.first_name || '').replace(/\{\{lastName\}\}/gi, m.last_name || '').replace(/\{\{fullName\}\}/gi, name).replace(/\{\{email\}\}/gi, m.email || '') || '<p>(body pending)</p>',
          personalized_body_text: bodyTextTemplate.replace(/\{\{firstName\}\}/gi, m.first_name || '').replace(/\{\{lastName\}\}/gi, m.last_name || '').replace(/\{\{fullName\}\}/gi, name).replace(/\{\{email\}\}/gi, m.email || '') || '(body pending)',
          status: 'pending',
        };
      });
      const { error: insertError } = await supabase.from('email_campaign_recipients').insert(rows);
      if (insertError) throw insertError;
      const newTotal = (recipients?.length ?? 0) + newMembers.length;
      await supabase.from('email_campaigns').update({ total_recipients: newTotal }).eq('id', selectedCampaign);
      setAddFromGroupOpen(false);
      toast.success(`Added ${newMembers.length} recipient(s) from group.`);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['campaign-recipients', selectedCampaign] }),
        queryClient.invalidateQueries({ queryKey: ['email-campaigns'] }),
      ]);
    } catch (e: any) {
      toast.error(e?.message ?? 'Failed to add from group');
    } finally {
      setAddingFromGroup(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[280px] gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">
          {shouldAddToDraft ? "Loading campaigns… Your selection will be added to a draft." : "Loading campaigns…"}
        </p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 sm:p-6 max-w-7xl min-w-0">
      <div className="mb-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-12 h-12 shrink-0 rounded-xl bg-gradient-primary flex items-center justify-center shadow-lg">
              <Mail className="h-6 w-6 text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold truncate">Campaigns Hub</h1>
              <p className="text-sm text-muted-foreground">
                Manage your email and phone campaigns, monitor health, and optimize performance
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 shrink-0">
            <Button 
              variant="outline" 
              onClick={() => setPhoneServiceDialogOpen(true)} 
              className="gap-2"
            >
              <Settings className="h-4 w-4 shrink-0" />
              <span className="truncate">Phone Services</span>
            </Button>
            <Button onClick={() => setPhoneCampaignDialogOpen(true)} className="gap-2">
              <Phone className="h-4 w-4 shrink-0" />
              <Plus className="h-4 w-4 shrink-0" />
              <span className="truncate">Phone Campaign</span>
            </Button>
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(value) => setSearchParams({ tab: value })}>
        <TabsList className="grid w-full grid-cols-5 mb-6">
          <TabsTrigger value="overview" className="flex items-center gap-2">
            <Mail className="h-4 w-4" />
            <span className="hidden sm:inline">All Campaigns</span>
            <span className="sm:hidden">All</span>
          </TabsTrigger>
          <TabsTrigger value="drafts" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            <span className="hidden sm:inline">Drafts</span>
            <span className="sm:hidden">Drafts</span>
            {campaigns && campaigns.filter(c => c.status?.toLowerCase() === 'draft').length > 0 && (
              <Badge variant="secondary" className="ml-1">
                {campaigns.filter(c => c.status?.toLowerCase() === 'draft').length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="health" className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            <span className="hidden sm:inline">Email Health</span>
            <span className="sm:hidden">Health</span>
          </TabsTrigger>
          <TabsTrigger value="automation" className="flex items-center gap-2">
            <Zap className="h-4 w-4" />
            <span className="hidden sm:inline">Automation</span>
            <span className="sm:hidden">Auto</span>
          </TabsTrigger>
          <TabsTrigger value="testing" className="flex items-center gap-2">
            <FlaskConical className="h-4 w-4" />
            <span className="hidden sm:inline">A/B Testing</span>
            <span className="sm:hidden">Test</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">

      {!campaigns || campaigns.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Mail className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No campaigns yet</h3>
            <p className="text-sm text-muted-foreground text-center max-w-md">
              Create your first bulk email campaign from the People page by selecting multiple contacts
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>All Campaigns</CardTitle>
            <CardDescription>View performance and manage your campaigns</CardDescription>
          </CardHeader>
          <CardContent className="p-0 sm:p-6">
            <div className="overflow-x-auto">
            <Table className="min-w-[700px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Campaign Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Scheduled</TableHead>
                  <TableHead>Recipients</TableHead>
                  <TableHead>Progress</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {campaigns.map((campaign) => {
                  const progress = campaign.total_recipients > 0
                    ? (campaign.sent_count / campaign.total_recipients) * 100
                    : 0;
                  const isScheduled = campaign.status?.toLowerCase() === 'scheduled' && campaign.scheduled_at;

                  return (
                    <TableRow key={campaign.id}>
                      <TableCell className="font-medium">{campaign.name}</TableCell>
                      <TableCell>{getStatusBadge(campaign.status)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                        {isScheduled ? format(new Date(campaign.scheduled_at!), 'PPp') : '—'}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4 text-muted-foreground" />
                          {campaign.total_recipients}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-2 min-w-[200px]">
                          <div className="flex justify-between text-xs">
                            <span>
                              {campaign.sent_count} sent
                              {campaign.opened_count > 0 && `, ${campaign.opened_count} opened`}
                            </span>
                            <span>{Math.round(progress)}%</span>
                          </div>
                          <Progress value={progress} className="h-2" />
                          {campaign.failed_count > 0 && (
                            <p className="text-xs text-destructive">
                              {campaign.failed_count} failed
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {format(new Date(campaign.created_at), 'MMM d, yyyy')}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedCampaign(campaign.id)}
                        >
                          <Eye className="h-4 w-4 mr-2" />
                          View Details
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            </div>
          </CardContent>
        </Card>
      )}
        </TabsContent>

        {/* Drafts Tab */}
        <TabsContent value="drafts" className="space-y-6">
          {isLoading ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
                <p className="text-sm text-muted-foreground">Loading drafts...</p>
              </CardContent>
            </Card>
          ) : !campaigns || draftCampaigns.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No drafts yet</h3>
                <p className="text-sm text-muted-foreground text-center max-w-md mb-4">
                  Save a campaign as a draft from the Bulk Email dialog, or create a new draft from an existing campaign (draft or completed).
                </p>
                {templateCampaigns.length > 0 && (
                  <Button variant="outline" onClick={() => setCreateFromTemplateOpen(true)} className="gap-2">
                    <Copy className="h-4 w-4" />
                    Create from template
                  </Button>
                )}
                {campaigns && campaigns.length > 0 && templateCampaigns.length === 0 && (
                  <div className="mt-4 text-xs text-muted-foreground space-y-1">
                    <p>Found {campaigns.length} total campaign(s)</p>
                    <p>Status breakdown: {Array.from(new Set(campaigns.map(c => c.status || 'null'))).join(', ')}</p>
                    <p>Drafts found: {draftCampaigns.length}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <CardTitle>Draft Campaigns</CardTitle>
                  <CardDescription>Continue editing your saved drafts or create a new one from a template</CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCreateFromTemplateOpen(true)}
                  className="shrink-0 gap-2 w-full sm:w-auto"
                >
                  <Copy className="h-4 w-4" />
                  Create from template
                </Button>
              </CardHeader>
              <CardContent className="p-0 sm:p-6">
                <div className="overflow-x-auto">
                <Table className="min-w-[500px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Campaign Name</TableHead>
                      <TableHead>Recipients</TableHead>
                      <TableHead>Subject</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead>Updated</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {draftCampaigns.map((campaign) => (
                      <TableRow key={campaign.id}>
                        <TableCell className="font-medium">{campaign.name}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Users className="h-4 w-4 text-muted-foreground" />
                            {campaign.total_recipients || 0}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground truncate max-w-xs">
                          {campaign.subject_template || 'No subject'}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {format(new Date(campaign.created_at), 'MMM d, yyyy')}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {campaign.updated_at && campaign.updated_at !== campaign.created_at
                            ? format(new Date(campaign.updated_at), 'MMM d, yyyy')
                            : '-'}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2 flex-wrap">
                            <Button
                              variant="default"
                              size="sm"
                              onClick={() => {
                                setDraftToEdit(campaign.id);
                                setBulkEmailDialogOpen(true);
                              }}
                              className="bg-primary hover:bg-primary/90"
                            >
                              <FileText className="h-4 w-4 mr-2" />
                              Continue Editing
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setSelectedCampaign(campaign.id)}
                            >
                              <Users className="h-4 w-4 mr-2" />
                              Manage Recipients
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={() => setDraftToDelete(campaign.id)}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Create from template (master draft) dialog */}
        <Dialog open={createFromTemplateOpen} onOpenChange={setCreateFromTemplateOpen}>
          <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
            <DialogHeader>
              <DialogTitle>Create from template</DialogTitle>
              <DialogDescription>
                Use any draft or completed campaign as a template. A new draft will be created with the same content and settings; you can then add new recipients and edit.
              </DialogDescription>
            </DialogHeader>
            <div className="overflow-y-auto min-h-0 flex-1 -mx-1 px-1">
              {!campaigns || templateCampaigns.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">No campaigns to use as template. Save a draft or run a campaign first.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Recipients</TableHead>
                      <TableHead>Subject</TableHead>
                      <TableHead className="w-[140px]">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {templateCampaigns.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium">{c.name}</TableCell>
                        <TableCell>{getStatusBadge(c.status)}</TableCell>
                        <TableCell>{c.total_recipients ?? 0}</TableCell>
                        <TableCell className="text-sm text-muted-foreground truncate max-w-[200px]">{c.subject_template || '—'}</TableCell>
                        <TableCell>
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={cloningFromTemplate}
                            onClick={() => handleCreateFromTemplate(c)}
                            className="gap-1.5"
                          >
                            {cloningFromTemplate ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Copy className="h-3.5 w-3.5" />}
                            Use as template
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* Save as group dialog */}
        <Dialog open={saveAsGroupOpen} onOpenChange={(open) => { setSaveAsGroupOpen(open); if (!open) setSaveAsGroupName(''); }}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Save recipients as group</DialogTitle>
              <DialogDescription>
                Save these recipients for reuse in other campaigns or as a newsletter group. {selectedRecipientIds.size > 0 ? `Saving ${selectedRecipientIds.size} selected.` : `Saving all ${recipients?.length ?? 0} recipients.`}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <Label>Group name</Label>
              <Input value={saveAsGroupName} onChange={(e) => setSaveAsGroupName(e.target.value)} placeholder="e.g. UK Retail contacts" />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setSaveAsGroupOpen(false)}>Cancel</Button>
              <Button onClick={handleSaveAsGroup} disabled={savingAsGroup || !saveAsGroupName.trim()}>
                {savingAsGroup ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
                Save group
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Add from group dialog */}
        <Dialog open={addFromGroupOpen} onOpenChange={setAddFromGroupOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Add from recipient group</DialogTitle>
              <DialogDescription>Add all members of a saved group to this campaign.</DialogDescription>
            </DialogHeader>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {recipientGroups.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">No groups yet. Save recipients from a campaign as a group first.</p>
              ) : (
                recipientGroups.map((g: any) => (
                  <Button key={g.id} variant="outline" className="w-full justify-start gap-2" disabled={addingFromGroup} onClick={() => handleAddFromGroup(g.id)}>
                    <FolderInput className="h-4 w-4 shrink-0" />
                    {g.name}
                  </Button>
                ))
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* Campaign Details Dialog */}
        <Dialog
          open={!!selectedCampaign}
          onOpenChange={(open) => {
            if (!open) {
              setSelectedCampaign(null);
              setEditingRecipient(null);
              setRemovingRecipient(null);
              setSelectedRecipientIds(new Set());
            }
          }}
        >
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Campaign Recipients</DialogTitle>
              <DialogDescription>
                {canEditRecipients
                  ? "View, edit, or remove recipients. Add recipients to send or schedule again; edit content via Edit content."
                  : "View individual recipient status and details"}
              </DialogDescription>
            </DialogHeader>

            {selectedCampaignData?.status?.toLowerCase() === 'scheduled' && (
              <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/50 px-4 py-3 text-sm">
                <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-muted-foreground">Scheduled for</span>
                <span className="font-medium">
                  {selectedCampaignData.scheduled_at
                    ? format(new Date(selectedCampaignData.scheduled_at), "PPp")
                    : "—"}
                </span>
                <div className="flex gap-2 ml-auto">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setDraftToEdit(selectedCampaign);
                      setBulkEmailDialogOpen(true);
                      setSelectedCampaign(null);
                    }}
                  >
                    <Edit className="h-4 w-4 mr-1" />
                    Edit campaign
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => setCancelScheduleConfirmOpen(true)}
                  >
                    Cancel schedule
                  </Button>
                </div>
              </div>
            )}

            {canResendOrReschedule && (
              <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-amber-500/10 px-4 py-3 text-sm">
                <RotateCcw className="h-4 w-4 text-amber-600 shrink-0" />
                <span className="text-muted-foreground">
                  {failedRecipients.length > 0 && pendingRecipientsCount > 0
                    ? `${failedRecipients.length} failed, ${pendingRecipientsCount} pending.`
                    : failedRecipients.length > 0
                      ? `${failedRecipients.length} failed.`
                      : `${pendingRecipientsCount} still pending.`}
                </span>
                <div className="flex flex-wrap gap-2 ml-auto">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setDraftToEdit(selectedCampaign!);
                      setBulkEmailDialogOpen(true);
                    }}
                  >
                    <FileText className="h-4 w-4 mr-1" />
                    Edit content
                  </Button>
                  {failedRecipients.length > 0 && (
                    <Button variant="outline" size="sm" onClick={handleRetryFailed} disabled={retryingFailed}>
                      {retryingFailed ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <RotateCcw className="h-4 w-4 mr-1" />}
                      Retry failed
                    </Button>
                  )}
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => {
                      const d = new Date();
                      d.setMinutes(d.getMinutes() + 30);
                      d.setSeconds(0, 0);
                      setRescheduleDateTime(d.toISOString().slice(0, 16));
                      setShowRescheduleDialog(true);
                    }}
                  >
                    <CalendarClock className="h-4 w-4 mr-1" />
                    Reschedule sending
                  </Button>
                </div>
              </div>
            )}

            {selectedCampaignData?.status?.toLowerCase() === 'completed' && !canResendOrReschedule && (
              <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/50 px-4 py-3 text-sm">
                <CheckCircle className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-muted-foreground">
                  This campaign has finished sending. Edit content or add recipients below, then reschedule to send again.
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  className="ml-auto"
                  onClick={() => {
                    setDraftToEdit(selectedCampaign!);
                    setBulkEmailDialogOpen(true);
                  }}
                >
                  <FileText className="h-4 w-4 mr-1" />
                  Edit content
                </Button>
              </div>
            )}

            {/* Auto follow-up for sent campaigns: show status or enroll in sequence */}
            {(selectedCampaignData?.status?.toLowerCase() === 'completed' || selectedCampaignData?.status?.toLowerCase() === 'sending') &&
             (selectedCampaignData as Campaign).sent_count > 0 && (
              <div className="rounded-lg border bg-muted/30 px-4 py-3 space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <RefreshCw className="h-4 w-4 text-primary shrink-0" />
                  Auto follow-up / sequences
                </div>
                {selectedCampaignData.auto_follow_up_enabled && selectedCampaignData.follow_up_sequence_id && (
                  <p className="text-sm text-muted-foreground">
                    Follow-up sequence: <strong>{followUpSequences.find(s => s.id === selectedCampaignData.follow_up_sequence_id)?.name ?? 'Selected sequence'}</strong>
                    — Recipients are (or will be) enrolled for reminder steps when they don’t reply.
                  </p>
                )}
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">
                    {selectedCampaignData.auto_follow_up_enabled && selectedCampaignData.follow_up_sequence_id
                      ? 'Add any sent recipients who weren’t enrolled yet (e.g. sent before follow-up was enabled).'
                      : 'Enroll this campaign\'s sent recipients in a follow-up sequence so they get reminder emails (no-reply rules). One enrollment per company.'}
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <Select
                      value={enrollFollowUpSequenceId || (selectedCampaignData.follow_up_sequence_id || 'none')}
                      onValueChange={(v) => setEnrollFollowUpSequenceId(v === 'none' ? '' : v)}
                      disabled={enrollingFollowUp}
                    >
                      <SelectTrigger className="w-[220px]">
                        <SelectValue placeholder="Select sequence..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Select sequence...</SelectItem>
                        {followUpSequences.map((seq) => (
                          <SelectItem key={seq.id} value={seq.id}>
                            {seq.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      variant="default"
                      size="sm"
                      onClick={handleEnrollSentCampaignInFollowUp}
                      disabled={(!enrollFollowUpSequenceId && !selectedCampaignData.follow_up_sequence_id) || enrollingFollowUp || followUpSequences.length === 0}
                    >
                      {enrollingFollowUp ? (
                        <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                      ) : (
                        <RefreshCw className="h-4 w-4 mr-1" />
                      )}
                      {selectedCampaignData.auto_follow_up_enabled && selectedCampaignData.follow_up_sequence_id
                        ? 'Enroll remaining in sequence'
                        : 'Enroll in follow-up sequence'}
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* A/B test results for campaigns that had body A/B test */}
            {abTestResults && (selectedCampaignData?.status?.toLowerCase() === 'completed' || selectedCampaignData?.status?.toLowerCase() === 'sending') && (
              <div className="rounded-lg border bg-muted/30 px-4 py-3 space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <FlaskConical className="h-4 w-4 text-primary shrink-0" />
                  A/B test results (body)
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className={`rounded-md p-3 border ${abTestResults.winner === 'A' ? 'border-primary bg-primary/5' : 'bg-muted/50'}`}>
                    <div className="font-medium mb-1">Variant A</div>
                    <div className="text-muted-foreground space-y-0.5">
                      <div>{abTestResults.byVariant.A.sent} sent, {abTestResults.byVariant.A.opened} opened, {abTestResults.byVariant.A.clicked} clicked</div>
                      <div>Open rate: {abTestResults.byVariant.A.openRate.toFixed(1)}% · Click rate: {abTestResults.byVariant.A.clickRate.toFixed(1)}%</div>
                    </div>
                    {abTestResults.winner === 'A' && <Badge variant="default" className="mt-2">Winner ({abTestResults.winnerMetric.replace('_', ' ')})</Badge>}
                  </div>
                  <div className={`rounded-md p-3 border ${abTestResults.winner === 'B' ? 'border-primary bg-primary/5' : 'bg-muted/50'}`}>
                    <div className="font-medium mb-1">Variant B</div>
                    <div className="text-muted-foreground space-y-0.5">
                      <div>{abTestResults.byVariant.B.sent} sent, {abTestResults.byVariant.B.opened} opened, {abTestResults.byVariant.B.clicked} clicked</div>
                      <div>Open rate: {abTestResults.byVariant.B.openRate.toFixed(1)}% · Click rate: {abTestResults.byVariant.B.clickRate.toFixed(1)}%</div>
                    </div>
                    {abTestResults.winner === 'B' && <Badge variant="default" className="mt-2">Winner ({abTestResults.winnerMetric.replace('_', ' ')})</Badge>}
                  </div>
                </div>
              </div>
            )}

            {canEditRecipients && (
              <div className="space-y-2 py-2 border-b">
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant="default"
                    size="sm"
                    onClick={handleAddRecipientsToCampaign}
                    disabled={addingRecipients}
                  >
                    {addingRecipients ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Plus className="h-4 w-4 mr-1" />}
                    Add Recipients
                  </Button>
                  <Button variant="outline" size="sm" onClick={openCompaniesForNewList}>
                    <Building2 className="h-4 w-4 mr-1" />
                    Open Companies
                  </Button>
                  <Button variant="outline" size="sm" onClick={openPeopleForNewList}>
                    <Users className="h-4 w-4 mr-1" />
                    Open People
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setAddFromGroupOpen(true)} disabled={recipientGroups.length === 0}>
                    <FolderInput className="h-4 w-4 mr-1" />
                    Add from group
                  </Button>
                  {(recipients?.length ?? 0) > 0 && (
                    <Button variant="outline" size="sm" onClick={() => { setSaveAsGroupName(selectedCampaignData?.name ? `${selectedCampaignData.name} recipients` : 'Recipient group'); setSaveAsGroupOpen(true); }}>
                      <Save className="h-4 w-4 mr-1" />
                      Save as group
                    </Button>
                  )}
                </div>
                {pendingRecipients.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2">
                    <Button variant="outline" size="sm" onClick={handleSelectAllRecipients}>
                      {selectedRecipientIds.size === pendingRecipients.length ? "Deselect all" : "Select all"}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedRecipientIds(new Set())}
                      disabled={selectedRecipientIds.size === 0}
                    >
                      Clear selection
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleBulkRemoveRecipients}
                      disabled={selectedRecipientIds.size === 0 || bulkRemoving}
                    >
                      {bulkRemoving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Trash2 className="h-4 w-4 mr-1" />}
                      Remove selected ({selectedRecipientIds.size})
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setClearListConfirmOpen(true)}
                      disabled={clearingList}
                      className="text-destructive hover:text-destructive"
                    >
                      {clearingList ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                      Clear list
                    </Button>
                  </div>
                )}
              </div>
            )}

            {recipients && (
              <Table>
                <TableHeader>
                  <TableRow>
                    {canEditRecipients && pendingRecipients.length > 0 && (
                      <TableHead className="w-10">
                        <Checkbox
                          checked={pendingRecipients.length > 0 && selectedRecipientIds.size === pendingRecipients.length}
                          onCheckedChange={handleSelectAllRecipients}
                          aria-label="Select all pending"
                        />
                      </TableHead>
                    )}
                    <TableHead>Recipient</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Sent At</TableHead>
                    <TableHead>Opened At</TableHead>
                    {canEditRecipients && <TableHead className="w-[100px]">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recipients.map((recipient) => (
                    <TableRow key={recipient.id}>
                      {canEditRecipients && pendingRecipients.length > 0 && (
                        <TableCell className="w-10">
                          {recipient.status === "pending" ? (
                            <Checkbox
                              checked={selectedRecipientIds.has(recipient.id)}
                              onCheckedChange={(checked) => {
                                setSelectedRecipientIds((prev) => {
                                  const next = new Set(prev);
                                  if (checked) next.add(recipient.id);
                                  else next.delete(recipient.id);
                                  return next;
                                });
                              }}
                              aria-label={`Select ${recipient.name}`}
                            />
                          ) : null}
                        </TableCell>
                      )}
                      <TableCell>{recipient.name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {recipient.email}
                      </TableCell>
                      <TableCell>{getRecipientStatusBadge(recipient.status)}</TableCell>
                      <TableCell className="text-sm">
                        {recipient.sent_at
                          ? format(new Date(recipient.sent_at), "MMM d, HH:mm")
                          : "-"}
                      </TableCell>
                      <TableCell className="text-sm">
                        {recipient.opened_at
                          ? format(new Date(recipient.opened_at), "MMM d, HH:mm")
                          : "-"}
                      </TableCell>
                      {canEditRecipients && (
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => handleOpenEdit(recipient)}
                              title="Edit recipient"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            {recipient.status === "pending" && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive hover:text-destructive"
                                onClick={() => setRemovingRecipient(recipient)}
                                title="Remove recipient"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </DialogContent>
        </Dialog>

        {/* Edit Recipient Dialog */}
        <Dialog open={!!editingRecipient} onOpenChange={() => !savingEdit && setEditingRecipient(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Edit recipient</DialogTitle>
              <DialogDescription>Update name and email for this campaign recipient.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="edit-name">Name</Label>
                <Input
                  id="edit-name"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="Recipient name"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-email">Email</Label>
                <Input
                  id="edit-email"
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  placeholder="email@example.com"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditingRecipient(null)} disabled={savingEdit}>
                Cancel
              </Button>
              <Button onClick={handleSaveEdit} disabled={savingEdit || !editName.trim() || !editEmail.trim()}>
                {savingEdit ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save"
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Remove Recipient Confirmation */}
        <AlertDialog open={!!removingRecipient} onOpenChange={() => !removing && setRemovingRecipient(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remove recipient?</AlertDialogTitle>
              <AlertDialogDescription>
                {removingRecipient
                  ? `"${removingRecipient.name}" (${removingRecipient.email}) will be removed from this campaign. This cannot be undone.`
                  : ""}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={removing}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={(e) => {
                  e.preventDefault();
                  handleRemoveRecipient();
                }}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                disabled={removing}
              >
                {removing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Removing...
                  </>
                ) : (
                  "Remove"
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Clear list confirmation */}
        <AlertDialog open={clearListConfirmOpen} onOpenChange={() => !clearingList && setClearListConfirmOpen(false)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Clear recipient list?</AlertDialogTitle>
              <AlertDialogDescription>
                All pending recipients will be removed from this campaign. Use &quot;Continue with new list&quot; to add recipients from Companies or People. This cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={clearingList}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={(e) => {
                  e.preventDefault();
                  handleClearList();
                }}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                disabled={clearingList}
              >
                {clearingList ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Clearing...
                  </>
                ) : (
                  "Clear list"
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Cancel schedule confirmation */}
        <AlertDialog open={cancelScheduleConfirmOpen} onOpenChange={() => !cancellingSchedule && setCancelScheduleConfirmOpen(false)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Cancel schedule?</AlertDialogTitle>
              <AlertDialogDescription>
                This campaign will be moved back to draft. It will not send at the scheduled time. You can edit it and schedule again later.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={cancellingSchedule}>Keep scheduled</AlertDialogCancel>
              <AlertDialogAction
                onClick={(e) => {
                  e.preventDefault();
                  handleCancelScheduleCampaign();
                }}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                disabled={cancellingSchedule}
              >
                {cancellingSchedule ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Cancelling...
                  </>
                ) : (
                  "Cancel schedule"
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Reschedule campaign dialog */}
        <Dialog open={showRescheduleDialog} onOpenChange={(open) => { setShowRescheduleDialog(open); if (!open) setRescheduleDateTime(''); }}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2"><CalendarClock className="h-5 w-5" />Reschedule sending</DialogTitle>
              <DialogDescription>
                Set a date and time to send. Failed recipients will be reset to pending and sent at the scheduled time (cron runs every 15 minutes).
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label htmlFor="reschedule-datetime">Date & time</Label>
                <input
                  id="reschedule-datetime"
                  type="datetime-local"
                  value={rescheduleDateTime}
                  onChange={(e) => setRescheduleDateTime(e.target.value)}
                  min={new Date(new Date().getTime() + 15 * 60 * 1000).toISOString().slice(0, 16)}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowRescheduleDialog(false)}>Cancel</Button>
              <Button onClick={handleRescheduleCampaign} disabled={rescheduling || !rescheduleDateTime.trim()}>
                {rescheduling ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" />Rescheduling...</> : <><CalendarClock className="h-4 w-4 mr-1.5" />Reschedule</>}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Delete Draft Confirmation */}
        <AlertDialog open={!!draftToDelete} onOpenChange={() => !deletingDraft && setDraftToDelete(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete draft?</AlertDialogTitle>
              <AlertDialogDescription>
                This draft and its recipient list will be permanently deleted. You can still reuse the same email by creating a new draft and choosing &quot;Replace with selection from Companies & People&quot; to refill recipients.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deletingDraft}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={(e) => {
                  e.preventDefault();
                  handleDeleteDraft();
                }}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                disabled={deletingDraft}
              >
                {deletingDraft ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  "Delete draft"
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <TabsContent value="health">
          <EmailDeliverability />
        </TabsContent>

        <TabsContent value="automation">
          <AutomationRules />
        </TabsContent>

        <TabsContent value="testing">
          <ABTesting
            onOpenBulkEmailForAbTest={() => {
              setSearchParams({ tab: 'overview' });
              setBulkEmailDialogOpen(true);
              setDraftToEdit(null);
            }}
            onSelectCampaignAndShowOverview={(campaignId) => {
              setSearchParams({ tab: 'overview' });
              setSelectedCampaign(campaignId);
            }}
          />
        </TabsContent>
      </Tabs>

      <PhoneCampaignDialog
        open={phoneCampaignDialogOpen}
        onOpenChange={setPhoneCampaignDialogOpen}
      />

      <PhoneServiceDialog
        open={phoneServiceDialogOpen}
        onOpenChange={setPhoneServiceDialogOpen}
      />

      {/* Draft Picker Dialog */}
      <Dialog open={draftPickerOpen} onOpenChange={(open) => {
        setDraftPickerOpen(open);
        if (!open) {
          localStorage.removeItem('leadgenie_draft_recipients');
        }
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Select a Draft</DialogTitle>
            <DialogDescription>
              Choose which draft to add your selected recipients to.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 max-h-[360px] overflow-y-auto py-2">
            {draftPickerDrafts.map((draft) => (
              <button
                key={draft.id}
                className="w-full text-left rounded-lg border p-3 hover:bg-accent/50 hover:border-primary/40 transition-colors"
                onClick={() => {
                  setDraftPickerOpen(false);
                  openDraftWithRecipients(draft.id);
                }}
              >
                <div className="font-medium text-sm truncate">{draft.name || "Untitled Draft"}</div>
                <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    {draft.total_recipients} recipient{draft.total_recipients !== 1 ? 's' : ''}
                  </span>
                  {draft.subject_template && (
                    <span className="truncate max-w-[200px]">Subject: {draft.subject_template}</span>
                  )}
                  <span>Created {format(new Date(draft.created_at), 'MMM d')}</span>
                </div>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Bulk Email Dialog for editing drafts */}
      <BulkEmailDialog
        ref={bulkEmailDialogRef}
        open={bulkEmailDialogOpen}
        onOpenChange={(open) => {
          setBulkEmailDialogOpen(open);
          if (!open) {
            setDraftToEdit(null);
          }
        }}
        selectedPeople={[]}
        initialDraftId={draftToEdit}
      />
    </div>
  );
}