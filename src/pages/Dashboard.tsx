import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Building2, Users, DollarSign, TrendingUp, Sparkles, Search, Mail, BarChart3, ArrowUpRight, Calendar as CalendarIcon, Clock } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EventCard } from "@/components/EventCard";
import { useNavigate } from "react-router-dom";
import { useEvents } from "@/hooks/use-events";
import { format, isToday, isTomorrow, isFuture } from "date-fns";
export default function Dashboard() {
  const navigate = useNavigate();
  const {
    data: eventsData
  } = useEvents();
  const events = (eventsData?.data || []) as Array<{
    id: string;
    type: 'note' | 'call' | 'email' | 'meeting' | 'task' | 'reminder';
    content: {
      title?: string;
      description?: string;
    };
    created_at: string;
    due_at?: string;
  }>;
  const upcomingEvents = events.filter(e => e.due_at && isFuture(new Date(e.due_at))).slice(0, 3);
  const recentActivity = events.slice(0, 5);
  const {
    data: companies
  } = useQuery({
    queryKey: ["dashboard-companies-count"],
    queryFn: async () => {
      const {
        count
      } = await supabase.from("companies").select("*", {
        count: "exact",
        head: true
      });
      return count || 0;
    }
  });
  const {
    data: deals
  } = useQuery({
    queryKey: ["dashboard-deals-stats"],
    queryFn: async () => {
      const {
        data
      } = await supabase.from("deals").select("amount, stage");
      const total = data?.reduce((sum, deal) => sum + (deal.amount || 0), 0) || 0;
      return {
        count: data?.length || 0,
        total
      };
    }
  });
  const {
    data: people
  } = useQuery({
    queryKey: ["dashboard-people-count"],
    queryFn: async () => {
      const {
        count
      } = await supabase.from("people").select("*", {
        count: "exact",
        head: true
      });
      return count || 0;
    }
  });
  const {
    data: recentCompanies
  } = useQuery({
    queryKey: ["dashboard-recent-companies"],
    queryFn: async () => {
      const {
        data
      } = await supabase.from("companies").select("name, industry, status, created_at").order("created_at", {
        ascending: false
      }).limit(5);
      return data || [];
    }
  });
  const revenue = (deals?.total || 0) / 1000;
  return <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      {/* Hero Section */}
      <div className="relative overflow-hidden border-b bg-gradient-to-br from-primary/10 via-primary/5 to-transparent backdrop-blur-sm">
        <div className="absolute inset-0 bg-grid-white/[0.02] pointer-events-none" />
        <div className="relative px-6 py-16">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-primary flex items-center justify-center shadow-lg">
                <BarChart3 className="h-5 w-5 text-white" />
              </div>
              <Badge className="bg-primary text-primary-foreground text-sm px-3 py-1">
                <Sparkles className="h-3 w-3 mr-1" />
                Live
              </Badge>
            </div>
            <h1 className="text-5xl font-bold tracking-tight bg-gradient-to-br from-foreground to-foreground/70 bg-clip-text text-transparent mb-2">
              Sales Dashboard
            </h1>
            <p className="text-muted-foreground text-lg">
              Your real-time sales performance overview
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Hero Find Leads Section */}
        <div className="mb-8">
          <Card className="relative overflow-hidden border-2 hover:border-primary transition-all shadow-2xl bg-gradient-to-br from-blue-500/10 via-primary/5 to-purple-500/10 animate-pulse-glow">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 via-primary/10 to-purple-500/10 animate-shimmer opacity-50" style={{
            backgroundSize: '200% 100%'
          }} />
            <div className="relative p-8 md:p-12">
              <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                <div className="flex-1 space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-16 h-16 rounded-2xl bg-white dark:bg-card flex items-center justify-center shadow-lg animate-float">
                      <Search className="h-8 w-8 text-primary" />
                    </div>
                    <Badge className="bg-primary hover:bg-primary/90 text-primary-foreground text-base px-4 py-2 shadow-lg transition-colors">
                      <Sparkles className="h-4 w-4 mr-2" />
                      AI-Powered
                    </Badge>
                  </div>
                  <div>
                    <h2 className="text-3xl md:text-4xl font-bold tracking-tight bg-gradient-to-r from-foreground via-primary to-foreground bg-clip-text text-transparent mb-2">
                      Discover Your Next Leads
                    </h2>
                    <p className="text-muted-foreground text-lg">
                      Let AI find the perfect companies for your business in seconds
                    </p>
                  </div>
                </div>
                <Button size="lg" onClick={() => navigate("/lead-finder")} className="relative h-14 px-8 text-lg font-semibold bg-primary hover:bg-primary/90 text-primary-foreground shadow-xl transition-all hover:scale-105 group">
                  <Search className="mr-3 h-6 w-6 group-hover:rotate-12 transition-transform" />
                  Find Leads Now
                  <ArrowUpRight className="ml-2 h-5 w-5" />
                </Button>
              </div>
            </div>
          </Card>
        </div>

        {/* Bento Grid Layout */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Large Revenue Card - Spans 2 columns */}
          <Card 
            className="lg:col-span-2 lg:row-span-2 border-2 hover:border-primary/50 transition-all shadow-xl bg-gradient-to-br from-primary via-primary to-primary/80 text-white overflow-hidden group animate-pulse-glow cursor-pointer"
            onClick={() => navigate("/deals")}
          >
            <div className="absolute inset-0 bg-grid-white/[0.05] pointer-events-none" />
            <div className="relative p-8 h-full flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-6">
                  <div className="w-14 h-14 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center shadow-lg">
                    <DollarSign className="h-7 w-7 text-white" />
                  </div>
                  <Badge className="bg-white/20 backdrop-blur-sm text-white border-white/30">
                    <TrendingUp className="h-3 w-3 mr-1" />
                    +15.3%
                  </Badge>
                </div>
                <h3 className="text-lg font-medium text-white/80 mb-2">Total Revenue</h3>
              </div>
              <div>
                <p className="text-6xl font-bold mb-4 group-hover:scale-105 transition-transform">
                  ${revenue.toFixed(0)}k
                </p>
                <p className="text-white/70 text-sm">
                  {deals?.count || 0} active deals in pipeline
                </p>
              </div>
            </div>
          </Card>

          {/* Companies Card */}
          <Card 
            className="border-2 hover:border-primary/50 transition-all shadow-lg bg-gradient-to-br from-card to-blue-500/5 overflow-hidden group hover:shadow-blue-500/20 hover:shadow-2xl cursor-pointer"
            onClick={() => navigate("/companies")}
          >
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <Building2 className="h-6 w-6 text-blue-500" />
                </div>
                <Badge variant="secondary" className="text-xs">
                  <ArrowUpRight className="h-3 w-3 mr-1" />
                  +12.5%
                </Badge>
              </div>
              <h3 className="text-sm text-muted-foreground mb-2">Total Companies</h3>
              <p className="text-4xl font-bold group-hover:scale-105 transition-transform">
                {companies || 0}
              </p>
            </div>
          </Card>

          {/* Contacts Card */}
          <Card 
            className="border-2 hover:border-primary/50 transition-all shadow-lg bg-gradient-to-br from-card to-purple-500/5 overflow-hidden group hover:shadow-purple-500/20 hover:shadow-2xl cursor-pointer"
            onClick={() => navigate("/people")}
          >
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 rounded-lg bg-purple-500/10 flex items-center justify-center">
                  <Users className="h-6 w-6 text-purple-500" />
                </div>
                <Badge variant="secondary" className="text-xs">
                  <ArrowUpRight className="h-3 w-3 mr-1" />
                  +4.1%
                </Badge>
              </div>
              <h3 className="text-sm text-muted-foreground mb-2">Total Contacts</h3>
              <p className="text-4xl font-bold group-hover:scale-105 transition-transform">
                {people || 0}
              </p>
            </div>
          </Card>

          {/* Quick Actions - Spans 2 columns */}
          <Card className="lg:col-span-2 border-2 hover:border-primary/50 transition-all shadow-lg bg-gradient-to-br from-card to-card/50 hover:shadow-primary/10 hover:shadow-xl">
            <div className="p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary animate-pulse" />
                Quick Actions
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <Button variant="outline" className="h-auto flex-col items-start p-4 hover:bg-primary/10 hover:border-primary transition-all group hover:shadow-lg hover:shadow-blue-500/20 relative overflow-hidden" onClick={() => navigate("/lead-finder")}>
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-500/0 via-blue-500/10 to-blue-500/0 group-hover:animate-shimmer" style={{
                  backgroundSize: '200% 100%'
                }} />
                  <div className="relative w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center mb-3 group-hover:scale-110 group-hover:rotate-6 transition-all">
                    <Search className="h-5 w-5 text-blue-500" />
                  </div>
                  <span className="relative font-semibold text-sm">Find Leads</span>
                  <span className="relative text-[10px] text-muted-foreground mt-1 leading-tight">AI-powered discovery</span>
                </Button>

                <Button variant="outline" className="h-auto flex-col items-start p-4 hover:bg-primary/10 hover:border-primary transition-all group hover:shadow-lg hover:shadow-orange-500/20" onClick={() => navigate("/sequences")}>
                  <div className="w-10 h-10 rounded-lg bg-orange-500/10 flex items-center justify-center mb-3 group-hover:scale-110 group-hover:rotate-6 transition-all">
                    <Mail className="h-5 w-5 text-orange-500" />
                  </div>
                  <span className="font-semibold text-sm">Sequences</span>
                  <span className="text-[10px] text-muted-foreground mt-1 leading-tight">Email automation</span>
                </Button>

                <Button variant="outline" className="h-auto flex-col items-start p-4 hover:bg-primary/10 hover:border-primary transition-all group hover:shadow-lg hover:shadow-purple-500/20" onClick={() => navigate("/companies")}>
                  <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center mb-3 group-hover:scale-110 group-hover:rotate-6 transition-all">
                    <Building2 className="h-5 w-5 text-purple-500" />
                  </div>
                  <span className="font-semibold text-sm">Companies</span>
                  <span className="text-[10px] text-muted-foreground mt-1 leading-tight">Manage accounts</span>
                </Button>

                <Button variant="outline" className="h-auto flex-col items-start p-4 hover:bg-primary/10 hover:border-primary transition-all group hover:shadow-lg hover:shadow-green-500/20" onClick={() => navigate("/deals")}>
                  <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center mb-3 group-hover:scale-110 group-hover:rotate-6 transition-all">
                    <DollarSign className="h-5 w-5 text-green-500" />
                  </div>
                  <span className="font-semibold text-sm">Deals</span>
                  <span className="text-[10px] text-muted-foreground mt-1 leading-tight">Track pipeline</span>
                </Button>
              </div>
            </div>
          </Card>

          {/* Upcoming Events Widget */}
          <Card className="lg:col-span-2 border-2 hover:border-primary/50 transition-all shadow-lg bg-gradient-to-br from-card to-card/50">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Clock className="h-5 w-5 text-primary" />
                  Upcoming Events
                </h3>
                <Button variant="ghost" size="sm" onClick={() => navigate("/events")}>
                  View all
                  <ArrowUpRight className="h-3 w-3 ml-1" />
                </Button>
              </div>
              <div className="space-y-3">
                {upcomingEvents.length > 0 ? upcomingEvents.map(event => <div key={event.id} className="flex items-center gap-3 p-3 rounded-lg border bg-card/50 hover:bg-card transition-colors">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <CalendarIcon className="h-5 w-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{event.content.title || event.type}</p>
                        <p className="text-xs text-muted-foreground">
                          {event.due_at && (isToday(new Date(event.due_at)) ? 'Today' : isTomorrow(new Date(event.due_at)) ? 'Tomorrow' : format(new Date(event.due_at), 'MMM d, h:mm a'))}
                        </p>
                      </div>
                    </div>) : <p className="text-sm text-muted-foreground text-center py-4">No upcoming events</p>}
              </div>
            </div>
          </Card>

          {/* Recent Activity Feed - Spans full width */}
          

          {/* Recent Companies - Moved below activity */}
          <Card className="lg:col-span-4 border-2 hover:border-primary/50 transition-all shadow-lg bg-gradient-to-br from-card to-card/50 hover:shadow-primary/10 hover:shadow-xl">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  Recent Activity
                </h3>
                <Button variant="ghost" size="sm" onClick={() => navigate("/companies")}>
                  View all
                  <ArrowUpRight className="h-3 w-3 ml-1" />
                </Button>
              </div>
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {recentCompanies?.slice(0, 3).map((company, i) => <div key={i} className="flex items-center gap-4 p-4 rounded-xl border-2 hover:border-primary/50 hover:shadow-lg hover:shadow-primary/20 transition-all bg-gradient-to-br from-card to-primary/5 cursor-pointer group" onClick={() => navigate("/companies")}>
                    <div className="w-12 h-12 rounded-lg bg-gradient-primary flex items-center justify-center shadow-sm group-hover:scale-110 group-hover:rotate-6 transition-all">
                      <Building2 className="h-5 w-5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate">{company.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{company.industry}</p>
                      <Badge variant="secondary" className="text-xs mt-1">
                        {company.status}
                      </Badge>
                    </div>
                  </div>)}
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>;
}