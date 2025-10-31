import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
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
  Send
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useUpdateSequenceStatus, useSendSequenceEmail } from '@/hooks/use-company-sequences';

interface CompanySequence {
  id: string;
  company_id: string;
  sequence_id: string;
  status: 'draft' | 'active' | 'paused' | 'completed';
  current_step: number;
  personalized_emails: any[];
  companies: {
    name: string;
    industry?: string;
    geography?: string;
  };
  email_sequences: {
    name: string;
    steps: any[];
  };
  email_activities: Array<{
    id: string;
    step_number: number;
    status: string;
    sent_at?: string;
    opened_at?: string;
    replied_at?: string;
  }>;
}

export default function CompanySequences() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [industryFilter, setIndustryFilter] = useState<string>('all');
  
  const updateStatusMutation = useUpdateSequenceStatus();
  const sendEmailMutation = useSendSequenceEmail();

  const { data: companySequences, isLoading } = useQuery({
    queryKey: ['company-sequences-page', statusFilter, industryFilter],
    queryFn: async () => {
      let query = supabase
        .from('company_sequences')
        .select(`
          *,
          companies(name, industry, geography),
          email_sequences(name, steps),
          email_activities(id, step_number, status, sent_at, opened_at, replied_at)
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

  const filteredSequences = companySequences?.filter(seq => {
    const matchesSearch = !searchQuery || 
      seq.companies.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesIndustry = industryFilter === 'all' || 
      seq.companies.industry === industryFilter;
    return matchesSearch && matchesIndustry;
  });

  const industries = Array.from(new Set(companySequences?.map(s => s.companies.industry).filter(Boolean) || []));

  const handleStatusChange = async (id: string, status: 'draft' | 'active' | 'paused' | 'completed') => {
    await updateStatusMutation.mutateAsync({ id, status });
  };

  const handleSendNext = async (sequence: CompanySequence) => {
    await sendEmailMutation.mutateAsync({
      companySequenceId: sequence.id,
      stepNumber: sequence.current_step
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-500/10 text-green-600 border-green-500/20';
      case 'paused': return 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20';
      case 'completed': return 'bg-blue-500/10 text-blue-600 border-blue-500/20';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const calculateEngagement = (activities: CompanySequence['email_activities']) => {
    const sent = activities.filter(a => a.sent_at).length;
    const opened = activities.filter(a => a.opened_at).length;
    const replied = activities.filter(a => a.replied_at).length;
    const openRate = sent > 0 ? Math.round((opened / sent) * 100) : 0;
    const replyRate = sent > 0 ? Math.round((replied / sent) * 100) : 0;
    return { sent, opened, replied, openRate, replyRate };
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
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-primary flex items-center justify-center shadow-lg">
                  <BarChart3 className="h-6 w-6 text-white" />
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
            filteredSequences?.map(sequence => {
              const engagement = calculateEngagement(sequence.email_activities || []);
              const totalSteps = sequence.email_sequences.steps?.length || 0;
              const progress = totalSteps > 0 ? Math.round((sequence.current_step / totalSteps) * 100) : 0;

              return (
                <Card 
                  key={sequence.id}
                  className="border-2 hover:border-primary/50 transition-all shadow-lg hover:shadow-xl"
                >
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-start gap-4 flex-1">
                        <div className="w-12 h-12 rounded-lg bg-gradient-primary flex items-center justify-center shadow-sm shrink-0">
                          <Building2 className="h-5 w-5 text-white" />
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <h3 className="text-lg font-semibold mb-1">{sequence.companies.name}</h3>
                          <p className="text-sm text-muted-foreground mb-2">
                            {sequence.email_sequences.name}
                          </p>
                          <div className="flex flex-wrap gap-2">
                            <Badge variant="outline" className={getStatusColor(sequence.status)}>
                              {sequence.status}
                            </Badge>
                            {sequence.companies.industry && (
                              <Badge variant="secondary">{sequence.companies.industry}</Badge>
                            )}
                            {sequence.companies.geography && (
                              <Badge variant="outline">{sequence.companies.geography}</Badge>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex gap-2">
                        {sequence.status === 'active' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleStatusChange(sequence.id, 'paused')}
                            disabled={updateStatusMutation.isPending}
                          >
                            <Pause className="h-4 w-4 mr-2" />
                            Pause
                          </Button>
                        )}
                        {sequence.status === 'paused' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleStatusChange(sequence.id, 'active')}
                            disabled={updateStatusMutation.isPending}
                          >
                            <Play className="h-4 w-4 mr-2" />
                            Resume
                          </Button>
                        )}
                        {sequence.status === 'active' && sequence.current_step < totalSteps && (
                          <Button
                            size="sm"
                            onClick={() => handleSendNext(sequence)}
                            disabled={sendEmailMutation.isPending}
                          >
                            <Send className="h-4 w-4 mr-2" />
                            Send Next
                          </Button>
                        )}
                      </div>
                    </div>

                    <Separator className="my-4" />

                    {/* Progress Bar */}
                    <div className="space-y-2 mb-4">
                      <div className="flex items-center justify-between text-sm">
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
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
