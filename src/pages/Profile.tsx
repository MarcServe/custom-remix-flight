import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { nangoClient } from "@/lib/integrations/nango";
import { Loader2, Building2, Save, User, Mail, Palette, Sparkles, Clock, Plus, Pencil, Trash2 } from "lucide-react";
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
import { AvatarUpload } from "@/components/ui/avatar-upload";
import { LogoUpload } from "@/components/ui/logo-upload";
import { TemplateStyleSelector, type EmailTemplateStyle } from "@/components/email/TemplateStyleSelector";
import { format } from "date-fns";
import { useNavigate, useSearchParams } from "react-router-dom";

export default function Profile() {
  const { toast } = useToast();
  const { user, subscribed, isInTrial, trialEndsAt } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'account';
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState({
    full_name: "",
    job_title: "",
    email: "",
    phone: "",
    website: "",
    avatar_url: "",
  });
  const [businessProfile, setBusinessProfile] = useState({
    company_name: "",
    industry: "",
    services_description: "",
    target_audience: "",
    value_proposition: "",
    tone_preference: "professional",
    email_provider: "resend",
    auto_response_daily_limit: 10,
    auto_response_paused: false,
    auto_response_count_today: 0,
    ai_model: "google/gemini-2.5-flash",
    ai_temperature: 0.7,
    ai_max_tokens: 500,
    ai_response_style: "professional",
    email_logo_url: "",
    email_brand_color: "#8b5cf6",
    email_footer_text: "",
    email_signature: "",
    email_template_style: "professional",
  });

  const [senderProfileDialogOpen, setSenderProfileDialogOpen] = useState(false);
  const [editingSenderProfileId, setEditingSenderProfileId] = useState<string | null>(null);
  const [senderProfileForm, setSenderProfileForm] = useState({
    name: "",
    display_name: "",
    logo_url: "",
    brand_color: "#8b5cf6",
    footer_text: "",
    signature: "",
    template_style: "professional" as "professional" | "minimal" | "modern" | "creative" | "corporate" | "bold" | "elegant",
    sender_name: "",
    sender_email: "",
    sender_title: "",
  });
  const [savingSenderProfile, setSavingSenderProfile] = useState(false);

  const { data: connections } = useQuery({
    queryKey: ['nango-connections'],
    queryFn: async () => {
      const { data } = await nangoClient.getConnections();
      return data || [];
    },
  });

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
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
  });

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Load personal profile
      const { data: profileData } = await supabase
        .from("profiles")
        .select("full_name, job_title, email, phone, website, avatar_url")
        .eq("id", user.id)
        .maybeSingle();

      if (profileData) {
        setProfile({
          full_name: profileData.full_name || "",
          job_title: profileData.job_title || "",
          email: profileData.email || user.email || "",
          phone: profileData.phone || "",
          website: profileData.website || "",
          avatar_url: profileData.avatar_url || "",
        });
      }

      // Load business profile
      const { data, error } = await supabase
        .from("business_profiles")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (error && error.code !== "PGRST116") {
        throw error;
      }

      if (data) {
        setBusinessProfile({
          company_name: data.company_name || "",
          industry: data.industry || "",
          services_description: data.services_description || "",
          target_audience: data.target_audience || "",
          value_proposition: data.value_proposition || "",
          tone_preference: data.tone_preference || "professional",
          email_provider: data.email_provider || "resend",
          auto_response_daily_limit: data.auto_response_daily_limit || 10,
          auto_response_paused: data.auto_response_paused || false,
          auto_response_count_today: data.auto_response_count_today || 0,
          ai_model: data.ai_model || "google/gemini-2.5-flash",
          ai_temperature: data.ai_temperature || 0.7,
          ai_max_tokens: data.ai_max_tokens || 500,
          ai_response_style: data.ai_response_style || "professional",
          email_logo_url: data.email_logo_url || "",
          email_brand_color: data.email_brand_color || "#8b5cf6",
          email_footer_text: data.email_footer_text || "",
          email_signature: data.email_signature || "",
          email_template_style: data.email_template_style || "professional",
        });
      }
    } catch (error) {
      console.error("Error loading profile:", error);
      toast({
        title: "Error",
        description: "Failed to load profile",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProfile = async () => {
    try {
      setSaving(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: profile.full_name,
          job_title: profile.job_title,
          email: profile.email,
          phone: profile.phone,
          website: profile.website,
        })
        .eq("id", user.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Personal profile saved successfully",
      });
    } catch (error) {
      console.error("Error saving profile:", error);
      toast({
        title: "Error",
        description: "Failed to save personal profile",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveBusinessProfile = async () => {
    try {
      setSaving(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase
        .from("business_profiles")
        .upsert({
          user_id: user.id,
          company_name: businessProfile.company_name,
          industry: businessProfile.industry,
          services_description: businessProfile.services_description,
          target_audience: businessProfile.target_audience,
          value_proposition: businessProfile.value_proposition,
          tone_preference: businessProfile.tone_preference,
          email_provider: businessProfile.email_provider,
          auto_response_daily_limit: businessProfile.auto_response_daily_limit,
          auto_response_paused: businessProfile.auto_response_paused,
          ai_model: businessProfile.ai_model,
          ai_temperature: businessProfile.ai_temperature,
          ai_max_tokens: businessProfile.ai_max_tokens,
          ai_response_style: businessProfile.ai_response_style,
          email_logo_url: businessProfile.email_logo_url || null,
          email_brand_color: businessProfile.email_brand_color,
          email_footer_text: businessProfile.email_footer_text || null,
          email_signature: businessProfile.email_signature || null,
          email_template_style: businessProfile.email_template_style,
        }, {
          onConflict: 'user_id'
        });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Business profile saved successfully",
      });
    } catch (error) {
      console.error("Error saving profile:", error);
      toast({
        title: "Error",
        description: "Failed to save business profile",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const openAddSenderProfile = () => {
    setEditingSenderProfileId(null);
    setSenderProfileForm({ name: "", display_name: "", logo_url: "", brand_color: "#8b5cf6", footer_text: "", signature: "", template_style: "professional", sender_name: "", sender_email: "", sender_title: "" });
    setSenderProfileDialogOpen(true);
  };

  const senderTemplateStyles = ["professional", "minimal", "modern", "creative", "corporate", "bold", "elegant"] as const;
  const openEditSenderProfile = (p: { id: string; name: string; display_name?: string | null; logo_url: string | null; brand_color: string | null; footer_text: string | null; signature: string | null; template_style?: string | null; sender_name?: string | null; sender_email?: string | null; sender_title?: string | null }) => {
    setEditingSenderProfileId(p.id);
    setSenderProfileForm({
      name: p.name,
      display_name: p.display_name || "",
      logo_url: p.logo_url || "",
      brand_color: p.brand_color || "#8b5cf6",
      footer_text: p.footer_text || "",
      signature: p.signature || "",
      template_style: (senderTemplateStyles.includes(p.template_style as any) ? p.template_style : "professional") as "professional" | "minimal" | "modern" | "creative" | "corporate" | "bold" | "elegant",
      sender_name: p.sender_name || "",
      sender_email: p.sender_email || "",
      sender_title: p.sender_title || "",
    });
    setSenderProfileDialogOpen(true);
  };

  const handleSaveSenderProfile = async () => {
    if (!user?.id || !senderProfileForm.name.trim()) return;
    try {
      setSavingSenderProfile(true);
      if (editingSenderProfileId) {
        const { error } = await supabase
          .from("sender_profiles")
          .update({
            name: senderProfileForm.name.trim(),
            display_name: senderProfileForm.display_name.trim() || null,
            logo_url: senderProfileForm.logo_url || null,
            brand_color: senderProfileForm.brand_color || null,
            footer_text: senderProfileForm.footer_text || null,
            signature: senderProfileForm.signature || null,
            template_style: senderProfileForm.template_style,
            sender_name: senderProfileForm.sender_name.trim() || null,
            sender_email: senderProfileForm.sender_email.trim() || null,
            sender_title: senderProfileForm.sender_title.trim() || null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", editingSenderProfileId)
          .eq("user_id", user.id);
        if (error) throw error;
        toast({ title: "Saved", description: "Sender profile updated." });
      } else {
        const { error } = await supabase.from("sender_profiles").insert({
          user_id: user.id,
          name: senderProfileForm.name.trim(),
          display_name: senderProfileForm.display_name.trim() || null,
          logo_url: senderProfileForm.logo_url || null,
          brand_color: senderProfileForm.brand_color || null,
          footer_text: senderProfileForm.footer_text || null,
          signature: senderProfileForm.signature || null,
          template_style: senderProfileForm.template_style,
          sender_name: senderProfileForm.sender_name.trim() || null,
          sender_email: senderProfileForm.sender_email.trim() || null,
          sender_title: senderProfileForm.sender_title.trim() || null,
          sort_order: senderProfiles.length,
        });
        if (error) throw error;
        toast({ title: "Created", description: "Sender profile added. Use it in \"Send as\" when composing emails." });
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
    if (!confirm("Remove this sender profile? Campaigns that used it will keep their content but future sends will use the default profile.")) return;
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-4xl min-h-0 overflow-y-auto">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-12 h-12 rounded-xl bg-gradient-primary flex items-center justify-center shadow-lg">
            <User className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Profile Settings</h1>
            <p className="text-sm text-muted-foreground">
              Manage your account and business information
            </p>
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(value) => setSearchParams({ tab: value }, { replace: true })} className="space-y-4">
        <TabsList className="grid w-full grid-cols-2 md:grid-cols-5 h-auto">
          <TabsTrigger value="account" className="text-xs sm:text-sm">Account</TabsTrigger>
          <TabsTrigger value="business" className="text-xs sm:text-sm">Business Profile</TabsTrigger>
          <TabsTrigger value="ai" className="text-xs sm:text-sm">AI Settings</TabsTrigger>
          <TabsTrigger value="branding" className="text-xs sm:text-sm">Email Branding</TabsTrigger>
          <TabsTrigger value="integrations" className="text-xs sm:text-sm">Integrations</TabsTrigger>
        </TabsList>

        <TabsContent value="account" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Personal Information</CardTitle>
              <CardDescription>
                Your personal details for email signatures
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex justify-center py-4">
                <AvatarUpload
                  currentAvatarUrl={profile.avatar_url}
                  userInitials={profile.full_name?.split(' ').map(n => n[0]).join('') || 'U'}
                  onUploadSuccess={(url) => setProfile({ ...profile, avatar_url: url })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Business Email *</Label>
                <Input
                  id="email"
                  type="email"
                  value={profile.email}
                  onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                  placeholder="e.g., michael.o@bizboosters.co.uk"
                />
                <p className="text-xs text-amber-600 dark:text-amber-500 flex items-center gap-1">
                  <Mail className="h-3 w-3" />
                  This email will be used as the FROM address when sending emails. Make sure it's verified in your email provider (SendGrid/Resend).
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="full_name">Full Name *</Label>
                <Input
                  id="full_name"
                  value={profile.full_name}
                  onChange={(e) => setProfile({ ...profile, full_name: e.target.value })}
                  placeholder="e.g., Michael Orji"
                />
                <p className="text-xs text-muted-foreground">
                  Your name will appear in email signatures
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="job_title">Job Title / Position *</Label>
                <Input
                  id="job_title"
                  value={profile.job_title}
                  onChange={(e) => setProfile({ ...profile, job_title: e.target.value })}
                  placeholder="e.g., AI Product Manager"
                />
                <p className="text-xs text-muted-foreground">
                  Your position will appear in email signatures
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number</Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={profile.phone}
                    onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                    placeholder="e.g., +44 20 1234 5678"
                  />
                  <p className="text-xs text-muted-foreground">
                    Phone will appear in email signatures
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="website">Website</Label>
                  <Input
                    id="website"
                    type="url"
                    value={profile.website}
                    onChange={(e) => setProfile({ ...profile, website: e.target.value })}
                    placeholder="e.g., https://yourcompany.com"
                  />
                  <p className="text-xs text-muted-foreground">
                    Website will appear in email signatures
                  </p>
                </div>
              </div>

              <div className="rounded-lg border bg-muted/50 p-4 space-y-2">
                <p className="text-sm font-medium">Email Signature Preview</p>
                <div className="text-sm text-muted-foreground">
                  <p>Best regards,</p>
                  <p className="font-medium text-foreground">
                    {profile.full_name || "Your Name"}
                  </p>
                  <p>{profile.job_title || "Your Job Title"}</p>
                  <p>{businessProfile.company_name || "Your Company"}</p>
                  {profile.phone && <p>{profile.phone}</p>}
                  {profile.website && <p>{profile.website}</p>}
                </div>
              </div>

              <div className="flex justify-end pt-4">
                <Button
                  onClick={handleSaveProfile}
                  disabled={saving || !profile.full_name || !profile.job_title || !profile.email}
                >
                  {saving ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Save Profile
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Trial Status Card */}
          {isInTrial && !subscribed && trialEndsAt && (
            <Card className="border-blue-500 bg-blue-50 dark:bg-blue-950/20">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className="h-5 w-5 text-blue-500" />
                    <CardTitle className="text-blue-700 dark:text-blue-400">Free Trial Active</CardTitle>
                  </div>
                  <Badge variant="outline" className="border-blue-500 text-blue-700 dark:text-blue-400">
                    Trial Period
                  </Badge>
                </div>
                <CardDescription className="text-blue-600 dark:text-blue-300">
                  You're currently enjoying your 7-day free trial of LeadBoosters Premium
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center p-3 bg-white dark:bg-gray-900 rounded-lg">
                  <span className="text-sm text-muted-foreground">Trial ends on</span>
                  <span className="font-semibold text-blue-700 dark:text-blue-400">
                    {format(new Date(trialEndsAt), 'MMMM dd, yyyy')}
                  </span>
                </div>
                <Button 
                  onClick={() => navigate('/subscription')}
                  className="w-full"
                  variant="default"
                >
                  <Sparkles className="mr-2 h-4 w-4" />
                  Subscribe to Continue After Trial
                </Button>
              </CardContent>
            </Card>
          )}

          {subscribed && (
            <Card className="border-green-500 bg-green-50 dark:bg-green-950/20">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-green-500" />
                  <CardTitle className="text-green-700 dark:text-green-400">Premium Subscription Active</CardTitle>
                </div>
                <CardDescription className="text-green-600 dark:text-green-300">
                  You have full access to all LeadBoosters Premium features
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button 
                  onClick={() => navigate('/subscription')}
                  variant="outline"
                  className="w-full"
                >
                  Manage Subscription
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="business" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-gradient-primary flex items-center justify-center">
                  <Building2 className="h-5 w-5 text-white" />
                </div>
                <div>
                  <CardTitle>Business Profile</CardTitle>
                  <CardDescription>
                    Help AI personalize emails by describing your business
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="company_name">Company Name</Label>
                  <Input
                    id="company_name"
                    value={businessProfile.company_name}
                    onChange={(e) => setBusinessProfile({ ...businessProfile, company_name: e.target.value })}
                    placeholder="Your company name"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="industry">Industry</Label>
                  <Input
                    id="industry"
                    value={businessProfile.industry}
                    onChange={(e) => setBusinessProfile({ ...businessProfile, industry: e.target.value })}
                    placeholder="e.g., SaaS, Healthcare, Finance"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="services_description">
                  Services & Products Description *
                </Label>
                <Textarea
                  id="services_description"
                  value={businessProfile.services_description}
                  onChange={(e) => setBusinessProfile({ ...businessProfile, services_description: e.target.value })}
                  placeholder="Describe what your company does, the products/services you offer, and key features..."
                  className="min-h-[120px]"
                  required
                />
                <p className="text-xs text-muted-foreground">
                  This helps AI understand what you're selling when composing emails
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="target_audience">Target Audience</Label>
                <Textarea
                  id="target_audience"
                  value={businessProfile.target_audience}
                  onChange={(e) => setBusinessProfile({ ...businessProfile, target_audience: e.target.value })}
                  placeholder="Who do you typically sell to? e.g., Enterprise CIOs, Small business owners, Healthcare providers..."
                  className="min-h-[80px]"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="value_proposition">Value Proposition</Label>
                <Textarea
                  id="value_proposition"
                  value={businessProfile.value_proposition}
                  onChange={(e) => setBusinessProfile({ ...businessProfile, value_proposition: e.target.value })}
                  placeholder="What makes you different? Key benefits and differentiators..."
                  className="min-h-[80px]"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="tone_preference">Preferred Email Tone</Label>
                <Select
                  value={businessProfile.tone_preference}
                  onValueChange={(value) => setBusinessProfile({ ...businessProfile, tone_preference: value })}
                >
                  <SelectTrigger id="tone_preference">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="professional">Professional</SelectItem>
                    <SelectItem value="casual">Casual & Friendly</SelectItem>
                    <SelectItem value="technical">Technical</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email_provider">Email Provider</Label>
                <Select
                  value={businessProfile.email_provider}
                  onValueChange={(value) => setBusinessProfile({ ...businessProfile, email_provider: value })}
                >
                  <SelectTrigger id="email_provider">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gmail_direct">Gmail (OAuth)</SelectItem>
                    <SelectItem value="smtp">SMTP</SelectItem>
                    <SelectItem value="resend">Resend</SelectItem>
                    <SelectItem value="sendgrid">SendGrid</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Choose which service to use for sending emails from the CRM (set up in Email Providers).
                </p>
              </div>

              <div className="flex justify-end pt-4">
                <Button
                  onClick={handleSaveBusinessProfile}
                  disabled={saving || !businessProfile.services_description}
                >
                  {saving ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Save Profile
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Auto-Response Settings</CardTitle>
              <CardDescription>
                Control AI auto-response behavior and safety limits
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="rounded-lg border bg-muted/50 p-4 space-y-2">
                <p className="text-sm font-medium">Today's Usage</p>
                <p className="text-2xl font-bold">
                  {businessProfile.auto_response_count_today} / {businessProfile.auto_response_daily_limit}
                </p>
                <p className="text-xs text-muted-foreground">
                  Auto-responses sent today
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="auto_response_daily_limit">Daily Auto-Response Limit</Label>
                <Input
                  id="auto_response_daily_limit"
                  type="number"
                  min="1"
                  max="100"
                  value={businessProfile.auto_response_daily_limit}
                  onChange={(e) => setBusinessProfile({ 
                    ...businessProfile, 
                    auto_response_daily_limit: parseInt(e.target.value) || 10
                  })}
                />
                <p className="text-xs text-muted-foreground">
                  Maximum number of AI responses to send automatically per day (1-100)
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <Label>Auto-Response Status</Label>
                    <p className="text-xs text-muted-foreground mt-1">
                      {businessProfile.auto_response_paused 
                        ? "Auto-responses are currently paused for all sequences" 
                        : "Auto-responses are active for enabled sequences"}
                    </p>
                  </div>
                  <Button
                    variant={businessProfile.auto_response_paused ? "default" : "destructive"}
                    onClick={() => setBusinessProfile({ 
                      ...businessProfile, 
                      auto_response_paused: !businessProfile.auto_response_paused
                    })}
                  >
                    {businessProfile.auto_response_paused ? "Resume All" : "Pause All"}
                  </Button>
                </div>
              </div>

              <div className="flex justify-end pt-4">
                <Button
                  onClick={handleSaveBusinessProfile}
                  disabled={saving}
                >
                  {saving ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Save Settings
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ai" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>AI Model Configuration</CardTitle>
              <CardDescription>
                Configure AI settings for auto-response generation
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="ai_model">AI Model</Label>
                <Select
                  value={businessProfile.ai_model}
                  onValueChange={(value) => setBusinessProfile({ ...businessProfile, ai_model: value })}
                >
                  <SelectTrigger id="ai_model">
                    <SelectValue placeholder="Select AI model" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="google/gemini-2.5-flash">
                      Gemini 2.5 Flash (Recommended) - Fast & Balanced
                    </SelectItem>
                    <SelectItem value="google/gemini-2.5-pro">
                      Gemini 2.5 Pro - Highest Quality
                    </SelectItem>
                    <SelectItem value="google/gemini-2.5-flash-lite">
                      Gemini 2.5 Flash Lite - Fastest & Most Economical
                    </SelectItem>
                    <SelectItem value="openai/gpt-5-mini">
                      GPT-5 Mini - Strong Performance
                    </SelectItem>
                    <SelectItem value="openai/gpt-5">
                      GPT-5 - Maximum Accuracy
                    </SelectItem>
                    <SelectItem value="openai/gpt-5-nano">
                      GPT-5 Nano - High Volume Tasks
                    </SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Choose the AI model for generating auto-responses. Better models provide more nuanced responses but cost more.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="ai_response_style">Response Style</Label>
                <Select
                  value={businessProfile.ai_response_style}
                  onValueChange={(value) => setBusinessProfile({ ...businessProfile, ai_response_style: value })}
                >
                  <SelectTrigger id="ai_response_style">
                    <SelectValue placeholder="Select response style" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="professional">Professional - Formal and polished</SelectItem>
                    <SelectItem value="casual">Casual - Friendly and approachable</SelectItem>
                    <SelectItem value="technical">Technical - Detailed and precise</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  The tone and style of AI-generated responses
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="ai_temperature">
                  Creativity Level: {businessProfile.ai_temperature}
                </Label>
                <Input
                  id="ai_temperature"
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={businessProfile.ai_temperature}
                  onChange={(e) => setBusinessProfile({ 
                    ...businessProfile, 
                    ai_temperature: parseFloat(e.target.value)
                  })}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>More Focused (0.0)</span>
                  <span>More Creative (1.0)</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Lower values produce more consistent responses, higher values are more creative
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="ai_max_tokens">Maximum Response Length</Label>
                <Input
                  id="ai_max_tokens"
                  type="number"
                  min="100"
                  max="2000"
                  step="50"
                  value={businessProfile.ai_max_tokens}
                  onChange={(e) => setBusinessProfile({ 
                    ...businessProfile, 
                    ai_max_tokens: parseInt(e.target.value) || 500
                  })}
                />
                <p className="text-xs text-muted-foreground">
                  Maximum length of AI responses in tokens (~4 characters = 1 token). Recommended: 500
                </p>
              </div>

              <div className="rounded-lg border bg-primary/5 p-4 space-y-2">
                <p className="text-sm font-medium">Current Configuration</p>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-muted-foreground">Model:</span>
                    <p className="font-medium">{businessProfile.ai_model}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Style:</span>
                    <p className="font-medium capitalize">{businessProfile.ai_response_style}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Creativity:</span>
                    <p className="font-medium">{businessProfile.ai_temperature}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Max Length:</span>
                    <p className="font-medium">{businessProfile.ai_max_tokens} tokens</p>
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-4">
                <Button
                  onClick={handleSaveBusinessProfile}
                  disabled={saving}
                >
                  {saving ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Save AI Settings
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="branding" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Palette className="h-5 w-5" />
                Email Branding
              </CardTitle>
              <CardDescription>
                Customize the appearance of your auto-response emails
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
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
                <p className="text-xs text-muted-foreground">
                  Primary color for email headers and accents
                </p>
              </div>

              <LogoUpload
                currentLogoUrl={businessProfile.email_logo_url}
                onUploadSuccess={(url) => setBusinessProfile({ ...businessProfile, email_logo_url: url })}
                updateBusinessProfile={true}
              />

              <div className="space-y-2">
                <Label htmlFor="email_footer_text">Footer Text</Label>
                <Textarea
                  id="email_footer_text"
                  value={businessProfile.email_footer_text}
                  onChange={(e) => setBusinessProfile({ ...businessProfile, email_footer_text: e.target.value })}
                  placeholder={`© ${new Date().getFullYear()} ${businessProfile.company_name || 'Your Company'}. All rights reserved.`}
                  rows={2}
                />
                <p className="text-xs text-muted-foreground">
                  Custom footer text for your emails
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email_signature">Custom Email Signature (HTML)</Label>
                <Textarea
                  id="email_signature"
                  value={businessProfile.email_signature}
                  onChange={(e) => setBusinessProfile({ ...businessProfile, email_signature: e.target.value })}
                  placeholder="Leave empty to use default signature"
                  rows={4}
                  className="font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  Optional custom HTML signature (overrides default)
                </p>
              </div>

              <div className="flex flex-wrap gap-2 items-center justify-end sm:justify-between pt-4">
                <SendTestEmailButton
                  templateStyle={businessProfile.email_template_style}
                  brandColor={businessProfile.email_brand_color}
                  logoUrl={businessProfile.email_logo_url || undefined}
                  companyName={businessProfile.company_name || undefined}
                  footerText={businessProfile.email_footer_text || undefined}
                  signature={businessProfile.email_signature || undefined}
                />
                <Button
                  onClick={handleSaveBusinessProfile}
                  disabled={saving}
                  className="shrink-0"
                >
                  {saving ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Save Branding
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Sender Profiles</CardTitle>
              <CardDescription>
                Each sender profile has its own email header (name + logo), footer text, brand color, and template style—so you can use different designs per product. Create profiles (e.g. TALKWEB, Biz Boosters) and choose one when sending bulk or single emails.
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

          <EmailTemplatePreview
            template={(businessProfile.email_template_style || 'professional') as EmailTemplatePreviewStyle}
            brandColor={businessProfile.email_brand_color}
            logoUrl={businessProfile.email_logo_url || undefined}
            companyName={businessProfile.company_name || undefined}
            senderName={profile.full_name || undefined}
            senderTitle={profile.job_title || undefined}
            senderEmail={user?.email || undefined}
            footerText={businessProfile.email_footer_text || undefined}
          />

          <Dialog open={senderProfileDialogOpen} onOpenChange={setSenderProfileDialogOpen}>
            <DialogContent className="sm:max-w-md max-h-[90vh] flex flex-col">
              <DialogHeader>
                <DialogTitle>{editingSenderProfileId ? "Edit sender profile" : "Add sender profile"}</DialogTitle>
                <DialogDescription>Name and logo shown in the email header when you send as this profile.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4 overflow-y-auto min-h-0 pr-2">
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
                  <Label>Brand / Company Name <span className="text-muted-foreground font-normal">(optional)</span></Label>
                  <Input
                    value={senderProfileForm.display_name}
                    onChange={(e) => setSenderProfileForm((f) => ({ ...f, display_name: e.target.value }))}
                    placeholder="e.g. Biz Boosters Ltd"
                  />
                  <p className="text-xs text-muted-foreground">Shown in the email header and footer. Leave empty to use default business name or hide it.</p>
                </div>
                <div className="space-y-2">
                  <Label>Sender Name</Label>
                  <Input
                    value={senderProfileForm.sender_name}
                    onChange={(e) => setSenderProfileForm((f) => ({ ...f, sender_name: e.target.value }))}
                    placeholder="e.g. Michael Orji"
                  />
                  <p className="text-xs text-muted-foreground">Display name in the "From" field. Leave empty to use your account name.</p>
                </div>
                <div className="space-y-2">
                  <Label>Sender Email</Label>
                  <Input
                    type="email"
                    value={senderProfileForm.sender_email}
                    onChange={(e) => setSenderProfileForm((f) => ({ ...f, sender_email: e.target.value }))}
                    placeholder="e.g. michael@bizboosters.com"
                  />
                  <p className="text-xs text-muted-foreground">From email address. Leave empty to use the sending connection's email.</p>
                </div>
                <div className="space-y-2">
                  <Label>Sender Title</Label>
                  <Input
                    value={senderProfileForm.sender_title}
                    onChange={(e) => setSenderProfileForm((f) => ({ ...f, sender_title: e.target.value }))}
                    placeholder="e.g. Founder & CEO"
                  />
                  <p className="text-xs text-muted-foreground">Job title used in the email signature. Leave empty to use your account title.</p>
                </div>
                <div>
                  <Label>Logo</Label>
                  <LogoUpload
                    currentLogoUrl={senderProfileForm.logo_url || undefined}
                    onUploadSuccess={(url) => setSenderProfileForm((f) => ({ ...f, logo_url: url }))}
                    updateBusinessProfile={false}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Brand color</Label>
                  <div className="flex gap-2">
                    <Input
                      type="color"
                      value={senderProfileForm.brand_color}
                      onChange={(e) => setSenderProfileForm((f) => ({ ...f, brand_color: e.target.value }))}
                      className="w-14 h-10"
                    />
                    <Input
                      value={senderProfileForm.brand_color}
                      onChange={(e) => setSenderProfileForm((f) => ({ ...f, brand_color: e.target.value }))}
                      placeholder="#8b5cf6"
                      className="flex-1"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Email template style</Label>
                  <Select
                    value={senderProfileForm.template_style}
                    onValueChange={(v) => setSenderProfileForm((f) => ({ ...f, template_style: v as typeof senderProfileForm.template_style }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="professional">Professional – Classic & polished</SelectItem>
                      <SelectItem value="minimal">Minimal – Simple & clean</SelectItem>
                      <SelectItem value="modern">Modern – Contemporary & sleek</SelectItem>
                      <SelectItem value="creative">Creative – Bold & expressive</SelectItem>
                      <SelectItem value="corporate">Corporate – Traditional & trustworthy</SelectItem>
                      <SelectItem value="bold">Bold – High contrast & strong typography</SelectItem>
                      <SelectItem value="elegant">Elegant – Refined & timeless</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">Style for this product’s emails so you don’t have to redesign when switching products.</p>
                </div>
                <div className="space-y-2">
                  <Label>Footer text (optional)</Label>
                  <Textarea
                    value={senderProfileForm.footer_text}
                    onChange={(e) => setSenderProfileForm((f) => ({ ...f, footer_text: e.target.value }))}
                    placeholder="© 2025 Company. All rights reserved."
                    rows={2}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Signature (optional HTML)</Label>
                  <Textarea
                    value={senderProfileForm.signature}
                    onChange={(e) => setSenderProfileForm((f) => ({ ...f, signature: e.target.value }))}
                    placeholder="Leave empty to use default"
                    rows={2}
                    className="font-mono text-sm"
                  />
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
        </TabsContent>

        <TabsContent value="integrations" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Mail className="h-5 w-5 text-primary" />
                <CardTitle>Email Connections</CardTitle>
              </div>
              <CardDescription>
                Manage your connected email accounts
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {connections && connections.length > 0 ? (
                <div className="space-y-3">
                  {connections.map((connection) => (
                    <div
                      key={connection.connection_id}
                      className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between p-3 border rounded-lg"
                    >
                      <div className="space-y-1">
                        <p className="font-medium capitalize">{connection.provider}</p>
                        {connection.metadata?.email && (
                          <p className="text-sm text-muted-foreground">
                            {connection.metadata.email}
                          </p>
                        )}
                      </div>
                      <Badge
                        variant={connection.status === 'active' ? 'default' : 'secondary'}
                      >
                        {connection.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No email accounts connected yet.
                </p>
              )}
              <Button
                variant="outline"
                onClick={() => (window.location.href = '/integrations')}
                className="w-full"
              >
                Manage Integrations
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
