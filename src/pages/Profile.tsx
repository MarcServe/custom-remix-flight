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
import { Loader2, Building2, Save, User, Mail, Palette } from "lucide-react";
import { EmailTemplatePreview } from "@/components/email/EmailTemplatePreview";
import { SendTestEmailButton } from "@/components/email/SendTestEmailButton";
import { AvatarUpload } from "@/components/ui/avatar-upload";
import { LogoUpload } from "@/components/ui/logo-upload";
import { TemplateStyleSelector, type EmailTemplateStyle } from "@/components/email/TemplateStyleSelector";

export default function Profile() {
  const { toast } = useToast();
  const { user } = useAuth();
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

  const { data: connections } = useQuery({
    queryKey: ['nango-connections'],
    queryFn: async () => {
      const { data } = await nangoClient.getConnections();
      return data || [];
    },
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
        .single();

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
          ...businessProfile,
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-4xl">
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

      <Tabs defaultValue="account" className="space-y-4">
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
                    <SelectItem value="resend">Resend</SelectItem>
                    <SelectItem value="sendgrid">SendGrid</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Choose which service to use for sending emails from the CRM
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
                <div className="flex items-center justify-between">
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

              <div className="flex justify-between pt-4">
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

          <EmailTemplatePreview
            template={businessProfile.email_template_style as 'professional' | 'minimal' | 'modern'}
            brandColor={businessProfile.email_brand_color}
            logoUrl={businessProfile.email_logo_url || undefined}
            companyName={businessProfile.company_name || undefined}
            senderName={profile.full_name || undefined}
            senderTitle={profile.job_title || undefined}
            senderEmail={user?.email || undefined}
            footerText={businessProfile.email_footer_text || undefined}
          />
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
                      className="flex items-center justify-between p-3 border rounded-lg"
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
