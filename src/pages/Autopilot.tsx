import { useState, lazy, Suspense } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Brain,
  Rocket,
  Play,
  Loader2,
  Zap,
  Clock,
  Target,
  Mail,
  Settings,
  BarChart3,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Sparkles,
  History,
  Send,
  Trash2
} from "lucide-react";
import { AutopilotStatusCards } from "@/components/autopilot/AutopilotStatusCards";
import { AutopilotSettingsPanel } from "@/components/autopilot/AutopilotSettingsPanel";
import { AutopilotPersonasQuickView } from "@/components/autopilot/AutopilotPersonasQuickView";
import { AutopilotPrerequisites } from "@/components/autopilot/AutopilotPrerequisites";
import { AutopilotAnalyticsPreview } from "@/components/autopilot/AutopilotAnalyticsPreview";
import { DiscoveryRunHistory } from "@/components/autopilot/DiscoveryRunHistory";
import { AutopilotEmailStats } from "@/components/autopilot/AutopilotEmailStats";

// Lazy load embedded components to avoid circular dependencies
const PersonaManager = lazy(() => import("@/components/lead-inbox/PersonaManager").then(m => ({ default: m.PersonaManager })));
const LeadAnalyticsDashboard = lazy(() => import("@/components/lead-inbox/LeadAnalyticsDashboard").then(m => ({ default: m.LeadAnalyticsDashboard })));

