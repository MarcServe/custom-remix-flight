import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Mail, Building2, Send, TrendingUp, Users, Activity, ArrowRight, Sparkles } from 'lucide-react';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { Progress } from '@/components/ui/progress';
import { useEmailActivitiesRealtime, useCompanySequencesRealtime } from '@/hooks/use-realtime';
import { CampaignAnalytics } from '@/components/campaigns/CampaignAnalytics';
import { EngagementTimeline } from '@/components/campaigns/EngagementTimeline';

interface BulkCampaign {
  id: string;
  name: string;
  status: string;
  total_recipients: number;
  sent_count: number;
  opened_count: number;
  created_at: string;
}

interface SequenceCampaign {
  id: string;
  company_id: string;
  status: string;
  current_step: number;
  auto_respond_enabled: boolean;
  companies: {
    name: string;
    industry?: string;
  };
  email_sequences: {
    name: string;
    steps: any[];
  };
  email_activities: Array<{
    id: string;
    status: string;
    sent_at?: string;
    opened_at?: string;
    replied_at?: string;
    subject?: string;
    metadata?: any;
  }>;
}

interface UnifiedActivity {
  id: string;
  type: 'bulk' | 'sequence' | 'auto_response';
  campaign_name: string;
  recipient_info: string;
  status: string;
  timestamp: string;
  company_sequence_id?: string;
  details?: any;
}

