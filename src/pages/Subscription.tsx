import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth, PLAN_LABELS, TIER_FEATURES } from "@/contexts/AuthContext";

type PlanId = "crm" | "autopilot" | "autopilot_pro" | "agency";
const PLAN_IDS: PlanId[] = ["crm", "autopilot", "autopilot_pro", "agency"];
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Loader2, Sparkles, Check, RefreshCw,
  Users, Building2, Target, Mail, Bot,
  BarChart2, Layers, ShieldCheck, Inbox, Globe, Star
} from "lucide-react";
import { Fragment, useEffect, useRef, useState } from "react";
import { format } from "date-fns";
import { useSearchParams } from "react-router-dom";

type Cell = boolean | string;
type CompareRow = { label: string; cells: [Cell, Cell, Cell, Cell] };
const ALL: [Cell, Cell, Cell, Cell] = [true, true, true, true];
const AUTO: [Cell, Cell, Cell, Cell] = [false, true, true, true];
const PRO: [Cell, Cell, Cell, Cell] = [false, false, true, true];
const DEFAULT_LIMITS: Record<string, { leads: number; personas: number }> = {
  crm: { leads: 100, personas: 0 }, autopilot: { leads: 500, personas: 1 }, autopilot_pro: { leads: 2000, personas: 3 }, agency: { leads: 10000, personas: 20 },
};
const PLAN_ORDER = ['crm', 'autopilot', 'autopilot_pro', 'agency'] as const;

const compareGroups = (L: typeof DEFAULT_LIMITS): { label: string; rows: CompareRow[] }[] => {
  const per = (f: (l: { leads: number; personas: number }) => string) => PLAN_ORDER.map((p) => f(L[p])) as [Cell, Cell, Cell, Cell];
  return [
    { label: 'CRM & pipeline', rows: [
      { label: 'Companies, people, deals and visual pipeline', cells: ALL },
      { label: 'Notes, events, files and invoices', cells: ALL },
      { label: 'Teams, roles and shared inbox', cells: ALL },
      { label: 'In-app notifications', cells: ALL },
    ] },
    { label: 'Outreach', rows: [
      { label: 'Email campaigns, newsletters and newsletter series', cells: ALL },
      { label: 'SMS campaigns and two-way SMS conversations', cells: ALL },
      { label: 'AI phone campaigns', cells: ALL },
      { label: 'Sequences with automatic follow-ups that stop on reply', cells: ALL },
      { label: 'AI email writer that knows your business and persona', cells: ALL },
      { label: 'Bulk pause, resume and stop; resend to openers or clickers', cells: ALL },
      { label: 'Recipient groups with automatic duplicate removal', cells: ALL },
      { label: 'Email branding and custom templates', cells: ALL },
      { label: 'One inbox for email and SMS replies', cells: ALL },
    ] },
    { label: 'Finding leads', rows: [
      { label: 'New leads each month', cells: per((l) => l.leads.toLocaleString('en-GB')) },
      { label: 'Lead Finder, Lead Inbox and Research Chat', cells: ALL },
      { label: 'Hospitality leads', cells: ALL },
      { label: 'Active personas', cells: per((l) => String(Math.max(1, l.personas))) },
      { label: 'AI persona builder from a website and description', cells: ALL },
      { label: 'Autopilot: finds leads, writes, sends and follows up every day', cells: AUTO },
      { label: 'Daily Autopilot summary email', cells: AUTO },
      { label: 'AI company enrichment and lead scoring', cells: AUTO },
      { label: 'Auto-Response Hub: AI replies to inbound email', cells: AUTO },
    ] },
    { label: 'AI & automation', rows: [
      { label: 'Learns your business from your website', cells: ALL },
      { label: 'Daily AI automations and automation rules', cells: ALL },
      { label: 'Claude and ChatGPT connection, API keys', cells: PRO },
    ] },
    { label: 'Sending & deliverability', rows: [
      { label: 'Send through Gmail, Outlook, SMTP, Resend or SendGrid', cells: ALL },
      { label: 'Connected sending accounts', cells: ['1', '1', 'Several', 'Several'] },
      { label: 'Open, click, reply, bounce and complaint tracking', cells: ALL },
      { label: 'Deliverability monitoring', cells: ALL },
    ] },
    { label: 'Support', rows: [
      { label: 'Priority onboarding and support', cells: [false, false, false, true] },
    ] },
  ];
};

