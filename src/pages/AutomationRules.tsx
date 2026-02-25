import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Clock, Zap, Play, Pause, Trash2, Edit, TrendingUp } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

interface AutomationRule {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  priority: number;
  rule_type: string;
  conditions: any;
  actions: any;
  send_time_preference: string;
  specific_time: string;
  specific_days: number[];
  timezone: string;
  max_sends_per_day: number;
  min_time_between_sends_hours: number;
  metadata: any;
  created_at: string;
}

interface RuleExecution {
  id: string;
  executed_at: string;
  success: boolean;
  action_taken: string;
  error_message?: string;
}

export default function AutomationRules() {
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [executions, setExecutions] = useState<RuleExecution[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<AutomationRule | null>(null);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    rule_type: 'time_based' as 'time_based' | 'behavior_based' | 'conditional' | 'sequential',
    send_time_preference: 'optimal' as 'optimal' | 'specific' | 'recipient_timezone',
    specific_time: '09:00',
    specific_days: [1, 2, 3, 4, 5],
    timezone: 'UTC',
    max_sends_per_day: 10,
    min_time_between_sends_hours: 24,
    conditions: [] as any[],
    actions: [] as any[],
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Load automation rules
      const { data: rulesData, error: rulesError } = await supabase
        .from('automation_rules')
        .select('*')
        .order('priority', { ascending: false });

      if (rulesError) throw rulesError;
      setRules(rulesData || []);

      // Load recent executions
      const { data: executionsData, error: executionsError } = await supabase
        .from('automation_rule_executions')
        .select('*')
        .order('executed_at', { ascending: false })
        .limit(50);

      if (executionsError) throw executionsError;
      setExecutions(executionsData || []);
    } catch (error: any) {
      console.error('Error loading automation data:', error);
      toast({
        title: "Error",
        description: "Failed to load automation rules",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveRule = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const ruleData = {
        user_id: user.id,
        name: formData.name,
        description: formData.description,
        rule_type: formData.rule_type,
        send_time_preference: formData.send_time_preference,
        specific_time: formData.specific_time,
        specific_days: formData.specific_days,
        timezone: formData.timezone,
        max_sends_per_day: formData.max_sends_per_day,
        min_time_between_sends_hours: formData.min_time_between_sends_hours,
        conditions: formData.conditions,
        actions: formData.actions,
        enabled: true,
      };

      if (editingRule) {
        const { error } = await supabase
          .from('automation_rules')
          .update(ruleData)
          .eq('id', editingRule.id);

        if (error) throw error;
        toast({ title: "Rule updated successfully" });
      } else {
        const { error } = await supabase
          .from('automation_rules')
          .insert(ruleData);

        if (error) throw error;
        toast({ title: "Rule created successfully" });
      }

      setIsDialogOpen(false);
      resetForm();
      await loadData();
    } catch (error: any) {
      console.error('Error saving rule:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to save rule",
        variant: "destructive",
      });
    }
  };

  const toggleRule = async (ruleId: string, enabled: boolean) => {
    try {
      const { error } = await supabase
        .from('automation_rules')
        .update({ enabled: !enabled })
        .eq('id', ruleId);

      if (error) throw error;
      
      toast({
        title: !enabled ? "Rule enabled" : "Rule disabled",
        description: !enabled ? "Automation rule is now active" : "Automation rule is now paused",
      });
      
      await loadData();
    } catch (error: any) {
      console.error('Error toggling rule:', error);
      toast({
        title: "Error",
        description: "Failed to toggle rule",
        variant: "destructive",
      });
    }
  };

  const deleteRule = async (ruleId: string) => {
    if (!confirm('Are you sure you want to delete this automation rule?')) return;

    try {
      const { error } = await supabase
        .from('automation_rules')
        .delete()
        .eq('id', ruleId);

      if (error) throw error;
      
      toast({ title: "Rule deleted successfully" });
      await loadData();
    } catch (error: any) {
      console.error('Error deleting rule:', error);
      toast({
        title: "Error",
        description: "Failed to delete rule",
        variant: "destructive",
      });
    }
  };

  const openEditDialog = (rule: AutomationRule) => {
    setEditingRule(rule);
    setFormData({
      name: rule.name,
      description: rule.description || '',
      rule_type: rule.rule_type as any,
      send_time_preference: rule.send_time_preference as any,
      specific_time: rule.specific_time || '09:00',
      specific_days: rule.specific_days || [1, 2, 3, 4, 5],
      timezone: rule.timezone || 'UTC',
      max_sends_per_day: rule.max_sends_per_day || 10,
      min_time_between_sends_hours: rule.min_time_between_sends_hours || 24,
      conditions: rule.conditions || [],
      actions: rule.actions || [],
    });
    setIsDialogOpen(true);
  };

  const resetForm = () => {
    setEditingRule(null);
    setFormData({
      name: '',
      description: '',
      rule_type: 'time_based' as 'time_based' | 'behavior_based' | 'conditional' | 'sequential',
      send_time_preference: 'optimal' as 'optimal' | 'specific' | 'recipient_timezone',
      specific_time: '09:00',
      specific_days: [1, 2, 3, 4, 5],
      timezone: 'UTC',
      max_sends_per_day: 10,
      min_time_between_sends_hours: 24,
      conditions: [],
      actions: [],
    });
  };

  const getRuleTypeIcon = (type: string) => {
    switch (type) {
      case 'time_based': return <Clock className="h-4 w-4" />;
      case 'behavior_based': return <TrendingUp className="h-4 w-4" />;
      case 'conditional': return <Zap className="h-4 w-4" />;
      default: return <Zap className="h-4 w-4" />;
    }
  };

  const getRuleTypeBadgeColor = (type: string) => {
    switch (type) {
      case 'time_based': return 'bg-blue-500';
      case 'behavior_based': return 'bg-green-500';
      case 'conditional': return 'bg-purple-500';
      default: return 'bg-gray-500';
    }
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
          <h1 className="text-3xl font-bold">Automation Rules</h1>
          <p className="text-muted-foreground mt-1">
            Create advanced automation with time-based triggers and conditional logic
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Rules are saved to the backend and applied (e.g. sequence follow-up timing and send windows).
          </p>
        </div>
        <Button onClick={() => { resetForm(); setIsDialogOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" />
          New Rule
        </Button>
      </div>

      <Tabs defaultValue="rules" className="space-y-4">
        <TabsList>
          <TabsTrigger value="rules">Active Rules ({rules.filter(r => r.enabled).length})</TabsTrigger>
          <TabsTrigger value="all">All Rules ({rules.length})</TabsTrigger>
          <TabsTrigger value="executions">Execution Log</TabsTrigger>
        </TabsList>

        <TabsContent value="rules" className="space-y-4">
          {rules.filter(r => r.enabled).length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Zap className="h-16 w-16 text-muted-foreground mb-4 opacity-50" />
                <h3 className="text-xl font-semibold mb-2">No Active Rules</h3>
                <p className="text-muted-foreground text-center mb-4">
                  Create your first automation rule to start optimizing your email campaigns
                </p>
                <Button onClick={() => { resetForm(); setIsDialogOpen(true); }}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Rule
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {rules.filter(r => r.enabled).map((rule) => (
                <Card key={rule.id}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${getRuleTypeBadgeColor(rule.rule_type)}`}>
                          {getRuleTypeIcon(rule.rule_type)}
                        </div>
                        <div>
                          <CardTitle>{rule.name}</CardTitle>
                          <CardDescription>{rule.description}</CardDescription>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={rule.enabled}
                          onCheckedChange={() => toggleRule(rule.id, rule.enabled)}
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditDialog(rule)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteRule(rule.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Type</p>
                        <Badge className={getRuleTypeBadgeColor(rule.rule_type)}>
                          {rule.rule_type.replace('_', ' ')}
                        </Badge>
                      </div>
                      {rule.send_time_preference && (
                        <div>
                          <p className="text-muted-foreground">Send Time</p>
                          <p className="font-medium">{rule.send_time_preference}</p>
                        </div>
                      )}
                      {rule.max_sends_per_day && (
                        <div>
                          <p className="text-muted-foreground">Daily Limit</p>
                          <p className="font-medium">{rule.max_sends_per_day} sends/day</p>
                        </div>
                      )}
                      <div>
                        <p className="text-muted-foreground">Priority</p>
                        <p className="font-medium">{rule.priority}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="all" className="space-y-4">
          <div className="grid gap-4">
            {rules.map((rule) => (
              <Card key={rule.id} className={!rule.enabled ? 'opacity-60' : ''}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${getRuleTypeBadgeColor(rule.rule_type)}`}>
                        {getRuleTypeIcon(rule.rule_type)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <CardTitle>{rule.name}</CardTitle>
                          {!rule.enabled && <Badge variant="secondary">Disabled</Badge>}
                        </div>
                        <CardDescription>{rule.description}</CardDescription>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={rule.enabled}
                        onCheckedChange={() => toggleRule(rule.id, rule.enabled)}
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEditDialog(rule)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteRule(rule.id)}
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

        <TabsContent value="executions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Executions</CardTitle>
              <CardDescription>View automation rule execution history</CardDescription>
            </CardHeader>
            <CardContent>
              {executions.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No execution history yet
                </div>
              ) : (
                <div className="space-y-3">
                  {executions.map((execution) => (
                    <div
                      key={execution.id}
                      className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between p-3 border rounded-lg"
                    >
                      <div>
                        <div className="font-medium">{execution.action_taken || 'No action'}</div>
                        <div className="text-sm text-muted-foreground">
                          {new Date(execution.executed_at).toLocaleString()}
                        </div>
                        {execution.error_message && (
                          <div className="text-sm text-red-600 mt-1">{execution.error_message}</div>
                        )}
                      </div>
                      <Badge variant={execution.success ? 'default' : 'destructive'}>
                        {execution.success ? 'Success' : 'Failed'}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingRule ? 'Edit' : 'Create'} Automation Rule</DialogTitle>
            <DialogDescription>
              Configure advanced automation rules for your email campaigns
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Rule Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Optimal Send Time"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Describe what this rule does"
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="rule_type">Rule Type</Label>
              <Select
                value={formData.rule_type}
                onValueChange={(value: any) => setFormData({ ...formData, rule_type: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="time_based">Time-Based</SelectItem>
                  <SelectItem value="behavior_based">Behavior-Based</SelectItem>
                  <SelectItem value="conditional">Conditional</SelectItem>
                  <SelectItem value="sequential">Sequential</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {formData.rule_type === 'time_based' && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="send_time_preference">Send Time Preference</Label>
                  <Select
                    value={formData.send_time_preference}
                    onValueChange={(value: any) => setFormData({ ...formData, send_time_preference: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="optimal">Optimal (AI-determined)</SelectItem>
                      <SelectItem value="specific">Specific Time</SelectItem>
                      <SelectItem value="recipient_timezone">Recipient's Timezone</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {formData.send_time_preference === 'specific' && (
                  <div className="space-y-2">
                    <Label htmlFor="specific_time">Specific Time</Label>
                    <Input
                      id="specific_time"
                      type="time"
                      value={formData.specific_time}
                      onChange={(e) => setFormData({ ...formData, specific_time: e.target.value })}
                    />
                  </div>
                )}
              </>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="max_sends">Max Sends Per Day</Label>
                <Input
                  id="max_sends"
                  type="number"
                  value={formData.max_sends_per_day}
                  onChange={(e) => setFormData({ ...formData, max_sends_per_day: parseInt(e.target.value) })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="min_time">Min Hours Between Sends</Label>
                <Input
                  id="min_time"
                  type="number"
                  value={formData.min_time_between_sends_hours}
                  onChange={(e) => setFormData({ ...formData, min_time_between_sends_hours: parseInt(e.target.value) })}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setIsDialogOpen(false); resetForm(); }}>
              Cancel
            </Button>
            <Button onClick={handleSaveRule} disabled={!formData.name}>
              {editingRule ? 'Update' : 'Create'} Rule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}