import { useState, useMemo } from "react";
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
  Play,
  Calendar,
  Filter,
  AtSign
} from "lucide-react";
import { QualityScoreBadge } from "@/components/lead-finder/QualityScoreBadge";
import { CompanyDetailsDialog } from "@/components/CompanyDetailsDialog";
import { LeadAnalyticsDashboard } from "@/components/lead-inbox/LeadAnalyticsDashboard";
import { PersonaManager } from "@/components/lead-inbox/PersonaManager";
import { LeadCard } from "@/components/lead-inbox/LeadCard";
import { EmptyState } from "@/components/lead-inbox/EmptyState";
import { StatsHeader } from "@/components/lead-inbox/StatsHeader";
import { DiscoveryBatchHeader } from "@/components/lead-inbox/DiscoveryBatchHeader";
import { startOfDay, subDays, isAfter, format } from "date-fns";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useCompanyTags } from "@/hooks/use-company-tags";

type LeadStatus = 'pending' | 'approved' | 'rejected' | 'auto_approved';
type DateFilter = 'today' | 'last7days' | 'last30days' | 'all';
type GroupBy = 'date' | 'persona';

interface LeadBatch {
  date: string;
  leads: any[];
  avgQualityScore: number;
  sourceBreakdown: Record<string, number>;
  statusBreakdown: Record<string, number>;
  personaId?: string;
  personaName?: string;
}