export default function Autopilot() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("overview");

  // Fetch autonomous discovery settings
  const { data: settings, isLoading: settingsLoading } = useQuery({
    queryKey: ['autonomous-discovery-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('autonomous_discovery_settings')
        .select('*')
        .eq('user_id', user?.id)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  // Toggle system enabled
  const toggleEnabledMutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      const { error } = await supabase
        .from('autonomous_discovery_settings')
        .upsert({ 
          user_id: user?.id,
          enabled,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['autonomous-discovery-settings'] });
      toast({ 
        title: settings?.enabled ? 'Autopilot paused' : 'Autopilot activated!',
        description: settings?.enabled 
          ? 'Automatic lead discovery has been paused.' 
          : 'The system will now find leads automatically.',
      });
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  // Fetch draft campaigns created by auto-discovery
  const { data: pendingCampaigns, isLoading: pendingLoading, refetch: refetchPending } = useQuery({
    queryKey: ['autopilot-pending-campaigns', user?.id],
    queryFn: async () => {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await (supabase as any)
        .from('email_campaigns')
        .select('id, name, total_recipients, created_at, source')
        .eq('user_id', user?.id)
        .eq('status', 'draft')
        .or(`source.eq.auto_discovery,created_at.gte.${sevenDaysAgo}`)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as Array<{ id: string; name: string; total_recipients: number | null; created_at: string; source: string | null }>;
    },
    enabled: !!user?.id,
  });

  // Approve & schedule a draft campaign
  const approveCampaignMutation = useMutation({
    mutationFn: async (campaignId: string) => {
      const { error } = await supabase
        .from('email_campaigns')
        .update({ status: 'scheduled', scheduled_at: new Date().toISOString() })
        .eq('id', campaignId)
        .eq('user_id', user?.id);
      if (error) throw error;
    },
    onSuccess: () => {
      refetchPending();
      queryClient.invalidateQueries({ queryKey: ['autopilot-pending-campaigns'] });
      toast({ title: 'Campaign scheduled for sending' });
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  // Dismiss (delete) a draft campaign
  const dismissCampaignMutation = useMutation({
    mutationFn: async (campaignId: string) => {
      const { error } = await supabase
        .from('email_campaigns')
        .delete()
        .eq('id', campaignId)
        .eq('user_id', user?.id);
      if (error) throw error;
    },
    onSuccess: () => {
      refetchPending();
      queryClient.invalidateQueries({ queryKey: ['autopilot-pending-campaigns'] });
      toast({ title: 'Campaign dismissed' });
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  // Manual discovery trigger
  const runDiscoveryMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('autonomous-lead-discovery', {
        body: { userId: user?.id, forceRun: true },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['autonomous-leads'] });
      queryClient.invalidateQueries({ queryKey: ['autonomous-leads-counts'] });
      queryClient.invalidateQueries({ queryKey: ['autonomous-discovery-settings'] });
      toast({ 
        title: 'Discovery complete!', 
        description: `Found ${data?.leadsDiscovered || 0} new leads.`,
      });
    },
    onError: (error: any) => {
      toast({ title: 'Discovery failed', description: error.message, variant: 'destructive' });
    },
  });

  const tz = settings?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
  const formatInTz = (iso: string | null) => {
    if (!iso) return '—';
    return new Date(iso).toLocaleString(undefined, { timeZone: tz, dateStyle: 'short', timeStyle: 'short' });
  };
  const scheduleLabel = (() => {
    const hour = settings?.preferred_discovery_hour ?? 9;
    const h = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    const ampm = hour < 12 ? 'AM' : 'PM';
    const tzLabel = (settings?.timezone || 'UTC').replace('_', ' ').split('/').pop() || 'UTC';
    return `daily at ${h}:00 ${ampm} ${tzLabel}`;
  })();

  if (settingsLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-2xl bg-gradient-to-br from-primary/20 via-purple-500/10 to-pink-500/10 border border-primary/20">
            <Brain className="h-8 w-8 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
              Autopilot Command Center
              {settings?.enabled && (
                <Badge className="bg-green-500/10 text-green-600 border-green-200">
                  <Zap className="h-3 w-3 mr-1" />
                  Active
                </Badge>
              )}
            </h1>
            <p className="text-muted-foreground mt-1">
              Set it and forget it — AI-powered lead discovery and outreach on autopilot
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            onClick={() => runDiscoveryMutation.mutate()}
            disabled={runDiscoveryMutation.isPending}
          >
            {runDiscoveryMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Play className="h-4 w-4 mr-2" />
            )}
            Run Discovery Now
          </Button>
          
          <div className="flex items-center gap-2 px-4 py-2 rounded-lg border bg-card">
            <span className="text-sm font-medium">
              {settings?.enabled ? 'Enabled' : 'Disabled'}
            </span>
            <Switch
              checked={settings?.enabled || false}
              onCheckedChange={(checked) => toggleEnabledMutation.mutate(checked)}
              disabled={toggleEnabledMutation.isPending}
            />
          </div>
        </div>
      </div>

      {/* Quick Status Bar */}
      {settings?.enabled && (
        <Card className="bg-gradient-to-r from-green-500/5 via-emerald-500/5 to-teal-500/5 border-green-200/50">
          <CardContent className="py-3">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Last run:</span>
                  <span className="font-medium">
                    {settings?.last_run_at ? formatInTz(settings.last_run_at) : 'Never'}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Rocket className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Next run:</span>
                  <span className="font-medium">
                    {settings?.next_run_at ? formatInTz(settings.next_run_at) : scheduleLabel}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs">
                  {scheduleLabel}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Pending Campaigns — draft campaigns created by auto-discovery awaiting approval */}
      {!pendingLoading && pendingCampaigns && pendingCampaigns.length > 0 && (
        <Card className="border-amber-200/60 bg-amber-500/5">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Mail className="h-5 w-5 text-amber-600" />
              Pending Campaigns
              <Badge className="ml-1 bg-amber-500/10 text-amber-700 border-amber-300">
                {pendingCampaigns.length}
              </Badge>
            </CardTitle>
            <CardDescription>
              Auto-discovered campaigns awaiting your approval. Approve to schedule immediately or dismiss to delete.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {pendingCampaigns.map((campaign) => (
              <div
                key={campaign.id}
                className="flex items-center justify-between gap-4 rounded-lg border bg-background p-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-sm">{campaign.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {campaign.total_recipients != null ? `${campaign.total_recipients} recipients` : 'recipients pending'} ·{' '}
                    {new Date(campaign.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => dismissCampaignMutation.mutate(campaign.id)}
                    disabled={dismissCampaignMutation.isPending || approveCampaignMutation.isPending}
                  >
                    <Trash2 className="h-3.5 w-3.5 mr-1" />
                    Dismiss
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => approveCampaignMutation.mutate(campaign.id)}
                    disabled={approveCampaignMutation.isPending || dismissCampaignMutation.isPending}
                  >
                    <Send className="h-3.5 w-3.5 mr-1" />
                    Approve & Send
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Prerequisites Check */}
      <AutopilotPrerequisites />

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-5 lg:w-auto lg:inline-grid">
          <TabsTrigger value="overview" className="gap-2">
            <Sparkles className="h-4 w-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-2">
            <History className="h-4 w-4" />
            History
          </TabsTrigger>
          <TabsTrigger value="settings" className="gap-2">
            <Settings className="h-4 w-4" />
            Settings
          </TabsTrigger>
          <TabsTrigger value="personas" className="gap-2">
            <Target className="h-4 w-4" />
            Personas
          </TabsTrigger>
          <TabsTrigger value="analytics" className="gap-2">
            <BarChart3 className="h-4 w-4" />
            Analytics
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* Status Cards */}
          <AutopilotStatusCards settings={settings} />
          
          {/* Quick Actions */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => setActiveTab("settings")}>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <Settings className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-medium">Discovery Settings</h3>
                      <p className="text-sm text-muted-foreground">Configure sources & frequency</p>
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>

            <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => setActiveTab("personas")}>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-purple-500/10">
                      <Target className="h-5 w-5 text-purple-600" />
                    </div>
                    <div>
                      <h3 className="font-medium">Target Personas</h3>
                      <p className="text-sm text-muted-foreground">Define ideal customer profiles</p>
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>

            <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => setActiveTab("analytics")}>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-green-500/10">
                      <BarChart3 className="h-5 w-5 text-green-600" />
                    </div>
                    <div>
                      <h3 className="font-medium">Performance Analytics</h3>
                      <p className="text-sm text-muted-foreground">Track discovery results</p>
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Personas Quick View */}
          <AutopilotPersonasQuickView onManage={() => setActiveTab("personas")} />

          {/* Email Stats + Mini Analytics */}
          <div className="grid gap-6 lg:grid-cols-2">
            <AutopilotEmailStats />
            <AutopilotAnalyticsPreview />
          </div>
        </TabsContent>

        <TabsContent value="history">
          <DiscoveryRunHistory />
        </TabsContent>

        <TabsContent value="settings">
          <AutopilotSettingsPanel settings={settings} />
        </TabsContent>

        <TabsContent value="personas">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5" />
                Discovery Personas
              </CardTitle>
              <CardDescription>
                Create targeted profiles to find different types of leads. Each persona can have unique targeting criteria and auto-enroll sequences.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Suspense fallback={<div className="flex items-center justify-center p-8"><Loader2 className="h-6 w-6 animate-spin" /></div>}>
                <PersonaManager />
              </Suspense>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics">
          <Suspense fallback={<div className="flex items-center justify-center p-8"><Loader2 className="h-6 w-6 animate-spin" /></div>}>
            <LeadAnalyticsDashboard />
          </Suspense>
        </TabsContent>
      </Tabs>
    </div>
  );
}

