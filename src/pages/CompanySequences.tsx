import { useState, useEffect, useMemo, Fragment } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { 
  Mail, 
  Building2, 
  Play, 
  Pause, 
  CheckCircle2, 
  Clock, 
  Search,
  Filter,
  BarChart3,
  TrendingUp,
  ArrowUpRight,
  Eye,
  Send,
  Bot,
  MoreVertical,
  Trash2,
  Settings,
  ExternalLink,
  AlertTriangle,
  LayoutList
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useNavigate } from 'react-router-dom';
import { useUpdateSequenceStatus, useSendSequenceEmail } from '@/hooks/use-company-sequences';
import { CompanySequenceDetailsDialog } from '@/components/sequences/CompanySequenceDetailsDialog';
import { useMarkMultipleCampaignsAsViewed, useMarkCampaignAsViewed } from '@/hooks/use-campaign-views';

interface CompanySequence {
  id: string;
  company_id: string;
  sequence_id: string;
  status: 'draft' | 'active' | 'paused' | 'completed';
  current_step: number;
  personalized_emails: any[];
  auto_respond_enabled: boolean;
  automation_rules?: any;
  created_at: string;
  companies: {
    name: string;
    industry?: string;
    geography?: string;
  };
  email_sequences: {
    name: string;
    steps: any[];
    auto_respond: boolean;
  } | null;
  email_activities: Array<{
    id: string;
    step_number: number;
    status: string;
    sent_at?: string;
    opened_at?: string;
    replied_at?: string;
    metadata?: any;
  }>;
}

