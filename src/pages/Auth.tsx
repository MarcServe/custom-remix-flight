import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Loader2, Check, Star, Zap, Search, Mail, BarChart2, Users,
  Brain, Inbox, MessageSquare, Phone, Sparkles, ArrowRight,
  Shield, Building2, TrendingUp, Target, Bot, Layers, ChevronDown,
  ChevronUp, CheckCircle2,
} from 'lucide-react';
import { z } from 'zod';
import leadBoostersLogo from '@/assets/leadboosters-logo.png';
import heroImage from '@/assets/genie.png';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const emailSchema = z.string().email('Invalid email address');
const passwordSchema = z.string().min(6, 'Password must be at least 6 characters');
const nameSchema = z.string().min(2, 'Name must be at least 2 characters');

// ─── Data ─────────────────────────────────────────────────────────────────────

const FEATURES = [
  {
    icon: Search,
    title: 'AI Lead Finder',
    desc: 'Search millions of companies and contacts. Filter by industry, size, location, tech stack, and more.',
    tier: 'Pro',
  },
  {
    icon: Brain,
    title: 'Autopilot',
    desc: 'Set your ideal customer profile once. Autopilot discovers new leads in the background, 24/7.',
    tier: 'LeadBoosters',
  },
  {
    icon: Zap,
    title: 'AI Enrichment',
    desc: 'Auto-fill company details, find decision-maker contacts, and score leads for campaign fit.',
    tier: 'LeadBoosters',
  },
  {
    icon: Mail,
    title: 'Email Campaigns',
    desc: 'Send bulk personalised emails with A/B testing, scheduling, open tracking, and reply detection.',
    tier: 'Individual',
  },
  {
    icon: Target,
    title: 'Sequences',
    desc: 'Multi-step automated follow-ups with behavioral triggers, delays, and per-recipient personalisation.',
    tier: 'Pro',
  },
  {
    icon: Layers,
    title: 'Newsletters & Series',
    desc: 'Broadcast newsletters and automated drip campaigns to subscriber lists with full unsubscribe handling.',
    tier: 'Individual',
  },
  {
    icon: Building2,
    title: 'CRM & Pipeline',
    desc: 'Companies, people, deals, and a visual drag-and-drop sales pipeline with activity logs.',
    tier: 'Individual',
  },
  {
    icon: Bot,
    title: 'Auto-Responses',
    desc: 'AI reads inbound emails and replies automatically. Capture leads from your inbox without lifting a finger.',
    tier: 'LeadBoosters',
  },
  {
    icon: Inbox,
    title: 'Lead Inbox',
    desc: 'Centralised inbox for all inbound leads. Score, qualify, and route them to your CRM pipeline.',
    tier: 'Pro',
  },
  {
    icon: MessageSquare,
    title: 'Unified Conversations',
    desc: 'Full email threading with your contacts. Shared team inbox and reply-to-lead auto-sync.',
    tier: 'Individual',
  },
  {
    icon: Phone,
    title: 'Phone Campaigns',
    desc: 'Run outbound phone campaigns alongside your email outreach from the same dashboard.',
    tier: 'Individual',
  },
  {
    icon: BarChart2,
    title: 'Analytics & Deliverability',
    desc: 'Open rates, click rates, bounce tracking, spam complaint monitoring, and email health scoring.',
    tier: 'Individual',
  },
];

const PLANS = [
  {
    name: 'Individual',
    price: '9.99',
    desc: 'Core CRM, campaigns, and newsletters for solo users.',
    features: [
      'People, Companies & Deals CRM',
      'Bulk email campaigns + A/B testing',
      'Newsletters & broadcast sending',
      'Phone campaigns',
      'Notes, invoices & activity logs',
      'Team conversations',
    ],
    highlight: false,
    cta: 'Start free trial',
    badge: null,
  },
  {
    name: 'Pro',
    price: '19.99',
    desc: 'Everything in Individual plus lead generation and automation.',
    features: [
      'Everything in Individual',
      'AI Lead Finder (millions of contacts)',
      'Lead Inbox & qualification',
      'Email Sequences & Company Sequences',
      'Newsletter Series (drip campaigns)',
      'Per-recipient personalised email import',
    ],
    highlight: true,
    cta: 'Start free trial',
    badge: 'Most popular',
  },
  {
    name: 'LeadBoosters CRM',
    price: '29',
    desc: 'Full AI suite: enrichment, autopilot, and auto-responses.',
    features: [
      'Everything in Pro',
      'AI Company Enrichment',
      'Autopilot (autonomous lead discovery)',
      'Auto-Response Hub (AI-powered replies)',
      'AI email writer & lead scoring',
      'Priority support',
    ],
    highlight: false,
    cta: 'Start free trial',
    badge: null,
  },
];

