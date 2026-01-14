import { useState } from "react";
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
  Sparkles
} from "lucide-react";
import { AutopilotStatusCards } from "@/components/autopilot/AutopilotStatusCards";
import { AutopilotSettingsPanel } from "@/components/autopilot/AutopilotSettingsPanel";
import { AutopilotPersonasQuickView } from "@/components/autopilot/AutopilotPersonasQuickView";
import { AutopilotPrerequisites } from "@/components/autopilot/AutopilotPrerequisites";
import { AutopilotAnalyticsPreview } from "@/components/autopilot/AutopilotAnalyticsPreview";

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

  const formatNextRun = (lastRun: string | null, frequency: string) => {
    if (!lastRun) return 'Not scheduled yet';
    
    const last = new Date(lastRun);
    const next = new Date(last);
    
    switch (frequency) {
      case 'daily':
        next.setDate(next.getDate() + 1);
        break;
      case 'twice_weekly':
        next.setDate(next.getDate() + 3);
        break;
      case 'weekly':
        next.setDate(next.getDate() + 7);
        break;
      default:
        next.setDate(next.getDate() + 1);
    }
    
    return next.toLocaleString();
  };

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
                    {settings?.last_run_at 
                      ? new Date(settings.last_run_at).toLocaleString() 
                      : 'Never'}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Rocket className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Next run:</span>
                  <span className="font-medium">
                    {formatNextRun(settings?.last_run_at, settings?.discovery_frequency || 'daily')}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs">
                  {settings?.discovery_frequency || 'Daily'} at 9:00 AM UTC
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Prerequisites Check */}
      <AutopilotPrerequisites />

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-grid">
          <TabsTrigger value="overview" className="gap-2">
            <Sparkles className="h-4 w-4" />
            Overview
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

          {/* Mini Analytics */}
          <AutopilotAnalyticsPreview />
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
              {/* Import the full PersonaManager from LeadInbox */}
              <PersonaManagerEmbed />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics">
          <AnalyticsDashboardEmbed />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Embedded components that import from existing
function PersonaManagerEmbed() {
  // Dynamically import to avoid circular deps
  const { PersonaManager } = require("@/components/lead-inbox/PersonaManager");
  return <PersonaManager />;
}

function AnalyticsDashboardEmbed() {
  const { LeadAnalyticsDashboard } = require("@/components/lead-inbox/LeadAnalyticsDashboard");
  return <LeadAnalyticsDashboard />;
}