export default function CompanySequences() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [industryFilter, setIndustryFilter] = useState<string>('all');
  const [selectedSequence, setSelectedSequence] = useState<CompanySequence | null>(null);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [selectedSeqIds, setSelectedSeqIds] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);

  // Real-time updates for company sequences
  useEffect(() => {
    const channel = supabase
      .channel('company-sequences-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'company_sequences',
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['company-sequences-page'] });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'email_activities',
        },
        (payload) => {
          const activity = payload.new as any;
          if (activity.metadata?.auto_sent) {
            toast.success('Auto-Response Sent', {
              description: 'AI automatically responded to an email',
            });
            queryClient.invalidateQueries({ queryKey: ['company-sequences-page'] });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);
  
  const updateStatusMutation = useUpdateSequenceStatus();
  const sendEmailMutation = useSendSequenceEmail();
  const markMultipleCampaignsAsViewed = useMarkMultipleCampaignsAsViewed();
  const markCampaignAsViewed = useMarkCampaignAsViewed();

  const { data: companySequences, isLoading } = useQuery({
    queryKey: ['company-sequences-page', statusFilter, industryFilter],
    queryFn: async () => {
      let query = supabase
        .from('company_sequences')
        .select(`
          *,
          companies(name, industry, geography),
          email_sequences(name, steps, auto_respond),
          email_activities(id, step_number, status, sent_at, opened_at, replied_at, metadata)
        `)
        .order('created_at', { ascending: false });

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      const { data, error } = await query;
      
      if (error) throw error;
      return (data || []) as CompanySequence[];
    }
  });

  // Mark all active campaigns as viewed when page loads
  useEffect(() => {
    if (companySequences && companySequences.length > 0) {
      const activeCampaignIds = companySequences
        .filter(seq => seq.status === 'active')
        .map(seq => seq.id);
      
      if (activeCampaignIds.length > 0) {
        markMultipleCampaignsAsViewed.mutate(activeCampaignIds);
      }
    }
  }, [companySequences]);

  const filteredSequences = companySequences?.filter(seq => {
    const matchesSearch = !searchQuery || 
      seq.companies.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesIndustry = industryFilter === 'all' || 
      seq.companies.industry === industryFilter;
    return matchesSearch && matchesIndustry;
  });

  const industries = Array.from(new Set(companySequences?.map(s => s.companies.industry).filter(Boolean) || []));
  const maxSteps = Math.min(10, Math.max(1, ...(filteredSequences?.map(s => s.email_sequences?.steps?.length || 0) || [0])));

  // Resolve campaign names so sequences can be grouped by the bulk campaign they came from.
  const campaignIds = useMemo(
    () => Array.from(new Set((companySequences || []).map(s => (s as any).campaign_id).filter(Boolean))),
    [companySequences]
  );
  const { data: campaignNameMap = {} } = useQuery({
    queryKey: ['seq-campaign-names', campaignIds],
    enabled: campaignIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase.from('email_campaigns').select('id, name').in('id', campaignIds);
      const m: Record<string, string> = {};
      for (const c of data || []) m[c.id] = c.name;
      return m;
    },
  });

  // Group the (filtered) sequences by their originating campaign so you can track
  // who responded within each bulk campaign, instead of one flat list.
  const groupedSequences = useMemo(() => {
    const map = new Map<string, { key: string; name: string; seqs: CompanySequence[] }>();
    for (const seq of filteredSequences || []) {
      const cid = (seq as any).campaign_id || 'none';
      if (!map.has(cid)) {
        map.set(cid, { key: cid, name: cid === 'none' ? 'Standalone sequences' : (campaignNameMap[cid] || 'Campaign'), seqs: [] });
      }
      map.get(cid)!.seqs.push(seq);
    }
    // Named campaigns first, standalone last.
    return Array.from(map.values()).sort((a, b) => (a.key === 'none' ? 1 : b.key === 'none' ? -1 : a.name.localeCompare(b.name)));
  }, [filteredSequences, campaignNameMap]);

  const toggleSeq = (id: string) =>
    setSelectedSeqIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleGroup = (seqs: CompanySequence[]) =>
    setSelectedSeqIds(prev => {
      const n = new Set(prev);
      const allSelected = seqs.every(s => n.has(s.id));
      seqs.forEach(s => allSelected ? n.delete(s.id) : n.add(s.id));
      return n;
    });

  const handleBulkDeleteSequences = async () => {
    if (selectedSeqIds.size === 0) return;
    if (!confirm(`Delete ${selectedSeqIds.size} sequence(s)? This removes them and their tracking. This cannot be undone.`)) return;
    setBulkDeleting(true);
    try {
      const ids = Array.from(selectedSeqIds);
      const { error: actErr } = await supabase.from('email_activities').delete().in('company_sequence_id', ids);
      if (actErr) throw actErr;
      const { error } = await supabase.from('company_sequences').delete().in('id', ids);
      if (error) throw error;
      toast.success(`Deleted ${ids.length} sequence(s)`);
      setSelectedSeqIds(new Set());
      queryClient.invalidateQueries({ queryKey: ['company-sequences-page'] });
      queryClient.invalidateQueries({ queryKey: ['pending-counts'] });
    } catch (e: any) {
      toast.error(e?.message ?? 'Failed to delete sequences');
    } finally {
      setBulkDeleting(false);
    }
  };

  const handleStatusChange = async (id: string, status: 'draft' | 'active' | 'paused' | 'completed') => {
    await updateStatusMutation.mutateAsync({ id, status });
  };

  /** Activate a draft and kick off step 0 immediately (don't wait for hourly cron). */
  const handleActivateSequence = async (sequence: CompanySequence) => {
    try {
      await updateStatusMutation.mutateAsync({ id: sequence.id, status: 'active' });

      const hasSentStep0 = (sequence.email_activities || []).some(
        (a: any) => a.step_number === 0 && a.sent_at
      );
      if (!hasSentStep0) {
        await sendEmailMutation.mutateAsync({
          companySequenceId: sequence.id,
          stepNumber: 0,
        });
        toast.success('Sequence activated — first email sent');
      } else {
        toast.success('Sequence activated');
      }
    } catch (e: any) {
      toast.error(e?.message ?? 'Failed to activate sequence');
    }
  };

  const handleSendNext = async (sequence: CompanySequence) => {
    // After step 0 is sent, current_step is 0 — advance to the next unsent step
    const nextStep = typeof sequence.current_step === 'number' ? sequence.current_step + 1 : 0;
    await sendEmailMutation.mutateAsync({
      companySequenceId: sequence.id,
      stepNumber: nextStep,
    });
  };

  const handleDeleteSequence = async (sequenceId: string) => {
    if (!confirm('Delete this sequence? This removes it and its tracking. This cannot be undone.')) return;
    try {
      // Clean related rows the client can touch; bounce/automation FKs are CASCADE via migration
      const { error: actErr } = await supabase.from('email_activities').delete().eq('company_sequence_id', sequenceId);
      if (actErr) throw actErr;
      const { error } = await supabase.from('company_sequences').delete().eq('id', sequenceId);
      if (error) throw error;
      toast.success('Sequence deleted');
      queryClient.invalidateQueries({ queryKey: ['company-sequences-page'] });
      queryClient.invalidateQueries({ queryKey: ['pending-counts'] });
    } catch (e: any) {
      toast.error(e?.message ?? 'Failed to delete sequence');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-500/10 text-green-600 border-green-500/20';
      case 'paused': return 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20';
      case 'completed': return 'bg-blue-500/10 text-blue-600 border-blue-500/20';
      case 'draft': return 'bg-gray-500/10 text-gray-600 border-gray-500/20';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active': return Play;
      case 'paused': return Pause;
      case 'completed': return CheckCircle2;
      case 'draft': return Clock;
      default: return Clock;
    }
  };

  const calculateEngagement = (activities: CompanySequence['email_activities']) => {
    const sent = activities.filter(a => a.sent_at).length;
    const opened = activities.filter(a => a.opened_at).length;
    const replied = activities.filter(a => a.replied_at).length;
    const openRate = sent > 0 ? Math.round((opened / sent) * 100) : 0;
    const replyRate = sent > 0 ? Math.round((replied / sent) * 100) : 0;
    const untrackedCount = activities.filter(a => a.sent_at && !a.metadata?.tracking_enabled).length;
    const primaryProvider = activities
      .filter(a => a.metadata?.provider)
      .reduce((acc: Record<string, number>, a) => {
        const provider = a.metadata.provider;
        acc[provider] = (acc[provider] || 0) + 1;
        return acc;
      }, {});
    const topProvider = Object.keys(primaryProvider).length > 0 
      ? Object.entries(primaryProvider).sort((a, b) => b[1] - a[1])[0][0]
      : null;
    return { sent, opened, replied, openRate, replyRate, untrackedCount, topProvider };
  };

  // When is the next follow-up going to send? Mirrors process-sequence-steps'
  // time-based rule: the next step (current_step + 1) becomes due delayDays
  // after the current step's send. Returns null when nothing is pending
  // (no next step, not active, or the contact already replied → sequence stops).
  const computeNextFollowUp = (sequence: CompanySequence): { text: string; due: boolean } | null => {
    if (sequence.status !== 'active') return null;
    const steps = (sequence.personalized_emails || []) as Array<{ delayDays?: number }>;
    const nextStepNumber = (sequence.current_step ?? 0) + 1;
    const nextStep = steps[nextStepNumber];
    if (!nextStep) return null; // no more follow-ups queued
    // Stop-on-reply: a reply anywhere halts the sequence, so nothing is pending.
    if ((sequence.email_activities || []).some(a => a.replied_at)) return null;
    // Most-recent send of the current step is the clock the delay counts from.
    const lastForStep = (sequence.email_activities || [])
      .filter(a => a.step_number === (sequence.current_step ?? 0) && a.sent_at)
      .sort((a, b) => new Date(b.sent_at!).getTime() - new Date(a.sent_at!).getTime())[0];
    if (!lastForStep?.sent_at) return null;
    const delayDays = Number(nextStep.delayDays) || 0;
    const dueTime = new Date(lastForStep.sent_at).getTime() + delayDays * 86400000;
    const msLeft = dueTime - Date.now();
    if (msLeft <= 0) return { text: 'Next follow-up: due now', due: true };
    const days = Math.round(msLeft / 86400000);
    if (days <= 0) return { text: 'Next follow-up: today', due: false };
    if (days === 1) return { text: 'Next follow-up: in ~1 day', due: false };
    return { text: `Next follow-up: in ~${days} days`, due: false };
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center space-y-3">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto" />
          <p className="text-sm text-muted-foreground">Loading sequences...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      {/* Hero Section */}
      <div className="relative overflow-hidden border-b bg-gradient-to-br from-primary/10 via-primary/5 to-transparent backdrop-blur-sm">
        <div className="absolute inset-0 bg-grid-white/[0.02] pointer-events-none" />
        <div className="relative px-6 py-12">
          <div className="max-w-7xl mx-auto">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-primary flex items-center justify-center shadow-lg">
                  <BarChart3 className="h-6 w-6 text-purple-500" />
                </div>
                <div>
                  <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-br from-foreground to-foreground/70 bg-clip-text text-transparent">
                    Active Campaigns
                  </h1>
                  <p className="text-muted-foreground mt-1">
                    Monitor and manage your personalized email sequences
                  </p>
                </div>
              </div>

              <div className="flex gap-2">
                <Badge variant="secondary" className="text-sm px-3 py-1">
                  {filteredSequences?.length || 0} companies
                </Badge>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        <Tabs defaultValue="campaigns" className="space-y-6">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="campaigns" className="gap-2">
              <BarChart3 className="h-4 w-4" />
              Campaigns
            </TabsTrigger>
            <TabsTrigger value="delivery" className="gap-2">
              <LayoutList className="h-4 w-4" />
              Delivery report
            </TabsTrigger>
          </TabsList>

          <TabsContent value="campaigns" className="space-y-6">
        {/* Filters */}
        <Card className="mb-6 border-2 hover:border-primary/50 transition-all shadow-lg">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg flex items-center gap-2">
              <Filter className="h-5 w-5 text-primary" />
              Filters
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search companies..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="paused">Paused</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                </SelectContent>
              </Select>

              <Select value={industryFilter} onValueChange={setIndustryFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All industries" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Industries</SelectItem>
                  {industries.map(industry => (
                    <SelectItem key={industry} value={industry!}>
                      {industry}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Sequences List */}
        <div className="space-y-4">
          {selectedSeqIds.size > 0 && (
            <div className="flex items-center gap-2 rounded-lg border bg-muted/50 p-2 sticky top-2 z-10 backdrop-blur">
              <span className="text-sm font-medium px-1">{selectedSeqIds.size} selected</span>
              <Button size="sm" variant="destructive" onClick={handleBulkDeleteSequences} disabled={bulkDeleting}>
                <Trash2 className="h-4 w-4 mr-1.5" />
                {bulkDeleting ? 'Deleting…' : 'Delete selected'}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setSelectedSeqIds(new Set())} disabled={bulkDeleting}>
                Clear
              </Button>
            </div>
          )}
          {filteredSequences?.length === 0 ? (
            <Card className="border-2">
              <CardContent className="py-12 text-center">
                <div className="w-16 h-16 mx-auto rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                  <Mail className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-lg font-semibold mb-2">No sequences found</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Start by personalizing a sequence for a company
                </p>
                <Button onClick={() => navigate('/companies')}>
                  <Building2 className="h-4 w-4 mr-2" />
                  View Companies
                </Button>
              </CardContent>
            </Card>
          ) : (
            groupedSequences.map(group => {
              const groupReplied = group.seqs.reduce((n, s) => n + ((s.email_activities || []).some(a => a.replied_at) ? 1 : 0), 0);
              const groupAllSelected = group.seqs.length > 0 && group.seqs.every(s => selectedSeqIds.has(s.id));
              return (
                <div key={group.key} className="space-y-4">
                  <div className="flex flex-wrap items-center gap-3 pt-2 border-b pb-2">
                    <Checkbox checked={groupAllSelected} onCheckedChange={() => toggleGroup(group.seqs)} aria-label="Select all in campaign" />
                    <h3 className="text-base font-semibold">{group.name}</h3>
                    <Badge variant="secondary">{group.seqs.length} {group.seqs.length === 1 ? 'company' : 'companies'}</Badge>
                    {groupReplied > 0 && <Badge variant="outline" className="text-green-600 border-green-500/30">{groupReplied} replied</Badge>}
                  </div>
                  {group.seqs.map(sequence => {
              const engagement = calculateEngagement(sequence.email_activities || []);
              const totalSteps = sequence.email_sequences?.steps?.length || 0;
              const progress = totalSteps > 0 ? Math.round((sequence.current_step / totalSteps) * 100) : 0;

              return (
                <Card
                  key={sequence.id}
                  className="border-2 hover:border-primary/50 transition-all shadow-lg hover:shadow-xl cursor-pointer group relative overflow-hidden"
                  onClick={() => {
                    markCampaignAsViewed.mutate(sequence.id);
                    setSelectedSequence(sequence);
                    setDetailsDialogOpen(true);
                  }}
                >
                  <CardContent className="p-6">
                    {/* Status Banner */}
                    <div className={`absolute top-0 left-0 right-0 h-1.5 ${
                      sequence.status === 'active' ? 'bg-green-500' :
                      sequence.status === 'paused' ? 'bg-yellow-500' :
                      sequence.status === 'completed' ? 'bg-blue-500' :
                      'bg-gray-500'
                    }`} />

                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-start gap-4 flex-1">
                        <div onClick={(e) => e.stopPropagation()} className="pt-1">
                          <Checkbox
                            checked={selectedSeqIds.has(sequence.id)}
                            onCheckedChange={() => toggleSeq(sequence.id)}
                            aria-label="Select sequence"
                          />
                        </div>
                        <div className={`w-12 h-12 rounded-lg flex items-center justify-center shadow-sm shrink-0 ${
                          sequence.status === 'active' ? 'bg-green-500' :
                          sequence.status === 'paused' ? 'bg-yellow-500' :
                          sequence.status === 'completed' ? 'bg-blue-500' :
                          'bg-gray-500'
                        }`}>
                          <Building2 className="h-5 w-5 text-white" />
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <h3 className="text-lg font-semibold mb-1 flex items-center gap-2">
                            {sequence.companies.name}
                            <Eye className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </h3>
                          <p className="text-sm text-muted-foreground mb-2">
                            {sequence.email_sequences?.name || 'Sequence deleted'}
                          </p>
                          <div className="flex flex-wrap gap-2">
                            <Badge 
                              variant="outline" 
                              className={`${getStatusColor(sequence.status)} font-semibold`}
                            >
                              {(() => {
                                const StatusIcon = getStatusIcon(sequence.status);
                                return <StatusIcon className="h-3 w-3 mr-1" />;
                              })()}
                              {sequence.status.toUpperCase()}
                            </Badge>
                            {sequence.auto_respond_enabled && (
                              <Badge variant="default" className="bg-gradient-primary text-white">
                                <Bot className="h-3 w-3 mr-1" />
                                Auto-Response
                              </Badge>
                            )}
                            {sequence.automation_rules?.enabled && (
                              <Badge variant="secondary" className="border border-primary/20">
                                <Clock className="h-3 w-3 mr-1" />
                                Auto-Send
                              </Badge>
                            )}
                            {sequence.companies.industry && (
                              <Badge variant="secondary">{sequence.companies.industry}</Badge>
                            )}
                            {sequence.companies.geography && (
                              <Badge variant="outline">{sequence.companies.geography}</Badge>
                            )}
                            <Badge variant="outline" className="text-xs">
                              <Clock className="h-3 w-3 mr-1" />
                              Created {new Date(sequence.created_at).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </Badge>
                            {(() => {
                              const nf = computeNextFollowUp(sequence);
                              if (!nf) return null;
                              return (
                                <Badge
                                  variant="outline"
                                  className={`text-xs font-medium ${
                                    nf.due
                                      ? 'bg-amber-500/10 text-amber-600 border-amber-500/30'
                                      : 'bg-indigo-500/10 text-indigo-600 border-indigo-500/30'
                                  }`}
                                >
                                  <Send className="h-3 w-3 mr-1" />
                                  {nf.text}
                                </Badge>
                              );
                            })()}
                            {engagement.topProvider && (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger>
                                    <Badge variant="secondary" className="gap-1">
                                      <Mail className="h-3 w-3" />
                                      {engagement.topProvider}
                                      {engagement.untrackedCount > 0 && (
                                        <AlertTriangle className="h-3 w-3 text-yellow-500" />
                                      )}
                                    </Badge>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p className="text-xs font-semibold mb-1">Primary Provider: {engagement.topProvider}</p>
                                    {engagement.untrackedCount > 0 && (
                                      <p className="text-xs text-yellow-500">
                                        {engagement.untrackedCount} email(s) sent without tracking
                                      </p>
                                    )}
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                        {/* Primary Action Buttons */}
                        {sequence.status === 'draft' && (
                          <Button
                            size="sm"
                            onClick={() => handleActivateSequence(sequence)}
                            disabled={updateStatusMutation.isPending || sendEmailMutation.isPending}
                            className="bg-gradient-primary hover:opacity-90"
                          >
                            <Play className="h-4 w-4 mr-2" />
                            Activate Sequence
                          </Button>
                        )}
                        {sequence.status === 'active' && (
                          <>
                            {sequence.current_step < totalSteps && (
                              <Button
                                size="sm"
                                onClick={() => handleSendNext(sequence)}
                                disabled={sendEmailMutation.isPending}
                              >
                                <Send className="h-4 w-4 mr-2" />
                                Send Next
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleStatusChange(sequence.id, 'paused')}
                              disabled={updateStatusMutation.isPending}
                            >
                              <Pause className="h-4 w-4 mr-2" />
                              Pause
                            </Button>
                          </>
                        )}
                        {sequence.status === 'paused' && (
                          <Button
                            size="sm"
                            onClick={() => handleStatusChange(sequence.id, 'active')}
                            disabled={updateStatusMutation.isPending}
                            className="bg-green-500 hover:bg-green-600 text-white"
                          >
                            <Play className="h-4 w-4 mr-2" />
                            Resume
                          </Button>
                        )}

                        {/* Quick Actions Dropdown */}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Quick Actions</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => {
                                setSelectedSequence(sequence);
                                setDetailsDialogOpen(true);
                              }}
                            >
                              <Eye className="h-4 w-4 mr-2" />
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => {
                                setSelectedSequence(sequence);
                                setDetailsDialogOpen(true);
                              }}
                            >
                              <Settings className="h-4 w-4 mr-2" />
                              Settings
                            </DropdownMenuItem>
                            {sequence.companies.industry && (
                              <DropdownMenuItem
                                onClick={() => {
                                  navigate(`/companies?filter=${sequence.companies.name}`);
                                }}
                              >
                                <ExternalLink className="h-4 w-4 mr-2" />
                                View Company
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => handleDeleteSequence(sequence.id)}
                              className="text-destructive focus:text-destructive"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete Sequence
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>

                    <Separator className="my-4" />

                    {/* Progress Bar */}
                    <div className="space-y-2 mb-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between text-sm">
                        <span className="text-muted-foreground">Progress</span>
                        <span className="font-medium">
                          Step {sequence.current_step + 1} of {totalSteps}
                        </span>
                      </div>
                      <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-gradient-primary transition-all duration-300"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>

                    {/* Engagement Metrics */}
                    <div className="grid grid-cols-4 gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Send className="h-4 w-4" />
                          <span className="text-xs font-medium">Sent</span>
                        </div>
                        <p className="text-2xl font-bold">{engagement.sent}</p>
                        {engagement.topProvider && (
                          <p className="text-xs text-muted-foreground">via {engagement.topProvider}</p>
                        )}
                      </div>
                      
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Eye className="h-4 w-4" />
                          <span className="text-xs font-medium">Opened</span>
                        </div>
                        <p className="text-2xl font-bold">{engagement.opened}</p>
                        <p className="text-xs text-muted-foreground">{engagement.openRate}%</p>
                      </div>
                      
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Mail className="h-4 w-4" />
                          <span className="text-xs font-medium">Replied</span>
                        </div>
                        <p className="text-2xl font-bold">{engagement.replied}</p>
                        <p className="text-xs text-muted-foreground">{engagement.replyRate}%</p>
                      </div>
                      
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <TrendingUp className="h-4 w-4" />
                          <span className="text-xs font-medium">Status</span>
                        </div>
                        <p className="text-sm font-medium capitalize">{sequence.status}</p>
                        {engagement.untrackedCount > 0 && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger>
                                <div className="flex items-center gap-1 text-xs text-yellow-600">
                                  <AlertTriangle className="h-3 w-3" />
                                  Limited tracking
                                </div>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p className="text-xs">{engagement.untrackedCount} email(s) sent without tracking</p>
                                <p className="text-xs text-muted-foreground">Configure email providers for better tracking</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                      </div>
                    </div>

                    {/* Who opened / Who replied — per-step engagement for this campaign */}
                    {(engagement.opened > 0 || engagement.replied > 0) && (
                      <div className="mt-4 pt-4 border-t space-y-2">
                        <p className="text-xs font-medium text-muted-foreground">Who engaged</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                          {engagement.opened > 0 && (
                            <div className="flex items-start gap-2">
                              <Eye className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
                              <div>
                                <span className="font-medium text-foreground">Opened</span>
                                <ul className="text-xs text-muted-foreground mt-0.5 space-y-0.5">
                                  {(sequence.email_activities || [])
                                    .filter(a => a.opened_at)
                                    .map(a => (
                                      <li key={a.id}>
                                        Step {a.step_number + 1} — {new Date(a.opened_at!).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                                      </li>
                                    ))}
                                </ul>
                              </div>
                            </div>
                          )}
                          {engagement.replied > 0 && (
                            <div className="flex items-start gap-2">
                              <Mail className="h-4 w-4 text-green-600 shrink-0 mt-0.5" />
                              <div>
                                <span className="font-medium text-foreground">Replied</span>
                                <ul className="text-xs text-muted-foreground mt-0.5 space-y-0.5">
                                  {(sequence.email_activities || [])
                                    .filter(a => a.replied_at)
                                    .map(a => (
                                      <li key={a.id}>
                                        Step {a.step_number + 1} — {new Date(a.replied_at!).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                                      </li>
                                    ))}
                                </ul>
                              </div>
                            </div>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Click card to see full timeline and details
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
                </div>
              );
            })
          )}
        </div>
          </TabsContent>

          <TabsContent value="delivery" className="space-y-4">
            <Card className="border-2">
              <CardHeader>
                <CardTitle className="text-lg">Who received what</CardTitle>
                <CardDescription>
                  Sequence delivery by company: which step was sent, opened, or replied for each candidate.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="w-full overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="min-w-[160px]">Company</TableHead>
                        <TableHead className="min-w-[140px]">Sequence</TableHead>
                        <TableHead className="w-24">Status</TableHead>
                        {Array.from({ length: maxSteps }).map((_, i) => (
                          <TableHead key={i} className="text-center min-w-[100px]">Step {i + 1}</TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredSequences?.map(seq => {
                        const steps = seq.email_sequences?.steps?.length || 0;
                        const activitiesByStep = (seq.email_activities || []).reduce((acc, a) => {
                          acc[a.step_number] = a;
                          return acc;
                        }, {} as Record<number, { sent_at?: string; opened_at?: string; replied_at?: string }>);
                        return (
                          <TableRow
                            key={seq.id}
                            className="cursor-pointer hover:bg-muted/50"
                            onClick={() => {
                              setSelectedSequence(seq);
                              setDetailsDialogOpen(true);
                            }}
                          >
                            <TableCell className="font-medium">{seq.companies.name}</TableCell>
                            <TableCell>{seq.email_sequences?.name || '—'}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className={getStatusColor(seq.status)}>
                                {seq.status}
                              </Badge>
                            </TableCell>
                            {Array.from({ length: maxSteps }).map((_, i) => {
                              const stepNum = i + 1;
                              const act = activitiesByStep[stepNum];
                              let label = '—';
                              if (act?.sent_at) {
                                const d = new Date(act.sent_at);
                                label = `Sent ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })}`;
                                if (act.replied_at) label += ' · Replied';
                                else if (act.opened_at) label += ' · Opened';
                              }
                              return (
                                <TableCell key={i} className="text-center text-sm text-muted-foreground">
                                  {label}
                                </TableCell>
                              );
                            })}
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </ScrollArea>
                {(!filteredSequences?.length) && (
                  <p className="text-sm text-muted-foreground py-8 text-center">No sequence data to show.</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Details Dialog */}
      {selectedSequence && (
        <CompanySequenceDetailsDialog
          open={detailsDialogOpen}
          onOpenChange={setDetailsDialogOpen}
          sequence={selectedSequence}
        />
      )}
    </div>
  );
}
