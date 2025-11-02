import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Activity, TrendingUp, Users, Zap } from 'lucide-react';
import { useEmailActivitiesRealtime } from '@/hooks/use-realtime';

export function LiveEngagementTracker() {
  // Enable realtime updates
  useEmailActivitiesRealtime();

  const { data: liveStats } = useQuery({
    queryKey: ['live-engagement-stats'],
    queryFn: async () => {
      // Get stats from last 24 hours
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      const { data: activities, error } = await supabase
        .from('email_activities')
        .select('opened_at, replied_at, status, metadata, sent_at')
        .gte('sent_at', yesterday.toISOString());

      if (error) throw error;

      const last24h = activities || [];
      const opened24h = last24h.filter(a => a.opened_at).length;
      const replied24h = last24h.filter(a => a.replied_at).length;
      const clicked24h = last24h.filter(a => {
        const metadata = a.metadata as any;
        return metadata?.clicked;
      }).length;
      const sent24h = last24h.length;

      // Get stats from last hour
      const lastHour = new Date();
      lastHour.setHours(lastHour.getHours() - 1);
      
      const lastHourActivities = last24h.filter(
        a => new Date(a.sent_at) >= lastHour
      );
      const openedLastHour = lastHourActivities.filter(a => a.opened_at).length;

      // Calculate active sequences
      const { data: activeSequences } = await supabase
        .from('company_sequences')
        .select('id')
        .eq('status', 'active');

      return {
        sent24h,
        opened24h,
        replied24h,
        clicked24h,
        openedLastHour,
        activeSequences: activeSequences?.length || 0,
      };
    },
    refetchInterval: 5000, // Refresh every 5 seconds for live feel
  });

  if (!liveStats) {
    return null;
  }

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
      <CardHeader>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <CardTitle className="text-lg">Live Engagement</CardTitle>
        </div>
        <CardDescription>Real-time activity tracking</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3">
          <div className="p-4 rounded-lg bg-card border">
            <div className="flex items-center justify-between mb-2">
              <Zap className="h-5 w-5 text-yellow-500" />
              <Badge variant="secondary" className="text-xs">Last hour</Badge>
            </div>
            <p className="text-2xl font-bold">{liveStats.openedLastHour}</p>
            <p className="text-xs text-muted-foreground">Opens</p>
          </div>

          <div className="p-4 rounded-lg bg-card border">
            <div className="flex items-center justify-between mb-2">
              <Activity className="h-5 w-5 text-blue-500" />
              <Badge variant="secondary" className="text-xs">24 hours</Badge>
            </div>
            <p className="text-2xl font-bold">{liveStats.opened24h}</p>
            <p className="text-xs text-muted-foreground">Total Opens</p>
          </div>

          <div className="p-4 rounded-lg bg-card border">
            <div className="flex items-center justify-between mb-2">
              <TrendingUp className="h-5 w-5 text-green-500" />
              <Badge variant="secondary" className="text-xs">24 hours</Badge>
            </div>
            <p className="text-2xl font-bold">{liveStats.replied24h}</p>
            <p className="text-xs text-muted-foreground">Replies</p>
          </div>

          <div className="p-4 rounded-lg bg-card border">
            <div className="flex items-center justify-between mb-2">
              <Users className="h-5 w-5 text-purple-500" />
              <Badge variant="default" className="text-xs bg-gradient-primary">Active</Badge>
            </div>
            <p className="text-2xl font-bold">{liveStats.activeSequences}</p>
            <p className="text-xs text-muted-foreground">Sequences</p>
          </div>
        </div>

        {/* Engagement Rate Indicator */}
        <div className="mt-4 p-3 rounded-lg border bg-muted/50">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">24h Engagement</span>
            <div className="flex items-center gap-2">
              <span className="font-semibold">
                {liveStats.sent24h > 0 
                  ? ((liveStats.opened24h / liveStats.sent24h) * 100).toFixed(1)
                  : 0}%
              </span>
              <TrendingUp className="h-4 w-4 text-green-500" />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
