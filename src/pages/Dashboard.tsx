import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Building2, Users, DollarSign, TrendingUp, Sparkles, Search, Mail,
  ArrowUpRight, Calendar as CalendarIcon, Clock, Bot, Zap, Inbox,
  ChevronRight, Activity, BarChart2, Target, Send, Newspaper,
  LayoutDashboard, Gauge, ArrowRight, CheckCircle2,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AutomationMetrics } from "@/components/sequences/AutomationMetrics";
import { AutoResponseAnalytics } from "@/components/sequences/AutoResponseAnalytics";
import { EmailActivityWidget } from "@/components/dashboard/EmailActivityWidget";
import { LiveEngagementTracker } from "@/components/dashboard/LiveEngagementTracker";
import { useNavigate } from "react-router-dom";
import { useEvents } from "@/hooks/use-events";
import { format, isToday, isTomorrow, isFuture } from "date-fns";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { PLAN_LABELS } from "@/contexts/AuthContext";

type DashboardMode = "simple" | "advanced";

const QUICK_ACTIONS = [
  { label: "Find Leads",    desc: "Search millions of contacts",    icon: Search,  href: "/lead-finder",          gradient: "from-blue-500 to-cyan-500",    ring: "ring-blue-500/20",   text: "text-blue-600 dark:text-blue-400" },
  { label: "Autopilot",     desc: "Background lead discovery",      icon: Bot,     href: "/autopilot",            gradient: "from-violet-500 to-purple-600", ring: "ring-violet-500/20", text: "text-violet-600 dark:text-violet-400" },
  { label: "Send Campaign", desc: "Personalised bulk email",         icon: Send,    href: "/campaigns/import-email",gradient: "from-orange-500 to-rose-500",   ring: "ring-orange-500/20", text: "text-orange-600 dark:text-orange-400" },
  { label: "Sequences",     desc: "Automated follow-ups",           icon: Mail,    href: "/sequences",            gradient: "from-emerald-500 to-teal-500",  ring: "ring-emerald-500/20",text: "text-emerald-600 dark:text-emerald-400" },
  { label: "Enrichment",    desc: "Auto-fill company data",         icon: Sparkles,href: "/enrichment",           gradient: "from-amber-500 to-yellow-400",  ring: "ring-amber-500/20",  text: "text-amber-600 dark:text-amber-400" },
  { label: "Conversations", desc: "Email threads and replies",      icon: Inbox,   href: "/conversations",        gradient: "from-pink-500 to-rose-500",     ring: "ring-pink-500/20",   text: "text-pink-600 dark:text-pink-400" },
];