export default function UnifiedCampaigns() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  // Subscribe to realtime updates
  useEmailActivitiesRealtime();
  useCompanySequencesRealtime();
  
  const [selectedTab, setSelectedTab] = useState('all');

  // Real-time updates for email activities
  useEffect(() => {
    const channel = supabase
      .channel('campaign-activities')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'email_activities',
        },
        (payload) => {
          const activity = payload.new as any;
          queryClient.invalidateQueries({ queryKey: ['unified-activities'] });
          queryClient.invalidateQueries({ queryKey: ['sequence-campaigns'] });
          
          if (activity.metadata?.auto_sent) {
            toast.info('New Auto-Response', {
              description: `AI sent an automated response`,
            });
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'email_activities',
        },
        (payload) => {
          const activity = payload.new as any;
          queryClient.invalidateQueries({ queryKey: ['unified-activities'] });
          
          if (activity.opened_at && !payload.old.opened_at) {
            toast.success('Email Opened', {
              description: activity.subject || 'A recipient opened your email',
            });
          }
          
          if (activity.replied_at && !payload.old.replied_at) {
            toast.success('Email Reply Received!', {
              description: activity.subject || 'A recipient replied to your email',
              duration: 7000,
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  // Fetch bulk campaigns
  const { data: bulkCampaigns } = useQuery({
    queryKey: ['bulk-campaigns'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('email_campaigns')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as BulkCampaign[];
    },
  });

  // Fetch sequence campaigns
  const { data: sequenceCampaigns } = useQuery({
    queryKey: ['sequence-campaigns'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('company_sequences')
        .select(`
          *,
          companies(name, industry),
          email_sequences(name, steps),
          email_activities(id, status, sent_at, opened_at, replied_at, subject, metadata)
        `)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as SequenceCampaign[];
    },
  });

  // Fetch unified activity feed
  const { data: activities } = useQuery({
    queryKey: ['unified-activities'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('email_activities')
        .select(`
          *,
          company_sequences(
            id,
            companies(name),
            email_sequences(name)
          )
        `)
        .order('sent_at', { ascending: false })
        .limit(50);
      
      if (error) throw error;
      
      // Transform to unified format
      const unified: UnifiedActivity[] = (data || []).map((activity: any) => ({
        id: activity.id,
        type: activity.metadata?.auto_sent ? 'auto_response' : 'sequence',
        campaign_name: activity.company_sequences?.email_sequences?.name || 'Unknown Sequence',
        recipient_info: activity.company_sequences?.companies?.name || 'Unknown Company',
        status: activity.status,
        timestamp: activity.sent_at || activity.created_at,
        company_sequence_id: activity.company_sequence_id,
        details: {
          subject: activity.subject,
          opened: !!activity.opened_at,
          replied: !!activity.replied_at,
          auto_sent: activity.metadata?.auto_sent,
        },
      }));
      
      return unified;
    },
  });

  // Calculate stats
  const stats = {
    totalBulkCampaigns: bulkCampaigns?.length || 0,
    totalSequenceCampaigns: sequenceCampaigns?.filter(s => s.status === 'active').length || 0,
    totalEmailsSent: (bulkCampaigns?.reduce((sum, c) => sum + c.sent_count, 0) || 0) +
                     (sequenceCampaigns?.reduce((sum, s) => sum + (s.email_activities?.length || 0), 0) || 0),
    autoResponsesEnabled: sequenceCampaigns?.filter(s => s.auto_respond_enabled).length || 0,
  };

  // Calculate engagement metrics across all campaigns
  const allEmailActivities = sequenceCampaigns?.flatMap(s => s.email_activities || []) || [];
  const engagementMetrics = {
    totalSent: allEmailActivities.length,
    opened: allEmailActivities.filter(a => a.opened_at).length,
    clicked: allEmailActivities.filter(a => a.metadata?.clicked).length || 0,
    replied: allEmailActivities.filter(a => a.replied_at).length,
    bounced: allEmailActivities.filter(a => a.status === 'bounced').length,
    unsubscribed: allEmailActivities.filter(a => a.status === 'unsubscribed').length || 0,
  };

  // Create engagement timeline events
  const timelineEvents = allEmailActivities.slice(0, 50).map(activity => ({
    id: activity.id || Math.random().toString(),
    type: (activity.replied_at ? 'replied' : 
          activity.opened_at ? 'opened' : 
          activity.status === 'bounced' ? 'bounced' :
          activity.metadata?.clicked ? 'clicked' : 'sent') as 'sent' | 'opened' | 'clicked' | 'replied' | 'bounced',
    timestamp: activity.sent_at || new Date().toISOString(),
    recipientEmail: activity.metadata?.recipient_email as string | undefined,
    metadata: {
      subject: activity.subject as string | undefined,
      link: activity.metadata?.clicked_links?.[0] as string | undefined,
      bounce_reason: activity.metadata?.bounce_reason as string | undefined,
    },
  }));

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-12 h-12 rounded-xl bg-gradient-primary flex items-center justify-center shadow-lg">
            <Activity className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">All Campaigns</h1>
            <p className="text-sm text-muted-foreground">
              Unified view of all your email campaigns and sequences
            </p>
          </div>
        </div>
      </div>

      {/* Engagement Analytics */}
      <div className="mb-6">
        <CampaignAnalytics
          totalSent={engagementMetrics.totalSent}
          opened={engagementMetrics.opened}
          clicked={engagementMetrics.clicked}
          replied={engagementMetrics.replied}
          bounced={engagementMetrics.bounced}
          unsubscribed={engagementMetrics.unsubscribed}
        />
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-2">
              <Mail className="h-5 w-5 text-muted-foreground" />
              <Badge variant="secondary">{stats.totalBulkCampaigns}</Badge>
            </div>
            <div className="text-2xl font-bold">{stats.totalEmailsSent}</div>
            <p className="text-xs text-muted-foreground">Total Emails Sent</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-2">
              <Building2 className="h-5 w-5 text-muted-foreground" />
              <Badge variant="secondary">{stats.totalSequenceCampaigns}</Badge>
            </div>
            <div className="text-2xl font-bold">{stats.totalSequenceCampaigns}</div>
            <p className="text-xs text-muted-foreground">Active Sequences</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-2">
              <Users className="h-5 w-5 text-muted-foreground" />
              <Badge variant="secondary">{stats.totalBulkCampaigns}</Badge>
            </div>
            <div className="text-2xl font-bold">{stats.totalBulkCampaigns}</div>
            <p className="text-xs text-muted-foreground">Bulk Campaigns</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-2">
              <Sparkles className="h-5 w-5 text-primary" />
              <Badge className="bg-gradient-primary text-white">{stats.autoResponsesEnabled}</Badge>
            </div>
            <div className="text-2xl font-bold">{stats.autoResponsesEnabled}</div>
            <p className="text-xs text-muted-foreground">Auto-Response Active</p>
          </CardContent>
        </Card>
      </div>

      <Tabs value={selectedTab} onValueChange={setSelectedTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="all">All Activity</TabsTrigger>
          <TabsTrigger value="bulk">Bulk Campaigns</TabsTrigger>
          <TabsTrigger value="sequences">Sequences</TabsTrigger>
        </TabsList>

        {/* All Activity Tab */}
        <TabsContent value="all" className="space-y-4">
          {/* Engagement Timeline */}
          <EngagementTimeline events={timelineEvents} />
          
          <Card>
            <CardHeader>
              <CardTitle>Recent Email Activity</CardTitle>
              <CardDescription>All email sends across bulk campaigns and sequences</CardDescription>
            </CardHeader>
            <CardContent>
              {!activities || activities.length === 0 ? (
                <div className="text-center py-8">
                  <Activity className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-sm text-muted-foreground">No email activity yet</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {activities.map((activity) => (
                    <div
                      key={activity.id}
                      className="flex flex-col sm:flex-row items-start sm:items-center gap-3 p-4 rounded-lg border bg-card hover:bg-muted/50 transition-colors cursor-pointer"
                      onClick={() => {
                        // If activity has a reply, go to conversations with deep link to the specific conversation
                        if (activity.details?.replied || activity.status === 'replied') {
                          if (activity.company_sequence_id) {
                            navigate(`/conversations?sequence=${activity.company_sequence_id}`);
                          } else {
                            navigate('/conversations');
                          }
                        }
                        // Otherwise, if it's a sequence activity, navigate to sequences
                        else if (activity.type === 'sequence' || activity.type === 'auto_response') {
                          navigate('/sequences');
                        } else {
                          navigate('/campaigns');
                        }
                      }}
                    >
                      <div className="flex items-center gap-4 flex-1 min-w-0 w-full sm:w-auto">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                          activity.type === 'auto_response' 
                            ? 'bg-gradient-primary' 
                            : 'bg-primary/10'
                        }`}>
                          {activity.type === 'auto_response' ? (
                            <Sparkles className="h-5 w-5 text-white" />
                          ) : (
                            <Send className="h-5 w-5 text-primary" />
                          )}
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className="font-medium truncate">
                              {activity.campaign_name}
                            </span>
                            {activity.type === 'auto_response' && (
                              <Badge variant="default" className="bg-gradient-primary text-white text-xs shrink-0">
                                AI Response
                              </Badge>
                            )}
                          </div>
                          <div className="text-sm text-muted-foreground space-y-1">
                            <p className="truncate break-all">
                              To: {activity.recipient_info}
                            </p>
                            {activity.details?.subject && (
                              <p className="truncate break-words text-xs">
                                Subject: {activity.details.subject}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 sm:gap-4 w-full sm:w-auto justify-between sm:justify-end shrink-0">
                        <div className="flex flex-wrap gap-2 items-center">
                          <Badge variant={activity.status === 'sent' ? 'default' : activity.status === 'replied' ? 'default' : 'secondary'} className="shrink-0">
                            {activity.status}
                          </Badge>
                          {activity.details?.opened && (
                            <Badge variant="outline" className="shrink-0">📬 Opened</Badge>
                          )}
                          {activity.details?.replied && (
                            <Badge variant="default" className="bg-green-500 hover:bg-green-600 shrink-0">
                              💬 Replied
                            </Badge>
                          )}
                        </div>
                        <div className="text-sm text-muted-foreground whitespace-nowrap">
                          {format(new Date(activity.timestamp), 'MMM d, HH:mm')}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Bulk Campaigns Tab */}
        <TabsContent value="bulk" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Bulk Email Campaigns</CardTitle>
                <CardDescription>Mass email campaigns sent to multiple recipients</CardDescription>
              </div>
              <Button onClick={() => navigate('/campaigns')}>
                View Details
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </CardHeader>
            <CardContent>
              {!bulkCampaigns || bulkCampaigns.length === 0 ? (
                <div className="text-center py-8">
                  <Mail className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-sm text-muted-foreground">No bulk campaigns yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {bulkCampaigns.map((campaign) => {
                    const progress = campaign.total_recipients > 0
                      ? (campaign.sent_count / campaign.total_recipients) * 100
                      : 0;
                    
                    return (
                      <div key={campaign.id} className="p-4 rounded-lg border bg-card">
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <h4 className="font-semibold">{campaign.name}</h4>
                            <p className="text-sm text-muted-foreground">
                              {campaign.total_recipients} recipients
                            </p>
                          </div>
                          <Badge>{campaign.status}</Badge>
                        </div>
                        <div className="space-y-2">
                          <div className="flex justify-between text-xs">
                            <span>{campaign.sent_count} sent</span>
                            <span>{campaign.opened_count} opened</span>
                            <span>{Math.round(progress)}%</span>
                          </div>
                          <Progress value={progress} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Sequences Tab */}
        <TabsContent value="sequences" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Personalized Sequences</CardTitle>
                <CardDescription>AI-powered sequences for individual companies</CardDescription>
              </div>
              <Button onClick={() => navigate('/company-sequences')}>
                View Details
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </CardHeader>
            <CardContent>
              {!sequenceCampaigns || sequenceCampaigns.length === 0 ? (
                <div className="text-center py-8">
                  <Building2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-sm text-muted-foreground">No sequences yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {sequenceCampaigns.map((sequence) => {
                    const totalSteps = sequence.email_sequences.steps?.length || 0;
                    const sentEmails = sequence.email_activities?.length || 0;
                    const repliedEmails = sequence.email_activities?.filter(a => a.replied_at).length || 0;
                    const openedEmails = sequence.email_activities?.filter(a => a.opened_at).length || 0;
                    
                    return (
                      <div key={sequence.id} className="p-4 rounded-lg border bg-card hover:shadow-md transition-shadow">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-start gap-3">
                            <div className="w-10 h-10 rounded-lg bg-gradient-primary flex items-center justify-center">
                              <Building2 className="h-5 w-5 text-white" />
                            </div>
                            <div>
                              <h4 className="font-semibold">{sequence.companies.name}</h4>
                              <p className="text-sm text-muted-foreground">
                                {sequence.email_sequences.name}
                              </p>
                            </div>
                          </div>
                          <div className="flex flex-col gap-2">
                            <Badge>{sequence.status}</Badge>
                            {sequence.auto_respond_enabled && (
                              <Badge className="bg-gradient-primary text-white">
                                <Sparkles className="h-3 w-3 mr-1" />
                                Auto
                              </Badge>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-4 text-sm">
                          <span className="text-muted-foreground">
                            Step {sequence.current_step + 1} of {totalSteps}
                          </span>
                          <span className="text-muted-foreground">•</span>
                          <span className="text-muted-foreground">{sentEmails} sent</span>
                          {openedEmails > 0 && (
                            <>
                              <span className="text-muted-foreground">•</span>
                              <Badge variant="outline" className="text-xs">📬 {openedEmails} opened</Badge>
                            </>
                          )}
                          {repliedEmails > 0 && (
                            <>
                              <span className="text-muted-foreground">•</span>
                              <Badge className="bg-green-500 hover:bg-green-600 text-xs">
                                💬 {repliedEmails} replied
                              </Badge>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}