import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Building2, Save } from "lucide-react";
import { LearnBusinessCard, type LearnedProfile } from "@/components/business/LearnBusinessCard";

export default function BusinessProfile() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState({
    company_name: "",
    industry: "",
    services_description: "",
    target_audience: "",
    value_proposition: "",
    tone_preference: "professional",
    email_provider: "resend" as "resend" | "sendgrid" | "gmail_direct",
    website: "",
    phone: "",
    knowledge_base: "",
  });
  const [learnedAt, setLearnedAt] = useState<string | null>(null);

  const applyLearned = (l: LearnedProfile) => {
    setProfile((prev) => ({
      ...prev,
      company_name: l.company_name || prev.company_name,
      industry: l.industry || prev.industry,
      services_description: l.services_description || prev.services_description,
      target_audience: l.target_audience || prev.target_audience,
      value_proposition: l.value_proposition || prev.value_proposition,
      tone_preference: l.tone_preference || prev.tone_preference,
      website: l.website || prev.website,
      phone: l.phone || prev.phone,
      knowledge_base: l.knowledge_base || prev.knowledge_base,
    }));
    // Branding bits live on the Email Branding page; store them straight away if found.
    if (l.email_brand_color || l.email_logo_url || l.email_signature) {
      supabase.auth.getUser().then(({ data: { user } }) => {
        if (!user) return;
        const patch: Record<string, string> = {};
        if (l.email_brand_color) patch.email_brand_color = l.email_brand_color;
        if (l.email_logo_url) patch.email_logo_url = l.email_logo_url;
        if (l.email_signature) patch.email_signature = l.email_signature;
        supabase.from("business_profiles").upsert({ user_id: user.id, ...patch } as any, { onConflict: "user_id" }).then(() => undefined);
      });
    }
  };

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("business_profiles")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (error && error.code !== "PGRST116") {
        throw error;
      }

      if (data) {
        setProfile({
          company_name: data.company_name || "",
          industry: data.industry || "",
          services_description: data.services_description || "",
          target_audience: data.target_audience || "",
          value_proposition: data.value_proposition || "",
          tone_preference: data.tone_preference || "professional",
          email_provider: (data.email_provider || 'resend') as "resend" | "sendgrid" | "gmail_direct",
          website: (data as any).website || "",
          phone: (data as any).phone || "",
          knowledge_base: (data as any).knowledge_base || "",
        });
        setLearnedAt((data as any).website_learned_at || null);
      }
    } catch (error) {
      console.error("Error loading profile:", error);
      toast({
        title: "Error",
        description: "Failed to load business profile",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase
        .from("business_profiles")
        .upsert({
          user_id: user.id,
          ...profile,
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
            <Building2 className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Business Profile</h1>
            <p className="text-sm text-muted-foreground">
              What the AI knows about your business when it writes emails, texts, newsletters and automations
            </p>
          </div>
        </div>
      </div>

      <div className="mb-6">
        <LearnBusinessCard initialUrl={profile.website} onApply={applyLearned} />
        {learnedAt && <p className="mt-2 text-xs text-muted-foreground">Last learned from your website {new Date(learnedAt).toLocaleString("en-GB", { timeZone: "Europe/London", dateStyle: "medium", timeStyle: "short" })}.</p>}
      </div>

      <Card className="p-6">
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="website">Website</Label>
              <Input id="website" value={profile.website} onChange={(e) => setProfile({ ...profile, website: e.target.value })} placeholder="www.yourbusiness.co.uk" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" value={profile.phone} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} placeholder="+44…" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="company_name">Company Name</Label>
              <Input
                id="company_name"
                value={profile.company_name}
                onChange={(e) => setProfile({ ...profile, company_name: e.target.value })}
                placeholder="Your company name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="industry">Industry</Label>
              <Input
                id="industry"
                value={profile.industry}
                onChange={(e) => setProfile({ ...profile, industry: e.target.value })}
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
              value={profile.services_description}
              onChange={(e) => setProfile({ ...profile, services_description: e.target.value })}
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
              value={profile.target_audience}
              onChange={(e) => setProfile({ ...profile, target_audience: e.target.value })}
              placeholder="Who do you typically sell to? e.g., Enterprise CIOs, Small business owners, Healthcare providers..."
              className="min-h-[80px]"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="value_proposition">Value Proposition</Label>
            <Textarea
              id="value_proposition"
              value={profile.value_proposition}
              onChange={(e) => setProfile({ ...profile, value_proposition: e.target.value })}
              placeholder="What makes you different? Key benefits and differentiators..."
              className="min-h-[80px]"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="tone_preference">Preferred Email Tone</Label>
            <Select
              value={profile.tone_preference}
              onValueChange={(value) => setProfile({ ...profile, tone_preference: value })}
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
            <Label htmlFor="knowledge_base">Knowledge base</Label>
            <Textarea
              id="knowledge_base"
              value={profile.knowledge_base}
              onChange={(e) => setProfile({ ...profile, knowledge_base: e.target.value })}
              className="min-h-[160px] text-sm"
              placeholder="Facts the AI should use: your offers and prices, who they're for, how it works, where you operate, what makes you different, common questions. Filled automatically from your website; add your own notes under a line that says MY NOTES."
            />
            <p className="text-xs text-muted-foreground">Used as grounding for every AI-written message so it says true things about your business. Re-learning from your website refreshes the top part and keeps anything under “MY NOTES”.</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email_provider">Email Provider</Label>
            <Select
              value={profile.email_provider}
              onValueChange={(value: "resend" | "sendgrid" | "gmail_direct") => setProfile({ ...profile, email_provider: value })}
            >
              <SelectTrigger id="email_provider">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="gmail_direct">
                  <div className="flex items-center gap-2">
                    <img src="https://www.google.com/favicon.ico" alt="Gmail" className="w-4 h-4" />
                    Gmail (OAuth) - Recommended
                  </div>
                </SelectItem>
                <SelectItem value="resend">Resend</SelectItem>
                <SelectItem value="sendgrid">SendGrid</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Gmail is recommended for conversations - replies appear in both your inbox and this app.
              Make sure you've connected Gmail in Email Providers first.
            </p>
          </div>

          <div className="flex justify-end pt-4">
            <Button
              onClick={handleSave}
              disabled={saving || !profile.services_description}
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
        </div>
      </Card>
    </div>
  );
}