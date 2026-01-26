import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { 
  Mail, 
  Clock, 
  Archive, 
  Filter, 
  ChevronDown, 
  ChevronUp,
  CheckCircle2,
  Eye,
  Reply,
  AlertCircle,
  Calendar,
  Sparkles
} from 'lucide-react';
import { format, formatDistanceToNow, isToday, isThisWeek, isThisMonth, parseISO } from 'date-fns';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';

interface EmailHistoryViewProps {
  personId?: string;
  companyId?: string;
  contactId?: string;
  showFilters?: boolean;
  maxItems?: number;
}

interface EmailRecord {
  id: string;
  type: 'campaign' | 'sequence' | 'direct';
  subject: string;
  status: string;
  sent_at: string | null;
  opened_at: string | null;
  replied_at: string | null;
  email_period?: 'old' | 'new' | 'archived';
  campaign_name?: string;
  sequence_name?: string;
  metadata?: any;
}

export function EmailHistoryView({ 
  personId, 
  companyId, 
  contactId,
  showFilters = true,
  maxItems 
}: EmailHistoryViewProps) {
  const [selectedPeriod, setSelectedPeriod] = useState<'all' | 'new' | 'old' | 'archived'>('all');
  const [selectedStatus, setSelectedStatus] = useState<'all' | 'sent' | 'opened' | 'replied' | 'failed'>('all');
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(['new']));
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch email activities
  const { data: emailActivities, isLoading: loadingActivities } = useQuery({
    queryKey: ['email-activities-history', personId, companyId, contactId],
    queryFn: async () => {
      let query = supabase
        .from('email_activities')
        .select(`
          id,
          subject,
          status,
          sent_at,
          opened_at,
          replied_at,
          email_period,
          metadata,
          company_sequences (
            id,
            companies (name),
            email_sequences (name)
          )
        `)
        .order('sent_at', { ascending: false })
        .limit(500);

      if (contactId) {
        query = query.eq('contact_id', contactId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: !!contactId || !!personId || !!companyId,
  });

  // Fetch campaign recipients
  const { data: campaignRecipients, isLoading: loadingCampaigns } = useQuery({
    queryKey: ['email-campaign-recipients-history', personId],
    queryFn: async () => {
      if (!personId) return [];

      const { data, error } = await supabase
        .from('email_campaign_recipients')
        .select(`
          id,
          email,
          status,
          sent_at,
          opened_at,
          email_period,
          personalized_subject,
          email_campaigns (
            id,
            name,
            tags,
            created_at
          )
        `)
        .eq('person_id', personId)
        .not('sent_at', 'is', null)
        .order('sent_at', { ascending: false })
        .limit(500);

      if (error) throw error;
      return data || [];
    },
    enabled: !!personId,
  });

  // Combine and transform emails
  const allEmails = useMemo(() => {
    const emails: EmailRecord[] = [];

    // Add email activities
    (emailActivities || []).forEach((activity: any) => {
      emails.push({
        id: activity.id,
        type: activity.company_sequences ? 'sequence' : 'direct',
        subject: activity.subject || 'No subject',
        status: activity.status,
        sent_at: activity.sent_at,
        opened_at: activity.opened_at,
        replied_at: activity.replied_at,
        email_period: activity.email_period || 'new',
        sequence_name: activity.company_sequences?.email_sequences?.name,
        campaign_name: activity.company_sequences?.companies?.name,
        metadata: activity.metadata,
      });
    });

    // Add campaign recipients
    (campaignRecipients || []).forEach((recipient: any) => {
      emails.push({
        id: recipient.id,
        type: 'campaign',
        subject: recipient.personalized_subject || 'Campaign Email',
        status: recipient.status,
        sent_at: recipient.sent_at,
        opened_at: recipient.opened_at,
        replied_at: null,
        email_period: recipient.email_period || 'new',
        campaign_name: recipient.email_campaigns?.name,
        metadata: { tags: recipient.email_campaigns?.tags },
      });
    });

    return emails;
  }, [emailActivities, campaignRecipients]);

  // Filter emails
  const filteredEmails = useMemo(() => {
    let filtered = allEmails;

    // Filter by period
    if (selectedPeriod !== 'all') {
      filtered = filtered.filter(e => e.email_period === selectedPeriod);
    }

    // Filter by status
    if (selectedStatus !== 'all') {
      filtered = filtered.filter(e => {
        if (selectedStatus === 'sent') return e.status === 'sent';
        if (selectedStatus === 'opened') return e.opened_at !== null;
        if (selectedStatus === 'replied') return e.replied_at !== null;
        if (selectedStatus === 'failed') return e.status === 'failed';
        return true;
      });
    }

    // Filter by search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(e => 
        e.subject.toLowerCase().includes(query) ||
        e.campaign_name?.toLowerCase().includes(query) ||
        e.sequence_name?.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [allEmails, selectedPeriod, selectedStatus, searchQuery]);

  // Group emails by period and date
  const groupedEmails = useMemo(() => {
    const groups: Record<string, EmailRecord[]> = {
      new: [],
      old: [],
      archived: [],
    };

    filteredEmails.forEach(email => {
      const period = email.email_period || 'new';
      groups[period].push(email);
    });

    // Sort each group by date
    Object.keys(groups).forEach(key => {
      groups[key].sort((a, b) => {
        const dateA = a.sent_at ? parseISO(a.sent_at) : new Date(0);
        const dateB = b.sent_at ? parseISO(b.sent_at) : new Date(0);
        return dateB.getTime() - dateA.getTime();
      });
    });

    return groups;
  }, [filteredEmails]);

  const toggleGroup = (group: string) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(group)) {
      newExpanded.delete(group);
    } else {
      newExpanded.add(group);
    }
    setExpandedGroups(newExpanded);
  };

  const getStatusBadge = (email: EmailRecord) => {
    if (email.replied_at) {
      return <Badge variant="default" className="bg-green-500"><Reply className="h-3 w-3 mr-1" />Replied</Badge>;
    }
    if (email.opened_at) {
      return <Badge variant="default" className="bg-blue-500"><Eye className="h-3 w-3 mr-1" />Opened</Badge>;
    }
    if (email.status === 'failed') {
      return <Badge variant="destructive"><AlertCircle className="h-3 w-3 mr-1" />Failed</Badge>;
    }
    return <Badge variant="secondary"><CheckCircle2 className="h-3 w-3 mr-1" />Sent</Badge>;
  };

  const getPeriodBadge = (period?: string) => {
    switch (period) {
      case 'old':
        return <Badge variant="outline" className="border-amber-500 text-amber-700 dark:text-amber-400">Old Email</Badge>;
      case 'archived':
        return <Badge variant="outline" className="border-gray-500 text-gray-700 dark:text-gray-400"><Archive className="h-3 w-3 mr-1" />Archived</Badge>;
      default:
        return <Badge variant="default" className="bg-primary">New Email</Badge>;
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Unknown date';
    try {
      const date = parseISO(dateString);
      if (isToday(date)) return `Today at ${format(date, 'h:mm a')}`;
      if (isThisWeek(date)) return formatDistanceToNow(date, { addSuffix: true });
      if (isThisMonth(date)) return format(date, 'MMM d, h:mm a');
      return format(date, 'MMM d, yyyy');
    } catch {
      return dateString;
    }
  };

  const totalCount = allEmails.length;
  const newCount = groupedEmails.new.length;
  const oldCount = groupedEmails.old.length;
  const archivedCount = groupedEmails.archived.length;

  if (loadingActivities || loadingCampaigns) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Email History
            </CardTitle>
            <CardDescription>
              {totalCount} total emails • {newCount} new • {oldCount} old • {archivedCount} archived
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {showFilters && (
          <div className="space-y-4 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Search</label>
                <Input
                  placeholder="Search emails..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Period</label>
                <Select value={selectedPeriod} onValueChange={(v: any) => setSelectedPeriod(v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Periods</SelectItem>
                    <SelectItem value="new">New Emails</SelectItem>
                    <SelectItem value="old">Old Emails</SelectItem>
                    <SelectItem value="archived">Archived</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Status</label>
                <Select value={selectedStatus} onValueChange={(v: any) => setSelectedStatus(v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="sent">Sent</SelectItem>
                    <SelectItem value="opened">Opened</SelectItem>
                    <SelectItem value="replied">Replied</SelectItem>
                    <SelectItem value="failed">Failed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-4">
          {/* New Emails Section */}
          {groupedEmails.new.length > 0 && (
            <Collapsible open={expandedGroups.has('new')} onOpenChange={() => toggleGroup('new')}>
              <div className="border rounded-lg bg-primary/5 border-primary/20">
                <CollapsibleTrigger asChild>
                  <Button
                    variant="ghost"
                    className="w-full justify-between p-4 h-auto hover:bg-primary/10"
                  >
                    <div className="flex items-center gap-3">
                      <Sparkles className="h-5 w-5 text-primary" />
                      <div className="text-left">
                        <div className="font-semibold">New Emails</div>
                        <div className="text-sm text-muted-foreground">
                          {groupedEmails.new.length} recent email{groupedEmails.new.length !== 1 ? 's' : ''}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="default" className="bg-primary">{groupedEmails.new.length}</Badge>
                      {expandedGroups.has('new') ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </div>
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <Separator />
                  <ScrollArea className="h-[400px]">
                    <div className="p-4 space-y-3">
                      {groupedEmails.new.slice(0, maxItems || 100).map((email) => (
                        <div
                          key={email.id}
                          className="p-3 rounded-lg border bg-background hover:bg-muted/50 transition-colors"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-2">
                                {getPeriodBadge(email.email_period)}
                                {getStatusBadge(email)}
                              </div>
                              <div className="font-medium text-sm mb-1 truncate">{email.subject}</div>
                              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                <span className="flex items-center gap-1">
                                  <Calendar className="h-3 w-3" />
                                  {formatDate(email.sent_at)}
                                </span>
                                {email.campaign_name && (
                                  <span className="truncate">Campaign: {email.campaign_name}</span>
                                )}
                                {email.sequence_name && (
                                  <span className="truncate">Sequence: {email.sequence_name}</span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </CollapsibleContent>
              </div>
            </Collapsible>
          )}

          {/* Old Emails Section */}
          {groupedEmails.old.length > 0 && (
            <Collapsible open={expandedGroups.has('old')} onOpenChange={() => toggleGroup('old')}>
              <div className="border rounded-lg bg-amber-50/50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800">
                <CollapsibleTrigger asChild>
                  <Button
                    variant="ghost"
                    className="w-full justify-between p-4 h-auto hover:bg-amber-100/50 dark:hover:bg-amber-900/30"
                  >
                    <div className="flex items-center gap-3">
                      <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                      <div className="text-left">
                        <div className="font-semibold text-amber-900 dark:text-amber-100">Old Emails</div>
                        <div className="text-sm text-amber-700 dark:text-amber-300">
                          {groupedEmails.old.length} email{groupedEmails.old.length !== 1 ? 's' : ''} from before CRM integration
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="border-amber-500 text-amber-700 dark:text-amber-400">
                        {groupedEmails.old.length}
                      </Badge>
                      {expandedGroups.has('old') ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </div>
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <Separator />
                  <ScrollArea className="h-[400px]">
                    <div className="p-4 space-y-3">
                      {groupedEmails.old.slice(0, maxItems || 100).map((email) => (
                        <div
                          key={email.id}
                          className="p-3 rounded-lg border bg-background/50 border-amber-200 dark:border-amber-800 hover:bg-amber-50/50 dark:hover:bg-amber-950/30 transition-colors opacity-75"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-2">
                                {getPeriodBadge(email.email_period)}
                                {getStatusBadge(email)}
                              </div>
                              <div className="font-medium text-sm mb-1 truncate">{email.subject}</div>
                              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                <span className="flex items-center gap-1">
                                  <Calendar className="h-3 w-3" />
                                  {formatDate(email.sent_at)}
                                </span>
                                {email.campaign_name && (
                                  <span className="truncate">Campaign: {email.campaign_name}</span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </CollapsibleContent>
              </div>
            </Collapsible>
          )}

          {/* Archived Emails Section */}
          {groupedEmails.archived.length > 0 && (
            <Collapsible open={expandedGroups.has('archived')} onOpenChange={() => toggleGroup('archived')}>
              <div className="border rounded-lg bg-gray-50/50 dark:bg-gray-950/20 border-gray-200 dark:border-gray-800">
                <CollapsibleTrigger asChild>
                  <Button
                    variant="ghost"
                    className="w-full justify-between p-4 h-auto hover:bg-gray-100/50 dark:hover:bg-gray-900/30"
                  >
                    <div className="flex items-center gap-3">
                      <Archive className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                      <div className="text-left">
                        <div className="font-semibold text-gray-900 dark:text-gray-100">Archived Emails</div>
                        <div className="text-sm text-gray-700 dark:text-gray-300">
                          {groupedEmails.archived.length} archived email{groupedEmails.archived.length !== 1 ? 's' : ''}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="border-gray-500 text-gray-700 dark:text-gray-400">
                        {groupedEmails.archived.length}
                      </Badge>
                      {expandedGroups.has('archived') ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </div>
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <Separator />
                  <ScrollArea className="h-[400px]">
                    <div className="p-4 space-y-3">
                      {groupedEmails.archived.slice(0, maxItems || 100).map((email) => (
                        <div
                          key={email.id}
                          className="p-3 rounded-lg border bg-background/50 border-gray-200 dark:border-gray-800 hover:bg-gray-50/50 dark:hover:bg-gray-950/30 transition-colors opacity-60"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-2">
                                {getPeriodBadge(email.email_period)}
                                {getStatusBadge(email)}
                              </div>
                              <div className="font-medium text-sm mb-1 truncate">{email.subject}</div>
                              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                <span className="flex items-center gap-1">
                                  <Calendar className="h-3 w-3" />
                                  {formatDate(email.sent_at)}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </CollapsibleContent>
              </div>
            </Collapsible>
          )}

          {totalCount === 0 && (
            <div className="text-center py-12">
              <Mail className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-sm text-muted-foreground">No email history found</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
