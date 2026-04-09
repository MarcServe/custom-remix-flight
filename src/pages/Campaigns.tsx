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
import { Loader2, Mail, Users, Send, CheckCircle, XCircle, Clock, Eye, Shield, Zap, FlaskConical, Phone, Plus, Settings, FileText, Edit, Trash2, Building2, Copy, Save, FolderInput, CalendarClock, RotateCcw, RefreshCw, SendHorizontal, ArrowLeftRight, BarChart3, Search, Pause, Play } from "lucide-react";
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
import { useSearchParams, useLocation, useNavigate, Link } from "react-router-dom";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  delivered_at?: string | null;
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
  const [campaignToDelete, setCampaignToDelete] = useState<string | null>(null);
  const [deletingCampaign, setDeletingCampaign] = useState(false);
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
  const [addRecipientsDialogOpen, setAddRecipientsDialogOpen] = useState(false);
  const [addRecipientsTab, setAddRecipientsTab] = useState<'groups' | 'people' | 'companies' | 'paste'>('groups');
  const [addRecipientsPeopleSearch, setAddRecipientsPeopleSearch] = useState('');
  const [addRecipientsCompaniesSearch, setAddRecipientsCompaniesSearch] = useState('');
  const [addRecipientsSelectedPeople, setAddRecipientsSelectedPeople] = useState<Set<string>>(new Set());
  const [addRecipientsSelectedCompanies, setAddRecipientsSelectedCompanies] = useState<Set<string>>(new Set());
  const [addRecipientsPasteText, setAddRecipientsPasteText] = useState('');
  const [addingRecipientsFromDialog, setAddingRecipientsFromDialog] = useState(false);
  const [overviewStatusFilter, setOverviewStatusFilter] = useState<string>("all");
  const [addingFromGroup, setAddingFromGroup] = useState(false);
  const [deliveryReportCampaignId, setDeliveryReportCampaignId] = useState<string | null>(null);
  const [cancelScheduleConfirmOpen, setCancelScheduleConfirmOpen] = useState(false);
  const [cancellingSchedule, setCancellingSchedule] = useState(false);
  const [showRescheduleDialog, setShowRescheduleDialog] = useState(false);
  const [rescheduleDateTime, setRescheduleDateTime] = useState("");
  const [retryingFailed, setRetryingFailed] = useState(false);
  const [resendVariantLoading, setResendVariantLoading] = useState<'A' | 'B' | 'all' | 'swap' | null>(null);
  const [rescheduling, setRescheduling] = useState(false);
  const [pausingCampaign, setPausingCampaign] = useState(false);
  const [resumingCampaign, setResumingCampaign] = useState(false);
  const [sendingPendingNow, setSendingPendingNow] = useState(false);
  const [listActionCampaignId, setListActionCampaignId] = useState<string | null>(null);
  const [enrollFollowUpSequenceId, setEnrollFollowUpSequenceId] = useState<string>("");
  const [enrollingFollowUp, setEnrollingFollowUp] = useState(false);
  // Resend-style status filter: server-side for large lists, counts from RPC
  type RecipientStatusFilter = 'all' | 'pending' | 'sent' | 'delivered' | 'delivered_not_opened' | 'opened' | 'clicked' | 'opened_no_click' | 'bounced' | 'failed';
  const [recipientStatusFilter, setRecipientStatusFilter] = useState<RecipientStatusFilter>('all');
  // Segment for follow-up enrollment (server-side filtered)
  type EnrollSegment = 'all_sent' | 'not_opened' | 'opened' | 'clicked' | 'opened_no_click';
  const [enrollSegment, setEnrollSegment] = useState<EnrollSegment>('all_sent');
  const [recipientSearchQuery, setRecipientSearchQuery] = useState('');
  const [syncingFromResend, setSyncingFromResend] = useState(false);
  const [createFollowUpOpen, setCreateFollowUpOpen] = useState(false);
  const [createFollowUpSegment, setCreateFollowUpSegment] = useState<'delivered_not_opened' | 'not_opened' | 'opened_no_click'>('not_opened');
  const [creatingFollowUp, setCreatingFollowUp] = useState(false);

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

  // Reset status filter when switching campaign
  useEffect(() => {
    setRecipientStatusFilter('all');
  }, [selectedCampaign]);

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

  /** Opens the bulk email composer without a server draft—use data import (CSV, Excel, JSON, PDF, …) or Add from People/Companies. */
  const openNewEmailCampaign = () => {
    setSearchParams({ tab: "overview" });
    setDraftToEdit(null);
    setBulkEmailDialogOpen(true);
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

  // Server-side counts by segment (works for large lists without fetching all rows)
  const { data: statusCounts } = useQuery({
    queryKey: ['campaign-recipient-counts', selectedCampaign],
    enabled: !!selectedCampaign,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_campaign_recipient_status_counts', {
        p_campaign_id: selectedCampaign!,
      });
      if (error) throw error;
      return data as { all: number; pending: number; sent: number; delivered: number; delivered_not_opened: number; opened: number; clicked: number; opened_no_click: number; bounced: number; failed: number };
    },
  });

  // Recipients list: server-side filtered when a segment is selected (scales to large lists)
  const { data: recipients } = useQuery({
    queryKey: ['campaign-recipients', selectedCampaign, recipientStatusFilter],
    enabled: !!selectedCampaign,
    queryFn: async () => {
      let query = supabase
        .from('email_campaign_recipients')
        .select('*')
        .eq('campaign_id', selectedCampaign!)
        .order('created_at', { ascending: true });

      switch (recipientStatusFilter) {
        case 'pending':
          query = query.eq('status', 'pending');
          break;
        case 'sent':
          query = query.eq('status', 'sent').not('sent_at', 'is', null);
          break;
        case 'delivered':
          query = query.not('delivered_at', 'is', null);
          break;
        case 'delivered_not_opened':
          query = query.not('delivered_at', 'is', null).is('opened_at', null);
          break;
        case 'opened':
          query = query.not('opened_at', 'is', null);
          break;
        case 'clicked':
          query = query.not('clicked_at', 'is', null);
          break;
        case 'opened_no_click':
          query = query.not('opened_at', 'is', null).is('clicked_at', null);
          break;
        case 'bounced':
          query = query.eq('status', 'bounced');
          break;
        case 'failed':
          query = query.eq('status', 'failed');
          break;
        default:
          break;
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as CampaignRecipient[];
    },
  });

  // Delivery report tab: fetch recipients for selected campaign (no dialog) — refetch when tab is delivery for live data
  const { data: deliveryReportRecipients, refetch: refetchDeliveryReportRecipients } = useQuery({
    queryKey: ['campaign-recipients', 'delivery-report', deliveryReportCampaignId],
    enabled: !!deliveryReportCampaignId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('email_campaign_recipients')
        .select('*')
        .eq('campaign_id', deliveryReportCampaignId!)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data as CampaignRecipient[];
    },
  });

  // Delivery report: summary from recipient-level data so it matches the list and stays live
  const deliveryReportSummaryFromRecipients = useMemo(() => {
    const recs = deliveryReportRecipients ?? [];
    if (recs.length === 0) return null;
    const sent = recs.filter((r) => ['sent', 'opened', 'clicked'].includes(r.status?.toLowerCase?.() ?? '') || !!r.sent_at).length;
    const opened = recs.filter((r) => !!r.opened_at || ['opened', 'clicked'].includes(r.status?.toLowerCase?.() ?? '')).length;
    return { sent, opened: Math.min(opened, sent), total: recs.length };
  }, [deliveryReportRecipients]);

  // Refetch delivery data when user switches to Delivery tab so the report stays live
  useEffect(() => {
    if (activeTab === 'delivery' && deliveryReportCampaignId) {
      queryClient.invalidateQueries({ queryKey: ['email-campaigns'] });
      refetchDeliveryReportRecipients();
    }
  }, [activeTab, deliveryReportCampaignId, queryClient, refetchDeliveryReportRecipients]);

  // Full send history (initial + resends) for Delivery report and avoiding duplicate sends
  const { data: campaignSendHistory } = useQuery({
    queryKey: ['campaign-send-history', deliveryReportCampaignId ?? selectedCampaign],
    enabled: !!(deliveryReportCampaignId || selectedCampaign),
    queryFn: async () => {
      const cid = deliveryReportCampaignId || selectedCampaign!;
      const { data, error } = await supabase
        .from('email_campaign_send_history')
        .select('id, recipient_id, variant_sent, sent_at')
        .eq('campaign_id', cid)
        .order('sent_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as { id: string; recipient_id: string; variant_sent: string; sent_at: string }[];
    },
  });

  // Group send history by date for "Send history" timeline in Campaign Recipients modal
  const sendHistoryByDate = useMemo(() => {
    const list = campaignSendHistory ?? [];
    if (list.length === 0) return [];
    const byKey: Record<string, { count: number; variantA: number; variantB: number; at: string }> = {};
    for (const row of list) {
      const at = new Date(row.sent_at);
      const key = format(at, 'yyyy-MM-dd HH:mm');
      if (!byKey[key]) byKey[key] = { count: 0, variantA: 0, variantB: 0, at: row.sent_at };
      byKey[key].count += 1;
      if (row.variant_sent === 'A') byKey[key].variantA += 1;
      else if (row.variant_sent === 'B') byKey[key].variantB += 1;
    }
    return Object.values(byKey)
      .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
      .slice(0, 20);
  }, [campaignSendHistory]);

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      draft: "secondary",
      scheduled: "outline",
      sending: "default",
      paused: "outline",
      completed: "default",
      failed: "destructive",
    };

    const icons = {
      draft: Clock,
      scheduled: Clock,
      sending: Send,
      paused: Pause,
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
      clicked: "default",
      bounced: "destructive",
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
    ['sending', 'paused', 'completed', 'failed'].includes(selectedCampaignData.status?.toLowerCase?.() ?? '') &&
    (failedRecipients.length > 0 || pendingRecipientsCount > 0);
  const canEditRecipients =
    selectedCampaignData &&
    (["draft", "scheduled", "completed", "paused"].includes(selectedCampaignData.status?.toLowerCase?.() ?? "") ||
      canResendOrReschedule);

  const pendingRecipients = useMemo(
    () => (recipients ?? []).filter((r) => r.status === "pending"),
    [recipients]
  );

  const filteredRecipients = useMemo(() => {
    const list = recipients ?? [];
    const q = recipientSearchQuery.trim().toLowerCase();
    const filtered = !q
      ? list
      : list.filter(
          (r) =>
            (r.name ?? '').toLowerCase().includes(q) ||
            (r.email ?? '').toLowerCase().includes(q)
        );
    // Sort so sent/delivered appear first (by sent_at desc), then pending/failed — so history is visible at a glance
    return [...filtered].sort((a, b) => {
      const aSent = a.sent_at ? new Date(a.sent_at).getTime() : 0;
      const bSent = b.sent_at ? new Date(b.sent_at).getTime() : 0;
      if (aSent !== bSent) return bSent - aSent; // most recent sent first
      if (aSent > 0 && bSent > 0) return 0;
      const aPending = (a.status?.toLowerCase() ?? '') === 'pending' ? 1 : 0;
      const bPending = (b.status?.toLowerCase() ?? '') === 'pending' ? 1 : 0;
      return aPending - bPending; // pending after sent
    });
  }, [recipients, recipientSearchQuery]);

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

  // A/B results for Delivery report tab (same logic, different data source)
  const deliveryReportCampaign = useMemo(
    () => campaigns?.find((c) => c.id === deliveryReportCampaignId),
    [campaigns, deliveryReportCampaignId]
  );
  const deliveryReportAbResults = useMemo(() => {
    const camp = deliveryReportCampaign;
    const recs = deliveryReportRecipients ?? [];
    if (!camp?.ab_test_enabled || recs.length === 0) return null;
    const withVariant = recs.filter((r): r is CampaignRecipient & { ab_variant: 'A' | 'B' } => r.ab_variant === 'A' || r.ab_variant === 'B');
    if (withVariant.length === 0) return null;
    const sent = (r: CampaignRecipient) => ['sent', 'opened', 'clicked'].includes(r.status?.toLowerCase?.() ?? '') || !!r.sent_at;
    const opened = (r: CampaignRecipient) => !!r.opened_at || ['opened', 'clicked'].includes(r.status?.toLowerCase?.() ?? '');
    const clicked = (r: CampaignRecipient) => !!r.clicked_at || (r.status?.toLowerCase?.() === 'clicked');
    const byVariant = { A: withVariant.filter((r) => r.ab_variant === 'A'), B: withVariant.filter((r) => r.ab_variant === 'B') };
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
  }, [deliveryReportCampaign, deliveryReportRecipients]);

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
        queryClient.invalidateQueries({ queryKey: ["campaign-recipient-counts", selectedCampaign] }),
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
        queryClient.invalidateQueries({ queryKey: ["campaign-recipient-counts", selectedCampaign] }),
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
        queryClient.invalidateQueries({ queryKey: ["campaign-recipient-counts", selectedCampaign] }),
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
        queryClient.invalidateQueries({ queryKey: ["campaign-recipient-counts", selectedCampaign] });
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
        queryClient.invalidateQueries({ queryKey: ["campaign-recipient-counts", selectedCampaign] }),
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

  const handleDeleteCampaign = async () => {
    if (!campaignToDelete) return;
    setDeletingCampaign(true);
    try {
      const { error } = await supabase
        .from('email_campaigns')
        .delete()
        .eq('id', campaignToDelete);
      if (error) throw error;
      toast.success('Campaign deleted');
      if (selectedCampaign === campaignToDelete) {
        setSelectedCampaign(null);
      }
      if (draftToEdit === campaignToDelete) {
        setDraftToEdit(null);
        setBulkEmailDialogOpen(false);
      }
      setCampaignToDelete(null);
      await queryClient.invalidateQueries({ queryKey: ['email-campaigns'] });
    } catch (e: any) {
      toast.error(e?.message ?? 'Failed to delete campaign');
    } finally {
      setDeletingCampaign(false);
    }
  };

  // Duplicate campaign: new draft with same content/sender, no recipients (refresh list or change sender/SMTP)
  const handleDuplicateCampaign = async (source: Campaign) => {
    setCloningFromTemplate(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('Not authenticated');
        return;
      }
      const s = source as any;
      const { data: newCampaign, error } = await supabase
        .from('email_campaigns')
        .insert({
          user_id: user.id,
          name: `${source.name} (Copy)`,
          status: 'draft',
          subject_template: source.subject_template || '',
          body_html_template: source.body_html_template || '',
          body_text_template: source.body_text_template || '',
          sender_connection_id: s.sender_connection_id ?? null,
          sender_profile_id: s.sender_profile_id ?? null,
          header_image_url: s.header_image_url ?? null,
          tags: source.tags ?? null,
          auto_follow_up_enabled: s.auto_follow_up_enabled !== false,
          follow_up_sequence_id: s.follow_up_sequence_id ?? null,
          ab_test_enabled: s.ab_test_enabled === true,
          ab_subject_b: s.ab_subject_b ?? null,
          ab_body_html_b: s.ab_body_html_b ?? null,
          ab_body_text_b: s.ab_body_text_b ?? null,
          ab_traffic_split: typeof s.ab_traffic_split === 'number' ? s.ab_traffic_split : 50,
          ab_winner_metric: s.ab_winner_metric ?? null,
          total_recipients: 0,
          sent_count: 0,
          opened_count: 0,
          failed_count: 0,
        })
        .select('id')
        .single();
      if (error) throw error;
      if (!newCampaign?.id) throw new Error('Failed to duplicate campaign');
      setDraftToEdit(newCampaign.id);
      setBulkEmailDialogOpen(true);
      await queryClient.invalidateQueries({ queryKey: ['email-campaigns'] });
      toast.success('Campaign duplicated. Add recipients or change sender, then send.');
    } catch (e: any) {
      toast.error(e?.message ?? 'Failed to duplicate campaign');
    } finally {
      setCloningFromTemplate(false);
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
      const s = source as any;
      const { data: newCampaign, error } = await supabase
        .from('email_campaigns')
        .insert({
          user_id: user.id,
          name: `${source.name} (Copy)`,
          status: 'draft',
          subject_template: source.subject_template || '',
          body_html_template: source.body_html_template || '',
          body_text_template: source.body_text_template || '',
          sender_connection_id: s.sender_connection_id ?? null,
          sender_profile_id: s.sender_profile_id ?? null,
          header_image_url: s.header_image_url ?? null,
          tags: source.tags ?? null,
          auto_follow_up_enabled: s.auto_follow_up_enabled !== false,
          follow_up_sequence_id: s.follow_up_sequence_id ?? null,
          ab_test_enabled: s.ab_test_enabled === true,
          ab_subject_b: s.ab_subject_b ?? null,
          ab_body_html_b: s.ab_body_html_b ?? null,
          ab_body_text_b: s.ab_body_text_b ?? null,
          ab_traffic_split: typeof s.ab_traffic_split === 'number' ? s.ab_traffic_split : 50,
          ab_winner_metric: s.ab_winner_metric ?? null,
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
      return status === 'draft' || status === 'completed' || status === 'sending' || status === 'paused' || status === 'scheduled';
    });
  }, [campaigns]);

  // All Campaigns table: filter by status and sort so sending/paused (in progress) appear first
  const overviewCampaigns = useMemo(() => {
    if (!campaigns) return [];
    let list = campaigns;
    if (overviewStatusFilter !== "all") {
      list = list.filter((c) => (c.status?.toLowerCase()?.trim() ?? "") === overviewStatusFilter);
    }
    const order: Record<string, number> = { sending: 0, paused: 1, scheduled: 2, draft: 3, completed: 4, failed: 5 };
    return [...list].sort((a, b) => {
      const aStatus = a.status?.toLowerCase()?.trim() ?? "";
      const bStatus = b.status?.toLowerCase()?.trim() ?? "";
      const aOrder = order[aStatus] ?? 6;
      const bOrder = order[bStatus] ?? 6;
      if (aOrder !== bOrder) return aOrder - bOrder;
      return new Date(b.updated_at ?? b.created_at).getTime() - new Date(a.updated_at ?? a.created_at).getTime();
    });
  }, [campaigns, overviewStatusFilter]);

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

  const { data: addRecipientsPeopleList = [] } = useQuery({
    queryKey: ['campaign-add-recipients-people', addRecipientsPeopleSearch],
    enabled: addRecipientsDialogOpen && addRecipientsTab === 'people',
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      let q = supabase.from('people').select('id, first_name, last_name, email, company_id, companies(name)').eq('user_id', user.id).not('email', 'is', null).order('created_at', { ascending: false }).limit(500);
      if (addRecipientsPeopleSearch.trim()) {
        const term = addRecipientsPeopleSearch.trim();
        q = q.or(`email.ilike.%${term}%,first_name.ilike.%${term}%,last_name.ilike.%${term}%`);
      }
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as { id: string; first_name: string | null; last_name: string | null; email: string; company_id: string | null; companies: { name: string | null } | null }[];
    },
  });

  const { data: addRecipientsCompaniesList = [] } = useQuery({
    queryKey: ['campaign-add-recipients-companies', addRecipientsCompaniesSearch],
    enabled: addRecipientsDialogOpen && addRecipientsTab === 'companies',
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      let q = supabase.from('companies').select('id, name, email, industry').eq('user_id', user.id).not('email', 'is', null).order('created_at', { ascending: false }).limit(500);
      if (addRecipientsCompaniesSearch.trim()) {
        const term = addRecipientsCompaniesSearch.trim();
        q = q.or(`name.ilike.%${term}%,email.ilike.%${term}%,industry.ilike.%${term}%`);
      }
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as { id: string; name: string | null; email: string; industry: string | null }[];
    },
  });

  const buildRecipientRows = (items: { email: string; first_name?: string | null; last_name?: string | null; name?: string; person_id?: string | null }[]) => {
    if (!selectedCampaign || !selectedCampaignData) return [];
    const subjectTemplate = selectedCampaignData.subject_template || '';
    const bodyHtmlTemplate = selectedCampaignData.body_html_template || '';
    const bodyTextTemplate = selectedCampaignData.body_text_template || '';
    const existingEmails = new Set((recipients ?? []).map(r => r.email?.toLowerCase().trim()));
    return items
      .filter(r => r.email && !existingEmails.has(r.email.trim().toLowerCase()))
      .map(r => {
        const name = r.name ?? ([r.first_name, r.last_name].filter(Boolean).join(' ') || r.email);
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
          email: r.email.trim(),
          name,
          person_id: r.person_id ?? null,
          personalized_subject: personalizedSubject,
          personalized_body_html: personalizedBodyHtml,
          personalized_body_text: personalizedBodyText,
          status: 'pending' as const,
        };
      });
  };

  const addRecipientsFromDialog = async (rows: ReturnType<typeof buildRecipientRows>) => {
    if (!selectedCampaign || rows.length === 0) return;
    setAddingRecipientsFromDialog(true);
    try {
      const { error: insertError } = await supabase.from('email_campaign_recipients').insert(rows);
      if (insertError) throw insertError;
      const newTotal = (recipients?.length ?? 0) + rows.length;
      await supabase.from('email_campaigns').update({ total_recipients: newTotal }).eq('id', selectedCampaign);
      toast.success(`Added ${rows.length} recipient(s) to campaign.`);
      setAddRecipientsDialogOpen(false);
      setAddRecipientsSelectedPeople(new Set());
      setAddRecipientsSelectedCompanies(new Set());
      setAddRecipientsPasteText('');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['campaign-recipients', selectedCampaign] }),
        queryClient.invalidateQueries({ queryKey: ['campaign-recipient-counts', selectedCampaign] }),
        queryClient.invalidateQueries({ queryKey: ['email-campaigns'] }),
      ]);
    } catch (e: any) {
      toast.error(e?.message ?? 'Failed to add recipients');
    } finally {
      setAddingRecipientsFromDialog(false);
    }
  };

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
        queryClient.invalidateQueries({ queryKey: ['campaign-recipient-counts', selectedCampaign] }),
        queryClient.invalidateQueries({ queryKey: ['email-campaigns'] }),
      ]);
      const { error: sendError } = await supabase.functions.invoke('send-bulk-emails', {
        body: { campaignId: selectedCampaign },
      });
      if (sendError) console.error('Trigger send:', sendError);
      toast.success(`${failedRecipients.length} recipient(s) set to pending. Sending started.`);
    } catch (e: any) {
      toast.error(e?.message ?? 'Failed to retry');
    } finally {
      setRetryingFailed(false);
    }
  };

  const handleRetryFailedByCampaignId = async (campaignId: string) => {
    setListActionCampaignId(campaignId);
    try {
      const { error: updateRecipients } = await supabase
        .from('email_campaign_recipients')
        .update({ status: 'pending', error_message: null })
        .eq('campaign_id', campaignId)
        .eq('status', 'failed');
      if (updateRecipients) throw updateRecipients;
      const { error: updateCampaign } = await supabase
        .from('email_campaigns')
        .update({ status: 'sending' })
        .eq('id', campaignId);
      if (updateCampaign) throw updateCampaign;
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['campaign-recipients', campaignId] }),
        queryClient.invalidateQueries({ queryKey: ['campaign-recipient-counts', campaignId] }),
        queryClient.invalidateQueries({ queryKey: ['email-campaigns'] }),
      ]);
      const { error: sendError } = await supabase.functions.invoke('send-bulk-emails', {
        body: { campaignId },
      });
      if (sendError) console.error('Trigger send:', sendError);
      toast.success('Failed recipients set to pending. Sending started.');
    } catch (e: any) {
      toast.error(e?.message ?? 'Failed to retry');
    } finally {
      setListActionCampaignId(null);
    }
  };

  const handleResumeCampaignById = async (campaignId: string) => {
    setListActionCampaignId(campaignId);
    try {
      const { error } = await supabase.from('email_campaigns').update({ status: 'sending' }).eq('id', campaignId);
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ['email-campaigns'] });
      const { error: sendError } = await supabase.functions.invoke('send-bulk-emails', {
        body: { campaignId },
      });
      if (sendError) console.error('Trigger send:', sendError);
      toast.success('Campaign resumed. Sending will continue for pending recipients.');
    } catch (e: any) {
      toast.error(e?.message ?? 'Failed to resume');
    } finally {
      setListActionCampaignId(null);
    }
  };

  const handleSendPendingNowByCampaignId = async (campaignId: string) => {
    setListActionCampaignId(campaignId);
    try {
      const { error } = await supabase.functions.invoke('send-bulk-emails', {
        body: { campaignId },
      });
      if (error) throw error;
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['campaign-recipients', campaignId] }),
        queryClient.invalidateQueries({ queryKey: ['campaign-recipient-counts', campaignId] }),
        queryClient.invalidateQueries({ queryKey: ['email-campaigns'] }),
        queryClient.invalidateQueries({ queryKey: ['campaign-send-history'] }),
      ]);
      toast.success('Next batch sent. Click again for more or open campaign for details.');
    } catch (e: any) {
      toast.error(e?.message ?? 'Failed to send');
    } finally {
      setListActionCampaignId(null);
    }
  };

  // Sent recipients by variant (for A/B resend/swap)
  const sentRecipientsByVariant = useMemo(() => {
    const recs = recipients ?? [];
    const sent = recs.filter((r) => ['sent', 'opened', 'clicked'].includes(r.status?.toLowerCase?.() ?? '') || !!r.sent_at);
    return {
      A: sent.filter((r) => r.ab_variant === 'A'),
      B: sent.filter((r) => r.ab_variant === 'B'),
      all: sent,
    };
  }, [recipients]);

  const handleResendVariant = async (mode: 'A' | 'B' | 'all') => {
    if (!selectedCampaign) return;
    const list = mode === 'A' ? sentRecipientsByVariant.A : mode === 'B' ? sentRecipientsByVariant.B : sentRecipientsByVariant.all;
    if (list.length === 0) {
      toast.error(`No sent recipients for Variant ${mode === 'all' ? 'A or B' : mode}.`);
      return;
    }
    setResendVariantLoading(mode);
    try {
      const ids = list.map((r) => r.id);
      const { error: updateErr } = await supabase
        .from('email_campaign_recipients')
        .update({ status: 'pending' })
        .eq('campaign_id', selectedCampaign)
        .in('id', ids);
      if (updateErr) throw updateErr;
      const { error: campaignErr } = await supabase
        .from('email_campaigns')
        .update({ status: 'sending' })
        .eq('id', selectedCampaign);
      if (campaignErr) throw campaignErr;
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['campaign-recipients', selectedCampaign] }),
        queryClient.invalidateQueries({ queryKey: ['campaign-recipient-counts', selectedCampaign] }),
        queryClient.invalidateQueries({ queryKey: ['email-campaigns'] }),
      ]);
      const { error: sendError } = await supabase.functions.invoke('send-bulk-emails', {
        body: { campaignId: selectedCampaign },
      });
      if (sendError) console.error('Trigger send:', sendError);
      toast.success(`Resending to ${list.length} recipient(s) (Variant ${mode === 'all' ? 'A & B' : mode}). Sending started.`);
    } catch (e: any) {
      toast.error(e?.message ?? 'Failed to resend');
    } finally {
      setResendVariantLoading(null);
    }
  };

  const handleSwapAndResend = async () => {
    if (!selectedCampaign || sentRecipientsByVariant.all.length === 0) return;
    setResendVariantLoading('swap');
    try {
      const { data, error } = await supabase.functions.invoke('resend-campaign-variants', {
        body: { campaignId: selectedCampaign, action: 'swap' },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['campaign-recipients', selectedCampaign] }),
        queryClient.invalidateQueries({ queryKey: ['campaign-recipient-counts', selectedCampaign] }),
        queryClient.invalidateQueries({ queryKey: ['email-campaigns'] }),
        queryClient.invalidateQueries({ queryKey: ['campaign-send-history'] }),
      ]);
      const { error: sendError } = await supabase.functions.invoke('send-bulk-emails', {
        body: { campaignId: selectedCampaign },
      });
      if (sendError) console.error('Trigger send:', sendError);
      toast.success('Variants swapped and resend started. Only recipients who have not already received that variant will be sent to; no duplicate variant sends.');
    } catch (e: any) {
      toast.error(e?.message ?? (typeof (e as any)?.error === 'string' ? (e as any).error : 'Failed to swap and resend'));
    } finally {
      setResendVariantLoading(null);
    }
  };

  const handlePauseCampaign = async () => {
    if (!selectedCampaign || selectedCampaignData?.status?.toLowerCase() !== 'sending') return;
    setPausingCampaign(true);
    try {
      const { error } = await supabase.from('email_campaigns').update({ status: 'paused' }).eq('id', selectedCampaign);
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ['email-campaigns'] });
      toast.success('Campaign paused. Edit content if needed, then click Resume to continue sending from where you left off (no duplicates).');
    } catch (e: any) {
      toast.error(e?.message ?? 'Failed to pause');
    } finally {
      setPausingCampaign(false);
    }
  };

  const handleResumeCampaign = async () => {
    if (!selectedCampaign || selectedCampaignData?.status?.toLowerCase() !== 'paused') return;
    setResumingCampaign(true);
    try {
      const { error } = await supabase.from('email_campaigns').update({ status: 'sending' }).eq('id', selectedCampaign);
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ['email-campaigns'] });
      const { error: sendError } = await supabase.functions.invoke('send-bulk-emails', {
        body: { campaignId: selectedCampaign },
      });
      if (sendError) console.error('Trigger send after resume:', sendError);
      toast.success('Campaign resumed. Sending the next batch now; more will follow via cron or "Send pending now".');
    } catch (e: any) {
      toast.error(e?.message ?? 'Failed to resume');
    } finally {
      setResumingCampaign(false);
    }
  };

  const handleSendPendingNow = async () => {
    if (!selectedCampaign || pendingRecipientsCount === 0) return;
    setSendingPendingNow(true);
    try {
      const { error } = await supabase.functions.invoke('send-bulk-emails', {
        body: { campaignId: selectedCampaign },
      });
      if (error) throw error;
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['campaign-recipients', selectedCampaign] }),
        queryClient.invalidateQueries({ queryKey: ['campaign-recipient-counts', selectedCampaign] }),
        queryClient.invalidateQueries({ queryKey: ['email-campaigns'] }),
        queryClient.invalidateQueries({ queryKey: ['campaign-send-history'] }),
      ]);
      toast.success('Next batch sent (up to 50). Click again for more, or wait for the cron.');
    } catch (e: any) {
      toast.error(e?.message ?? 'Failed to send');
    } finally {
      setSendingPendingNow(false);
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
      let enrollQuery = supabase
        .from('email_campaign_recipients')
        .select('id, person_id, personalized_subject, personalized_body_text, sent_at')
        .eq('campaign_id', selectedCampaign)
        .not('person_id', 'is', null);

      switch (enrollSegment) {
        case 'not_opened':
          enrollQuery = enrollQuery.in('status', ['sent', 'opened', 'clicked']).is('opened_at', null);
          break;
        case 'opened':
          enrollQuery = enrollQuery.not('opened_at', 'is', null);
          break;
        case 'clicked':
          enrollQuery = enrollQuery.not('clicked_at', 'is', null);
          break;
        case 'opened_no_click':
          enrollQuery = enrollQuery.not('opened_at', 'is', null).is('clicked_at', null);
          break;
        default:
          enrollQuery = enrollQuery.in('status', ['sent', 'opened', 'clicked']);
          break;
      }

      const { data: sentRecipients, error: recErr } = await enrollQuery;
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
      const campaignSenderProfileId = (selectedCampaignData as { sender_profile_id?: string | null } | undefined)?.sender_profile_id ?? null;
      for (const [companyId, recipient] of companyToFirstRecipient) {
        const { data: newCs, error: csErr } = await supabase
          .from('company_sequences')
          .insert({
            company_id: companyId,
            sequence_id: sequenceId,
            campaign_id: selectedCampaign,
            sender_profile_id: campaignSenderProfileId,
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

  const handleSyncFromResend = async () => {
    if (!selectedCampaign) return;
    setSyncingFromResend(true);
    try {
      const { data, error } = await supabase.functions.invoke('sync-resend-campaign-status', {
        body: { campaignId: selectedCampaign },
      });
      if (error) throw error;
      const updated = (data as { updated?: number; message?: string })?.updated ?? 0;
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['campaign-recipient-counts', selectedCampaign] }),
        queryClient.invalidateQueries({ queryKey: ['campaign-recipients', selectedCampaign] }),
        queryClient.invalidateQueries({ queryKey: ['email-campaigns'] }),
      ]);
      toast.success((data as { message?: string })?.message ?? `Synced ${updated} recipient(s) from Resend.`);
    } catch (e: any) {
      toast.error(e?.message ?? 'Failed to sync from Resend');
    } finally {
      setSyncingFromResend(false);
    }
  };

  const handleCreateFollowUpCampaign = async () => {
    if (!selectedCampaign || !selectedCampaignData) return;
    setCreatingFollowUp(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('Not authenticated');
        return;
      }
      const s = selectedCampaignData as any;
      let segmentQuery = supabase
        .from('email_campaign_recipients')
        .select('id, person_id, email, name, personalized_subject, personalized_body_html, personalized_body_text')
        .eq('campaign_id', selectedCampaign)
        .in('status', ['sent', 'opened', 'clicked']);
      switch (createFollowUpSegment) {
        case 'delivered_not_opened':
          segmentQuery = segmentQuery.not('delivered_at', 'is', null).is('opened_at', null);
          break;
        case 'not_opened':
          segmentQuery = segmentQuery.is('opened_at', null);
          break;
        case 'opened_no_click':
          segmentQuery = segmentQuery.not('opened_at', 'is', null).is('clicked_at', null);
          break;
        default:
          break;
      }
      const { data: segmentRecipients, error: segErr } = await segmentQuery;
      if (segErr) throw segErr;
      if (!segmentRecipients?.length) {
        toast.error('No recipients in this segment. Sync from Resend first or choose another segment.');
        return;
      }
      const { data: newCampaign, error: insertErr } = await supabase
        .from('email_campaigns')
        .insert({
          user_id: user.id,
          name: `${selectedCampaignData.name} (Follow-up)`,
          status: 'draft',
          subject_template: s.subject_template || '',
          body_html_template: s.body_html_template || '',
          body_text_template: s.body_text_template || '',
          sender_connection_id: s.sender_connection_id ?? null,
          sender_profile_id: s.sender_profile_id ?? null,
          header_image_url: s.header_image_url ?? null,
          tags: s.tags ?? null,
          auto_follow_up_enabled: s.auto_follow_up_enabled !== false,
          follow_up_sequence_id: s.follow_up_sequence_id ?? null,
          ab_test_enabled: false,
          ab_subject_b: null,
          ab_body_html_b: null,
          ab_body_text_b: null,
          ab_traffic_split: 50,
          ab_winner_metric: null,
          total_recipients: segmentRecipients.length,
          sent_count: 0,
          opened_count: 0,
          failed_count: 0,
        })
        .select('id')
        .single();
      if (insertErr || !newCampaign?.id) throw new Error('Failed to create campaign');
      const personIdForDb = (p: { person_id?: string | null }) =>
        p?.person_id && !String(p.person_id).startsWith('rec-') ? p.person_id : null;
      const recipients = (segmentRecipients as any[]).map((r) => ({
        campaign_id: newCampaign.id,
        person_id: personIdForDb(r),
        email: r.email,
        name: r.name || '',
        personalized_subject: r.personalized_subject || '',
        personalized_body_html: r.personalized_body_html || '',
        personalized_body_text: r.personalized_body_text || '',
        status: 'pending',
        email_period: 'new',
      }));
      const { error: recErr } = await supabase.from('email_campaign_recipients').insert(recipients);
      if (recErr) throw recErr;
      setCreateFollowUpOpen(false);
      setDraftToEdit(newCampaign.id);
      setBulkEmailDialogOpen(true);
      await queryClient.invalidateQueries({ queryKey: ['email-campaigns'] });
      toast.success(`Follow-up campaign created with ${segmentRecipients.length} recipient(s). Edit and send when ready.`);
    } catch (e: any) {
      toast.error(e?.message ?? 'Failed to create follow-up campaign');
    } finally {
      setCreatingFollowUp(false);
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
        queryClient.invalidateQueries({ queryKey: ['campaign-recipient-counts', selectedCampaign] }),
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
        queryClient.invalidateQueries({ queryKey: ['campaign-recipient-counts', selectedCampaign] }),
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
                Manage your email and phone campaigns, monitor health, and optimize performance.
              </p>
              <p className="mt-2 text-sm">
                <Link
                  to="/campaigns/import-email"
                  className="font-medium text-primary underline-offset-2 hover:underline"
                >
                  Personalized emails (import / per-recipient)
                </Link>
                <span className="text-muted-foreground">
                  {" "}
                  — import a file or generate a different subject and body for each person (not the same as &quot;New email
                  campaign&quot;).
                </span>
              </p>
            </div>
          </div>
          <div className="flex w-full max-w-full flex-wrap gap-2 sm:w-auto sm:max-w-none sm:justify-end">
            <Button onClick={openNewEmailCampaign} className="gap-2">
              <Mail className="h-4 w-4 shrink-0" />
              <Plus className="h-4 w-4 shrink-0" />
              <span className="truncate">New email campaign</span>
            </Button>
            <Button variant="secondary" onClick={() => navigate("/campaigns/import-email")} className="gap-2 shrink-0">
              <FileText className="h-4 w-4 shrink-0" />
              <span className="truncate">Per-recipient import</span>
            </Button>
            <Button 
              variant="outline" 
              onClick={() => setPhoneServiceDialogOpen(true)} 
              className="gap-2"
            >
              <Settings className="h-4 w-4 shrink-0" />
              <span className="truncate">Phone Services</span>
            </Button>
            <Button variant="outline" onClick={() => setPhoneCampaignDialogOpen(true)} className="gap-2">
              <Phone className="h-4 w-4 shrink-0" />
              <Plus className="h-4 w-4 shrink-0" />
              <span className="truncate">Phone Campaign</span>
            </Button>
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(value) => setSearchParams({ tab: value })}>
        <div className="-mx-2 mb-6 overflow-x-auto overscroll-x-contain pb-1 [-webkit-overflow-scrolling:touch] sm:mx-0 sm:overflow-visible">
          <TabsList className="inline-flex h-auto min-h-10 w-max max-w-none flex-nowrap justify-start gap-0.5 rounded-md bg-muted p-1 sm:grid sm:h-10 sm:w-full sm:grid-cols-6 sm:gap-0">
          <TabsTrigger value="overview" className="flex shrink-0 items-center gap-2">
            <Mail className="h-4 w-4" />
            <span className="hidden sm:inline">All Campaigns</span>
            <span className="sm:hidden">All</span>
          </TabsTrigger>
          <TabsTrigger value="delivery" className="flex shrink-0 items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            <span className="hidden sm:inline">Delivery report</span>
            <span className="sm:hidden">Report</span>
          </TabsTrigger>
          <TabsTrigger value="drafts" className="flex shrink-0 items-center gap-2">
            <FileText className="h-4 w-4" />
            <span className="hidden sm:inline">Drafts</span>
            <span className="sm:hidden">Drafts</span>
            {campaigns && campaigns.filter(c => c.status?.toLowerCase() === 'draft').length > 0 && (
              <Badge variant="secondary" className="ml-1">
                {campaigns.filter(c => c.status?.toLowerCase() === 'draft').length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="health" className="flex shrink-0 items-center gap-2">
            <Shield className="h-4 w-4" />
            <span className="hidden sm:inline">Email Health</span>
            <span className="sm:hidden">Health</span>
          </TabsTrigger>
          <TabsTrigger value="automation" className="flex shrink-0 items-center gap-2">
            <Zap className="h-4 w-4" />
            <span className="hidden sm:inline">Automation</span>
            <span className="sm:hidden">Auto</span>
          </TabsTrigger>
          <TabsTrigger value="testing" className="flex shrink-0 items-center gap-2">
            <FlaskConical className="h-4 w-4" />
            <span className="hidden sm:inline">A/B Testing</span>
            <span className="sm:hidden">Test</span>
          </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="overview" className="space-y-6">

      {!campaigns || campaigns.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Mail className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No campaigns yet</h3>
            <p className="text-sm text-muted-foreground text-center max-w-md mb-4">
              Start here with a data file or PDF (per-recipient subject and body), or add contacts from the People or Companies
              pages. You do not need CRM contacts to compose.
            </p>
            <div className="flex flex-col sm:flex-row flex-wrap items-center justify-center gap-2">
              <Button onClick={openNewEmailCampaign} className="gap-2">
                <Mail className="h-4 w-4" />
                <Plus className="h-4 w-4" />
                New email campaign
              </Button>
              <Button variant="secondary" onClick={() => navigate("/campaigns/import-email")} className="gap-2">
                <FileText className="h-4 w-4" />
                Per-recipient import (full page)
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <CardTitle>All Campaigns</CardTitle>
                <CardDescription>View performance and manage your campaigns. Paused and sending campaigns appear first.</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Label htmlFor="overview-status-filter" className="text-sm text-muted-foreground whitespace-nowrap">Status</Label>
                <Select value={overviewStatusFilter} onValueChange={setOverviewStatusFilter}>
                  <SelectTrigger id="overview-status-filter" className="w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="paused">Paused</SelectItem>
                    <SelectItem value="sending">Sending</SelectItem>
                    <SelectItem value="scheduled">Scheduled</SelectItem>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="failed">Failed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
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
                {overviewCampaigns.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      {overviewStatusFilter === "all" ? "No campaigns yet." : `No campaigns with status "${overviewStatusFilter}". Try "All" or another status.`}
                    </TableCell>
                  </TableRow>
                ) : overviewCampaigns.map((campaign) => {
                  const progress = campaign.total_recipients > 0
                    ? (campaign.sent_count / campaign.total_recipients) * 100
                    : 0;
                  const isScheduled = campaign.status?.toLowerCase() === 'scheduled' && campaign.scheduled_at;

                  return (
                    <TableRow key={campaign.id}>
                      <TableCell className="font-medium">{campaign.name}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap items-center gap-1.5">
                          {getStatusBadge(campaign.status)}
                          {campaign.status?.toLowerCase() === "draft" && (campaign.sent_count ?? 0) > 0 && (
                            <Badge variant="outline" className="text-amber-800 border-amber-300 bg-amber-50 dark:bg-amber-950/30">
                              Partially sent
                            </Badge>
                          )}
                          {campaign.status?.toLowerCase() === "completed" &&
                            (campaign.total_recipients ?? 0) > 0 &&
                            (campaign.sent_count ?? 0) < (campaign.total_recipients ?? 0) && (
                              <Badge variant="outline" className="text-muted-foreground font-normal">
                                List not fully sent
                              </Badge>
                            )}
                        </div>
                      </TableCell>
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
                          {campaign.status?.toLowerCase() === "completed" &&
                            (campaign.total_recipients ?? 0) > 0 &&
                            (campaign.sent_count ?? 0) < (campaign.total_recipients ?? 0) && (
                              <p className="text-xs text-muted-foreground">
                                “Completed” means no pending recipients left; the bar compares sent to total on the campaign.
                              </p>
                            )}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {format(new Date(campaign.created_at), 'MMM d, yyyy')}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm">
                              <Eye className="h-4 w-4 mr-2" />
                              View Details
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setSelectedCampaign(campaign.id)}>
                              <Eye className="h-4 w-4 mr-2" />
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => {
                                setDraftToEdit(campaign.id);
                                setBulkEmailDialogOpen(true);
                              }}
                            >
                              <Edit className="h-4 w-4 mr-2" />
                              Edit campaign
                            </DropdownMenuItem>
                            {(campaign.failed_count > 0 || (campaign.status?.toLowerCase?.() ?? '') === 'failed') && (
                              <DropdownMenuItem
                                disabled={listActionCampaignId === campaign.id}
                                onClick={() => handleRetryFailedByCampaignId(campaign.id)}
                              >
                                {listActionCampaignId === campaign.id ? (
                                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                ) : (
                                  <RotateCcw className="h-4 w-4 mr-2" />
                                )}
                                Retry failed
                              </DropdownMenuItem>
                            )}
                            {(campaign.status?.toLowerCase?.() ?? '') === 'paused' && (
                              <DropdownMenuItem
                                disabled={listActionCampaignId === campaign.id}
                                onClick={() => handleResumeCampaignById(campaign.id)}
                              >
                                {listActionCampaignId === campaign.id ? (
                                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                ) : (
                                  <Play className="h-4 w-4 mr-2" />
                                )}
                                Resume
                              </DropdownMenuItem>
                            )}
                            {(campaign.status?.toLowerCase?.() ?? '') === 'sending' && (
                              <DropdownMenuItem
                                disabled={listActionCampaignId === campaign.id}
                                onClick={() => handleSendPendingNowByCampaignId(campaign.id)}
                              >
                                {listActionCampaignId === campaign.id ? (
                                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                ) : (
                                  <Send className="h-4 w-4 mr-2" />
                                )}
                                Send pending now
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem
                              disabled={cloningFromTemplate}
                              onClick={() => handleDuplicateCampaign(campaign)}
                            >
                              {cloningFromTemplate ? (
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              ) : (
                                <Copy className="h-4 w-4 mr-2" />
                              )}
                              Duplicate
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={() => setCampaignToDelete(campaign.id)}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete campaign
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
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

        {/* Delivery report tab: what was sent, A/B breakdown, link to recipients */}
        <TabsContent value="delivery" className="space-y-6 mt-0 outline-none">
          <Card className="min-h-[200px]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                Delivery report
              </CardTitle>
              <CardDescription>
                See what was sent, who received which variant (A/B), and performance by variant. Select a campaign to view its report.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <Label className="text-sm font-medium">Campaign</Label>
                <Select
                  value={deliveryReportCampaignId ?? '__none__'}
                  onValueChange={(v) => setDeliveryReportCampaignId(v === '__none__' ? null : v)}
                >
                  <SelectTrigger className="w-[280px]">
                    <SelectValue placeholder="Select a campaign..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">
                      <span className="text-muted-foreground">Select a campaign...</span>
                    </SelectItem>
                    {(campaigns ?? [])
                      .filter((c) => (c.sent_count ?? 0) > 0)
                      .map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name} — {c.sent_count} sent
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                {deliveryReportCampaignId && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSelectedCampaign(deliveryReportCampaignId);
                    }}
                  >
                    <Eye className="h-4 w-4 mr-1" />
                    View recipients
                  </Button>
                )}
              </div>
              {isLoading && (
                <p className="text-sm text-muted-foreground py-4 flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading campaigns...
                </p>
              )}
              {!isLoading && (campaigns ?? []).filter((c) => (c.sent_count ?? 0) > 0).length === 0 && (
                <p className="text-sm text-muted-foreground py-4">
                  No campaigns with sends yet. Run a bulk email campaign from All Campaigns and send to at least one recipient, then return here to see the delivery report.
                </p>
              )}
              {!isLoading && !deliveryReportCampaignId && (campaigns ?? []).filter((c) => (c.sent_count ?? 0) > 0).length > 0 && (
                <p className="text-sm text-muted-foreground py-4">
                  Select a campaign above to see delivery summary, A/B variant breakdown, and who received which version.
                </p>
              )}
              {deliveryReportCampaignId && deliveryReportCampaign && (
                <div className="space-y-4 pt-2 border-t">
                  <div className="flex flex-wrap items-center gap-2 pb-2">
                    <span className="text-xs text-muted-foreground">Summary from recipient list (live).</span>
                    <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => { queryClient.invalidateQueries({ queryKey: ['email-campaigns'] }); refetchDeliveryReportRecipients(); }}>
                      <RefreshCw className="h-3 w-3 mr-1" />
                      Refresh
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                    <div className="rounded-lg border p-3">
                      <div className="text-muted-foreground text-xs uppercase tracking-wide">Sent</div>
                      <div className="text-xl font-semibold">
                        {deliveryReportSummaryFromRecipients ? deliveryReportSummaryFromRecipients.sent : (deliveryReportCampaign.sent_count ?? 0)}
                      </div>
                    </div>
                    <div className="rounded-lg border p-3">
                      <div className="text-muted-foreground text-xs uppercase tracking-wide">Opened</div>
                      <div className="text-xl font-semibold">
                        {deliveryReportSummaryFromRecipients ? deliveryReportSummaryFromRecipients.opened : Math.min(deliveryReportCampaign.opened_count ?? 0, deliveryReportCampaign.sent_count ?? 0)}
                      </div>
                    </div>
                    <div className="rounded-lg border p-3">
                      <div className="text-muted-foreground text-xs uppercase tracking-wide">Total recipients</div>
                      <div className="text-xl font-semibold">
                        {deliveryReportSummaryFromRecipients ? deliveryReportSummaryFromRecipients.total : (deliveryReportCampaign.total_recipients ?? 0)}
                      </div>
                    </div>
                    <div className="rounded-lg border p-3">
                      <div className="text-muted-foreground text-xs uppercase tracking-wide">Status</div>
                      <div>{getStatusBadge(deliveryReportCampaign.status)}</div>
                    </div>
                  </div>
                  {deliveryReportAbResults ? (
                    <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
                      <div className="font-medium">A/B test — what was sent</div>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div className={`rounded-md p-3 border ${deliveryReportAbResults.winner === 'A' ? 'border-primary bg-primary/5' : 'bg-muted/50'}`}>
                          <div className="font-medium mb-1">Variant A</div>
                          <div className="text-muted-foreground space-y-0.5">
                            <div>{deliveryReportAbResults.byVariant.A.sent} sent, {deliveryReportAbResults.byVariant.A.opened} opened, {deliveryReportAbResults.byVariant.A.clicked} clicked</div>
                            <div>Open rate: {deliveryReportAbResults.byVariant.A.openRate.toFixed(1)}% · Click rate: {deliveryReportAbResults.byVariant.A.clickRate.toFixed(1)}%</div>
                          </div>
                          {deliveryReportAbResults.winner === 'A' && (
                            <Badge variant="default" className="mt-2">Winner ({deliveryReportAbResults.winnerMetric.replace('_', ' ')})</Badge>
                          )}
                        </div>
                        <div className={`rounded-md p-3 border ${deliveryReportAbResults.winner === 'B' ? 'border-primary bg-primary/5' : 'bg-muted/50'}`}>
                          <div className="font-medium mb-1">Variant B</div>
                          <div className="text-muted-foreground space-y-0.5">
                            <div>{deliveryReportAbResults.byVariant.B.sent} sent, {deliveryReportAbResults.byVariant.B.opened} opened, {deliveryReportAbResults.byVariant.B.clicked} clicked</div>
                            <div>Open rate: {deliveryReportAbResults.byVariant.B.openRate.toFixed(1)}% · Click rate: {deliveryReportAbResults.byVariant.B.clickRate.toFixed(1)}%</div>
                          </div>
                          {deliveryReportAbResults.winner === 'B' && (
                            <Badge variant="default" className="mt-2">Winner ({deliveryReportAbResults.winnerMetric.replace('_', ' ')})</Badge>
                          )}
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Each recipient received either Variant A or B. Use &quot;View recipients&quot; above to see the full list with variant and status.
                      </p>
                    </div>
                  ) : deliveryReportCampaign.ab_test_enabled && (deliveryReportRecipients?.length ?? 0) === 0 ? (
                    <p className="text-sm text-muted-foreground">Loading recipient data for A/B breakdown...</p>
                  ) : deliveryReportCampaign.ab_test_enabled && deliveryReportRecipients && deliveryReportRecipients.length > 0 ? (
                    <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
                      <p className="text-sm text-muted-foreground">Variant not recorded for this campaign&apos;s recipients (e.g. sent before A/B or list replaced).</p>
                      {deliveryReportSummaryFromRecipients && (
                        <p className="text-sm">
                          Overall: <strong>{deliveryReportSummaryFromRecipients.sent}</strong> sent, <strong>{deliveryReportSummaryFromRecipients.opened}</strong> opened of <strong>{deliveryReportSummaryFromRecipients.total}</strong> recipients.
                        </p>
                      )}
                    </div>
                  ) : null}
                  {/* Full send history: initial send + every resend/swap */}
                  {campaignSendHistory && campaignSendHistory.length > 0 && (
                    <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
                      <div className="font-medium">Send history (all sends — initial and resends)</div>
                      <p className="text-xs text-muted-foreground">
                        Every time an email was sent (initial send or swap/resend). Swap and resend never sends the same variant twice to the same recipient.
                      </p>
                      <div className="overflow-x-auto max-h-[280px] overflow-y-auto border rounded-md">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-[140px]">Sent at</TableHead>
                              <TableHead>Recipient</TableHead>
                              <TableHead className="w-[70px]">Variant</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {campaignSendHistory.map((h) => {
                              const rec = (deliveryReportRecipients ?? recipients ?? []).find((r) => r.id === h.recipient_id);
                              return (
                                <TableRow key={h.id}>
                                  <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                                    {format(new Date(h.sent_at), 'MMM d, yyyy HH:mm')}
                                  </TableCell>
                                  <TableCell className="text-sm">{rec ? `${rec.name} <${rec.email}>` : h.recipient_id}</TableCell>
                                  <TableCell>
                                    <Badge variant={h.variant_sent === 'A' ? 'default' : 'secondary'} className="font-mono">{h.variant_sent}</Badge>
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
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
                  Start a new email campaign and import CSV, Excel, JSON, or PDF for customized messages per recipient, or duplicate an existing
                  campaign as a template.
                </p>
                <div className="flex flex-col sm:flex-row gap-2">
                  <Button onClick={openNewEmailCampaign} className="gap-2">
                    <Mail className="h-4 w-4" />
                    <Plus className="h-4 w-4" />
                    New email campaign
                  </Button>
                  {templateCampaigns.length > 0 && (
                    <Button variant="outline" onClick={() => setCreateFromTemplateOpen(true)} className="gap-2">
                      <Copy className="h-4 w-4" />
                      Create from template
                    </Button>
                  )}
                </div>
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
                  <CardDescription>Continue editing your saved drafts, import a spreadsheet/JSON/PDF, or start from a template</CardDescription>
                </div>
                <div className="flex flex-wrap gap-2 w-full sm:w-auto justify-end">
                  <Button size="sm" onClick={openNewEmailCampaign} className="gap-2 shrink-0">
                    <Mail className="h-4 w-4" />
                    New email
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCreateFromTemplateOpen(true)}
                    className="shrink-0 gap-2"
                  >
                    <Copy className="h-4 w-4" />
                    From template
                  </Button>
                </div>
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

        {/* Add Recipients dialog (customizable: groups, people, companies, paste) */}
        <Dialog open={addRecipientsDialogOpen} onOpenChange={(open) => { setAddRecipientsDialogOpen(open); if (!open) { setAddRecipientsSelectedPeople(new Set()); setAddRecipientsSelectedCompanies(new Set()); setAddRecipientsPasteText(''); } }}>
          <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
            <DialogHeader>
              <DialogTitle>Add recipients</DialogTitle>
              <DialogDescription>Add recipients from groups, People, Companies, or paste a list of emails. Duplicates are skipped.</DialogDescription>
              {(() => {
                const hasPrepared = !!localStorage.getItem('leadgenie_draft_recipients');
                const hasPeople = !!localStorage.getItem('leadgenie_selected_people_ids');
                const hasCompanies = !!localStorage.getItem('leadgenie_selected_company_ids');
                if (!hasPrepared && !hasPeople && !hasCompanies) return null;
                return (
                  <Button variant="secondary" size="sm" className="mt-2 w-fit" disabled={addingRecipients} onClick={() => { handleAddRecipientsToCampaign(); setAddRecipientsDialogOpen(false); }}>
                    {addingRecipients ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <RefreshCw className="h-4 w-4 mr-1" />}
                    Add from selection (People/Companies page)
                  </Button>
                );
              })()}
            </DialogHeader>
            <Tabs value={addRecipientsTab} onValueChange={(v) => setAddRecipientsTab(v as typeof addRecipientsTab)} className="flex-1 min-h-0 flex flex-col">
              <TabsList className="grid grid-cols-4 w-full">
                <TabsTrigger value="groups" className="gap-1"><FolderInput className="h-3.5 w-3.5" />Groups</TabsTrigger>
                <TabsTrigger value="people" className="gap-1"><Users className="h-3.5 w-3.5" />People</TabsTrigger>
                <TabsTrigger value="companies" className="gap-1"><Building2 className="h-3.5 w-3.5" />Companies</TabsTrigger>
                <TabsTrigger value="paste" className="gap-1"><FileText className="h-3.5 w-3.5" />Paste</TabsTrigger>
              </TabsList>
              <TabsContent value="groups" className="flex-1 min-h-0 mt-3 space-y-3">
                {recipientGroups.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-6 text-center">No recipient groups yet. Save recipients from a campaign as a group, or create one from People/Companies.</p>
                ) : (
                  <div className="space-y-2 max-h-[320px] overflow-y-auto">
                    {recipientGroups.map((g: any) => (
                      <Button key={g.id} variant="outline" className="w-full justify-start gap-2" disabled={addingRecipientsFromDialog} onClick={async () => {
                        const { data: members } = await supabase.from('recipient_group_members').select('email, first_name, last_name, company, person_id').eq('group_id', g.id);
                        const items = (members || []).map((m: any) => ({ email: m.email, first_name: m.first_name, last_name: m.last_name, name: [m.first_name, m.last_name].filter(Boolean).join(' ') || undefined, person_id: m.person_id }));
                        const rows = buildRecipientRows(items);
                        if (rows.length === 0) { toast.info('All group members are already in this campaign.'); return; }
                        await addRecipientsFromDialog(rows);
                      }}>
                        <FolderInput className="h-4 w-4 shrink-0" />
                        {g.name}
                      </Button>
                    ))}
                  </div>
                )}
              </TabsContent>
              <TabsContent value="people" className="flex-1 min-h-0 mt-3 space-y-3">
                <Input placeholder="Search by name or email..." value={addRecipientsPeopleSearch} onChange={(e) => setAddRecipientsPeopleSearch(e.target.value)} className="max-w-sm" />
                <div className="max-h-[320px] overflow-y-auto border rounded-md">
                  {addRecipientsPeopleList.length === 0 ? (
                    <p className="text-sm text-muted-foreground p-4 text-center">No people with email found.</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-10" />
                          <TableHead>Name</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Company</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {addRecipientsPeopleList.map((p) => {
                          const checked = addRecipientsSelectedPeople.has(p.id);
                          return (
                            <TableRow key={p.id} className="cursor-pointer" onClick={() => setAddRecipientsSelectedPeople(prev => { const n = new Set(prev); if (n.has(p.id)) n.delete(p.id); else n.add(p.id); return n; })}>
                              <TableCell onClick={(e) => e.stopPropagation()}><Checkbox checked={checked} onCheckedChange={() => setAddRecipientsSelectedPeople(prev => { const n = new Set(prev); if (n.has(p.id)) n.delete(p.id); else n.add(p.id); return n; })} /></TableCell>
                              <TableCell>{[p.first_name, p.last_name].filter(Boolean).join(' ') || '—'}</TableCell>
                              <TableCell className="font-mono text-xs">{p.email}</TableCell>
                              <TableCell>{(p.companies as { name: string | null } | null)?.name ?? '—'}</TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  )}
                </div>
                <Button disabled={addRecipientsSelectedPeople.size === 0 || addingRecipientsFromDialog} onClick={async () => {
                  const selected = addRecipientsPeopleList.filter(p => addRecipientsSelectedPeople.has(p.id));
                  const items = selected.map(p => ({ email: p.email, first_name: p.first_name, last_name: p.last_name, person_id: p.id }));
                  const rows = buildRecipientRows(items);
                  if (rows.length === 0) { toast.info('Selected people are already in this campaign.'); return; }
                  await addRecipientsFromDialog(rows);
                }}>
                  {addingRecipientsFromDialog ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Plus className="h-4 w-4 mr-1" />}
                  Add {addRecipientsSelectedPeople.size} selected ({buildRecipientRows(addRecipientsPeopleList.filter(p => addRecipientsSelectedPeople.has(p.id)).map(p => ({ email: p.email, first_name: p.first_name, last_name: p.last_name, person_id: p.id }))).length} new)
                </Button>
              </TabsContent>
              <TabsContent value="companies" className="flex-1 min-h-0 mt-3 space-y-3">
                <Input placeholder="Search by name, email, or industry..." value={addRecipientsCompaniesSearch} onChange={(e) => setAddRecipientsCompaniesSearch(e.target.value)} className="max-w-sm" />
                <div className="max-h-[320px] overflow-y-auto border rounded-md">
                  {addRecipientsCompaniesList.length === 0 ? (
                    <p className="text-sm text-muted-foreground p-4 text-center">No companies with email found.</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-10" />
                          <TableHead>Company</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Industry</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {addRecipientsCompaniesList.map((c) => {
                          const checked = addRecipientsSelectedCompanies.has(c.id);
                          return (
                            <TableRow key={c.id} className="cursor-pointer" onClick={() => setAddRecipientsSelectedCompanies(prev => { const n = new Set(prev); if (n.has(c.id)) n.delete(c.id); else n.add(c.id); return n; })}>
                              <TableCell onClick={(e) => e.stopPropagation()}><Checkbox checked={checked} onCheckedChange={() => setAddRecipientsSelectedCompanies(prev => { const n = new Set(prev); if (n.has(c.id)) n.delete(c.id); else n.add(c.id); return n; })} /></TableCell>
                              <TableCell>{c.name || '—'}</TableCell>
                              <TableCell className="font-mono text-xs">{c.email}</TableCell>
                              <TableCell>{c.industry || '—'}</TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  )}
                </div>
                <Button disabled={addRecipientsSelectedCompanies.size === 0 || addingRecipientsFromDialog} onClick={async () => {
                  const selected = addRecipientsCompaniesList.filter(c => addRecipientsSelectedCompanies.has(c.id));
                  const items = selected.map(c => ({ email: c.email, name: c.name || c.email }));
                  const rows = buildRecipientRows(items);
                  if (rows.length === 0) { toast.info('Selected companies are already in this campaign.'); return; }
                  await addRecipientsFromDialog(rows);
                }}>
                  {addingRecipientsFromDialog ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Plus className="h-4 w-4 mr-1" />}
                  Add {addRecipientsSelectedCompanies.size} selected ({buildRecipientRows(addRecipientsCompaniesList.filter(c => addRecipientsSelectedCompanies.has(c.id)).map(c => ({ email: c.email, name: c.name || c.email }))).length} new)
                </Button>
              </TabsContent>
              <TabsContent value="paste" className="flex-1 min-h-0 mt-3 space-y-3">
                <Label className="text-sm">Paste emails (one per line, or "email, Name" or "email, Name, Company")</Label>
                <textarea className="w-full min-h-[200px] rounded-md border bg-background px-3 py-2 text-sm font-mono" placeholder="john@example.com&#10;jane@example.com, Jane Doe&#10;bob@example.com, Bob, Acme Inc" value={addRecipientsPasteText} onChange={(e) => setAddRecipientsPasteText(e.target.value)} />
                {addRecipientsPasteText.trim() && (() => {
                  const lines = addRecipientsPasteText.trim().split(/\n/).map(l => l.trim()).filter(Boolean);
                  const items = lines.map(line => {
                    const parts = line.split(/[,;\t]/).map(p => p.trim());
                    const email = parts[0]?.toLowerCase();
                    const first_name = parts[1] || undefined;
                    const last_name = parts[2] && parts.length > 2 && !parts[2].includes('@') ? parts[2] : undefined;
                    const name = first_name && last_name ? `${first_name} ${last_name}` : first_name;
                    return email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? { email, first_name, last_name, name } : null;
                  }).filter(Boolean) as { email: string; first_name?: string; last_name?: string; name?: string }[];
                  const rows = buildRecipientRows(items);
                  return <p className="text-xs text-muted-foreground">{items.length} valid email(s), {rows.length} new (not already in campaign)</p>;
                })()}
                <Button disabled={!addRecipientsPasteText.trim() || addingRecipientsFromDialog} onClick={async () => {
                  const lines = addRecipientsPasteText.trim().split(/\n/).map(l => l.trim()).filter(Boolean);
                  const items = lines.map(line => {
                    const parts = line.split(/[,;\t]/).map(p => p.trim());
                    const email = parts[0]?.toLowerCase();
                    const first_name = parts[1] || undefined;
                    const last_name = parts[2] && parts.length > 2 && !parts[2].includes('@') ? parts[2] : undefined;
                    const name = first_name && last_name ? `${first_name} ${last_name}` : first_name;
                    return email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? { email, first_name, last_name, name } : null;
                  }).filter(Boolean) as { email: string; first_name?: string; last_name?: string; name?: string }[];
                  const rows = buildRecipientRows(items);
                  if (rows.length === 0) { toast.info('No new emails to add (invalid or already in campaign).'); return; }
                  await addRecipientsFromDialog(rows);
                }}>
                  {addingRecipientsFromDialog ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Plus className="h-4 w-4 mr-1" />}
                  Add from paste
                </Button>
              </TabsContent>
            </Tabs>
            <p className="text-xs text-muted-foreground pt-2">You can also open People or Companies in another tab, select contacts, then click &quot;Add Recipients&quot; here to pull from that selection.</p>
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
              {statusCounts && (
                <div className="flex flex-wrap items-center gap-3 pt-2 text-sm">
                  <span className="font-medium text-foreground">Summary:</span>
                  <span>{(statusCounts.sent ?? 0) + (statusCounts.opened ?? 0) + (statusCounts.clicked ?? 0)} sent</span>
                  <span className="text-muted-foreground">·</span>
                  <span>{statusCounts.pending ?? 0} pending</span>
                  {(statusCounts.failed ?? 0) > 0 && (
                    <>
                      <span className="text-muted-foreground">·</span>
                      <span className="text-destructive">{statusCounts.failed} failed</span>
                    </>
                  )}
                  {(statusCounts.bounced ?? 0) > 0 && (
                    <>
                      <span className="text-muted-foreground">·</span>
                      <span className="text-destructive">{statusCounts.bounced} bounced</span>
                    </>
                  )}
                  <span className="text-muted-foreground text-xs ml-1">
                    (Sent recipients appear first in the list below)
                  </span>
                </div>
              )}
              {sendHistoryByDate.length > 0 && (
                <div className="rounded-md border bg-muted/30 px-3 py-2 mt-2">
                  <div className="text-xs font-medium text-muted-foreground mb-1.5">Send history (when emails were sent)</div>
                  <ul className="text-xs space-y-1 text-muted-foreground">
                    {sendHistoryByDate.map((entry, i) => (
                      <li key={i}>
                        {format(new Date(entry.at), 'MMM d, yyyy HH:mm')} — {entry.count} sent
                        {(entry.variantA > 0 || entry.variantB > 0) && (
                          <span className="ml-1">(A: {entry.variantA}, B: {entry.variantB})</span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
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
                  {pendingRecipientsCount > 0 && (
                    <span className="block text-xs mt-1 text-muted-foreground/90">
                      Cron runs every 15 min. Use &quot;Send pending now&quot; to send the next batch immediately.
                    </span>
                  )}
                </span>
                <div className="flex flex-wrap gap-2 ml-auto">
                  {selectedCampaignData?.status?.toLowerCase() === 'sending' && (
                    <Button variant="outline" size="sm" onClick={handlePauseCampaign} disabled={pausingCampaign}>
                      {pausingCampaign ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Pause className="h-4 w-4 mr-1" />}
                      Pause
                    </Button>
                  )}
                  {selectedCampaignData?.status?.toLowerCase() === 'paused' && (
                    <Button variant="default" size="sm" onClick={handleResumeCampaign} disabled={resumingCampaign}>
                      {resumingCampaign ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Play className="h-4 w-4 mr-1" />}
                      Resume
                    </Button>
                  )}
                  {pendingRecipientsCount > 0 && (selectedCampaignData?.status?.toLowerCase() === 'sending' || selectedCampaignData?.status?.toLowerCase() === 'paused') && (
                    <Button variant="default" size="sm" onClick={handleSendPendingNow} disabled={sendingPendingNow}>
                      {sendingPendingNow ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Send className="h-4 w-4 mr-1" />}
                      Send pending now
                    </Button>
                  )}
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

            {/* Delete campaign (all statuses) */}
            <div className="flex justify-end border-t pt-3 mt-2">
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={() => {
                  if (selectedCampaign) setCampaignToDelete(selectedCampaign);
                }}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete campaign
              </Button>
            </div>

            {/* Sync from Resend + Create follow-up campaign (tracking-based) */}
            {(selectedCampaignData?.status?.toLowerCase() === 'completed' || selectedCampaignData?.status?.toLowerCase() === 'sending' || selectedCampaignData?.status?.toLowerCase() === 'paused') &&
             (selectedCampaignData as Campaign).sent_count > 0 && (
              <div className="rounded-lg border bg-muted/30 px-4 py-3 space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <BarChart3 className="h-4 w-4 text-primary shrink-0" />
                  Tracking & follow-up
                </div>
                <p className="text-xs text-muted-foreground">
                  Sync delivered/opened/clicked from Resend into the CRM, then create a reminder campaign for a segment (e.g. not opened).
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSyncFromResend}
                    disabled={syncingFromResend}
                  >
                    {syncingFromResend ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-1" />}
                    Sync from Resend
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCreateFollowUpOpen(true)}
                  >
                    Create follow-up campaign
                  </Button>
                </div>
                <Dialog open={createFollowUpOpen} onOpenChange={setCreateFollowUpOpen}>
                  <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                      <DialogTitle>Create follow-up campaign</DialogTitle>
                      <DialogDescription>
                        Create a new draft with only the selected segment as recipients. Edit subject/body if needed, then send.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                      <div className="space-y-2">
                        <Label>Segment</Label>
                        <Select value={createFollowUpSegment} onValueChange={(v: 'delivered_not_opened' | 'not_opened' | 'opened_no_click') => setCreateFollowUpSegment(v)}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="not_opened">Not opened (sent but no open)</SelectItem>
                            <SelectItem value="delivered_not_opened">Delivered, not opened</SelectItem>
                            <SelectItem value="opened_no_click">Opened, no click</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <Button
                        className="w-full"
                        onClick={handleCreateFollowUpCampaign}
                        disabled={creatingFollowUp}
                      >
                        {creatingFollowUp ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                        Create draft with segment
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            )}

            {/* Auto follow-up for sent campaigns: show status or enroll in sequence */}
            {(selectedCampaignData?.status?.toLowerCase() === 'completed' || selectedCampaignData?.status?.toLowerCase() === 'sending' || selectedCampaignData?.status?.toLowerCase() === 'paused') &&
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
                  <p className="text-xs text-muted-foreground">
                    To automatically resend to those who opened but didn't click: choose segment <strong>Opened, no click</strong> when enrolling. The sequence's behavioral automation runs hourly and sends the next step after the wait period.
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
                    <Select
                      value={enrollSegment}
                      onValueChange={(v) => setEnrollSegment(v as EnrollSegment)}
                      disabled={enrollingFollowUp}
                    >
                      <SelectTrigger className="w-[180px]" title="Enroll only this segment">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all_sent">All sent</SelectItem>
                        <SelectItem value="not_opened">Not opened (reminders)</SelectItem>
                        <SelectItem value="opened">Only opened</SelectItem>
                        <SelectItem value="clicked">Only clicked</SelectItem>
                        <SelectItem value="opened_no_click">Opened, no click</SelectItem>
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
            {abTestResults && (selectedCampaignData?.status?.toLowerCase() === 'completed' || selectedCampaignData?.status?.toLowerCase() === 'sending' || selectedCampaignData?.status?.toLowerCase() === 'paused') && (
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
                {/* Resend & swap actions */}
                <div className="flex flex-wrap items-center gap-2 pt-2 border-t">
                  <span className="text-muted-foreground text-xs mr-1">Resend / swap:</span>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm" disabled={!!resendVariantLoading || sentRecipientsByVariant.all.length === 0}>
                        {resendVariantLoading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <SendHorizontal className="h-4 w-4 mr-1" />}
                        Resend or swap
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start">
                      <DropdownMenuItem
                        onClick={() => handleResendVariant('A')}
                        disabled={sentRecipientsByVariant.A.length === 0 || !!resendVariantLoading}
                      >
                        Resend to Variant A recipients ({sentRecipientsByVariant.A.length})
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handleResendVariant('B')}
                        disabled={sentRecipientsByVariant.B.length === 0 || !!resendVariantLoading}
                      >
                        Resend to Variant B recipients ({sentRecipientsByVariant.B.length})
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handleResendVariant('all')}
                        disabled={sentRecipientsByVariant.all.length === 0 || !!resendVariantLoading}
                      >
                        Resend to all (same variant each)
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={handleSwapAndResend}
                        disabled={sentRecipientsByVariant.all.length === 0 || !!resendVariantLoading}
                      >
                        <ArrowLeftRight className="h-4 w-4 mr-2" />
                        Swap variants and resend (A→B content, B→A content)
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            )}

            {canEditRecipients && (
              <div className="space-y-2 py-2 border-b">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative flex-1 min-w-[200px] max-w-[280px]">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                    <Input
                      placeholder="Search recipients..."
                      value={recipientSearchQuery}
                      onChange={(e) => setRecipientSearchQuery(e.target.value)}
                      className="pl-8 h-9"
                    />
                  </div>
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => setAddRecipientsDialogOpen(true)}
                  >
                    <Plus className="h-4 w-4 mr-1" />
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
                  <Button variant="outline" size="sm" onClick={() => { setAddRecipientsDialogOpen(true); setAddRecipientsTab('groups'); }} disabled={recipientGroups.length === 0}>
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

            {/* Resend-style status filter: server-side for large lists */}
            {recipients && (
              <div className="flex flex-wrap items-center gap-3 py-2 border-b">
                <Label className="text-sm font-medium shrink-0">Status</Label>
                <Select
                  value={recipientStatusFilter}
                  onValueChange={(v) => setRecipientStatusFilter(v as RecipientStatusFilter)}
                >
                  <SelectTrigger className="w-[220px]">
                    <SelectValue placeholder="All statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">
                      All statuses {statusCounts ? `(${statusCounts.all})` : ''}
                    </SelectItem>
                    <SelectItem value="pending">
                      Pending {statusCounts ? `(${statusCounts.pending})` : ''}
                    </SelectItem>
                    <SelectItem value="sent">
                      Sent {statusCounts ? `(${statusCounts.sent})` : ''}
                    </SelectItem>
                    <SelectItem value="delivered">
                      Delivered {statusCounts ? `(${statusCounts.delivered ?? 0})` : ''}
                    </SelectItem>
                    <SelectItem value="delivered_not_opened">
                      Delivered, not opened {statusCounts ? `(${statusCounts.delivered_not_opened ?? 0})` : ''}
                    </SelectItem>
                    <SelectItem value="opened">
                      Opened {statusCounts ? `(${statusCounts.opened})` : ''}
                    </SelectItem>
                    <SelectItem value="clicked">
                      Clicked {statusCounts ? `(${statusCounts.clicked})` : ''}
                    </SelectItem>
                    <SelectItem value="opened_no_click">
                      Opened, no click {statusCounts ? `(${statusCounts.opened_no_click})` : ''}
                    </SelectItem>
                    <SelectItem value="bounced">
                      Bounced {statusCounts ? `(${statusCounts.bounced})` : ''}
                    </SelectItem>
                    <SelectItem value="failed">
                      Failed {statusCounts ? `(${statusCounts.failed})` : ''}
                    </SelectItem>
                  </SelectContent>
                </Select>
                <span className="text-sm text-muted-foreground">
                  Showing {filteredRecipients.length} recipient{filteredRecipients.length !== 1 ? 's' : ''}
                  {recipientSearchQuery.trim() && ` (of ${recipients.length})`}
                </span>
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
                    {abTestResults && <TableHead className="w-[70px]">Variant</TableHead>}
                    <TableHead>Sent At</TableHead>
                    <TableHead>Opened At</TableHead>
                    {canEditRecipients && <TableHead className="w-[100px]">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRecipients.map((recipient) => (
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
                      {abTestResults && (
                        <TableCell className="text-sm">
                          {recipient.ab_variant === 'A' || recipient.ab_variant === 'B' ? (
                            <Badge variant={recipient.ab_variant === 'A' ? 'default' : 'secondary'} className="font-mono">
                              {recipient.ab_variant}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">–</span>
                          )}
                        </TableCell>
                      )}
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

        {/* Delete Campaign Confirmation (any status) */}
        <AlertDialog open={!!campaignToDelete} onOpenChange={() => !deletingCampaign && setCampaignToDelete(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete campaign?</AlertDialogTitle>
              <AlertDialogDescription>
                This campaign and all its recipients and send history will be permanently deleted. This cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deletingCampaign}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={(e) => {
                  e.preventDefault();
                  handleDeleteCampaign();
                }}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                disabled={deletingCampaign}
              >
                {deletingCampaign ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  "Delete campaign"
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