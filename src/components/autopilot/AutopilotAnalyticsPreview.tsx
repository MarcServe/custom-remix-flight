import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  BarChart3, 
  TrendingUp, 
  TrendingDown,
  Mail,
  Reply,
  Brain
} from "lucide-react";

export function AutopilotAnalyticsPreview() {
  const { user } = useAuth();

  // Fetch engagement analytics
  const { data: analytics, isLoading } = useQuery({
    queryKey: ['autopilot-analytics-preview'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lead_feedback_analytics')
        .select('*')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false })
        .limit(100);
      
      if (error) throw error;
      
      const total = data?.length || 0;
      const approved = data?.filter(d => d.action === 'approved').length || 0;
      const autoApproved = data?.filter(d => d.action === 'auto_approved').length || 0;
      const rejected = data?.filter(d => d.action === 'rejected').length || 0;
      const opened = data?.filter(d => d.email_opened).length || 0;
      const replied = data?.filter(d => d.email_replied).length || 0;
      
      // Top industries
      const industryStats: Record<string, { approved: number; total: number }> = {};
      data?.forEach(d => {
        if (d.industry) {
          if (!industryStats[d.industry]) {
            industryStats[d.industry] = { approved: 0, total: 0 };
          }
          industryStats[d.industry].total++;
          if (d.action === 'approved' || d.action === 'auto_approved') {
            industryStats[d.industry].approved++;
          }
        }
      });

      const topIndustries = Object.entries(industryStats)
        .map(([industry, stats]) => ({
          industry,
          rate: stats.total > 0 ? Math.round((stats.approved / stats.total) * 100) : 0,
          count: stats.total,
        }))
        .sort((a, b) => b.rate - a.rate)
        .slice(0, 3);

      return {
        total,
        approvalRate: total > 0 ? Math.round(((approved + autoApproved) / total) * 100) : 0,
        openRate: (approved + autoApproved) > 0 ? Math.round((opened / (approved + autoApproved)) * 100) : 0,
        replyRate: opened > 0 ? Math.round((replied / opened) * 100) : 0,
        topIndustries,
      };
    },
    enabled: !!user?.id,
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="flex items-center justify-center">
            <div className="animate-pulse text-muted-foreground">Loading analytics...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {/* Performance Metrics */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <BarChart3 className="h-4 w-4" />
            Performance Metrics
          </CardTitle>
          <CardDescription>Based on last 100 leads</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Approval Rate</span>
              <span className="font-medium">{analytics?.approvalRate || 0}%</span>
            </div>
            <Progress value={analytics?.approvalRate || 0} className="h-2" />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <Mail className="h-3 w-3 text-blue-600" />
                <span className="text-muted-foreground">Email Open Rate</span>
              </div>
              <span className="font-medium">{analytics?.openRate || 0}%</span>
            </div>
            <Progress value={analytics?.openRate || 0} className="h-2" />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <Reply className="h-3 w-3 text-purple-600" />
                <span className="text-muted-foreground">Reply Rate</span>
              </div>
              <span className="font-medium">{analytics?.replyRate || 0}%</span>
            </div>
            <Progress value={analytics?.replyRate || 0} className="h-2" />
          </div>
        </CardContent>
      </Card>

      {/* AI Insights */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Brain className="h-4 w-4" />
            AI Insights
          </CardTitle>
          <CardDescription>What's working best</CardDescription>
        </CardHeader>
        <CardContent>
          {analytics?.topIndustries && analytics.topIndustries.length > 0 ? (
            <div className="space-y-3">
              <h4 className="text-sm font-medium flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-green-600" />
                Top Converting Industries
              </h4>
              <div className="space-y-2">
                {analytics.topIndustries.map((ind, i) => (
                  <div 
                    key={ind.industry}
                    className="flex items-center justify-between p-2 rounded-lg bg-muted/50"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground w-4">{i + 1}</span>
                      <span className="text-sm">{ind.industry}</span>
                    </div>
                    <Badge 
                      variant={ind.rate >= 70 ? "default" : "secondary"}
                      className={ind.rate >= 70 ? "bg-green-600" : ""}
                    >
                      {ind.rate}%
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center py-4 text-muted-foreground">
              <Brain className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Not enough data yet</p>
              <p className="text-xs">Approve some leads to see insights</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
