import { useState, useEffect, useRef, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Loader2, Plus, Pencil, Trash2, Send, Eye, Sparkles, Users, Tag,
  MailOpen, MousePointerClick, ArrowLeft, Link2, FileText, Copy,
  UserPlus, Upload, ChevronDown, ImagePlus, FolderInput, FlaskConical,
  Clock, CalendarClock, RefreshCw,
} from "lucide-react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Link } from "react-router-dom";
import { EmailTemplatePreview, type EmailTemplatePreviewStyle } from "@/components/email/EmailTemplatePreview";
import { TemplateStyleSelector, type EmailTemplateStyle } from "@/components/email/TemplateStyleSelector";
import { RichTextEditor, type RichTextEditorHandle } from "@/components/email/RichTextEditor";

type Newsletter = {
  id: string;
  title: string;
  subject: string;
  body_html: string | null;
  cta_text: string | null;
  cta_url: string | null;
  sender_profile_id: string | null;
  template_style: string;
  header_image_url: string | null;
  status: string;
  scheduled_at: string | null;
  sent_at: string | null;
  total_recipients: number;
  total_sent: number;
  total_opened: number;
  total_clicked: number;
  created_at: string;
  updated_at: string;
  scheduled_send_options?: Record<string, unknown> | null;
  batch_send?: boolean | null;
  batch_size?: number | null;
  batch_sent_count?: number | null;
  batch_next_at?: string | null;
};

type Category = {
  id: string;
  name: string;
  color: string | null;
  description: string | null;
};

type Subscriber = {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  company: string | null;
  industry?: string | null;
  source: string;
  status: string;
  created_at: string;
};

type ViewMode = "list" | "editor" | "subscribers";

/** Default timezone for displaying dates/times (London). */
const DEFAULT_TIMEZONE = "Europe/London";
function formatInLondon(date: Date | string, options?: Intl.DateTimeFormatOptions): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleString(undefined, { timeZone: DEFAULT_TIMEZONE, ...options });
}
function formatDateInLondon(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString(undefined, { timeZone: DEFAULT_TIMEZONE });
}

/** Placeholder / fake domains that are not real inboxes. Helps avoid bounces and protect sender reputation. */
const PLACEHOLDER_DOMAINS = new Set([
  "domain.com", "domain.org", "domain.net", "example.com", "example.org", "example.net", "example.edu", "example.co",
  "test.com", "test.org", "test.net", "test.co", "email.com", "sample.com", "abc.xyz", "foo.com", "bar.com", "user.com",
  "placeholder.com", "fake.com", "mail.test",
  "yopmail.com", "mailinator.com", "guerrillamail.com", "tempmail.com", "throwaway.email", "10minutemail.com",
]);

/** Placeholder local parts that often indicate fake/example addresses when combined with a fake-looking domain. */
const PLACEHOLDER_LOCAL_PARTS = new Set([
  "name", "email", "user", "test", "example", "ex", "sample", "demo", "foo", "bar", "contact", "info", "admin",
  "noreply", "no-reply", "donotreply", "mailer-daemon",
]);

/** Domain looks like a placeholder (example/test/domain/sample/fake in the domain name). */
function isPlaceholderLikeDomain(domain: string): boolean {
  const d = domain.toLowerCase();
  return /example|^test\.|\.test\.|domain\.|sample\.|fake\.|placeholder\.|^email\.|^user\./.test(d) || PLACEHOLDER_DOMAINS.has(d);
}

