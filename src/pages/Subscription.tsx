import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth, INDIVIDUAL_PRODUCT_ID, PRO_PRODUCT_ID, PLAN_LABELS, TIER_FEATURES } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Loader2, Sparkles, Check, RefreshCw,
  Users, Building2, Target, Mail, Bot,
  BarChart2, Layers, ShieldCheck, Inbox, Globe, Star
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { format } from "date-fns";
import { useSearchParams } from "react-router-dom";

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
      "Company Enrichment (auto-fill company data)",
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
      "Send via Gmail, custom SMTP, or email providers",
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
      "AI-generated tags & contact categorisation",
      "Autopilot — background lead discovery while you sleep",
    ],
  },
  {
    icon: Inbox,
    label: "Communication & Inbox",
    features: [
      "Unified Conversations (full email threading)",
      "Shared Team Inbox",
      "Connect your Gmail account for direct sending",
      "Auto-response to leads & inbound enquiries",
      "Lead reply detection & automatic CRM sync",
    ],
  },
  {
    icon: BarChart2,
    label: "Analytics & Deliverability",
    features: [
      "Email deliverability monitoring & health score",
      "Campaign open, click & reply tracking",
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
    label: "Email & Account Connections",
    features: [
      "Connect your Gmail account",
      "SendGrid & Resend email delivery",
      "Custom SMTP server support",
      "Multiple sending accounts per workspace",
    ],
  },
];

