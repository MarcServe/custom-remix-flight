import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Activity, Mail, TrendingUp, CheckCircle } from 'lucide-react';

export function AutomationMetrics() {
  const { data: metrics, isLoading } = useQuery({
    queryKey: ['automation-metrics'],
    queryFn: async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Get active sequences count
      const { count: activeCount } = await supabase
        .from('company_sequences')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'active');

      // Get emails sent today
      const { data: todayEmails } = await supabase
        .from('email_activities')
        .select('*')
        .gte('sent_at', today.toISOString());

      // Calculate open rate
      const openedCount = todayEmails?.filter(e => e.opened_at).length || 0;
      const openRate = todayEmails?.length ? Math.round((openedCount / todayEmails.length) * 100) : 0;

      // Calculate reply rate
      const repliedCount = todayEmails?.filter(e => e.replied_at).length || 0;
      const replyRate = todayEmails?.length ? Math.round((repliedCount / todayEmails.length) * 100) : 0;

      return {
        activeSequences: activeCount || 0,
        emailsSentToday: todayEmails?.length || 0,
        openRate,
        replyRate,
      };
    },
    refetchInterval: 60000, // Refresh every minute
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Automation Metrics</CardTitle>
          <CardDescription>Loading metrics...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5" />
          Automation Metrics
        </CardTitle>
        <CardDescription>Real-time sequence performance</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Activity className="h-4 w-4" />
              Active Sequences
            </div>
            <div className="text-2xl font-bold">{metrics?.activeSequences || 0}</div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Mail className="h-4 w-4" />
              Sent Today
            </div>
            <div className="text-2xl font-bold">{metrics?.emailsSentToday || 0}</div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <TrendingUp className="h-4 w-4" />
              Open Rate
            </div>
            <div className="flex items-center gap-2">
              <div className="text-2xl font-bold">{metrics?.openRate || 0}%</div>
              <Badge variant={metrics?.openRate && metrics.openRate > 50 ? 'default' : 'secondary'}>
                {metrics?.openRate && metrics.openRate > 50 ? 'Good' : 'Low'}
              </Badge>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <CheckCircle className="h-4 w-4" />
              Reply Rate
            </div>
            <div className="flex items-center gap-2">
              <div className="text-2xl font-bold">{metrics?.replyRate || 0}%</div>
              <Badge variant={metrics?.replyRate && metrics.replyRate > 10 ? 'default' : 'secondary'}>
                {metrics?.replyRate && metrics.replyRate > 10 ? 'Good' : 'Low'}
              </Badge>
            </div>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t">
          <p className="text-xs text-muted-foreground">
            Metrics update in real-time. Automation runs hourly via cron job.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