/** Validation: format, no file-extension domains, no placeholder domains, no placeholder local+domain combos. */
function isValidNewsletterEmail(email: string): boolean {
  const e = (email || "").trim().toLowerCase();
  if (!e || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return false;
  const [local, domain] = e.split("@");
  const dom = (domain || "").toLowerCase();
  // File-extension-style domains (stretch.png, 1x.svg, orange-arrow-tall@1x.svg, etc.)
  const fileExtTld = /\.(png|jpeg|jpg|gif|pdf|doc|docx|xls|xlsx|txt|html|css|js|zip|exe|svg|webp|bmp|ico|mov|mp4|wav)$/i;
  if (fileExtTld.test(dom)) return false;
  // Known placeholder / fake domains (Name@domain.com, ex@abc.xyz, etc.)
  if (PLACEHOLDER_DOMAINS.has(dom)) return false;
  // Placeholder local part + placeholder-like domain (name@..., test@..., ex@... on example/test/domain-style domains)
  if (PLACEHOLDER_LOCAL_PARTS.has((local || "").toLowerCase()) && isPlaceholderLikeDomain(dom)) return false;
  return true;
}

/** Split "a@x.com, b@y.com" into ["a@x.com", "b@y.com"] (trimmed, no empty). */
function parseCommaSeparatedEmails(value: string): string[] {
  return (value || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s.length > 0);
}

/** Row is invalid if it contains at least one invalid email (when split by comma). All valid = not invalid. */
function isSubscriberEmailInvalid(email: string): boolean {
  const parts = parseCommaSeparatedEmails(email);
  if (parts.length === 0) return true;
  return parts.some((p) => !isValidNewsletterEmail(p));
}

/** Row has multiple emails on one line (should be split so each email is on its own row). */
function hasMultipleEmailsOnOneLine(email: string): boolean {
  const parts = parseCommaSeparatedEmails(email);
  return parts.length > 1;
}

/** Row has at least one valid email (useful for mixed valid/invalid rows — split to keep valid only). */
function hasAtLeastOneValidEmail(email: string): boolean {
  const parts = parseCommaSeparatedEmails(email);
  return parts.some((p) => isValidNewsletterEmail(p));
}

export default function Newsletters() {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [view, setView] = useState<ViewMode>("list");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendingBatchNow, setSendingBatchNow] = useState(false);
  const [cronStartHourUtc, setCronStartHourUtc] = useState(9);
  const [cronEndHourUtc, setCronEndHourUtc] = useState(22);
  const [cronTimezone, setCronTimezone] = useState("");
  const [savingCronWindow, setSavingCronWindow] = useState(false);

  // Editor state
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [bodyHtml, setBodyHtml] = useState("");
  const [ctaText, setCtaText] = useState("");
  const [ctaUrl, setCtaUrl] = useState("");
  const [senderProfileId, setSenderProfileId] = useState("");
  const [templateStyle, setTemplateStyle] = useState<EmailTemplateStyle>("professional");
  const [headerImageUrl, setHeaderImageUrl] = useState("");
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);

  // AI generation
  const [aiTopic, setAiTopic] = useState("");
  const [aiTone, setAiTone] = useState("professional");
  const [aiTargetAudience, setAiTargetAudience] = useState("");
  const [uploadingImage, setUploadingImage] = useState(false);
  const newsletterImgRef = useRef<HTMLInputElement>(null);
  const headerImageFileRef = useRef<HTMLInputElement>(null);
  const newsletterBodyEditorRef = useRef<RichTextEditorHandle | null>(null);
  const newsletterEditorFormRef = useRef<HTMLDivElement>(null);
  const subjectInputRef = useRef<HTMLInputElement>(null);
  const replaceImageInputRef = useRef<HTMLInputElement>(null);

  const [editImageOpen, setEditImageOpen] = useState(false);
  const [editImageSrc, setEditImageSrc] = useState("");
  const [editImageIndex, setEditImageIndex] = useState(0);
  const [editImageNewUrl, setEditImageNewUrl] = useState("");

  // Category dialog
  const [showCategoryDialog, setShowCategoryDialog] = useState(false);
  const [categoryName, setCategoryName] = useState("");
  const [categoryColor, setCategoryColor] = useState("#8b5cf6");
  const [categoryDescription, setCategoryDescription] = useState("");
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);

  // Subscriber dialog
  const [showAddSubscriberDialog, setShowAddSubscriberDialog] = useState(false);
  const [subscriberEmail, setSubscriberEmail] = useState("");
  const [subscriberFirstName, setSubscriberFirstName] = useState("");
  const [subscriberLastName, setSubscriberLastName] = useState("");
  const [subscriberCompany, setSubscriberCompany] = useState("");
  const [subscriberCategoryIds, setSubscriberCategoryIds] = useState<string[]>([]);

  // Import from CRM dialog
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [importCategoryIds, setImportCategoryIds] = useState<string[]>([]);
  const [importIndustryFilter, setImportIndustryFilter] = useState<string[]>([]);
  const [importSelectedIds, setImportSelectedIds] = useState<Set<string>>(new Set());
  const [importing, setImporting] = useState(false);
  const [showImportFromGroupDialog, setShowImportFromGroupDialog] = useState(false);
  const [showConfirmCleanInvalid, setShowConfirmCleanInvalid] = useState(false);
  const [showConfirmCleanFailed, setShowConfirmCleanFailed] = useState(false);
  const [showConfirmSplitMulti, setShowConfirmSplitMulti] = useState(false);
  const [cleaningInvalid, setCleaningInvalid] = useState(false);
  const [cleaningFailed, setCleaningFailed] = useState(false);
  const [splittingMulti, setSplittingMulti] = useState(false);
  const [importFromGroupCategoryIds, setImportFromGroupCategoryIds] = useState<string[]>([]);
  const [importingFromGroup, setImportingFromGroup] = useState(false);

  // Send dialog
  const [showSendDialog, setShowSendDialog] = useState(false);
  const [sendTargets, setSendTargets] = useState<string[]>([]); // ["all"] or ["cat:id", "group:id", "industry:Name", ...] (multiple allowed)
  const [sendTagIds, setSendTagIds] = useState<string[]>([]); // optional tags (categories) to narrow
  const [sendScheduleLater, setSendScheduleLater] = useState(false);
  const [sendInBatches, setSendInBatches] = useState(false);
  const [dailySendLimit, setDailySendLimit] = useState(400);
  const [sendNextBatchCount, setSendNextBatchCount] = useState(200);
  const [sendDialogScheduleDateTime, setSendDialogScheduleDateTime] = useState("");

  // Send test dialog
  const [showTestDialog, setShowTestDialog] = useState(false);
  const [testEmail, setTestEmail] = useState("");
  const [sendingTest, setSendingTest] = useState(false);

  // Schedule dialog
  const [showScheduleDialog, setShowScheduleDialog] = useState(false);
  const [scheduleDateTime, setScheduleDateTime] = useState("");
  const [scheduling, setScheduling] = useState(false);
  const [cancellingSchedule, setCancellingSchedule] = useState(false);

  // Recipients dialog (view who received / will receive a newsletter)
  type RecipientRow = { email: string; first_name: string | null; last_name: string | null; company: string | null; status?: string; sent_at?: string | null; opened_at?: string | null; clicked_at?: string | null; delivered_at?: string | null; subscriber_id?: string };
  const [recipientsDialogNewsletter, setRecipientsDialogNewsletter] = useState<Newsletter | null>(null);
  const [recipientsDialogList, setRecipientsDialogList] = useState<RecipientRow[]>([]);
  const [recipientsDialogLoading, setRecipientsDialogLoading] = useState(false);
  const [recipientsDialogShowsSentStatus, setRecipientsDialogShowsSentStatus] = useState(false);
  const [syncingFromResend, setSyncingFromResend] = useState(false);

  // Send from (email connection: Gmail, Resend, SendGrid, etc.)
  const [senderConnectionId, setSenderConnectionId] = useState("");

  // Queries
  const { data: newsletters = [], isLoading: loadingNewsletters } = useQuery({
    queryKey: ["newsletters"],
    queryFn: async () => {
      const { data: { user: u } } = await supabase.auth.getUser();
      if (!u) return [];
      const { data, error } = await supabase
        .from("newsletters")
        .select("*")
        .eq("user_id", u.id)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return (data || []) as Newsletter[];
    },
    refetchInterval: (query) => {
      const list = query.state.data as Newsletter[] | undefined;
      const hasSending = list?.some((n: Newsletter) => n.status === "sending");
      return hasSending ? 60 * 1000 : false;
    },
  });

  const { data: sentCountByNewsletterId = {} } = useQuery({
    queryKey: ["newsletter-sent-counts", newsletters.length, newsletters.map((n) => n.id).sort().join(",")],
    queryFn: async () => {
      if (newsletters.length === 0) return {};
      const ids = newsletters.map((n) => n.id);
      const { data, error } = await supabase
        .from("newsletter_sends")
        .select("newsletter_id")
        .eq("status", "sent")
        .in("newsletter_id", ids);
      if (error) return {};
      const count: Record<string, number> = {};
      (data || []).forEach((r: { newsletter_id: string }) => {
        count[r.newsletter_id] = (count[r.newsletter_id] ?? 0) + 1;
      });
      return count;
    },
    enabled: newsletters.length > 0,
  });

  const { data: categories = [], isLoading: loadingCategories } = useQuery({
    queryKey: ["newsletter-categories"],
    queryFn: async () => {
      const { data: { user: u } } = await supabase.auth.getUser();
      if (!u) return [];
      const { data, error } = await supabase
        .from("newsletter_categories")
        .select("*")
        .eq("user_id", u.id)
        .order("name");
      if (error) throw error;
      return (data || []) as Category[];
    },
  });

  const { data: subscribers = [], isLoading: loadingSubscribers } = useQuery({
    queryKey: ["newsletter-subscribers"],
    queryFn: async () => {
      const { data: { user: u } } = await supabase.auth.getUser();
      if (!u) return [];
      const { data, error } = await supabase
        .from("newsletter_subscribers")
        .select("*")
        .eq("user_id", u.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as Subscriber[];
    },
  });

  const { data: failedSubscriberIds = [] } = useQuery({
    queryKey: ["newsletter-failed-subscriber-ids"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("newsletter_sends")
        .select("subscriber_id")
        .eq("status", "failed");
      if (error) return [];
      const ids = [...new Set((data || []).map((r: { subscriber_id: string }) => r.subscriber_id))];
      return ids as string[];
    },
    enabled: view === "subscribers",
  });

  const { data: senderProfiles = [] } = useQuery({
    queryKey: ["sender-profiles-newsletter"],
    queryFn: async () => {
      const { data: { user: u } } = await supabase.auth.getUser();
      if (!u) return [];
      const { data, error } = await supabase
        .from("sender_profiles")
        .select("id, name, display_name, logo_url, brand_color, sender_name, sender_email, sender_title, sender_image_url, template_style, footer_text, signature, footer_image_url, footer_logo_url, website_url")
        .eq("user_id", u.id)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: businessProfile } = useQuery({
    queryKey: ["business-profile-newsletter"],
    queryFn: async () => {
      const { data: { user: u } } = await supabase.auth.getUser();
      if (!u) return null;
      const { data } = await supabase
        .from("business_profiles")
        .select("company_name, email_header_name, email_logo_url, email_brand_color, email_footer_text, email_footer_image_url, email_footer_logo_url, email_sender_image_url, email_sender_title, email_signature, email_template_style, email_provider, website, email_sender_name, email_sender_email, newsletter_cron_start_hour_utc, newsletter_cron_end_hour_utc, newsletter_cron_timezone")
        .eq("user_id", u.id)
        .maybeSingle();
      return data;
    },
  });

  const { data: userProfile } = useQuery({
    queryKey: ["user-profile-newsletter"],
    queryFn: async () => {
      const { data: { user: u } } = await supabase.auth.getUser();
      if (!u) return null;
      const { data } = await supabase
        .from("profiles")
        .select("full_name, job_title, avatar_url")
        .eq("id", u.id)
        .maybeSingle();
      return data;
    },
  });

  const { data: connections = [] } = useQuery({
    queryKey: ["crm-connections-newsletter"],
    queryFn: async () => {
      const { data: { user: u } } = await supabase.auth.getUser();
      if (!u) return [];
      const { data, error } = await supabase
        .from("crm_connections")
        .select("id, provider, from_email, status")
        .eq("user_id", u.id)
        .eq("status", "active")
        .in("provider", ["gmail", "gmail_direct", "resend", "sendgrid"])
        .order("created_at", { ascending: false });
      if (error) return [];
      return data || [];
    },
    enabled: view === "editor" || showTestDialog || showSendDialog,
  });

  // Prefer Gmail first (typically Inbox); Resend/SendGrid often land in Promotions
  const connectionsForSend = useMemo(() => {
    const list = [...connections];
    const rank = (p: string) => (p === "gmail" || p === "gmail_direct" ? 0 : p === "resend" ? 1 : p === "sendgrid" ? 2 : 3);
    return list.sort((a: { provider: string }, b: { provider: string }) => rank(a.provider) - rank(b.provider));
  }, [connections]);

  useEffect(() => {
    if (connectionsForSend.length > 0 && !senderConnectionId) {
      setSenderConnectionId(connectionsForSend[0].id);
    }
  }, [connectionsForSend, senderConnectionId]);

  useEffect(() => {
    const bp = businessProfile as { newsletter_cron_start_hour_utc?: number | null; newsletter_cron_end_hour_utc?: number | null; newsletter_cron_timezone?: string | null } | undefined;
    if (bp) {
      if (bp.newsletter_cron_start_hour_utc != null) setCronStartHourUtc(Math.max(0, Math.min(23, bp.newsletter_cron_start_hour_utc)));
      if (bp.newsletter_cron_end_hour_utc != null) setCronEndHourUtc(Math.max(0, Math.min(23, bp.newsletter_cron_end_hour_utc)));
      if (bp.newsletter_cron_timezone != null && String(bp.newsletter_cron_timezone).trim()) setCronTimezone(String(bp.newsletter_cron_timezone).trim());
      else setCronTimezone("");
    }
  }, [businessProfile]);

  const isGmailSendConnection = useMemo(() => {
    const id = senderConnectionId || (connectionsForSend[0] as { id: string; provider: string } | undefined)?.id;
    const conn = connectionsForSend.find((c: { id: string; provider: string }) => c.id === id);
    return conn ? ["gmail", "gmail_direct"].includes(conn.provider) : false;
  }, [senderConnectionId, connectionsForSend]);

  const { data: newsletterCategoryMap = {} } = useQuery({
    queryKey: ["newsletter-target-categories", editingId],
    queryFn: async () => {
      if (!editingId) return {};
      const { data } = await supabase
        .from("newsletter_target_categories")
        .select("category_id")
        .eq("newsletter_id", editingId);
      const map: Record<string, boolean> = {};
      (data || []).forEach((d: any) => { map[d.category_id] = true; });
      return map;
    },
    enabled: !!editingId,
  });

  const { data: subscriberCategoryMap = {} } = useQuery({
    queryKey: ["subscriber-categories-map"],
    queryFn: async () => {
      const { data } = await supabase
        .from("newsletter_subscriber_categories")
        .select("subscriber_id, category_id");
      const map: Record<string, string[]> = {};
      (data || []).forEach((d: any) => {
        if (!map[d.subscriber_id]) map[d.subscriber_id] = [];
        map[d.subscriber_id].push(d.category_id);
      });
      return map;
    },
  });

  const { data: crmIndustries = [] } = useQuery({
    queryKey: ["crm-industries-import", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data: people } = await supabase
        .from("people")
        .select("company_id")
        .eq("user_id", user.id)
        .not("email", "is", null);
      const companyIds = [...new Set((people || []).map((p: any) => p.company_id).filter(Boolean))];
      if (companyIds.length === 0) return [];
      const { data: companies } = await supabase
        .from("companies")
        .select("industry")
        .in("id", companyIds)
        .eq("user_id", user.id);
      const industries = [...new Set((companies || []).map((c: any) => c?.industry).filter(Boolean))].sort();
      return industries as string[];
    },
    enabled: !!user?.id && showImportDialog,
  });

  const { data: crmPeopleForImport = [], isLoading: loadingCrmPeople } = useQuery({
    queryKey: ["crm-people-for-import", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("people")
        .select("id, email, first_name, last_name, company_id, companies(name, industry)")
        .eq("user_id", user.id)
        .not("email", "is", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as { id: string; email: string; first_name: string | null; last_name: string | null; company_id: string | null; companies: { name: string | null; industry: string | null } | null }[];
    },
    enabled: !!user?.id && showImportDialog,
  });

  const importDisplayPeople = importIndustryFilter.length === 0
    ? crmPeopleForImport
    : crmPeopleForImport.filter((p: any) => {
        const ind = p.companies?.industry;
        return ind && importIndustryFilter.includes(ind);
      });

  useEffect(() => {
    if (showImportDialog && crmPeopleForImport.length > 0) {
      setImportSelectedIds(prev => prev.size === 0 ? new Set(crmPeopleForImport.map(p => p.id)) : prev);
    }
  }, [showImportDialog, crmPeopleForImport]);

  const { data: recipientGroups = [] } = useQuery({
    queryKey: ["recipient-groups"],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase.from("recipient_groups").select("id, name, description, created_at").eq("user_id", user.id).order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const handleImportFromGroup = async (groupId: string) => {
    if (!user) return;
    setImportingFromGroup(true);
    try {
      const { data: members, error: membersError } = await supabase.from("recipient_group_members").select("email, first_name, last_name, company").eq("group_id", groupId);
      if (membersError || !members?.length) {
        toast({ title: "Error", description: members?.length === 0 ? "Group is empty" : "Failed to load group", variant: "destructive" });
        return;
      }
      let imported = 0;
      for (const m of members as { email: string; first_name: string | null; last_name: string | null; company: string | null }[]) {
        if (!m.email) continue;
        const emails = [...new Set(parseCommaSeparatedEmails(m.email).filter(isValidNewsletterEmail))];
        for (const email of emails) {
          const { data: sub, error: insertError } = await supabase
            .from("newsletter_subscribers")
            .upsert({
              user_id: user.id,
              email,
              first_name: m.first_name || null,
              last_name: m.last_name || null,
              company: m.company || null,
              source: "recipient_group",
            }, { onConflict: "user_id,email" })
            .select("id")
            .single();
          if (!insertError && sub && importFromGroupCategoryIds.length > 0) {
            for (const catId of importFromGroupCategoryIds) {
              await supabase.from("newsletter_subscriber_categories").upsert({ subscriber_id: sub.id, category_id: catId }, { onConflict: "subscriber_id,category_id" });
            }
          }
          if (!insertError) imported++;
        }
      }
      queryClient.invalidateQueries({ queryKey: ["newsletter-subscribers"] });
      queryClient.invalidateQueries({ queryKey: ["subscriber-categories-map"] });
      setShowImportFromGroupDialog(false);
      setImportFromGroupCategoryIds([]);
      toast({ title: "Imported", description: `${imported} subscribers added from group (one per valid email).` });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setImportingFromGroup(false);
    }
  };

  useEffect(() => {
    if (editingId && newsletterCategoryMap) {
      setSelectedCategoryIds(Object.keys(newsletterCategoryMap));
    }
  }, [editingId, newsletterCategoryMap]);

  const activeSubscribers = subscribers.filter(s => s.status === "active");

  // ---------- NEWSLETTER CRUD ----------

  const openNewNewsletter = () => {
    setEditingId(null);
    setTitle("");
    setSubject("");
    setBodyHtml("");
    setCtaText("Learn More");
    setCtaUrl("");
    setSenderProfileId("");
    setTemplateStyle("professional");
    setHeaderImageUrl("");
    setSelectedCategoryIds([]);
    setView("editor");
  };

  const openEditNewsletter = (nl: Newsletter) => {
    setEditingId(nl.id);
    setTitle(nl.title);
    setSubject(nl.subject);
    setBodyHtml(nl.body_html || "");
    setCtaText(nl.cta_text || "");
    setCtaUrl(nl.cta_url || "");
    setSenderProfileId(nl.sender_profile_id || "");
    setTemplateStyle((nl.template_style || "professional") as EmailTemplateStyle);
    setHeaderImageUrl(nl.header_image_url || "");
    setSelectedCategoryIds([]);
    setView("editor");
  };

  const handleSaveNewsletter = async (): Promise<string | null> => {
    if (!user) return null;
    try {
      setSaving(true);
      const payload = {
        title: title.trim() || "Untitled Newsletter",
        subject: subject.trim(),
        body_html: bodyHtml,
        cta_text: ctaText.trim() || null,
        cta_url: ctaUrl.trim() || null,
        sender_profile_id: senderProfileId || null,
        template_style: templateStyle,
        header_image_url: headerImageUrl.trim() || null,
        updated_at: new Date().toISOString(),
      };

      let newsletterId = editingId;
      if (editingId) {
        const { error } = await supabase.from("newsletters").update(payload).eq("id", editingId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("newsletters").insert({ ...payload, user_id: user.id }).select("id").single();
        if (error) throw error;
        newsletterId = data.id;
        setEditingId(data.id);
      }

      if (newsletterId) {
        await supabase.from("newsletter_target_categories").delete().eq("newsletter_id", newsletterId);
        if (selectedCategoryIds.length > 0) {
          await supabase.from("newsletter_target_categories").insert(
            selectedCategoryIds.map(cid => ({ newsletter_id: newsletterId!, category_id: cid }))
          );
        }
      }

      queryClient.invalidateQueries({ queryKey: ["newsletters"] });
      queryClient.invalidateQueries({ queryKey: ["newsletter-target-categories"] });
      toast({ title: "Saved", description: "Newsletter saved as draft." });
      return newsletterId;
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
      return null;
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteNewsletter = async (id: string) => {
    if (!confirm("Delete this newsletter?")) return;
    const { error } = await supabase.from("newsletters").delete().eq("id", id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      queryClient.invalidateQueries({ queryKey: ["newsletters"] });
      toast({ title: "Deleted" });
    }
  };

  const handleDuplicate = async (nl: Newsletter) => {
    if (!user) return;
    const { error } = await supabase.from("newsletters").insert({
      user_id: user.id,
      title: `${nl.title} (Copy)`,
      subject: nl.subject,
      body_html: nl.body_html,
      cta_text: nl.cta_text,
      cta_url: nl.cta_url,
      sender_profile_id: nl.sender_profile_id,
      template_style: nl.template_style,
      header_image_url: nl.header_image_url || null,
    });
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      queryClient.invalidateQueries({ queryKey: ["newsletters"] });
      toast({ title: "Duplicated" });
    }
  };

  // ---------- IMAGE UPLOAD ----------

  const handleNewsletterImageUpload = async (file: File) => {
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "File too large", description: "Please select an image under 5MB.", variant: "destructive" });
      return;
    }
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!validTypes.includes(file.type)) {
      toast({ title: "Invalid file type", description: "JPG, PNG, WEBP, or GIF only.", variant: "destructive" });
      return;
    }
    try {
      setUploadingImage(true);
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) throw new Error("Not authenticated");
      const fileExt = file.name.split('.').pop();
      const fileName = `${authUser.id}/newsletter-images/${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from('email-branding').upload(fileName, file, { upsert: true });
      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from('email-branding').getPublicUrl(fileName);

      // Replace first image placeholder if present; otherwise insert into rich editor or append HTML
      if (bodyHtml.includes('newsletter-image-slot')) {
        const imgTag = `<div style="text-align:center;margin:16px 0;"><img src="${data.publicUrl}" alt="" style="max-width:100%;height:auto;border-radius:8px;" /></div>`;
        setBodyHtml(prev => prev.replace(/<div class="newsletter-image-slot"[^>]*>.*?<\/div>/, imgTag));
      } else {
        newsletterBodyEditorRef.current?.insertImage(data.publicUrl);
      }
      toast({ title: "Image inserted", description: "Image added to the newsletter body." });
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message || "Failed to upload image.", variant: "destructive" });
    } finally {
      setUploadingImage(false);
    }
  };

  const replaceNthImage = (html: string, index: number, newSrc: string | null): string => {
    const imgRegex = /<img[^>]*>/gi;
    let i = 0;
    return html.replace(imgRegex, (match) => {
      if (i++ === index) {
        if (newSrc === null) return "";
        const safe = newSrc.replace(/"/g, "&quot;");
        return match.replace(/src\s*=\s*["'][^"']*["']/i, `src="${safe}"`);
      }
      return match;
    });
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
      setUploadingImage(true);
      if (!user?.id) throw new Error("Not authenticated");
      const ext = file.name.split(".").pop() || "jpg";
      const fileName = `${user.id}/newsletter-header/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from("email-branding").upload(fileName, file, { upsert: true });
      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from("email-branding").getPublicUrl(fileName);
      setHeaderImageUrl(data.publicUrl);
      toast({ title: "Header image uploaded" });
    } catch (err: any) {
      toast({ title: "Upload failed", description: err?.message || "Failed to upload.", variant: "destructive" });
    } finally {
      setUploadingImage(false);
    }
  };

  const handleReplaceImageByUpload = async (file: File) => {
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
      setUploadingImage(true);
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) throw new Error("Not authenticated");
      const fileExt = file.name.split(".").pop();
      const fileName = `${authUser.id}/newsletter-images/${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from("email-branding").upload(fileName, file, { upsert: true });
      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from("email-branding").getPublicUrl(fileName);
      setBodyHtml(prev => replaceNthImage(prev, editImageIndex, data.publicUrl));
      setEditImageOpen(false);
      toast({ title: "Image updated", description: "Image replaced in the newsletter body." });
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message || "Failed to upload.", variant: "destructive" });
    } finally {
      setUploadingImage(false);
    }
  };

  // ---------- AI GENERATION ----------

  const handleAIGenerate = async () => {
    if (!aiTopic.trim()) {
      toast({ title: "Enter a topic", description: "Tell the AI what your newsletter should be about.", variant: "destructive" });
      return;
    }
    try {
      setGenerating(true);
      const { data, error } = await supabase.functions.invoke("generate-email-with-ai", {
        body: {
          prompt: `Write a marketing newsletter email about: ${aiTopic}. 
Target audience: ${aiTargetAudience || "business professionals"}.
Tone: ${aiTone}.
Company: ${businessProfile?.company_name || "our company"}.

The newsletter should:
- Have an engaging opening that hooks the reader
- Include 2-3 key points or use cases
- Be informative and valuable to the reader
- End with a compelling reason to take action
- Be 200-400 words
- Use HTML formatting with <p>, <h3>, <strong>, <ul>/<li> tags
- Do NOT include subject line or signature

Return ONLY the HTML body content.`,
          context: "newsletter",
        },
      });
      if (error) throw error;
      if (data?.generatedEmail) {
        setBodyHtml(data.generatedEmail);
        if (!subject) {
          setSubject(aiTopic.length > 60 ? aiTopic.substring(0, 57) + "..." : aiTopic);
        }
        toast({ title: "Generated", description: "AI newsletter content is ready. Edit as needed." });
      }
    } catch (err: any) {
      toast({ title: "AI Error", description: err.message, variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  // ---------- CATEGORIES ----------

  const handleSaveCategory = async () => {
    if (!user || !categoryName.trim()) return;
    try {
      if (editingCategoryId) {
        const { error } = await supabase.from("newsletter_categories").update({
          name: categoryName.trim(),
          color: categoryColor,
          description: categoryDescription.trim() || null,
        }).eq("id", editingCategoryId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("newsletter_categories").insert({
          user_id: user.id,
          name: categoryName.trim(),
          color: categoryColor,
          description: categoryDescription.trim() || null,
        });
        if (error) throw error;
      }
      queryClient.invalidateQueries({ queryKey: ["newsletter-categories"] });
      setShowCategoryDialog(false);
      setCategoryName("");
      setCategoryColor("#8b5cf6");
      setCategoryDescription("");
      setEditingCategoryId(null);
      toast({ title: "Saved" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleDeleteCategory = async (id: string) => {
    if (!confirm("Delete this category?")) return;
    await supabase.from("newsletter_categories").delete().eq("id", id);
    queryClient.invalidateQueries({ queryKey: ["newsletter-categories"] });
  };

  // ---------- SUBSCRIBERS ----------

  const handleAddSubscriber = async () => {
    if (!user || !subscriberEmail.trim()) return;
    try {
      const emails = [...new Set(parseCommaSeparatedEmails(subscriberEmail).filter(isValidNewsletterEmail))];
      if (emails.length === 0) {
        toast({ title: "No valid emails", description: "Enter at least one valid email address.", variant: "destructive" });
        return;
      }
      let added = 0;
      for (const email of emails) {
        const { data, error } = await supabase.from("newsletter_subscribers").upsert({
          user_id: user.id,
          email,
          first_name: subscriberFirstName.trim() || null,
          last_name: subscriberLastName.trim() || null,
          company: subscriberCompany.trim() || null,
          source: "manual",
        }, { onConflict: "user_id,email" }).select("id").single();
        if (error) throw error;
        if (data && subscriberCategoryIds.length > 0) {
          await supabase.from("newsletter_subscriber_categories").upsert(
            subscriberCategoryIds.map(cid => ({ subscriber_id: data.id, category_id: cid })),
            { onConflict: "subscriber_id,category_id" }
          );
        }
        added++;
      }
      queryClient.invalidateQueries({ queryKey: ["newsletter-subscribers"] });
      queryClient.invalidateQueries({ queryKey: ["subscriber-categories-map"] });
      setShowAddSubscriberDialog(false);
      setSubscriberEmail("");
      setSubscriberFirstName("");
      setSubscriberLastName("");
      setSubscriberCompany("");
      setSubscriberCategoryIds([]);
      toast({ title: "Added", description: added === 1 ? "Subscriber added." : `${added} subscribers added (one per email).` });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleDeleteSubscriber = async (id: string) => {
    if (!confirm("Remove this subscriber?")) return;
    await supabase.from("newsletter_subscribers").delete().eq("id", id);
    queryClient.invalidateQueries({ queryKey: ["newsletter-subscribers"] });
  };

  const invalidSubscribers = useMemo(() => subscribers.filter(s => isSubscriberEmailInvalid(s.email)), [subscribers]);
  const multiEmailSubscribers = useMemo(
    () => subscribers.filter(s => hasMultipleEmailsOnOneLine(s.email)),
    [subscribers]
  );
  const failedSubscribersToRemove = useMemo(() => {
    const set = new Set(failedSubscriberIds);
    return subscribers.filter(s => set.has(s.id));
  }, [subscribers, failedSubscriberIds]);

  const handleCleanInvalidEmails = async () => {
    if (invalidSubscribers.length === 0) return;
    setCleaningInvalid(true);
    try {
      for (const sub of invalidSubscribers) {
        await supabase.from("newsletter_subscribers").delete().eq("id", sub.id);
      }
      queryClient.invalidateQueries({ queryKey: ["newsletter-subscribers"] });
      queryClient.invalidateQueries({ queryKey: ["subscriber-categories-map"] });
      setShowConfirmCleanInvalid(false);
      toast({ title: "List cleaned", description: `Removed ${invalidSubscribers.length} invalid email(s).` });
    } catch (err: any) {
      toast({ title: "Error", description: err?.message || "Failed to remove invalid emails", variant: "destructive" });
    } finally {
      setCleaningInvalid(false);
    }
  };

  const handleCleanFailedEmails = async () => {
    if (failedSubscribersToRemove.length === 0) return;
    setCleaningFailed(true);
    try {
      for (const sub of failedSubscribersToRemove) {
        await supabase.from("newsletter_subscribers").delete().eq("id", sub.id);
      }
      queryClient.invalidateQueries({ queryKey: ["newsletter-subscribers"] });
      queryClient.invalidateQueries({ queryKey: ["subscriber-categories-map"] });
      queryClient.invalidateQueries({ queryKey: ["newsletter-failed-subscriber-ids"] });
      setShowConfirmCleanFailed(false);
      toast({ title: "List cleaned", description: `Removed ${failedSubscribersToRemove.length} subscriber(s) with failed sends.` });
    } catch (err: any) {
      toast({ title: "Error", description: err?.message || "Failed to remove failed subscribers", variant: "destructive" });
    } finally {
      setCleaningFailed(false);
    }
  };

  const handleSplitMultiEmailRows = async () => {
    if (!user || multiEmailSubscribers.length === 0) return;
    setSplittingMulti(true);
    try {
      let rowsSplit = 0;
      let newEmailsCreated = 0;
      for (const sub of multiEmailSubscribers) {
        const emails = [...new Set(parseCommaSeparatedEmails(sub.email).filter(isValidNewsletterEmail))];
        for (const email of emails) {
          const { data: newSub, error: upsertErr } = await supabase
            .from("newsletter_subscribers")
            .upsert(
              {
                user_id: user.id,
                email,
                first_name: sub.first_name ?? null,
                last_name: sub.last_name ?? null,
                company: sub.company ?? null,
                industry: sub.industry ?? null,
                source: sub.source,
              },
              { onConflict: "user_id,email" }
            )
            .select("id")
            .single();
          if (!upsertErr && newSub) {
            newEmailsCreated++;
            const catIds = subscriberCategoryMap[sub.id] || [];
            for (const catId of catIds) {
              await supabase.from("newsletter_subscriber_categories").upsert(
                { subscriber_id: newSub.id, category_id: catId },
                { onConflict: "subscriber_id,category_id" }
              );
            }
          }
        }
        await supabase.from("newsletter_subscribers").delete().eq("id", sub.id);
        rowsSplit++;
      }
      queryClient.invalidateQueries({ queryKey: ["newsletter-subscribers"] });
      queryClient.invalidateQueries({ queryKey: ["subscriber-categories-map"] });
      setShowConfirmSplitMulti(false);
      toast({ title: "Split complete", description: `${rowsSplit} row(s) split into separate emails (${newEmailsCreated} total addresses).` });
    } catch (err: any) {
      toast({ title: "Error", description: err?.message || "Failed to split rows", variant: "destructive" });
    } finally {
      setSplittingMulti(false);
    }
  };

  const runImportPeople = async (toImport: { email: string; first_name: string | null; last_name: string | null; company_id: string | null; companies?: { name: string | null; industry: string | null } | null }[]) => {
    if (!user) return 0;
    const companyIds = [...new Set(toImport.map(p => p.company_id).filter(Boolean))];
    let companyMap: Record<string, { name: string; industry: string | null }> = {};
    if (companyIds.length > 0) {
      const { data: companies } = await supabase
        .from("companies")
        .select("id, name, industry")
        .in("id", companyIds);
      (companies || []).forEach((c: any) => { companyMap[c.id] = { name: c.name, industry: c.industry ?? null }; });
    }
    let imported = 0;
    for (const p of toImport) {
      if (!p.email) continue;
      const companyInfo = p.company_id ? companyMap[p.company_id] : null;
      const companyName = companyInfo?.name ?? (p.companies as any)?.name ?? null;
      const industry = companyInfo?.industry ?? (p.companies as any)?.industry ?? null;
      const emails = [...new Set(parseCommaSeparatedEmails(p.email).filter(isValidNewsletterEmail))];
      for (const email of emails) {
        const { data: sub, error: insertError } = await supabase
          .from("newsletter_subscribers")
          .upsert({
            user_id: user.id,
            email: email.toLowerCase(),
            first_name: p.first_name || null,
            last_name: p.last_name || null,
            company: companyName,
            industry: industry || null,
            source: "crm",
          }, { onConflict: "user_id,email" })
          .select("id")
          .single();
        if (!insertError && sub && importCategoryIds.length > 0) {
          for (const catId of importCategoryIds) {
            await supabase.from("newsletter_subscriber_categories")
              .upsert({ subscriber_id: sub.id, category_id: catId }, { onConflict: "subscriber_id,category_id" });
          }
        }
        if (!insertError) imported++;
      }
    }
    return imported;
  };

  const handleImportAllFromPeople = async () => {
    try {
      setImporting(true);
      const count = await runImportPeople(importDisplayPeople);
      queryClient.invalidateQueries({ queryKey: ["newsletter-subscribers"] });
      queryClient.invalidateQueries({ queryKey: ["subscriber-categories-map"] });
      setShowImportDialog(false);
      setImportCategoryIds([]);
      setImportIndustryFilter([]);
      setImportSelectedIds(new Set());
      toast({ title: "Imported", description: `${count} contacts imported from People.` });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setImporting(false);
    }
  };

  const handleImportSelected = async () => {
    const toImport = importDisplayPeople.filter(p => importSelectedIds.has(p.id));
    if (toImport.length === 0) {
      toast({ title: "No selection", description: "Select at least one contact to import.", variant: "destructive" });
      return;
    }
    try {
      setImporting(true);
      const count = await runImportPeople(toImport);
      queryClient.invalidateQueries({ queryKey: ["newsletter-subscribers"] });
      queryClient.invalidateQueries({ queryKey: ["subscriber-categories-map"] });
      setShowImportDialog(false);
      setImportCategoryIds([]);
      setImportIndustryFilter([]);
      setImportSelectedIds(new Set());
      toast({ title: "Imported", description: `${count} selected contacts imported.` });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setImporting(false);
    }
  };

  // ---------- SEND ----------

  const buildSendAudiencePayload = () => {
    const useAll = sendTargets.length === 0 || sendTargets.includes("all");
    if (useAll) {
      return {
        sendToAllActive: true,
        tagCategoryIds: sendTagIds.length ? sendTagIds : undefined,
        sender_connection_id: senderConnectionId || undefined,
      };
    }
    const categoryFilters: string[] = [];
    const recipientGroupIds: string[] = [];
    const industryFilter: string[] = [];
    for (const t of sendTargets) {
      if (t.startsWith("cat:")) categoryFilters.push(t.slice(5));
      else if (t.startsWith("group:")) recipientGroupIds.push(t.slice(6));
      else if (t.startsWith("industry:")) industryFilter.push(decodeURIComponent(t.slice(9)));
    }
    return {
      categoryFilters: categoryFilters.length ? categoryFilters : undefined,
      recipientGroupIds: recipientGroupIds.length ? recipientGroupIds : undefined,
      industryFilter: industryFilter.length ? industryFilter : undefined,
      tagCategoryIds: sendTagIds.length ? sendTagIds : undefined,
      sender_connection_id: senderConnectionId || undefined,
    };
  };

  const handleSendNewsletter = async () => {
    if (!user) return;
    setSending(true);
    const id = await handleSaveNewsletter();
    if (!id) {
      setSending(false);
      return;
    }

    const payload = buildSendAudiencePayload();
    const currentNewsletter = newsletters.find((n) => n.id === id);
    const isAlreadySending = currentNewsletter?.status === "sending";
    const effectiveConnectionId = senderConnectionId || (connectionsForSend[0] as { id: string } | undefined)?.id;
    const sendPromise = supabase.functions.invoke("send-newsletter", {
      body: {
        newsletterId: id,
        ...payload,
        sender_connection_id: effectiveConnectionId || undefined,
        sendInBatches: sendInBatches,
        batchSize: isAlreadySending ? Math.max(1, Math.min(10000, sendNextBatchCount || 200)) : (sendInBatches ? 50 : undefined),
        dailySendLimit: sendInBatches && isGmailSendConnection ? dailySendLimit : undefined,
        continueBatch: isAlreadySending,
      },
    });

    // Close dialog and let send run in background; progress on newsletter list and View recipients
    setShowSendDialog(false);
    setSending(false);
    toast({
      title: "Sending in background",
      description: "You can keep working. Progress on the newsletter card; use View recipients for details. We'll notify you if something goes wrong.",
    });

    sendPromise
      .then(async ({ data, error }) => {
        queryClient.invalidateQueries({ queryKey: ["newsletters"] });
        queryClient.invalidateQueries({ queryKey: ["newsletter-subscribers"] });
        if (error) {
          let msg: string = (data as any)?.error ?? (error as Error)?.message ?? "Edge function error";
          const ctx = (error as { context?: Response })?.context;
          if (ctx && typeof (ctx as Response).json === "function") {
            try {
              const body = await (ctx as Response).json();
              if (body && typeof body === "object" && typeof body.error === "string") msg = body.error;
            } catch (_) {}
          }
          const isTimeoutOrNetwork = /failed to send a request|timeout|network|edge function/i.test(msg);
          toast({
            title: isTimeoutOrNetwork ? "Emails sent" : "Newsletter send failed",
            description: isTimeoutOrNetwork ? "Check View recipients for who received it and tracking. Your Resend or Gmail dashboard also shows delivery status." : msg,
            ...(isTimeoutOrNetwork ? {} : { variant: "destructive" as const }),
          });
          return;
        }
        if (data?.error) {
          toast({ title: "Newsletter send failed", description: data.error, variant: "destructive" });
          return;
        }
        const sent = data?.sent ?? data?.recipientCount ?? 0;
        const batchNote = isAlreadySending
          ? " Only not-yet-sent recipients were included."
          : sendInBatches
            ? " First 50 sent; next 50 every 15 min (see newsletter card for progress)."
            : "";
        toast({ title: "Batch sent", description: `Sent to ${sent} recipients.${batchNote}` });
      })
      .catch((err: any) => {
        queryClient.invalidateQueries({ queryKey: ["newsletters"] });
        const msg = err?.message ?? "Send failed";
        const isTimeoutOrNetwork = /failed to send a request|timeout|network|edge function/i.test(msg);
        toast({
          title: isTimeoutOrNetwork ? "Emails sent" : "Newsletter send failed",
          description: isTimeoutOrNetwork ? "Check View recipients for who received it and tracking. Your Resend or Gmail dashboard also shows delivery status." : msg,
          ...(isTimeoutOrNetwork ? {} : { variant: "destructive" as const }),
        });
      });
  };

  const handleScheduleNewsletter = async (opts?: { scheduled_send_options?: Record<string, unknown> }) => {
    const dateTime = showSendDialog ? sendDialogScheduleDateTime : scheduleDateTime;
    if (!dateTime.trim() || !user) return;
    const at = new Date(dateTime);
    if (isNaN(at.getTime()) || at <= new Date()) {
      toast({ title: "Invalid time", description: "Choose a future date and time.", variant: "destructive" });
      return;
    }
    try {
      setScheduling(true);
      const id = await handleSaveNewsletter();
      if (!id) return;
      const scheduled_send_options = opts?.scheduled_send_options ?? null;
      const { error } = await supabase
        .from("newsletters")
        .update({
          status: "scheduled",
          scheduled_at: at.toISOString(),
          ...(scheduled_send_options != null && { scheduled_send_options }),
        })
        .eq("id", id)
        .eq("user_id", user.id);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["newsletters"] });
      setShowScheduleDialog(false);
      setScheduleDateTime("");
      if (showSendDialog) {
        setShowSendDialog(false);
        setSendScheduleLater(false);
        setSendDialogScheduleDateTime("");
      }
      toast({ title: "Scheduled", description: `Newsletter will send at ${formatInLondon(at)}.` });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setScheduling(false);
    }
  };

  const handleScheduleFromSendDialog = () => {
    const useAll = sendTargets.length === 0 || sendTargets.includes("all");
    const categoryFilters: string[] = [];
    const recipientGroupIds: string[] = [];
    const industryFilter: string[] = [];
    if (!useAll) {
      for (const t of sendTargets) {
        if (t.startsWith("cat:")) categoryFilters.push(t.slice(5));
        else if (t.startsWith("group:")) recipientGroupIds.push(t.slice(6));
        else if (t.startsWith("industry:")) industryFilter.push(decodeURIComponent(t.slice(9)));
      }
    }
    const scheduled_send_options: Record<string, unknown> = {};
    if (useAll) scheduled_send_options.sendToAllActive = true;
    if (categoryFilters.length) scheduled_send_options.categoryFilters = categoryFilters;
    if (recipientGroupIds.length) scheduled_send_options.recipientGroupIds = recipientGroupIds;
    if (industryFilter.length) scheduled_send_options.industryFilter = industryFilter;
    if (sendTagIds.length) scheduled_send_options.tagCategoryIds = sendTagIds;
    if (senderConnectionId) scheduled_send_options.sender_connection_id = senderConnectionId;
    handleScheduleNewsletter({ scheduled_send_options });
  };

  const handleCancelSchedule = async (newsletterId: string) => {
    if (!user) return;
    try {
      setCancellingSchedule(true);
      const { error } = await supabase
        .from("newsletters")
        .update({ status: "draft", scheduled_at: null, scheduled_send_options: null })
        .eq("id", newsletterId)
        .eq("user_id", user.id);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["newsletters"] });
      toast({ title: "Schedule cancelled", description: "Newsletter is back to draft." });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setCancellingSchedule(false);
    }
  };

  const openRecipientsDialog = async (nl: Newsletter) => {
    setRecipientsDialogNewsletter(nl);
    setRecipientsDialogList([]);
    setRecipientsDialogLoading(true);
    setRecipientsDialogShowsSentStatus(false);
    try {
      // Refetch newsletter so we have latest status (sending/sent) and scheduled_send_options
      const { data: freshNl } = await supabase
        .from("newsletters")
        .select("*")
        .eq("id", nl.id)
        .eq("user_id", user?.id ?? "")
        .single();
      if (freshNl) {
        nl = freshNl as Newsletter;
        setRecipientsDialogNewsletter(nl);
      }

      const opts = (nl.scheduled_send_options || {}) as Record<string, unknown>;
      const sendToAllActive = opts.sendToAllActive === true;
      const categoryFilters = (opts.categoryFilters as string[] || []).filter(Boolean);
      const recipientGroupIds = (opts.recipientGroupIds as string[] || []).filter(Boolean);
      const industryFilter = ((opts.industryFilter as string[] || []) as string[]).map((i: string) => String(i).trim().toLowerCase()).filter(Boolean);

      const hasStoredAudience = sendToAllActive || recipientGroupIds.length > 0 || categoryFilters.length > 0 || industryFilter.length > 0;

      // If we have any send history for this newsletter, show Sent vs Pending (even if status not yet updated)
      const { data: sendsForHistory } = await supabase
        .from("newsletter_sends")
        .select("subscriber_id, sent_at, status, opened_at, clicked_at, delivered_at")
        .eq("newsletter_id", nl.id);
      const hasSendHistory = (sendsForHistory?.length ?? 0) > 0;

      // For "sending" (batch), "sent" with stored audience, or any send history: show full audience with Sent vs Pending
      if (hasSendHistory || (nl.status === "sending") || (nl.status === "sent" && hasStoredAudience)) {
        const sends = sendsForHistory ?? [];
        const sendMap: Record<string, { status: string; sent_at: string | null; opened_at?: string | null; clicked_at?: string | null; delivered_at?: string | null }> = {};
        (sends || []).forEach((s: any) => {
          sendMap[s.subscriber_id] = { status: s.status || "sent", sent_at: s.sent_at ?? null, opened_at: s.opened_at ?? null, clicked_at: s.clicked_at ?? null, delivered_at: s.delivered_at ?? null };
        });

        // Resolve full audience (same as draft/scheduled) so we can show Sent vs Pending
        let fullList: RecipientRow[] = [];
        if (recipientGroupIds.length > 0) {
          const groupEmails = new Map<string, { email: string; first_name: string | null; last_name: string | null; company: string | null }>();
          for (const gid of recipientGroupIds) {
            const { data: members } = await supabase.from("recipient_group_members").select("email, first_name, last_name, company").eq("group_id", gid);
            (members || []).forEach((m: any) => {
              const email = m.email ? String(m.email).trim().toLowerCase() : "";
              if (email && !groupEmails.has(email)) groupEmails.set(email, { email, first_name: m.first_name ?? null, last_name: m.last_name ?? null, company: m.company ?? null });
            });
          }
          const emails = [...groupEmails.keys()];
          const { data: subsByEmail } = await supabase.from("newsletter_subscribers").select("id, email, first_name, last_name, company").eq("user_id", user?.id ?? "").eq("status", "active");
          const emailToSub = Object.fromEntries(((subsByEmail || []) as { id: string; email: string }[]).map(s => [s.email.trim().toLowerCase(), s]));
          fullList = Array.from(groupEmails.entries()).map(([email, info]) => {
            const sub = emailToSub[email];
            return {
              email: info.email,
              first_name: info.first_name,
              last_name: info.last_name,
              company: info.company,
              subscriber_id: sub?.id,
              status: sub ? (sendMap[sub.id]?.status ?? "pending") : "pending",
              sent_at: sub ? (sendMap[sub.id]?.sent_at ?? null) : null,
              opened_at: sub ? (sendMap[sub.id]?.opened_at ?? null) : null,
              clicked_at: sub ? (sendMap[sub.id]?.clicked_at ?? null) : null,
              delivered_at: sub ? (sendMap[sub.id]?.delivered_at ?? null) : null,
            };
          });
          if (sendToAllActive) {
            const inGroup = new Set(emails);
            const onlyInSubs = activeSubscribers.filter(s => !inGroup.has(s.email.trim().toLowerCase())).map(s => ({
              email: s.email,
              first_name: s.first_name,
              last_name: s.last_name,
              company: s.company,
              subscriber_id: s.id,
              status: sendMap[s.id]?.status ?? "pending",
              sent_at: sendMap[s.id]?.sent_at ?? null,
              opened_at: sendMap[s.id]?.opened_at ?? null,
              clicked_at: sendMap[s.id]?.clicked_at ?? null,
              delivered_at: sendMap[s.id]?.delivered_at ?? null,
            }));
            fullList = [...fullList, ...onlyInSubs];
          }
        } else {
          let subset = activeSubscribers;
          if (categoryFilters.length > 0 || industryFilter.length > 0) {
            const ids = new Set<string>();
            if (categoryFilters.length > 0) activeSubscribers.forEach(s => { if ((subscriberCategoryMap[s.id] || []).some((c: string) => categoryFilters.includes(c))) ids.add(s.id); });
            if (industryFilter.length > 0) activeSubscribers.forEach(s => { const ind = (s as Subscriber).industry?.trim().toLowerCase(); if (ind && industryFilter.includes(ind)) ids.add(s.id); });
            subset = activeSubscribers.filter(s => ids.has(s.id));
          } else if (!sendToAllActive) {
            const { data: targetCats } = await supabase.from("newsletter_target_categories").select("category_id").eq("newsletter_id", nl.id);
            const targetIds = (targetCats || []).map((c: any) => c.category_id);
            if (targetIds.length > 0) subset = activeSubscribers.filter(s => (subscriberCategoryMap[s.id] || []).some((cid: string) => targetIds.includes(cid)));
          }
          fullList = subset.map(s => ({
            email: s.email,
            first_name: s.first_name,
            last_name: s.last_name,
            company: s.company,
            subscriber_id: s.id,
            status: sendMap[s.id]?.status ?? "pending",
            sent_at: sendMap[s.id]?.sent_at ?? null,
            opened_at: sendMap[s.id]?.opened_at ?? null,
            clicked_at: sendMap[s.id]?.clicked_at ?? null,
            delivered_at: sendMap[s.id]?.delivered_at ?? null,
          }));
        }
        setRecipientsDialogShowsSentStatus(true);
        setRecipientsDialogList(fullList);
      } else if (nl.status === "sent") {
        // Sent without stored audience (non-batch): load only from newsletter_sends
        const { data: sends, error: sendsError } = await supabase
          .from("newsletter_sends")
          .select("subscriber_id, sent_at, status, opened_at, clicked_at, delivered_at")
          .eq("newsletter_id", nl.id)
          .order("sent_at", { ascending: true });
        if (sendsError) throw sendsError;
        if (!sends?.length) {
          setRecipientsDialogList([]);
          return;
        }
        const ids = [...new Set(sends.map((s: any) => s.subscriber_id))];
        const { data: subs, error: subsError } = await supabase
          .from("newsletter_subscribers")
          .select("id, email, first_name, last_name, company")
          .in("id", ids);
        if (subsError) throw subsError;
        const subMap = Object.fromEntries((subs || []).map((s: any) => [s.id, s]));
        const list: RecipientRow[] = sends.map((s: any) => {
          const sub = subMap[s.subscriber_id];
          return {
            email: sub?.email ?? "",
            first_name: sub?.first_name ?? null,
            last_name: sub?.last_name ?? null,
            company: sub?.company ?? null,
            status: s.status,
            sent_at: s.sent_at,
            opened_at: s.opened_at ?? null,
            clicked_at: s.clicked_at ?? null,
            delivered_at: s.delivered_at ?? null,
          };
        }).filter(r => r.email);
        setRecipientsDialogShowsSentStatus(true);
        setRecipientsDialogList(list);
      } else {
        setRecipientsDialogShowsSentStatus(false);
        // draft or scheduled: resolve audience from scheduled_send_options and/or target categories
        const opts = (nl.scheduled_send_options || {}) as Record<string, unknown>;
        const sendToAllActive = opts.sendToAllActive === true;
        const categoryFilters = (opts.categoryFilters as string[] || []).filter(Boolean);
        const recipientGroupIds = (opts.recipientGroupIds as string[] || []).filter(Boolean);
        const industryFilter = ((opts.industryFilter as string[] || []) as string[]).map((i: string) => String(i).trim().toLowerCase()).filter(Boolean);

        // When recipient groups are selected, list = all group members (matches send: group members are added to subscribers then sent)
        if (recipientGroupIds.length > 0) {
          const groupEmails = new Map<string, { email: string; first_name: string | null; last_name: string | null; company: string | null }>();
          for (const gid of recipientGroupIds) {
            const { data: members } = await supabase.from("recipient_group_members").select("email, first_name, last_name, company").eq("group_id", gid);
            (members || []).forEach((m: any) => {
              const email = m.email ? String(m.email).trim().toLowerCase() : "";
              if (email && !groupEmails.has(email)) groupEmails.set(email, { email, first_name: m.first_name ?? null, last_name: m.last_name ?? null, company: m.company ?? null });
            });
          }
          const listFromGroups = Array.from(groupEmails.values());
          if (sendToAllActive) {
            const subEmails = new Set(activeSubscribers.map(s => s.email.trim().toLowerCase()));
            const onlyInSubs = activeSubscribers.filter(s => !groupEmails.has(s.email.trim().toLowerCase())).map(s => ({ email: s.email, first_name: s.first_name, last_name: s.last_name, company: s.company }));
            setRecipientsDialogList([...listFromGroups, ...onlyInSubs]);
          } else {
            setRecipientsDialogList(listFromGroups);
          }
          return;
        }

        let subset = activeSubscribers;
        if (categoryFilters.length > 0 || industryFilter.length > 0) {
          const ids = new Set<string>();
          if (categoryFilters.length > 0) {
            activeSubscribers.forEach(s => {
              const catIds = subscriberCategoryMap[s.id] || [];
              if (categoryFilters.some(c => catIds.includes(c))) ids.add(s.id);
            });
          }
          if (industryFilter.length > 0) {
            activeSubscribers.forEach(s => {
              const ind = (s as Subscriber).industry?.trim().toLowerCase();
              if (ind && industryFilter.includes(ind)) ids.add(s.id);
            });
          }
          subset = activeSubscribers.filter(s => ids.has(s.id));
        } else if (!sendToAllActive) {
          const { data: targetCats } = await supabase.from("newsletter_target_categories").select("category_id").eq("newsletter_id", nl.id);
          const targetIds = (targetCats || []).map((c: any) => c.category_id);
          if (targetIds.length > 0) {
            subset = activeSubscribers.filter(s => (subscriberCategoryMap[s.id] || []).some((cid: string) => targetIds.includes(cid)));
          }
        }
        setRecipientsDialogList(subset.map(s => ({ email: s.email, first_name: s.first_name, last_name: s.last_name, company: s.company })));
      }
    } catch (err: any) {
      toast({ title: "Could not load recipients", description: err?.message, variant: "destructive" });
      setRecipientsDialogList([]);
    } finally {
      setRecipientsDialogLoading(false);
    }
  };

  const getRecipientStatusLabel = (r: RecipientRow) => {
    if (r.clicked_at) return "Clicked";
    if (r.opened_at) return "Opened";
    if (r.delivered_at) return "Delivered";
    return r.status === "sent" ? "Sent" : "Pending";
  };

  const handleSyncFromResend = async () => {
    const nl = recipientsDialogNewsletter;
    if (!nl?.id) return;
    setSyncingFromResend(true);
    try {
      const { data, error } = await supabase.functions.invoke("sync-resend-newsletter-status", {
        body: { newsletterId: nl.id },
      });
      if (error) throw error;
      const msg = (data as { message?: string })?.message ?? "Synced from Resend.";
      toast({ title: "Sync complete", description: msg });
      await openRecipientsDialog(nl);
    } catch (e: any) {
      toast({ title: "Sync failed", description: e?.message ?? "Could not sync from Resend.", variant: "destructive" });
    } finally {
      setSyncingFromResend(false);
    }
  };

  const handleSendTest = async () => {
    const email = testEmail.trim();
    if (!email) {
      toast({ title: "Enter an email", description: "Provide the address to send the test to.", variant: "destructive" });
      return;
    }
    try {
      setSendingTest(true);
      const id = await handleSaveNewsletter();
      if (!id) return;

      // If newsletter was left in 'sending' from a failed run, reset to draft so the Edge Function doesn't block test sends
      const { data: nl } = await supabase.from("newsletters").select("status").eq("id", id).eq("user_id", user?.id ?? "").maybeSingle();
      if (nl?.status === "sending") {
        await supabase.from("newsletters").update({ status: "draft" }).eq("id", id).eq("user_id", user?.id ?? "");
      }

      // Test-only: send ONLY to this address (no subscriber list). Send test email in multiple keys so server always sees it.
      const { data, error } = await supabase.functions.invoke("send-newsletter", {
        body: {
          newsletterId: id,
          testEmail: email,
          test_email: email,
          sender_connection_id: senderConnectionId || undefined,
        },
      });
      // Prefer server error message from response body (FunctionsHttpError.context is the Response)
      if (error) {
        let msg: string = (data as any)?.error ?? error?.message ?? "Edge Function returned a non-2xx status code";
        const ctx = (error as { context?: Response })?.context;
        if (ctx && typeof (ctx as Response).json === "function") {
          try {
            const body = await (ctx as Response).json();
            if (body && typeof body === "object" && typeof body.error === "string") msg = body.error;
          } catch (_) {}
        }
        throw new Error(msg);
      }
      if (data?.error) throw new Error(data.error);
      if (data?.test !== true && data?.sent !== 1) {
        console.warn("Send test response:", data);
      }

      setShowTestDialog(false);
      setTestEmail("");
      toast({ title: "Test sent", description: `Newsletter test sent to ${email} only.` });
    } catch (err: any) {
      const message = err?.message ?? "Could not send test.";
      toast({ title: "Test failed", description: message, variant: "destructive" });
    } finally {
      setSendingTest(false);
    }
  };

  // ---------- PREVIEW PROPS ----------

  const getPreviewProps = () => {
    const sp = senderProfiles.find((p: any) => p.id === senderProfileId);
    const bc = sp?.brand_color || businessProfile?.email_brand_color || "#8b5cf6";
    const defaultLogo = sp?.logo_url || businessProfile?.email_logo_url || undefined;
    const logo = headerImageUrl.trim() ? headerImageUrl.trim() : defaultLogo;
    const headerName = sp?.display_name || businessProfile?.email_header_name || undefined;
    const companyName = businessProfile?.company_name || undefined;
    const senderName = sp?.sender_name || userProfile?.full_name || "Your Name";
    const senderEmail = sp?.sender_email || user?.email || "";

    const fullBody = bodyHtml + (ctaText && ctaUrl ? `
      <div style="text-align:center;margin:28px 0;">
        <a href="${ctaUrl}" style="display:inline-block;padding:14px 36px;background:${bc};color:#fff;text-decoration:none;border-radius:8px;font-weight:600;font-size:16px;">${ctaText}</a>
      </div>` : "");

    return {
      template: templateStyle as EmailTemplatePreviewStyle,
      brandColor: bc,
      logoUrl: logo,
      headerName,
      companyName,
      senderName,
      senderTitle: sp?.sender_title || businessProfile?.email_sender_title || userProfile?.job_title || undefined,
      senderEmail,
      senderImageUrl: sp?.sender_image_url || businessProfile?.email_sender_image_url || userProfile?.avatar_url || undefined,
      footerText: sp?.footer_text || businessProfile?.email_footer_text || undefined,
      footerImageUrl: sp?.footer_logo_url || sp?.logo_url || businessProfile?.email_footer_logo_url || businessProfile?.email_logo_url || undefined,
      websiteUrl: sp?.website_url || businessProfile?.website || undefined,
      signature: sp?.signature || businessProfile?.email_signature || undefined,
      bodyHtml: fullBody || undefined,
      bare: true,
      showNewsletterFooter: true,
    };
  };

  // ---------- STATUS BADGE ----------

  const statusColor = (s: string) => {
    switch (s) {
      case "draft": return "secondary";
      case "sent": return "default";
      case "sending": return "outline";
      case "scheduled": return "outline";
      default: return "secondary";
    }
  };

  // ========================== RENDER ==========================

  // ── SUBSCRIBERS VIEW ──
  if (view === "subscribers") {
    return (
      <div className="max-w-full">
        <div className="container mx-auto p-6 max-w-5xl space-y-6">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => setView("list")}><ArrowLeft className="h-4 w-4" /></Button>
            <div>
              <h1 className="text-2xl font-bold">Newsletter Subscribers</h1>
              <p className="text-muted-foreground">{activeSubscribers.length} active · {subscribers.length} total</p>
            </div>
          </div>

          {/* Categories */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">Categories / Tags</CardTitle>
                  <CardDescription>Segment subscribers by industry or audience</CardDescription>
                </div>
                <Button size="sm" onClick={() => { setEditingCategoryId(null); setCategoryName(""); setCategoryColor("#8b5cf6"); setCategoryDescription(""); setShowCategoryDialog(true); }}>
                  <Plus className="h-3.5 w-3.5 mr-1" />Category
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {categories.length === 0 ? (
                <p className="text-sm text-muted-foreground">No categories yet. Create one to segment your audience.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {categories.map(cat => (
                    <Badge key={cat.id} variant="outline" className="gap-1.5 py-1 px-3 cursor-pointer hover:bg-muted"
                      onClick={() => { setEditingCategoryId(cat.id); setCategoryName(cat.name); setCategoryColor(cat.color || "#8b5cf6"); setCategoryDescription(cat.description || ""); setShowCategoryDialog(true); }}>
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: cat.color || "#8b5cf6" }} />
                      {cat.name}
                      {cat.description && <span className="text-muted-foreground ml-1">· {cat.description}</span>}
                    </Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Subscriber actions */}
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => setShowAddSubscriberDialog(true)}>
              <UserPlus className="h-4 w-4 mr-1.5" />Add Subscriber
            </Button>
            <Button variant="outline" onClick={() => setShowImportDialog(true)}>
              <Upload className="h-4 w-4 mr-1.5" />Import from CRM
            </Button>
            <Button variant="outline" onClick={() => setShowImportFromGroupDialog(true)} disabled={recipientGroups.length === 0}>
              <FolderInput className="h-4 w-4 mr-1.5" />Import from group
            </Button>
            {invalidSubscribers.length > 0 && (
              <Button variant="outline" onClick={() => setShowConfirmCleanInvalid(true)} className="text-amber-600 border-amber-300 hover:bg-amber-50">
                Remove invalid ({invalidSubscribers.length})
              </Button>
            )}
            {failedSubscribersToRemove.length > 0 && (
              <Button variant="outline" onClick={() => setShowConfirmCleanFailed(true)} className="text-red-600 border-red-300 hover:bg-red-50">
                Remove failed / bounced ({failedSubscribersToRemove.length})
              </Button>
            )}
            {multiEmailSubscribers.length > 0 && (
              <Button variant="outline" onClick={() => setShowConfirmSplitMulti(true)} className="text-blue-600 border-blue-300 hover:bg-blue-50">
                Split to one per line ({multiEmailSubscribers.length})
              </Button>
            )}
          </div>

          {/* Subscriber list */}
          <Card>
            <CardContent className="p-0">
              {loadingSubscribers ? (
                <div className="flex items-center justify-center py-12"><Loader2 className="h-5 w-5 animate-spin" /></div>
              ) : subscribers.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">No subscribers yet. Add some or import from your CRM.</div>
              ) : (
                <div className="divide-y">
                  {subscribers.map(sub => (
                    <div key={sub.id} className="flex items-center justify-between px-4 py-3 hover:bg-muted/50">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm break-all">
                            {hasMultipleEmailsOnOneLine(sub.email)
                              ? parseCommaSeparatedEmails(sub.email).map((e, i) => <span key={i}>{e}<br /></span>)
                              : sub.email}
                          </span>
                          {isSubscriberEmailInvalid(sub.email) && (
                            <Badge variant="outline" className="text-[10px] h-5 text-amber-600 border-amber-400">Invalid</Badge>
                          )}
                          {hasMultipleEmailsOnOneLine(sub.email) && (
                            <Badge variant="outline" className="text-[10px] h-5 text-blue-600 border-blue-400">
                              {isSubscriberEmailInvalid(sub.email) && hasAtLeastOneValidEmail(sub.email) ? "Multiple · split to keep valid" : "Multiple"}
                            </Badge>
                          )}
                          <Badge variant={sub.status === "active" ? "default" : "destructive"} className="text-[10px] h-5">{sub.status}</Badge>
                          <Badge variant="outline" className="text-[10px] h-5">{sub.source}</Badge>
                        </div>
                        <div className="text-xs text-muted-foreground flex gap-2 mt-0.5">
                          {sub.first_name && <span>{sub.first_name} {sub.last_name || ""}</span>}
                          {sub.company && <span>· {sub.company}</span>}
                          {(subscriberCategoryMap[sub.id] || []).map(cid => {
                            const cat = categories.find(c => c.id === cid);
                            return cat ? <Badge key={cid} variant="outline" className="text-[9px] h-4 px-1.5"><span className="h-1.5 w-1.5 rounded-full mr-1" style={{ background: cat.color || "#8b5cf6" }} />{cat.name}</Badge> : null;
                          })}
                        </div>
                      </div>
                      <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => handleDeleteSubscriber(sub.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Confirm: Remove invalid emails */}
          <AlertDialog open={showConfirmCleanInvalid} onOpenChange={setShowConfirmCleanInvalid}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Remove invalid emails?</AlertDialogTitle>
                <AlertDialogDescription className="space-y-2">
                  <span className="block">This will permanently remove {invalidSubscribers.length} subscriber(s) whose emails look invalid (e.g. wrong format or domain like .png). This helps protect your sender reputation with Gmail and Resend.</span>
                  <span className="block text-muted-foreground">Safe to do during batch sending: the next batch uses the current list, so removed addresses simply won’t receive future batches. Already-sent emails are unchanged.</span>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={cleaningInvalid}>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={(e) => { e.preventDefault(); handleCleanInvalidEmails(); }} disabled={cleaningInvalid}>
                  {cleaningInvalid ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {cleaningInvalid ? "Removing…" : "Remove invalid"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          {/* Confirm: Split multi-email to one per row */}
          <AlertDialog open={showConfirmSplitMulti} onOpenChange={setShowConfirmSplitMulti}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Split to one email per row?</AlertDialogTitle>
                <AlertDialogDescription className="space-y-2">
                  <span className="block">This will turn {multiEmailSubscribers.length} row(s) that have multiple comma-separated entries into separate subscriber rows — one valid email per row. Invalid entries (e.g. icon@2x.png, .svg) are skipped; only valid emails get a row, so you don’t lose good addresses when a row mixes valid and invalid.</span>
                  <span className="block text-muted-foreground">Duplicates in a row are merged. Existing categories are copied to each new row.</span>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={splittingMulti}>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={(e) => { e.preventDefault(); handleSplitMultiEmailRows(); }} disabled={splittingMulti}>
                  {splittingMulti ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {splittingMulti ? "Splitting…" : "Split to one per line"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          {/* Confirm: Remove failed / bounced */}
          <AlertDialog open={showConfirmCleanFailed} onOpenChange={setShowConfirmCleanFailed}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Remove failed / bounced subscribers?</AlertDialogTitle>
                <AlertDialogDescription className="space-y-2">
                  <span className="block">This will permanently remove {failedSubscribersToRemove.length} subscriber(s) who had at least one failed send (e.g. address not found, domain not found). Removing them helps keep your list clean and protects your reputation.</span>
                  <span className="block text-muted-foreground">Safe during batch sending: the next batch uses the current list; removed addresses won’t receive future batches.</span>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={cleaningFailed}>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={(e) => { e.preventDefault(); handleCleanFailedEmails(); }} disabled={cleaningFailed}>
                  {cleaningFailed ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {cleaningFailed ? "Removing…" : "Remove failed"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>

        {/* Add Subscriber Dialog */}
        <Dialog open={showAddSubscriberDialog} onOpenChange={setShowAddSubscriberDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Subscriber</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Email *</Label>
                <Input value={subscriberEmail} onChange={e => setSubscriberEmail(e.target.value)} placeholder="name@example.com or a@x.com, b@y.com" />
                <p className="text-xs text-muted-foreground">Comma-separated entries are split into one subscriber per valid email (invalid entries skipped).</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>First Name</Label>
                  <Input value={subscriberFirstName} onChange={e => setSubscriberFirstName(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Last Name</Label>
                  <Input value={subscriberLastName} onChange={e => setSubscriberLastName(e.target.value)} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Company</Label>
                <Input value={subscriberCompany} onChange={e => setSubscriberCompany(e.target.value)} />
              </div>
              {categories.length > 0 && (
                <div className="space-y-1.5">
                  <Label>Categories</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {categories.map(cat => (
                      <Badge key={cat.id} variant={subscriberCategoryIds.includes(cat.id) ? "default" : "outline"}
                        className="cursor-pointer" onClick={() => setSubscriberCategoryIds(prev => prev.includes(cat.id) ? prev.filter(x => x !== cat.id) : [...prev, cat.id])}>
                        <span className="h-2 w-2 rounded-full mr-1" style={{ background: cat.color || "#8b5cf6" }} />{cat.name}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button onClick={handleAddSubscriber} disabled={!subscriberEmail.trim()}>Add</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Import from CRM Dialog */}
        <Dialog open={showImportDialog} onOpenChange={(open) => {
          setShowImportDialog(open);
          if (!open) { setImportCategoryIds([]); setImportIndustryFilter([]); setImportSelectedIds(new Set()); }
        }}>
          <DialogContent className="sm:max-w-xl max-h-[90vh] flex flex-col">
            <DialogHeader>
              <DialogTitle>Import from People</DialogTitle>
              <DialogDescription>Import contacts from your People page. Filter by industry, assign categories, and choose to import all or only selected contacts.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2 overflow-y-auto min-h-0">
              <div className="space-y-2">
                <Label>Filter by industry (optional)</Label>
                <p className="text-xs text-muted-foreground">Limit the list below to contacts from these industries. Leave empty to show everyone.</p>
                <div className="max-h-32 overflow-y-auto rounded-md border p-3 space-y-2">
                  {crmIndustries.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No industries found in your People.</p>
                  ) : (
                    crmIndustries.map((ind) => (
                      <label key={ind} className="flex items-center gap-2 cursor-pointer">
                        <Checkbox
                          checked={importIndustryFilter.includes(ind)}
                          onCheckedChange={(checked) => setImportIndustryFilter(prev => checked ? [...prev, ind] : prev.filter(x => x !== ind))}
                        />
                        <span className="text-sm">{ind}</span>
                      </label>
                    ))
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Add to categories (optional)</Label>
                <p className="text-xs text-muted-foreground">Assign imported subscribers to these categories for targeting.</p>
                <div className="max-h-32 overflow-y-auto rounded-md border p-3 space-y-2">
                  {categories.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No categories yet. Create one under Categories above.</p>
                  ) : (
                    categories.map((cat) => (
                      <label key={cat.id} className="flex items-center gap-2 cursor-pointer">
                        <Checkbox
                          checked={importCategoryIds.includes(cat.id)}
                          onCheckedChange={(checked) => setImportCategoryIds(prev => checked ? [...prev, cat.id] : prev.filter(x => x !== cat.id))}
                        />
                        <span className="h-2 w-2 rounded-full shrink-0" style={{ background: cat.color || "#8b5cf6" }} />
                        <span className="text-sm">{cat.name}</span>
                      </label>
                    ))
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Select contacts to import</Label>
                  <div className="flex gap-2 text-xs">
                    <button
                      type="button"
                      className="text-primary hover:underline"
                      onClick={() => setImportSelectedIds(new Set(importDisplayPeople.map(p => p.id)))}
                    >
                      Select all
                    </button>
                    <span className="text-muted-foreground">|</span>
                    <button
                      type="button"
                      className="text-primary hover:underline"
                      onClick={() => setImportSelectedIds(new Set())}
                    >
                      Deselect all
                    </button>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  {importDisplayPeople.length} contact{importDisplayPeople.length !== 1 ? "s" : ""} shown
                  {importIndustryFilter.length > 0 ? " (filtered by industry)" : ""}. {importSelectedIds.size} selected.
                </p>
                <div className="max-h-48 overflow-y-auto rounded-md border p-2 space-y-1">
                  {loadingCrmPeople ? (
                    <p className="text-xs text-muted-foreground py-4 text-center">Loading people…</p>
                  ) : importDisplayPeople.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-4 text-center">No contacts with email found. Add contacts on the People page.</p>
                  ) : (
                    importDisplayPeople.map((p) => (
                      <label key={p.id} className="flex items-center gap-2 cursor-pointer py-1.5 px-2 rounded hover:bg-muted/50">
                        <Checkbox
                          checked={importSelectedIds.has(p.id)}
                          onCheckedChange={(checked) => setImportSelectedIds(prev => {
                            const next = new Set(prev);
                            if (checked) next.add(p.id); else next.delete(p.id);
                            return next;
                          })}
                        />
                        <span className="text-sm truncate flex-1">
                          {[p.first_name, p.last_name].filter(Boolean).join(" ") || p.email}
                        </span>
                        <span className="text-xs text-muted-foreground truncate max-w-[140px]">
                          {(p.companies as any)?.name || "—"}
                        </span>
                      </label>
                    ))
                  )}
                </div>
              </div>
            </div>
            <DialogFooter className="gap-2 flex-shrink-0">
              <Button variant="outline" onClick={handleImportAllFromPeople} disabled={importing || importDisplayPeople.length === 0}>
                {importing ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" />Importing…</> : <><Users className="h-4 w-4 mr-1.5" />Import all from People</>}
              </Button>
              <Button onClick={handleImportSelected} disabled={importing || importSelectedIds.size === 0}>
                {importing ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" />Importing…</> : <><Upload className="h-4 w-4 mr-1.5" />Import selected ({importSelectedIds.size})</>}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Import from recipient group (newsletter grouping) */}
        <Dialog open={showImportFromGroupDialog} onOpenChange={(open) => { setShowImportFromGroupDialog(open); if (!open) setImportFromGroupCategoryIds([]); }}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Import from recipient group</DialogTitle>
              <DialogDescription>Add all members of a saved group as newsletter subscribers. Assign categories for grouping.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>Add to categories (optional)</Label>
                <div className="max-h-32 overflow-y-auto rounded-md border p-3 space-y-2">
                  {categories.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No categories yet. Create one under Categories above.</p>
                  ) : (
                    categories.map((cat) => (
                      <label key={cat.id} className="flex items-center gap-2 cursor-pointer">
                        <Checkbox
                          checked={importFromGroupCategoryIds.includes(cat.id)}
                          onCheckedChange={(checked) => setImportFromGroupCategoryIds(prev => checked ? [...prev, cat.id] : prev.filter(x => x !== cat.id))}
                        />
                        <span className="h-2 w-2 rounded-full shrink-0" style={{ background: cat.color || "#8b5cf6" }} />
                        <span className="text-sm">{cat.name}</span>
                      </label>
                    ))
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Select a group</Label>
                {recipientGroups.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-2">No recipient groups yet. Save recipients from a campaign (Campaigns → Manage Recipients → Save as group) first.</p>
                ) : (
                  <div className="space-y-1 max-h-48 overflow-y-auto rounded-md border p-2">
                    {recipientGroups.map((g: { id: string; name: string }) => (
                      <Button key={g.id} variant="outline" size="sm" className="w-full justify-start gap-2" disabled={importingFromGroup} onClick={() => handleImportFromGroup(g.id)}>
                        {importingFromGroup ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FolderInput className="h-3.5 w-3.5" />}
                        {g.name}
                      </Button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Category Dialog */}
        <Dialog open={showCategoryDialog} onOpenChange={setShowCategoryDialog}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{editingCategoryId ? "Edit Category" : "New Category"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Name *</Label>
                <Input value={categoryName} onChange={e => setCategoryName(e.target.value)} placeholder="e.g. SaaS, Healthcare, Finance" />
              </div>
              <div className="space-y-1.5">
                <Label>Color</Label>
                <div className="flex gap-2 items-center">
                  <input type="color" value={categoryColor} onChange={e => setCategoryColor(e.target.value)} className="h-9 w-9 rounded border cursor-pointer" />
                  <Input value={categoryColor} onChange={e => setCategoryColor(e.target.value)} className="flex-1" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Description</Label>
                <Input value={categoryDescription} onChange={e => setCategoryDescription(e.target.value)} placeholder="Brief description" />
              </div>
            </div>
            <DialogFooter className="gap-2">
              {editingCategoryId && (
                <Button variant="destructive" size="sm" onClick={() => { handleDeleteCategory(editingCategoryId); setShowCategoryDialog(false); }}>Delete</Button>
              )}
              <Button onClick={handleSaveCategory} disabled={!categoryName.trim()}>Save</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // ── EDITOR VIEW ──
  if (view === "editor") {
    const pp = getPreviewProps();
    return (
      <div className="max-w-full min-w-0 overflow-x-hidden">
        <div className="container mx-auto p-6 max-w-6xl space-y-6 min-w-0">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={() => setView("list")}><ArrowLeft className="h-4 w-4" /></Button>
              <div>
                <h1 className="text-2xl font-bold">{editingId ? "Edit Newsletter" : "New Newsletter"}</h1>
                <p className="text-muted-foreground text-sm">Create and send branded newsletters to your audience</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowPreview(!showPreview)}>
                <Eye className="h-4 w-4 mr-1.5" />{showPreview ? "Hide Preview" : "Preview"}
              </Button>
              <Button variant="outline" onClick={handleSaveNewsletter} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <FileText className="h-4 w-4 mr-1.5" />}Save Draft
              </Button>
              <Button variant="outline" onClick={() => { setTestEmail(user?.email ?? ""); setShowTestDialog(true); }} disabled={!subject.trim()}>
                <FlaskConical className="h-4 w-4 mr-1.5" />Send test
              </Button>
              <Button variant="outline" onClick={() => { if (!subject.trim()) { toast({ title: "Subject required", variant: "destructive" }); return; } setSendScheduleLater(true); setSendDialogScheduleDateTime(() => { const d = new Date(); d.setMinutes(d.getMinutes() + 30); d.setSeconds(0, 0); return d.toISOString().slice(0, 16); }); setShowSendDialog(true); }} disabled={!editingId && !subject.trim()}>
                <CalendarClock className="h-4 w-4 mr-1.5" />Schedule
              </Button>
              <Button onClick={() => { if (!subject.trim()) { toast({ title: "Subject required", variant: "destructive" }); return; } setSendScheduleLater(false); setShowSendDialog(true); }} disabled={!editingId && !subject.trim()}>
                <Send className="h-4 w-4 mr-1.5" />Send
              </Button>
            </div>
          </div>

          {editingId && newsletters.find(n => n.id === editingId)?.status === "scheduled" && (
            <div className="flex items-center gap-2 rounded-lg border bg-muted/50 px-4 py-2 text-sm">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Scheduled for</span>
              <span className="font-medium">{newsletters.find(n => n.id === editingId)?.scheduled_at ? formatInLondon(newsletters.find(n => n.id === editingId)!.scheduled_at!) : ""}</span>
              <Button variant="ghost" size="sm" className="ml-2" onClick={() => handleCancelSchedule(editingId)} disabled={cancellingSchedule}>
                {cancellingSchedule ? <Loader2 className="h-3 w-3 animate-spin" /> : "Cancel schedule"}
              </Button>
            </div>
          )}

          <div className={`grid gap-6 min-w-0 ${showPreview ? "grid-cols-1 lg:grid-cols-2" : "grid-cols-1"}`}>
            {/* Left: Editor */}
            <div id="newsletter-editor-form" ref={newsletterEditorFormRef} className="space-y-5 min-w-0">
              {/* Basic fields */}
              <Card>
                <CardContent className="pt-5 space-y-4">
                  <div className="space-y-1.5">
                    <Label>Newsletter Title (internal)</Label>
                    <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. February Product Update" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Subject Line *</Label>
                    <Input ref={subjectInputRef} value={subject} onChange={e => setSubject(e.target.value)} placeholder="What your readers will see in their inbox" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>Sender Profile</Label>
                      <Select value={senderProfileId || "default"} onValueChange={v => setSenderProfileId(v === "default" ? "" : v)}>
                        <SelectTrigger><SelectValue placeholder="Choose sender" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="default">Default — {businessProfile?.company_name || "Your company"}</SelectItem>
                          {senderProfiles.map((p: any) => (
                            <SelectItem key={p.id} value={p.id}>{p.name || p.display_name || 'Unnamed profile'}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        {senderProfiles.length === 0 ? (
                          <><Link to="/email-branding" className="text-primary hover:underline">Add sender profiles in Email Branding</Link>
                          {" "}to send as different brands (e.g. TalkWeb, Biz Boosters).</>
                        ) : senderProfileId ? (
                          <>Using this profile’s logo, colors, and name; empty fields fall back to <Link to="/email-branding" className="text-primary hover:underline">default Email Branding</Link>.</>
                        ) : (
                          <>Using <Link to="/email-branding" className="text-primary hover:underline">default Email Branding</Link>.</>
                        )}
                      </p>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Template Style</Label>
                      <Select value={templateStyle} onValueChange={v => setTemplateStyle(v as EmailTemplateStyle)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {["professional", "minimal", "modern", "creative", "corporate", "bold", "elegant"].map(s => (
                            <SelectItem key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-1.5 mt-3">
                    <Label>Send from</Label>
                    <Select value={senderConnectionId || (connectionsForSend[0]?.id ?? "")} onValueChange={setSenderConnectionId}>
                      <SelectTrigger><SelectValue placeholder="Choose email account" /></SelectTrigger>
                      <SelectContent>
                        {connectionsForSend.map((conn: { id: string; provider: string; from_email?: string }) => {
                          const fromEmail = (conn.from_email || "").trim();
                          const matchProfile = senderProfiles.find((p: { sender_email?: string }) => p.sender_email && fromEmail && String(p.sender_email).toLowerCase() === fromEmail.toLowerCase());
                          const displayName = matchProfile?.display_name || matchProfile?.name || businessProfile?.company_name || "Your Business";
                          const providerLabel = conn.provider === "resend" ? "Resend" : conn.provider === "sendgrid" ? "SendGrid" : conn.provider === "gmail" || conn.provider === "gmail_direct" ? "Gmail" : conn.provider;
                          const icon = conn.provider === "resend" ? "🚀" : conn.provider === "sendgrid" ? "📬" : conn.provider === "gmail" || conn.provider === "gmail_direct" ? "📧" : "✉️";
                          return (
                            <SelectItem key={conn.id} value={conn.id}>
                              <div className="flex items-center gap-2">
                                <span>{icon}</span>
                                <div>
                                  <div className="font-medium">{providerLabel}</div>
                                  <div className="text-xs text-muted-foreground">{displayName} &lt;{fromEmail || "—"}&gt;</div>
                                </div>
                              </div>
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">Account used to send this newsletter and test emails. <strong>Gmail</strong> typically lands in Primary but is limited to ~500 emails/day; use “Send in batches” for larger lists. <strong>Resend/SendGrid</strong> often land in Promotions until domain reputation improves. Configure in <Link to="/integrations/email-providers" className="text-primary hover:underline">Settings → Email Providers</Link>.</p>
                  </div>
                </CardContent>
              </Card>

              {/* Header image (optional) */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Header image (optional)</CardTitle>
                  <CardDescription className="text-xs">Override the email branding logo for this newsletter so each send can have a custom header. Leave empty to use your sender profile or default branding.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex gap-2">
                    <Input
                      value={headerImageUrl}
                      onChange={e => setHeaderImageUrl(e.target.value)}
                      placeholder="https://… or upload below"
                      className="flex-1"
                    />
                    <input
                      ref={headerImageFileRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      className="hidden"
                      onChange={e => { const f = e.target.files?.[0]; if (f) handleHeaderImageUpload(f); e.target.value = ""; }}
                    />
                    <Button type="button" variant="outline" size="sm" onClick={() => headerImageFileRef.current?.click()} disabled={uploadingImage}>
                      {uploadingImage ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                    </Button>
                    {headerImageUrl && (
                      <Button type="button" variant="ghost" size="sm" onClick={() => setHeaderImageUrl("")}>Clear</Button>
                    )}
                  </div>
                  {headerImageUrl && (
                    <div className="rounded border p-2 bg-muted/30">
                      <p className="text-xs text-muted-foreground mb-1">Preview (shown at top of email):</p>
                      <img src={headerImageUrl} alt="" className="max-h-16 w-auto object-contain rounded" onError={() => {}} />
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* CTA Button */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-1.5"><Link2 className="h-3.5 w-3.5" />Call to Action Button</CardTitle>
                  <CardDescription className="text-xs">Add a prominent button at the bottom of the newsletter body.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>Button Text</Label>
                      <Input value={ctaText} onChange={e => setCtaText(e.target.value)} placeholder="e.g. Try It Free" />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Button URL</Label>
                      <Input value={ctaUrl} onChange={e => setCtaUrl(e.target.value)} placeholder="https://your-website.com/page" />
                    </div>
                  </div>
                  {ctaText && ctaUrl && (
                    <div className="mt-3 p-3 rounded-lg bg-muted/50 text-center">
                      <span className="inline-block px-5 py-2 text-xs font-semibold text-white rounded-md" style={{ background: getPreviewProps().brandColor }}>{ctaText}</span>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Target Categories */}
              {categories.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-1.5"><Tag className="h-3.5 w-3.5" />Target Audience</CardTitle>
                    <CardDescription className="text-xs">Select categories to send to. Leave empty to send to all subscribers.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-1.5">
                      {categories.map(cat => (
                        <Badge key={cat.id} variant={selectedCategoryIds.includes(cat.id) ? "default" : "outline"}
                          className="cursor-pointer" onClick={() => setSelectedCategoryIds(prev => prev.includes(cat.id) ? prev.filter(x => x !== cat.id) : [...prev, cat.id])}>
                          <span className="h-2 w-2 rounded-full mr-1" style={{ background: cat.color || "#8b5cf6" }} />{cat.name}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* AI Generation */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-1.5"><Sparkles className="h-3.5 w-3.5" />AI Content Generator</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-1.5">
                    <Label>Topic / Prompt</Label>
                    <Textarea value={aiTopic} onChange={e => setAiTopic(e.target.value)} rows={2}
                      placeholder="e.g. How TalkWeb's voice access feature helps blind users navigate websites effortlessly" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>Tone</Label>
                      <Select value={aiTone} onValueChange={setAiTone}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="professional">Professional</SelectItem>
                          <SelectItem value="casual">Casual & Friendly</SelectItem>
                          <SelectItem value="bold">Bold & Exciting</SelectItem>
                          <SelectItem value="educational">Educational</SelectItem>
                          <SelectItem value="storytelling">Storytelling</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Target Audience</Label>
                      <Input value={aiTargetAudience} onChange={e => setAiTargetAudience(e.target.value)} placeholder="e.g. SaaS founders" />
                    </div>
                  </div>
                  <Button onClick={handleAIGenerate} disabled={generating} className="w-full">
                    {generating ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" />Generating...</> : <><Sparkles className="h-4 w-4 mr-1.5" />Generate Newsletter</>}
                  </Button>
                </CardContent>
              </Card>

              {/* Body Editor — WYSIWYG (preview-style editing) */}
              <Card>
                <CardHeader className="pb-2 flex flex-row items-center justify-between">
                  <CardTitle className="text-sm">Newsletter Body</CardTitle>
                  <p className="text-xs text-muted-foreground">Edit content below; preview updates on the right.</p>
                </CardHeader>
                <CardContent>
                  <input
                    ref={newsletterImgRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    className="sr-only"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleNewsletterImageUpload(file);
                      e.target.value = "";
                    }}
                  />
                  <RichTextEditor
                    ref={newsletterBodyEditorRef}
                    content={bodyHtml}
                    onChange={(html) => setBodyHtml(html)}
                    placeholder="Hi there,&#10;&#10;Here's what's new this month..."
                    allowImages
                    toolbarExtra={
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="text-xs h-7 ml-1"
                        disabled={uploadingImage}
                        onClick={() => newsletterImgRef.current?.click()}
                      >
                        {uploadingImage
                          ? <><Loader2 className="h-3 w-3 mr-1 animate-spin" />Uploading...</>
                          : <><ImagePlus className="h-3 w-3 mr-1" />Insert Image</>}
                      </Button>
                    }
                  />
                </CardContent>
              </Card>
            </div>

            {/* Right: Preview */}
            {showPreview && (
              <div className="sticky top-6 min-w-0">
                <Card>
                  <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0 gap-2">
                    <div>
                      <CardTitle className="text-sm">Preview</CardTitle>
                      <p className="text-[10px] text-muted-foreground mt-0.5">Click an image to edit or remove it.</p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs"
                      onClick={() => {
                        newsletterEditorFormRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                        setTimeout(() => subjectInputRef.current?.focus(), 400);
                      }}
                    >
                      <Pencil className="h-3.5 w-3.5 mr-1.5" />Edit newsletter
                    </Button>
                  </CardHeader>
                  <CardContent>
                    <div className="rounded-lg border bg-muted/20 p-3 overflow-auto max-h-[700px]">
                      <EmailTemplatePreview
                        {...pp}
                        onEditImage={(src, index) => {
                          setEditImageSrc(src);
                          setEditImageIndex(index);
                          setEditImageNewUrl(src);
                          setEditImageOpen(true);
                        }}
                      />
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        </div>

        {/* Edit image (from preview) */}
        <Dialog open={editImageOpen} onOpenChange={(open) => { setEditImageOpen(open); if (!open) setEditImageNewUrl(""); }}>
          <DialogContent className="sm:max-w-md w-[calc(100vw-2rem)] max-h-[90vh] flex flex-col overflow-hidden">
            <DialogHeader className="flex-shrink-0">
              <DialogTitle>Edit image</DialogTitle>
              <DialogDescription>Change the image URL, upload a replacement, or remove it from the newsletter body.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2 overflow-y-auto min-h-0 flex-1">
              <div className="space-y-1.5">
                <Label className="text-xs">Current URL</Label>
                <p className="text-xs text-muted-foreground break-all line-clamp-2 max-h-10 overflow-hidden" title={editImageSrc}>{editImageSrc}</p>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">New URL</Label>
                <Input
                  value={editImageNewUrl}
                  onChange={e => setEditImageNewUrl(e.target.value)}
                  placeholder="https://..."
                  className="min-w-0"
                />
                <Button size="sm" className="w-full" onClick={() => { setBodyHtml(prev => replaceNthImage(prev, editImageIndex, editImageNewUrl)); setEditImageOpen(false); toast({ title: "Image updated" }); }}>
                  Update URL
                </Button>
              </div>
              <div className="flex gap-2 flex-wrap">
                <input
                  ref={replaceImageInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="sr-only"
                  onChange={e => {
                    const file = e.target.files?.[0];
                    if (file) handleReplaceImageByUpload(file);
                    e.target.value = "";
                  }}
                />
                <Button variant="outline" size="sm" className="flex-1" disabled={uploadingImage} onClick={() => replaceImageInputRef.current?.click()}>
                  {uploadingImage ? <><Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />Uploading...</> : <><Upload className="h-3.5 w-3.5 mr-1" />Upload new image</>}
                </Button>
                <Button variant="destructive" size="sm" onClick={() => { setBodyHtml(prev => replaceNthImage(prev, editImageIndex, null)); setEditImageOpen(false); toast({ title: "Image removed" }); }}>
                  <Trash2 className="h-3.5 w-3.5 mr-1" />Remove
                </Button>
              </div>
            </div>
            <DialogFooter className="flex-shrink-0">
              <Button variant="outline" onClick={() => setEditImageOpen(false)}>Cancel</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Send test dialog */}
        <Dialog open={showTestDialog} onOpenChange={setShowTestDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Send test newsletter</DialogTitle>
              <DialogDescription>
                Send a copy of this newsletter to an email address. The draft will be saved first. No send records are created.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <div className="space-y-1.5">
                <Label htmlFor="test-email">Send to</Label>
                <Input
                  id="test-email"
                  type="email"
                  placeholder="you@example.com"
                  value={testEmail}
                  onChange={(e) => setTestEmail(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Send from</Label>
                <Select value={senderConnectionId || (connectionsForSend[0]?.id ?? "")} onValueChange={setSenderConnectionId}>
                  <SelectTrigger><SelectValue placeholder="Choose email account" /></SelectTrigger>
                  <SelectContent>
                    {connectionsForSend.map((conn: { id: string; provider: string; from_email?: string }) => {
                      const fromEmail = (conn.from_email || "").trim();
                      const matchProfile = senderProfiles.find((p: { sender_email?: string }) => p.sender_email && fromEmail && String(p.sender_email).toLowerCase() === fromEmail.toLowerCase());
                      const displayName = matchProfile?.display_name || matchProfile?.name || businessProfile?.company_name || "Your Business";
                      const providerLabel = conn.provider === "resend" ? "Resend" : conn.provider === "sendgrid" ? "SendGrid" : conn.provider === "gmail" || conn.provider === "gmail_direct" ? "Gmail" : conn.provider;
                      const icon = conn.provider === "resend" ? "🚀" : conn.provider === "sendgrid" ? "📬" : conn.provider === "gmail" || conn.provider === "gmail_direct" ? "📧" : "✉️";
                      return (
                        <SelectItem key={conn.id} value={conn.id}>
                          <span>{icon} {providerLabel}</span> — <span className="text-muted-foreground">{displayName} &lt;{fromEmail || "—"}&gt;</span>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowTestDialog(false)}>Cancel</Button>
              <Button onClick={handleSendTest} disabled={sendingTest || !testEmail.trim() || connections.length === 0}>
                {sendingTest ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <FlaskConical className="h-4 w-4 mr-1.5" />}
                Send test
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Send Dialog */}
        <Dialog open={showSendDialog} onOpenChange={setShowSendDialog}>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Send Newsletter</DialogTitle>
              <DialogDescription>
                Send to subscribers by audience: all, by category (tags), recipient group, or industry. Optionally narrow by tags.
              </DialogDescription>
            </DialogHeader>
            {(() => {
              const sendingNl = newsletters.find((n) => n.id === editingId);
              if (sendingNl?.status !== "sending") return null;
              return (
                <div className="space-y-3 rounded-md bg-muted/50 p-2.5">
                  <p className="text-sm text-muted-foreground">
                    {isGmailSendConnection
                      ? <>This newsletter is already sending in batches. Send the <strong>next batch</strong> only to recipients who have not received it yet. Pick <strong>Send from</strong> below (Gmail) and use &quot;Send next X now&quot; to stay within Gmail’s daily limit (e.g. 200 more today).</>
                      : <>This newsletter is already sending in batches. <strong>Send next X now</strong> sends that many in one go (only not-yet-sent). With Resend/SendGrid there’s no daily cap — cron continues 50 every 15 min until the list is done.</>}
                  </p>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Label className="text-sm font-medium shrink-0">Send next</Label>
                    <Input
                      type="number"
                      min={1}
                      max={isGmailSendConnection ? 500 : 10000}
                      value={sendNextBatchCount}
                      onChange={(e) => { const v = parseInt(e.target.value, 10); if (!Number.isNaN(v)) setSendNextBatchCount(Math.max(1, Math.min(isGmailSendConnection ? 500 : 10000, v))); }}
                      className="w-20 h-8"
                    />
                    <span className="text-sm text-muted-foreground">now</span>
                    <span className="text-xs text-muted-foreground">— sends this many in one run (only not-yet-sent)</span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="ml-2"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setShowSendDialog(false);
                        openRecipientsDialog(sendingNl);
                      }}
                    >
                      <Users className="h-3.5 w-3.5 mr-1" />View who’s already received
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    To send the same content to everyone again (including already-sent) with a different sender, duplicate this newsletter and send the copy from the other connection (e.g. Resend).
                  </p>
                </div>
              );
            })()}
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>Send to</Label>
                <p className="text-xs text-muted-foreground">Select one or more audiences; recipients are combined (union). Leave empty or select All for newsletter content selection.</p>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-between font-normal">
                      <span className="truncate">
                        {sendTargets.length === 0 || sendTargets.includes("all")
                          ? `All active subscribers (${activeSubscribers.length})`
                          : `${sendTargets.length} audience(s) selected`}
                      </span>
                      <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[var(--radix-popover-trigger-width)] max-h-[320px] overflow-y-auto p-2" align="start">
                    <div className="space-y-1">
                      <label className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm cursor-pointer hover:bg-muted">
                        <Checkbox
                          checked={sendTargets.length === 0 || sendTargets.includes("all")}
                          onCheckedChange={(checked) => {
                            if (checked) setSendTargets(["all"]);
                            else setSendTargets([]);
                          }}
                        />
                        All active subscribers ({activeSubscribers.length})
                      </label>
                      {categories.length > 0 && (
                        <>
                          <div className="text-xs font-medium text-muted-foreground px-2 pt-2">Categories / tags</div>
                          {categories.map(cat => {
                            const count = activeSubscribers.filter(s => (subscriberCategoryMap[s.id] || []).includes(cat.id)).length;
                            const value = `cat:${cat.id}`;
                            const checked = sendTargets.includes(value);
                            return (
                              <label key={cat.id} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm cursor-pointer hover:bg-muted">
                                <Checkbox
                                  checked={checked}
                                  onCheckedChange={(c) => {
                                    if (c) setSendTargets(prev => prev.includes(value) ? prev : [...prev, value]);
                                    else setSendTargets(prev => prev.filter(t => t !== value));
                                  }}
                                />
                                {cat.name} ({count})
                              </label>
                            );
                          })}
                        </>
                      )}
                      {recipientGroups.length > 0 && (
                        <>
                          <div className="text-xs font-medium text-muted-foreground px-2 pt-2">Recipient groups</div>
                          {recipientGroups.map((g: { id: string; name: string }) => {
                            const value = `group:${g.id}`;
                            const checked = sendTargets.includes(value);
                            return (
                              <label key={g.id} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm cursor-pointer hover:bg-muted">
                                <Checkbox
                                  checked={checked}
                                  onCheckedChange={(c) => {
                                    if (c) setSendTargets(prev => prev.includes(value) ? prev : [...prev, value]);
                                    else setSendTargets(prev => prev.filter(t => t !== value));
                                  }}
                                />
                                Group: {g.name}
                              </label>
                            );
                          })}
                        </>
                      )}
                      {(() => {
                        const industryCounts = activeSubscribers.reduce((acc: Record<string, number>, s) => {
                          const ind = (s as Subscriber).industry?.trim();
                          if (ind) { acc[ind] = (acc[ind] || 0) + 1; }
                          return acc;
                        }, {});
                        const industryList = Object.keys(industryCounts).sort();
                        if (industryList.length === 0) return null;
                        return (
                          <>
                            <div className="text-xs font-medium text-muted-foreground px-2 pt-2">Industry</div>
                            {industryList.map(ind => {
                              const value = `industry:${encodeURIComponent(ind)}`;
                              const checked = sendTargets.includes(value);
                              return (
                                <label key={ind} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm cursor-pointer hover:bg-muted">
                                  <Checkbox
                                    checked={checked}
                                    onCheckedChange={(c) => {
                                      if (c) setSendTargets(prev => prev.includes(value) ? prev : [...prev, value]);
                                      else setSendTargets(prev => prev.filter(t => t !== value));
                                    }}
                                  />
                                  {ind} ({industryCounts[ind]})
                                </label>
                              );
                            })}
                          </>
                        );
                      })()}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-1.5">
                <Label className="text-muted-foreground">Also in tags (optional)</Label>
                <p className="text-xs text-muted-foreground">Narrow to subscribers in at least one of these categories.</p>
                <div className="flex flex-wrap gap-1.5">
                  {categories.map(cat => (
                    <Badge
                      key={cat.id}
                      variant={sendTagIds.includes(cat.id) ? "default" : "outline"}
                      className="cursor-pointer"
                      onClick={() => setSendTagIds(prev => prev.includes(cat.id) ? prev.filter(id => id !== cat.id) : [...prev, cat.id])}
                    >
                      {cat.name}
                    </Badge>
                  ))}
                  {categories.length === 0 && <span className="text-sm text-muted-foreground">No categories yet</span>}
                </div>
              </div>
              {selectedCategoryIds.length > 0 && (
                <div className="flex gap-1.5 flex-wrap">
                  <span className="text-xs text-muted-foreground">Newsletter target categories:</span>
                  {selectedCategoryIds.map(cid => {
                    const cat = categories.find(c => c.id === cid);
                    return cat ? <Badge key={cid} variant="outline" className="text-[10px]">{cat.name}</Badge> : null;
                  })}
                </div>
              )}
              <div className="space-y-1.5">
                <Label>Send from</Label>
                <Select value={senderConnectionId || (connectionsForSend[0]?.id ?? "")} onValueChange={setSenderConnectionId}>
                  <SelectTrigger><SelectValue placeholder="Choose email account" /></SelectTrigger>
                  <SelectContent>
                    {connectionsForSend.map((conn: { id: string; provider: string; from_email?: string }) => {
                      const fromEmail = (conn.from_email || "").trim();
                      const matchProfile = senderProfiles.find((p: { sender_email?: string }) => p.sender_email && fromEmail && String(p.sender_email).toLowerCase() === fromEmail.toLowerCase());
                      const displayName = matchProfile?.display_name || matchProfile?.name || businessProfile?.company_name || "Your Business";
                      const providerLabel = conn.provider === "resend" ? "Resend" : conn.provider === "sendgrid" ? "SendGrid" : conn.provider === "gmail" || conn.provider === "gmail_direct" ? "Gmail" : conn.provider;
                      const icon = conn.provider === "resend" ? "🚀" : conn.provider === "sendgrid" ? "📬" : conn.provider === "gmail" || conn.provider === "gmail_direct" ? "📧" : "✉️";
                      return (
                        <SelectItem key={conn.id} value={conn.id}>
                          <span>{icon} {providerLabel}</span> — <span className="text-muted-foreground">{displayName} &lt;{fromEmail || "—"}&gt;</span>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
                {newsletters.find((n) => n.id === editingId)?.status === "sending" && (
                  <p className="text-xs text-muted-foreground">
                    {isGmailSendConnection
                      ? "This batch will send from the selected account. With Gmail, stay within the daily cap (use “Send next X now” to control how many more today)."
                      : "This batch will send from the selected account. With Resend/SendGrid, no daily cap — batches continue until the list is done."}
                  </p>
                )}
              </div>
              <div className="rounded-lg bg-muted/50 border p-3 text-sm">
                <strong>Subject:</strong> {subject || "(no subject)"}<br />
                <strong>From (branding):</strong> {senderProfiles.find((p: any) => p.id === senderProfileId)?.display_name || businessProfile?.company_name || "Default"}
              </div>

              <div className="space-y-3 border-t pt-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox checked={sendInBatches} onCheckedChange={(c) => setSendInBatches(!!c)} />
                  <span className="text-sm font-medium">Send in batches of 50 every 15 min</span>
                </label>
                {sendInBatches && isGmailSendConnection && (
                  <div className="pl-6 flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Daily cap (Gmail limit):</span>
                    <select
                      value={dailySendLimit}
                      onChange={e => setDailySendLimit(Number(e.target.value))}
                      className="h-8 rounded border border-input bg-background px-2 text-sm"
                    >
                      <option value={400}>400/day</option>
                      <option value={500}>500/day</option>
                    </select>
                  </div>
                )}
                {sendInBatches && (
                  <p className="text-xs text-muted-foreground pl-6">
                    {isGmailSendConnection
                      ? "Up to the daily cap today (50 every 15 min); remaining list continues tomorrow. Fits within timeouts."
                      : "50 every 15 min until done. No daily cap for Resend/SendGrid. Fits within timeouts."}
                  </p>
                )}
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox checked={sendScheduleLater} onCheckedChange={(c) => setSendScheduleLater(!!c)} />
                  <span className="text-sm font-medium">Schedule for later</span>
                </label>
                {sendScheduleLater && (
                  <div className="space-y-1.5 pl-6">
                    <Label htmlFor="send-dialog-schedule-datetime">Date & time</Label>
                    <input
                      id="send-dialog-schedule-datetime"
                      type="datetime-local"
                      value={sendDialogScheduleDateTime}
                      onChange={e => setSendDialogScheduleDateTime(e.target.value)}
                      min={new Date(new Date().getTime() + 15 * 60 * 1000).toISOString().slice(0, 16)}
                      className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                    />
                  </div>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setShowSendDialog(false); setSendScheduleLater(false); setSendInBatches(false); setDailySendLimit(400); setSendDialogScheduleDateTime(""); }}>Cancel</Button>
              {sendScheduleLater ? (
                <Button onClick={handleScheduleFromSendDialog} disabled={scheduling || connections.length === 0 || !sendDialogScheduleDateTime.trim()}>
                  {scheduling ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" />Scheduling...</> : <><CalendarClock className="h-4 w-4 mr-1.5" />Schedule send</>}
                </Button>
              ) : (
                <Button onClick={handleSendNewsletter} disabled={sending || connections.length === 0}>
                  {sending ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" />Sending...</> : <><Send className="h-4 w-4 mr-1.5" />Send Now</>}
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={showScheduleDialog} onOpenChange={setShowScheduleDialog}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2"><CalendarClock className="h-5 w-5" />Schedule send</DialogTitle>
              <DialogDescription>Choose when to send this newsletter. It will be sent automatically at the selected time (check runs every 15 minutes).</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label htmlFor="schedule-datetime">Date & time</Label>
                <input
                  id="schedule-datetime"
                  type="datetime-local"
                  value={scheduleDateTime}
                  onChange={e => setScheduleDateTime(e.target.value)}
                  min={new Date(new Date().getTime() + 15 * 60 * 1000).toISOString().slice(0, 16)}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowScheduleDialog(false)}>Cancel</Button>
              <Button onClick={handleScheduleNewsletter} disabled={scheduling || !scheduleDateTime.trim()}>
                {scheduling ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" />Scheduling...</> : <><CalendarClock className="h-4 w-4 mr-1.5" />Schedule</>}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Recipients dialog (also in editor so "View who's already received" from Send dialog works) */}
        <Dialog open={!!recipientsDialogNewsletter} onOpenChange={(open) => { if (!open) setRecipientsDialogNewsletter(null); }}>
          <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
            <DialogHeader>
              <DialogTitle>Recipients — {recipientsDialogNewsletter?.title || "Untitled"}</DialogTitle>
              <DialogDescription>
                {recipientsDialogNewsletter?.status === "scheduled"
                  ? "People who will receive this newsletter when it sends (based on schedule audience)."
                  : recipientsDialogNewsletter?.status === "sent"
                    ? "Recipients who received this newsletter. When sent in batches, Sent vs Pending shows who has received it so far."
                    : (recipientsDialogNewsletter?.status === "sending" || recipientsDialogShowsSentStatus)
                      ? "Full audience: Sent = already received this batch run; Pending = will receive in a later batch."
                      : "People who would receive this newsletter if sent now (based on target categories or schedule audience)."}
              </DialogDescription>
              {(recipientsDialogNewsletter?.status === "sent" || recipientsDialogShowsSentStatus) && (
                <div className="pt-2">
                  <Button variant="outline" size="sm" onClick={handleSyncFromResend} disabled={syncingFromResend}>
                    {syncingFromResend ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-1.5" />}
                    Sync from Resend
                  </Button>
                </div>
              )}
            </DialogHeader>
            <div className="flex-1 overflow-auto min-h-0 border rounded-md">
              {recipientsDialogLoading ? (
                <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
              ) : recipientsDialogList.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground text-sm">No recipients</div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 sticky top-0">
                    <tr>
                      <th className="text-left font-medium p-2">Email</th>
                      <th className="text-left font-medium p-2">Name</th>
                      <th className="text-left font-medium p-2">Company</th>
                      {(recipientsDialogNewsletter?.status === "sent" || recipientsDialogNewsletter?.status === "sending" || recipientsDialogShowsSentStatus) && (
                        <>
                          <th className="text-left font-medium p-2">Status</th>
                          <th className="text-left font-medium p-2">Sent</th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {recipientsDialogList.map((r, i) => (
                      <tr key={i} className="border-t border-border/50">
                        <td className="p-2 truncate max-w-[200px]" title={r.email}>{r.email}</td>
                        <td className="p-2">{[r.first_name, r.last_name].filter(Boolean).join(" ") || "—"}</td>
                        <td className="p-2 truncate max-w-[140px]" title={r.company ?? ""}>{r.company || "—"}</td>
                        {(recipientsDialogNewsletter?.status === "sent" || recipientsDialogNewsletter?.status === "sending" || recipientsDialogShowsSentStatus) && (
                          <>
                            <td className="p-2">
                              <span className={getRecipientStatusLabel(r) === "Clicked" ? "text-violet-600 font-medium" : getRecipientStatusLabel(r) === "Opened" ? "text-blue-600 font-medium" : getRecipientStatusLabel(r) === "Delivered" ? "text-emerald-600 font-medium" : r.status === "sent" ? "text-emerald-600 font-medium" : "text-muted-foreground"}>{getRecipientStatusLabel(r)}</span>
                            </td>
                            <td className="p-2 text-muted-foreground">{r.sent_at ? formatInLondon(r.sent_at) : "—"}</td>
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            <div className="text-xs text-muted-foreground pt-1">
              {recipientsDialogList.length} recipient{recipientsDialogList.length !== 1 ? "s" : ""}
              {(recipientsDialogNewsletter?.status === "sent" || recipientsDialogNewsletter?.status === "sending" || recipientsDialogShowsSentStatus) && (() => {
                const sent = recipientsDialogList.filter(r => r.status === "sent").length;
                const pending = recipientsDialogList.length - sent;
                if (pending > 0) return ` · ${sent} sent, ${pending} pending`;
                return sent > 0 ? ` · All ${sent} sent` : "";
              })()}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // ── LIST VIEW (default) ──
  return (
    <div className="max-w-full">
      <div className="container mx-auto p-6 max-w-5xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Newsletters</h1>
            <p className="text-muted-foreground">Create and send branded newsletters to your audience</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setView("subscribers")}>
              <Users className="h-4 w-4 mr-1.5" />Subscribers ({activeSubscribers.length})
            </Button>
            <Link to="/newsletter-series">
              <Button variant="outline"><CalendarClock className="h-4 w-4 mr-1.5" />Series</Button>
            </Link>
            <Button onClick={openNewNewsletter}>
              <Plus className="h-4 w-4 mr-1.5" />New Newsletter
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card>
            <CardContent className="pt-5 pb-4">
              <div className="text-2xl font-bold">{newsletters.length}</div>
              <p className="text-xs text-muted-foreground">Newsletters</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5 pb-4">
              <div className="text-2xl font-bold">{activeSubscribers.length}</div>
              <p className="text-xs text-muted-foreground">Active Subscribers</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5 pb-4">
              <div className="text-2xl font-bold">{newsletters.filter(n => n.status === "sent").length}</div>
              <p className="text-xs text-muted-foreground">Sent</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5 pb-4">
              <div className="text-2xl font-bold">{newsletters.filter(n => n.status === "sending").length}</div>
              <p className="text-xs text-muted-foreground">Sending (batch)</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5 pb-4">
              <div className="text-2xl font-bold">{categories.length}</div>
              <p className="text-xs text-muted-foreground">Categories</p>
            </CardContent>
          </Card>
        </div>

        {/* Sending window: when cron may send (local time or UTC) */}
        <Card className="border-muted">
          <CardContent className="py-3 px-4 space-y-3">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Cron sending window</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Automated batch/scheduled sends run only between these hours. Choose a timezone so 9:00 means 9 AM in your region (e.g. 9:00 London = first run 9 AM UK). Default 9:00–22:00.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Label className="text-xs shrink-0">Timezone</Label>
              {(() => {
                const CRON_TZ_PRESETS = ["Europe/London", "Europe/Paris", "Europe/Berlin", "Europe/Dublin", "America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles", "America/Toronto", "Asia/Dubai", "Asia/Singapore", "Asia/Tokyo", "Australia/Sydney"];
                const isOther = cronTimezone && !CRON_TZ_PRESETS.includes(cronTimezone);
                const selectValue = isOther ? "OTHER" : (cronTimezone || "UTC");
                return (
                  <>
                    <Select
                      value={selectValue}
                      onValueChange={(v) => {
                        if (v === "UTC") setCronTimezone("");
                        else if (v === "OTHER") setCronTimezone(cronTimezone || " ");
                        else setCronTimezone(v);
                      }}
                    >
                      <SelectTrigger className="w-[220px] h-8 text-sm">
                        <SelectValue placeholder="UTC">
                          {isOther ? cronTimezone : null}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="UTC">UTC</SelectItem>
                        <SelectGroup>
                          <SelectLabel>Europe</SelectLabel>
                          <SelectItem value="Europe/London">Europe/London (GMT/BST)</SelectItem>
                          <SelectItem value="Europe/Paris">Europe/Paris</SelectItem>
                          <SelectItem value="Europe/Berlin">Europe/Berlin</SelectItem>
                          <SelectItem value="Europe/Dublin">Europe/Dublin</SelectItem>
                        </SelectGroup>
                        <SelectGroup>
                          <SelectLabel>Americas</SelectLabel>
                          <SelectItem value="America/New_York">America/New_York (ET)</SelectItem>
                          <SelectItem value="America/Chicago">America/Chicago (CT)</SelectItem>
                          <SelectItem value="America/Denver">America/Denver (MT)</SelectItem>
                          <SelectItem value="America/Los_Angeles">America/Los_Angeles (PT)</SelectItem>
                          <SelectItem value="America/Toronto">America/Toronto</SelectItem>
                        </SelectGroup>
                        <SelectGroup>
                          <SelectLabel>Asia / Pacific</SelectLabel>
                          <SelectItem value="Asia/Dubai">Asia/Dubai</SelectItem>
                          <SelectItem value="Asia/Singapore">Asia/Singapore</SelectItem>
                          <SelectItem value="Asia/Tokyo">Asia/Tokyo</SelectItem>
                          <SelectItem value="Australia/Sydney">Australia/Sydney</SelectItem>
                        </SelectGroup>
                        <SelectItem value="OTHER">Other (enter below)</SelectItem>
                      </SelectContent>
                    </Select>
                    {isOther && (
                      <Input
                        placeholder="e.g. Africa/Lagos, Asia/Kolkata"
                        value={cronTimezone === " " ? "" : cronTimezone}
                        onChange={(e) => setCronTimezone(e.target.value.trim() || " ")}
                        className="w-[200px] h-8 text-sm"
                      />
                    )}
                  </>
                );
              })()}
              <Label className="text-xs shrink-0 ml-2">Start</Label>
              <Input
                type="number"
                min={0}
                max={23}
                value={cronStartHourUtc}
                onChange={(e) => setCronStartHourUtc(Math.max(0, Math.min(23, parseInt(e.target.value, 10) || 0)))}
                className="w-16 h-8 text-sm"
              />
              <span className="text-xs text-muted-foreground">:00</span>
              <Label className="text-xs shrink-0">End</Label>
              <Input
                type="number"
                min={0}
                max={23}
                value={cronEndHourUtc}
                onChange={(e) => setCronEndHourUtc(Math.max(0, Math.min(23, parseInt(e.target.value, 10) || 0)))}
                className="w-16 h-8 text-sm"
              />
              <span className="text-xs text-muted-foreground">:00{cronTimezone ? ` ${cronTimezone}` : " UTC"}</span>
              <Button
                size="sm"
                variant="secondary"
                disabled={savingCronWindow}
                onClick={async () => {
                  setSavingCronWindow(true);
                  try {
                    const { data: { user: u } } = await supabase.auth.getUser();
                    if (!u) throw new Error("Not authenticated");
                    const { error } = await supabase
                      .from("business_profiles")
                      .update({
                        newsletter_cron_start_hour_utc: cronStartHourUtc,
                        newsletter_cron_end_hour_utc: cronEndHourUtc,
                        newsletter_cron_timezone: cronTimezone.trim() || null,
                      })
                      .eq("user_id", u.id);
                    if (error) throw error;
                    queryClient.invalidateQueries({ queryKey: ["business-profile-newsletter"] });
                    const tzLabel = cronTimezone ? ` ${cronTimezone}` : " UTC";
                    toast.success("Sending window saved. Cron runs between " + cronStartHourUtc + ":00 and " + cronEndHourUtc + ":00" + tzLabel + ".");
                  } catch (e: any) {
                    toast.error(e?.message ?? "Failed to save");
                  } finally {
                    setSavingCronWindow(false);
                  }
                }}
              >
                {savingCronWindow ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
                Save
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Batch sending explanation when any newsletter is in progress */}
        {newsletters.some(n => n.status === "sending") && (
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="py-3 px-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <p className="text-sm font-medium">Batch sending in progress</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  First batch (50) sent. Cron sends 50 every 15 min up to the daily cap; remaining list continues tomorrow with the same schedule. No action needed. Progress below and in &quot;View recipients&quot;.
                </p>
              </div>
              <Button
                size="sm"
                variant="secondary"
                disabled={sendingBatchNow}
                onClick={async () => {
                  setSendingBatchNow(true);
                  try {
                    const { data, error } = await supabase.functions.invoke("trigger-newsletter-batch-now", { body: {} });
                    if (error) throw error;
                    const count = (data?.results as { result?: { sent?: number } }[] | undefined)?.filter((r) => r.result && !(r.result as any).error).length ?? 0;
                    queryClient.invalidateQueries({ queryKey: ["newsletters"] });
                    queryClient.invalidateQueries({ queryKey: ["newsletter-sent-counts"] });
                    toast.success(count > 0 ? `Next batch triggered for ${count} newsletter(s).` : "No batch newsletters in progress, or next batch already sent.");
                  } catch (e: any) {
                    toast.error(e?.message ?? "Failed to trigger next batch");
                  } finally {
                    setSendingBatchNow(false);
                  }
                }}
              >
                {sendingBatchNow ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Send className="h-3.5 w-3.5 mr-1.5" />}
                Send next batch now
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Newsletter List */}
        <Card>
          <CardContent className="p-0">
            {loadingNewsletters ? (
              <div className="flex items-center justify-center py-16"><Loader2 className="h-5 w-5 animate-spin" /></div>
            ) : newsletters.length === 0 ? (
              <div className="text-center py-16 space-y-3">
                <FileText className="h-12 w-12 mx-auto text-muted-foreground/50" />
                <div>
                  <p className="font-medium">No newsletters yet</p>
                  <p className="text-sm text-muted-foreground">Create your first newsletter to start engaging your audience.</p>
                </div>
                <Button onClick={openNewNewsletter}><Plus className="h-4 w-4 mr-1.5" />Create Newsletter</Button>
              </div>
            ) : (
              <div className="divide-y">
                {newsletters.map(nl => (
                  <div key={nl.id} className="flex items-center justify-between px-5 py-4 hover:bg-muted/50 transition-colors">
                    <div className="min-w-0 flex-1 cursor-pointer" onClick={() => openEditNewsletter(nl)}>
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="font-medium truncate">{nl.title || "Untitled"}</span>
                        <Badge variant={statusColor(nl.status) as any} className="text-[10px] h-5">{nl.status}</Badge>
                      </div>
                      <div className="text-sm text-muted-foreground truncate">{nl.subject || "(no subject)"}</div>
                      <div className="flex gap-4 text-xs text-muted-foreground mt-1 flex-wrap items-center">
                        {nl.status === "sent" && (
                          <>
                            <span className="flex items-center gap-1"><Send className="h-3 w-3" />{nl.total_sent} sent</span>
                            <span className="flex items-center gap-1"><MailOpen className="h-3 w-3" />{nl.total_opened} opened</span>
                            <span className="flex items-center gap-1"><MousePointerClick className="h-3 w-3" />{nl.total_clicked} clicked</span>
                          </>
                        )}
                        {nl.status === "sending" && (
                          <>
                            <span className="flex items-center gap-1 font-medium text-foreground">
                              <Send className="h-3 w-3" />
                              {Math.max(
                                nl.batch_sent_count ?? nl.total_sent ?? 0,
                                sentCountByNewsletterId[nl.id] ?? 0
                              )} / {(nl.total_recipients ?? 0)} sent
                            </span>
                            {nl.batch_next_at && (
                              <span className="flex items-center gap-1">
                                <CalendarClock className="h-3 w-3" />
                                Next batch: {formatInLondon(nl.batch_next_at, { dateStyle: "short", timeStyle: "short" })}
                              </span>
                            )}
                          </>
                        )}
                        {nl.status === "scheduled" && nl.scheduled_at && (
                          <span className="flex items-center gap-1"><Clock className="h-3 w-3" />Scheduled for {formatInLondon(nl.scheduled_at)}</span>
                        )}
                        <span>{formatDateInLondon(nl.updated_at)}</span>
                      </div>
                      {nl.status === "sending" && (
                        <p className="text-xs text-muted-foreground mt-1.5">
                          Batch sending: 50 per run. Next batch in 15 min (or tomorrow after daily cap). Cron runs every 15 min — no action needed.
                        </p>
                      )}
                    </div>
                    <div className="flex gap-1 shrink-0 ml-3 items-center">
                      {nl.status === "scheduled" && (
                        <Button variant="ghost" size="sm" className="text-xs" onClick={(e) => { e.stopPropagation(); handleCancelSchedule(nl.id); }} disabled={cancellingSchedule}>
                          {cancellingSchedule ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Cancel schedule"}
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" className="h-8 w-8" title="View recipients" onClick={(e) => { e.stopPropagation(); openRecipientsDialog(nl); }}><Users className="h-3.5 w-3.5" /></Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditNewsletter(nl)}><Pencil className="h-3.5 w-3.5" /></Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDuplicate(nl)}><Copy className="h-3.5 w-3.5" /></Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDeleteNewsletter(nl.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recipients dialog */}
        <Dialog open={!!recipientsDialogNewsletter} onOpenChange={(open) => { if (!open) setRecipientsDialogNewsletter(null); }}>
          <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
            <DialogHeader>
              <DialogTitle>Recipients — {recipientsDialogNewsletter?.title || "Untitled"}</DialogTitle>
              <DialogDescription>
                {recipientsDialogNewsletter?.status === "scheduled"
                  ? "People who will receive this newsletter when it sends (based on schedule audience)."
                  : recipientsDialogNewsletter?.status === "sent"
                    ? "Recipients who received this newsletter. When sent in batches, Sent vs Pending shows who has received it so far."
                    : (recipientsDialogNewsletter?.status === "sending" || recipientsDialogShowsSentStatus)
                      ? "Full audience: Sent = already received this batch run; Pending = will receive in a later batch."
                      : "People who would receive this newsletter if sent now (based on target categories or schedule audience)."}
              </DialogDescription>
              {(recipientsDialogNewsletter?.status === "sent" || recipientsDialogShowsSentStatus) && (
                <div className="pt-2">
                  <Button variant="outline" size="sm" onClick={handleSyncFromResend} disabled={syncingFromResend}>
                    {syncingFromResend ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-1.5" />}
                    Sync from Resend
                  </Button>
                </div>
              )}
            </DialogHeader>
            <div className="flex-1 overflow-auto min-h-0 border rounded-md">
              {recipientsDialogLoading ? (
                <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
              ) : recipientsDialogList.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground text-sm">No recipients</div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 sticky top-0">
                    <tr>
                      <th className="text-left font-medium p-2">Email</th>
                      <th className="text-left font-medium p-2">Name</th>
                      <th className="text-left font-medium p-2">Company</th>
                      {(recipientsDialogNewsletter?.status === "sent" || recipientsDialogNewsletter?.status === "sending" || recipientsDialogShowsSentStatus) && (
                        <>
                          <th className="text-left font-medium p-2">Status</th>
                          <th className="text-left font-medium p-2">Sent</th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {recipientsDialogList.map((r, i) => (
                      <tr key={i} className="border-t border-border/50">
                        <td className="p-2 truncate max-w-[200px]" title={r.email}>{r.email}</td>
                        <td className="p-2">{[r.first_name, r.last_name].filter(Boolean).join(" ") || "—"}</td>
                        <td className="p-2 truncate max-w-[140px]" title={r.company ?? ""}>{r.company || "—"}</td>
                        {(recipientsDialogNewsletter?.status === "sent" || recipientsDialogNewsletter?.status === "sending" || recipientsDialogShowsSentStatus) && (
                          <>
                            <td className="p-2">
                              <span className={getRecipientStatusLabel(r) === "Clicked" ? "text-violet-600 font-medium" : getRecipientStatusLabel(r) === "Opened" ? "text-blue-600 font-medium" : getRecipientStatusLabel(r) === "Delivered" ? "text-emerald-600 font-medium" : r.status === "sent" ? "text-emerald-600 font-medium" : "text-muted-foreground"}>{getRecipientStatusLabel(r)}</span>
                            </td>
                            <td className="p-2 text-muted-foreground">{r.sent_at ? formatInLondon(r.sent_at) : "—"}</td>
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            <div className="text-xs text-muted-foreground pt-1">
              {recipientsDialogList.length} recipient{recipientsDialogList.length !== 1 ? "s" : ""}
              {(recipientsDialogNewsletter?.status === "sent" || recipientsDialogNewsletter?.status === "sending" || recipientsDialogShowsSentStatus) && (() => {
                const sent = recipientsDialogList.filter(r => r.status === "sent").length;
                const pending = recipientsDialogList.length - sent;
                if (pending > 0) return ` · ${sent} sent, ${pending} pending`;
                return sent > 0 ? ` · All ${sent} sent` : "";
              })()}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
