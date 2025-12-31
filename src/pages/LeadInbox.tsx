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
  Phone, 
  Linkedin, 
  Settings, 
  Zap,
  Clock,
  Star,
  Users,
  RefreshCw,
  Loader2,
  Trash2
} from "lucide-react";
import { QualityScoreBadge } from "@/components/lead-finder/QualityScoreBadge";
import { CompanyDetailsDialog } from "@/components/CompanyDetailsDialog";

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

  // Approve lead mutation
  const approveLeadMutation = useMutation({
    mutationFn: async (leadIds: string[]) => {
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
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['autonomous-leads'] });
      queryClient.invalidateQueries({ queryKey: ['autonomous-leads-counts'] });
      queryClient.invalidateQueries({ queryKey: ['companies'] });
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
      const { error } = await supabase
        .from('autonomous_leads')
        .update({ status: 'rejected', reviewed_at: new Date().toISOString() })
        .in('id', leadIds);
      if (error) throw error;
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
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <Inbox className="h-8 w-8" />
          Lead Inbox
        </h1>
        <p className="text-muted-foreground">
          Review and approve leads discovered automatically by AI
        </p>
      </div>

      <Tabs defaultValue="inbox" className="space-y-6">
        <TabsList>
          <TabsTrigger value="inbox" className="gap-2">
            <Inbox className="h-4 w-4" />
            Inbox
            {(statusCounts?.pending || 0) > 0 && (
              <Badge variant="secondary" className="ml-1">{statusCounts?.pending}</Badge>
            )}
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
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Discovered Leads</CardTitle>
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
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : !leads || leads.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Inbox className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="font-medium">No leads in this category</p>
                  <p className="text-sm mt-1">Enable autonomous discovery in settings to start finding leads automatically.</p>
                </div>
              ) : (
                <ScrollArea className="h-[500px]">
                  <div className="space-y-3">
                    {leads.map((lead) => {
                      const companyData = (lead.company_data || {}) as Record<string, any>;
                      return (
                        <div 
                          key={lead.id}
                          className="flex items-start gap-3 p-4 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
                          onClick={() => handleViewLead(lead)}
                        >
                          <Checkbox 
                            checked={selectedLeads.has(lead.id)}
                            onCheckedChange={() => toggleLeadSelection(lead.id)}
                            onClick={(e) => e.stopPropagation()}
                          />
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                              <span className="font-medium truncate">{lead.company_name}</span>
                              <QualityScoreBadge score={lead.quality_score || 0} />
                              <Badge variant={
                                lead.status === 'approved' || lead.status === 'auto_approved' ? 'default' :
                                lead.status === 'rejected' ? 'destructive' : 'secondary'
                              }>
                                {lead.status === 'auto_approved' ? 'Auto' : lead.status}
                              </Badge>
                            </div>
                            
                            <div className="flex items-center gap-4 text-sm text-muted-foreground">
                              {lead.industry && <span>{lead.industry}</span>}
                              {lead.geography && <span>• {lead.geography}</span>}
                              {lead.company_size && <span>• {lead.company_size}</span>}
                            </div>

                            <div className="flex items-center gap-3 mt-2 text-sm">
                              {lead.company_website && (
                                <span className="flex items-center gap-1 text-muted-foreground">
                                  <Globe className="h-3 w-3" />
                                  {new URL(lead.company_website.startsWith('http') ? lead.company_website : `https://${lead.company_website}`).hostname}
                                </span>
                              )}
                              {companyData.generalEmail && (
                                <span className="flex items-center gap-1 text-muted-foreground">
                                  <Mail className="h-3 w-3" />
                                  Email
                                </span>
                              )}
                              {(lead.contacts as any[])?.length > 0 && (
                                <span className="flex items-center gap-1 text-muted-foreground">
                                  <Users className="h-3 w-3" />
                                  {(lead.contacts as any[]).length} contacts
                                </span>
                              )}
                            </div>
                          </div>

                          {lead.status === 'pending' && (
                            <div className="flex items-center gap-1 shrink-0">
                              <Button 
                                size="sm" 
                                variant="ghost"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  approveLeadMutation.mutate([lead.id]);
                                }}
                              >
                                <CheckCircle2 className="h-4 w-4 text-green-600" />
                              </Button>
                              <Button 
                                size="sm" 
                                variant="ghost"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  rejectLeadMutation.mutate([lead.id]);
                                }}
                              >
                                <XCircle className="h-4 w-4 text-red-600" />
                              </Button>
                            </div>
                          )}
                        </div>
                      );
                    })}
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
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5" />
                Autonomous Discovery Settings
              </CardTitle>
              <CardDescription>
                Configure how the AI automatically discovers leads for you
              </CardDescription>
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
                  <h4 className="font-medium mb-2">Discovery Status</h4>
                  <div className="text-sm text-muted-foreground space-y-1">
                    <p>Last run: {settings.last_run_at ? new Date(settings.last_run_at).toLocaleString() : 'Never'}</p>
                    <p>Next scheduled: {settings.next_run_at ? new Date(settings.next_run_at).toLocaleString() : 'Not scheduled'}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
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