const KPI_CONFIG = [
  { key: "companies",  label: "Companies",     icon: Building2,  gradient: "from-blue-500 to-cyan-400",    glow: "shadow-blue-500/20"   },
  { key: "people",     label: "Contacts",      icon: Users,      gradient: "from-violet-500 to-purple-400",glow: "shadow-violet-500/20" },
  { key: "pipeline",   label: "Pipeline",      icon: DollarSign, gradient: "from-emerald-500 to-teal-400", glow: "shadow-emerald-500/20"},
  { key: "deals",      label: "Active Deals",  icon: TrendingUp, gradient: "from-orange-500 to-amber-400", glow: "shadow-orange-500/20" },
];

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { user, planTier } = useAuth();

  const [dashboardMode, setDashboardMode] = useState<DashboardMode>(() => {
    const s = localStorage.getItem("dashboardMode");
    return s === "simple" || s === "advanced" ? s : "simple";
  });

  const toggleMode = (m: DashboardMode) => {
    setDashboardMode(m);
    localStorage.setItem("dashboardMode", m);
  };

  useEffect(() => {
    const channel = supabase
      .channel("auto-response-notifications")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "email_activities", filter: "metadata->auto_sent=eq.true" },
        (payload) => {
          const a = payload.new as any;
          toast.success("Auto-Response Sent", { description: `AI responded${a.subject ? `: ${a.subject}` : ""}` });
        })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const { data: businessProfile } = useQuery({
    queryKey: ["business-profile-limits"],
    queryFn: async () => {
      const { data, error } = await supabase.from("business_profiles").select("auto_response_count_today, auto_response_daily_limit, auto_response_paused").single();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (!businessProfile) return;
    const { auto_response_count_today, auto_response_daily_limit, auto_response_paused } = businessProfile;
    const pct = (auto_response_count_today / auto_response_daily_limit) * 100;
    if (auto_response_paused) toast.warning("Auto-Response Paused", { description: "Enable in Profile settings.", duration: 5000 });
    else if (pct >= 100) toast.error("Auto-Response Limit Reached", { description: `Daily limit of ${auto_response_daily_limit} reached.`, duration: 7000 });
    else if (pct >= 90) toast.warning("Auto-Response Limit Warning", { description: `${auto_response_count_today}/${auto_response_daily_limit} sent today.`, duration: 5000 });
  }, [businessProfile]);

  const { data: eventsData } = useEvents();
  const events = (eventsData?.data || []) as Array<{ id: string; type: string; content: { title?: string }; created_at: string; due_at?: string }>;
  const upcomingEvents = events.filter(e => e.due_at && isFuture(new Date(e.due_at))).slice(0, 4);

  const { data: companies } = useQuery({
    queryKey: ["dashboard-companies-count"],
    queryFn: async () => { const { count } = await supabase.from("companies").select("*", { count: "exact", head: true }); return count || 0; },
  });
  const { data: people } = useQuery({
    queryKey: ["dashboard-people-count"],
    queryFn: async () => { const { count } = await supabase.from("people").select("*", { count: "exact", head: true }); return count || 0; },
  });
  const { data: deals } = useQuery({
    queryKey: ["dashboard-deals-stats"],
    queryFn: async () => {
      const { data } = await supabase.from("deals").select("amount, stage");
      return { count: data?.length || 0, total: data?.reduce((s, d) => s + (d.amount || 0), 0) || 0 };
    },
  });
  const { data: recentCompanies } = useQuery({
    queryKey: ["dashboard-recent-companies"],
    queryFn: async () => { const { data } = await supabase.from("companies").select("name, industry, status").order("created_at", { ascending: false }).limit(5); return data || []; },
  });

  const displayName = user?.user_metadata?.full_name?.split(" ")[0] || user?.email?.split("@")[0] || "there";
  const planLabel   = PLAN_LABELS[planTier] || "LeadBoosters";

  const kpiValues: Record<string, string | number> = {
    companies: companies ?? 0,
    people:    people    ?? 0,
    pipeline:  `£${((deals?.total || 0) / 1000).toFixed(1)}k`,
    deals:     deals?.count ?? 0,
  };

  const kpiHrefs: Record<string, string> = {
    companies: "/companies",
    people:    "/people",
    pipeline:  "/deals",
    deals:     "/deals",
  };

  return (
    <div className="space-y-5 animate-fade-in">

      {/* ── Welcome Banner ─────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/20 via-primary/10 to-transparent border shadow-sm p-5 sm:p-6">
        {/* decorative blobs */}
        <div className="pointer-events-none absolute -top-10 -right-10 h-40 w-40 rounded-full bg-primary/15 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-8 right-24 h-32 w-32 rounded-full bg-accent/10 blur-2xl" />

        <div className="relative flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          {/* Left: greeting */}
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                {getGreeting()}, {displayName}
              </h1>
              <span className="text-2xl">👋</span>
            </div>
            <p className="text-sm text-muted-foreground">
              {format(new Date(), "EEEE, MMMM d, yyyy")}
            </p>
            <div className="mt-2 flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/15 border border-primary/30 px-2.5 py-0.5 text-xs font-semibold text-primary">
                <Sparkles className="h-3 w-3" /> {planLabel}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="h-3 w-3" /> Active
              </span>
            </div>
          </div>

          {/* Right: mode toggle */}
          <div className="flex items-center gap-1 self-start rounded-xl bg-background/70 backdrop-blur border p-1 shadow-sm">
            <Button
              variant={dashboardMode === "simple" ? "default" : "ghost"}
              size="sm"
              onClick={() => toggleMode("simple")}
              className="h-7 gap-1.5 text-xs"
            >
              <LayoutDashboard className="h-3.5 w-3.5" /> Simple
            </Button>
            <Button
              variant={dashboardMode === "advanced" ? "default" : "ghost"}
              size="sm"
              onClick={() => toggleMode("advanced")}
              className="h-7 gap-1.5 text-xs"
            >
              <Gauge className="h-3.5 w-3.5" /> Advanced
            </Button>
          </div>
        </div>

        {/* KPI mini-strip */}
        <div className="relative mt-5 grid grid-cols-2 sm:grid-cols-4 gap-3">
          {KPI_CONFIG.map(({ key, label, icon: Icon, gradient, glow }) => (
            <button
              key={key}
              onClick={() => navigate(kpiHrefs[key])}
              className={cn(
                "group flex items-center gap-3 rounded-xl border bg-background/80 backdrop-blur p-3 text-left transition-all hover:shadow-lg hover:-translate-y-0.5",
                `hover:${glow}`
              )}
            >
              <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br shadow-sm", gradient)}>
                <Icon className="h-4 w-4 text-white" />
              </div>
              <div className="min-w-0">
                <p className="text-xl font-bold tabular-nums leading-none">{kpiValues[key]}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">{label}</p>
              </div>
              <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground ml-auto opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
            </button>
          ))}
        </div>
      </div>

      {/* ── Main Grid ──────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Quick Actions — takes 2 of 3 cols */}
        <div className="lg:col-span-2">
          <Card className="h-full">
            <CardHeader className="pb-3 pt-4 px-5">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
                  <Zap className="h-3.5 w-3.5 text-primary" />
                </div>
                <span className="font-semibold text-sm">Quick Actions</span>
              </div>
            </CardHeader>
            <CardContent className="px-5 pb-5">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {QUICK_ACTIONS.map(({ label, desc, icon: Icon, href, gradient, ring, text }) => (
                  <button
                    key={label}
                    onClick={() => navigate(href)}
                    className={cn(
                      "group flex flex-col gap-3 rounded-xl border bg-card p-4 text-left transition-all duration-200",
                      "hover:shadow-md hover:-translate-y-0.5 hover:border-primary/30",
                      "focus-visible:outline-none focus-visible:ring-2", ring
                    )}
                  >
                    <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br shadow-sm", gradient)}>
                      <Icon className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold leading-tight">{label}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5 leading-tight">{desc}</p>
                    </div>
                    <div className={cn("flex items-center gap-1 text-[11px] font-medium", text)}>
                      Open <ArrowRight className="h-3 w-3 group-hover:translate-x-0.5 transition-transform" />
                    </div>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right column: Events + Recent companies */}
        <div className="flex flex-col gap-4">
          {/* Upcoming Events */}
          <Card className="flex-1">
            <CardHeader className="pb-3 pt-4 px-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
                    <Clock className="h-3.5 w-3.5 text-primary" />
                  </div>
                  <span className="font-semibold text-sm">Upcoming Events</span>
                </div>
                <Button variant="ghost" size="sm" className="h-7 text-xs px-2 gap-1" onClick={() => navigate("/events")}>
                  View all <ChevronRight className="h-3 w-3" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="px-5 pb-5">
              <div className="space-y-2">
                {upcomingEvents.length > 0 ? (
                  upcomingEvents.map(event => (
                    <div
                      key={event.id}
                      onClick={() => navigate("/events")}
                      className="flex items-center gap-3 rounded-lg border bg-muted/30 px-3 py-2.5 cursor-pointer hover:bg-muted/60 transition-colors group"
                    >
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                        <CalendarIcon className="h-3.5 w-3.5 text-primary" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium truncate">{event.content?.title || event.type}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {event.due_at && (
                            isToday(new Date(event.due_at)) ? "Today" :
                            isTomorrow(new Date(event.due_at)) ? "Tomorrow" :
                            format(new Date(event.due_at), "MMM d, h:mm a")
                          )}
                        </p>
                      </div>
                      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                    </div>
                  ))
                ) : (
                  <div className="flex flex-col items-center justify-center py-6 text-center gap-2">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted">
                      <CalendarIcon className="h-5 w-5 text-muted-foreground/50" />
                    </div>
                    <p className="text-xs text-muted-foreground">No upcoming events</p>
                    <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => navigate("/events")}>
                      Add event
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ── Feature Spotlight ──────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          {
            icon: Search,
            title: "Lead Finder",
            desc: "Search millions of companies and contacts. AI ranks them by fit.",
            badge: "AI-Powered",
            gradient: "from-blue-500 to-cyan-500",
            cardGrad: "from-blue-500/5 to-cyan-500/5",
            borderHover: "hover:border-blue-500/40",
            badgeCls: "bg-blue-500/10 text-blue-600 border-blue-200 dark:border-blue-800",
            linkColor: "text-blue-600 dark:text-blue-400",
            href: "/lead-finder",
          },
          {
            icon: Send,
            title: "Email Campaigns",
            desc: "Send AI-personalised emails in bulk with A/B tests and open tracking.",
            badge: "Personalised",
            gradient: "from-orange-500 to-rose-500",
            cardGrad: "from-orange-500/5 to-rose-500/5",
            borderHover: "hover:border-orange-500/40",
            badgeCls: "bg-orange-500/10 text-orange-600 border-orange-200 dark:border-orange-800",
            linkColor: "text-orange-600 dark:text-orange-400",
            href: "/campaigns",
          },
          {
            icon: Bot,
            title: "Autopilot",
            desc: "Set your ideal customer profile once. AI finds leads continuously in the background.",
            badge: "Autonomous",
            gradient: "from-emerald-500 to-teal-500",
            cardGrad: "from-emerald-500/5 to-teal-500/5",
            borderHover: "hover:border-emerald-500/40",
            badgeCls: "bg-emerald-500/10 text-emerald-600 border-emerald-200 dark:border-emerald-800",
            linkColor: "text-emerald-600 dark:text-emerald-400",
            href: "/autopilot",
          },
        ].map(({ icon: Icon, title, desc, badge, gradient, cardGrad, borderHover, badgeCls, linkColor, href }) => (
          <Card
            key={title}
            onClick={() => navigate(href)}
            className={cn(
              "cursor-pointer border-2 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg group",
              `bg-gradient-to-br ${cardGrad}`, borderHover
            )}
          >
            <CardContent className="p-5">
              <div className="flex items-start justify-between mb-4">
                <div className={cn("flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br shadow-md", gradient)}>
                  <Icon className="h-5 w-5 text-white" />
                </div>
                <Badge className={cn("text-[10px] border font-medium", badgeCls)}>{badge}</Badge>
              </div>
              <h3 className="font-bold text-sm mb-1.5">{title}</h3>
              <p className="text-xs text-muted-foreground leading-relaxed mb-4">{desc}</p>
              <div className={cn("flex items-center gap-1 text-xs font-semibold", linkColor)}>
                Open <ArrowUpRight className="h-3 w-3 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── Recent Companies ───────────────────────────────────── */}
      {recentCompanies && recentCompanies.length > 0 && (
        <Card>
          <CardHeader className="pb-3 pt-4 px-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
                  <Building2 className="h-3.5 w-3.5 text-primary" />
                </div>
                <span className="font-semibold text-sm">Recently Added Companies</span>
              </div>
              <Button variant="ghost" size="sm" className="h-7 text-xs px-2 gap-1" onClick={() => navigate("/companies")}>
                View all <ChevronRight className="h-3 w-3" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="px-5 pb-5">
            <div className="space-y-1">
              {recentCompanies.map((company, i) => (
                <div
                  key={i}
                  onClick={() => navigate("/companies")}
                  className="flex items-center gap-3 rounded-lg px-2 py-2.5 cursor-pointer hover:bg-muted/50 transition-colors group"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-primary/20 to-primary/10 text-primary text-xs font-bold">
                    {company.name?.charAt(0).toUpperCase() || "?"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{company.name}</p>
                    {company.industry && <p className="text-[11px] text-muted-foreground truncate">{company.industry}</p>}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {company.status && (
                      <Badge variant="secondary" className="text-[10px]">{company.status}</Badge>
                    )}
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Advanced Mode Widgets ──────────────────────────────── */}
      {dashboardMode === "advanced" && (
        <div className="space-y-4 animate-fade-in">
          <div className="flex items-center gap-2 py-1">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-widest px-3">Advanced Analytics</span>
            <div className="h-px flex-1 bg-border" />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <LiveEngagementTracker />
            <EmailActivityWidget />
          </div>
          <AutomationMetrics />
          <AutoResponseAnalytics />
        </div>
      )}
    </div>
  );
}