export default function Subscription() {
  const { subscribed, productId, subscriptionEnd, trialEndsAt, isInTrial, checkSubscription, planTier } = useAuth();
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const autoCheckoutStarted = useRef(false);
  const [limits, setLimits] = useState(DEFAULT_LIMITS);
  useEffect(() => {
    // Plan limits are editable in the admin console: show the live numbers
    (supabase as any).from('plan_limits').select('tier, leads_per_month, personas').then(({ data }: any) => {
      if (!data?.length) return;
      const next = { ...DEFAULT_LIMITS };
      for (const r of data) if (r.tier in next) next[r.tier] = { leads: r.leads_per_month, personas: r.personas };
      setLimits(next);
    });
  }, []);
  const n = (v: number) => v.toLocaleString('en-GB');

  const [interval, setInterval_] = useState<'monthly' | 'yearly'>('monthly');
  const handleSubscribe = async (plan: PlanId = 'autopilot') => {
    try {
      setLoading(true);
      const { data, error } = await supabase.functions.invoke('create-checkout', { body: { plan, interval } });
      if (error) throw error;
      if (data?.url) {
        window.location.assign(data.url);
      } else {
        throw new Error(data?.error || 'No checkout URL returned');
      }
    } catch (error: unknown) {
      const raw = error instanceof Error ? error.message : String(error);
      const msg = raw.includes('No such price') || raw.includes('No active price')
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
    if (searchParams.get('checkout') !== 'true' || subscribed || autoCheckoutStarted.current) return;
    autoCheckoutStarted.current = true;
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('checkout');
    setSearchParams(nextParams, { replace: true });
    const wanted = searchParams.get('plan') as PlanId | null;
    void handleSubscribe(wanted && PLAN_IDS.includes(wanted) ? wanted : 'autopilot');
  }, [searchParams, setSearchParams, subscribed]);

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

  const legacyPlan = ['individual', 'pro', 'leadboosters', 'legacy_full'].includes(planTier) && subscribed;
  const yearly = interval === 'yearly';
  const plans = [
    {
      id: 'crm' as PlanId, name: 'CRM', monthly: 29,
      description: 'Your CRM, campaigns and follow-ups in one place',
      features: ['People, Companies & Deals CRM', 'Email & SMS campaigns, newsletters', 'Sequences with automatic follow-ups', 'AI email writer', `Lead Finder: ${n(limits.crm.leads)} new leads a month`],
      highlight: false, color: 'border-sky-500', badgeCls: 'bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-400',
    },
    {
      id: 'autopilot' as PlanId, name: 'Autopilot', monthly: 99,
      description: 'An AI sales rep that finds, writes to and follows up new leads every day',
      features: ['Everything in CRM', `Autopilot: up to ${n(limits.autopilot.leads)} new leads a month`, `${limits.autopilot.personas} target persona${limits.autopilot.personas === 1 ? '' : 's'}`, 'Personal AI email for every lead, sent and followed up', 'AI enrichment, scoring & auto-replies'],
      highlight: true, color: 'border-primary', badgeCls: 'bg-primary/10 text-primary',
    },
    {
      id: 'autopilot_pro' as PlanId, name: 'Autopilot Pro', monthly: 249,
      description: 'More reach, more audiences, more channels',
      features: ['Everything in Autopilot', `Up to ${n(limits.autopilot_pro.leads)} new leads a month`, `${limits.autopilot_pro.personas} target personas`, 'Several sending accounts', 'Claude / ChatGPT connection & API keys'],
      highlight: false, color: 'border-violet-500', badgeCls: 'bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-400',
    },
    {
      id: 'agency' as PlanId, name: 'Agency', monthly: 499,
      description: 'For agencies and multi-brand teams',
      features: ['Everything in Autopilot Pro', `Up to ${n(limits.agency.leads)} new leads a month`, `Up to ${limits.agency.personas} personas for brands or clients`, 'Priority onboarding & support'],
      highlight: false, color: 'border-amber-500', badgeCls: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400',
    },
  ].map((p) => ({
    ...p,
    price: yearly ? `£${(p.monthly * 10).toLocaleString()}` : `£${p.monthly}`,
    per: yearly ? '/year' : '/month',
    note: yearly ? `2 months free (£${Math.round((p.monthly * 10) / 12)}/month)` : null,
    isCurrent: planTier === p.id,
    btnLabel: `Choose ${p.name}`,
  }));

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
              <Button onClick={() => handleSubscribe('autopilot')} disabled={loading} size="sm">
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
                    Active — {PLAN_LABELS[planTier] || 'LeadBoosters'} plan
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

      {legacyPlan && (
        <div className="mb-4 rounded-lg border bg-muted/40 p-3 text-sm">
          You're on a legacy plan ({PLAN_LABELS[planTier]}). It stays at your current price with everything you have today; switch below whenever you like.
        </div>
      )}

      {/* Monthly / yearly */}
      <div className="mb-4 flex items-center justify-center gap-1 rounded-full border bg-muted/40 p-1 w-fit mx-auto">
        {(['monthly', 'yearly'] as const).map((iv) => (
          <button key={iv} type="button" onClick={() => setInterval_(iv)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${interval === iv ? 'bg-background shadow text-foreground' : 'text-muted-foreground'}`}>
            {iv === 'monthly' ? 'Monthly' : 'Yearly · 2 months free'}
          </button>
        ))}
      </div>

      {/* Plan grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-10">
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
                <span className="text-sm text-muted-foreground">{plan.per}</span>
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
                  onClick={subscribed && !legacyPlan ? handleManageSubscription : () => handleSubscribe(plan.id)}
                  className="w-full"
                >
                  {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                  {subscribed && !legacyPlan ? `Switch to ${plan.name}` : plan.btnLabel}
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

      {/* Plan comparison */}
      <div className="mb-4">
        <h2 className="text-lg font-semibold mb-1">Compare plans</h2>
        <p className="text-sm text-muted-foreground">What each plan includes. The free trial gives you Autopilot for 7 days.</p>
      </div>

      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b">
              <th className="p-3 text-left font-medium text-muted-foreground">Feature</th>
              {plans.map((p) => (
                <th key={p.id} className={`p-3 text-center font-semibold whitespace-nowrap ${p.isCurrent ? 'text-primary' : ''}`}>
                  {p.name}
                  <div className="text-xs font-normal text-muted-foreground">{p.price}{p.per}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {compareGroups(limits).map((g) => (
              <Fragment key={g.label}>
                <tr className="bg-muted/50">
                  <td colSpan={5} className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{g.label}</td>
                </tr>
                {g.rows.map((r) => (
                  <tr key={r.label} className="border-t">
                    <td className="p-3">{r.label}</td>
                    {r.cells.map((c, i) => (
                      <td key={i} className="p-3 text-center tabular-nums">
                        {c === true ? <Check className="h-4 w-4 text-primary inline" aria-label="Included" />
                          : c === false ? <span className="text-muted-foreground" aria-label="Not included">–</span>
                          : <span className="font-medium">{c}</span>}
                      </td>
                    ))}
                  </tr>
                ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {/* Bottom CTA — only show when not subscribed */}
      {!subscribed && (
        <div className="mt-8 text-center">
          <Button onClick={() => handleSubscribe('autopilot')} size="lg" disabled={loading} className="px-10">
            {loading
              ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Loading...</>
              : <><Sparkles className="mr-2 h-4 w-4" />Start your 7-day free trial of Autopilot</>}
          </Button>
          <p className="text-xs text-muted-foreground mt-2">New accounts start with a 7-day free trial. Cancel any time.</p>
        </div>
      )}
    </div>
  );
}
