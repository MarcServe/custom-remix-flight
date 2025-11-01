import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Play, Pause, Trophy, TrendingUp, Mail, Clock } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

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

export default function ABTesting() {
  const [tests, setTests] = useState<ABTest[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { toast } = useToast();

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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">A/B Testing</h1>
          <p className="text-muted-foreground mt-1">
            Test different variations to optimize your email performance
          </p>
        </div>
        <Button onClick={() => { resetForm(); setIsDialogOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" />
          New Test
        </Button>
      </div>

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
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <div className="flex items-center justify-between mb-2">
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
                    <Badge className={getStatusColor(test.status)}>Completed</Badge>
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
                    </div>
                  </div>
                </CardHeader>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create A/B Test</DialogTitle>
            <DialogDescription>
              Test different variations to see what works best
            </DialogDescription>
          </DialogHeader>

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