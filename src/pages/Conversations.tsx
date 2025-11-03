import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { MessageSquare, Loader2, Send, ArrowLeft, ArrowRight, Sparkles, Filter, Settings, RefreshCw } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { PendingReviewsBadge } from "@/components/sequences/PendingReviewsBadge";
import { AutoResponseReviewModal } from "@/components/sequences/AutoResponseReviewModal";
import { usePendingReviews, PendingReview } from "@/hooks/use-pending-reviews";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useNavigate } from "react-router-dom";
import { useEmailThreadsRealtime } from "@/hooks/use-realtime";

interface EmailThread {
  id: string;
  direction: 'inbound' | 'outbound';
  subject: string;
  body_text: string;
  from_email: string;
  to_email: string;
  received_at: string;
  sentiment?: string;
  ai_analysis?: any;
  metadata?: {
    auto_sent?: boolean;
    [key: string]: any;
  };
}

interface CompanySequence {
  id: string;
  company_id: string;
  status: string;
  next_action: string;
  auto_respond_enabled: boolean;
  companies: {
    name: string;
  };
  email_sequences: {
    name: string;
    goal?: string;
    auto_respond: boolean;
  };
}

interface Conversation {
  id: string;
  type: 'sequence' | 'standalone';
  title: string;
  subtitle?: string;
  goal?: string;
  latest_activity: string;
  sequenceData?: CompanySequence;
  recipientEmail?: string;
}

