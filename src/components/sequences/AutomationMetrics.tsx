import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Activity, Mail, TrendingUp, CheckCircle, ExternalLink, Settings, Sparkles, Clock, Zap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';

export function AutomationMetrics() {
  const navigate = useNavigate();
  
  const { data: metrics, isLoading } = useQuery({
    queryKey: ['automation-metrics'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

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

      // Get business profile for auto-response metrics
      const { data: profile } = await supabase
        .from('business_profiles')
        .select('auto_response_count_today, auto_response_daily_limit, auto_response_paused')
        .eq('user_id', user.id)
        .single();

      // Get auto-sent emails
      const { data: autoSentEmails } = await supabase
        .from('email_activities')
        .select('*')
        .contains('metadata', { auto_sent: true })
        .order('sent_at', { ascending: false })
        .limit(5);

      // Get total auto-sent count
      const { count: totalAutoSent } = await supabase
        .from('email_activities')
        .select('*', { count: 'exact', head: true })
        .contains('metadata', { auto_sent: true });

      return {
        activeSequences: activeCount || 0,
        emailsSentToday: todayEmails?.length || 0,
        openRate,
        replyRate,
        autoResponseToday: profile?.auto_response_count_today || 0,
        autoResponseLimit: profile?.auto_response_daily_limit || 10,
        autoResponsePaused: profile?.auto_response_paused || false,
        totalAutoSent: totalAutoSent || 0,
        recentAutoSent: autoSentEmails || [],
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
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Automation Metrics
              </CardTitle>
              <CardDescription>Real-time sequence performance</CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/company-sequences')}
              className="gap-2"
            >
              <Settings className="h-4 w-4" />
              Manage Campaigns
              <ExternalLink className="h-3 w-3" />
            </Button>
          </div>
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
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                Metrics update in real-time. Automation runs hourly via cron job.
              </p>
              <Button
                variant="link"
                size="sm"
                onClick={() => navigate('/company-sequences')}
                className="text-xs h-auto p-0"
              >
                View all campaigns →
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Auto-Response Metrics Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                AI Auto-Response
              </CardTitle>
              <CardDescription>Automated email response performance</CardDescription>
            </div>
            {metrics?.autoResponsePaused && (
              <Badge variant="destructive">Paused</Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Zap className="h-4 w-4" />
                Today's Usage
              </div>
              <div className="text-2xl font-bold">
                {metrics?.autoResponseToday || 0} / {metrics?.autoResponseLimit || 10}
              </div>
              <div className="text-xs text-muted-foreground">
                {Math.round(((metrics?.autoResponseToday || 0) / (metrics?.autoResponseLimit || 10)) * 100)}% used
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Sparkles className="h-4 w-4" />
                Total Auto-Sent
              </div>
              <div className="text-2xl font-bold">{metrics?.totalAutoSent || 0}</div>
              <div className="text-xs text-muted-foreground">All-time</div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                Avg Response Time
              </div>
              <div className="text-2xl font-bold">~5m</div>
              <div className="text-xs text-muted-foreground">AI processing</div>
            </div>
          </div>

          {metrics?.recentAutoSent && metrics.recentAutoSent.length > 0 && (
            <div className="mt-4 pt-4 border-t space-y-2">
              <h4 className="text-sm font-semibold mb-3">Recent Auto-Sent Emails</h4>
              {metrics.recentAutoSent.slice(0, 3).map((email: any) => (
                <div
                  key={email.id}
                  className="flex items-start justify-between p-2 rounded-lg border bg-muted/50 text-sm"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-3 w-3 text-success shrink-0" />
                      <span className="font-medium truncate">{email.subject}</span>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-1 mt-1">
                      {email.body}
                    </p>
                  </div>
                  <div className="text-xs text-muted-foreground ml-2 shrink-0">
                    {email.sent_at && format(new Date(email.sent_at), 'MMM d, HH:mm')}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="mt-4 pt-4 border-t flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              Configure auto-response settings in your profile
            </p>
            <Button
              variant="link"
              size="sm"
              onClick={() => navigate('/profile')}
              className="text-xs h-auto p-0"
            >
              Go to settings →
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
