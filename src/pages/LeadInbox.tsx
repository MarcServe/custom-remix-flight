import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { 
  Inbox, 
  CheckCircle2, 
  XCircle, 
  Building2, 
  Globe, 
  Mail, 
  Settings, 
  Zap,
  Clock,
  Users,
  RefreshCw,
  Loader2,
  Trash2,
  Brain,
  Send,
  Webhook,
  BarChart3,
  Target,
  Play
} from "lucide-react";
import { QualityScoreBadge } from "@/components/lead-finder/QualityScoreBadge";
import { CompanyDetailsDialog } from "@/components/CompanyDetailsDialog";
import { LeadAnalyticsDashboard } from "@/components/lead-inbox/LeadAnalyticsDashboard";
import { PersonaManager } from "@/components/lead-inbox/PersonaManager";
import { LeadCard } from "@/components/lead-inbox/LeadCard";
import { EmptyState } from "@/components/lead-inbox/EmptyState";
import { StatsHeader } from "@/components/lead-inbox/StatsHeader";

type LeadStatus = 'pending' | 'approved' | 'rejected' | 'auto_approved';

export default function LeadInbox() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [selectedLeads, setSelectedLeads] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<LeadStatus | 'all'>('pending');
  const [selectedLead, setSelectedLead] = useState<any>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  // Fetch autonomous discovery settings
  const { data: settings, isLoading: settingsLoading } = useQuery({
    queryKey: ['autonomous-discovery-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('autonomous_discovery_settings')
        .select('*')
        .eq('user_id', user?.id)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  // Fetch autonomous leads
  const { data: leads, isLoading: leadsLoading, refetch: refetchLeads } = useQuery({
    queryKey: ['autonomous-leads', activeTab],
    queryFn: async () => {
      let query = supabase
        .from('autonomous_leads')
        .select('*')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });

      if (activeTab !== 'all') {
        query = query.eq('status', activeTab);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
  });

  // Count leads by status
  const { data: statusCounts } = useQuery({
    queryKey: ['autonomous-leads-counts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('autonomous_leads')
        .select('status')
        .eq('user_id', user?.id);
      
      if (error) throw error;
      
      const counts = { pending: 0, approved: 0, rejected: 0, auto_approved: 0, all: 0 };
      (data || []).forEach((l: any) => {
        counts[l.status as keyof typeof counts]++;
        counts.all++;
      });
      return counts;
    },
    enabled: !!user?.id,
  });

  // Save/update settings mutation
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
      toast({ title: 'Settings saved', description: 'Your autonomous discovery settings have been updated.' });
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  // Manual discovery trigger mutation
  const runDiscoveryMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('autonomous-lead-discovery', {
        body: { userId: user?.id, forceRun: true },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['autonomous-leads'] });
      queryClient.invalidateQueries({ queryKey: ['autonomous-leads-counts'] });
      queryClient.invalidateQueries({ queryKey: ['autonomous-discovery-settings'] });
      toast({ 
        title: 'Discovery complete!', 
        description: `Found ${data?.leadsDiscovered || 0} new leads.`,
      });
    },
    onError: (error: any) => {
      toast({ title: 'Discovery failed', description: error.message, variant: 'destructive' });
    },
  });

  // Fetch sequences for auto-enroll dropdown
  const { data: sequences } = useQuery({
    queryKey: ['email-sequences'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('email_sequences')
        .select('id, name')
        .eq('created_by', user?.id)
        .order('name');
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
  });

  // Helper to track feedback
  const trackFeedback = async (lead: any, action: string, startTime: number) => {
    const timeToDecision = Math.round((Date.now() - startTime) / 1000);
    
    // Insert feedback analytics
    await supabase.from('lead_feedback_analytics').insert({
      user_id: user?.id,
      autonomous_lead_id: lead.id,
      action,
      quality_score: lead.quality_score,
      industry: lead.industry,
      geography: lead.geography,
      company_size: lead.company_size,
      source: lead.source,
      time_to_decision_seconds: timeToDecision,
    });

    // Update learned preferences via RPC
    await supabase.rpc('update_discovery_learning', {
      p_user_id: user?.id,
      p_action: action,
      p_industry: lead.industry,
      p_geography: lead.geography,
      p_company_size: lead.company_size,
    });
  };

  // Helper to enroll in sequence
  const enrollInSequence = async (companyId: string, sequenceId: string) => {
    const { error } = await supabase.from('company_sequences').insert({
      company_id: companyId,
      sequence_id: sequenceId,
      status: 'active',
      current_step: 0,
      auto_respond_enabled: true,
    });
    if (error) console.error('Error enrolling in sequence:', error);
  };

  // Approve lead mutation
  const approveLeadMutation = useMutation({
    mutationFn: async (leadIds: string[]) => {
      const startTime = Date.now();
      
      for (const leadId of leadIds) {
        // Get the lead data
        const { data: lead } = await supabase
          .from('autonomous_leads')
          .select('*')
          .eq('id', leadId)
          .single();

        if (!lead) continue;

        const companyData = (lead.company_data || {}) as Record<string, any>;

        // Create the company
        const { data: company, error: companyError } = await supabase
          .from('companies')
          .insert({
            user_id: user?.id,
            name: lead.company_name,
            website: lead.company_website || `no-website-${crypto.randomUUID()}`,
            description: companyData.description,
            industry: lead.industry,
            size: lead.company_size,
            geography: lead.geography,
            linkedin_url: companyData.linkedinUrl,
            company_phone: companyData.companyPhone,
            general_email: companyData.generalEmail,
            social_profiles: companyData.socialProfiles,
            key_executives: companyData.keyExecutives,
            employee_count: companyData.employeeCount,
            enrichment_data: lead.enrichment_data,
            enrichment_status: lead.enrichment_data ? 'completed' : 'pending',
          })
          .select('id')
          .single();

        if (companyError) {
          console.error('Error creating company:', companyError);
          continue;
        }

        // Save contacts
        const contacts = (lead.contacts || []) as any[];
        if (contacts.length > 0 && company?.id) {
          const contactsToInsert = contacts.map((contact: any) => ({
            company_id: company.id,
            name: contact.name,
            email: contact.email,
            email_verified: contact.emailVerified,
            linkedin_url: contact.linkedinUrl,
            title: contact.title,
            department: contact.department,
            phone: contact.phone,
          }));

          await supabase.from('contacts').insert(contactsToInsert);
        }

        // Update lead status
        await supabase
          .from('autonomous_leads')
          .update({ 
            status: 'approved', 
            reviewed_at: new Date().toISOString(),
            company_id: company?.id,
          })
          .eq('id', leadId);

        // Track feedback for AI learning
        await trackFeedback(lead, 'approved', startTime);

        // Auto-enroll in sequence if enabled
        if (settings?.auto_enroll_enabled && settings?.auto_enroll_sequence_id && company?.id) {
          await enrollInSequence(company.id, settings.auto_enroll_sequence_id);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['autonomous-leads'] });
      queryClient.invalidateQueries({ queryKey: ['autonomous-leads-counts'] });
      queryClient.invalidateQueries({ queryKey: ['companies'] });
      queryClient.invalidateQueries({ queryKey: ['autonomous-discovery-settings'] });
      setSelectedLeads(new Set());
      toast({ title: 'Leads approved', description: 'Leads have been added to your CRM.' });
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  // Reject lead mutation
  const rejectLeadMutation = useMutation({
    mutationFn: async (leadIds: string[]) => {
      const startTime = Date.now();
      
      // Get leads for feedback tracking
      const { data: leadsToReject } = await supabase
        .from('autonomous_leads')
        .select('*')
        .in('id', leadIds);
      
      const { error } = await supabase
        .from('autonomous_leads')
        .update({ status: 'rejected', reviewed_at: new Date().toISOString() })
        .in('id', leadIds);
      if (error) throw error;

      // Track feedback for each rejected lead
      for (const lead of (leadsToReject || [])) {
        await trackFeedback(lead, 'rejected', startTime);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['autonomous-leads'] });
      queryClient.invalidateQueries({ queryKey: ['autonomous-leads-counts'] });
      setSelectedLeads(new Set());
      toast({ title: 'Leads rejected' });
    },
  });

  // Delete lead mutation
  const deleteLeadMutation = useMutation({
    mutationFn: async (leadIds: string[]) => {
      const { error } = await supabase
        .from('autonomous_leads')
        .delete()
        .in('id', leadIds);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['autonomous-leads'] });
      queryClient.invalidateQueries({ queryKey: ['autonomous-leads-counts'] });
      setSelectedLeads(new Set());
      toast({ title: 'Leads deleted' });
    },
  });

  const toggleLeadSelection = (leadId: string) => {
    setSelectedLeads(prev => {
      const newSet = new Set(prev);
      if (newSet.has(leadId)) {
        newSet.delete(leadId);
      } else {
        newSet.add(leadId);
      }
      return newSet;
    });
  };

  const toggleSelectAll = () => {
    if (selectedLeads.size === (leads?.length || 0)) {
      setSelectedLeads(new Set());
    } else {
      setSelectedLeads(new Set((leads || []).map(l => l.id)));
    }
  };

  const handleViewLead = (lead: any) => {
    const companyData = (lead.company_data || {}) as Record<string, any>;
    setSelectedLead({
      ...companyData,
      id: lead.id,
      name: lead.company_name,
      website: lead.company_website,
      industry: lead.industry,
      geography: lead.geography,
      size: lead.company_size,
      contacts: lead.contacts,
      qualityScore: lead.quality_score,
    });
    setDialogOpen(true);
  };

  const [localSettings, setLocalSettings] = useState<any>(null);

  // Sync local settings with fetched settings
  if (settings && !localSettings) {
    setLocalSettings(settings);
  }

  const handleSettingsChange = (key: string, value: any) => {
    setLocalSettings((prev: any) => ({ ...prev, [key]: value }));
  };

  const handleSaveSettings = () => {
    if (localSettings) {
      saveSettingsMutation.mutate(localSettings);
    }
  };

  const isLoading = leadsLoading || settingsLoading;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5">
              <Inbox className="h-7 w-7 text-primary" />
            </div>
            Lead Inbox
          </h1>
          <p className="text-muted-foreground mt-1">
            Review and approve leads discovered automatically by AI
          </p>
        </div>
        {settings?.enabled && (
          <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-200 self-start">
            <Zap className="h-3 w-3 mr-1" />
            Discovery Active
          </Badge>
        )}
      </div>

      {/* Stats Overview */}
      {statusCounts && statusCounts.all > 0 && (
        <StatsHeader counts={statusCounts} />
      )}

      <Tabs defaultValue="inbox" className="space-y-6">
        <TabsList>
          <TabsTrigger value="inbox" className="gap-2">
            <Inbox className="h-4 w-4" />
            Inbox
            {(statusCounts?.pending || 0) > 0 && (
              <Badge variant="secondary" className="ml-1">{statusCounts?.pending}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="analytics" className="gap-2">
            <BarChart3 className="h-4 w-4" />
            Analytics
          </TabsTrigger>
          <TabsTrigger value="personas" className="gap-2">
            <Target className="h-4 w-4" />
            Personas
          </TabsTrigger>
          <TabsTrigger value="settings" className="gap-2">
            <Settings className="h-4 w-4" />
            Settings
          </TabsTrigger>
        </TabsList>

        {/* Inbox Tab */}
        <TabsContent value="inbox" className="space-y-4">
          {/* Status Filter Tabs */}
          <div className="flex items-center justify-between">
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
              <TabsList>
                <TabsTrigger value="pending" className="gap-1">
                  <Clock className="h-3 w-3" />
                  Pending ({statusCounts?.pending || 0})
                </TabsTrigger>
                <TabsTrigger value="approved" className="gap-1">
                  <CheckCircle2 className="h-3 w-3" />
                  Approved ({statusCounts?.approved || 0})
                </TabsTrigger>
                <TabsTrigger value="auto_approved" className="gap-1">
                  <Zap className="h-3 w-3" />
                  Auto ({statusCounts?.auto_approved || 0})
                </TabsTrigger>
                <TabsTrigger value="rejected" className="gap-1">
                  <XCircle className="h-3 w-3" />
                  Rejected ({statusCounts?.rejected || 0})
                </TabsTrigger>
                <TabsTrigger value="all">All ({statusCounts?.all || 0})</TabsTrigger>
              </TabsList>
            </Tabs>

            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => refetchLeads()}>
                <RefreshCw className="h-4 w-4 mr-1" />
                Refresh
              </Button>
            </div>
          </div>

          {/* Bulk Actions */}
          {selectedLeads.size > 0 && (
            <Card className="border-primary/50 bg-primary/5">
              <CardContent className="flex items-center justify-between py-3">
                <span className="text-sm font-medium">
                  {selectedLeads.size} lead{selectedLeads.size !== 1 ? 's' : ''} selected
                </span>
                <div className="flex items-center gap-2">
                  {activeTab === 'pending' && (
                    <>
                      <Button 
                        size="sm" 
                        onClick={() => approveLeadMutation.mutate(Array.from(selectedLeads))}
                        disabled={approveLeadMutation.isPending}
                      >
                        {approveLeadMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <CheckCircle2 className="h-4 w-4 mr-1" />}
                        Approve
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => rejectLeadMutation.mutate(Array.from(selectedLeads))}
                        disabled={rejectLeadMutation.isPending}
                      >
                        <XCircle className="h-4 w-4 mr-1" />
                        Reject
                      </Button>
                    </>
                  )}
                  <Button 
                    size="sm" 
                    variant="destructive"
                    onClick={() => deleteLeadMutation.mutate(Array.from(selectedLeads))}
                    disabled={deleteLeadMutation.isPending}
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Leads List */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg font-semibold">Discovered Leads</CardTitle>
                {(leads?.length || 0) > 0 && (
                  <div className="flex items-center gap-2">
                    <Checkbox 
                      checked={selectedLeads.size === leads?.length && leads.length > 0}
                      onCheckedChange={toggleSelectAll}
                    />
                    <span className="text-sm text-muted-foreground">Select all</span>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex flex-col items-center justify-center py-16">
                  <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
                  <p className="text-muted-foreground">Loading leads...</p>
                </div>
              ) : !leads || leads.length === 0 ? (
                <EmptyState 
                  type={activeTab} 
                  onGoToSettings={() => {
                    const tabsElement = document.querySelector('[data-state="active"][value="inbox"]');
                    // Simple navigation - user can click Settings tab
                  }}
                />
              ) : (
                <ScrollArea className="h-[600px] pr-4">
                  <div className="space-y-3">
                    {leads.map((lead) => (
                      <LeadCard
                        key={lead.id}
                        lead={{
                          ...lead,
                          company_data: (lead.company_data || {}) as Record<string, any>,
                          contacts: lead.contacts as any[] | null,
                        }}
                        isSelected={selectedLeads.has(lead.id)}
                        onSelect={() => toggleLeadSelection(lead.id)}
                        onView={() => handleViewLead(lead)}
                        onApprove={() => approveLeadMutation.mutate([lead.id])}
                        onReject={() => rejectLeadMutation.mutate([lead.id])}
                        isPending={approveLeadMutation.isPending || rejectLeadMutation.isPending}
                      />
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Zap className="h-5 w-5" />
                    Autonomous Discovery Settings
                  </CardTitle>
                  <CardDescription>
                    Configure how the AI automatically discovers leads for you
                  </CardDescription>
                </div>
                <Button
                  onClick={() => runDiscoveryMutation.mutate()}
                  disabled={runDiscoveryMutation.isPending || !settings?.enabled}
                  className="gap-2"
                >
                  {runDiscoveryMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Play className="h-4 w-4" />
                  )}
                  Run Discovery Now
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Enable Toggle */}
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="enabled" className="font-medium">Enable Autonomous Discovery</Label>
                  <p className="text-sm text-muted-foreground">
                    AI will automatically find and deliver leads to your inbox
                  </p>
                </div>
                <Switch
                  id="enabled"
                  checked={localSettings?.enabled || false}
                  onCheckedChange={(checked) => handleSettingsChange('enabled', checked)}
                />
              </div>

              <Separator />

              {/* Frequency */}
              <div className="space-y-2">
                <Label>Discovery Frequency</Label>
                <Select
                  value={localSettings?.discovery_frequency || 'daily'}
                  onValueChange={(value) => handleSettingsChange('discovery_frequency', value)}
                >
                  <SelectTrigger className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="twice_weekly">Twice a week</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Max Leads */}
              <div className="space-y-2">
                <Label>Leads per discovery run: {localSettings?.max_leads_per_run || 10}</Label>
                <Slider
                  value={[localSettings?.max_leads_per_run || 10]}
                  onValueChange={([value]) => handleSettingsChange('max_leads_per_run', value)}
                  min={5}
                  max={50}
                  step={5}
                  className="w-64"
                />
              </div>

              <Separator />

              {/* Search Options */}
              <div className="space-y-4">
                <Label className="font-medium">Search Options</Label>
                
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="enrich_with_perplexity"
                    checked={localSettings?.enrich_with_perplexity ?? true}
                    onCheckedChange={(checked) => handleSettingsChange('enrich_with_perplexity', checked)}
                  />
                  <Label htmlFor="enrich_with_perplexity" className="text-sm">
                    Enrich leads with Perplexity AI
                  </Label>
                </div>

                <div className="flex items-center gap-2">
                  <Checkbox
                    id="use_serp_api"
                    checked={localSettings?.use_serp_api || false}
                    onCheckedChange={(checked) => handleSettingsChange('use_serp_api', checked)}
                  />
                  <Label htmlFor="use_serp_api" className="text-sm">
                    Include Google Search results (SerpAPI)
                  </Label>
                </div>
              </div>

              <Separator />

              {/* Auto-Approve Threshold */}
              <div className="space-y-2">
                <Label>Auto-approve leads with quality score above: {localSettings?.auto_approve_threshold || 'Disabled'}</Label>
                <Slider
                  value={[localSettings?.auto_approve_threshold || 0]}
                  onValueChange={([value]) => handleSettingsChange('auto_approve_threshold', value === 0 ? null : value)}
                  min={0}
                  max={90}
                  step={10}
                  className="w-64"
                />
                <p className="text-xs text-muted-foreground">
                  Set to 0 to disable auto-approval
                </p>
              </div>

              <Separator />

              {/* Auto-Outreach Section */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Send className="h-4 w-4" />
                  <Label className="font-medium">Auto-Outreach</Label>
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="auto_enroll_enabled" className="text-sm">Auto-enroll approved leads in sequence</Label>
                    <p className="text-xs text-muted-foreground">
                      Automatically start email sequences for approved leads
                    </p>
                  </div>
                  <Switch
                    id="auto_enroll_enabled"
                    checked={localSettings?.auto_enroll_enabled || false}
                    onCheckedChange={(checked) => handleSettingsChange('auto_enroll_enabled', checked)}
                  />
                </div>

                {localSettings?.auto_enroll_enabled && (
                  <div className="space-y-2 pl-4 border-l-2 border-muted">
                    <Label>Select Sequence</Label>
                    <Select
                      value={localSettings?.auto_enroll_sequence_id || ''}
                      onValueChange={(value) => handleSettingsChange('auto_enroll_sequence_id', value)}
                    >
                      <SelectTrigger className="w-64">
                        <SelectValue placeholder="Choose a sequence..." />
                      </SelectTrigger>
                      <SelectContent>
                        {sequences?.map((seq) => (
                          <SelectItem key={seq.id} value={seq.id}>
                            {seq.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              <Separator />

              {/* AI Learning Section */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Brain className="h-4 w-4" />
                  <Label className="font-medium">AI Learning</Label>
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="feedback_learning_enabled" className="text-sm">Learn from my decisions</Label>
                    <p className="text-xs text-muted-foreground">
                      AI will learn from which leads you approve/reject to improve future discovery
                    </p>
                  </div>
                  <Switch
                    id="feedback_learning_enabled"
                    checked={localSettings?.feedback_learning_enabled ?? true}
                    onCheckedChange={(checked) => handleSettingsChange('feedback_learning_enabled', checked)}
                  />
                </div>

                {settings && (settings.total_approved > 0 || settings.total_rejected > 0) && (
                  <div className="p-3 bg-muted/50 rounded-lg text-sm">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-1">
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                        <span>{settings.total_approved || 0} approved</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <XCircle className="h-4 w-4 text-red-600" />
                        <span>{settings.total_rejected || 0} rejected</span>
                      </div>
                    </div>
                    {settings.learned_industries?.length > 0 && (
                      <p className="mt-2 text-xs text-muted-foreground">
                        Preferred industries: {settings.learned_industries.slice(0, 3).join(', ')}
                      </p>
                    )}
                  </div>
                )}
              </div>

              <Separator />

              {/* Webhook Notifications */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Webhook className="h-4 w-4" />
                  <Label className="font-medium">Webhook Notifications</Label>
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="webhook_enabled" className="text-sm">Send webhook notifications</Label>
                    <p className="text-xs text-muted-foreground">
                      Get notified via Slack, Discord, or custom webhook
                    </p>
                  </div>
                  <Switch
                    id="webhook_enabled"
                    checked={localSettings?.webhook_enabled || false}
                    onCheckedChange={(checked) => handleSettingsChange('webhook_enabled', checked)}
                  />
                </div>

                {localSettings?.webhook_enabled && (
                  <div className="space-y-3 pl-4 border-l-2 border-muted">
                    <div className="space-y-2">
                      <Label htmlFor="webhook_url">Webhook URL</Label>
                      <Input
                        id="webhook_url"
                        placeholder="https://hooks.slack.com/... or Discord webhook URL"
                        value={localSettings?.webhook_url || ''}
                        onChange={(e) => handleSettingsChange('webhook_url', e.target.value)}
                      />
                    </div>

                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="notify_on_auto_approve"
                        checked={localSettings?.notify_on_auto_approve ?? true}
                        onCheckedChange={(checked) => handleSettingsChange('notify_on_auto_approve', checked)}
                      />
                      <Label htmlFor="notify_on_auto_approve" className="text-sm">
                        Notify on auto-approved leads
                      </Label>
                    </div>

                    <div className="space-y-2">
                      <Label>Minimum quality score for notifications: {localSettings?.notify_min_quality_score || 70}</Label>
                      <Slider
                        value={[localSettings?.notify_min_quality_score || 70]}
                        onValueChange={([value]) => handleSettingsChange('notify_min_quality_score', value)}
                        min={0}
                        max={100}
                        step={10}
                        className="w-64"
                      />
                    </div>
                  </div>
                )}
              </div>

              <Separator />

              {/* Custom Search Query */}
              <div className="space-y-2">
                <Label htmlFor="custom_search_query">Custom Search Query (optional)</Label>
                <Input
                  id="custom_search_query"
                  placeholder="e.g., SaaS companies in fintech with 50-200 employees"
                  value={localSettings?.custom_search_query || ''}
                  onChange={(e) => handleSettingsChange('custom_search_query', e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Override the default search based on your business profile
                </p>
              </div>

              {/* Save Button */}
              <Button 
                onClick={handleSaveSettings}
                disabled={saveSettingsMutation.isPending}
              >
                {saveSettingsMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Save Settings
              </Button>

              {/* Status Info */}
              {settings && (
                <div className="mt-6 p-4 bg-muted rounded-lg">
                  <h4 className="font-medium mb-2 flex items-center gap-2">
                    <Zap className="h-4 w-4" />
                    Discovery Status
                  </h4>
                  <div className="text-sm text-muted-foreground space-y-1">
                    <p>Last run: {settings.last_run_at ? new Date(settings.last_run_at).toLocaleString() : 'Never'}</p>
                    <p>Next scheduled: {settings.next_run_at ? new Date(settings.next_run_at).toLocaleString() : 'Not scheduled'}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics">
          <LeadAnalyticsDashboard />
        </TabsContent>

        {/* Personas Tab */}
        <TabsContent value="personas">
          <PersonaManager />
        </TabsContent>
      </Tabs>

      {/* Company Details Dialog */}
      {selectedLead && (
        <CompanyDetailsDialog
          company={selectedLead}
          open={dialogOpen}
          onOpenChange={setDialogOpen}
        />
      )}
    </div>
  );
}
