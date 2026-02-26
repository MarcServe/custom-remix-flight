import { useState, useEffect, useRef } from "react";
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
  Clock, CalendarClock,
} from "lucide-react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
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
  status: string;
  scheduled_at: string | null;
  sent_at: string | null;
  total_recipients: number;
  total_sent: number;
  total_opened: number;
  total_clicked: number;
  created_at: string;
  updated_at: string;
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

  // Editor state
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [bodyHtml, setBodyHtml] = useState("");
  const [ctaText, setCtaText] = useState("");
  const [ctaUrl, setCtaUrl] = useState("");
  const [senderProfileId, setSenderProfileId] = useState("");
  const [templateStyle, setTemplateStyle] = useState<EmailTemplateStyle>("professional");
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);

  // AI generation
  const [aiTopic, setAiTopic] = useState("");
  const [aiTone, setAiTone] = useState("professional");
  const [aiTargetAudience, setAiTargetAudience] = useState("");
  const [uploadingImage, setUploadingImage] = useState(false);
  const newsletterImgRef = useRef<HTMLInputElement>(null);
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
  const [importFromGroupCategoryIds, setImportFromGroupCategoryIds] = useState<string[]>([]);
  const [importingFromGroup, setImportingFromGroup] = useState(false);

  // Send dialog
  const [showSendDialog, setShowSendDialog] = useState(false);
  const [sendTarget, setSendTarget] = useState<string>("all"); // "all" | "cat:id" | "group:id" | "industry:Name"
  const [sendTagIds, setSendTagIds] = useState<string[]>([]); // optional tags (categories) to narrow

  // Send test dialog
  const [showTestDialog, setShowTestDialog] = useState(false);
  const [testEmail, setTestEmail] = useState("");
  const [sendingTest, setSendingTest] = useState(false);

  // Schedule dialog
  const [showScheduleDialog, setShowScheduleDialog] = useState(false);
  const [scheduleDateTime, setScheduleDateTime] = useState("");
  const [scheduling, setScheduling] = useState(false);
  const [cancellingSchedule, setCancellingSchedule] = useState(false);

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
        .select("company_name, email_header_name, email_logo_url, email_brand_color, email_footer_text, email_footer_image_url, email_footer_logo_url, email_sender_image_url, email_sender_title, email_signature, email_template_style, email_provider, website, email_sender_name, email_sender_email")
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

  useEffect(() => {
    if (connections.length > 0 && !senderConnectionId) {
      setSenderConnectionId(connections[0].id);
    }
  }, [connections, senderConnectionId]);

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
        const { data: sub, error: insertError } = await supabase
          .from("newsletter_subscribers")
          .upsert({
            user_id: user.id,
            email: m.email.toLowerCase(),
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
      queryClient.invalidateQueries({ queryKey: ["newsletter-subscribers"] });
      queryClient.invalidateQueries({ queryKey: ["subscriber-categories-map"] });
      setShowImportFromGroupDialog(false);
      setImportFromGroupCategoryIds([]);
      toast({ title: "Imported", description: `${imported} subscribers added from group for newsletter grouping.` });
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
      const { data, error } = await supabase.from("newsletter_subscribers").insert({
        user_id: user.id,
        email: subscriberEmail.trim().toLowerCase(),
        first_name: subscriberFirstName.trim() || null,
        last_name: subscriberLastName.trim() || null,
        company: subscriberCompany.trim() || null,
        source: "manual",
      }).select("id").single();
      if (error) throw error;

      if (subscriberCategoryIds.length > 0 && data) {
        await supabase.from("newsletter_subscriber_categories").insert(
          subscriberCategoryIds.map(cid => ({ subscriber_id: data.id, category_id: cid }))
        );
      }

      queryClient.invalidateQueries({ queryKey: ["newsletter-subscribers"] });
      queryClient.invalidateQueries({ queryKey: ["subscriber-categories-map"] });
      setShowAddSubscriberDialog(false);
      setSubscriberEmail("");
      setSubscriberFirstName("");
      setSubscriberLastName("");
      setSubscriberCompany("");
      setSubscriberCategoryIds([]);
      toast({ title: "Added", description: "Subscriber added." });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleDeleteSubscriber = async (id: string) => {
    if (!confirm("Remove this subscriber?")) return;
    await supabase.from("newsletter_subscribers").delete().eq("id", id);
    queryClient.invalidateQueries({ queryKey: ["newsletter-subscribers"] });
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
      const { data: sub, error: insertError } = await supabase
        .from("newsletter_subscribers")
        .upsert({
          user_id: user.id,
          email: p.email.toLowerCase(),
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

  const handleSendNewsletter = async () => {
    if (!user) return;
    try {
      setSending(true);
      const id = await handleSaveNewsletter();
      if (!id) return;

      let categoryFilter: string | null = null;
      let recipientGroupId: string | null = null;
      let industryFilter: string[] = [];
      if (sendTarget.startsWith("cat:")) categoryFilter = sendTarget.slice(5);
      else if (sendTarget.startsWith("group:")) recipientGroupId = sendTarget.slice(6);
      else if (sendTarget.startsWith("industry:")) industryFilter = [decodeURIComponent(sendTarget.slice(9))];

      const { data, error } = await supabase.functions.invoke("send-newsletter", {
        body: {
          newsletterId: id,
          categoryFilter,
          recipientGroupId,
          industryFilter: industryFilter.length ? industryFilter : undefined,
          tagCategoryIds: sendTagIds.length ? sendTagIds : undefined,
          sender_connection_id: senderConnectionId || undefined,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      queryClient.invalidateQueries({ queryKey: ["newsletters"] });
      setShowSendDialog(false);
      toast({ title: "Sending", description: `Newsletter queued for ${data?.recipientCount || 0} recipients.` });
    } catch (err: any) {
      toast({ title: "Send Error", description: err.message, variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  const handleScheduleNewsletter = async () => {
    if (!scheduleDateTime.trim() || !user) return;
    const at = new Date(scheduleDateTime);
    if (isNaN(at.getTime()) || at <= new Date()) {
      toast({ title: "Invalid time", description: "Choose a future date and time.", variant: "destructive" });
      return;
    }
    try {
      setScheduling(true);
      const id = await handleSaveNewsletter();
      if (!id) return;
      const { error } = await supabase
        .from("newsletters")
        .update({ status: "scheduled", scheduled_at: at.toISOString() })
        .eq("id", id)
        .eq("user_id", user.id);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["newsletters"] });
      setShowScheduleDialog(false);
      setScheduleDateTime("");
      toast({ title: "Scheduled", description: `Newsletter will send at ${at.toLocaleString()}.` });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setScheduling(false);
    }
  };

  const handleCancelSchedule = async (newsletterId: string) => {
    if (!user) return;
    try {
      setCancellingSchedule(true);
      const { error } = await supabase
        .from("newsletters")
        .update({ status: "draft", scheduled_at: null })
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
    const logo = sp?.logo_url || businessProfile?.email_logo_url || undefined;
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
          <div className="flex gap-2">
            <Button onClick={() => setShowAddSubscriberDialog(true)}>
              <UserPlus className="h-4 w-4 mr-1.5" />Add Subscriber
            </Button>
            <Button variant="outline" onClick={() => setShowImportDialog(true)}>
              <Upload className="h-4 w-4 mr-1.5" />Import from CRM
            </Button>
            <Button variant="outline" onClick={() => setShowImportFromGroupDialog(true)} disabled={recipientGroups.length === 0}>
              <FolderInput className="h-4 w-4 mr-1.5" />Import from group
            </Button>
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
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm truncate">{sub.email}</span>
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
                <Input value={subscriberEmail} onChange={e => setSubscriberEmail(e.target.value)} placeholder="name@example.com" />
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
              <Button variant="outline" onClick={() => { if (!subject.trim()) { toast({ title: "Subject required", variant: "destructive" }); return; } setScheduleDateTime(() => { const d = new Date(); d.setMinutes(d.getMinutes() + 30); d.setSeconds(0, 0); return d.toISOString().slice(0, 16); }); setShowScheduleDialog(true); }} disabled={!editingId && !subject.trim()}>
                <CalendarClock className="h-4 w-4 mr-1.5" />Schedule
              </Button>
              <Button onClick={() => { if (!subject.trim()) { toast({ title: "Subject required", variant: "destructive" }); return; } setShowSendDialog(true); }} disabled={!editingId && !subject.trim()}>
                <Send className="h-4 w-4 mr-1.5" />Send
              </Button>
            </div>
          </div>

          {editingId && newsletters.find(n => n.id === editingId)?.status === "scheduled" && (
            <div className="flex items-center gap-2 rounded-lg border bg-muted/50 px-4 py-2 text-sm">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Scheduled for</span>
              <span className="font-medium">{newsletters.find(n => n.id === editingId)?.scheduled_at ? new Date(newsletters.find(n => n.id === editingId)!.scheduled_at!).toLocaleString() : ""}</span>
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
                      {senderProfiles.length === 0 && (
                        <p className="text-xs text-muted-foreground">
                          <Link to="/email-branding" className="text-primary hover:underline">Add sender profiles in Email Branding</Link>
                          {" "}to send as different brands (e.g. TalkWeb, Biz Boosters).
                        </p>
                      )}
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
                    <Select value={senderConnectionId || (connections[0]?.id ?? "")} onValueChange={setSenderConnectionId}>
                      <SelectTrigger><SelectValue placeholder="Choose email account" /></SelectTrigger>
                      <SelectContent>
                        {connections.map((conn: { id: string; provider: string; from_email?: string }) => {
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
                    <p className="text-xs text-muted-foreground">Account used to send this newsletter and test emails. Configure in <Link to="/integrations/email-providers" className="text-primary hover:underline">Settings → Email Providers</Link>.</p>
                  </div>
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
                <Select value={senderConnectionId || (connections[0]?.id ?? "")} onValueChange={setSenderConnectionId}>
                  <SelectTrigger><SelectValue placeholder="Choose email account" /></SelectTrigger>
                  <SelectContent>
                    {connections.map((conn: { id: string; provider: string; from_email?: string }) => {
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
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>Send to</Label>
                <Select value={sendTarget} onValueChange={setSendTarget}>
                  <SelectTrigger><SelectValue placeholder="Choose audience" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All active subscribers ({activeSubscribers.length})</SelectItem>
                    {categories.length > 0 && (
                      <SelectGroup>
                        <SelectLabel className="text-muted-foreground">Categories / tags</SelectLabel>
                        {categories.map(cat => {
                          const count = activeSubscribers.filter(s => (subscriberCategoryMap[s.id] || []).includes(cat.id)).length;
                          return <SelectItem key={cat.id} value={`cat:${cat.id}`}>{cat.name} ({count})</SelectItem>;
                        })}
                      </SelectGroup>
                    )}
                    {recipientGroups.length > 0 && (
                      <SelectGroup>
                        <SelectLabel className="text-muted-foreground">Recipient groups</SelectLabel>
                        {recipientGroups.map((g: { id: string; name: string }) => (
                          <SelectItem key={g.id} value={`group:${g.id}`}>Group: {g.name}</SelectItem>
                        ))}
                      </SelectGroup>
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
                        <SelectGroup>
                          <SelectLabel className="text-muted-foreground">Industry</SelectLabel>
                          {industryList.map(ind => (
                            <SelectItem key={ind} value={`industry:${encodeURIComponent(ind)}`}>{ind} ({industryCounts[ind]})</SelectItem>
                          ))}
                        </SelectGroup>
                      );
                    })()}
                  </SelectContent>
                </Select>
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
                <Select value={senderConnectionId || (connections[0]?.id ?? "")} onValueChange={setSenderConnectionId}>
                  <SelectTrigger><SelectValue placeholder="Choose email account" /></SelectTrigger>
                  <SelectContent>
                    {connections.map((conn: { id: string; provider: string; from_email?: string }) => {
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
              <div className="rounded-lg bg-muted/50 border p-3 text-sm">
                <strong>Subject:</strong> {subject || "(no subject)"}<br />
                <strong>From (branding):</strong> {senderProfiles.find((p: any) => p.id === senderProfileId)?.display_name || businessProfile?.company_name || "Default"}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowSendDialog(false)}>Cancel</Button>
              <Button onClick={handleSendNewsletter} disabled={sending || connections.length === 0}>
                {sending ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" />Sending...</> : <><Send className="h-4 w-4 mr-1.5" />Send Now</>}
              </Button>
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
            <Button onClick={openNewNewsletter}>
              <Plus className="h-4 w-4 mr-1.5" />New Newsletter
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
              <div className="text-2xl font-bold">{categories.length}</div>
              <p className="text-xs text-muted-foreground">Categories</p>
            </CardContent>
          </Card>
        </div>

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
                        {nl.status === "scheduled" && nl.scheduled_at && (
                          <span className="flex items-center gap-1"><Clock className="h-3 w-3" />Scheduled for {new Date(nl.scheduled_at).toLocaleString()}</span>
                        )}
                        <span>{new Date(nl.updated_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <div className="flex gap-1 shrink-0 ml-3 items-center">
                      {nl.status === "scheduled" && (
                        <Button variant="ghost" size="sm" className="text-xs" onClick={(e) => { e.stopPropagation(); handleCancelSchedule(nl.id); }} disabled={cancellingSchedule}>
                          {cancellingSchedule ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Cancel schedule"}
                        </Button>
                      )}
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
      </div>
    </div>
  );
}
