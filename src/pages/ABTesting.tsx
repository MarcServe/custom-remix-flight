import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Play, Pause, Trophy, TrendingUp, Mail, Clock, Send, FlaskConical, ExternalLink, FileText, Trash2, CalendarClock } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

export interface ABTestingProps {
  /** Open the Send Bulk Email dialog so user can run a body A/B test from the compose form */
  onOpenBulkEmailForAbTest?: () => void;
  /** Switch to Campaigns overview and select this campaign to show A/B results in the detail panel */
  onSelectCampaignAndShowOverview?: (campaignId: string) => void;
}

interface ABTest {
  id: string;
  name: string;
  description: string;
  status: string;
  test_type: string;
  traffic_split: any;
  variant_a: any;
  variant_b: any;
  variant_c?: any;
  min_sample_size: number;
  confidence_level: number;
  started_at?: string;
  completed_at?: string;
  winning_variant?: string;
  auto_select_winner: boolean;
  winner_metric: string;
  results: any;
  metadata: any;
  created_at: string;
}

export default function ABTesting({ onOpenBulkEmailForAbTest, onSelectCampaignAndShowOverview }: ABTestingProps = {}) {
  const [tests, setTests] = useState<ABTest[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [testToDeleteId, setTestToDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [scheduleCampaignId, setScheduleCampaignId] = useState<string>("");
  const [scheduleAction, setScheduleAction] = useState<"swap" | "resend_a" | "resend_b" | "resend_all">("swap");
  const [scheduleAt, setScheduleAt] = useState("");
  const [scheduling, setScheduling] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Campaigns that have body A/B test enabled (from Send Bulk Email flow)
  const { data: campaignAbTests = [] } = useQuery({
    queryKey: ['campaigns-ab-tests'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      const { data, error } = await supabase
        .from('email_campaigns')
        .select('id, name, status, created_at, total_recipients, sent_count, opened_count, ab_test_enabled, ab_winner_metric')
        .eq('user_id', user.id)
        .eq('ab_test_enabled', true)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  // Scheduled Resend/Swap actions (for Schedule tab)
  const { data: scheduledActions = [] } = useQuery({
    queryKey: ["scheduled-campaign-actions"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      const { data, error } = await (supabase as any)
        .from("scheduled_campaign_actions")
        .select("id, campaign_id, action, scheduled_at, status, created_at")
        .eq("user_id", user.id)
        .order("scheduled_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as { id: string; campaign_id: string; action: string; scheduled_at: string; status: string; created_at: string }[];
    },
  });

  const pendingScheduled = scheduledActions.filter((s) => s.status === "pending");

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    test_type: 'subject_line' as const,
    winner_metric: 'open_rate' as const,
    min_sample_size: 100,
    confidence_level: 0.95,
    auto_select_winner: true,
    variant_a: { subject: '', content: '' },
    variant_b: { subject: '', content: '' },
    traffic_split: { variant_a: 50, variant_b: 50 },
  });

  useEffect(() => {
    loadTests();
  }, []);

  const loadTests = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('email_ab_tests')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTests(data || []);
    } catch (error: any) {
      console.error('Error loading A/B tests:', error);
      toast({
        title: "Error",
        description: "Failed to load A/B tests",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTest = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('email_ab_tests')
        .insert({
          user_id: user.id,
          name: formData.name,
          description: formData.description,
          test_type: formData.test_type,
          winner_metric: formData.winner_metric,
          min_sample_size: formData.min_sample_size,
          confidence_level: formData.confidence_level,
          auto_select_winner: formData.auto_select_winner,
          variant_a: formData.variant_a,
          variant_b: formData.variant_b,
          traffic_split: formData.traffic_split,
          status: 'draft',
        });

      if (error) throw error;

      toast({ title: "A/B test created successfully" });
      setIsDialogOpen(false);
      resetForm();
      await loadTests();
    } catch (error: any) {
      console.error('Error creating test:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to create test",
        variant: "destructive",
      });
    }
  };

  const startTest = async (testId: string) => {
    try {
      const { error } = await supabase
        .from('email_ab_tests')
        .update({
          status: 'active',
          started_at: new Date().toISOString(),
        })
        .eq('id', testId);

      if (error) throw error;
      
      toast({ title: "A/B test started" });
      await loadTests();
    } catch (error: any) {
      console.error('Error starting test:', error);
      toast({
        title: "Error",
        description: "Failed to start test",
        variant: "destructive",
      });
    }
  };

  const pauseTest = async (testId: string) => {
    try {
      const { error } = await supabase
        .from('email_ab_tests')
        .update({ status: 'paused' })
        .eq('id', testId);

      if (error) throw error;
      
      toast({ title: "A/B test paused" });
      await loadTests();
    } catch (error: any) {
      console.error('Error pausing test:', error);
      toast({
        title: "Error",
        description: "Failed to pause test",
        variant: "destructive",
      });
    }
  };

  const deleteTest = async (testId: string) => {
    try {
      setDeleting(true);
      const { error } = await supabase
        .from('email_ab_tests')
        .delete()
        .eq('id', testId);

      if (error) throw error;
      toast({ title: "A/B test deleted" });
      setTestToDeleteId(null);
      await loadTests();
    } catch (error: any) {
      console.error('Error deleting test:', error);
      toast({
        title: "Error",
        description: error?.message || "Failed to delete test",
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      test_type: 'subject_line',
      winner_metric: 'open_rate',
      min_sample_size: 100,
      confidence_level: 0.95,
      auto_select_winner: true,
      variant_a: { subject: '', content: '' },
      variant_b: { subject: '', content: '' },
      traffic_split: { variant_a: 50, variant_b: 50 },
    });
  };

  const getTestTypeIcon = (type: string) => {
    switch (type) {
      case 'subject_line': return <Mail className="h-4 w-4" />;
      case 'content': return <Mail className="h-4 w-4" />;
      case 'send_time': return <Clock className="h-4 w-4" />;
      default: return <Mail className="h-4 w-4" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-500';
      case 'completed': return 'bg-blue-500';
      case 'paused': return 'bg-yellow-500';
      default: return 'bg-gray-500';
    }
  };

  const calculateProgress = (test: ABTest) => {
    if (!test.results || !test.min_sample_size) return 0;
    const totalSent = (test.results.variant_a?.sent || 0) + (test.results.variant_b?.sent || 0);
    return Math.min((totalSent / test.min_sample_size) * 100, 100);
  };

  const getWinnerBadge = (test: ABTest) => {
    if (!test.winning_variant) return null;
    
    return (
      <div className="flex items-center gap-2">
        <Trophy className="h-4 w-4 text-yellow-500" />
        <span className="font-semibold">
          {test.winning_variant === 'variant_a' ? 'Variant A' : 'Variant B'} is winning
        </span>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">A/B Testing</h1>
          <p className="text-muted-foreground mt-1">
            Test different variations to optimize your email performance
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {onOpenBulkEmailForAbTest && (
            <Button onClick={onOpenBulkEmailForAbTest} className="gap-2">
              <Send className="h-4 w-4" />
              Run body A/B test
            </Button>
          )}
          <Button variant={onOpenBulkEmailForAbTest ? "outline" : "default"} onClick={() => { resetForm(); setIsDialogOpen(true); }} className="gap-2">
            <Plus className="h-4 w-4" />
            New subject-line test
          </Button>
        </div>
      </div>

      {/* Campaign body A/B tests + Schedule Resend/Swap */}
      {(onOpenBulkEmailForAbTest != null || campaignAbTests.length > 0) && (
        <Tabs defaultValue="body" className="space-y-4">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="body" className="gap-2">
              <FlaskConical className="h-4 w-4" />
              Body A/B tests
            </TabsTrigger>
            <TabsTrigger value="schedule" className="gap-2">
              <CalendarClock className="h-4 w-4" />
              Schedule
              {pendingScheduled.length > 0 && (
                <Badge variant="secondary" className="ml-1">{pendingScheduled.length}</Badge>
              )}
            </TabsTrigger>
          </TabsList>
          <TabsContent value="body" className="space-y-4 mt-0">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <FlaskConical className="h-5 w-5 text-primary" />
                  <CardTitle>Campaign body A/B tests</CardTitle>
                </div>
                <CardDescription>
                  Run body A/B tests from Send Bulk Email: add recipients, compose your main email, then enable &quot;A/B test (body)&quot; and add Variant B. Results (open rate, click rate by variant) appear on the campaign when you select it in All Campaigns.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {onOpenBulkEmailForAbTest && (
                  <Button onClick={onOpenBulkEmailForAbTest} variant="secondary" className="gap-2">
                    <FileText className="h-4 w-4" />
                    Open Send Bulk Email to run a body A/B test
                  </Button>
                )}
                {campaignAbTests.length > 0 ? (
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-muted-foreground">Campaigns with body A/B test</p>
                    <ul className="space-y-2">
                      {campaignAbTests.map((c: any) => (
                        <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3">
                          <div>
                            <span className="font-medium">{c.name}</span>
                            <span className="ml-2 text-xs text-muted-foreground">
                              {c.sent_count ?? 0} sent · {c.opened_count ?? 0} opened · winner by {c.ab_winner_metric ?? 'open_rate'}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant={c.status === 'completed' ? 'default' : 'secondary'}>{c.status}</Badge>
                            {onSelectCampaignAndShowOverview && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => onSelectCampaignAndShowOverview(c.id)}
                                className="gap-1"
                              >
                                <ExternalLink className="h-3 w-3" />
                                View results
                              </Button>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No campaigns with body A/B test yet. Use &quot;Run body A/B test&quot; or Send Bulk Email and enable A/B test (body) when composing.</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="schedule" className="space-y-4 mt-0">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <CalendarClock className="h-5 w-5 text-primary" />
                  <CardTitle>Schedule Resend / Swap</CardTitle>
                </div>
                <CardDescription>
                  Schedule a Resend or Swap A/B action for a campaign. The action will run at the chosen date and time (processed by the system cron).
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Campaign</Label>
                    <Select value={scheduleCampaignId} onValueChange={setScheduleCampaignId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select campaign" />
                      </SelectTrigger>
                      <SelectContent>
                        {campaignAbTests.filter((c: any) => (c.sent_count ?? 0) > 0).map((c: any) => (
                          <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Action</Label>
                    <Select value={scheduleAction} onValueChange={(v: "swap" | "resend_a" | "resend_b" | "resend_all") => setScheduleAction(v)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="swap">Swap and resend (A→B, B→A)</SelectItem>
                        <SelectItem value="resend_a">Resend to Variant A recipients</SelectItem>
                        <SelectItem value="resend_b">Resend to Variant B recipients</SelectItem>
                        <SelectItem value="resend_all">Resend to all</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Date & time</Label>
                  <Input
                    type="datetime-local"
                    value={scheduleAt}
                    onChange={(e) => setScheduleAt(e.target.value)}
                    min={new Date().toISOString().slice(0, 16)}
                  />
                </div>
                <Button
                  disabled={!scheduleCampaignId || !scheduleAt || scheduling}
                  onClick={async () => {
                    const { data: { user } } = await supabase.auth.getUser();
                    if (!user) return;
                    setScheduling(true);
                    try {
                      const { error } = await (supabase as any).from("scheduled_campaign_actions").insert({
                        campaign_id: scheduleCampaignId,
                        user_id: user.id,
                        action: scheduleAction,
                        scheduled_at: new Date(scheduleAt).toISOString(),
                        status: "pending",
                      });
                      if (error) throw error;
                      toast({ title: "Scheduled", description: `${scheduleAction === "swap" ? "Swap and resend" : `Resend ${scheduleAction.replace("resend_", "").toUpperCase()}`} scheduled for ${new Date(scheduleAt).toLocaleString()}.` });
                      setScheduleAt("");
                      queryClient.invalidateQueries({ queryKey: ["scheduled-campaign-actions"] });
                    } catch (e: any) {
                      toast({ title: "Error", description: e?.message ?? "Failed to schedule", variant: "destructive" });
                    } finally {
                      setScheduling(false);
                    }
                  }}
                >
                  {scheduling ? "Scheduling…" : "Schedule"}
                </Button>
                {pendingScheduled.length > 0 && (
                  <div className="space-y-2 pt-4 border-t">
                    <p className="text-sm font-medium">Upcoming scheduled</p>
                    <ul className="space-y-2">
                      {pendingScheduled.map((s) => (
                        <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm">
                          <span>
                            {campaignAbTests.find((c: any) => c.id === s.campaign_id)?.name ?? "Campaign"} · {s.action === "swap" ? "Swap and resend" : `Resend ${s.action.replace("resend_", "").toUpperCase()}`} at {new Date(s.scheduled_at).toLocaleString()}
                          </span>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            disabled={cancellingId === s.id}
                            onClick={async () => {
                              setCancellingId(s.id);
                              try {
                                await (supabase as any).from("scheduled_campaign_actions").update({ status: "cancelled" }).eq("id", s.id);
                                queryClient.invalidateQueries({ queryKey: ["scheduled-campaign-actions"] });
                                toast({ title: "Cancelled", description: "Scheduled action cancelled." });
                              } finally {
                                setCancellingId(null);
                              }
                            }}
                          >
                            Cancel
                          </Button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}

      <div className="flex items-center gap-2 pt-2">
        <Mail className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-lg font-semibold">Subject line tests</h2>
      </div>
      <p className="text-sm text-muted-foreground -mt-2">
        Standalone subject-line (or content) tests. For body tests with real campaigns, use the Campaign body A/B section above.
      </p>

      <Tabs defaultValue="active" className="space-y-4">
        <TabsList>
          <TabsTrigger value="active">
            Active ({tests.filter(t => t.status === 'active').length})
          </TabsTrigger>
          <TabsTrigger value="completed">
            Completed ({tests.filter(t => t.status === 'completed').length})
          </TabsTrigger>
          <TabsTrigger value="all">All Tests ({tests.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="space-y-4">
          {tests.filter(t => t.status === 'active').length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <TrendingUp className="h-16 w-16 text-muted-foreground mb-4 opacity-50" />
                <h3 className="text-xl font-semibold mb-2">No Active Tests</h3>
                <p className="text-muted-foreground text-center mb-4">
                  Create your first A/B test to start optimizing your emails
                </p>
                <Button onClick={() => { resetForm(); setIsDialogOpen(true); }}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Test
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {tests.filter(t => t.status === 'active').map((test) => (
                <Card key={test.id}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${getStatusColor(test.status)}`}>
                          {getTestTypeIcon(test.test_type)}
                        </div>
                        <div>
                          <CardTitle>{test.name}</CardTitle>
                          <CardDescription>{test.description}</CardDescription>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className={getStatusColor(test.status)}>
                          {test.status}
                        </Badge>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => pauseTest(test.id)}
                        >
                          <Pause className="h-4 w-4 mr-2" />
                          Pause
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-muted-foreground hover:text-destructive"
                          onClick={() => setTestToDeleteId(test.id)}
                          title="Delete test"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-2">
                        <span className="text-sm text-muted-foreground">Progress</span>
                        <span className="text-sm font-medium">
                          {calculateProgress(test).toFixed(0)}%
                        </span>
                      </div>
                      <Progress value={calculateProgress(test)} />
                    </div>

                    {getWinnerBadge(test)}

                    {test.results && (
                      <div className="grid grid-cols-2 gap-4">
                        <Card>
                          <CardHeader className="pb-3">
                            <CardTitle className="text-sm">Variant A</CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-2">
                            <div className="flex justify-between text-sm">
                              <span className="text-muted-foreground">Sent:</span>
                              <span className="font-medium">{test.results.variant_a?.sent || 0}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span className="text-muted-foreground">Opens:</span>
                              <span className="font-medium">{test.results.variant_a?.opens || 0}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span className="text-muted-foreground">Open Rate:</span>
                              <span className="font-medium">
                                {test.results.variant_a?.open_rate?.toFixed(1) || 0}%
                              </span>
                            </div>
                          </CardContent>
                        </Card>

                        <Card>
                          <CardHeader className="pb-3">
                            <CardTitle className="text-sm">Variant B</CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-2">
                            <div className="flex justify-between text-sm">
                              <span className="text-muted-foreground">Sent:</span>
                              <span className="font-medium">{test.results.variant_b?.sent || 0}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span className="text-muted-foreground">Opens:</span>
                              <span className="font-medium">{test.results.variant_b?.opens || 0}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span className="text-muted-foreground">Open Rate:</span>
                              <span className="font-medium">
                                {test.results.variant_b?.open_rate?.toFixed(1) || 0}%
                              </span>
                            </div>
                          </CardContent>
                        </Card>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="completed" className="space-y-4">
          <div className="grid gap-4">
            {tests.filter(t => t.status === 'completed').map((test) => (
              <Card key={test.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${getStatusColor(test.status)}`}>
                        {getTestTypeIcon(test.test_type)}
                      </div>
                      <div>
                        <CardTitle>{test.name}</CardTitle>
                        <CardDescription>{test.description}</CardDescription>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={getStatusColor(test.status)}>Completed</Badge>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-muted-foreground hover:text-destructive"
                        onClick={() => setTestToDeleteId(test.id)}
                        title="Delete test"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {getWinnerBadge(test)}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="all" className="space-y-4">
          <div className="grid gap-4">
            {tests.map((test) => (
              <Card key={test.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${getStatusColor(test.status)}`}>
                        {getTestTypeIcon(test.test_type)}
                      </div>
                      <div>
                        <CardTitle>{test.name}</CardTitle>
                        <CardDescription>{test.description}</CardDescription>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={getStatusColor(test.status)}>{test.status}</Badge>
                      {test.status === 'draft' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => startTest(test.id)}
                        >
                          <Play className="h-4 w-4 mr-2" />
                          Start
                        </Button>
                      )}
                      {test.status === 'active' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => pauseTest(test.id)}
                        >
                          <Pause className="h-4 w-4 mr-2" />
                          Pause
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-muted-foreground hover:text-destructive"
                        onClick={() => setTestToDeleteId(test.id)}
                        title="Delete test"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      <AlertDialog open={!!testToDeleteId} onOpenChange={(open) => !open && setTestToDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete A/B test?</AlertDialogTitle>
            <AlertDialogDescription>
              This subject-line test will be permanently removed. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => testToDeleteId && deleteTest(testToDeleteId)}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create subject-line A/B test</DialogTitle>
            <DialogDescription>
              Test subject lines (or content) as a standalone test. To A/B test email bodies with a real campaign and see open/click results per variant, use &quot;Run body A/B test&quot; on this page and enable A/B test (body) in Send Bulk Email.
            </DialogDescription>
          </DialogHeader>
          {onOpenBulkEmailForAbTest && (
            <Button type="button" variant="outline" className="w-full gap-2" onClick={() => { setIsDialogOpen(false); onOpenBulkEmailForAbTest(); }}>
              <Send className="h-4 w-4" />
              Switch to body A/B test (Send Bulk Email)
            </Button>
          )}

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Test Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Subject Line Test - April Campaign"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Describe what you're testing"
                rows={2}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="test_type">Test Type</Label>
                <Select
                  value={formData.test_type}
                  onValueChange={(value: any) => setFormData({ ...formData, test_type: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="subject_line">Subject Line</SelectItem>
                    <SelectItem value="content">Email Content</SelectItem>
                    <SelectItem value="send_time">Send Time</SelectItem>
                    <SelectItem value="sender_name">Sender Name</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="winner_metric">Winner Metric</Label>
                <Select
                  value={formData.winner_metric}
                  onValueChange={(value: any) => setFormData({ ...formData, winner_metric: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="open_rate">Open Rate</SelectItem>
                    <SelectItem value="click_rate">Click Rate</SelectItem>
                    <SelectItem value="reply_rate">Reply Rate</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="font-semibold">Variant A</h4>
              <div className="space-y-2">
                <Label>Subject Line</Label>
                <Input
                  value={formData.variant_a.subject}
                  onChange={(e) => setFormData({
                    ...formData,
                    variant_a: { ...formData.variant_a, subject: e.target.value }
                  })}
                  placeholder="Enter subject line for variant A"
                />
              </div>

              <h4 className="font-semibold">Variant B</h4>
              <div className="space-y-2">
                <Label>Subject Line</Label>
                <Input
                  value={formData.variant_b.subject}
                  onChange={(e) => setFormData({
                    ...formData,
                    variant_b: { ...formData.variant_b, subject: e.target.value }
                  })}
                  placeholder="Enter subject line for variant B"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="min_sample">Minimum Sample Size</Label>
              <Input
                id="min_sample"
                type="number"
                value={formData.min_sample_size}
                onChange={(e) => setFormData({ ...formData, min_sample_size: parseInt(e.target.value) })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setIsDialogOpen(false); resetForm(); }}>
              Cancel
            </Button>
            <Button onClick={handleCreateTest} disabled={!formData.name || !formData.variant_a.subject || !formData.variant_b.subject}>
              Create Test
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}