export default function Conversations() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  // Subscribe to realtime updates for email threads
  useEmailThreadsRealtime();
  
  const [selectedSequence, setSelectedSequence] = useState<string | null>(null);
  const [generatedResponse, setGeneratedResponse] = useState<{ subject: string; body: string } | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [filterAutoSent, setFilterAutoSent] = useState(false);
  const [selectedReview, setSelectedReview] = useState<PendingReview | null>(null);
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date>(new Date());

  const { data: pendingReviews } = usePendingReviews();

  // Polling fallback - refetch conversations every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      console.log('Auto-refreshing conversations...');
      queryClient.invalidateQueries({ queryKey: ['active-conversations'] });
      queryClient.invalidateQueries({ queryKey: ['email-threads'] });
      setLastSyncTime(new Date());
    }, 30000); // 30 seconds

    return () => clearInterval(interval);
  }, [queryClient]);

  const { data: conversations, isLoading, refetch: refetchConversations } = useQuery({
    queryKey: ['active-conversations'],
    queryFn: async () => {
      console.log('Fetching active conversations...');
      setLastSyncTime(new Date());
      const allConversations: Conversation[] = [];

      // Get all email threads
      const { data: threadsData, error: threadsError } = await supabase
        .from('email_threads')
        .select('company_sequence_id, from_email, to_email, subject, received_at, direction')
        .order('received_at', { ascending: false });

      if (threadsError) throw threadsError;
      
      console.log(`Loaded ${threadsData?.length || 0} email threads`);

      // 1. Group threads by company_sequence_id (sequence-based)
      const sequenceIds = [...new Set(
        threadsData
          ?.map(t => t.company_sequence_id)
          .filter((id): id is string => id !== null) || []
      )];

      if (sequenceIds.length > 0) {
        const { data: sequences, error: seqError } = await supabase
          .from('company_sequences')
          .select(`
            *,
            companies(name),
            email_sequences(name, goal, auto_respond)
          `)
          .in('id', sequenceIds)
          .order('updated_at', { ascending: false });

        if (!seqError && sequences) {
          sequences.forEach((seq) => {
            const latestThread = threadsData?.find(t => t.company_sequence_id === seq.id);
            allConversations.push({
              id: seq.id,
              type: 'sequence',
              title: seq.companies.name,
              subtitle: seq.email_sequences.name,
              goal: seq.email_sequences.goal,
              latest_activity: latestThread?.received_at || seq.updated_at,
              sequenceData: seq,
            });
          });
        }
      }

      // 2. Group standalone threads by recipient email
      const standaloneThreads = threadsData?.filter(t => t.company_sequence_id === null) || [];
      const standaloneByRecipient = standaloneThreads.reduce((acc, thread) => {
        const recipientEmail = thread.direction === 'outbound' ? thread.to_email : thread.from_email;
        if (!acc[recipientEmail]) {
          acc[recipientEmail] = [];
        }
        acc[recipientEmail].push(thread);
        return acc;
      }, {} as Record<string, typeof standaloneThreads>);

      Object.entries(standaloneByRecipient).forEach(([email, threads]) => {
        const latestThread = threads[0];
        allConversations.push({
          id: `standalone-${email}`,
          type: 'standalone',
          title: email,
          subtitle: latestThread.subject || 'No subject',
          latest_activity: latestThread.received_at,
          recipientEmail: email,
        });
      });

      // Sort by latest activity
      return allConversations.sort((a, b) => 
        new Date(b.latest_activity).getTime() - new Date(a.latest_activity).getTime()
      );
    },
  });

  const { data: threads, refetch: refetchThreads } = useQuery({
    queryKey: ['email-threads', selectedSequence],
    enabled: !!selectedSequence,
    refetchInterval: 15000, // Refetch every 15 seconds when conversation is selected
    queryFn: async () => {
      console.log(`Fetching threads for conversation: ${selectedSequence}`);
      const selectedConv = conversations?.find(c => c.id === selectedSequence);
      if (!selectedConv) return [];

      let query = supabase.from('email_threads').select('*');

      if (selectedConv.type === 'sequence') {
        query = query.eq('company_sequence_id', selectedSequence!);
      } else {
        // Standalone: filter by recipient email and null company_sequence_id
        const recipientEmail = selectedConv.recipientEmail!;
        query = query
          .is('company_sequence_id', null)
          .or(`from_email.eq.${recipientEmail},to_email.eq.${recipientEmail}`);
      }

      const { data, error } = await query.order('received_at', { ascending: true });

      if (error) throw error;
      console.log(`Loaded ${data?.length || 0} threads for conversation`);
      return data as EmailThread[];
    },
  });

  // Filter threads based on auto-sent toggle
  const filteredThreads = filterAutoSent 
    ? threads?.filter(t => t.metadata?.auto_sent === true)
    : threads;

  const selectedConversation = conversations?.find(c => c.id === selectedSequence);
  const selectedSeqData = selectedConversation?.sequenceData;

  const handleGenerateResponse = async () => {
    if (!selectedSequence) return;

    try {
      setIsGenerating(true);

      const lastInbound = threads?.reverse().find(t => t.direction === 'inbound');
      if (!lastInbound) {
        toast({
          title: "No inbound email",
          description: "Cannot generate response without an inbound email",
          variant: "destructive",
        });
        return;
      }

      const { data, error } = await supabase.functions.invoke('generate-ai-response', {
        body: {
          companySequenceId: selectedSequence,
          inboundThreadId: lastInbound.id,
          autoSend: false,
        },
      });

      if (error) throw error;

      setGeneratedResponse({
        subject: data.subject,
        body: data.body,
      });

      toast({
        title: "Response generated",
        description: "AI has created a personalized response",
      });

    } catch (error: any) {
      console.error('Error generating response:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to generate response",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSendResponse = async () => {
    if (!selectedSequence || !generatedResponse) return;

    try {
      setIsGenerating(true);

      const lastInbound = threads?.reverse().find(t => t.direction === 'inbound');
      if (!lastInbound) {
        toast({
          title: "Error",
          description: "Cannot send response without recipient information",
          variant: "destructive",
        });
        return;
      }

      const { data, error } = await supabase.functions.invoke('send-ai-response', {
        body: {
          companySequenceId: selectedSequence,
          subject: generatedResponse.subject,
          body: generatedResponse.body,
          recipientEmail: lastInbound.from_email,
        },
      });

      if (error) throw error;

      toast({
        title: "Response sent!",
        description: "Your email has been sent successfully",
      });

      // Clear the generated response after sending
      setGeneratedResponse(null);

    } catch (error: any) {
      console.error('Error sending response:', error);
      toast({
        title: "Failed to send",
        description: error.message || "Could not send the email",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([
        refetchConversations(),
        refetchThreads(),
      ]);
      setLastSyncTime(new Date());
      toast({
        title: "Refreshed",
        description: "Conversations updated successfully",
      });
    } catch (error) {
      console.error('Error refreshing:', error);
      toast({
        title: "Error",
        description: "Failed to refresh conversations",
        variant: "destructive",
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  const getSentimentBadge = (sentiment?: string) => {
    if (!sentiment) return null;

    const variants: Record<string, "default" | "secondary" | "destructive"> = {
      positive: "default",
      interested: "default",
      neutral: "secondary",
      negative: "destructive",
      not_interested: "destructive",
      requesting_info: "default",
    };

    return <Badge variant={variants[sentiment] || "secondary"}>{sentiment}</Badge>;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 sm:p-6 max-w-7xl">
      <div className="mb-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-primary flex items-center justify-center shadow-lg shrink-0">
              <MessageSquare className="h-6 w-6 text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold">Conversations</h1>
              <p className="text-sm text-muted-foreground">
                All email threads and replies
              </p>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 w-full sm:w-auto">
            <div className="text-left sm:text-right">
              <p className="text-xs text-muted-foreground">
                Last synced: {format(lastSyncTime, 'HH:mm:ss')}
              </p>
              <p className="text-xs text-muted-foreground">
                Auto-refresh: 30s
              </p>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Button
                variant="outline"
                size="sm"
                onClick={handleManualRefresh}
                disabled={isRefreshing}
                className="flex-1 sm:flex-initial"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              <PendingReviewsBadge />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Pending Reviews Alert */}
        {pendingReviews && pendingReviews.length > 0 && (
          <div className="lg:col-span-3">
            <Card className="border-2 border-primary/30 bg-primary/5">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-primary" />
                    <CardTitle className="text-lg">
                      {pendingReviews.length} {pendingReviews.length === 1 ? 'Response' : 'Responses'} Awaiting Review
                    </CardTitle>
                  </div>
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => {
                      if (pendingReviews[0]) {
                        setSelectedReview(pendingReviews[0]);
                        setReviewModalOpen(true);
                      }
                    }}
                  >
                    Review Now
                  </Button>
                </div>
                <CardDescription>
                  AI has generated responses that require your approval before sending
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {pendingReviews.slice(0, 3).map((review) => (
                    <div
                      key={review.id}
                      className="p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors cursor-pointer"
                      onClick={() => {
                        setSelectedReview(review);
                        setReviewModalOpen(true);
                      }}
                    >
                      <p className="font-medium text-sm truncate">
                        {review.metadata?.company_name || 'Company'}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {review.metadata?.subject || 'No subject'}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {format(new Date(review.generated_at), 'MMM d, HH:mm')}
                      </p>
                    </div>
                  ))}
                </div>
                {pendingReviews.length > 3 && (
                  <p className="text-xs text-muted-foreground mt-3">
                    + {pendingReviews.length - 3} more pending
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Conversations List */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Conversations</CardTitle>
            <CardDescription>All email threads and replies</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[600px]">
              {!conversations || conversations.length === 0 ? (
                <div className="text-center py-12">
                  <MessageSquare className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-sm text-muted-foreground">No active conversations</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {conversations.map((conv) => (
                    <div
                      key={conv.id}
                      onClick={() => setSelectedSequence(conv.id)}
                      className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                        selectedSequence === conv.id
                          ? 'bg-primary/10 border-primary'
                          : 'hover:bg-muted'
                      }`}
                    >
                      <div className="flex flex-col gap-2 w-full">
                        <div className="flex items-start justify-between gap-2">
                          <div className="font-medium whitespace-normal line-clamp-2 flex-1">{conv.title}</div>
                          {conv.type === 'standalone' && (
                            <Badge variant="secondary" className="text-xs shrink-0">Standalone</Badge>
                          )}
                        </div>
                        {conv.subtitle && (
                          <p className="text-sm text-muted-foreground whitespace-normal line-clamp-2">{conv.subtitle}</p>
                        )}
                        {conv.goal && (
                          <p className="text-xs text-muted-foreground whitespace-normal line-clamp-2">Goal: {conv.goal}</p>
                        )}
                      </div>
                      {conv.type === 'sequence' && conv.sequenceData && (
                        <div className="flex gap-2 mt-2">
                          <Badge variant="outline">
                            {conv.sequenceData.next_action.replace(/_/g, ' ')}
                          </Badge>
                          {conv.sequenceData.auto_respond_enabled && (
                            <Badge variant="default" className="bg-gradient-primary text-white">
                              Auto-Response
                            </Badge>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Conversation Thread */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <CardTitle className="truncate">
                  {selectedConversation
                    ? selectedConversation.type === 'sequence' 
                      ? `${selectedConversation.title} - ${selectedConversation.subtitle}`
                      : selectedConversation.title
                    : 'Select a conversation'}
                </CardTitle>
                {selectedConversation?.goal && (
                  <CardDescription className="truncate">Goal: {selectedConversation.goal}</CardDescription>
                )}
              </div>
              {selectedSequence && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setFilterAutoSent(!filterAutoSent)}
                  className="shrink-0"
                >
                  <Filter className="h-4 w-4 mr-2" />
                  {filterAutoSent ? "Show All" : "Auto-Sent Only"}
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {!selectedSequence ? (
              <div className="text-center py-12">
                <MessageSquare className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-sm text-muted-foreground">
                  Select a conversation to view the thread
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                <ScrollArea className="h-[400px] pr-4">
                  <div className="space-y-4">
                    {filteredThreads?.length === 0 && filterAutoSent && (
                      <div className="text-center py-8">
                        <p className="text-sm text-muted-foreground">No auto-sent emails in this conversation</p>
                      </div>
                    )}
                    {filteredThreads?.map((thread) => (
                      <div
                        key={thread.id}
                        className={`flex ${thread.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-[85%] sm:max-w-[80%] rounded-lg p-4 min-w-0 ${
                            thread.direction === 'outbound'
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-muted'
                          }`}
                        >
                          <div className="flex items-center gap-2 mb-2 flex-wrap">
                            {thread.direction === 'outbound' ? (
                              <ArrowRight className="h-4 w-4 shrink-0" />
                            ) : (
                              <ArrowLeft className="h-4 w-4 shrink-0" />
                            )}
                            <span className="text-xs font-medium truncate break-all">
                              {thread.direction === 'outbound' ? 'You' : thread.from_email}
                            </span>
                            {thread.metadata?.auto_sent && (
                              <Badge variant="secondary" className="text-xs shrink-0">
                                <Sparkles className="h-3 w-3 mr-1" />
                                Auto-Sent
                              </Badge>
                            )}
                            {thread.sentiment && getSentimentBadge(thread.sentiment)}
                          </div>
                          <div className="text-sm font-semibold mb-2 break-words">{thread.subject}</div>
                          <div className="text-sm whitespace-pre-wrap break-words">{thread.body_text}</div>
                          <div className="text-xs opacity-70 mt-2">
                            {format(new Date(thread.received_at), 'MMM d, HH:mm')}
                          </div>
                          {thread.ai_analysis && (
                            <div className="mt-2 pt-2 border-t border-current/20 text-xs">
                              <div className="break-words">Intent: {thread.ai_analysis.intent}</div>
                              {thread.ai_analysis.questionsAsked?.length > 0 && (
                                <div className="break-words">Questions: {thread.ai_analysis.questionsAsked.join(', ')}</div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>

                <Separator />

                {/* AI Response Section */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold">AI-Generated Response</h3>
                      {selectedSeqData?.auto_respond_enabled && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Auto-Response is enabled - AI will send responses automatically
                        </p>
                      )}
                    </div>
                    {!selectedSeqData?.auto_respond_enabled && (
                      <Button
                        onClick={handleGenerateResponse}
                        disabled={isGenerating}
                        size="sm"
                      >
                        {isGenerating ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Generating...
                          </>
                        ) : (
                          <>
                            <Sparkles className="h-4 w-4 mr-2" />
                            Generate Response
                          </>
                        )}
                      </Button>
                    )}
                  </div>

                  {!selectedSeqData?.auto_respond_enabled && generatedResponse && (
                    <div className="space-y-3">
                      <div>
                        <Label>Subject</Label>
                        <Input
                          value={generatedResponse.subject}
                          onChange={(e) =>
                            setGeneratedResponse({ ...generatedResponse, subject: e.target.value })
                          }
                        />
                      </div>
                      <div>
                        <Label>Body</Label>
                        <Textarea
                          value={generatedResponse.body}
                          onChange={(e) =>
                            setGeneratedResponse({ ...generatedResponse, body: e.target.value })
                          }
                          className="min-h-[200px]"
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button 
                          className="flex-1"
                          onClick={handleSendResponse}
                          disabled={isGenerating}
                        >
                          {isGenerating ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Sending...
                            </>
                          ) : (
                            <>
                              <Send className="h-4 w-4 mr-2" />
                              Send Response
                            </>
                          )}
                        </Button>
                        <Button 
                          variant="outline" 
                          onClick={handleGenerateResponse}
                          disabled={isGenerating}
                        >
                          Regenerate
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Review Modal */}
      <AutoResponseReviewModal
        open={reviewModalOpen}
        onOpenChange={setReviewModalOpen}
        review={selectedReview}
      />
    </div>
  );
}