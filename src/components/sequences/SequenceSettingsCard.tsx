import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Settings, Clock, Bot, Save, AlertCircle } from "lucide-react";
import { useUpdateSequenceSettings } from "@/hooks/use-company-sequences";

interface AutomationRule {
  type: string;
  action: string;
  wait_hours: number;
}

interface AutomationRules {
  enabled: boolean;
  rules: AutomationRule[];
}

interface SequenceSettingsCardProps {
  sequenceId: string;
  autoRespondEnabled: boolean;
  automationRules: AutomationRules;
}

export function SequenceSettingsCard({
  sequenceId,
  autoRespondEnabled: initialAutoRespond,
  automationRules: initialRules,
}: SequenceSettingsCardProps) {
  const [autoRespondEnabled, setAutoRespondEnabled] = useState(initialAutoRespond);
  const [automationEnabled, setAutomationEnabled] = useState(initialRules.enabled);
  const [rules, setRules] = useState<AutomationRule[]>(initialRules.rules);
  const [hasChanges, setHasChanges] = useState(false);

  const updateSettings = useUpdateSequenceSettings();

  const handleRuleChange = (index: number, field: 'wait_hours', value: number) => {
    const newRules = [...rules];
    newRules[index] = { ...newRules[index], [field]: value };
    setRules(newRules);
    setHasChanges(true);
  };

  const handleSave = async () => {
    await updateSettings.mutateAsync({
      id: sequenceId,
      autoRespondEnabled,
      automationRules: {
        enabled: automationEnabled,
        rules,
      },
    });
    setHasChanges(false);
  };

  const getRuleLabel = (type: string) => {
    switch (type) {
      case 'no_open':
        return 'No Open';
      case 'opened_not_clicked':
        return 'Opened, Not Clicked';
      case 'clicked_not_replied':
        return 'Clicked, Not Replied';
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

        {/* Automation Rules */}
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

          {automationEnabled && (
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
