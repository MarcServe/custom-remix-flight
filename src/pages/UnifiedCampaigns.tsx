import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Mail, Building2, Send, TrendingUp, Users, Activity, ArrowRight, Sparkles } from 'lucide-react';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { Progress } from '@/components/ui/progress';

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
    status: string;
    sent_at?: string;
    opened_at?: string;
  }>;
}

interface UnifiedActivity {
  id: string;
  type: 'bulk' | 'sequence' | 'auto_response';
  campaign_name: string;
  recipient_info: string;
  status: string;
  timestamp: string;
  details?: any;
}

export default function UnifiedCampaigns() {
  const navigate = useNavigate();
  const [selectedTab, setSelectedTab] = useState('all');

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
          email_activities(status, sent_at, opened_at)
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

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-2">
              <Mail className="h-5 w-5 text-muted-foreground" />
              <Badge variant="secondary">{stats.totalBulkCampaigns}</Badge>
            </div>
            <div className="text-2xl font-bold">{stats.totalEmailsSent}</div>
            <p className="text-xs text-muted-foreground">Total Emails Sent</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-2">
              <Building2 className="h-5 w-5 text-muted-foreground" />
              <Badge variant="secondary">{stats.totalSequenceCampaigns}</Badge>
            </div>
            <div className="text-2xl font-bold">{stats.totalSequenceCampaigns}</div>
            <p className="text-xs text-muted-foreground">Active Sequences</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-2">
              <Users className="h-5 w-5 text-muted-foreground" />
              <Badge variant="secondary">{stats.totalBulkCampaigns}</Badge>
            </div>
            <div className="text-2xl font-bold">{stats.totalBulkCampaigns}</div>
            <p className="text-xs text-muted-foreground">Bulk Campaigns</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-2">
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
                      className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-4 flex-1">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
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
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium truncate">
                              {activity.campaign_name}
                            </span>
                            {activity.type === 'auto_response' && (
                              <Badge variant="default" className="bg-gradient-primary text-white text-xs">
                                AI Response
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground truncate">
                            To: {activity.recipient_info}
                            {activity.details?.subject && ` • ${activity.details.subject}`}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <Badge variant={activity.status === 'sent' ? 'default' : 'secondary'}>
                            {activity.status}
                          </Badge>
                          {activity.details?.opened && (
                            <Badge variant="outline" className="ml-2">Opened</Badge>
                          )}
                        </div>
                        <div className="text-sm text-muted-foreground min-w-[100px] text-right">
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
                    
                    return (
                      <div key={sequence.id} className="p-4 rounded-lg border bg-card">
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
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span>Step {sequence.current_step + 1} of {totalSteps}</span>
                          <span>•</span>
                          <span>{sentEmails} emails sent</span>
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