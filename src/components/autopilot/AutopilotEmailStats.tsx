import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { 
  Mail, 
  Send, 
  Eye, 
  Reply, 
  ArrowUpRight,
  TrendingUp,
  Clock,
  Zap
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";

export function AutopilotEmailStats() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data: stats, isLoading } = useQuery({
    queryKey: ['autopilot-email-stats'],
    queryFn: async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      weekAgo.setHours(0, 0, 0, 0);

      // Get emails sent today
      const { data: todayEmails, error: todayError } = await supabase
        .from('email_activities')
        .select('id, sent_at, opened_at, replied_at, subject')
        .gte('sent_at', today.toISOString())
        .order('sent_at', { ascending: false });
      
      if (todayError) throw todayError;

      // Get emails sent this week for comparison
      const { data: weekEmails } = await supabase
        .from('email_activities')
        .select('id, sent_at, opened_at, replied_at')
        .gte('sent_at', weekAgo.toISOString());

      // Get active campaigns
      const { count: activeCampaigns } = await supabase
        .from('email_campaigns')
        .select('id', { count: 'exact', head: true })
        .in('status', ['scheduled', 'sending']);

      // Get active sequences
      const { count: activeSequences } = await supabase
        .from('company_sequences')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'active');

      // Calculate stats
      const sentToday = todayEmails?.length || 0;
      const openedToday = todayEmails?.filter(e => e.opened_at).length || 0;
      const repliedToday = todayEmails?.filter(e => e.replied_at).length || 0;
      
      const sentThisWeek = weekEmails?.length || 0;
      const openedThisWeek = weekEmails?.filter(e => e.opened_at).length || 0;
      const repliedThisWeek = weekEmails?.filter(e => e.replied_at).length || 0;
      
      const weekOpenRate = sentThisWeek > 0 ? Math.round((openedThisWeek / sentThisWeek) * 100) : 0;
      const weekReplyRate = sentThisWeek > 0 ? Math.round((repliedThisWeek / sentThisWeek) * 100) : 0;

      // Get recent sent emails
      const recentEmails = todayEmails?.slice(0, 5) || [];

      return {
        sentToday,
        openedToday,
        repliedToday,
        sentThisWeek,
        weekOpenRate,
        weekReplyRate,
        activeCampaigns: activeCampaigns || 0,
        activeSequences: activeSequences || 0,
        recentEmails,
      };
    },
    enabled: !!user?.id,
    refetchInterval: 60000,
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Email Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="h-20 bg-muted rounded"></div>
            <div className="h-20 bg-muted rounded"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Email Activity
            </CardTitle>
            <CardDescription>
              Track your automated outreach performance
            </CardDescription>
          </div>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => navigate('/unified-campaigns')}
          >
            View All
            <ArrowUpRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Today's Stats */}
        <div>
          <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Today's Activity
          </h4>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-3 rounded-lg bg-muted/50">
              <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
                <Send className="h-4 w-4" />
                <span className="text-xs">Sent</span>
              </div>
              <div className="text-2xl font-bold">{stats?.sentToday || 0}</div>
            </div>
            <div className="text-center p-3 rounded-lg bg-muted/50">
              <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
                <Eye className="h-4 w-4" />
                <span className="text-xs">Opened</span>
              </div>
              <div className="text-2xl font-bold text-blue-600">{stats?.openedToday || 0}</div>
            </div>
            <div className="text-center p-3 rounded-lg bg-muted/50">
              <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
                <Reply className="h-4 w-4" />
                <span className="text-xs">Replied</span>
              </div>
              <div className="text-2xl font-bold text-green-600">{stats?.repliedToday || 0}</div>
            </div>
          </div>
        </div>

        {/* Weekly Performance */}
        <div>
          <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Weekly Performance
          </h4>
          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-muted-foreground">Open Rate</span>
                <span className="font-medium">{stats?.weekOpenRate || 0}%</span>
              </div>
              <Progress value={stats?.weekOpenRate || 0} className="h-2" />
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-muted-foreground">Reply Rate</span>
                <span className="font-medium">{stats?.weekReplyRate || 0}%</span>
              </div>
              <Progress value={stats?.weekReplyRate || 0} className="h-2" />
            </div>
            <p className="text-xs text-muted-foreground">
              {stats?.sentThisWeek || 0} emails sent this week
            </p>
          </div>
        </div>

        {/* Active Automations */}
        <div className="flex gap-4">
          <div className="flex-1 p-3 rounded-lg border">
            <div className="flex items-center gap-2 mb-1">
              <Zap className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">Active Campaigns</span>
            </div>
            <div className="text-2xl font-bold">{stats?.activeCampaigns || 0}</div>
          </div>
          <div className="flex-1 p-3 rounded-lg border">
            <div className="flex items-center gap-2 mb-1">
              <Mail className="h-4 w-4 text-purple-600" />
              <span className="text-sm font-medium">Active Sequences</span>
            </div>
            <div className="text-2xl font-bold">{stats?.activeSequences || 0}</div>
          </div>
        </div>

        {/* Recent Emails */}
        {stats?.recentEmails && stats.recentEmails.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold mb-2">Recent Emails</h4>
            <div className="space-y-2">
              {stats.recentEmails.map((email: any) => (
                <div 
                  key={email.id}
                  className="flex items-center justify-between p-2 rounded-lg border text-sm"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Send className="h-3 w-3 text-muted-foreground shrink-0" />
                    <span className="truncate">{email.subject || 'No subject'}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {email.replied_at ? (
                      <Badge variant="outline" className="bg-green-500/10 text-green-600 text-xs">
                        <Reply className="h-3 w-3 mr-1" />
                        Replied
                      </Badge>
                    ) : email.opened_at ? (
                      <Badge variant="outline" className="bg-blue-500/10 text-blue-600 text-xs">
                        <Eye className="h-3 w-3 mr-1" />
                        Opened
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs">
                        Sent
                      </Badge>
                    )}
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(email.sent_at), 'h:mm a')}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
