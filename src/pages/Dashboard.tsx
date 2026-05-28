import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Building2, Users, DollarSign, TrendingUp, Sparkles, Search, Mail,
  ArrowUpRight, Calendar as CalendarIcon, Clock, Bot, Zap, Inbox,
  ChevronRight, Activity, BarChart2, Target, Send, Newspaper, LayoutDashboard, Gauge,
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

type DashboardMode = 'simple' | 'advanced';

const QUICK_ACTIONS = [
  { label: "Find Leads", desc: "AI-powered discovery", icon: Search, href: "/lead-finder", color: "blue" },
  { label: "Autopilot", desc: "Background lead discovery", icon: Bot, href: "/autopilot", color: "violet" },
  { label: "Send Campaign", desc: "Bulk personalised emails", icon: Send, href: "/campaigns/import-email", color: "orange" },
  { label: "Sequences", desc: "Automated follow-ups", icon: Mail, href: "/sequences", color: "green" },
  { label: "Enrichment", desc: "Auto-fill company data", icon: Sparkles, href: "/enrichment", color: "yellow" },
  { label: "Conversations", desc: "Email threads & replies", icon: Inbox, href: "/conversations", color: "pink" },
];

const colorMap: Record<string, { bg: string; text: string; border: string }> = {
  blue:   { bg: "bg-blue-500/10",   text: "text-blue-500",   border: "hover:border-blue-500/40" },
  violet: { bg: "bg-violet-500/10", text: "text-violet-500", border: "hover:border-violet-500/40" },
  orange: { bg: "bg-orange-500/10", text: "text-orange-500", border: "hover:border-orange-500/40" },
  green:  { bg: "bg-green-500/10",  text: "text-green-500",  border: "hover:border-green-500/40" },
  yellow: { bg: "bg-yellow-500/10", text: "text-yellow-600", border: "hover:border-yellow-500/40" },
  pink:   { bg: "bg-pink-500/10",   text: "text-pink-500",   border: "hover:border-pink-500/40" },
};

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [dashboardMode, setDashboardMode] = useState<DashboardMode>(() => {
    const s = localStorage.getItem('dashboardMode');
    return (s === 'simple' || s === 'advanced') ? s : 'simple';
  });

  const toggleMode = (m: DashboardMode) => {
    setDashboardMode(m);
    localStorage.setItem('dashboardMode', m);
  };

  // Auto-response notifications
  useEffect(() => {
    const channel = supabase
      .channel('auto-response-notifications')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'email_activities', filter: 'metadata->auto_sent=eq.true' },
        (payload) => {
          const a = payload.new as any;
          toast.success('Auto-Response Sent', { description: `AI responded${a.subject ? `: ${a.subject}` : ''}` });
        })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  // Daily limit warnings
  const { data: businessProfile } = useQuery({
    queryKey: ['business-profile-limits'],
    queryFn: async () => {
      const { data, error } = await supabase.from('business_profiles').select('auto_response_count_today, auto_response_daily_limit, auto_response_paused').single();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (!businessProfile) return;
    const { auto_response_count_today, auto_response_daily_limit, auto_response_paused } = businessProfile;
    const pct = (auto_response_count_today / auto_response_daily_limit) * 100;
    if (auto_response_paused) toast.warning('Auto-Response Paused', { description: 'Enable in Profile settings.', duration: 5000 });
    else if (pct >= 100) toast.error('Auto-Response Limit Reached', { description: `Daily limit of ${auto_response_daily_limit} reached.`, duration: 7000 });
    else if (pct >= 90) toast.warning('Auto-Response Limit Warning', { description: `${auto_response_count_today}/${auto_response_daily_limit} sent today.`, duration: 5000 });
  }, [businessProfile]);

  const { data: eventsData } = useEvents();
  const events = (eventsData?.data || []) as Array<{ id: string; type: string; content: { title?: string }; created_at: string; due_at?: string; }>;
  const upcomingEvents = events.filter(e => e.due_at && isFuture(new Date(e.due_at))).slice(0, 4);

  const { data: companies } = useQuery({
    queryKey: ["dashboard-companies-count"],
    queryFn: async () => { const { count } = await supabase.from("companies").select("*", { count: "exact", head: true }); return count || 0; }
  });
  const { data: people } = useQuery({
    queryKey: ["dashboard-people-count"],
    queryFn: async () => { const { count } = await supabase.from("people").select("*", { count: "exact", head: true }); return count || 0; }
  });
  const { data: deals } = useQuery({
    queryKey: ["dashboard-deals-stats"],
    queryFn: async () => {
      const { data } = await supabase.from("deals").select("amount, stage");
      return { count: data?.length || 0, total: data?.reduce((s, d) => s + (d.amount || 0), 0) || 0 };
    }
  });
  const { data: recentCompanies } = useQuery({
    queryKey: ["dashboard-recent-companies"],
    queryFn: async () => { const { data } = await supabase.from("companies").select("name, industry, status").order("created_at", { ascending: false }).limit(5); return data || []; }
  });

  const displayName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'there';

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {getGreeting()}, {displayName} 👋
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {format(new Date(), "EEEE, MMMM d, yyyy")} · Here's what's happening
          </p>
        </div>
        <div className="flex items-center gap-1 p-1 rounded-lg bg-muted/50 border self-start sm:self-auto">
          <Button variant={dashboardMode === 'simple' ? 'default' : 'ghost'} size="sm" onClick={() => toggleMode('simple')} className="gap-1.5">
            <LayoutDashboard className="h-3.5 w-3.5" /> Simple
          </Button>
          <Button variant={dashboardMode === 'advanced' ? 'default' : 'ghost'} size="sm" onClick={() => toggleMode('advanced')} className="gap-1.5">
            <Gauge className="h-3.5 w-3.5" /> Advanced
          </Button>
        </div>
      </div>

      {/* ── KPI Row ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Companies", value: companies ?? 0, icon: Building2, color: "text-blue-500", bg: "bg-blue-500/10", href: "/companies", suffix: "" },
          { label: "Contacts", value: people ?? 0, icon: Users, color: "text-purple-500", bg: "bg-purple-500/10", href: "/people", suffix: "" },
          { label: "Pipeline Value", value: `£${((deals?.total || 0) / 1000).toFixed(1)}k`, icon: DollarSign, color: "text-green-500", bg: "bg-green-500/10", href: "/deals", suffix: "" },
          { label: "Active Deals", value: deals?.count ?? 0, icon: TrendingUp, color: "text-orange-500", bg: "bg-orange-500/10", href: "/deals", suffix: "" },
        ].map(({ label, value, icon: Icon, color, bg, href }) => (
          <Card key={label} className="cursor-pointer hover:border-primary/50 transition-all hover:shadow-md group" onClick={() => navigate(href)}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between mb-3">
                <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center", bg)}>
                  <Icon className={cn("h-4.5 w-4.5", color)} />
                </div>
                <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <p className="text-2xl font-bold">{value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── Middle Row: Quick Actions + Events ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Quick Actions — 2 cols */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3 pt-4 px-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-primary" />
                <span className="font-semibold text-sm">Quick Actions</span>
              </div>
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {QUICK_ACTIONS.map(({ label, desc, icon: Icon, href, color }) => {
                const c = colorMap[color];
                return (
                  <button
                    key={label}
                    onClick={() => navigate(href)}
                    className={cn(
                      "flex flex-col items-start gap-2 p-3 rounded-xl border bg-card text-left transition-all hover:shadow-md",
                      c.border
                    )}
                  >
                    <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", c.bg)}>
                      <Icon className={cn("h-4 w-4", c.text)} />
                    </div>
                    <div>
                      <p className="text-xs font-semibold leading-tight">{label}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">{desc}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Upcoming Events — 1 col */}
        <Card>
          <CardHeader className="pb-3 pt-4 px-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-primary" />
                <span className="font-semibold text-sm">Upcoming Events</span>
              </div>
              <Button variant="ghost" size="sm" className="h-7 text-xs px-2" onClick={() => navigate("/events")}>
                View all <ChevronRight className="h-3 w-3 ml-0.5" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="space-y-2">
              {upcomingEvents.length > 0 ? upcomingEvents.map(event => (
                <div key={event.id} className="flex items-center gap-2.5 p-2.5 rounded-lg border bg-muted/30 hover:bg-muted/60 transition-colors cursor-pointer" onClick={() => navigate('/events')}>
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <CalendarIcon className="h-3.5 w-3.5 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-medium truncate">{event.content?.title || event.type}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {event.due_at && (isToday(new Date(event.due_at)) ? 'Today' : isTomorrow(new Date(event.due_at)) ? 'Tomorrow' : format(new Date(event.due_at), 'MMM d, h:mm a'))}
                    </p>
                  </div>
                </div>
              )) : (
                <div className="text-center py-6">
                  <CalendarIcon className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
                  <p className="text-xs text-muted-foreground">No upcoming events</p>
                  <Button variant="ghost" size="sm" className="mt-2 text-xs h-7" onClick={() => navigate("/events")}>Add event</Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Feature Spotlight Row ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card
          className="cursor-pointer border-2 hover:border-primary/60 transition-all hover:shadow-lg group bg-gradient-to-br from-blue-500/5 to-violet-500/5"
          onClick={() => navigate("/lead-finder")}
        >
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-violet-500 flex items-center justify-center shadow-md">
                <Search className="h-5 w-5 text-white" />
              </div>
              <Badge className="text-[10px] bg-blue-500/10 text-blue-600 border-blue-200">AI-Powered</Badge>
            </div>
            <h3 className="font-bold text-sm mb-1">Lead Finder</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">Search millions of companies and contacts. AI finds the best matches for your business.</p>
            <div className="mt-3 flex items-center gap-1 text-xs text-primary font-medium">
              Find leads <ArrowUpRight className="h-3 w-3 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
            </div>
          </CardContent>
        </Card>

        <Card
          className="cursor-pointer border-2 hover:border-orange-500/60 transition-all hover:shadow-lg group bg-gradient-to-br from-orange-500/5 to-red-500/5"
          onClick={() => navigate("/campaigns/import-email")}
        >
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center shadow-md">
                <Send className="h-5 w-5 text-white" />
              </div>
              <Badge className="text-[10px] bg-orange-500/10 text-orange-600 border-orange-200">Personalised</Badge>
            </div>
            <h3 className="font-bold text-sm mb-1">Email Campaigns</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">Send hundreds of AI-personalised emails. Import from CSV or pick contacts from your CRM.</p>
            <div className="mt-3 flex items-center gap-1 text-xs text-orange-500 font-medium">
              Start campaign <ArrowUpRight className="h-3 w-3 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
            </div>
          </CardContent>
        </Card>

        <Card
          className="cursor-pointer border-2 hover:border-green-500/60 transition-all hover:shadow-lg group bg-gradient-to-br from-green-500/5 to-teal-500/5"
          onClick={() => navigate("/autopilot")}
        >
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-500 to-teal-500 flex items-center justify-center shadow-md">
                <Bot className="h-5 w-5 text-white" />
              </div>
              <Badge className="text-[10px] bg-green-500/10 text-green-600 border-green-200">Autonomous</Badge>
            </div>
            <h3 className="font-bold text-sm mb-1">Autopilot</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">Set your target criteria and let AI continuously discover and enrich leads in the background.</p>
            <div className="mt-3 flex items-center gap-1 text-xs text-green-500 font-medium">
              Set up autopilot <ArrowUpRight className="h-3 w-3 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Recent Companies ── */}
      {recentCompanies && recentCompanies.length > 0 && (
        <Card>
          <CardHeader className="pb-3 pt-4 px-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-primary" />
                <span className="font-semibold text-sm">Recently Added Companies</span>
              </div>
              <Button variant="ghost" size="sm" className="h-7 text-xs px-2" onClick={() => navigate("/companies")}>
                View all <ChevronRight className="h-3 w-3 ml-0.5" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="divide-y">
              {recentCompanies.map((company, i) => (
                <div key={i} className="flex items-center gap-3 py-2.5 hover:bg-muted/30 rounded-lg px-1 -mx-1 transition-colors cursor-pointer" onClick={() => navigate("/companies")}>
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Building2 className="h-3.5 w-3.5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{company.name}</p>
                    {company.industry && <p className="text-xs text-muted-foreground truncate">{company.industry}</p>}
                  </div>
                  {company.status && (
                    <Badge variant="secondary" className="text-[10px] shrink-0">{company.status}</Badge>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Advanced Mode Widgets ── */}
      {dashboardMode === 'advanced' && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <LiveEngagementTracker />
            <EmailActivityWidget />
          </div>
          <AutomationMetrics />
          <AutoResponseAnalytics />
        </>
      )}
    </div>
  );
}
