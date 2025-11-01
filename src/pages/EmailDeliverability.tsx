import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertCircle, CheckCircle, XCircle, RefreshCw, TrendingUp, TrendingDown, Shield, Mail } from "lucide-react";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

interface DeliverabilityMetric {
  id: string;
  domain: string;
  checked_at: string;
  overall_score: number;
  sender_reputation: number;
  bounce_rate: number;
  hard_bounce_count: number;
  soft_bounce_count: number;
  total_sent: number;
  spam_complaint_rate: number;
  spam_complaint_count: number;
  spam_score: number;
  spf_valid: boolean;
  dkim_valid: boolean;
  dmarc_valid: boolean;
  mx_records_valid: boolean;
  blacklisted: boolean;
  blacklist_providers: string[];
  metadata?: any;
}

interface BounceEvent {
  id: string;
  recipient_email: string;
  bounce_type: string;
  bounce_reason: string;
  occurred_at: string;
}

const COLORS = ['#8b5cf6', '#ec4899', '#f59e0b', '#10b981'];

export default function EmailDeliverability() {
  const [metrics, setMetrics] = useState<DeliverabilityMetric[]>([]);
  const [bounceEvents, setBounceEvents] = useState<BounceEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Load deliverability metrics
      const { data: metricsData, error: metricsError } = await supabase
        .from('email_deliverability_metrics')
        .select('*')
        .order('checked_at', { ascending: false })
        .limit(30);

      if (metricsError) throw metricsError;
      setMetrics(metricsData || []);

      // Load bounce events
      const { data: bounceData, error: bounceError } = await supabase
        .from('email_bounce_events')
        .select('*')
        .order('occurred_at', { ascending: false })
        .limit(50);

      if (bounceError) throw bounceError;
      setBounceEvents(bounceData || []);
    } catch (error: any) {
      console.error('Error loading deliverability data:', error);
      toast({
        title: "Error",
        description: "Failed to load deliverability metrics",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const checkDeliverability = async () => {
    try {
      setChecking(true);
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Get user's email connection
      const { data: connection } = await supabase
        .from('crm_connections')
        .select('from_email')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .maybeSingle();

      if (!connection?.from_email) {
        toast({
          title: "No Email Connection",
          description: "Please connect an email account first",
          variant: "destructive",
        });
        return;
      }

      const domain = connection.from_email.split('@')[1];

      // Call edge function to check deliverability
      const { data, error } = await supabase.functions.invoke('check-email-deliverability', {
        body: { domain, email: connection.from_email },
      });

      if (error) throw error;

      toast({
        title: "Deliverability Check Complete",
        description: `Domain health score: ${data.overall_score}/100`,
      });

      await loadData();
    } catch (error: any) {
      console.error('Error checking deliverability:', error);
      toast({
        title: "Check Failed",
        description: error.message || "Failed to check deliverability",
        variant: "destructive",
      });
    } finally {
      setChecking(false);
    }
  };

  const latestMetric = metrics[0];
  
  const bounceByType = bounceEvents.reduce((acc, event) => {
    acc[event.bounce_type] = (acc[event.bounce_type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const bounceChartData = Object.entries(bounceByType).map(([type, count]) => ({
    name: type.charAt(0).toUpperCase() + type.slice(1),
    value: count,
  }));

  const trendData = metrics.slice(0, 7).reverse().map(m => ({
    date: new Date(m.checked_at).toLocaleDateString(),
    score: m.overall_score,
    bounceRate: m.bounce_rate,
    spamRate: m.spam_complaint_rate,
  }));

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-green-600";
    if (score >= 60) return "text-yellow-600";
    return "text-red-600";
  };

  const getScoreBadge = (score: number) => {
    if (score >= 80) return <Badge className="bg-green-500">Excellent</Badge>;
    if (score >= 60) return <Badge className="bg-yellow-500">Good</Badge>;
    return <Badge variant="destructive">Poor</Badge>;
  };

  const getProviderBadge = (provider?: string) => {
    if (!provider) return null;
    const colors: Record<string, string> = {
      'Gmail': 'bg-red-500',
      'Resend': 'bg-purple-500',
      'Outlook': 'bg-blue-500',
      'SendGrid': 'bg-cyan-500',
      'Mailgun': 'bg-orange-500',
    };
    return <Badge className={colors[provider] || 'bg-gray-500'}>{provider}</Badge>;
  };

  const getTimeSinceCheck = (timestamp: string) => {
    const now = new Date();
    const checked = new Date(timestamp);
    const diffMs = now.getTime() - checked.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold">Email Health</h1>
            {latestMetric?.metadata?.email_provider && getProviderBadge(latestMetric.metadata.email_provider)}
          </div>
          <p className="text-muted-foreground mt-1">
            Monitor your email health, bounce rates, and sender reputation
          </p>
          {latestMetric && (
            <p className="text-xs text-muted-foreground mt-1">
              Last checked: {getTimeSinceCheck(latestMetric.checked_at)} • 
              DNS records refresh on each check • 
              Metrics from sent emails update in real-time
            </p>
          )}
        </div>
        <Button onClick={checkDeliverability} disabled={checking}>
          <RefreshCw className={`h-4 w-4 mr-2 ${checking ? 'animate-spin' : ''}`} />
          {checking ? 'Checking...' : 'Check Now'}
        </Button>
      </div>

      {!latestMetric ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Shield className="h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold mb-2">No Deliverability Data</h3>
            <p className="text-muted-foreground text-center mb-4">
              Run your first deliverability check to monitor your email health
            </p>
            <Button onClick={checkDeliverability} disabled={checking}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Run Check
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Overview Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Overall Score</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div>
                    <div className={`text-3xl font-bold ${getScoreColor(latestMetric.overall_score)}`}>
                      {latestMetric.overall_score}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">out of 100</p>
                  </div>
                  {getScoreBadge(latestMetric.overall_score)}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  Bounce Rate
                  <Badge variant="outline" className="text-xs">Live</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-3xl font-bold">{latestMetric.bounce_rate.toFixed(2)}%</div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {latestMetric.hard_bounce_count + latestMetric.soft_bounce_count} bounces
                    </p>
                  </div>
                  {latestMetric.bounce_rate < 2 ? (
                    <CheckCircle className="h-8 w-8 text-green-500" />
                  ) : (
                    <AlertCircle className="h-8 w-8 text-yellow-500" />
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  Spam Complaints
                  <Badge variant="outline" className="text-xs">Live</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-3xl font-bold">{latestMetric.spam_complaint_rate.toFixed(2)}%</div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {latestMetric.spam_complaint_count} complaints
                    </p>
                  </div>
                  {latestMetric.spam_complaint_rate < 0.1 ? (
                    <CheckCircle className="h-8 w-8 text-green-500" />
                  ) : (
                    <XCircle className="h-8 w-8 text-red-500" />
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  Sender Reputation
                  <Badge variant="outline" className="text-xs">Live</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div>
                    <div className={`text-3xl font-bold ${getScoreColor(latestMetric.sender_reputation)}`}>
                      {latestMetric.sender_reputation}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">reputation score</p>
                  </div>
                  {latestMetric.sender_reputation >= 80 ? (
                    <TrendingUp className="h-8 w-8 text-green-500" />
                  ) : (
                    <TrendingDown className="h-8 w-8 text-red-500" />
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          <Tabs defaultValue="overview" className="space-y-4">
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="authentication">Authentication</TabsTrigger>
              <TabsTrigger value="bounces">Bounce Events</TabsTrigger>
              <TabsTrigger value="trends">Trends</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      Domain Health
                      <Badge variant="outline" className="text-xs">DNS Check</Badge>
                    </CardTitle>
                    <CardDescription>
                      Authentication records and configuration status (refreshes on manual check)
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">SPF Record</span>
                      {latestMetric.spf_valid ? (
                        <Badge className="bg-green-500">Valid</Badge>
                      ) : (
                        <Badge variant="destructive">Invalid</Badge>
                      )}
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">DKIM Record</span>
                      {latestMetric.dkim_valid ? (
                        <Badge className="bg-green-500">Valid</Badge>
                      ) : (
                        <Badge variant="destructive">Invalid</Badge>
                      )}
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">DMARC Record</span>
                      {latestMetric.dmarc_valid ? (
                        <Badge className="bg-green-500">Valid</Badge>
                      ) : (
                        <Badge variant="destructive">Invalid</Badge>
                      )}
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">MX Records</span>
                      {latestMetric.mx_records_valid ? (
                        <Badge className="bg-green-500">Valid</Badge>
                      ) : (
                        <Badge variant="destructive">Invalid</Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      Blacklist Status
                      <Badge variant="outline" className="text-xs">DNS Check</Badge>
                    </CardTitle>
                    <CardDescription>
                      Checked against common spam blacklists (refreshes on manual check)
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {latestMetric.blacklisted ? (
                      <div className="space-y-3">
                        <div className="flex items-center gap-2 text-red-600">
                          <XCircle className="h-5 w-5" />
                          <span className="font-semibold">Domain is Blacklisted</span>
                        </div>
                        {latestMetric.blacklist_providers && latestMetric.blacklist_providers.length > 0 && (
                          <div className="space-y-2">
                            <p className="text-sm text-muted-foreground">Found on:</p>
                            <div className="flex flex-wrap gap-2">
                              {latestMetric.blacklist_providers.map((provider, index) => (
                                <Badge key={index} variant="destructive">{provider}</Badge>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-green-600">
                        <CheckCircle className="h-5 w-5" />
                        <span className="font-semibold">Not Blacklisted</span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {bounceChartData.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Bounce Distribution</CardTitle>
                    <CardDescription>Breakdown of bounce types</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={bounceChartData}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={(entry: any) => `${entry.name} ${(entry.percent * 100).toFixed(0)}%`}
                          outerRadius={100}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {bounceChartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="authentication" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Email Authentication Setup</CardTitle>
                  <CardDescription>
                    Configure these DNS records to improve deliverability
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="font-semibold">SPF (Sender Policy Framework)</h4>
                      {latestMetric.spf_valid ? (
                        <CheckCircle className="h-5 w-5 text-green-500" />
                      ) : (
                        <XCircle className="h-5 w-5 text-red-500" />
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      SPF helps prevent email spoofing by specifying which mail servers can send email on behalf of your domain.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="font-semibold">DKIM (DomainKeys Identified Mail)</h4>
                      {latestMetric.dkim_valid ? (
                        <CheckCircle className="h-5 w-5 text-green-500" />
                      ) : (
                        <XCircle className="h-5 w-5 text-red-500" />
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      DKIM adds a digital signature to your emails, verifying they haven't been tampered with during transit.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="font-semibold">DMARC (Domain-based Message Authentication)</h4>
                      {latestMetric.dmarc_valid ? (
                        <CheckCircle className="h-5 w-5 text-green-500" />
                      ) : (
                        <XCircle className="h-5 w-5 text-red-500" />
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      DMARC builds on SPF and DKIM, telling receiving servers what to do with emails that fail authentication.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="bounces" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Recent Bounce Events</CardTitle>
                  <CardDescription>
                    Track emails that bounced or were marked as spam
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {bounceEvents.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Mail className="h-12 w-12 mx-auto mb-3 opacity-50" />
                      <p>No bounce events recorded</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {bounceEvents.slice(0, 10).map((event) => (
                        <div key={event.id} className="flex items-center justify-between p-3 border rounded-lg">
                          <div className="flex-1">
                            <div className="font-medium">{event.recipient_email}</div>
                            <div className="text-sm text-muted-foreground">{event.bounce_reason || 'No reason provided'}</div>
                            <div className="text-xs text-muted-foreground mt-1">
                              {new Date(event.occurred_at).toLocaleString()}
                            </div>
                          </div>
                          <Badge variant={event.bounce_type === 'hard' ? 'destructive' : 'secondary'}>
                            {event.bounce_type}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="trends" className="space-y-4">
              {trendData.length > 1 && (
                <>
                  <Card>
                    <CardHeader>
                      <CardTitle>Overall Score Trend</CardTitle>
                      <CardDescription>Track your deliverability score over time</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={300}>
                        <LineChart data={trendData}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="date" />
                          <YAxis domain={[0, 100]} />
                          <Tooltip />
                          <Legend />
                          <Line type="monotone" dataKey="score" stroke="#8b5cf6" strokeWidth={2} name="Overall Score" />
                        </LineChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Bounce & Spam Rates</CardTitle>
                      <CardDescription>Monitor bounce and spam complaint trends</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={trendData}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="date" />
                          <YAxis />
                          <Tooltip />
                          <Legend />
                          <Bar dataKey="bounceRate" fill="#f59e0b" name="Bounce Rate %" />
                          <Bar dataKey="spamRate" fill="#ef4444" name="Spam Rate %" />
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                </>
              )}
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}