const FAQS = [
  {
    q: 'Is there a free trial?',
    a: 'Yes — every new account gets 7 days of full LeadBoosters access for free. No credit card required to start.',
  },
  {
    q: 'Can I upgrade or downgrade later?',
    a: 'Absolutely. Plans are billed monthly and you can switch tiers at any time via the billing portal. Changes take effect immediately.',
  },
  {
    q: 'Do I need to import my own contacts?',
    a: 'No. The Lead Finder and Autopilot (Pro/LeadBoosters) discover contacts for you. You can also import CSVs or add contacts manually.',
  },
  {
    q: 'Which email providers are supported?',
    a: 'We support Gmail, custom SMTP, SendGrid, Resend, and multiple sending accounts per workspace.',
  },
];

const TIER_COLOR: Record<string, string> = {
  Individual: 'text-sky-600 bg-sky-50 dark:bg-sky-950/40 border-sky-200 dark:border-sky-800',
  Pro: 'text-violet-600 bg-violet-50 dark:bg-violet-950/40 border-violet-200 dark:border-violet-800',
  LeadBoosters: 'text-amber-600 bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800',
};

// ─── Google SVG ───────────────────────────────────────────────────────────────
const GoogleIcon = () => (
  <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
    <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
    <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
    <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
    <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
  </svg>
);

