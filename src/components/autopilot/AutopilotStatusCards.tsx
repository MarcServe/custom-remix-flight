import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  Zap, 
  Target, 
  Mail, 
  Brain,
  TrendingUp,
  Users,
  Clock,
  CheckCircle2
} from "lucide-react";

interface AutopilotStatusCardsProps {
  settings: any;
}

export function AutopilotStatusCards({ settings }: AutopilotStatusCardsProps) {
  const { user } = useAuth();

  // Fetch today's leads
  const { data: todayStats } = useQuery({
    queryKey: ['autopilot-today-stats'],
    queryFn: async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const { data, error } = await supabase
        .from('autonomous_leads')
        .select('status, quality_score')
        .eq('user_id', user?.id)
        .gte('created_at', today.toISOString());
      
      if (error) throw error;
      
      const total = data?.length || 0;
      const autoApproved = data?.filter(l => l.status === 'auto_approved').length || 0;
      const pending = data?.filter(l => l.status === 'pending').length || 0;
      const avgQuality = data?.length 
        ? Math.round(data.reduce((acc, l) => acc + (l.quality_score || 0), 0) / data.length)
        : 0;
      
      return { total, autoApproved, pending, avgQuality };
    },
    enabled: !!user?.id,
    refetchInterval: 60000, // Refresh every minute
  });

  // Fetch active sequences count
  const { data: sequenceStats } = useQuery({
    queryKey: ['autopilot-sequence-stats'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('company_sequences')
        .select('id, status')
        .eq('status', 'active');
      
      if (error) throw error;
      return {
        active: data?.length || 0,
      };
    },
    enabled: !!user?.id,
  });

  // Fetch personas stats
  const { data: personaStats } = useQuery({
    queryKey: ['autopilot-persona-stats'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('discovery_personas')
        .select('id, is_active, total_leads_found, total_approved')
        .eq('user_id', user?.id);
      
      if (error) throw error;
      
      const active = data?.filter(p => p.is_active).length || 0;
      const totalFound = data?.reduce((acc, p) => acc + (p.total_leads_found || 0), 0) || 0;
      const totalApproved = data?.reduce((acc, p) => acc + (p.total_approved || 0), 0) || 0;
      
      return { active, total: data?.length || 0, totalFound, totalApproved };
    },
    enabled: !!user?.id,
  });

  // Calculate approval rate
  const approvalRate = settings?.total_approved && (settings?.total_approved + settings?.total_rejected)
    ? Math.round((settings.total_approved / (settings.total_approved + settings.total_rejected)) * 100)
    : 0;

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {/* System Status */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">System Status</CardTitle>
          <Zap className={`h-4 w-4 ${settings?.enabled ? 'text-green-600' : 'text-muted-foreground'}`} />
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <Badge variant={settings?.enabled ? "default" : "secondary"} className={settings?.enabled ? "bg-green-600" : ""}>
              {settings?.enabled ? 'Active' : 'Paused'}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            {settings?.discovery_frequency || 'Daily'} discovery · {settings?.max_leads_per_run || 10} leads/run
          </p>
          <div className="mt-3 space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Total discovered</span>
              <span className="font-medium">{settings?.total_approved || 0} approved</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Today's Discovery */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Today's Discovery</CardTitle>
          <Clock className="h-4 w-4 text-blue-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{todayStats?.total || 0}</div>
          <p className="text-xs text-muted-foreground">
            {todayStats?.autoApproved || 0} auto-approved · {todayStats?.pending || 0} pending
          </p>
          {todayStats?.avgQuality ? (
            <div className="mt-3">
              <div className="flex justify-between text-xs mb-1">
                <span className="text-muted-foreground">Avg. Quality Score</span>
                <span className="font-medium">{todayStats.avgQuality}%</span>
              </div>
              <Progress value={todayStats.avgQuality} className="h-1" />
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* Active Outreach */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Active Outreach</CardTitle>
          <Mail className="h-4 w-4 text-purple-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{sequenceStats?.active || 0}</div>
          <p className="text-xs text-muted-foreground">
            Active sequences running
          </p>
          <div className="mt-3 flex items-center gap-2">
            {settings?.auto_enroll_enabled ? (
              <Badge variant="outline" className="text-green-600 border-green-200 text-xs">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Auto-enroll on
              </Badge>
            ) : (
              <Badge variant="outline" className="text-muted-foreground text-xs">
                Auto-enroll off
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* AI Learning */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">AI Learning</CardTitle>
          <Brain className="h-4 w-4 text-pink-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{approvalRate}%</div>
          <p className="text-xs text-muted-foreground">
            Approval rate ({personaStats?.active || 0} active personas)
          </p>
          <div className="mt-3 space-y-1">
            <div className="flex items-center gap-2 text-xs">
              <TrendingUp className="h-3 w-3 text-green-600" />
              <span className="text-muted-foreground">
                {settings?.learned_industries?.length || 0} learned industries
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
