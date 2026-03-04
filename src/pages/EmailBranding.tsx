import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Save, Send, Palette, Plus, Pencil, Trash2, Upload, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmailTemplatePreview, type EmailTemplatePreviewStyle } from "@/components/email/EmailTemplatePreview";
import { SendTestEmailButton } from "@/components/email/SendTestEmailButton";
import { PreviewErrorBoundary } from "@/components/PreviewErrorBoundary";
import { LogoUpload } from "@/components/ui/logo-upload";
import { TemplateStyleSelector, type EmailTemplateStyle } from "@/components/email/TemplateStyleSelector";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";

/** Build HTML for the structured footer signature (closing, name, title, company, phone, email, website, address). Set includeEmail false to omit email (From: already shows it). */
function buildStructuredSignatureHtml(opts: {
  closing?: string | null;
  name?: string | null;
  title?: string | null;
  company?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  address?: string | null;
  includeEmail?: boolean;
}): string {
  const includeEmail = opts.includeEmail !== false;
  const parts: string[] = [];
  if (opts.closing?.trim()) parts.push(opts.closing.trim());
  if (opts.name?.trim()) parts.push(opts.name.trim());
  if (opts.title?.trim()) parts.push(opts.title.trim());
  if (opts.company?.trim()) parts.push(opts.company.trim());
  if (opts.phone?.trim()) parts.push(`Phone: ${opts.phone.trim()}`);
  if (includeEmail && opts.email?.trim()) parts.push(`📧 ${opts.email.trim()}`);
  if (opts.website?.trim()) {
    const url = opts.website.trim().startsWith("http") ? opts.website.trim() : `https://${opts.website.trim()}`;
    parts.push(`🌐 ${url}`);
  }
  if (opts.address?.trim()) parts.push(`📍 ${opts.address.trim()}`);
  if (parts.length === 0) return "";
  return parts.map((p) => `<p style="margin:0 0 2px 0;">${p.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>`).join("");
}