export default function Subscription() {
  const { subscribed, productId, subscriptionEnd, trialEndsAt, isInTrial, subscriptionLoading, checkSubscription } = useAuth();
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const autoCheckoutStarted = useRef(false);

  const handleSubscribe = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.functions.invoke('create-checkout');
      if (error) throw error;
      if (data?.url) {
        window.location.assign(data.url);
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

  useEffect(() => {
    // Wait until the real subscription status is known so we don't kick off
    // checkout for a user who is actually already subscribed.
    if (subscriptionLoading || searchParams.get('checkout') !== 'true' || subscribed || autoCheckoutStarted.current) return;
    autoCheckoutStarted.current = true;
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('checkout');
    setSearchParams(nextParams, { replace: true });
    void handleSubscribe();
  }, [searchParams, setSearchParams, subscribed, subscriptionLoading]);

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

  // Avoid flashing the "not subscribed" state (bottom CTA / missing banners /
  // no "Current plan" badge) before the async subscription status resolves.
  if (subscriptionLoading) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-5xl">
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  const isIndividualActive   = subscribed && productId === INDIVIDUAL_PRODUCT_ID;
  const isProActive          = subscribed && productId === PRO_PRODUCT_ID;
  const isLeadBoostersActive = subscribed && !isIndividualActive && !isProActive;

  // 3-tier plan cards config
  const plans = [
    {
      id: 'individual',
      name: 'Individual',
      price: '£9.99',
      description: 'Core CRM for solo users and small teams',
      features: TIER_FEATURES.individual,
      isCurrent: isIndividualActive,
      highlight: false,
      btnLabel: 'Get Individual',
      color: 'border-sky-500',
      badgeCls: 'bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-400',
    },
    {
      id: 'pro',
      name: 'Pro',
      price: '£19.99',
      description: 'Lead generation + outreach automation',
      features: TIER_FEATURES.pro,
      isCurrent: isProActive,
      highlight: true,
      btnLabel: 'Get Pro',
      color: 'border-violet-500',
      badgeCls: 'bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-400',
    },
    {
      id: 'leadboosters',
      name: 'LeadBoosters CRM',
      price: '£29',
      description: 'Full AI-powered suite — unlimited everything',
      features: TIER_FEATURES.leadboosters,
      isCurrent: isLeadBoostersActive,
      highlight: false,
      btnLabel: 'Get LeadBoosters',
      color: 'border-primary',
      badgeCls: 'bg-primary/10 text-primary',
    },
  ] as const;

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      {/* Header */}
      <div className="mb-8 flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold mb-1">Plans &amp; Billing</h1>
          <p className="text-muted-foreground">Choose the plan that fits your team. Upgrade or downgrade anytime.</p>
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
                  <p className="font-semibold text-blue-700 dark:text-blue-400">Free Trial Active — full LeadBoosters access</p>
                  {trialEndsAt && (
                    <p className="text-sm text-muted-foreground">
                      Trial ends {format(new Date(trialEndsAt), 'MMMM d, yyyy')} — subscribe to keep your access
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
                  <p className="font-semibold text-primary">
                    Active — {isIndividualActive ? 'Individual' : isProActive ? 'Pro' : 'LeadBoosters CRM'} plan
                  </p>
                  {subscriptionEnd && (
                    <p className="text-sm text-muted-foreground">
                      Renews {format(new Date(subscriptionEnd), 'MMMM d, yyyy')}
                    </p>
                  )}
                </div>
              </div>
              <Button onClick={handleManageSubscription} variant="outline" disabled={loading} size="sm">
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Manage Billing / Upgrade
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 3-column plan grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
        {plans.map((plan) => (
          <Card
            key={plan.id}
            className={`relative flex flex-col border-2 ${plan.isCurrent ? plan.color : 'border-border'} ${plan.highlight && !plan.isCurrent ? 'shadow-md' : ''}`}
          >
            {plan.highlight && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <span className="inline-flex items-center gap-1 rounded-full bg-violet-600 px-3 py-0.5 text-xs font-semibold text-white shadow">
                  <Star className="h-3 w-3" /> Most popular
                </span>
              </div>
            )}
            {plan.isCurrent && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <span className={`inline-flex items-center gap-1 rounded-full px-3 py-0.5 text-xs font-semibold shadow ${plan.badgeCls}`}>
                  <Check className="h-3 w-3" /> Current plan
                </span>
              </div>
            )}
            <CardHeader className="pb-2 pt-6">
              <CardTitle className="text-base">{plan.name}</CardTitle>
              <CardDescription className="text-xs">{plan.description}</CardDescription>
              <div className="flex items-baseline gap-1 mt-2">
                <span className="text-3xl font-extrabold">{plan.price}</span>
                <span className="text-muted-foreground text-sm">/mo</span>
              </div>
            </CardHeader>
            <CardContent className="flex flex-col flex-1 gap-4 pt-0">
              <ul className="space-y-1.5 flex-1">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-xs text-muted-foreground">
                    <Check className="h-3.5 w-3.5 text-emerald-500 mt-0.5 shrink-0" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              {!plan.isCurrent && (
                <Button
                  size="sm"
                  variant={plan.highlight ? 'default' : 'outline'}
                  disabled={loading}
                  onClick={subscribed ? handleManageSubscription : handleSubscribe}
                  className="w-full"
                >
                  {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                  {subscribed ? `Switch to ${plan.name}` : plan.btnLabel}
                </Button>
              )}
              {plan.isCurrent && (
                <Button size="sm" variant="outline" disabled={loading} onClick={handleManageSubscription} className="w-full">
                  Manage billing
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Full feature grid */}
      <div className="mb-4">
        <h2 className="text-lg font-semibold mb-1">Everything included</h2>
        <p className="text-sm text-muted-foreground">All plans include core CRM — higher tiers unlock AI and automation.</p>
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

      {/* Bottom CTA — only show when not subscribed */}
      {!subscribed && (
        <div className="mt-8 text-center">
          <Button onClick={handleSubscribe} size="lg" disabled={loading} className="px-10">
            {loading
              ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Loading...</>
              : <><Sparkles className="mr-2 h-4 w-4" />Start with LeadBoosters — £29/mo</>}
          </Button>
          <p className="text-xs text-muted-foreground mt-2">New accounts start with a 7-day free trial. Cancel any time.</p>
        </div>
      )}
    </div>
  );
}
