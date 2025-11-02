import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { MessageSquare, Loader2, Send, ArrowLeft, ArrowRight, Sparkles, Filter } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

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

export default function Conversations() {
  const { toast } = useToast();
  const [selectedSequence, setSelectedSequence] = useState<string | null>(null);
  const [generatedResponse, setGeneratedResponse] = useState<{ subject: string; body: string } | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [filterAutoSent, setFilterAutoSent] = useState(false);

  const { data: sequences, isLoading } = useQuery({
    queryKey: ['active-conversations'],
    queryFn: async () => {
      // Get all company_sequences that have email threads (both sequences and direct CRM emails)
      const { data: threadsData, error: threadsError } = await supabase
        .from('email_threads')
        .select('company_sequence_id')
        .order('received_at', { ascending: false });

      if (threadsError) throw threadsError;

      // Get unique company_sequence_ids
      const sequenceIds = [...new Set(threadsData?.map(t => t.company_sequence_id) || [])];

      if (sequenceIds.length === 0) {
        return [];
      }

      // Fetch sequences with their companies and email_sequences data
      const { data, error } = await supabase
        .from('company_sequences')
        .select(`
          *,
          companies(name),
          email_sequences(name, goal, auto_respond)
        `)
        .in('id', sequenceIds)
        .order('updated_at', { ascending: false });

      if (error) throw error;
      return data as CompanySequence[];
    },
  });

  const { data: threads } = useQuery({
    queryKey: ['email-threads', selectedSequence],
    enabled: !!selectedSequence,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('email_threads')
        .select('*')
        .eq('company_sequence_id', selectedSequence!)
        .order('received_at', { ascending: true });

      if (error) throw error;
      return data as EmailThread[];
    },
  });

  // Filter threads based on auto-sent toggle
  const filteredThreads = filterAutoSent 
    ? threads?.filter(t => t.metadata?.auto_sent === true)
    : threads;

  const selectedSeqData = sequences?.find(s => s.id === selectedSequence);

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
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-12 h-12 rounded-xl bg-gradient-primary flex items-center justify-center shadow-lg">
            <MessageSquare className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Active Conversations</h1>
            <p className="text-sm text-muted-foreground">
              View and respond to email conversations with AI assistance
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Conversations List */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Conversations</CardTitle>
            <CardDescription>All email threads and replies</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[600px]">
              {!sequences || sequences.length === 0 ? (
                <div className="text-center py-12">
                  <MessageSquare className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-sm text-muted-foreground">No active conversations</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {sequences.map((seq) => (
                    <div
                      key={seq.id}
                      onClick={() => setSelectedSequence(seq.id)}
                      className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                        selectedSequence === seq.id
                          ? 'bg-primary/10 border-primary'
                          : 'hover:bg-muted'
                      }`}
                    >
                      <div className="font-medium">{seq.companies.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {seq.email_sequences.name}
                      </div>
                      {seq.email_sequences.goal && (
                        <div className="text-xs text-muted-foreground mt-1">
                          Goal: {seq.email_sequences.goal}
                        </div>
                      )}
                      <div className="flex gap-2 mt-2">
                        <Badge variant="outline">
                          {seq.next_action.replace(/_/g, ' ')}
                        </Badge>
                        {seq.auto_respond_enabled && (
                          <Badge variant="default" className="bg-gradient-primary text-white">
                            Auto-Response
                          </Badge>
                        )}
                      </div>
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
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>
                  {selectedSeqData
                    ? `${selectedSeqData.companies.name} - ${selectedSeqData.email_sequences.name}`
                    : 'Select a conversation'}
                </CardTitle>
                {selectedSeqData?.email_sequences.goal && (
                  <CardDescription>Goal: {selectedSeqData.email_sequences.goal}</CardDescription>
                )}
              </div>
              {selectedSequence && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setFilterAutoSent(!filterAutoSent)}
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
                          className={`max-w-[80%] rounded-lg p-4 ${
                            thread.direction === 'outbound'
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-muted'
                          }`}
                        >
                          <div className="flex items-center gap-2 mb-2">
                            {thread.direction === 'outbound' ? (
                              <ArrowRight className="h-4 w-4" />
                            ) : (
                              <ArrowLeft className="h-4 w-4" />
                            )}
                            <span className="text-xs font-medium">
                              {thread.direction === 'outbound' ? 'You' : thread.from_email}
                            </span>
                            {thread.metadata?.auto_sent && (
                              <Badge variant="secondary" className="text-xs">
                                <Sparkles className="h-3 w-3 mr-1" />
                                Auto-Sent
                              </Badge>
                            )}
                            {thread.sentiment && getSentimentBadge(thread.sentiment)}
                          </div>
                          <div className="text-sm font-semibold mb-2">{thread.subject}</div>
                          <div className="text-sm whitespace-pre-wrap">{thread.body_text}</div>
                          <div className="text-xs opacity-70 mt-2">
                            {format(new Date(thread.received_at), 'MMM d, HH:mm')}
                          </div>
                          {thread.ai_analysis && (
                            <div className="mt-2 pt-2 border-t border-current/20 text-xs">
                              <div>Intent: {thread.ai_analysis.intent}</div>
                              {thread.ai_analysis.questionsAsked?.length > 0 && (
                                <div>Questions: {thread.ai_analysis.questionsAsked.join(', ')}</div>
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
    </div>
  );
}