// ─── Component ────────────────────────────────────────────────────────────────
export default function Auth() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { signIn, signUp, resetPassword, user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showReset, setShowReset] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const mode = searchParams.get('mode') || 'signin';
  const invitationToken = searchParams.get('invitation');
  const rawReturnTo = searchParams.get('returnTo');
  const returnTo = rawReturnTo?.startsWith('/') && !rawReturnTo.startsWith('//') ? rawReturnTo : '/';

  const goToAuth = (signupMode: boolean) => {
    navigate(`/auth?mode=${signupMode ? 'signup' : 'signin'}`, { replace: false });
    setTimeout(() => {
      const el = document.getElementById('auth');
      el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  };

  // Navigate away ONLY in an effect — never during render.
  // Calling navigate() during render causes React 18 to throw
  // "Cannot update a component while rendering" which freezes
  // the whole page and makes inputs unresponsive.
  useEffect(() => {
    if (user) {
      navigate(returnTo, { replace: true });
    }
  }, [user, navigate, returnTo]);

  if (user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const validateField = (name: string, value: string) => {
    try {
      if (name === 'email') emailSchema.parse(value);
      else if (name === 'password') passwordSchema.parse(value);
      else if (name === 'fullName') nameSchema.parse(value);
      setErrors(prev => ({ ...prev, [name]: '' }));
      return true;
    } catch (error: any) {
      setErrors(prev => ({ ...prev, [name]: error.issues?.[0]?.message || 'Invalid input' }));
      return false;
    }
  };

  const handleSignIn = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;
    if (!validateField('email', email) || !validateField('password', password)) return;
    setLoading(true);
    const { error } = await signIn(email, password);
    if (!error && invitationToken) {
      try {
        await new Promise(resolve => setTimeout(resolve, 500));
        await supabase.rpc('accept_team_invitation', { invitation_token: invitationToken });
      } catch {}
    }
    setLoading(false);
  };

  const handleSignUp = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const fullName = formData.get('fullName') as string;
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;
    if (!validateField('fullName', fullName) || !validateField('email', email) || !validateField('password', password)) return;
    setLoading(true);
    await signUp(email, password, fullName, returnTo);
    setLoading(false);
  };

  const handleResetPassword = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const email = formData.get('email') as string;
    if (!validateField('email', email)) return;
    setLoading(true);
    await resetPassword(email);
    setLoading(false);
    setShowReset(false);
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/` },
    });
    if (error) {
      toast.error('Failed to sign in with Google');
      setLoading(false);
    }
  };

  // ── Auth panel (shared by mobile + desktop) ──────────────────────────────
  // NOTE: this MUST be a plain JSX element, not a nested component. Defining a
  // component inside Auth's render (const AuthPanel = () => …) makes it a new
  // component type every render, so React remounts the whole panel on each
  // keystroke — destroying the input's focus/value. That was the "can't type" bug.
  const authPanel = (
    <div className="w-full max-w-sm mx-auto">
      <div className="flex justify-center mb-6">
        <img src={leadBoostersLogo} alt="LeadBoosters" className="h-14 w-auto drop-shadow" />
      </div>

      <div className="text-center mb-6">
        <h2 className="text-xl font-bold">LeadBoosters CRM</h2>
        <p className="text-sm text-muted-foreground mt-1">7-day free trial. No credit card required.</p>
      </div>

      {/* Trial badge */}
      <div className="flex items-center justify-center gap-2 rounded-xl bg-primary/10 border border-primary/20 px-4 py-2.5 mb-6">
        <Sparkles className="h-4 w-4 text-primary shrink-0" />
        <span className="text-xs font-semibold text-primary">Full LeadBoosters access free for 7 days</span>
      </div>

      <Tabs value={mode} onValueChange={(v) => navigate(`?mode=${v}`, { replace: true })} className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-4">
          <TabsTrigger value="signin">Sign In</TabsTrigger>
          <TabsTrigger value="signup">Sign Up</TabsTrigger>
        </TabsList>

        {/* ── Sign In ── */}
        <TabsContent value="signin">
          {!showReset ? (
            <div className="space-y-4">
              <Button type="button" variant="outline" className="w-full" onClick={handleGoogleSignIn} disabled={loading}>
                <GoogleIcon />
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Continue with Google'}
              </Button>
              <div className="relative">
                <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">Or email</span>
                </div>
              </div>
              <form onSubmit={handleSignIn} className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="si-email">Email</Label>
                  <Input id="si-email" name="email" type="email" placeholder="you@example.com" required onChange={e => validateField('email', e.target.value)} />
                  {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="si-password">Password</Label>
                  <Input id="si-password" name="password" type="password" placeholder="••••••••" required onChange={e => validateField('password', e.target.value)} />
                  {errors.password && <p className="text-xs text-destructive">{errors.password}</p>}
                </div>
                <div className="flex justify-end">
                  <button type="button" onClick={() => setShowReset(true)} className="text-xs text-muted-foreground hover:text-primary transition-colors">
                    Forgot password?
                  </button>
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Sign In
                </Button>
              </form>
            </div>
          ) : (
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="reset-email">Email</Label>
                <Input id="reset-email" name="email" type="email" placeholder="you@example.com" required onChange={e => validateField('email', e.target.value)} />
                {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Send Reset Link
              </Button>
              <div className="text-center">
                <button type="button" onClick={() => setShowReset(false)} className="text-xs text-muted-foreground hover:text-primary">
                  Back to Sign In
                </button>
              </div>
            </form>
          )}
        </TabsContent>

        {/* ── Sign Up ── */}
        <TabsContent value="signup">
          {invitationToken && (
            <div className="mb-4 p-3 bg-primary/10 border border-primary/20 rounded-lg">
              <p className="text-sm text-primary font-medium">You have been invited to join a team!</p>
              <p className="text-xs text-muted-foreground mt-1">Complete sign up to accept the invitation.</p>
            </div>
          )}
          <div className="space-y-4">
            <Button type="button" variant="outline" className="w-full" onClick={handleGoogleSignIn} disabled={loading}>
              <GoogleIcon />
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Continue with Google'}
            </Button>
            <div className="relative">
              <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">Or email</span>
              </div>
            </div>
            <form onSubmit={handleSignUp} className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="su-name">Full Name</Label>
                <Input id="su-name" name="fullName" type="text" placeholder="Jane Smith" required onChange={e => validateField('fullName', e.target.value)} />
                {errors.fullName && <p className="text-xs text-destructive">{errors.fullName}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="su-email">Email</Label>
                <Input id="su-email" name="email" type="email" placeholder="you@example.com" required onChange={e => validateField('email', e.target.value)} />
                {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="su-password">Password</Label>
                <Input id="su-password" name="password" type="password" placeholder="Min. 6 characters" required onChange={e => validateField('password', e.target.value)} />
                {errors.password && <p className="text-xs text-destructive">{errors.password}</p>}
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create free account
              </Button>
            </form>
            <p className="text-center text-[11px] text-muted-foreground">
              By signing up you agree to our{' '}
              <span className="underline cursor-pointer hover:text-foreground">Terms</span> and{' '}
              <span className="underline cursor-pointer hover:text-foreground">Privacy Policy</span>.
            </p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );

  // ── Marketing content ─────────────────────────────────────────────────────
  // Plain JSX element (not a nested component) — same reason as authPanel above.
  const marketingContent = (
    <>
      {/* ── Nav ── */}
      <nav className="flex items-center justify-between px-6 py-4 border-b sticky top-0 z-10 bg-background/80 backdrop-blur-md">
        <div className="flex items-center gap-2.5">
          <img src={leadBoostersLogo} alt="LeadBoosters" className="h-8 w-auto" />
          <span className="font-bold text-base hidden sm:block">LeadBoosters</span>
        </div>
        <div className="flex items-center gap-2">
          <a href="#pricing" className="text-sm text-muted-foreground hover:text-foreground transition-colors hidden sm:block">Pricing</a>
          <a href="#features" className="text-sm text-muted-foreground hover:text-foreground transition-colors hidden sm:block mr-2">Features</a>
          <span className="text-sm text-muted-foreground hidden sm:block">|</span>
          <button type="button" onClick={() => goToAuth(false)} className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors sm:block hidden ml-2">Sign in</button>
          <Button size="sm" className="gap-1.5" onClick={() => goToAuth(true)}>
            Get started free <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="relative overflow-hidden px-6 py-10 sm:py-14 lg:py-20">
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_hsl(var(--primary)/0.18),_transparent_55%),linear-gradient(180deg,_hsl(var(--background))_0%,_hsl(280_40%_98%)_100%)]"
          aria-hidden
        />
        <div className="relative mx-auto grid max-w-5xl items-center gap-8 lg:grid-cols-2 lg:gap-12">
          {/* Hero image: first on mobile, right column on desktop */}
          <div className="order-1 lg:order-2 flex justify-center lg:justify-end">
            <img
              src={heroImage}
              alt="LeadBoosters — AI-powered lead generation"
              className="w-full max-w-[min(100%,22rem)] sm:max-w-md lg:max-w-lg h-auto object-contain drop-shadow-xl animate-fade-in"
            />
          </div>

          <div className="order-2 lg:order-1 text-center lg:text-left">
            <div className="inline-flex items-center gap-2 rounded-full border bg-muted/50 px-3 py-1 text-xs font-medium text-muted-foreground mb-5">
              <Sparkles className="h-3 w-3 text-primary" />
              AI-powered lead generation and outreach
            </div>

            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight leading-tight mb-4">
              Find leads, enrich them,{' '}
              <span className="bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                close more deals
              </span>
            </h1>

            <p className="text-base sm:text-lg text-muted-foreground mb-7 max-w-xl mx-auto lg:mx-0 leading-relaxed">
              LeadBoosters combines AI lead discovery, company enrichment, bulk email campaigns,
              sequences, and a full CRM pipeline in one platform.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 justify-center lg:justify-start mb-8">
              <Button size="lg" className="gap-2 px-8 shadow-lg" onClick={() => goToAuth(true)}>
                <Sparkles className="h-4 w-4" />
                Start free 7-day trial
              </Button>
              <a href="#features">
                <Button size="lg" variant="outline" className="gap-2 px-8 w-full sm:w-auto">
                  See all features <ArrowRight className="h-4 w-4" />
                </Button>
              </a>
            </div>

            <div className="flex flex-wrap items-center justify-center lg:justify-start gap-x-6 gap-y-2 text-xs text-muted-foreground">
              {[
                { icon: Shield, text: 'No credit card required' },
                { icon: CheckCircle2, text: '7-day free trial' },
                { icon: Zap, text: 'Cancel anytime' },
                { icon: Users, text: 'Unlimited contacts' },
              ].map(({ icon: Icon, text }) => (
                <span key={text} className="flex items-center gap-1.5">
                  <Icon className="h-3.5 w-3.5 text-primary" />
                  {text}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Stats bar ── */}
      <section className="border-y bg-muted/30 px-6 py-6">
        <div className="max-w-3xl mx-auto grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
          {[
            { value: '10M+', label: 'Contacts in database' },
            { value: '50K+', label: 'Emails sent per day' },
            { value: '99.9%', label: 'Uptime guarantee' },
            { value: '7 days', label: 'Free trial, no card' },
          ].map(({ value, label }) => (
            <div key={label}>
              <p className="text-2xl font-extrabold text-foreground">{value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Features ── */}
      <section id="features" className="px-6 py-16">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-2xl sm:text-3xl font-bold mb-2">Everything you need to scale outreach</h2>
            <p className="text-muted-foreground text-sm max-w-lg mx-auto">
              From lead discovery to closed deal — one platform, no switching tabs.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {FEATURES.map(({ icon: Icon, title, desc, tier }) => (
              <div key={title} className="rounded-xl border bg-card p-4 hover:shadow-sm transition-shadow flex gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  <Icon className="h-4 w-4 text-primary" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold">{title}</p>
                    <span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-bold leading-none ${TIER_COLOR[tier] || TIER_COLOR['Individual']}`}>
                      {tier}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 leading-snug">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pricing ── */}
      <section id="pricing" className="px-6 py-16 bg-muted/20 border-t">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-2xl sm:text-3xl font-bold mb-2">Simple, transparent pricing</h2>
            <p className="text-muted-foreground text-sm">
              Start free for 7 days. No credit card. Cancel any time.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {PLANS.map((plan) => (
              <div
                key={plan.name}
                className={`relative rounded-2xl border-2 bg-card p-6 flex flex-col ${plan.highlight ? 'border-primary shadow-lg shadow-primary/10' : 'border-border'}`}
              >
                {plan.badge && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                    <span className="inline-flex items-center gap-1 rounded-full bg-primary px-3 py-0.5 text-[11px] font-bold text-primary-foreground shadow-sm">
                      <Star className="h-3 w-3" /> {plan.badge}
                    </span>
                  </div>
                )}
                <div className="mb-4">
                  <h3 className="font-bold text-base">{plan.name}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">{plan.desc}</p>
                  <div className="flex items-baseline gap-1 mt-3">
                    <span className="text-3xl font-extrabold">&#163;{plan.price}</span>
                    <span className="text-sm text-muted-foreground">/mo</span>
                  </div>
                </div>
                <ul className="space-y-2 flex-1 mb-6">
                  {plan.features.map(f => (
                    <li key={f} className="flex items-start gap-2 text-xs text-muted-foreground">
                      <Check className="h-3.5 w-3.5 text-emerald-500 mt-0.5 shrink-0" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <Button
                  className="w-full"
                  variant={plan.highlight ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => navigate(`/auth?mode=signup&returnTo=${encodeURIComponent('/subscription?checkout=true')}`)}
                >
                  {plan.cta}
                </Button>
                <p className="text-center text-[10px] text-muted-foreground mt-2">
                  7-day free trial included
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="px-6 py-16 border-t">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-8">Frequently asked questions</h2>
          <div className="space-y-2">
            {FAQS.map((faq, i) => (
              <div key={i} className="rounded-xl border overflow-hidden">
                <button
                  className="flex w-full items-center justify-between gap-4 px-5 py-4 text-sm font-medium text-left hover:bg-muted/50 transition-colors"
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                >
                  <span>{faq.q}</span>
                  {openFaq === i
                    ? <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" />
                    : <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />}
                </button>
                {openFaq === i && (
                  <div className="px-5 pb-4 text-sm text-muted-foreground border-t bg-muted/20">
                    <p className="pt-3 leading-relaxed">{faq.a}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Bottom CTA ── */}
      <section className="px-6 py-16 text-center border-t bg-gradient-to-br from-primary/5 via-background to-primary/5">
        <div className="max-w-xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-bold mb-3">Ready to fill your pipeline?</h2>
          <p className="text-muted-foreground text-sm mb-6">
            Join teams using LeadBoosters to find, enrich, and close leads at scale.
          </p>
          <Button size="lg" className="gap-2 px-10 shadow-lg" onClick={() => goToAuth(true)}>
            <Sparkles className="h-4 w-4" />
            Start free trial
          </Button>
          <p className="text-xs text-muted-foreground mt-3">7 days free. No credit card. Cancel any time.</p>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t px-6 py-8">
        <div className="max-w-3xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <img src={leadBoostersLogo} alt="LeadBoosters" className="h-6 w-auto opacity-70" />
            <span>LeadBoosters CRM &copy; {new Date().getFullYear()} Biz Boosters Ltd</span>
          </div>
          <div className="flex gap-4">
            <span className="hover:text-foreground cursor-pointer transition-colors">Terms</span>
            <span className="hover:text-foreground cursor-pointer transition-colors">Privacy</span>
            <span className="hover:text-foreground cursor-pointer transition-colors">Support</span>
          </div>
        </div>
      </footer>
    </>
  );

  // ── Page shell ─────────────────────────────────────────────────────────────
  return (
    <div className="bg-background text-foreground">
      {/* Desktop: split layout */}
      <div className="hidden lg:flex h-screen">
        {/* Left: scrollable marketing */}
        <div className="flex-1 overflow-y-auto">
          {marketingContent}
        </div>
        {/* Right: sticky auth panel */}
        <div id="auth" className="w-[420px] shrink-0 border-l h-screen overflow-y-auto flex items-center justify-center px-8 py-12 bg-card/40 backdrop-blur-sm">
          {authPanel}
        </div>
      </div>

      {/* Mobile: marketing hero first (image at top), then auth */}
      <div className="lg:hidden flex flex-col">
        {marketingContent}
        <div id="auth" className="px-6 py-10 border-t bg-card/40 scroll-mt-16">
          {authPanel}
        </div>
      </div>
    </div>
  );
}
