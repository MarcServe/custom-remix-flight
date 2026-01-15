import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { 
  Save,
  Loader2,
  Clock,
  Search,
  Zap,
  Bell,
  Mail,
  Target,
  Webhook,
  Sliders
} from "lucide-react";

interface AutopilotSettingsPanelProps {
  settings: any;
}

export function AutopilotSettingsPanel({ settings }: AutopilotSettingsPanelProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [localSettings, setLocalSettings] = useState<any>(null);

  useEffect(() => {
    if (settings) {
      setLocalSettings(settings);
    }
  }, [settings]);

  // Fetch sequences for auto-enroll dropdown
  const { data: sequences } = useQuery({
    queryKey: ['email-sequences'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('email_sequences')
        .select('id, name')
        .order('name');
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
  });

  const saveSettingsMutation = useMutation({
    mutationFn: async (newSettings: any) => {
      const { error } = await supabase
        .from('autonomous_discovery_settings')
        .upsert({ 
          ...newSettings, 
          user_id: user?.id,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['autonomous-discovery-settings'] });
      toast({ title: 'Settings saved', description: 'Your autopilot settings have been updated.' });
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const handleChange = (key: string, value: any) => {
    setLocalSettings((prev: any) => ({ ...prev, [key]: value }));
  };

  const handleSave = () => {
    if (localSettings) {
      saveSettingsMutation.mutate(localSettings);
    }
  };

  if (!localSettings) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Discovery Schedule */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Discovery Schedule
          </CardTitle>
          <CardDescription>
            Configure how often the AI searches for new leads
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>Frequency</Label>
              <Select
                value={localSettings?.discovery_frequency || 'daily'}
                onValueChange={(value) => handleChange('discovery_frequency', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="twice_weekly">Twice Weekly</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Discovery Time</Label>
              <Select
                value={String(localSettings?.preferred_discovery_hour || 9)}
                onValueChange={(value) => handleChange('preferred_discovery_hour', parseInt(value))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 24 }, (_, i) => {
                    const hour12 = i === 0 ? 12 : i > 12 ? i - 12 : i;
                    const ampm = i < 12 ? 'AM' : 'PM';
                    return (
                      <SelectItem key={i} value={String(i)}>
                        {hour12}:00 {ampm}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Timezone</Label>
              <Select
                value={localSettings?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone}
                onValueChange={(value) => handleChange('timezone', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  {[
                    'America/New_York',
                    'America/Chicago',
                    'America/Denver',
                    'America/Los_Angeles',
                    'America/Anchorage',
                    'Pacific/Honolulu',
                    'Europe/London',
                    'Europe/Paris',
                    'Europe/Berlin',
                    'Europe/Moscow',
                    'Asia/Dubai',
                    'Asia/Kolkata',
                    'Asia/Singapore',
                    'Asia/Tokyo',
                    'Asia/Shanghai',
                    'Australia/Sydney',
                    'Pacific/Auckland',
                    'Africa/Lagos',
                    'Africa/Cairo',
                    'Africa/Johannesburg',
                  ].map((tz) => {
                    const label = tz.replace(/_/g, ' ').split('/').pop() || tz;
                    return (
                      <SelectItem key={tz} value={tz}>
                        {label}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Discovery runs at selected time in your timezone
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Max Leads Per Run</Label>
              <Badge variant="secondary">{localSettings?.max_leads_per_run || 10}</Badge>
            </div>
            <Slider
              value={[localSettings?.max_leads_per_run || 10]}
              onValueChange={([value]) => handleChange('max_leads_per_run', value)}
              min={5}
              max={50}
              step={5}
            />
            <p className="text-xs text-muted-foreground">
              Maximum number of leads to discover in each run
            </p>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Daily Lead Target</Label>
              <Badge variant="secondary">{localSettings?.daily_lead_target || 20}</Badge>
            </div>
            <Slider
              value={[localSettings?.daily_lead_target || 20]}
              onValueChange={([value]) => handleChange('daily_lead_target', value)}
              min={5}
              max={100}
              step={5}
            />
          </div>
        </CardContent>
      </Card>

      {/* Data Sources */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Data Sources
          </CardTitle>
          <CardDescription>
            Toggle which sources to use for discovering leads
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>Exa AI Search</Label>
              <p className="text-xs text-muted-foreground">AI-powered web search</p>
            </div>
            <Switch
              checked={true}
              disabled
            />
          </div>
          <Separator />
          
          <div className="flex items-center justify-between">
            <div>
              <Label>SerpAPI (Google Search)</Label>
              <p className="text-xs text-muted-foreground">Traditional search engine results</p>
            </div>
            <Switch
              checked={localSettings?.use_serp_api || false}
              onCheckedChange={(checked) => handleChange('use_serp_api', checked)}
            />
          </div>
          <Separator />
          
          <div className="flex items-center justify-between">
            <div>
              <Label>Apify (Google Maps)</Label>
              <p className="text-xs text-muted-foreground">Local business listings</p>
            </div>
            <Switch
              checked={localSettings?.use_apify || false}
              onCheckedChange={(checked) => handleChange('use_apify', checked)}
            />
          </div>
          
          {localSettings?.use_apify && (
            <div className="pl-4 border-l-2 border-muted space-y-3">
              <div className="space-y-2">
                <Label className="text-sm">Max Apify Results</Label>
                <Slider
                  value={[localSettings?.apify_max_results || 20]}
                  onValueChange={([value]) => handleChange('apify_max_results', value)}
                  min={10}
                  max={100}
                  step={10}
                />
                <p className="text-xs text-muted-foreground">
                  Currently: {localSettings?.apify_max_results || 20} results
                </p>
              </div>
            </div>
          )}

          <Separator />
          
          <div className="flex items-center justify-between">
            <div>
              <Label>Perplexity Research</Label>
              <p className="text-xs text-muted-foreground">Deep research for high-quality leads</p>
            </div>
            <Switch
              checked={localSettings?.enrich_with_perplexity || false}
              onCheckedChange={(checked) => handleChange('enrich_with_perplexity', checked)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Auto-Approval Rules */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Auto-Approval Rules
          </CardTitle>
          <CardDescription>
            Automatically approve leads that meet your quality threshold
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Auto-Approve Threshold</Label>
              <Badge variant="secondary">{localSettings?.auto_approve_threshold || 70}%</Badge>
            </div>
            <Slider
              value={[localSettings?.auto_approve_threshold || 70]}
              onValueChange={([value]) => handleChange('auto_approve_threshold', value)}
              min={50}
              max={95}
              step={5}
            />
            <p className="text-xs text-muted-foreground">
              Leads with quality score ≥ {localSettings?.auto_approve_threshold || 70}% will be auto-approved
            </p>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Hot Lead Threshold</Label>
              <Badge variant="secondary" className="bg-orange-500/10 text-orange-600">
                {localSettings?.hot_lead_threshold || 85}%
              </Badge>
            </div>
            <Slider
              value={[localSettings?.hot_lead_threshold || 85]}
              onValueChange={([value]) => handleChange('hot_lead_threshold', value)}
              min={70}
              max={100}
              step={5}
            />
            <p className="text-xs text-muted-foreground">
              Leads above this threshold trigger instant notifications
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Auto-Outreach */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Auto-Outreach
          </CardTitle>
          <CardDescription>
            Automatically enroll approved leads in email sequences
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>Auto-Enroll in Sequence</Label>
              <p className="text-xs text-muted-foreground">
                Approved leads are automatically added to an outreach sequence
              </p>
            </div>
            <Switch
              checked={localSettings?.auto_enroll_enabled || false}
              onCheckedChange={(checked) => handleChange('auto_enroll_enabled', checked)}
            />
          </div>

          {localSettings?.auto_enroll_enabled && (
            <div className="space-y-2">
              <Label>Select Sequence</Label>
              <Select
                value={localSettings?.auto_enroll_sequence_id || ""}
                onValueChange={(value) => handleChange('auto_enroll_sequence_id', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose a sequence..." />
                </SelectTrigger>
                <SelectContent>
                  {sequences?.map((seq) => (
                    <SelectItem key={seq.id} value={seq.id}>{seq.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <Separator />

          <div className="flex items-center justify-between">
            <div>
              <Label>Auto-Create Campaigns</Label>
              <p className="text-xs text-muted-foreground">
                Group similar leads into draft email campaigns
              </p>
            </div>
            <Switch
              checked={localSettings?.auto_create_campaign || false}
              onCheckedChange={(checked) => handleChange('auto_create_campaign', checked)}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label className="text-orange-600">Full Auto Mode</Label>
              <p className="text-xs text-muted-foreground">
                Send emails without manual review (use with caution!)
              </p>
            </div>
            <Switch
              checked={localSettings?.full_auto_mode || false}
              onCheckedChange={(checked) => handleChange('full_auto_mode', checked)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Notifications */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Notifications
          </CardTitle>
          <CardDescription>
            Configure alerts for discovery events
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label>Notify on Discovery Complete</Label>
            <Switch
              checked={localSettings?.notify_on_discovery_complete || false}
              onCheckedChange={(checked) => handleChange('notify_on_discovery_complete', checked)}
            />
          </div>

          <div className="flex items-center justify-between">
            <Label>Alert for Hot Leads</Label>
            <Switch
              checked={localSettings?.notify_on_hot_leads || false}
              onCheckedChange={(checked) => handleChange('notify_on_hot_leads', checked)}
            />
          </div>

          <Separator />

          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Webhook className="h-4 w-4" />
              Slack Webhook URL
            </Label>
            <Input
              placeholder="https://hooks.slack.com/services/..."
              value={localSettings?.slack_webhook_url || ''}
              onChange={(e) => handleChange('slack_webhook_url', e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Webhook className="h-4 w-4" />
              Discord Webhook URL
            </Label>
            <Input
              placeholder="https://discord.com/api/webhooks/..."
              value={localSettings?.discord_webhook_url || ''}
              onChange={(e) => handleChange('discord_webhook_url', e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {/* AI Learning */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sliders className="h-5 w-5" />
            AI Learning
          </CardTitle>
          <CardDescription>
            Let the AI learn from your approval patterns
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>Enable Feedback Learning</Label>
              <p className="text-xs text-muted-foreground">
                AI learns from your approvals and rejections to improve future targeting
              </p>
            </div>
            <Switch
              checked={localSettings?.feedback_learning_enabled !== false}
              onCheckedChange={(checked) => handleChange('feedback_learning_enabled', checked)}
            />
          </div>

          {localSettings?.learned_industries?.length > 0 && (
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Learned Industries</Label>
              <div className="flex flex-wrap gap-1">
                {localSettings.learned_industries.slice(0, 10).map((ind: string) => (
                  <Badge key={ind} variant="secondary" className="text-xs">{ind}</Badge>
                ))}
              </div>
            </div>
          )}

          {localSettings?.avoid_industries?.length > 0 && (
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Avoided Industries</Label>
              <div className="flex flex-wrap gap-1">
                {localSettings.avoid_industries.slice(0, 10).map((ind: string) => (
                  <Badge key={ind} variant="outline" className="text-xs text-red-600">{ind}</Badge>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saveSettingsMutation.isPending}>
          {saveSettingsMutation.isPending ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          Save Settings
        </Button>
      </div>
    </div>
  );
}
