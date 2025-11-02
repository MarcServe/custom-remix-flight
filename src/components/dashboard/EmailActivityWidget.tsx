import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Mail, Eye, MousePointerClick, Reply, TrendingUp, Clock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';

export function EmailActivityWidget() {
  const navigate = useNavigate();

  const { data: recentActivity } = useQuery({
    queryKey: ['dashboard-email-activity'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('email_activities')
        .select(`
          id,
          subject,
          status,
          sent_at,
          opened_at,
          replied_at,
          metadata,
          company_sequences(
            companies(name)
          )
        `)
        .order('sent_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      return data;
    },
    refetchInterval: 10000, // Refresh every 10 seconds
  });

  const { data: stats } = useQuery({
    queryKey: ['dashboard-email-stats'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('email_activities')
        .select('opened_at, replied_at, status, metadata');

      if (error) throw error;

      const total = data?.length || 0;
      const opened = data?.filter(a => a.opened_at).length || 0;
      const replied = data?.filter(a => a.replied_at).length || 0;
      const clicked = data?.filter(a => {
        const metadata = a.metadata as any;
        return metadata?.clicked;
      }).length || 0;

      return {
        total,
        opened,
        replied,
        clicked,
        openRate: total > 0 ? (opened / total) * 100 : 0,
        replyRate: total > 0 ? (replied / total) * 100 : 0,
      };
    },
  });

  const getStatusBadge = (activity: any) => {
    if (activity.replied_at) {
      return <Badge variant="default" className="bg-green-500">Replied</Badge>;
    }
    const metadata = activity.metadata as any;
    if (metadata?.clicked) {
      return <Badge variant="default" className="bg-purple-500">Clicked</Badge>;
    }
    if (activity.opened_at) {
      return <Badge variant="default" className="bg-blue-500">Opened</Badge>;
    }
    if (activity.status === 'bounced') {
      return <Badge variant="destructive">Bounced</Badge>;
    }
    return <Badge variant="secondary">Sent</Badge>;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">Email Activity</CardTitle>
            <CardDescription>Recent email engagement</CardDescription>
          </div>
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => navigate('/all-campaigns')}
          >
            View All
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {/* Stats Summary */}
        {stats && (
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="p-3 rounded-lg border bg-card">
              <div className="flex items-center gap-2 mb-1">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Total Sent</span>
              </div>
              <p className="text-2xl font-bold">{stats.total}</p>
            </div>
            <div className="p-3 rounded-lg border bg-card">
              <div className="flex items-center gap-2 mb-1">
                <Eye className="h-4 w-4 text-blue-500" />
                <span className="text-xs text-muted-foreground">Open Rate</span>
              </div>
              <p className="text-2xl font-bold">{stats.openRate.toFixed(0)}%</p>
              <Progress value={stats.openRate} className="h-1 mt-2" />
            </div>
            <div className="p-3 rounded-lg border bg-card">
              <div className="flex items-center gap-2 mb-1">
                <MousePointerClick className="h-4 w-4 text-purple-500" />
                <span className="text-xs text-muted-foreground">Clicks</span>
              </div>
              <p className="text-2xl font-bold">{stats.clicked}</p>
            </div>
            <div className="p-3 rounded-lg border bg-card">
              <div className="flex items-center gap-2 mb-1">
                <Reply className="h-4 w-4 text-green-500" />
                <span className="text-xs text-muted-foreground">Reply Rate</span>
              </div>
              <p className="text-2xl font-bold">{stats.replyRate.toFixed(0)}%</p>
              <Progress value={stats.replyRate} className="h-1 mt-2" />
            </div>
          </div>
        )}

        {/* Recent Activity List */}
        <div className="space-y-2">
          <h4 className="text-sm font-semibold mb-3">Recent Activity</h4>
          <ScrollArea className="h-[300px]">
            {!recentActivity || recentActivity.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Mail className="h-12 w-12 text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">No email activity yet</p>
              </div>
            ) : (
              <div className="space-y-2">
                {recentActivity.map((activity: any) => (
                  <div
                    key={activity.id}
                    className="p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {activity.company_sequences?.companies?.name || 'Unknown Company'}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {activity.subject || 'No subject'}
                        </p>
                      </div>
                      {getStatusBadge(activity)}
                    </div>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatDistanceToNow(new Date(activity.sent_at), { addSuffix: true })}
                      </div>
                      {activity.opened_at && (
                        <div className="flex items-center gap-1 text-blue-500">
                          <Eye className="h-3 w-3" />
                          Opened
                        </div>
                      )}
                      {activity.metadata?.clicked && (
                        <div className="flex items-center gap-1 text-purple-500">
                          <MousePointerClick className="h-3 w-3" />
                          Clicked
                        </div>
                      )}
                      {activity.replied_at && (
                        <div className="flex items-center gap-1 text-green-500">
                          <Reply className="h-3 w-3" />
                          Replied
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>
      </CardContent>
    </Card>
  );
}
