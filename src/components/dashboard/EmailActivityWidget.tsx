import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Mail, Eye, MousePointerClick, Reply, TrendingUp, Clock, AlertTriangle, CheckCircle2, Sparkles } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useEffect } from 'react';
import { toast } from 'sonner';
import { Separator } from '@/components/ui/separator';

export function EmailActivityWidget() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Real-time subscription for all email activities
  useEffect(() => {
    const channel = supabase
      .channel('dashboard-email-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'email_activities',
        },
        (payload) => {
          console.log('Email activity update:', payload);
          
          // Invalidate queries to refetch
          queryClient.invalidateQueries({ queryKey: ['dashboard-email-activity'] });
          queryClient.invalidateQueries({ queryKey: ['dashboard-email-stats'] });
          
          // Show toast for important events
          if (payload.eventType === 'UPDATE') {
            const activity = payload.new as any;
            
            if (activity.replied_at && !payload.old?.replied_at) {
              toast.success('Email Reply Received! 🎉', {
                description: `Got a response: ${activity.subject || 'No subject'}`,
              });
            } else if (activity.opened_at && !payload.old?.opened_at) {
              toast.info('Email Opened 👀', {
                description: `${activity.subject || 'Email'} was just opened`,
              });
            }
          } else if (payload.eventType === 'INSERT') {
            const activity = payload.new as any;
            const metadata = activity.metadata as any;
            
            if (metadata?.auto_sent) {
              toast.success('Auto-Response Sent ✨', {
                description: `AI responded: ${activity.subject || 'No subject'}`,
              });
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

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
        .limit(15);

      if (error) throw error;
      return data;
    },
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

  // Separate recent replies
  const recentReplies = recentActivity?.filter(a => a.replied_at).slice(0, 3) || [];
  const otherActivity = recentActivity?.filter(a => !a.replied_at).slice(0, 7) || [];

  const getStatusBadge = (activity: any) => {
    const metadata = activity.metadata as any;
    const trackingEnabled = metadata?.tracking_enabled;
    
    if (activity.replied_at) {
      return (
        <Badge variant="default" className="bg-gradient-to-r from-green-500 to-emerald-500 text-white">
          <Reply className="h-3 w-3 mr-1" />
          Replied
        </Badge>
      );
    }
    if (metadata?.clicked) {
      return <Badge variant="default" className="bg-purple-500">Clicked</Badge>;
    }
    if (activity.opened_at) {
      return <Badge variant="default" className="bg-blue-500">Opened</Badge>;
    }
    if (activity.status === 'bounced') {
      return <Badge variant="destructive">Bounced</Badge>;
    }
    
    if (!trackingEnabled) {
      return (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger>
              <Badge variant="secondary" className="gap-1">
                <AlertTriangle className="h-3 w-3" />
                Sent (No Tracking)
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              <p className="text-xs">Email sent via {metadata?.provider || 'unknown provider'}</p>
              <p className="text-xs text-muted-foreground">Opens and clicks cannot be tracked</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
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

        {/* Recent Replies - Highlighted Section */}
        {recentReplies.length > 0 && (
          <>
            <div className="space-y-2">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-r from-green-500 to-emerald-500 flex items-center justify-center">
                  <Reply className="h-4 w-4 text-white" />
                </div>
                <h4 className="text-sm font-semibold">Recent Replies</h4>
                <Badge variant="default" className="bg-gradient-to-r from-green-500 to-emerald-500 ml-auto">
                  {recentReplies.length} New
                </Badge>
              </div>
              <div className="space-y-2">
                {recentReplies.map((activity: any) => {
                  const metadata = activity.metadata as any;
                  return (
                    <div
                      key={activity.id}
                      className="p-3 rounded-lg border-2 border-green-500/20 bg-gradient-to-r from-green-500/5 to-emerald-500/5 hover:border-green-500/40 transition-all cursor-pointer"
                      onClick={() => navigate('/all-campaigns')}
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                            <p className="text-sm font-medium truncate">
                              {activity.company_sequences?.companies?.name || 'Unknown Company'}
                            </p>
                          </div>
                          <p className="text-xs text-muted-foreground truncate pl-6">
                            {activity.subject || 'No subject'}
                          </p>
                        </div>
                        <Badge variant="default" className="bg-gradient-to-r from-green-500 to-emerald-500 text-white shrink-0">
                          <Reply className="h-3 w-3 mr-1" />
                          Replied
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground pl-6">
                        <div className="flex items-center gap-1 text-green-600 font-medium">
                          <Clock className="h-3 w-3" />
                          Replied {formatDistanceToNow(new Date(activity.replied_at), { addSuffix: true })}
                        </div>
                        {metadata?.auto_sent && (
                          <Badge variant="secondary" className="text-xs">
                            <Sparkles className="h-3 w-3 mr-1" />
                            AI Response
                          </Badge>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            <Separator className="my-4" />
          </>
        )}

        {/* Recent Activity List */}
        <div className="space-y-2">
          <h4 className="text-sm font-semibold mb-3">All Email Activity</h4>
          <ScrollArea className="h-[300px]">
            {!recentActivity || recentActivity.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Mail className="h-12 w-12 text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">No email activity yet</p>
              </div>
            ) : (
              <div className="space-y-2">
                {otherActivity.map((activity: any) => {
                  const metadata = activity.metadata as any;
                  return (
                    <div
                      key={activity.id}
                      className="p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors cursor-pointer"
                      onClick={() => navigate('/all-campaigns')}
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            {metadata?.auto_sent && (
                              <Sparkles className="h-3 w-3 text-primary shrink-0" />
                            )}
                            <p className="text-sm font-medium truncate">
                              {activity.company_sequences?.companies?.name || 'Unknown Company'}
                            </p>
                          </div>
                          <p className="text-xs text-muted-foreground truncate">
                            {activity.subject || 'No subject'}
                          </p>
                        </div>
                        {getStatusBadge(activity)}
                      </div>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatDistanceToNow(new Date(activity.sent_at), { addSuffix: true })}
                        </div>
                        {activity.metadata?.provider && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger>
                                <div className="flex items-center gap-1">
                                  <Mail className="h-3 w-3" />
                                  {activity.metadata.provider}
                                </div>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p className="text-xs font-semibold mb-1">Tracking Capabilities:</p>
                                <p className="text-xs">Opens: {activity.metadata.can_track_opens ? '✓' : '✗'}</p>
                                <p className="text-xs">Clicks: {activity.metadata.can_track_clicks ? '✓' : '✗'}</p>
                                <p className="text-xs">Replies: {activity.metadata.can_track_replies ? '✓' : '✗'}</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
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
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </div>
      </CardContent>
    </Card>
  );
}
