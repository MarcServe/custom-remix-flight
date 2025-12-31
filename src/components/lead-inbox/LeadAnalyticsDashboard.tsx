import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { 
  TrendingUp, 
  TrendingDown, 
  Mail, 
  MousePointer, 
  Reply, 
  AlertCircle,
  CheckCircle2,
  XCircle,
  Zap,
  Brain,
  Target
} from "lucide-react";

export function LeadAnalyticsDashboard() {
  const { user } = useAuth();

  // Fetch engagement analytics
  const { data: analytics, isLoading } = useQuery({
    queryKey: ['lead-engagement-analytics'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lead_feedback_analytics')
        .select('*')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      // Calculate metrics
      const total = data?.length || 0;
      const approved = data?.filter(d => d.action === 'approved').length || 0;
      const rejected = data?.filter(d => d.action === 'rejected').length || 0;
      const autoApproved = data?.filter(d => d.action === 'auto_approved').length || 0;
      const opened = data?.filter(d => d.email_opened).length || 0;
      const replied = data?.filter(d => d.email_replied).length || 0;
      const bounced = data?.filter(d => d.email_bounced).length || 0;
      
      // Calculate by industry
      const industryStats: Record<string, { approved: number; rejected: number; replied: number }> = {};
      data?.forEach(d => {
        if (d.industry) {
          if (!industryStats[d.industry]) {
            industryStats[d.industry] = { approved: 0, rejected: 0, replied: 0 };
          }
          if (d.action === 'approved' || d.action === 'auto_approved') industryStats[d.industry].approved++;
          if (d.action === 'rejected') industryStats[d.industry].rejected++;
          if (d.email_replied) industryStats[d.industry].replied++;
        }
      });

      // Sort industries by success rate
      const topIndustries = Object.entries(industryStats)
        .map(([industry, stats]) => ({
          industry,
          ...stats,
          total: stats.approved + stats.rejected,
          approvalRate: stats.approved / (stats.approved + stats.rejected) * 100 || 0,
        }))
        .sort((a, b) => b.approvalRate - a.approvalRate)
        .slice(0, 5);

      // Calculate average decision time
      const avgDecisionTime = data?.filter(d => d.time_to_decision_seconds)
        .reduce((acc, d) => acc + (d.time_to_decision_seconds || 0), 0) / 
        (data?.filter(d => d.time_to_decision_seconds).length || 1);

      return {
        total,
        approved,
        rejected,
        autoApproved,
        opened,
        replied,
        bounced,
        approvalRate: total > 0 ? ((approved + autoApproved) / total * 100) : 0,
        openRate: (approved + autoApproved) > 0 ? (opened / (approved + autoApproved) * 100) : 0,
        replyRate: opened > 0 ? (replied / opened * 100) : 0,
        bounceRate: (approved + autoApproved) > 0 ? (bounced / (approved + autoApproved) * 100) : 0,
        topIndustries,
        avgDecisionTime: Math.round(avgDecisionTime),
      };
    },
    enabled: !!user?.id,
  });

  // Fetch discovery personas stats
  const { data: personas } = useQuery({
    queryKey: ['discovery-personas-stats'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('discovery_personas')
        .select('*')
        .eq('user_id', user?.id)
        .order('priority', { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
  });

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader className="pb-2">
              <div className="h-4 w-24 bg-muted rounded" />
            </CardHeader>
            <CardContent>
              <div className="h-8 w-16 bg-muted rounded" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Approval Rate</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics?.approvalRate.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">
              {analytics?.approved} approved + {analytics?.autoApproved} auto
            </p>
            <Progress value={analytics?.approvalRate || 0} className="mt-2 h-1" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Email Open Rate</CardTitle>
            <Mail className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics?.openRate.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">
              {analytics?.opened} of {(analytics?.approved || 0) + (analytics?.autoApproved || 0)} opened
            </p>
            <Progress value={analytics?.openRate || 0} className="mt-2 h-1" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Reply Rate</CardTitle>
            <Reply className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics?.replyRate.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">
              {analytics?.replied} replies from opens
            </p>
            <Progress value={analytics?.replyRate || 0} className="mt-2 h-1" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Bounce Rate</CardTitle>
            <AlertCircle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics?.bounceRate.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">
              {analytics?.bounced} bounced emails
            </p>
            <Progress value={analytics?.bounceRate || 0} className="mt-2 h-1 [&>div]:bg-red-500" />
          </CardContent>
        </Card>
      </div>

      {/* Industry Performance & Personas */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Top Performing Industries */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-green-600" />
              Top Performing Industries
            </CardTitle>
            <CardDescription>Based on approval and reply rates</CardDescription>
          </CardHeader>
          <CardContent>
            {analytics?.topIndustries && analytics.topIndustries.length > 0 ? (
              <div className="space-y-3">
                {analytics.topIndustries.map((ind, i) => (
                  <div key={ind.industry} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-muted-foreground w-4">{i + 1}</span>
                      <span className="text-sm">{ind.industry}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={ind.approvalRate >= 70 ? "default" : ind.approvalRate >= 50 ? "secondary" : "outline"}>
                        {ind.approvalRate.toFixed(0)}% approved
                      </Badge>
                      {ind.replied > 0 && (
                        <Badge variant="outline" className="text-purple-600 border-purple-200">
                          {ind.replied} replies
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                No industry data yet. Approve some leads to see analytics.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Active Personas */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5 text-primary" />
              Discovery Personas
            </CardTitle>
            <CardDescription>Your targeting profiles performance</CardDescription>
          </CardHeader>
          <CardContent>
            {personas && personas.length > 0 ? (
              <div className="space-y-3">
                {personas.slice(0, 5).map((persona) => (
                  <div key={persona.id} className="flex items-center justify-between p-2 rounded-lg border">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${persona.is_active ? 'bg-green-500' : 'bg-muted'}`} />
                      <span className="text-sm font-medium">{persona.name}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{persona.total_leads_found || 0} found</span>
                      <span>•</span>
                      <span>{persona.total_approved || 0} approved</span>
                      {persona.conversion_rate > 0 && (
                        <>
                          <span>•</span>
                          <Badge variant="outline" className="text-green-600">
                            {Number(persona.conversion_rate).toFixed(0)}%
                          </Badge>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                No personas configured. Create one in the Personas tab.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* AI Learning Insights */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-purple-600" />
            AI Learning Insights
          </CardTitle>
          <CardDescription>What the AI has learned from your decisions and email engagement</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <h4 className="text-sm font-medium flex items-center gap-1">
                <TrendingUp className="h-4 w-4 text-green-600" />
                High-Converting Signals
              </h4>
              <p className="text-xs text-muted-foreground">
                Industries and geographies with high reply rates are prioritized in future discovery.
              </p>
              <div className="text-sm">
                {analytics?.topIndustries?.filter(i => i.replied > 0).slice(0, 3).map(i => (
                  <Badge key={i.industry} variant="secondary" className="mr-1 mb-1">
                    {i.industry}
                  </Badge>
                ))}
                {(!analytics?.topIndustries || analytics.topIndustries.filter(i => i.replied > 0).length === 0) && (
                  <span className="text-muted-foreground">Learning...</span>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="text-sm font-medium flex items-center gap-1">
                <TrendingDown className="h-4 w-4 text-red-600" />
                Avoided Patterns
              </h4>
              <p className="text-xs text-muted-foreground">
                High bounce rates and rejections teach the AI what to avoid.
              </p>
              <div className="text-sm">
                {analytics?.bounced && analytics.bounced > 0 ? (
                  <span className="text-muted-foreground">
                    {analytics.bounced} bounced emails inform avoidance
                  </span>
                ) : (
                  <span className="text-muted-foreground">No patterns to avoid yet</span>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="text-sm font-medium flex items-center gap-1">
                <Zap className="h-4 w-4 text-yellow-600" />
                Decision Speed
              </h4>
              <p className="text-xs text-muted-foreground">
                Average time to approve/reject a lead.
              </p>
              <div className="text-2xl font-bold">
                {analytics?.avgDecisionTime ? (
                  analytics.avgDecisionTime < 60 
                    ? `${analytics.avgDecisionTime}s` 
                    : `${Math.round(analytics.avgDecisionTime / 60)}m`
                ) : '—'}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
