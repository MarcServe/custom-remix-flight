import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BarChart, LineChart, Line, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell } from 'recharts';
import { TrendingUp, Zap, Clock, Target, Brain, Activity } from 'lucide-react';
import { format, subDays, startOfDay } from 'date-fns';

const COLORS = ['#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#ec4899'];

export function AutoResponseAnalytics() {
  const { data: analytics, isLoading } = useQuery({
    queryKey: ['auto-response-analytics'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const thirtyDaysAgo = subDays(new Date(), 30);

      // Get all analytics data
      const { data: analyticsData } = await supabase
        .from('auto_response_analytics')
        .select('*')
        .eq('user_id', user.id)
        .gte('generated_at', thirtyDaysAgo.toISOString())
        .order('generated_at', { ascending: true });

      if (!analyticsData || analyticsData.length === 0) {
        return {
          totalResponses: 0,
          avgResponseTime: 0,
          avgTokens: 0,
          openRate: 0,
          replyRate: 0,
          modelDistribution: [],
          dailyVolume: [],
          performanceByModel: [],
          hourlyDistribution: [],
        };
      }

      // Calculate metrics
      const totalResponses = analyticsData.length;
      const sentResponses = analyticsData.filter(a => a.sent_at);
      const openedResponses = analyticsData.filter(a => a.opened_at);
      const repliedResponses = analyticsData.filter(a => a.replied_at);

      const avgResponseTime = Math.round(
        analyticsData.reduce((sum, a) => sum + (a.response_time_ms || 0), 0) / totalResponses
      );

      const avgTokens = Math.round(
        analyticsData.reduce((sum, a) => sum + (a.token_count || 0), 0) / totalResponses
      );

      const openRate = sentResponses.length > 0 
        ? Math.round((openedResponses.length / sentResponses.length) * 100)
        : 0;

      const replyRate = sentResponses.length > 0
        ? Math.round((repliedResponses.length / sentResponses.length) * 100)
        : 0;

      // Model distribution
      const modelCounts = analyticsData.reduce((acc, a) => {
        const model = a.ai_model || 'unknown';
        acc[model] = (acc[model] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const modelDistribution = Object.entries(modelCounts).map(([name, value]) => ({
        name: name.split('/')[1]?.replace(/-/g, ' ') || name,
        value,
      }));

      // Daily volume (last 30 days)
      const dailyData = Array.from({ length: 30 }, (_, i) => {
        const date = startOfDay(subDays(new Date(), 29 - i));
        const dateStr = format(date, 'MM/dd');
        const dayData = analyticsData.filter(a => 
          startOfDay(new Date(a.generated_at)).getTime() === date.getTime()
        );
        
        return {
          date: dateStr,
          generated: dayData.length,
          sent: dayData.filter(a => a.sent_at).length,
          opened: dayData.filter(a => a.opened_at).length,
          replied: dayData.filter(a => a.replied_at).length,
        };
      });

      // Performance by model
      const modelPerformance = Object.entries(
        analyticsData.reduce((acc, a) => {
          const model = a.ai_model || 'unknown';
          if (!acc[model]) {
            acc[model] = { total: 0, sent: 0, opened: 0, replied: 0, totalTime: 0 };
          }
          acc[model].total += 1;
          if (a.sent_at) acc[model].sent += 1;
          if (a.opened_at) acc[model].opened += 1;
          if (a.replied_at) acc[model].replied += 1;
          acc[model].totalTime += a.response_time_ms || 0;
          return acc;
        }, {} as Record<string, any>)
      ).map(([name, stats]) => ({
        name: name.split('/')[1]?.replace(/-/g, ' ') || name,
        openRate: stats.sent > 0 ? Math.round((stats.opened / stats.sent) * 100) : 0,
        replyRate: stats.sent > 0 ? Math.round((stats.replied / stats.sent) * 100) : 0,
        avgTime: Math.round(stats.totalTime / stats.total),
      }));

      // Hourly distribution
      const hourlyData = Array.from({ length: 24 }, (_, hour) => {
        const hourData = analyticsData.filter(a => 
          new Date(a.generated_at).getHours() === hour
        );
        return {
          hour: `${hour}:00`,
          count: hourData.length,
        };
      });

      return {
        totalResponses,
        avgResponseTime,
        avgTokens,
        openRate,
        replyRate,
        modelDistribution,
        dailyVolume: dailyData,
        performanceByModel: modelPerformance,
        hourlyDistribution: hourlyData,
      };
    },
    refetchInterval: 300000, // Refresh every 5 minutes
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Auto-Response Analytics</CardTitle>
          <CardDescription>Loading analytics data...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (!analytics || analytics.totalResponses === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Auto-Response Analytics
          </CardTitle>
          <CardDescription>No auto-response data available yet</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <Brain className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-sm text-muted-foreground">
              Analytics will appear here once you start using auto-responses
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Overview Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
              <Zap className="h-4 w-4" />
              Total Generated
            </div>
            <div className="text-3xl font-bold">{analytics.totalResponses}</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
              <Clock className="h-4 w-4" />
              Avg Response Time
            </div>
            <div className="text-3xl font-bold">{analytics.avgResponseTime}ms</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
              <Brain className="h-4 w-4" />
              Avg Tokens
            </div>
            <div className="text-3xl font-bold">{analytics.avgTokens}</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
              <Target className="h-4 w-4" />
              Open Rate
            </div>
            <div className="text-3xl font-bold">{analytics.openRate}%</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
              <TrendingUp className="h-4 w-4" />
              Reply Rate
            </div>
            <div className="text-3xl font-bold">{analytics.replyRate}%</div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Analytics */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Detailed Analytics
          </CardTitle>
          <CardDescription>Performance metrics and trends over time</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="volume" className="space-y-4">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="volume">Volume Trends</TabsTrigger>
              <TabsTrigger value="performance">Model Performance</TabsTrigger>
              <TabsTrigger value="distribution">Model Usage</TabsTrigger>
              <TabsTrigger value="timing">Time Distribution</TabsTrigger>
            </TabsList>

            <TabsContent value="volume" className="space-y-4">
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={analytics.dailyVolume}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="generated" stroke="#8b5cf6" name="Generated" />
                    <Line type="monotone" dataKey="sent" stroke="#06b6d4" name="Sent" />
                    <Line type="monotone" dataKey="opened" stroke="#10b981" name="Opened" />
                    <Line type="monotone" dataKey="replied" stroke="#f59e0b" name="Replied" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </TabsContent>

            <TabsContent value="performance" className="space-y-4">
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={analytics.performanceByModel}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="openRate" fill="#10b981" name="Open Rate %" />
                    <Bar dataKey="replyRate" fill="#8b5cf6" name="Reply Rate %" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </TabsContent>

            <TabsContent value="distribution" className="space-y-4">
              <div className="grid md:grid-cols-2 gap-6">
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={analytics.modelDistribution}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={(entry) => `${entry.name}: ${entry.value}`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {analytics.modelDistribution.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-3">
                  <h3 className="font-semibold">Model Usage Breakdown</h3>
                  {analytics.modelDistribution.map((model, index) => (
                    <div key={model.name} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-3 h-3 rounded-full" 
                          style={{ backgroundColor: COLORS[index % COLORS.length] }}
                        />
                        <span className="text-sm capitalize">{model.name}</span>
                      </div>
                      <Badge variant="secondary">{model.value} responses</Badge>
                    </div>
                  ))}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="timing" className="space-y-4">
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={analytics.hourlyDistribution}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="hour" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="count" fill="#8b5cf6" name="Auto-Responses" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <p className="text-sm text-muted-foreground text-center">
                Distribution of auto-responses by hour of the day
              </p>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}