import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Sparkles, 
  CheckCircle, 
  XCircle, 
  Clock, 
  Send, 
  Eye,
  Building2,
  Mail,
  TrendingUp,
  RefreshCw,
  Filter,
  Search
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface PendingResponse {
  id: string;
  company_sequence_id: string;
  subject: string;
  body: string;
  generated_at: string;
  status: 'draft' | 'ready_to_send' | 'approved' | 'rejected';
  company_name: string;
  sequence_name: string;
  inbound_subject?: string;
  inbound_from?: string;
}

export default function AutoResponseHub() {
  const queryClient = useQueryClient();
  const [selectedResponse, setSelectedResponse] = useState<PendingResponse | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [editedSubject, setEditedSubject] = useState('');
  const [editedBody, setEditedBody] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Fetch pending auto-responses
  const { data: responses, isLoading } = useQuery({
    queryKey: ['pending-auto-responses', statusFilter],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Get company sequences with generated responses
      let query = supabase
        .from('company_sequences')
        .select(`
          id,
          metadata,
          created_at,
          companies(name),
          email_sequences(name, created_by)
        `)
        .not('metadata->ai_generated_response', 'is', null)
        .eq('email_sequences.created_by', user.id)
        .order('created_at', { ascending: false });

      const { data, error } = await query;
      
      if (error) throw error;

      // Transform to pending responses
      const pendingResponses: PendingResponse[] = (data || [])
        .filter(seq => {
          const metadata = seq.metadata as any;
          const response = metadata?.ai_generated_response;
          if (!response) return false;
          
          // Filter by status
          if (statusFilter !== 'all') {
            return metadata?.response_status === statusFilter;
          }
          return true;
        })
        .map(seq => {
          const metadata = seq.metadata as any;
          const response = metadata.ai_generated_response;
          
          return {
            id: seq.id,
            company_sequence_id: seq.id,
            subject: response.subject,
            body: response.body,
            generated_at: metadata.generated_at || seq.created_at,
            status: metadata.response_status || 'draft',
            company_name: (seq.companies as any)?.name || 'Unknown',
            sequence_name: (seq.email_sequences as any)?.name || 'Unknown Sequence',
            inbound_subject: metadata.last_inbound_subject,
            inbound_from: metadata.last_inbound_from,
          };
        });

      return pendingResponses;
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Send auto-response
  const sendMutation = useMutation({
    mutationFn: async ({ id, subject, body }: { id: string; subject: string; body: string }) => {
      const { error } = await supabase.functions.invoke('send-ai-response', {
        body: {
          companySequenceId: id,
          subject,
          body,
        },
      });

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      toast.success('Auto-response sent successfully');
      queryClient.invalidateQueries({ queryKey: ['pending-auto-responses'] });
      setSelectedResponse(null);
      setEditMode(false);
    },
    onError: (error: any) => {
      toast.error('Failed to send response', {
        description: error.message,
      });
    },
  });

  // Update response status
  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { data: currentSeq } = await supabase
        .from('company_sequences')
        .select('metadata')
        .eq('id', id)
        .single();

      const { error } = await supabase
        .from('company_sequences')
        .update({
          metadata: {
            ...((currentSeq?.metadata as any) || {}),
            response_status: status,
          },
        })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-auto-responses'] });
      toast.success('Status updated');
    },
  });

  // Regenerate response
  const regenerateMutation = useMutation({
    mutationFn: async (companySequenceId: string) => {
      const { data: threads } = await supabase
        .from('email_threads')
        .select('id')
        .eq('company_sequence_id', companySequenceId)
        .eq('direction', 'inbound')
        .order('received_at', { ascending: false })
        .limit(1);

      if (!threads || threads.length === 0) {
        throw new Error('No inbound emails found to respond to');
      }

      const { error } = await supabase.functions.invoke('generate-ai-response', {
        body: {
          companySequenceId,
          inboundThreadId: threads[0].id,
          autoSend: false,
        },
      });

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Response regenerated successfully');
      queryClient.invalidateQueries({ queryKey: ['pending-auto-responses'] });
    },
    onError: (error: any) => {
      toast.error('Failed to regenerate response', {
        description: error.message,
      });
    },
  });

  const handleEdit = (response: PendingResponse) => {
    setSelectedResponse(response);
    setEditedSubject(response.subject);
    setEditedBody(response.body);
    setEditMode(true);
  };

  const handleSend = (response: PendingResponse) => {
    if (editMode) {
      sendMutation.mutate({
        id: response.company_sequence_id,
        subject: editedSubject,
        body: editedBody,
      });
    } else {
      sendMutation.mutate({
        id: response.company_sequence_id,
        subject: response.subject,
        body: response.body,
      });
    }
  };

  const filteredResponses = responses?.filter(r => 
    !searchQuery || 
    r.company_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.subject.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const stats = {
    pending: responses?.filter(r => r.status === 'draft' || r.status === 'ready_to_send').length || 0,
    approved: responses?.filter(r => r.status === 'approved').length || 0,
    rejected: responses?.filter(r => r.status === 'rejected').length || 0,
  };

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-12 h-12 rounded-xl bg-gradient-primary flex items-center justify-center shadow-lg">
            <Sparkles className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Auto-Response Management</h1>
            <p className="text-sm text-muted-foreground">
              Review, approve, and manage AI-generated email responses
            </p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
              <Clock className="h-4 w-4" />
              Pending Review
            </div>
            <div className="text-3xl font-bold">{stats.pending}</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              Approved
            </div>
            <div className="text-3xl font-bold">{stats.approved}</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
              <XCircle className="h-4 w-4 text-red-500" />
              Rejected
            </div>
            <div className="text-3xl font-bold">{stats.rejected}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by company or subject..."
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
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="ready_to_send">Ready to Send</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Responses List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Pending Responses</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => queryClient.invalidateQueries({ queryKey: ['pending-auto-responses'] })}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </CardTitle>
          <CardDescription>Review and manage AI-generated email responses</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-12">
              <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4" />
              <p className="text-sm text-muted-foreground">Loading responses...</p>
            </div>
          ) : !filteredResponses || filteredResponses.length === 0 ? (
            <div className="text-center py-12">
              <Sparkles className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-sm text-muted-foreground">No pending responses</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredResponses.map((response) => (
                <div
                  key={response.id}
                  className="p-4 rounded-lg border bg-card hover:bg-muted/50 transition-colors cursor-pointer"
                  onClick={() => setSelectedResponse(response)}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-start gap-3 flex-1">
                      <div className="w-10 h-10 rounded-lg bg-gradient-primary flex items-center justify-center shrink-0">
                        <Building2 className="h-5 w-5 text-white" />
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold truncate">{response.company_name}</h3>
                          <Badge variant="outline" className="text-xs">
                            {response.sequence_name}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground truncate mb-2">
                          Re: {response.inbound_subject || 'Email'}
                        </p>
                        <p className="text-sm font-medium truncate">{response.subject}</p>
                        <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                          {response.body}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-2">
                      <Badge 
                        variant={
                          response.status === 'approved' ? 'default' : 
                          response.status === 'rejected' ? 'destructive' : 
                          'secondary'
                        }
                      >
                        {response.status}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(response.generated_at), 'MMM d, HH:mm')}
                      </span>
                    </div>
                  </div>

                  <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleEdit(response)}
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      Review
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => handleSend(response)}
                      disabled={sendMutation.isPending}
                    >
                      <Send className="h-4 w-4 mr-2" />
                      Send Now
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => regenerateMutation.mutate(response.company_sequence_id)}
                      disabled={regenerateMutation.isPending}
                    >
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Regenerate
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => updateStatusMutation.mutate({ 
                        id: response.company_sequence_id, 
                        status: 'rejected' 
                      })}
                    >
                      <XCircle className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Review Dialog */}
      <Dialog open={!!selectedResponse} onOpenChange={() => {
        setSelectedResponse(null);
        setEditMode(false);
      }}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Review AI-Generated Response
            </DialogTitle>
            <DialogDescription>
              {selectedResponse?.company_name} • {selectedResponse?.sequence_name}
            </DialogDescription>
          </DialogHeader>

          {selectedResponse && (
            <div className="space-y-4">
              {selectedResponse.inbound_from && (
                <div className="rounded-lg border bg-muted/50 p-4">
                  <p className="text-sm font-medium mb-1">Replying to:</p>
                  <p className="text-sm text-muted-foreground">
                    From: {selectedResponse.inbound_from}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Subject: {selectedResponse.inbound_subject}
                  </p>
                </div>
              )}

              <Separator />

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-subject">Subject</Label>
                  <Input
                    id="edit-subject"
                    value={editMode ? editedSubject : selectedResponse.subject}
                    onChange={(e) => setEditedSubject(e.target.value)}
                    disabled={!editMode}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-body">Message</Label>
                  <Textarea
                    id="edit-body"
                    value={editMode ? editedBody : selectedResponse.body}
                    onChange={(e) => setEditedBody(e.target.value)}
                    disabled={!editMode}
                    rows={12}
                    className="font-mono text-sm"
                  />
                </div>
              </div>

              <div className="flex justify-between pt-4">
                <div className="flex gap-2">
                  {!editMode && (
                    <Button
                      variant="outline"
                      onClick={() => setEditMode(true)}
                    >
                      Edit Response
                    </Button>
                  )}
                  {editMode && (
                    <Button
                      variant="outline"
                      onClick={() => setEditMode(false)}
                    >
                      Cancel Edit
                    </Button>
                  )}
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => updateStatusMutation.mutate({ 
                      id: selectedResponse.company_sequence_id, 
                      status: 'rejected' 
                    })}
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    Reject
                  </Button>
                  <Button
                    onClick={() => handleSend(selectedResponse)}
                    disabled={sendMutation.isPending}
                  >
                    <Send className="h-4 w-4 mr-2" />
                    {sendMutation.isPending ? 'Sending...' : 'Send Response'}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}