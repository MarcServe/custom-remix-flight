import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Settings, Clock, Bot, Save, AlertCircle, Mail } from "lucide-react";
import { useUpdateSequenceSettings } from "@/hooks/use-company-sequences";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface AutomationRule {
  type: string;
  action: string;
  wait_hours: number;
}

interface StepRule {
  enabled: boolean;
  type: 'wait_for_open' | 'wait_for_click' | 'time_based' | 'none';
  wait_hours: number;
}

interface AutomationRules {
  enabled: boolean;
  rules: AutomationRule[];
  step_rules?: Record<string, StepRule>;
}

interface SequenceStep {
  subject: string;
  body: string;
  delay_days?: number;
}

interface SequenceSettingsCardProps {
  sequenceId: string;
  autoRespondEnabled: boolean;
  automationRules: AutomationRules;
  steps?: SequenceStep[];
}

export function SequenceSettingsCard({
  sequenceId,
  autoRespondEnabled: initialAutoRespond,
  automationRules: initialRules,
  steps = [],
}: SequenceSettingsCardProps) {
  const [autoRespondEnabled, setAutoRespondEnabled] = useState(initialAutoRespond);
  const [automationEnabled, setAutomationEnabled] = useState(initialRules.enabled);
  const [rules, setRules] = useState<AutomationRule[]>(initialRules.rules);
  
  // Initialize step rules
  const initStepRules = (): Record<string, StepRule> => {
    const stepRules: Record<string, StepRule> = {};
    steps.forEach((_, idx) => {
      const existingRule = initialRules.step_rules?.[idx.toString()];
      stepRules[idx.toString()] = existingRule || {
        enabled: false,
        type: 'time_based',
        wait_hours: 24,
      };
    });
    return stepRules;
  };
  
  const [stepRules, setStepRules] = useState<Record<string, StepRule>>(initStepRules());
  const [hasChanges, setHasChanges] = useState(false);

  const updateSettings = useUpdateSequenceSettings();

  const handleRuleChange = (index: number, field: 'wait_hours', value: number) => {
    const newRules = [...rules];
    newRules[index] = { ...newRules[index], [field]: value };
    setRules(newRules);
    setHasChanges(true);
  };

  const handleStepRuleChange = (stepIndex: number, updates: Partial<StepRule>) => {
    setStepRules(prev => ({
      ...prev,
      [stepIndex.toString()]: {
        ...prev[stepIndex.toString()],
        ...updates,
      },
    }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    await updateSettings.mutateAsync({
      id: sequenceId,
      autoRespondEnabled,
      automationRules: {
        enabled: automationEnabled,
        rules,
        step_rules: stepRules,
      },
    });
    setHasChanges(false);
  };

  const getRuleLabel = (type: string) => {
    switch (type) {
      case 'no_open':
        return 'No open (send after wait)';
      case 'opened_not_clicked':
        return 'Opened, not clicked (send after wait)';
      case 'clicked_not_replied':
        return 'Clicked, not replied (send after wait)';
      case 'no_reply_after_open':
        return 'No reply after open (send after wait)';
      default:
        return type;
    }
  };

  const getStepRuleLabel = (type: string) => {
    switch (type) {
      case 'wait_for_open':
        return 'Wait for Open';
      case 'wait_for_click':
        return 'Wait for Click';
      case 'time_based':
        return 'Time-based (use delay)';
      case 'none':
        return 'No automation';
      default:
        return type;
    }
  };

  return (
    <Card className="border-2 border-primary/20">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Settings className="h-5 w-5 text-primary" />
          Sequence Settings
        </CardTitle>
        <CardDescription>
          Configure automation behavior and AI responses for this sequence
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Auto-Response Toggle */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="auto-respond" className="text-base flex items-center gap-2">
                <Bot className="h-4 w-4 text-primary" />
                AI Auto-Response
              </Label>
              <p className="text-sm text-muted-foreground">
                Let AI automatically respond to inbound replies
              </p>
            </div>
            <Switch
              id="auto-respond"
              checked={autoRespondEnabled}
              onCheckedChange={(checked) => {
                setAutoRespondEnabled(checked);
                setHasChanges(true);
              }}
            />
          </div>
          {autoRespondEnabled && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-primary/5 border border-primary/20">
              <AlertCircle className="h-4 w-4 text-primary flex-shrink-0" />
              <p className="text-xs text-muted-foreground">
                AI will analyze replies and generate contextual responses based on your business profile
              </p>
            </div>
          )}
        </div>

        <Separator />

        {/* Automation Settings with Tabs */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="automation" className="text-base flex items-center gap-2">
                <Clock className="h-4 w-4 text-primary" />
                Behavioral Automation
              </Label>
              <p className="text-sm text-muted-foreground">
                Automatically send next step based on recipient behavior
              </p>
            </div>
            <Switch
              id="automation"
              checked={automationEnabled}
              onCheckedChange={(checked) => {
                setAutomationEnabled(checked);
                setHasChanges(true);
              }}
            />
          </div>

          {automationEnabled && steps.length > 0 && (
            <Tabs defaultValue="global" className="mt-4">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="global">Global Rules</TabsTrigger>
                <TabsTrigger value="per-step">Per-Step Rules</TabsTrigger>
              </TabsList>

              {/* Global Rules Tab */}
              <TabsContent value="global" className="space-y-3 mt-4">
                <p className="text-sm font-medium">Default Automation Rules</p>
                <p className="text-xs text-muted-foreground mb-3">
                  These rules apply to all steps unless overridden by per-step rules
                </p>
                {rules.map((rule, index) => (
                  <div
                    key={rule.type}
                    className="flex items-center justify-between p-3 rounded-lg border bg-muted/30"
                  >
                    <div className="space-y-1">
                      <Badge variant="outline" className="mb-1">
                        {getRuleLabel(rule.type)}
                      </Badge>
                      <p className="text-xs text-muted-foreground">
                        Send next step after wait period
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min={1}
                        max={720}
                        value={rule.wait_hours}
                        onChange={(e) =>
                          handleRuleChange(index, 'wait_hours', parseInt(e.target.value) || 24)
                        }
                        className="w-20 text-center"
                      />
                      <span className="text-sm text-muted-foreground">hours</span>
                    </div>
                  </div>
                ))}
                <div className="flex items-center gap-2 p-3 rounded-lg bg-blue-500/5 border border-blue-500/20">
                  <AlertCircle className="h-4 w-4 text-blue-600 flex-shrink-0" />
                  <p className="text-xs text-muted-foreground">
                    Rules are checked hourly by the automation system
                  </p>
                </div>
              </TabsContent>

              {/* Per-Step Rules Tab */}
              <TabsContent value="per-step" className="space-y-3 mt-4">
                <p className="text-sm font-medium">Step-Specific Automation</p>
                <p className="text-xs text-muted-foreground mb-3">
                  Configure individual automation rules for each step. Per-step rules override global rules.
                </p>
                <div className="space-y-3">
                  {steps.map((step, idx) => {
                    const rule = stepRules[idx.toString()] || {
                      enabled: false,
                      type: 'time_based' as const,
                      wait_hours: 24,
                    };

                    return (
                      <Card key={idx} className="border bg-muted/30">
                        <CardContent className="pt-4 space-y-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-start gap-3 flex-1 min-w-0">
                              <div className="w-8 h-8 rounded-lg bg-gradient-primary flex items-center justify-center shrink-0">
                                <span className="text-white text-sm font-bold">{idx + 1}</span>
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <Badge variant="outline" className="text-xs">
                                    Step {idx + 1}
                                  </Badge>
                                  {step.delay_days !== undefined && step.delay_days > 0 && (
                                    <Badge variant="secondary" className="text-xs">
                                      <Clock className="h-3 w-3 mr-1" />
                                      {step.delay_days}d delay
                                    </Badge>
                                  )}
                                </div>
                                <p className="text-sm font-medium truncate">{step.subject}</p>
                              </div>
                            </div>
                            <Switch
                              checked={rule.enabled}
                              onCheckedChange={(checked) => 
                                handleStepRuleChange(idx, { enabled: checked })
                              }
                            />
                          </div>

                          {rule.enabled && (
                            <div className="space-y-3 pt-3 border-t">
                              <div className="space-y-2">
                                <Label className="text-xs">Automation Type</Label>
                                <Select
                                  value={rule.type}
                                  onValueChange={(value: any) => 
                                    handleStepRuleChange(idx, { type: value })
                                  }
                                >
                                  <SelectTrigger className="h-9 text-sm">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="time_based">Time-based (use delay)</SelectItem>
                                    <SelectItem value="wait_for_open">Wait for open</SelectItem>
                                    <SelectItem value="wait_for_click">Wait for click</SelectItem>
                                    <SelectItem value="none">No automation</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>

                              {rule.type !== 'none' && rule.type !== 'time_based' && (
                                <div className="space-y-2">
                                  <Label className="text-xs">Wait Hours</Label>
                                  <div className="flex items-center gap-2">
                                    <Input
                                      type="number"
                                      min={1}
                                      max={720}
                                      value={rule.wait_hours}
                                      onChange={(e) =>
                                        handleStepRuleChange(idx, { 
                                          wait_hours: parseInt(e.target.value) || 24 
                                        })
                                      }
                                      className="w-20 text-center h-9"
                                    />
                                    <span className="text-xs text-muted-foreground">hours</span>
                                  </div>
                                  <p className="text-xs text-muted-foreground">
                                    {rule.type === 'wait_for_open' 
                                      ? 'If not opened, send next step after this time'
                                      : 'If not clicked, send next step after this time'}
                                  </p>
                                </div>
                              )}

                              {rule.type === 'time_based' && (
                                <div className="flex items-center gap-2 p-2 rounded-lg bg-blue-500/5 border border-blue-500/20">
                                  <AlertCircle className="h-3 w-3 text-blue-600 flex-shrink-0" />
                                  <p className="text-xs text-muted-foreground">
                                    Will use the {step.delay_days || 0} day delay configured above
                                  </p>
                                </div>
                              )}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
                <div className="flex items-center gap-2 p-3 rounded-lg bg-blue-500/5 border border-blue-500/20">
                  <AlertCircle className="h-4 w-4 text-blue-600 flex-shrink-0" />
                  <p className="text-xs text-muted-foreground">
                    Per-step rules are checked hourly and override global rules
                  </p>
                </div>
              </TabsContent>
            </Tabs>
          )}

          {automationEnabled && steps.length === 0 && (
            <div className="space-y-3 mt-4">
              <p className="text-sm font-medium">Automation Rules</p>
              {rules.map((rule, index) => (
                <div
                  key={rule.type}
                  className="flex items-center justify-between p-3 rounded-lg border bg-muted/30"
                >
                  <div className="space-y-1">
                    <Badge variant="outline" className="mb-1">
                      {getRuleLabel(rule.type)}
                    </Badge>
                    <p className="text-xs text-muted-foreground">
                      Send next step after wait period
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min={1}
                      max={720}
                      value={rule.wait_hours}
                      onChange={(e) =>
                        handleRuleChange(index, 'wait_hours', parseInt(e.target.value) || 24)
                      }
                      className="w-20 text-center"
                    />
                    <span className="text-sm text-muted-foreground">hours</span>
                  </div>
                </div>
              ))}
              <div className="flex items-center gap-2 p-3 rounded-lg bg-blue-500/5 border border-blue-500/20">
                <AlertCircle className="h-4 w-4 text-blue-600 flex-shrink-0" />
                <p className="text-xs text-muted-foreground">
                  Rules are checked hourly by the automation system
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Save Button */}
        {hasChanges && (
          <>
            <Separator />
            <Button
              onClick={handleSave}
              disabled={updateSettings.isPending}
              className="w-full"
            >
              <Save className="h-4 w-4 mr-2" />
              {updateSettings.isPending ? 'Saving...' : 'Save Settings'}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
