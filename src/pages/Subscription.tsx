import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Loader2, Sparkles, Check, RefreshCw,
  Users, Building2, Target, Mail, Zap, Bot,
  BarChart2, FileText, Layers, ShieldCheck, Inbox, Globe
} from "lucide-react";
import { useState } from "react";
import { format } from "date-fns";

const LEADBOOSTERS_PRODUCT_ID = "prod_TUNeoAZWiDngEH";

const FEATURE_GROUPS = [
  {
    icon: Building2,
    label: "CRM & Pipeline",
    features: [
      "Companies, People & Deals management",
      "Visual sales pipeline with drag-and-drop stages",
      "Deal tracking with custom stages & values",
      "Notes, activity logs & event tracking",
      "File attachments & document storage",
      "Invoice generation",
    ],
  },
  {
    icon: Target,
    label: "Lead Generation",
    features: [
      "AI-powered Lead Finder (search millions of contacts)",
      "Lead Inbox — capture & qualify inbound leads",
      "Company Enrichment (auto-fill firmographic data)",
      "Autonomous Lead Discovery (Autopilot)",
      "Contact discovery from company websites",
      "Export leads to CSV",
    ],
  },
  {
    icon: Mail,
    label: "Email Outreach & Campaigns",
    features: [
      "Personalised bulk email campaigns",
      "AI-generated personalised email copy",
      "Email Sequences (automated multi-step follow-ups)",
      "Company Sequences",
      "Email branding & custom templates",
      "Double-send prevention & exclusion controls",
      "Resend / SendGrid / Gmail / SMTP support",
    ],
  },
  {
    icon: Layers,
    label: "Newsletters & Marketing",
    features: [
      "Newsletter creation & broadcast sending",
      "Newsletter Series (automated drip campaigns)",
      "Recipient Group management",
      "Email branding & unsubscribe handling",
      "Campaign performance analytics",
    ],
  },
  {
    icon: Bot,
    label: "AI & Automation",
    features: [
      "AI email writer with personalisation",
      "AI lead scoring & campaign-fit analysis",
      "AI conversation & deal opportunity analysis",
      "Auto-response hub (reply to inbound emails automatically)",
      "AI-generated tags & CRM categorisation",
      "Autonomous background lead discovery",
    ],
  },
  {
    icon: Inbox,
    label: "Communication & Inbox",
    features: [
      "Unified Conversations (full email threading)",
      "Shared Team Inbox",
      "Gmail OAuth integration",
      "Auto-response to leads & inbound enquiries",
      "Lead reply detection & CRM sync",
    ],
  },
  {
    icon: BarChart2,
    label: "Analytics & Deliverability",
    features: [
      "Email deliverability monitoring & scoring",
      "Campaign open / click / reply tracking",
      "Sequence performance analytics",
      "Bounce & spam complaint tracking",
    ],
  },
  {
    icon: Users,
    label: "Teams & Collaboration",
    features: [
      "Multi-user team workspaces",
      "Role-based access control",
      "Team invitations via email",
      "Shared pipeline & deal visibility",
    ],
  },
  {
    icon: Globe,
    label: "Integrations",
    features: [
      "Gmail (OAuth direct send)",
      "SendGrid & Resend email providers",
      "Custom SMTP",
      "Nango OAuth integrations",
      "Apify scraping integrations",
      "Sentry error monitoring",
    ],
  },
];