export default function EmailBranding() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [profile, setProfile] = useState({ full_name: "", job_title: "", avatar_url: "" });
  const [businessProfile, setBusinessProfile] = useState({
    company_name: "",
    services_description: "",
    email_header_name: "",
    email_logo_url: "",
    email_brand_color: "#8b5cf6",
    email_footer_text: "",
    email_footer_image_url: "",
    email_footer_logo_url: "",
    email_sender_image_url: "",
    email_sender_name: "",
    email_signature_name: "",
    email_sender_title: "",
    email_sender_email: "",
    email_signature: "",
    email_signature_closing: "Best regards,",
    email_sender_phone: "",
    email_sender_address: "",
    email_signature_use_structured: true,
    email_signature_show_email: true,
    email_template_style: "professional",
    website: "",
  });

  const [senderProfileDialogOpen, setSenderProfileDialogOpen] = useState(false);
  const [editingSenderProfileId, setEditingSenderProfileId] = useState<string | null>(null);
  const [profileTestEmail, setProfileTestEmail] = useState("");
  const [sendingProfileTest, setSendingProfileTest] = useState(false);
  const [profileTestConnectionId, setProfileTestConnectionId] = useState("");
  const [senderProfileForm, setSenderProfileForm] = useState({
    name: "",
    display_name: "",
    logo_url: "",
    brand_color: "#8b5cf6",
    footer_text: "",
    footer_image_url: "",
    footer_logo_url: "",
    signature: "",
    signature_closing: "Best regards,",
    sender_phone: "",
    sender_address: "",
    signature_use_structured: true,
    signature_show_email: true,
    signature_company: "",
    template_style: "professional" as "professional" | "minimal" | "modern" | "creative" | "corporate" | "bold" | "elegant",
    sender_name: "",
    signature_name: "",
    sender_email: "",
    sender_title: "",
    sender_image_url: "",
    website_url: "",
  });
  const [savingSenderProfile, setSavingSenderProfile] = useState(false);
  const [previewProfileId, setPreviewProfileId] = useState<string>("default");
  const [senderPreviewMode, setSenderPreviewMode] = useState<'email' | 'newsletter'>('email');
  const PREFILL_NONE = "__none__";
  const [prefillFromProfileId, setPrefillFromProfileId] = useState<string>(PREFILL_NONE);

  const defaultFooterLogoRef = useRef<HTMLInputElement>(null);
  const defaultSenderImgRef = useRef<HTMLInputElement>(null);
  const senderFooterLogoRef = useRef<HTMLInputElement>(null);
  const senderImageRef = useRef<HTMLInputElement>(null);
  const [uploadingFooterLogo, setUploadingFooterLogo] = useState<"default" | "sender" | null>(null);
  const [uploadingDefaultSenderImg, setUploadingDefaultSenderImg] = useState(false);
  const [uploadingSenderImage, setUploadingSenderImage] = useState(false);

  const handleFooterLogoUpload = async (file: File, target: "default" | "sender") => {
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "File too large", description: "Please select an image under 5MB", variant: "destructive" });
      return;
    }
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'];
    if (!validTypes.includes(file.type)) {
      toast({ title: "Invalid file type", description: "Please select JPG, PNG, WEBP, or SVG", variant: "destructive" });
      return;
    }
    try {
      setUploadingFooterLogo(target);
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) throw new Error("Not authenticated");

      const fileExt = file.name.split('.').pop();
      const fileName = `${authUser.id}/footer-logos/${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from('email-branding').upload(fileName, file, { upsert: true });
      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from('email-branding').getPublicUrl(fileName);
      const publicUrl = data.publicUrl;

      if (target === "default") {
        setBusinessProfile(bp => ({ ...bp, email_footer_logo_url: publicUrl }));
      } else {
        setSenderProfileForm(f => ({ ...f, footer_logo_url: publicUrl }));
      }
      toast({ title: "Uploaded", description: "Footer logo uploaded successfully" });
    } catch (error: any) {
      toast({ title: "Upload failed", description: error.message || "Failed to upload logo", variant: "destructive" });
    } finally {
      setUploadingFooterLogo(null);
    }
  };

  const handleDefaultSenderImageUpload = async (file: File) => {
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "File too large", description: "Please select an image under 5MB", variant: "destructive" });
      return;
    }
    const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      toast({ title: "Invalid file type", description: "Please select JPG, PNG, or WEBP", variant: "destructive" });
      return;
    }
    try {
      setUploadingDefaultSenderImg(true);
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) throw new Error("Not authenticated");
      const fileExt = file.name.split('.').pop();
      const fileName = `${authUser.id}/default-sender-images/${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from('email-branding').upload(fileName, file, { upsert: true });
      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from('email-branding').getPublicUrl(fileName);
      setBusinessProfile(bp => ({ ...bp, email_sender_image_url: data.publicUrl }));
      toast({ title: "Uploaded", description: "Default signature photo uploaded" });
    } catch (error: any) {
      toast({ title: "Upload failed", description: error.message || "Failed to upload image", variant: "destructive" });
    } finally {
      setUploadingDefaultSenderImg(false);
    }
  };

  const handleSenderImageUpload = async (file: File) => {
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "File too large", description: "Please select an image under 5MB", variant: "destructive" });
      return;
    }
    const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      toast({ title: "Invalid file type", description: "Please select JPG, PNG, or WEBP", variant: "destructive" });
      return;
    }
    try {
      setUploadingSenderImage(true);
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) throw new Error("Not authenticated");
      const fileExt = file.name.split('.').pop();
      const fileName = `${authUser.id}/sender-images/${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from('email-branding').upload(fileName, file, { upsert: true });
      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from('email-branding').getPublicUrl(fileName);
      setSenderProfileForm(f => ({ ...f, sender_image_url: data.publicUrl }));
      toast({ title: "Uploaded", description: "Sender image uploaded" });
    } catch (error: any) {
      toast({ title: "Upload failed", description: error.message || "Failed to upload image", variant: "destructive" });
    } finally {
      setUploadingSenderImage(false);
    }
  };

  const { data: senderProfiles = [], refetch: refetchSenderProfiles } = useQuery({
    queryKey: ['sender-profiles', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from('sender_profiles')
        .select('*')
        .eq('user_id', user.id)
        .order('sort_order', { ascending: true })
        .order('name', { ascending: true });
      if (error) {
        console.error('Sender profiles fetch error:', error);
        return [];
      }
      return data || [];
    },
    enabled: !!user?.id,
  });

  const { data: profileConnections = [] } = useQuery({
    queryKey: ["crm-connections-email-branding", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("crm_connections")
        .select("id, provider, from_email, status")
        .eq("user_id", user.id)
        .eq("status", "active")
        .in("provider", ["gmail", "gmail_direct", "resend", "sendgrid"]);
      if (error) return [];
      return (data || []).sort((a: { provider: string }, b: { provider: string }) => {
        const r = (p: string) => (p === "gmail" || p === "gmail_direct" ? 0 : p === "resend" ? 1 : 2);
        return r(a.provider) - r(b.provider);
      });
    },
    enabled: !!user?.id && senderProfileDialogOpen,
  });

  useEffect(() => {
    if (profileConnections.length > 0 && !profileTestConnectionId) {
      setProfileTestConnectionId(profileConnections[0].id);
    }
  }, [profileConnections, profileTestConnectionId]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) {
        setLoading(false);
        return;
      }

      const { data: profileData } = await supabase
        .from("profiles")
        .select("full_name, job_title, avatar_url")
        .eq("id", authUser.id)
        .maybeSingle();

      if (profileData) {
        setProfile({
          full_name: profileData.full_name || "",
          job_title: profileData.job_title || "",
          avatar_url: profileData.avatar_url || "",
        });
      }

      const { data, error } = await supabase
        .from("business_profiles")
        .select("company_name, services_description, email_header_name, email_logo_url, email_brand_color, email_footer_text, email_footer_image_url, email_footer_logo_url, email_sender_image_url, email_sender_name, email_signature_name, email_sender_title, email_sender_email, email_signature, email_signature_closing, email_sender_phone, email_sender_address, email_signature_use_structured, signature_show_email, email_template_style, website")
        .eq("user_id", authUser.id)
        .single();

      if (error && error.code !== "PGRST116") throw error;

      if (data) {
        setBusinessProfile({
          company_name: data.company_name || "",
          services_description: data.services_description ?? "",
          email_header_name: data.email_header_name || "",
          email_logo_url: data.email_logo_url || "",
          email_brand_color: data.email_brand_color || "#8b5cf6",
          email_footer_text: data.email_footer_text || "",
          email_footer_image_url: data.email_footer_image_url || "",
          email_footer_logo_url: data.email_footer_logo_url || "",
          email_sender_image_url: data.email_sender_image_url || "",
          email_sender_name: data.email_sender_name || "",
          email_signature_name: data.email_signature_name || "",
          email_sender_title: data.email_sender_title || "",
          email_sender_email: data.email_sender_email || "",
          email_signature: data.email_signature || "",
          email_signature_closing: data.email_signature_closing ?? "Best regards,",
          email_sender_phone: data.email_sender_phone || "",
          email_sender_address: data.email_sender_address || "",
          email_signature_use_structured: data.email_signature_use_structured ?? true,
          email_signature_show_email: (data as { signature_show_email?: boolean }).signature_show_email !== false,
          email_template_style: data.email_template_style || "professional",
          website: data.website || "",
        });
      }
    } catch (error) {
      console.error("Error loading branding data:", error);
      toast({ title: "Error", description: "Failed to load branding settings", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveBranding = async () => {
    try {
      setSaving(true);
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) throw new Error("Not authenticated");

      const signatureToSave = businessProfile.email_signature_use_structured
        ? buildStructuredSignatureHtml({
            closing: businessProfile.email_signature_closing,
            name: businessProfile.email_signature_name || businessProfile.email_sender_name,
            title: businessProfile.email_sender_title,
            company: businessProfile.company_name,
            phone: businessProfile.email_sender_phone,
            email: businessProfile.email_sender_email,
            website: businessProfile.website,
            address: businessProfile.email_sender_address,
            includeEmail: businessProfile.email_signature_show_email,
          }) || null
        : (businessProfile.email_signature || null);

      const brandingFields = {
        company_name: businessProfile.company_name || null,
        services_description: businessProfile.services_description || "",
        email_header_name: businessProfile.email_header_name || null,
        email_logo_url: businessProfile.email_logo_url || null,
        email_brand_color: businessProfile.email_brand_color,
        email_footer_text: businessProfile.email_footer_text || null,
        email_footer_image_url: businessProfile.email_footer_image_url || null,
        email_footer_logo_url: businessProfile.email_footer_logo_url || null,
        email_sender_image_url: businessProfile.email_sender_image_url || null,
        email_sender_name: businessProfile.email_sender_name || null,
        email_signature_name: businessProfile.email_signature_name ?? null,
        email_sender_title: businessProfile.email_sender_title || null,
        email_sender_email: businessProfile.email_sender_email || null,
        email_signature: signatureToSave,
        email_signature_closing: businessProfile.email_signature_closing || null,
        email_sender_phone: businessProfile.email_sender_phone || null,
        email_sender_address: businessProfile.email_sender_address || null,
        email_signature_use_structured: businessProfile.email_signature_use_structured,
        signature_show_email: businessProfile.email_signature_show_email,
        email_template_style: businessProfile.email_template_style,
        website: businessProfile.website || null,
      };

      const { count } = await supabase
        .from("business_profiles")
        .select("id", { count: "exact", head: true })
        .eq("user_id", authUser.id);

      if (count && count > 0) {
        const { error } = await supabase
          .from("business_profiles")
          .update(brandingFields)
          .eq("user_id", authUser.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("business_profiles")
          .insert({ user_id: authUser.id, services_description: "", ...brandingFields });
        if (error) throw error;
      }
      toast({ title: "Saved", description: "Email branding updated." });
    } catch (error: any) {
      console.error("Error saving branding:", error);
      toast({ title: "Error", description: error.message || "Failed to save branding", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const senderTemplateStyles = ["professional", "minimal", "modern", "creative", "corporate", "bold", "elegant"] as const;

  const openAddSenderProfile = () => {
    setEditingSenderProfileId(null);
    setPrefillFromProfileId(PREFILL_NONE);
    setSenderProfileForm({ name: "", display_name: "", logo_url: "", brand_color: "#8b5cf6", footer_text: "", footer_image_url: "", footer_logo_url: "", signature: "", signature_closing: "Best regards,", sender_phone: "", sender_address: "", signature_use_structured: true, signature_show_email: true, signature_company: "", template_style: "professional", sender_name: "", signature_name: "", sender_email: "", sender_title: "", sender_image_url: "", website_url: "" });
    setSenderProfileDialogOpen(true);
  };

  const applyPrefillFromProfile = (profileId: string) => {
    const p = senderProfiles.find((x) => x.id === profileId);
    if (!p) return;
    setSenderProfileForm({
      name: "", // Leave empty so user enters new profile label
      display_name: p.display_name || "",
      logo_url: p.logo_url || "",
      brand_color: p.brand_color || "#8b5cf6",
      footer_text: p.footer_text || "",
      footer_image_url: p.footer_image_url || "",
      footer_logo_url: p.footer_logo_url || "",
      signature: p.signature || "",
      signature_closing: p.signature_closing ?? "Best regards,",
      sender_phone: p.sender_phone || "",
      sender_address: p.sender_address || "",
      signature_use_structured: p.signature_use_structured ?? true,
      signature_show_email: (p as { signature_show_email?: boolean }).signature_show_email !== false,
      signature_company: p.signature_company || "",
      template_style: ((senderTemplateStyles as readonly string[]).includes(p.template_style as any) ? p.template_style : "professional") as typeof senderProfileForm.template_style,
      sender_name: p.sender_name || "",
      signature_name: p.signature_name || "",
      sender_email: p.sender_email || "",
      sender_title: p.sender_title || "",
      sender_image_url: p.sender_image_url || "",
      website_url: p.website_url || "",
    });
  };

  const openEditSenderProfile = (p: any) => {
    setEditingSenderProfileId(p.id);
    setSenderProfileForm({
      name: p.name,
      display_name: p.display_name || "",
      logo_url: p.logo_url || "",
      brand_color: p.brand_color || "#8b5cf6",
      footer_text: p.footer_text || "",
      footer_image_url: p.footer_image_url || "",
      footer_logo_url: p.footer_logo_url || "",
      signature: p.signature || "",
      signature_closing: p.signature_closing ?? "Best regards,",
      sender_phone: p.sender_phone || "",
      sender_address: p.sender_address || "",
      signature_use_structured: p.signature_use_structured ?? true,
      signature_show_email: (p as { signature_show_email?: boolean }).signature_show_email !== false,
      signature_company: p.signature_company || "",
      template_style: ((senderTemplateStyles as readonly string[]).includes(p.template_style as any) ? p.template_style : "professional") as typeof senderProfileForm.template_style,
      sender_name: p.sender_name || "",
      signature_name: p.signature_name || "",
      sender_email: p.sender_email || "",
      sender_title: p.sender_title || "",
      sender_image_url: p.sender_image_url || "",
      website_url: p.website_url || "",
    });
    setSenderProfileDialogOpen(true);
  };

  const handleSaveSenderProfile = async () => {
    if (!user?.id || !senderProfileForm.name.trim()) return;
    try {
      setSavingSenderProfile(true);
      const signatureToSave = senderProfileForm.signature_use_structured
        ? buildStructuredSignatureHtml({
            closing: senderProfileForm.signature_closing,
            name: senderProfileForm.signature_name || senderProfileForm.sender_name,
            title: senderProfileForm.sender_title,
            company: senderProfileForm.signature_company,
            phone: senderProfileForm.sender_phone,
            email: senderProfileForm.sender_email,
            website: senderProfileForm.website_url,
            address: senderProfileForm.sender_address,
            includeEmail: senderProfileForm.signature_show_email,
          }) || null
        : (senderProfileForm.signature || null);

      const senderPayload = {
        name: senderProfileForm.name.trim(),
        display_name: senderProfileForm.display_name.trim() || null,
        logo_url: senderProfileForm.logo_url || null,
        brand_color: senderProfileForm.brand_color || null,
        footer_text: senderProfileForm.footer_text || null,
        footer_image_url: senderProfileForm.footer_image_url || null,
        footer_logo_url: senderProfileForm.footer_logo_url || null,
        signature: signatureToSave,
        signature_closing: senderProfileForm.signature_closing || null,
        sender_phone: senderProfileForm.sender_phone.trim() || null,
        sender_address: senderProfileForm.sender_address.trim() || null,
        signature_use_structured: senderProfileForm.signature_use_structured,
        signature_show_email: senderProfileForm.signature_show_email,
        signature_company: senderProfileForm.signature_company.trim() || null,
        template_style: senderProfileForm.template_style,
        sender_name: senderProfileForm.sender_name.trim() || null,
        signature_name: senderProfileForm.signature_name.trim() || null,
        sender_email: senderProfileForm.sender_email.trim() || null,
        sender_title: senderProfileForm.sender_title.trim() || null,
        sender_image_url: senderProfileForm.sender_image_url || null,
        website_url: senderProfileForm.website_url.trim() || null,
      };

      if (editingSenderProfileId) {
        const { error } = await supabase
          .from("sender_profiles")
          .update({ ...senderPayload, updated_at: new Date().toISOString() })
          .eq("id", editingSenderProfileId)
          .eq("user_id", user.id);
        if (error) throw error;
        toast({ title: "Saved", description: "Sender profile updated." });
      } else {
        const { error } = await supabase.from("sender_profiles").insert({
          user_id: user.id,
          ...senderPayload,
          sort_order: senderProfiles.length,
        });
        if (error) throw error;
        toast({ title: "Created", description: "Sender profile added." });
      }
      refetchSenderProfiles();
      setSenderProfileDialogOpen(false);
    } catch (e: any) {
      toast({ title: "Error", description: e.message || "Failed to save sender profile", variant: "destructive" });
    } finally {
      setSavingSenderProfile(false);
    }
  };

  const handleDeleteSenderProfile = async (id: string) => {
    if (!user?.id) return;
    if (!confirm("Remove this sender profile?")) return;
    try {
      const { error } = await supabase.from("sender_profiles").delete().eq("id", id).eq("user_id", user.id);
      if (error) throw error;
      toast({ title: "Removed", description: "Sender profile deleted." });
      refetchSenderProfiles();
      setSenderProfileDialogOpen(false);
    } catch (e: any) {
      toast({ title: "Error", description: e.message || "Failed to delete", variant: "destructive" });
    }
  };

  const handleSendProfileTest = async () => {
    const to = profileTestEmail.trim();
    if (!to) {
      toast({ title: "Enter an email", description: "Provide the address to send the test to.", variant: "destructive" });
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
      toast({ title: "Invalid email", description: "Enter a valid email address.", variant: "destructive" });
      return;
    }
    try {
      setSendingProfileTest(true);
      const signatureToSend = senderProfileForm.signature_use_structured
        ? (buildStructuredSignatureHtml({
            closing: senderProfileForm.signature_closing,
            name: senderProfileForm.signature_name || senderProfileForm.sender_name,
            title: senderProfileForm.sender_title,
            company: senderProfileForm.signature_company,
            phone: senderProfileForm.sender_phone,
            email: senderProfileForm.sender_email,
            website: senderProfileForm.website_url,
            address: senderProfileForm.sender_address,
            includeEmail: senderProfileForm.signature_show_email,
          }) || undefined)
        : (senderProfileForm.signature?.trim() || undefined);
      const { data, error } = await supabase.functions.invoke("send-test-email", {
        body: {
          testEmail: to,
          templateStyle: senderProfileForm.template_style || "professional",
          brandColor: senderProfileForm.brand_color || "#8b5cf6",
          logoUrl: senderProfileForm.logo_url || null,
          companyName: senderProfileForm.display_name || senderProfileForm.signature_company || businessProfile.company_name || "",
          footerText: senderProfileForm.footer_text || null,
          signature: signatureToSend,
          websiteUrl: senderProfileForm.website_url || null,
          headerName: senderProfileForm.display_name || null,
          senderName: senderProfileForm.sender_name || senderProfileForm.display_name || null,
          signatureName: senderProfileForm.signature_name || null,
          senderEmail: senderProfileForm.sender_email || null,
          senderTitle: senderProfileForm.sender_title || null,
          senderImageUrl: senderProfileForm.sender_image_url || null,
          footerImageUrl: senderProfileForm.footer_logo_url || senderProfileForm.logo_url || null,
          senderConnectionId: profileTestConnectionId || undefined,
        },
      });
      if (error) {
        let msg = (data as any)?.error ?? error?.message ?? "Failed to send test";
        const ctx = (error as { context?: Response })?.context;
        if (ctx && typeof (ctx as Response).json === "function") {
          try {
            const body = await (ctx as Response).json();
            if (body?.error) msg = body.error;
          } catch (_) {}
        }
        throw new Error(msg);
      }
      toast({ title: "Test sent", description: `Check ${to} for the test email.` });
    } catch (e: any) {
      toast({ title: "Error", description: e?.message || "Failed to send test", variant: "destructive" });
    } finally {
      setSendingProfileTest(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 sm:p-6 max-w-4xl space-y-6 min-w-0">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center">
          <Palette className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Email Branding</h1>
          <p className="text-sm text-muted-foreground">Customize the appearance of your emails</p>
        </div>
      </div>

      {/* Default branding */}
      <Card>
        <CardHeader>
          <CardTitle>Default Branding</CardTitle>
          <CardDescription>
            Template style, brand color, logo, footer, and signature used when no sender profile is selected.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="company_name">Company Name <span className="text-muted-foreground font-normal">(CRM / internal)</span></Label>
            <Input
              id="company_name"
              value={businessProfile.company_name}
              onChange={(e) => setBusinessProfile({ ...businessProfile, company_name: e.target.value })}
              placeholder="e.g. Biz Boosters Ltd"
            />
            <p className="text-xs text-muted-foreground">Used in signatures and footers. Also your business name in the CRM.</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="email_header_name">Email Header Name <span className="text-muted-foreground font-normal">(optional)</span></Label>
            <Input
              id="email_header_name"
              value={businessProfile.email_header_name}
              onChange={(e) => setBusinessProfile({ ...businessProfile, email_header_name: e.target.value })}
              placeholder="e.g. BIZ BOOSTERS"
            />
            <p className="text-xs text-muted-foreground">Brand name shown in the email header banner. Leave empty to hide the name from the header.</p>
          </div>

          <TemplateStyleSelector
            value={businessProfile.email_template_style as EmailTemplateStyle}
            onChange={(value) => setBusinessProfile({ ...businessProfile, email_template_style: value })}
            showPreview={true}
          />

          <div className="space-y-2">
            <Label htmlFor="email_brand_color">Brand Color</Label>
            <div className="flex gap-2">
              <Input
                id="email_brand_color"
                type="color"
                value={businessProfile.email_brand_color}
                onChange={(e) => setBusinessProfile({ ...businessProfile, email_brand_color: e.target.value })}
                className="w-20 h-10"
              />
              <Input
                value={businessProfile.email_brand_color}
                onChange={(e) => setBusinessProfile({ ...businessProfile, email_brand_color: e.target.value })}
                placeholder="#8b5cf6"
                className="flex-1"
              />
            </div>
            <p className="text-xs text-muted-foreground">Primary color for email headers and accents</p>
          </div>

          <LogoUpload
            currentLogoUrl={businessProfile.email_logo_url}
            onUploadSuccess={(url) => setBusinessProfile({ ...businessProfile, email_logo_url: url })}
            updateBusinessProfile={true}
          />

          {/* Email footer (company footer at bottom of email) */}
          <div className="space-y-4 rounded-lg border p-4 bg-muted/30">
            <div>
              <h3 className="text-sm font-semibold">Email footer</h3>
              <p className="text-xs text-muted-foreground">Text and optional logo at the bottom of every email (e.g. copyright).</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="email_footer_text">Footer text</Label>
              <Textarea
                id="email_footer_text"
                value={businessProfile.email_footer_text}
                onChange={(e) => setBusinessProfile({ ...businessProfile, email_footer_text: e.target.value })}
                placeholder={`© ${new Date().getFullYear()} ${businessProfile.company_name || 'Your Company'}. All rights reserved.`}
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label>Footer business logo (optional)</Label>
              <div className="flex flex-wrap gap-3 items-center">
                {businessProfile.email_footer_logo_url ? (
                  <div className="relative shrink-0">
                    <img src={businessProfile.email_footer_logo_url} alt="" className="h-14 w-14 rounded object-cover border-2" />
                    <Button
                      type="button"
                      variant="destructive"
                      size="icon"
                      className="absolute -top-1 -right-1 h-5 w-5 rounded-full"
                      onClick={() => setBusinessProfile({ ...businessProfile, email_footer_logo_url: "" })}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ) : (
                  <div className="h-14 w-14 rounded border-2 border-dashed flex items-center justify-center bg-muted/50 shrink-0">
                    <Upload className="h-5 w-5 text-muted-foreground" />
                  </div>
                )}
                <div className="flex flex-wrap gap-1.5">
                  <input
                    ref={defaultFooterLogoRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/svg+xml"
                    className="sr-only"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleFooterLogoUpload(file, "default");
                      e.target.value = "";
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="text-xs"
                    disabled={uploadingFooterLogo === "default"}
                    onClick={() => defaultFooterLogoRef.current?.click()}
                  >
                    {uploadingFooterLogo === "default" ? (
                      <><Loader2 className="h-3 w-3 mr-1.5 animate-spin" />Uploading...</>
                    ) : (
                      <><Upload className="h-3 w-3 mr-1.5" />{businessProfile.email_footer_logo_url ? 'Change' : 'Upload'}</>
                    )}
                  </Button>
                  {businessProfile.email_logo_url && (
                    <Button type="button" variant="ghost" size="sm" className="text-xs h-8" onClick={() => setBusinessProfile({ ...businessProfile, email_footer_logo_url: businessProfile.email_logo_url })}>Use company logo</Button>
                  )}
                </div>
              </div>
              <p className="text-xs text-muted-foreground">Company logo shown in the email footer next to the footer text.</p>
            </div>
          </div>

          {/* Sender (From) – professional sender profile (what recipients see) */}
          <div className="space-y-4 rounded-lg border p-4 bg-muted/30">
            <div>
              <h3 className="text-sm font-semibold">Sender profile – what recipients see</h3>
              <p className="text-xs text-muted-foreground">Photo, name and email for the sender. Shown in the inbox and next to your signature in the email body. Leave blank to use your account details.</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-4 items-start">
              <div className="flex flex-col items-center gap-2 shrink-0">
                {businessProfile.email_sender_image_url ? (
                  <div className="relative">
                    <img src={businessProfile.email_sender_image_url} alt="" className="h-20 w-20 rounded-full object-cover border-2 border-border shadow-sm" />
                    <Button type="button" variant="destructive" size="icon" className="absolute -top-0.5 -right-0.5 h-6 w-6 rounded-full" onClick={() => setBusinessProfile({ ...businessProfile, email_sender_image_url: "" })}><X className="h-3 w-3" /></Button>
                  </div>
                ) : (
                  <div className="h-20 w-20 rounded-full border-2 border-dashed flex items-center justify-center bg-muted/50 shrink-0">
                    <Upload className="h-8 w-8 text-muted-foreground" />
                  </div>
                )}
                <input ref={defaultSenderImgRef} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => { const file = e.target.files?.[0]; if (file) handleDefaultSenderImageUpload(file); e.target.value = ""; }} />
                <Button type="button" variant="outline" size="sm" className="text-xs w-full" disabled={uploadingDefaultSenderImg} onClick={() => defaultSenderImgRef.current?.click()}>
                  {uploadingDefaultSenderImg ? <><Loader2 className="h-3 w-3 mr-1.5 animate-spin" />Uploading...</> : <><Upload className="h-3 w-3 mr-1.5" />{businessProfile.email_sender_image_url ? 'Change' : 'Upload photo'}</>}
                </Button>
              </div>
              <div className="flex-1 grid gap-3 sm:grid-cols-1 w-full min-w-0">
                <div className="space-y-1.5">
                  <Label htmlFor="from_display_name" className="text-xs">From name</Label>
                  <Input
                    id="from_display_name"
                    value={businessProfile.email_sender_name}
                    onChange={(e) => setBusinessProfile({ ...businessProfile, email_sender_name: e.target.value })}
                    placeholder="e.g. Sales Team"
                  />
                  <p className="text-xs text-muted-foreground">Name shown as the sender (From line). Independent of the signature name below.</p>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="signature_display_name" className="text-xs">Signature name</Label>
                  <Input
                    id="signature_display_name"
                    value={businessProfile.email_signature_name}
                    onChange={(e) => setBusinessProfile({ ...businessProfile, email_signature_name: e.target.value })}
                    placeholder="e.g. Michael Orji"
                  />
                  <p className="text-xs text-muted-foreground">Name shown in the email signature block only. Leave blank to use From name.</p>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="from_email" className="text-xs">From email address</Label>
                  <Input
                    id="from_email"
                    type="email"
                    value={businessProfile.email_sender_email}
                    onChange={(e) => setBusinessProfile({ ...businessProfile, email_sender_email: e.target.value })}
                    placeholder="e.g. sales@bizboosters.co.uk"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Footer signature (body) */}
          <div className="space-y-4 rounded-lg border p-4 bg-muted/30">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold">Footer signature</h3>
                <p className="text-xs text-muted-foreground">The block at the bottom of the email body (e.g. Best regards, name, title, company). The <strong>name</strong> line comes from &quot;Signature name&quot; above (or From name if blank). Closing line, title, company and contact details are set below.</p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive shrink-0"
                onClick={() => setBusinessProfile({
                  ...businessProfile,
                  email_signature: "",
                  email_signature_closing: "",
                })}
              >
                <Trash2 className="h-3.5 w-3.5 mr-1" />Clear signature
              </Button>
            </div>
            <Tabs value={businessProfile.email_signature_use_structured ? "structured" : "custom"} onValueChange={(v) => setBusinessProfile({ ...businessProfile, email_signature_use_structured: v === "structured" })}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="structured">Fill manually</TabsTrigger>
                <TabsTrigger value="custom">Custom HTML</TabsTrigger>
              </TabsList>
              <TabsContent value="structured" className="space-y-4 pt-4">
                <p className="text-xs text-muted-foreground">Name and email are taken from the &quot;Sender (From)&quot; section above. Add closing line, title, company, phone, website and address below.</p>
                <div className="space-y-2">
                  <Label className="text-xs">Closing line</Label>
                  <Input
                    value={businessProfile.email_signature_closing}
                    onChange={(e) => setBusinessProfile({ ...businessProfile, email_signature_closing: e.target.value })}
                    placeholder="e.g. Best regards,"
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Title</Label>
                    <Input
                      value={businessProfile.email_sender_title}
                      onChange={(e) => setBusinessProfile({ ...businessProfile, email_sender_title: e.target.value })}
                      placeholder="e.g. Founder"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Company</Label>
                    <Input
                      value={businessProfile.company_name}
                      onChange={(e) => setBusinessProfile({ ...businessProfile, company_name: e.target.value })}
                      placeholder="e.g. Biz Boosters Ltd"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Phone</Label>
                  <Input
                    value={businessProfile.email_sender_phone}
                    onChange={(e) => setBusinessProfile({ ...businessProfile, email_sender_phone: e.target.value })}
                    placeholder="e.g. +44 7471 245972"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Website</Label>
                  <Input
                    type="url"
                    value={businessProfile.website}
                    onChange={(e) => setBusinessProfile({ ...businessProfile, website: e.target.value })}
                    placeholder="e.g. https://bizboosters.co.uk"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Address / location</Label>
                  <Input
                    value={businessProfile.email_sender_address}
                    onChange={(e) => setBusinessProfile({ ...businessProfile, email_sender_address: e.target.value })}
                    placeholder="e.g. LaunchSpace, UWE - Bristol, BS34 8RB, UK"
                  />
                </div>
                <div className="flex items-center justify-between rounded-lg border p-3 bg-muted/20">
                  <div>
                    <Label className="text-xs font-medium">Show email in signature</Label>
                    <p className="text-xs text-muted-foreground">Turn off to omit the From address from the signature block (recipients already see it in the email header). Keeps one domain uniform.</p>
                  </div>
                  <Switch
                    checked={businessProfile.email_signature_show_email}
                    onCheckedChange={(checked) => setBusinessProfile({ ...businessProfile, email_signature_show_email: checked })}
                  />
                </div>
              </TabsContent>
              <TabsContent value="custom" className="pt-4">
                <Label htmlFor="email_signature" className="text-xs">Custom email signature (HTML)</Label>
                <Textarea
                  id="email_signature"
                  value={businessProfile.email_signature}
                  onChange={(e) => setBusinessProfile({ ...businessProfile, email_signature: e.target.value })}
                  placeholder="e.g. <p>Best regards,</p><p>Your name</p>"
                  rows={6}
                  className="font-mono text-sm mt-2"
                />
                <p className="text-xs text-muted-foreground mt-1">Optional. Overrides the structured signature when you save.</p>
              </TabsContent>
            </Tabs>
          </div>

          <div className="flex flex-wrap gap-2 items-center justify-end sm:justify-between pt-4">
            <SendTestEmailButton
              templateStyle={businessProfile.email_template_style}
              brandColor={businessProfile.email_brand_color}
              logoUrl={businessProfile.email_logo_url || undefined}
              companyName={businessProfile.company_name || undefined}
              footerText={businessProfile.email_footer_text || undefined}
              signature={businessProfile.email_signature || undefined}
              websiteUrl={businessProfile.website || undefined}
            />
            <Button onClick={handleSaveBranding} disabled={saving} className="shrink-0">
              {saving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving...</> : <><Save className="h-4 w-4 mr-2" />Save Branding</>}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Sender profiles */}
      <Card>
        <CardHeader>
          <CardTitle>Sender Profiles</CardTitle>
          <CardDescription>
            Each sender profile has its own name, email, logo, footer, brand color, and template style. Choose one when sending bulk or single emails.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {senderProfiles.length === 0 ? (
            <p className="text-sm text-muted-foreground">No sender profiles yet. Add one to send as a different brand.</p>
          ) : (
            <ul className="space-y-2">
              {senderProfiles.map((p) => (
                <li key={p.id} className="flex items-center justify-between rounded-lg border p-3">
                  <div className="flex items-center gap-3">
                    {p.logo_url ? (
                      <img src={p.logo_url} alt="" className="h-8 w-auto object-contain" />
                    ) : (
                      <div className="h-8 w-8 rounded bg-muted flex items-center justify-center text-xs font-medium" style={{ backgroundColor: (p.brand_color || "#8b5cf6") + "20", color: p.brand_color || "#8b5cf6" }}>{p.name.slice(0, 2).toUpperCase()}</div>
                    )}
                    <div>
                      <span className="font-medium">{p.name}</span>
                      <span className="ml-2 text-xs text-muted-foreground capitalize">{p.template_style || 'professional'}</span>
                      {(p.sender_name || p.sender_email) && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {p.sender_name}{p.sender_name && p.sender_email ? ' · ' : ''}{p.sender_email}
                          {p.sender_title ? ` · ${p.sender_title}` : ''}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="icon" onClick={() => openEditSenderProfile(p)} aria-label="Edit">
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDeleteSenderProfile(p.id)} aria-label="Delete">
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <Button variant="outline" onClick={openAddSenderProfile} className="w-full sm:w-auto">
            <Plus className="h-4 w-4 mr-2" />
            Add sender profile
          </Button>
        </CardContent>
      </Card>

      {/* Preview with profile switcher – wrapped so a preview error doesn't break the whole page */}
      <PreviewErrorBoundary>
      {(() => {
        const selectedProfile = previewProfileId !== "default"
          ? senderProfiles.find((p) => p.id === previewProfileId)
          : null;

        const previewTemplate = selectedProfile
          ? (selectedProfile.template_style || 'professional') as EmailTemplatePreviewStyle
          : (businessProfile.email_template_style || 'professional') as EmailTemplatePreviewStyle;
        const previewColor = selectedProfile?.brand_color || businessProfile.email_brand_color;
        const previewLogo = selectedProfile?.logo_url || businessProfile.email_logo_url || undefined;
        const previewHeaderName = selectedProfile?.display_name || businessProfile.email_header_name || undefined;
        const previewCompany = businessProfile.company_name || undefined;
        const previewSenderName = selectedProfile?.sender_name || businessProfile.email_sender_name || profile.full_name || undefined;
        const previewSenderTitle = selectedProfile?.sender_title || businessProfile.email_sender_title || profile.job_title || undefined;
        const previewSenderEmail = selectedProfile?.sender_email || businessProfile.email_sender_email || user?.email || undefined;
        const previewFooter = selectedProfile?.footer_text || businessProfile.email_footer_text || undefined;
        const previewFooterImage = selectedProfile?.footer_logo_url || selectedProfile?.logo_url || businessProfile.email_footer_logo_url || businessProfile.email_logo_url || undefined;
        const previewSenderImage = selectedProfile?.sender_image_url || businessProfile.email_sender_image_url || profile.avatar_url || undefined;
        const previewWebsite = selectedProfile?.website_url || businessProfile.website || undefined;
        const previewSignature = (() => {
          if (selectedProfile) {
            if (selectedProfile.signature_use_structured) {
              const built = buildStructuredSignatureHtml({
                closing: selectedProfile.signature_closing,
                name: selectedProfile.signature_name || selectedProfile.sender_name,
                title: selectedProfile.sender_title,
                company: selectedProfile.signature_company,
                phone: selectedProfile.sender_phone,
                email: selectedProfile.sender_email,
                website: selectedProfile.website_url,
                address: selectedProfile.sender_address,
                includeEmail: (selectedProfile as { signature_show_email?: boolean }).signature_show_email !== false,
              });
              return built || undefined;
            }
            return (selectedProfile.signature ?? "")?.trim() || undefined;
          }
          if (businessProfile.email_signature_use_structured) {
            const built = buildStructuredSignatureHtml({
              closing: businessProfile.email_signature_closing,
              name: businessProfile.email_signature_name || businessProfile.email_sender_name,
              title: businessProfile.email_sender_title,
              company: businessProfile.company_name,
              phone: businessProfile.email_sender_phone,
              email: businessProfile.email_sender_email,
              website: businessProfile.website,
              address: businessProfile.email_sender_address,
              includeEmail: businessProfile.email_signature_show_email,
            });
            return built || undefined;
          }
          return (businessProfile.email_signature ?? "")?.trim() || undefined;
        })();

        return (
          <EmailTemplatePreview
            template={previewTemplate}
            brandColor={previewColor}
            logoUrl={previewLogo || undefined}
            companyName={previewCompany}
            headerName={previewHeaderName}
            senderName={previewSenderName}
            senderTitle={previewSenderTitle}
            senderEmail={previewSenderEmail}
            senderImageUrl={previewSenderImage}
            footerText={previewFooter}
            footerImageUrl={previewFooterImage || undefined}
            websiteUrl={previewWebsite}
            signature={previewSignature}
            headerExtra={
              <Select value={previewProfileId} onValueChange={setPreviewProfileId}>
                <SelectTrigger className="w-[220px]">
                  <SelectValue placeholder="Select profile" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">Default Branding</SelectItem>
                  {senderProfiles.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            }
          />
        );
      })()}
      </PreviewErrorBoundary>

      {/* Sender profile dialog */}
      <Dialog
        open={senderProfileDialogOpen}
        onOpenChange={(open) => {
          setSenderProfileDialogOpen(open);
          if (!open) setPrefillFromProfileId(PREFILL_NONE);
        }}
      >
        <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>{editingSenderProfileId ? "Edit sender profile" : "Add sender profile"}</DialogTitle>
            <DialogDescription>Configure branding and sender identity for this profile.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4 overflow-y-auto min-h-0 pr-2">
            {/* Prefill from existing profile (Add mode only) */}
            {!editingSenderProfileId && senderProfiles.length > 0 && (
              <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
                <Label>Prefill from existing profile</Label>
                <Select
                  value={prefillFromProfileId}
                  onValueChange={(value) => {
                    setPrefillFromProfileId(value);
                    if (value && value !== PREFILL_NONE) applyPrefillFromProfile(value);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Start from scratch or copy a profile…" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={PREFILL_NONE}>None – start from scratch</SelectItem>
                    {senderProfiles.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">Copy all fields from a profile, then edit profile label, logo, etc. and save as new.</p>
              </div>
            )}

            {/* Same order as Default Branding: label, company/header, template, color, logo, email footer, sender profile, footer signature */}

            <div className="space-y-2">
              <Label>Profile Label <span className="text-muted-foreground font-normal">(internal only)</span></Label>
              <Input
                value={senderProfileForm.name}
                onChange={(e) => setSenderProfileForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. TalkWeb Campaign, Biz Boosters Sales"
              />
              <p className="text-xs text-muted-foreground">For your reference only — never shown in emails.</p>
            </div>

            <div className="space-y-2">
              <Label>Email Header Name <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Input
                value={senderProfileForm.display_name}
                onChange={(e) => setSenderProfileForm((f) => ({ ...f, display_name: e.target.value }))}
                placeholder="e.g. BIZ BOOSTERS"
              />
              <p className="text-xs text-muted-foreground">Brand name shown in the email header banner. Leave empty to use default.</p>
            </div>

            <TemplateStyleSelector
              value={senderProfileForm.template_style as EmailTemplateStyle}
              onChange={(value) => setSenderProfileForm((f) => ({ ...f, template_style: value }))}
              showPreview={false}
            />

            <div className="space-y-2">
              <Label>Brand Color</Label>
              <div className="flex gap-2">
                <Input
                  type="color"
                  value={senderProfileForm.brand_color}
                  onChange={(e) => setSenderProfileForm((f) => ({ ...f, brand_color: e.target.value }))}
                  className="w-20 h-10"
                />
                <Input
                  value={senderProfileForm.brand_color}
                  onChange={(e) => setSenderProfileForm((f) => ({ ...f, brand_color: e.target.value }))}
                  placeholder="#8b5cf6"
                  className="flex-1"
                />
              </div>
              <p className="text-xs text-muted-foreground">Primary color for email headers and accents.</p>
            </div>

            <LogoUpload
              currentLogoUrl={senderProfileForm.logo_url || undefined}
              onUploadSuccess={(url) => setSenderProfileForm((f) => ({ ...f, logo_url: url }))}
              updateBusinessProfile={false}
            />

            {/* Email footer — same as default */}
            <div className="space-y-4 rounded-lg border p-4 bg-muted/30">
              <div>
                <h3 className="text-sm font-semibold">Email footer</h3>
                <p className="text-xs text-muted-foreground">Text and optional logo at the bottom of every email (e.g. copyright).</p>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-medium">Footer text</Label>
                <Textarea
                  value={senderProfileForm.footer_text}
                  onChange={(e) => setSenderProfileForm((f) => ({ ...f, footer_text: e.target.value }))}
                  placeholder="© 2025 Company. All rights reserved."
                  rows={2}
                  className="resize-none"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-medium">Footer business logo (optional)</Label>
                <div className="flex flex-wrap gap-3 items-center">
                  {senderProfileForm.footer_logo_url ? (
                    <div className="relative shrink-0">
                      <img src={senderProfileForm.footer_logo_url} alt="" className="h-14 w-14 rounded object-cover border-2 border-border shadow-sm" />
                      <Button
                        type="button"
                        variant="destructive"
                        size="icon"
                        className="absolute -top-0.5 -right-0.5 h-5 w-5 rounded-full"
                        onClick={() => setSenderProfileForm((f) => ({ ...f, footer_logo_url: "" }))}
                      >
                        <X className="h-2.5 w-2.5" />
                      </Button>
                    </div>
                  ) : (
                    <div className="h-14 w-14 rounded border-2 border-dashed flex items-center justify-center bg-muted/50 shrink-0">
                      <Upload className="h-6 w-6 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex flex-wrap gap-1.5">
                    <input
                      ref={senderFooterLogoRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/svg+xml"
                      className="sr-only"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleFooterLogoUpload(file, "sender");
                        e.target.value = "";
                      }}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="text-xs"
                      disabled={uploadingFooterLogo === "sender"}
                      onClick={() => senderFooterLogoRef.current?.click()}
                    >
                      {uploadingFooterLogo === "sender" ? <><Loader2 className="h-3 w-3 mr-1.5 animate-spin" />Uploading...</> : <><Upload className="h-3 w-3 mr-1.5" />{senderProfileForm.footer_logo_url ? "Change" : "Upload"}</>}
                    </Button>
                    {senderProfileForm.logo_url && (
                      <Button type="button" variant="ghost" size="sm" className="text-xs h-8" onClick={() => setSenderProfileForm((f) => ({ ...f, footer_logo_url: f.logo_url }))}>Use profile logo</Button>
                    )}
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">Company logo shown in the email footer next to the footer text.</p>
              </div>
            </div>

            {/* Sender profile – same as default */}
            <div className="space-y-4 rounded-lg border p-4 bg-muted/30">
              <div>
                <h3 className="text-sm font-semibold">Sender profile – what recipients see</h3>
                <p className="text-xs text-muted-foreground">Photo, name and email for the sender. Shown in the inbox and next to your signature in the email body. Leave blank to use your account or connection.</p>
              </div>
              <div className="flex flex-col sm:flex-row gap-4 items-start">
                <div className="flex flex-col items-center gap-2 shrink-0">
                  {senderProfileForm.sender_image_url ? (
                    <div className="relative">
                      <img src={senderProfileForm.sender_image_url} alt="" className="h-20 w-20 rounded-full object-cover border-2 border-border shadow-sm" />
                      <Button type="button" variant="destructive" size="icon" className="absolute -top-0.5 -right-0.5 h-6 w-6 rounded-full" onClick={() => setSenderProfileForm((f) => ({ ...f, sender_image_url: "" }))}><X className="h-3 w-3" /></Button>
                    </div>
                  ) : (
                    <div className="h-20 w-20 rounded-full border-2 border-dashed flex items-center justify-center bg-muted/50 shrink-0">
                      <Upload className="h-8 w-8 text-muted-foreground" />
                    </div>
                  )}
                  <input ref={senderImageRef} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => { const file = e.target.files?.[0]; if (file) handleSenderImageUpload(file); e.target.value = ""; }} />
                  <Button type="button" variant="outline" size="sm" className="text-xs w-full" disabled={uploadingSenderImage} onClick={() => senderImageRef.current?.click()}>
                    {uploadingSenderImage ? <><Loader2 className="h-3 w-3 mr-1.5 animate-spin" />Uploading...</> : <><Upload className="h-3 w-3 mr-1.5" />{senderProfileForm.sender_image_url ? "Change" : "Upload photo"}</>}
                  </Button>
                </div>
                <div className="flex-1 grid gap-3 sm:grid-cols-1 w-full min-w-0">
                  <div className="space-y-1.5">
                    <Label className="text-xs">From name</Label>
                    <Input
                      value={senderProfileForm.sender_name}
                      onChange={(e) => setSenderProfileForm((f) => ({ ...f, sender_name: e.target.value }))}
                      placeholder="e.g. Michael Orji"
                    />
                    <p className="text-xs text-muted-foreground">Name shown in the inbox (From line). Use a real person&apos;s name to help land in Primary instead of Promotions.</p>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Signature name</Label>
                    <Input
                      value={senderProfileForm.signature_name}
                      onChange={(e) => setSenderProfileForm((f) => ({ ...f, signature_name: e.target.value }))}
                      placeholder="e.g. Michael Orji"
                    />
                    <p className="text-xs text-muted-foreground">Name shown in the email signature block only. Leave blank to use From name.</p>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">From email address</Label>
                    <Input
                      type="email"
                      value={senderProfileForm.sender_email}
                      onChange={(e) => setSenderProfileForm((f) => ({ ...f, sender_email: e.target.value }))}
                      placeholder="e.g. sales@bizboosters.com"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Footer signature — same as default */}
            <div className="space-y-4 rounded-lg border p-4 bg-muted/30">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold">Footer signature</h3>
                  <p className="text-xs text-muted-foreground">The block at the bottom of the email body (e.g. Best regards, name, title, company). The <strong>name</strong> line comes from &quot;Signature name&quot; above (or From name if blank). Closing line, title, company, phone, website and address are set below.</p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive shrink-0"
                  onClick={() => setSenderProfileForm((f) => ({
                    ...f,
                    signature: "",
                    signature_closing: "",
                    sender_title: "",
                    signature_company: "",
                    sender_phone: "",
                    sender_address: "",
                  }))}
                >
                  <Trash2 className="h-3.5 w-3.5 mr-1" />Clear signature
                </Button>
              </div>
              <Tabs value={senderProfileForm.signature_use_structured ? "structured" : "custom"} onValueChange={(v) => setSenderProfileForm((f) => ({ ...f, signature_use_structured: v === "structured" }))}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="structured">Fill manually</TabsTrigger>
                  <TabsTrigger value="custom">Custom HTML</TabsTrigger>
                </TabsList>
                <TabsContent value="structured" className="space-y-4 pt-4">
                  <p className="text-xs text-muted-foreground">Name and email are taken from the sender profile above. Add closing line, title, company, phone, website and address below.</p>
                  <div className="space-y-2">
                    <Label className="text-xs">Closing line</Label>
                    <Input
                      value={senderProfileForm.signature_closing}
                      onChange={(e) => setSenderProfileForm((f) => ({ ...f, signature_closing: e.target.value }))}
                      placeholder="e.g. Best regards,"
                    />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Title</Label>
                      <Input
                        value={senderProfileForm.sender_title}
                        onChange={(e) => setSenderProfileForm((f) => ({ ...f, sender_title: e.target.value }))}
                        placeholder="e.g. Founder"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Company</Label>
                      <Input
                        value={senderProfileForm.signature_company}
                        onChange={(e) => setSenderProfileForm((f) => ({ ...f, signature_company: e.target.value }))}
                        placeholder="e.g. Biz Boosters Ltd"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Phone</Label>
                    <Input
                      value={senderProfileForm.sender_phone}
                      onChange={(e) => setSenderProfileForm((f) => ({ ...f, sender_phone: e.target.value }))}
                      placeholder="e.g. +44 7471 245972"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Website</Label>
                    <Input
                      type="url"
                      value={senderProfileForm.website_url}
                      onChange={(e) => setSenderProfileForm((f) => ({ ...f, website_url: e.target.value }))}
                      placeholder="e.g. https://bizboosters.co.uk"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Address / location</Label>
                    <Input
                      value={senderProfileForm.sender_address}
                      onChange={(e) => setSenderProfileForm((f) => ({ ...f, sender_address: e.target.value }))}
                      placeholder="e.g. LaunchSpace, UWE - Bristol, BS34 8RB, UK"
                    />
                  </div>
                  <div className="flex items-center justify-between rounded-lg border p-3 bg-muted/20">
                    <div>
                      <Label className="text-xs font-medium">Show email in signature</Label>
                      <p className="text-xs text-muted-foreground">Turn off to omit the From address from the signature (recipients already see it in the email header).</p>
                    </div>
                    <Switch
                      checked={senderProfileForm.signature_show_email}
                      onCheckedChange={(checked) => setSenderProfileForm((f) => ({ ...f, signature_show_email: checked }))}
                    />
                  </div>
                </TabsContent>
                <TabsContent value="custom" className="pt-4">
                  <Label className="text-xs">Custom email signature (HTML)</Label>
                  <Textarea
                    value={senderProfileForm.signature}
                    onChange={(e) => setSenderProfileForm((f) => ({ ...f, signature: e.target.value }))}
                    placeholder="e.g. <p>Best regards,</p><p>Your name</p>"
                    rows={5}
                    className="font-mono text-sm mt-2"
                  />
                  <p className="text-xs text-muted-foreground mt-1">Optional. Overrides the structured signature when you save.</p>
                </TabsContent>
              </Tabs>
            </div>

            {/* Send test email from this profile */}
            <div className="space-y-3 rounded-lg border p-4 bg-muted/20">
              <h4 className="text-sm font-semibold flex items-center gap-2">
                <Send className="h-4 w-4 text-primary" />
                Send test email
              </h4>
              <p className="text-xs text-muted-foreground">Preview how this profile looks in the inbox. Uses the branding above.</p>
              <div className="flex flex-col sm:flex-row gap-2">
                <Input
                  type="email"
                  placeholder="test@example.com"
                  value={profileTestEmail}
                  onChange={(e) => setProfileTestEmail(e.target.value)}
                  className="flex-1"
                />
                {profileConnections.length > 1 && (
                  <Select value={profileTestConnectionId || profileConnections[0]?.id} onValueChange={setProfileTestConnectionId}>
                    <SelectTrigger className="w-full sm:w-[180px]">
                      <SelectValue placeholder="Send from" />
                    </SelectTrigger>
                    <SelectContent>
                      {profileConnections.map((conn: { id: string; provider: string; from_email?: string }) => (
                        <SelectItem key={conn.id} value={conn.id}>
                          {conn.provider === "gmail" || conn.provider === "gmail_direct" ? "Gmail" : conn.provider === "resend" ? "Resend" : conn.provider === "sendgrid" ? "SendGrid" : conn.provider} · {(conn.from_email || "").trim() || "—"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                <Button type="button" variant="secondary" onClick={handleSendProfileTest} disabled={sendingProfileTest || profileConnections.length === 0}>
                  {sendingProfileTest ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  {sendingProfileTest ? " Sending…" : " Send test"}
                </Button>
              </div>
              {profileConnections.length === 0 && (
                <p className="text-xs text-amber-600">Add an email account in Settings → Email Providers to send tests.</p>
              )}
            </div>

            {/* In-dialog preview: see template before saving */}
            <div className="space-y-2 rounded-lg border-2 border-dashed border-primary/30 bg-muted/20 p-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h4 className="text-sm font-semibold flex items-center gap-2">
                  <Palette className="h-4 w-4 text-primary" />
                  Preview
                </h4>
                <Tabs value={senderPreviewMode} onValueChange={(v) => setSenderPreviewMode(v as 'email' | 'newsletter')} className="w-auto">
                  <TabsList className="h-8">
                    <TabsTrigger value="email" className="text-xs px-3">Email</TabsTrigger>
                    <TabsTrigger value="newsletter" className="text-xs px-3">Newsletter</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
              <p className="text-xs text-muted-foreground">
                {senderPreviewMode === 'email' ? 'Standard email (no unsubscribe block).' : 'Newsletter style with subscribe message and Unsubscribe / Contact us.'}
              </p>
              <div className="rounded-md overflow-hidden border bg-background max-h-[320px] overflow-y-auto">
                <PreviewErrorBoundary>
                  <EmailTemplatePreview
                    template={(senderProfileForm.template_style || "professional") as EmailTemplatePreviewStyle}
                    brandColor={senderProfileForm.brand_color || "#8b5cf6"}
                    logoUrl={senderProfileForm.logo_url || undefined}
                    companyName={senderProfileForm.signature_company || businessProfile.company_name || "Your Company"}
                    headerName={senderProfileForm.display_name || undefined}
                    senderName={senderProfileForm.signature_name || senderProfileForm.sender_name || "Sender"}
                    senderTitle={senderProfileForm.sender_title || undefined}
                    senderEmail={senderProfileForm.sender_email || undefined}
                    footerText={senderProfileForm.footer_text || undefined}
                    footerImageUrl={senderProfileForm.footer_logo_url || undefined}
                    senderImageUrl={senderProfileForm.sender_image_url || undefined}
                    websiteUrl={senderProfileForm.website_url || undefined}
                    signature={
                      senderProfileForm.signature_use_structured
                        ? (buildStructuredSignatureHtml({
                            closing: senderProfileForm.signature_closing,
                            name: senderProfileForm.signature_name || senderProfileForm.sender_name,
                            title: senderProfileForm.sender_title,
                            company: senderProfileForm.signature_company,
                            phone: senderProfileForm.sender_phone,
                            email: senderProfileForm.sender_email,
                            website: senderProfileForm.website_url,
                            address: senderProfileForm.sender_address,
                            includeEmail: senderProfileForm.signature_show_email,
                          }) || undefined)
                        : (senderProfileForm.signature?.trim() || undefined)
                    }
                    bare
                    showNewsletterFooter={senderPreviewMode === 'newsletter'}
                  />
                </PreviewErrorBoundary>
              </div>
            </div>
          </div>
          <DialogFooter>
            {editingSenderProfileId && (
              <Button variant="destructive" onClick={() => handleDeleteSenderProfile(editingSenderProfileId)} className="mr-auto">
                Delete
              </Button>
            )}
            <Button variant="outline" onClick={() => setSenderProfileDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveSenderProfile} disabled={savingSenderProfile || !senderProfileForm.name.trim()}>
              {savingSenderProfile ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