export default function LeadInbox() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [selectedLeads, setSelectedLeads] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<LeadStatus | 'all'>('pending');
  const [selectedLead, setSelectedLead] = useState<any>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dateFilter, setDateFilter] = useState<DateFilter>('today');
  const [expandedBatches, setExpandedBatches] = useState<Set<string>>(new Set(['today']));
  const [groupBy, setGroupBy] = useState<GroupBy>('date');
  const [personaFilter, setPersonaFilter] = useState<string>('all');
  const [isExtractingEmails, setIsExtractingEmails] = useState(false);
  const [extractionProgress, setExtractionProgress] = useState<{ current: number; total: number; companyName: string } | null>(null);
  const [approveCategoryTag, setApproveCategoryTag] = useState("");
  const { allSuggestions: categoryTagSuggestions } = useCompanyTags();
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

  // Fetch personas for filtering and display
  const { data: personas } = useQuery({
    queryKey: ['discovery-personas'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('discovery_personas')
        .select('id, name, is_active')
        .eq('user_id', user?.id)
        .order('name');
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
  });

  // Create persona lookup map
  const personaMap = useMemo(() => {
    const map = new Map<string, string>();
    (personas || []).forEach(p => map.set(p.id, p.name));
    return map;
  }, [personas]);

  // Filter leads by date/persona and group into batches
  const { filteredLeads, leadBatches } = useMemo(() => {
    if (!leads) return { filteredLeads: [], leadBatches: [] };

    // Apply date filter
    const now = new Date();
    const todayStart = startOfDay(now);
    const last7DaysStart = subDays(todayStart, 7);
    const last30DaysStart = subDays(todayStart, 30);

    let filtered = leads;
    if (dateFilter === 'today') {
      filtered = leads.filter(l => isAfter(new Date(l.created_at), todayStart));
    } else if (dateFilter === 'last7days') {
      filtered = leads.filter(l => isAfter(new Date(l.created_at), last7DaysStart));
    } else if (dateFilter === 'last30days') {
      filtered = leads.filter(l => isAfter(new Date(l.created_at), last30DaysStart));
    }

    // Apply persona filter
    if (personaFilter !== 'all') {
      filtered = filtered.filter(l => l.persona_id === personaFilter);
    }

    // Group leads based on groupBy selection
    const batchMap = new Map<string, any[]>();
    
    if (groupBy === 'persona') {
      // Group by persona
      filtered.forEach(lead => {
        const key = lead.persona_id || 'no-persona';
        if (!batchMap.has(key)) {
          batchMap.set(key, []);
        }
        batchMap.get(key)!.push(lead);
      });
    } else {
      // Group by date (day)
      filtered.forEach(lead => {
        const dateKey = format(new Date(lead.created_at), 'yyyy-MM-dd');
        if (!batchMap.has(dateKey)) {
          batchMap.set(dateKey, []);
        }
        batchMap.get(dateKey)!.push(lead);
      });
    }

    // Convert to batch objects with stats
    const batches: LeadBatch[] = Array.from(batchMap.entries()).map(([key, batchLeads]) => {
      // Calculate avg quality score
      const totalScore = batchLeads.reduce((sum, l) => sum + (l.quality_score || 0), 0);
      const avgQualityScore = Math.round(totalScore / batchLeads.length);

      // Calculate source breakdown
      const sourceBreakdown: Record<string, number> = {};
      batchLeads.forEach(l => {
        const sources = l.sources_used || [l.source || 'unknown'];
        sources.forEach((src: string) => {
          sourceBreakdown[src] = (sourceBreakdown[src] || 0) + 1;
        });
      });

      // Calculate status breakdown
      const statusBreakdown: Record<string, number> = { pending: 0, approved: 0, auto_approved: 0, rejected: 0 };
      batchLeads.forEach(l => {
        statusBreakdown[l.status] = (statusBreakdown[l.status] || 0) + 1;
      });

      // Get persona info for the batch
      const personaId = groupBy === 'persona' ? (key === 'no-persona' ? undefined : key) : batchLeads[0]?.persona_id;
      const personaName = personaId ? personaMap.get(personaId) : undefined;

      return {
        date: groupBy === 'date' ? key : (batchLeads[0]?.created_at || key),
        leads: batchLeads,
        avgQualityScore,
        sourceBreakdown,
        statusBreakdown,
        personaId,
        personaName,
      };
    });

    // Sort batches
    if (groupBy === 'date') {
      batches.sort((a, b) => b.date.localeCompare(a.date));
    } else {
      // Sort by lead count for persona grouping
      batches.sort((a, b) => b.leads.length - a.leads.length);
    }

    return { filteredLeads: filtered, leadBatches: batches };
  }, [leads, dateFilter, personaFilter, groupBy, personaMap]);

  const toggleBatchExpanded = (dateKey: string) => {
    setExpandedBatches(prev => {
      const newSet = new Set(prev);
      if (newSet.has(dateKey)) {
        newSet.delete(dateKey);
      } else {
        newSet.add(dateKey);
      }
      return newSet;
    });
  };

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

  // Approve lead mutation (accepts leadIds or { leadIds, category? })
  const approveLeadMutation = useMutation({
    mutationFn: async (arg: string[] | { leadIds: string[]; category?: string }) => {
      const leadIds = Array.isArray(arg) ? arg : arg.leadIds;
      const category = !Array.isArray(arg) && arg?.category ? arg.category : undefined;
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

        // Prepare tags: suggested tags + industry + optional category
        const tagsToApply: string[] = [];
        const suggestedTags = (companyData.suggestedTags || lead.enrichment_data?.suggestedTags || []) as string[];
        tagsToApply.push(...suggestedTags);
        if (lead.industry) {
          tagsToApply.push(lead.industry);
        }
        tagsToApply.push('Lead Inbox');
        if (category) tagsToApply.push(category);
        const uniqueTags = Array.from(new Set(tagsToApply.filter(Boolean)));

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
            tags: uniqueTags.length > 0 ? uniqueTags : null,
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

  // Batch enroll in sequence handler
  const handleBatchEnrollInSequence = async (leadIds: string[], sequenceId: string) => {
    // First get the approved leads that have company_ids
    const { data: leadsToEnroll } = await supabase
      .from('autonomous_leads')
      .select('company_id')
      .in('id', leadIds)
      .not('company_id', 'is', null);

    if (!leadsToEnroll || leadsToEnroll.length === 0) {
      toast({ title: 'No approved leads', description: 'Please approve leads first before enrolling them in a sequence.', variant: 'destructive' });
      return;
    }

    const companyIds = leadsToEnroll.map(l => l.company_id).filter(Boolean);
    
    for (const companyId of companyIds) {
      await enrollInSequence(companyId as string, sequenceId);
    }

    toast({ 
      title: 'Enrolled in sequence', 
      description: `${companyIds.length} companies enrolled in the selected sequence.`
    });
  };

  // Batch create campaign handler
  const handleBatchCreateCampaign = async (leadIds: string[]) => {
    // Get approved leads with company data
    const { data: leadsForCampaign } = await supabase
      .from('autonomous_leads')
      .select('*')
      .in('id', leadIds)
      .not('company_id', 'is', null);

    if (!leadsForCampaign || leadsForCampaign.length === 0) {
      toast({ title: 'No approved leads', description: 'Please approve leads first before creating a campaign.', variant: 'destructive' });
      return;
    }

    // Navigate to campaigns with state (you could also create a draft campaign directly)
    toast({ 
      title: 'Campaign ready', 
      description: `${leadsForCampaign.length} leads ready for campaign. Go to Campaigns to create a new campaign.`
    });
  };

  // Bulk email extraction handler
  const handleBulkExtractEmails = async (leadIds: string[]) => {
    if (leadIds.length === 0) {
      toast({ title: 'No leads to extract', description: 'All leads already have emails or no website.', variant: 'destructive' });
      return;
    }

    setIsExtractingEmails(true);
    setExtractionProgress({ current: 0, total: leadIds.length, companyName: '' });

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/bulk-extract-emails`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ leadIds }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to start extraction');
      }

      // Handle SSE stream
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let successCount = 0;
      let failedCount = 0;

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const text = decoder.decode(value);
          const lines = text.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const event = JSON.parse(line.slice(6));
                
                if (event.type === 'progress') {
                  setExtractionProgress({
                    current: event.current,
                    total: event.total,
                    companyName: event.companyName,
                  });
                } else if (event.type === 'extracted') {
                  successCount++;
                } else if (event.type === 'failed') {
                  failedCount++;
                } else if (event.type === 'complete') {
                  toast({
                    title: 'Email extraction complete',
                    description: `Extracted ${event.success} emails, ${event.failed} failed out of ${event.total} leads.`,
                  });
                }
              } catch (e) {
                // Ignore parse errors
              }
            }
          }
        }
      }

      // Refresh data
      queryClient.invalidateQueries({ queryKey: ['autonomous-leads'] });
    } catch (error) {
      toast({
        title: 'Extraction failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setIsExtractingEmails(false);
      setExtractionProgress(null);
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
    setLocalSettings({
      ...settings,
      // Set default timezone to user's browser timezone if not set
      timezone: settings.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
    });
  }

  // Helper function to format time in user's timezone
  // Shows the hour with timezone abbreviation
  const formatTimeInTimezone = (hour: number, timezone?: string) => {
    const tz = timezone || localSettings?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
    // Format hour as 12-hour time
    const hour12 = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
    const ampm = hour >= 12 ? 'PM' : 'AM';
    // Get timezone abbreviation
    const tzAbbr = new Date().toLocaleString('en-US', { timeZone: tz, timeZoneName: 'short' }).split(' ').pop() || '';
    return `${hour12}:00 ${ampm} ${tzAbbr}`;
  };

  // Helper function to format date/time in user's timezone
  const formatDateTimeInTimezone = (dateString: string, timezone?: string) => {
    const tz = timezone || localSettings?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
    const date = new Date(dateString);
    const formatted = date.toLocaleString('en-US', {
      timeZone: tz,
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
    const tzAbbr = date.toLocaleString('en-US', { timeZone: tz, timeZoneName: 'short' }).split(' ').pop() || '';
    return `${formatted} ${tzAbbr}`;
  };

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
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2 sm:gap-3">
            <div className="p-1.5 sm:p-2 rounded-lg sm:rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 shrink-0">
              <Inbox className="h-5 w-5 sm:h-7 sm:w-7 text-primary" />
            </div>
            <span className="truncate">Lead Inbox</span>
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-1 hidden sm:block">
            Review and approve leads discovered automatically by AI
          </p>
        </div>
        {settings?.enabled && (
          <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-200 self-start shrink-0">
            <Zap className="h-3 w-3 mr-1" />
            Discovery Active
          </Badge>
        )}
      </div>

      {/* Stats Overview */}
      {statusCounts && statusCounts.all > 0 && (
        <StatsHeader counts={statusCounts} />
      )}

      <Tabs defaultValue="inbox" className="space-y-4 sm:space-y-6">
        <TabsList className="w-full sm:w-auto flex-wrap h-auto gap-1 p-1">
          <TabsTrigger value="inbox" className="gap-1.5 text-xs sm:text-sm">
            <Inbox className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            <span className="hidden xs:inline">Inbox</span>
            {(statusCounts?.pending || 0) > 0 && (
              <Badge variant="secondary" className="ml-0.5 sm:ml-1 text-[10px] sm:text-xs px-1 sm:px-1.5">{statusCounts?.pending}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="analytics" className="gap-1.5 text-xs sm:text-sm">
            <BarChart3 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            <span className="hidden xs:inline">Analytics</span>
          </TabsTrigger>
          <TabsTrigger value="personas" className="gap-1.5 text-xs sm:text-sm">
            <Target className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            <span className="hidden xs:inline">Personas</span>
          </TabsTrigger>
          <TabsTrigger value="settings" className="gap-1.5 text-xs sm:text-sm">
            <Settings className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            <span className="hidden xs:inline">Settings</span>
          </TabsTrigger>
        </TabsList>

        {/* Inbox Tab */}
        <TabsContent value="inbox" className="space-y-4">
          {/* Status Filter Tabs */}
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
              <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
                <TabsList className="h-auto p-1 inline-flex">
                  <TabsTrigger value="pending" className="gap-1 text-xs sm:text-sm px-2 sm:px-3">
                    <Clock className="h-3 w-3" />
                    <span className="hidden sm:inline">Pending</span> ({statusCounts?.pending || 0})
                  </TabsTrigger>
                  <TabsTrigger value="approved" className="gap-1 text-xs sm:text-sm px-2 sm:px-3">
                    <CheckCircle2 className="h-3 w-3" />
                    <span className="hidden sm:inline">Approved</span> ({statusCounts?.approved || 0})
                  </TabsTrigger>
                  <TabsTrigger value="auto_approved" className="gap-1 text-xs sm:text-sm px-2 sm:px-3">
                    <Zap className="h-3 w-3" />
                    <span className="hidden sm:inline">Auto</span> ({statusCounts?.auto_approved || 0})
                  </TabsTrigger>
                  <TabsTrigger value="rejected" className="gap-1 text-xs sm:text-sm px-2 sm:px-3">
                    <XCircle className="h-3 w-3" />
                    <span className="hidden sm:inline">Rejected</span> ({statusCounts?.rejected || 0})
                  </TabsTrigger>
                  <TabsTrigger value="all" className="text-xs sm:text-sm px-2 sm:px-3">All ({statusCounts?.all || 0})</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Persona Filter */}
              <Select value={personaFilter} onValueChange={setPersonaFilter}>
                <SelectTrigger className="w-[130px] sm:w-[160px] h-8 text-xs sm:text-sm">
                  <Target className="h-3 w-3 sm:h-3.5 sm:w-3.5 mr-1 text-muted-foreground shrink-0" />
                  <SelectValue placeholder="All Personas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Personas</SelectItem>
                  {(personas || []).map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Date Filter */}
              <Select value={dateFilter} onValueChange={(v) => setDateFilter(v as DateFilter)}>
                <SelectTrigger className="w-[110px] sm:w-[140px] h-8 text-xs sm:text-sm">
                  <Calendar className="h-3 w-3 sm:h-3.5 sm:w-3.5 mr-1 text-muted-foreground shrink-0" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="last7days">Last 7 days</SelectItem>
                  <SelectItem value="last30days">Last 30 days</SelectItem>
                  <SelectItem value="all">All time</SelectItem>
                </SelectContent>
              </Select>

              {/* Grouping Toggle - Hidden on small screens */}
              <div className="hidden md:flex items-center gap-1 bg-muted rounded-md p-0.5">
                <Button
                  variant={groupBy === 'date' ? 'secondary' : 'ghost'}
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() => setGroupBy('date')}
                >
                  <Calendar className="h-3 w-3 mr-1" />
                  Date
                </Button>
                <Button
                  variant={groupBy === 'persona' ? 'secondary' : 'ghost'}
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() => setGroupBy('persona')}
                >
                  <Target className="h-3 w-3 mr-1" />
                  Persona
                </Button>
              </div>

              {/* Bulk Approve Above Threshold - Hidden on mobile */}
              {activeTab === 'pending' && filteredLeads && filteredLeads.length > 0 && (
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => {
                    const threshold = settings?.auto_approve_threshold || 70;
                    const leadsAboveThreshold = filteredLeads.filter(l => (l.quality_score || 0) >= threshold);
                    if (leadsAboveThreshold.length > 0) {
                      approveLeadMutation.mutate({ leadIds: leadsAboveThreshold.map(l => l.id), category: approveCategoryTag?.trim() || undefined });
                    } else {
                      toast({ title: 'No leads above threshold', description: `No leads with quality score ≥ ${threshold}` });
                    }
                  }}
                  disabled={approveLeadMutation.isPending}
                  className="gap-1 text-green-600 border-green-200 hover:bg-green-50 hidden sm:flex text-xs"
                >
                  <Zap className="h-3.5 w-3.5" />
                  <span className="hidden lg:inline">Approve All</span> ≥{settings?.auto_approve_threshold || 70}
                </Button>
              )}
              
              {/* Extract All Missing Emails Button */}
              {filteredLeads && filteredLeads.length > 0 && (() => {
                const leadsNeedingEmail = filteredLeads.filter(l => {
                  const companyData = (l.company_data || {}) as Record<string, any>;
                  const hasWebsite = l.company_website && 
                    !l.company_website.includes('no-website') && 
                    l.company_website.trim() !== '';
                  const hasEmail = companyData.generalEmail || 
                    companyData.general_email || 
                    companyData.email;
                  return hasWebsite && !hasEmail;
                });
                
                return leadsNeedingEmail.length > 0 ? (
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => handleBulkExtractEmails(leadsNeedingEmail.map(l => l.id))}
                    disabled={isExtractingEmails}
                    className="gap-1 text-blue-600 border-blue-200 hover:bg-blue-50 hidden sm:flex text-xs"
                  >
                    {isExtractingEmails ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <AtSign className="h-3.5 w-3.5" />
                    )}
                    <span className="hidden lg:inline">Extract Emails</span> ({leadsNeedingEmail.length})
                  </Button>
                ) : null;
              })()}
              
              <Button variant="outline" size="sm" onClick={() => refetchLeads()} className="h-8 px-2 sm:px-3">
                <RefreshCw className="h-3.5 w-3.5 sm:mr-1" />
                <span className="hidden sm:inline text-xs">Refresh</span>
              </Button>
            </div>
          </div>

          {/* Bulk Actions */}
          {selectedLeads.size > 0 && (
            <Card className="border-primary/50 bg-primary/5">
              <CardContent className="flex flex-wrap items-center justify-between gap-2 py-3">
                <span className="text-sm font-medium">
                  {selectedLeads.size} lead{selectedLeads.size !== 1 ? 's' : ''} selected
                </span>
                <div className="flex items-center gap-2 flex-wrap">
                  {activeTab === 'pending' && (
                    <>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button type="button" variant="outline" size="sm" className="gap-1.5" title="Add approved leads to a category">
                            Category: {approveCategoryTag ? <Badge variant="secondary" className="font-normal text-xs">{approveCategoryTag}</Badge> : "Optional"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-72" align="end">
                          <div className="space-y-2">
                            <Label className="text-xs">Add to category when approving (optional)</Label>
                            <Input
                              placeholder="e.g. Healthcare Sales"
                              value={approveCategoryTag}
                              onChange={(e) => setApproveCategoryTag(e.target.value)}
                              list="lead-inbox-approve-category-list"
                              className="h-8 text-sm"
                            />
                            <datalist id="lead-inbox-approve-category-list">
                              {(categoryTagSuggestions || []).slice(0, 30).map((tag) => (
                                <option key={tag} value={tag} />
                              ))}
                            </datalist>
                            {approveCategoryTag && <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setApproveCategoryTag("")}>Clear</Button>}
                          </div>
                        </PopoverContent>
                      </Popover>
                      <Button 
                        size="sm" 
                        onClick={() => approveLeadMutation.mutate({ leadIds: Array.from(selectedLeads), category: approveCategoryTag?.trim() || undefined })}
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

          {/* Email Extraction Progress */}
          {isExtractingEmails && extractionProgress && (
            <Card className="border-blue-200 bg-blue-50/50">
              <CardContent className="py-4">
                <div className="flex items-center gap-4">
                  <div className="p-2 rounded-full bg-blue-100">
                    <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-blue-900">
                        Extracting emails... {extractionProgress.current}/{extractionProgress.total}
                      </span>
                      <span className="text-xs text-blue-600">
                        {Math.round((extractionProgress.current / extractionProgress.total) * 100)}%
                      </span>
                    </div>
                    <div className="w-full bg-blue-200 rounded-full h-2">
                      <div 
                        className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${(extractionProgress.current / extractionProgress.total) * 100}%` }}
                      />
                    </div>
                    {extractionProgress.companyName && (
                      <p className="text-xs text-blue-700 mt-1.5">
                        Current: {extractionProgress.companyName}
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Leads List */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <CardTitle className="text-lg font-semibold">Discovered Leads</CardTitle>
                  {filteredLeads.length !== (leads?.length || 0) && (
                    <Badge variant="secondary" className="text-xs">
                      Showing {filteredLeads.length} of {leads?.length || 0}
                    </Badge>
                  )}
                </div>
                {filteredLeads.length > 0 && (
                  <div className="flex items-center gap-2">
                    <Checkbox 
                      checked={selectedLeads.size === filteredLeads.length && filteredLeads.length > 0}
                      onCheckedChange={() => {
                        if (selectedLeads.size === filteredLeads.length) {
                          setSelectedLeads(new Set());
                        } else {
                          setSelectedLeads(new Set(filteredLeads.map(l => l.id)));
                        }
                      }}
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
              ) : filteredLeads.length === 0 ? (
                dateFilter !== 'all' && (leads?.length || 0) > 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <Filter className="h-10 w-10 text-muted-foreground/50 mb-4" />
                    <p className="text-muted-foreground font-medium">No leads for this time period</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Try selecting a different date range or view "All time"
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-4"
                      onClick={() => setDateFilter('all')}
                    >
                      View all leads
                    </Button>
                  </div>
                ) : (
                  <EmptyState 
                    type={activeTab} 
                    onGoToSettings={() => {
                      const tabsElement = document.querySelector('[data-state="active"][value="inbox"]');
                      // Simple navigation - user can click Settings tab
                    }}
                  />
                )
              ) : (
                <ScrollArea className="h-[600px] pr-4">
                  <div className="space-y-2">
                    {leadBatches.map((batch) => {
                      const isToday = groupBy === 'date' && new Date().toDateString() === new Date(batch.date).toDateString();
                      const batchKey = groupBy === 'persona' 
                        ? (batch.personaId || 'no-persona') 
                        : (isToday ? 'today' : batch.date);
                      const isExpanded = expandedBatches.has(batchKey) || expandedBatches.has(batch.date) || expandedBatches.has(batch.personaId || '');
                      
                      // Separate leads by status for batch actions
                      const pendingLeadIds = batch.leads.filter(l => l.status === 'pending').map(l => l.id);
                      const approvedLeadIds = batch.leads.filter(l => l.status === 'approved' || l.status === 'auto_approved').map(l => l.id);
                      const allLeadIds = batch.leads.map(l => l.id);
                      
                      // Find leads without email but with website
                      const leadsWithoutEmail = batch.leads.filter(l => {
                        const companyData = (l.company_data || {}) as Record<string, any>;
                        const hasWebsite = l.company_website && 
                          !l.company_website.includes('no-website') && 
                          l.company_website.trim() !== '';
                        const hasEmail = companyData.generalEmail && companyData.generalEmail.trim() !== '';
                        return hasWebsite && !hasEmail;
                      });
                      const leadIdsWithoutEmail = leadsWithoutEmail.map(l => l.id);
                      
                      return (
                        <DiscoveryBatchHeader
                          key={batchKey}
                          batchDate={batch.leads[0]?.created_at || batch.date}
                          leadCount={batch.leads.length}
                          avgQualityScore={batch.avgQualityScore}
                          sourceBreakdown={batch.sourceBreakdown}
                          statusBreakdown={batch.statusBreakdown}
                          isExpanded={isExpanded}
                          onToggle={() => toggleBatchExpanded(batchKey)}
                          personaName={batch.personaName}
                          personaId={batch.personaId}
                          batchLeadIds={allLeadIds}
                          pendingLeadIds={pendingLeadIds}
                          approvedLeadIds={approvedLeadIds}
                          sequences={sequences || []}
                          onApproveAll={(ids) => approveLeadMutation.mutate({ leadIds: ids, category: approveCategoryTag?.trim() || undefined })}
                          onRejectAll={(ids) => rejectLeadMutation.mutate(ids)}
                          onDeleteAll={(ids) => deleteLeadMutation.mutate(ids)}
                          onEnrollInSequence={handleBatchEnrollInSequence}
                          onCreateCampaign={handleBatchCreateCampaign}
                          onExtractEmails={handleBulkExtractEmails}
                          leadsWithoutEmailCount={leadsWithoutEmail.length}
                          leadIdsWithoutEmail={leadIdsWithoutEmail}
                          isActionsLoading={approveLeadMutation.isPending || rejectLeadMutation.isPending || deleteLeadMutation.isPending}
                          isExtractingEmails={isExtractingEmails}
                        >
                          {batch.leads.map((lead) => (
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
                              onApprove={() => approveLeadMutation.mutate({ leadIds: [lead.id], category: approveCategoryTag?.trim() || undefined })}
                              onReject={() => rejectLeadMutation.mutate([lead.id])}
                              isPending={approveLeadMutation.isPending || rejectLeadMutation.isPending}
                              personaName={personaMap.get(lead.persona_id)}
                            />
                          ))}
                        </DiscoveryBatchHeader>
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Discovery Frequency</Label>
                  <Select
                    value={localSettings?.discovery_frequency || 'daily'}
                    onValueChange={(value) => handleSettingsChange('discovery_frequency', value)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="twice_weekly">Twice a week</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Timezone</Label>
                  <Select
                    value={localSettings?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone}
                    onValueChange={(value) => handleSettingsChange('timezone', value)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue>
                        {localSettings?.timezone 
                          ? (() => {
                              const tz = localSettings.timezone;
                              const offset = new Date().toLocaleString('en-US', { timeZone: tz, timeZoneName: 'short' }).split(' ').pop() || '';
                              return `${tz.replace(/_/g, ' ')} (${offset})`;
                            })()
                          : Intl.DateTimeFormat().resolvedOptions().timeZone
                        }
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent className="max-h-[300px]">
                      {Intl.supportedValuesOf('timeZone')
                        .sort()
                        .map((tz) => {
                          const now = new Date();
                          const offset = now.toLocaleString('en-US', { timeZone: tz, timeZoneName: 'short' }).split(' ').pop() || '';
                          const displayName = tz.replace(/_/g, ' ');
                          return (
                            <SelectItem key={tz} value={tz}>
                              {displayName} ({offset})
                            </SelectItem>
                          );
                        })}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Your local timezone for scheduling. All times will be displayed in this timezone.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Preferred Delivery Time</Label>
                  <Select
                    value={String(localSettings?.preferred_discovery_hour ?? 9)}
                    onValueChange={(value) => handleSettingsChange('preferred_discovery_hour', parseInt(value))}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="6">6:00 AM (Early Morning)</SelectItem>
                      <SelectItem value="9">9:00 AM (Morning)</SelectItem>
                      <SelectItem value="12">12:00 PM (Midday)</SelectItem>
                      <SelectItem value="15">3:00 PM (Afternoon)</SelectItem>
                      <SelectItem value="18">6:00 PM (Evening)</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    When you want fresh leads delivered to your inbox (in your timezone)
                  </p>
                </div>
              </div>

              {/* Max Leads */}
              <div className="space-y-2">
                <Label>Leads per discovery run: {localSettings?.max_leads_per_run ?? 25}</Label>
                <Slider
                  value={[localSettings?.max_leads_per_run ?? 25]}
                  onValueChange={([value]) => handleSettingsChange('max_leads_per_run', value)}
                  min={5}
                  max={50}
                  step={5}
                  className="w-64"
                />
              </div>

              <Separator />

              {/* Discovery Sources */}
              <div className="space-y-4">
                <Label className="font-medium">Discovery Sources</Label>
                <p className="text-xs text-muted-foreground">Enable multiple sources for maximum lead coverage</p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="enrich_with_perplexity"
                      checked={localSettings?.enrich_with_perplexity ?? true}
                      onCheckedChange={(checked) => handleSettingsChange('enrich_with_perplexity', checked)}
                    />
                    <Label htmlFor="enrich_with_perplexity" className="text-sm">
                      Enrich with Perplexity AI
                    </Label>
                  </div>

                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="use_serp_api"
                      checked={localSettings?.use_serp_api ?? true}
                      onCheckedChange={(checked) => handleSettingsChange('use_serp_api', checked)}
                    />
                    <Label htmlFor="use_serp_api" className="text-sm">
                      Google Search (SerpAPI)
                    </Label>
                  </div>

                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="use_apify"
                      checked={localSettings?.use_apify ?? true}
                      onCheckedChange={(checked) => handleSettingsChange('use_apify', checked)}
                    />
                    <Label htmlFor="use_apify" className="text-sm">
                      Google Maps (Apify) - up to 300 local leads
                    </Label>
                  </div>
                </div>

                {localSettings?.use_apify && (
                  <div className="pl-4 border-l-2 border-muted space-y-2">
                    <Label>Apify max results: {localSettings?.apify_max_results || 100}</Label>
                    <Slider
                      value={[localSettings?.apify_max_results || 100]}
                      onValueChange={([value]) => handleSettingsChange('apify_max_results', value)}
                      min={20}
                      max={300}
                      step={20}
                      className="w-64"
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <Label>Daily lead target: {localSettings?.daily_lead_target || 50}</Label>
                  <Slider
                    value={[localSettings?.daily_lead_target || 50]}
                    onValueChange={([value]) => handleSettingsChange('daily_lead_target', value)}
                    min={10}
                    max={200}
                    step={10}
                    className="w-64"
                  />
                  <p className="text-xs text-muted-foreground">
                    Target total leads across all sources per discovery run
                  </p>
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

              {/* Auto-Extract Emails */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <AtSign className="h-4 w-4" />
                  <Label className="font-medium">Auto Email Extraction</Label>
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="auto_extract_emails" className="text-sm">Auto-extract emails for auto-approved leads</Label>
                    <p className="text-xs text-muted-foreground">
                      Automatically find contact emails for high-quality leads during discovery
                    </p>
                  </div>
                  <Switch
                    id="auto_extract_emails"
                    checked={localSettings?.auto_extract_emails || false}
                    onCheckedChange={(checked) => handleSettingsChange('auto_extract_emails', checked)}
                  />
                </div>
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

              {/* Auto Campaign Creation */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  <Label className="font-medium">Auto Campaign Creation</Label>
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="auto_create_campaign" className="text-sm">Create campaigns from auto-approved leads</Label>
                    <p className="text-xs text-muted-foreground">
                      Automatically create email campaign drafts from high-quality leads
                    </p>
                  </div>
                  <Switch
                    id="auto_create_campaign"
                    checked={localSettings?.auto_create_campaign || false}
                    onCheckedChange={(checked) => handleSettingsChange('auto_create_campaign', checked)}
                  />
                </div>

                {localSettings?.auto_create_campaign && (
                  <div className="space-y-3 pl-4 border-l-2 border-muted">
                    <div className="space-y-2">
                      <Label>Campaign send time</Label>
                      <Select
                        value={localSettings?.campaign_send_time || '10:00'}
                        onValueChange={(value) => handleSettingsChange('campaign_send_time', value)}
                      >
                        <SelectTrigger className="w-48">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="09:00">9:00 AM</SelectItem>
                          <SelectItem value="10:00">10:00 AM</SelectItem>
                          <SelectItem value="11:00">11:00 AM</SelectItem>
                          <SelectItem value="14:00">2:00 PM</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        Time in your selected timezone
                      </p>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label htmlFor="full_auto_mode" className="text-sm">Full auto mode</Label>
                        <p className="text-xs text-muted-foreground">
                          Send campaigns automatically without review
                        </p>
                      </div>
                      <Switch
                        id="full_auto_mode"
                        checked={localSettings?.full_auto_mode || false}
                        onCheckedChange={(checked) => handleSettingsChange('full_auto_mode', checked)}
                      />
                    </div>
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
                  <Label className="font-medium">Notifications</Label>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="slack_webhook_url">Slack Webhook URL</Label>
                    <Input
                      id="slack_webhook_url"
                      placeholder="https://hooks.slack.com/services/..."
                      value={localSettings?.slack_webhook_url || ''}
                      onChange={(e) => handleSettingsChange('slack_webhook_url', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="discord_webhook_url">Discord Webhook URL</Label>
                    <Input
                      id="discord_webhook_url"
                      placeholder="https://discord.com/api/webhooks/..."
                      value={localSettings?.discord_webhook_url || ''}
                      onChange={(e) => handleSettingsChange('discord_webhook_url', e.target.value)}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="notify_on_discovery_complete" className="text-sm">Notify on discovery complete</Label>
                    <p className="text-xs text-muted-foreground">Get notified when lead discovery finishes</p>
                  </div>
                  <Switch
                    id="notify_on_discovery_complete"
                    checked={localSettings?.notify_on_discovery_complete ?? true}
                    onCheckedChange={(checked) => handleSettingsChange('notify_on_discovery_complete', checked)}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="notify_on_hot_leads" className="text-sm">Alert for hot leads</Label>
                    <p className="text-xs text-muted-foreground">Instant notification for high-quality leads</p>
                  </div>
                  <Switch
                    id="notify_on_hot_leads"
                    checked={localSettings?.notify_on_hot_leads ?? true}
                    onCheckedChange={(checked) => handleSettingsChange('notify_on_hot_leads', checked)}
                  />
                </div>

                {localSettings?.notify_on_hot_leads && (
                  <div className="space-y-2 pl-4 border-l-2 border-muted">
                    <Label>Hot lead threshold: {localSettings?.hot_lead_threshold || 80}</Label>
                    <Slider
                      value={[localSettings?.hot_lead_threshold || 80]}
                      onValueChange={([value]) => handleSettingsChange('hot_lead_threshold', value)}
                      min={50}
                      max={95}
                      step={5}
                      className="w-64"
                    />
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
              <div className="mt-6 p-4 bg-gradient-to-br from-primary/10 to-primary/5 rounded-lg border border-primary/20">
                <h4 className="font-medium mb-3 flex items-center gap-2">
                  <Zap className="h-4 w-4 text-primary" />
                  Automated Discovery Status
                </h4>
                <div className="text-sm space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Automation:</span>
                    <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-200">
                      <Clock className="h-3 w-3 mr-1" />
                      Daily at {formatTimeInTimezone(localSettings?.preferred_discovery_hour ?? 9)}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Last run:</span>
                    <span className="font-medium">{settings?.last_run_at ? formatDateTimeInTimezone(settings.last_run_at) : 'Never'}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Next scheduled:</span>
                    <span className="font-medium">{settings?.next_run_at ? formatDateTimeInTimezone(settings.next_run_at) : 'Tomorrow at ' + formatTimeInTimezone(localSettings?.preferred_discovery_hour ?? 9)}</span>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-3 pt-3 border-t border-primary/10">
                  💡 Fresh leads are discovered automatically every morning while you sleep!
                </p>
              </div>
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