export default function Subscription() {
  const { subscribed, productId, subscriptionEnd, trialEndsAt, isInTrial, checkSubscription } = useAuth();
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const handleSubscribe = async () => {
    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        'https://kgndpwzqohepotahnfeo.supabase.co/functions/v1/create-checkout',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token}`,
            'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtnbmRwd3pxb2hlcG90YWhuZmVvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE4NDU1MzMsImV4cCI6MjA3NzQyMTUzM30.2bCLyRArq4uFd4eg9TjB2PYq3ewxKCQMcW6C-ZX_nf0',
          },
        }
      );
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error || `HTTP ${res.status}`);
      if (body?.url) {
        window.open(body.url, '_blank');
      } else {
        throw new Error('No checkout URL returned');
      }
    } catch (error: unknown) {
      const raw = error instanceof Error ? error.message : String(error);
      const msg = raw.includes('No such price')
        ? 'Stripe price not found — contact support.'
        : raw.includes('Invalid API Key') || raw.includes('No API key')
        ? 'Stripe is misconfigured — contact support.'
        : raw;
      toast.error(`Checkout failed: ${msg}`);
    } finally {
      setLoading(false);
    }
  };

  const handleManageSubscription = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.functions.invoke('customer-portal');
      if (error) throw error;
      if (data?.url) window.open(data.url, '_blank');
      else throw new Error('No portal URL returned');
    } catch (error) {
      toast.error('Failed to open subscription management');
    } finally {
      setLoading(false);
    }
  };

  const handleRefreshStatus = async () => {
    try {
      setRefreshing(true);
      await checkSubscription();
      toast.success('Subscription status updated');
    } catch {
      toast.error('Failed to refresh subscription status');
    } finally {
      setRefreshing(false);
    }
  };

  const isLeadBoostersActive = subscribed && productId === LEADBOOSTERS_PRODUCT_ID;

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      {/* Header */}
      <div className="mb-8 flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold mb-1">LeadBoosters Premium</h1>
          <p className="text-muted-foreground">Everything you need to find, engage, and close more deals</p>
        </div>
        <Button onClick={handleRefreshStatus} variant="outline" disabled={refreshing} size="sm">
          {refreshing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
          Refresh Status
        </Button>
      </div>

      {/* Trial banner */}
      {isInTrial && !subscribed && (
        <Card className="mb-6 border-blue-500 bg-blue-500/5">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-blue-500 shrink-0" />
                <div>
                  <p className="font-semibold text-blue-700 dark:text-blue-400">Free Trial Active</p>
                  {trialEndsAt && (
                    <p className="text-sm text-muted-foreground">
                      Ends {format(new Date(trialEndsAt), 'MMMM d, yyyy')} — subscribe to keep full access
                    </p>
                  )}
                </div>
              </div>
              <Button onClick={handleSubscribe} disabled={loading} size="sm">
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                Subscribe Now
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Active subscription banner */}
      {subscribed && (
        <Card className="mb-6 border-primary bg-primary/5">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-primary shrink-0" />
                <div>
                  <p className="font-semibold text-primary">Active Subscription</p>
                  {subscriptionEnd && (
                    <p className="text-sm text-muted-foreground">
                      Renews {format(new Date(subscriptionEnd), 'MMMM d, yyyy')}
                    </p>
                  )}
                </div>
              </div>
              <Button onClick={handleManageSubscription} variant="outline" disabled={loading} size="sm">
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Manage Billing
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Pricing hero card */}
      <Card className={`mb-8 ${isLeadBoostersActive ? 'border-primary' : ''}`}>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-6">
            <div>
              <div className="flex items-baseline gap-1 mb-1">
                <span className="text-5xl font-extrabold">£29</span>
                <span className="text-xl text-muted-foreground">/month</span>
              </div>
              <p className="text-sm text-muted-foreground">or $29.99/month · billed monthly · cancel any time</p>
              <p className="text-sm text-muted-foreground mt-1">New accounts get a <span className="font-medium text-foreground">7-day free trial</span></p>
            </div>
            {!isLeadBoostersActive && (
              <Button onClick={handleSubscribe} size="lg" className="sm:w-52" disabled={loading}>
                {loading
                  ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Loading...</>
                  : <><Sparkles className="mr-2 h-4 w-4" />Subscribe Now</>}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Feature grid */}
      <div className="mb-4">
        <h2 className="text-lg font-semibold mb-1">Everything included</h2>
        <p className="text-sm text-muted-foreground">One plan. All features. No hidden limits.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {FEATURE_GROUPS.map(({ icon: Icon, label, features }) => (
          <Card key={label} className="border bg-card">
            <CardHeader className="pb-3 pt-4 px-4">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-md bg-primary/10">
                  <Icon className="h-4 w-4 text-primary" />
                </div>
                <CardTitle className="text-sm font-semibold">{label}</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="px-4 pb-4 pt-0">
              <ul className="space-y-1.5">
                {features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-xs text-muted-foreground">
                    <Check className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Bottom CTA */}
      {!isLeadBoostersActive && (
        <div className="mt-8 text-center">
          <Button onClick={handleSubscribe} size="lg" disabled={loading} className="px-10">
            {loading
              ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Loading...</>
              : <><Sparkles className="mr-2 h-4 w-4" />Get LeadBoosters Premium — £29/mo</>}
          </Button>
          <p className="text-xs text-muted-foreground mt-2">New accounts start with a 7-day free trial. Cancel any time.</p>
        </div>
      )}
    </div>
  );
}
