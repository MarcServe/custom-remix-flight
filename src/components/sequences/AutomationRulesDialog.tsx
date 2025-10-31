import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Mail, Eye, MousePointer, Clock } from 'lucide-react';

interface AutomationRule {
  type: string;
  wait_hours: number;
  action: string;
}

interface AutomationRules {
  enabled: boolean;
  rules: AutomationRule[];
}

interface AutomationRulesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentRules: AutomationRules;
  onSave: (rules: AutomationRules) => void;
}

export function AutomationRulesDialog({ open, onOpenChange, currentRules, onSave }: AutomationRulesDialogProps) {
  const [enabled, setEnabled] = useState(currentRules.enabled);
  const [rules, setRules] = useState<AutomationRule[]>(currentRules.rules || []);

  const getRuleHours = (type: string) => {
    return rules.find(r => r.type === type)?.wait_hours || 48;
  };

  const updateRuleHours = (type: string, hours: number) => {
    setRules(prev => {
      const existing = prev.find(r => r.type === type);
      if (existing) {
        return prev.map(r => r.type === type ? { ...r, wait_hours: hours } : r);
      }
      return [...prev, { type, wait_hours: hours, action: 'send_next' }];
    });
  };

  const handleSave = () => {
    onSave({ enabled, rules });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Automation Rules</DialogTitle>
          <DialogDescription>
            Configure when follow-up emails are automatically sent based on recipient behavior
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6">
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div>
              <Label className="text-base font-medium">Enable Smart Automation</Label>
              <p className="text-sm text-muted-foreground mt-1">
                Automatically send follow-ups based on engagement
              </p>
            </div>
            <Switch checked={enabled} onCheckedChange={setEnabled} />
          </div>
          
          <Separator />
          
          <div className="space-y-4">
            <div className="rounded-lg border p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">No Open</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Send next email if recipient hasn't opened after:
              </p>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min="1"
                  value={getRuleHours('no_open')}
                  onChange={(e) => updateRuleHours('no_open', parseInt(e.target.value) || 48)}
                  className="w-24"
                  disabled={!enabled}
                />
                <span className="text-sm text-muted-foreground">hours</span>
              </div>
            </div>
            
            <div className="rounded-lg border p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Eye className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">Opened but No Click</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Send next email if opened but no clicks after:
              </p>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min="1"
                  value={getRuleHours('opened_not_clicked')}
                  onChange={(e) => updateRuleHours('opened_not_clicked', parseInt(e.target.value) || 72)}
                  className="w-24"
                  disabled={!enabled}
                />
                <span className="text-sm text-muted-foreground">hours</span>
              </div>
            </div>
            
            <div className="rounded-lg border p-4 space-y-3">
              <div className="flex items-center gap-2">
                <MousePointer className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">Clicked but No Reply</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Send next email if clicked link but no reply after:
              </p>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min="1"
                  value={getRuleHours('clicked_not_replied')}
                  onChange={(e) => updateRuleHours('clicked_not_replied', parseInt(e.target.value) || 96)}
                  className="w-24"
                  disabled={!enabled}
                />
                <span className="text-sm text-muted-foreground">hours</span>
              </div>
            </div>

            <div className="rounded-lg border p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">No Reply After Open</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Send next email if opened but no reply after:
              </p>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min="1"
                  value={getRuleHours('no_reply_after_open')}
                  onChange={(e) => updateRuleHours('no_reply_after_open', parseInt(e.target.value) || 96)}
                  className="w-24"
                  disabled={!enabled}
                />
                <span className="text-sm text-muted-foreground">hours</span>
              </div>
            </div>
          </div>

          <div className="bg-muted/50 rounded-lg p-4">
            <p className="text-sm text-muted-foreground">
              <strong>Note:</strong> Automation rules will be checked hourly. If multiple rules match, the first one will trigger. Time-based delays serve as a fallback if no behavioral rules are met.
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave}>
            Save Rules
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
