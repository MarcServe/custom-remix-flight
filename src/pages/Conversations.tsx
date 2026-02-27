import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { MessageSquare, Loader2, Send, ArrowLeft, ArrowRight, Sparkles, Filter, Settings, RefreshCw, Trash2, TrendingUp, Inbox } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { PendingReviewsBadge } from "@/components/sequences/PendingReviewsBadge";
import { AutoResponseReviewModal } from "@/components/sequences/AutoResponseReviewModal";
import { usePendingReviews, PendingReview } from "@/hooks/use-pending-reviews";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useEmailThreadsRealtime } from "@/hooks/use-realtime";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSendEmail } from "@/hooks/use-email-sending";
import { QuickReplyTemplates } from "@/components/QuickReplyTemplates";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CreateDealDialog, type DealInitialValues } from "@/components/CreateDealDialog";

interface EmailThread {
  id: string;
  direction: 'inbound' | 'outbound';
  subject: string;
  body_text: string;
  body_html?: string | null;
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
  } | null;
  email_sequences: {
    name: string;
    goal?: string;
    auto_respond: boolean;
  } | null;
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
  const [searchParams, setSearchParams] = useSearchParams();
  
  // Subscribe to realtime updates for email threads
  useEmailThreadsRealtime();

  const [selectedSequence, setSelectedSequence] = useState<string | null>(null);
  const [selectedPersonalThread, setSelectedPersonalThread] = useState<string | null>(null);
  const [conversationType, setConversationType] = useState<"sequences" | "personal">("sequences");
  const [composeMode, setComposeMode] = useState<"ai" | "manual">("ai");
  const [generatedResponse, setGeneratedResponse] = useState<{ subject: string; body: string } | null>(null);
  const [manualReply, setManualReply] = useState<{ subject: string; body: string }>({ subject: "", body: "" });
  const [replySenderProfileId, setReplySenderProfileId] = useState<string>("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [syncingInbound, setSyncingInbound] = useState(false);
  const [filterAutoSent, setFilterAutoSent] = useState(false);
  const [selectedReview, setSelectedReview] = useState<PendingReview | null>(null);
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  /** When set, delete confirmation will delete this conversation (from list row); otherwise uses current selection's threads */
  const [conversationToDelete, setConversationToDelete] = useState<{
    type: 'sequence' | 'personal';
    id: string;
    threads?: { id: string }[];
  } | null>(null);
  const [dealDialogOpen, setDealDialogOpen] = useState(false);
  const [dealInitialValues, setDealInitialValues] = useState<DealInitialValues | null>(null);
  const [isMovingToDeal, setIsMovingToDeal] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date>(new Date());

  const sendEmailMutation = useSendEmail();

  const { data: pendingReviews } = usePendingReviews();

  const { data: senderProfiles = [] } = useQuery({
    queryKey: ['sender-profiles'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      const { data, error } = await supabase
        .from('sender_profiles')
        .select('id, name, display_name')
        .eq('user_id', user.id)
        .order('name');
      if (error) return [];
      return (data || []) as { id: string; name: string; display_name: string | null }[];
    },
  });

  // Enhanced polling - refetch conversations more frequently
  useEffect(() => {
    const interval = setInterval(() => {
      queryClient.invalidateQueries({ queryKey: ['active-conversations'] });
      queryClient.invalidateQueries({ queryKey: ['personal-conversations'] });
      if (selectedSequence) {
        queryClient.invalidateQueries({ queryKey: ['email-threads', selectedSequence] });
      }
      if (selectedPersonalThread) {
        queryClient.invalidateQueries({ queryKey: ['email-threads', selectedSequence, selectedPersonalThread, conversationType] });
      }
      setLastSyncTime(new Date());
    }, 15000); // 15 seconds

    return () => clearInterval(interval);
  }, [queryClient, selectedSequence, selectedPersonalThread, conversationType]);

  // Fetch personal conversations (non-sequence emails). Request enough rows so we don't hit default 1000 cap and miss threads.
  const { data: personalConversations, refetch: refetchPersonalConversations } = useQuery({
    queryKey: ['personal-conversations'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('email_threads')
        .select('*')
        .is('company_sequence_id', null)
        .order('received_at', { ascending: false })
        .limit(2000);

      if (error) throw error;

      const rows = Array.isArray(data) ? data : [];
      // Normalize emails for consistent grouping (DB may store mixed case)
      const norm = (e: string) => (e || '').trim().toLowerCase();
      // Group by thread_id or (from_email, to_email) pair
      const grouped = rows.reduce((acc: any[], thread: any) => {
        const tFrom = norm(thread?.from_email);
        const tTo = norm(thread?.to_email);
        const existingConv = acc.find((c: any) =>
          (thread?.thread_id && c.thread_id === thread.thread_id) ||
          (norm(c.to_email) === tTo && norm(c.from_email) === tFrom)
        );

        if (existingConv) {
          existingConv.threads.push(thread);
        } else {
          const isToResend = tTo.includes('resend.app');
          const title = isToResend ? (thread?.from_email || thread?.to_email) : (thread?.to_email || thread?.from_email);
          acc.push({
            id: thread?.thread_id || thread?.id,
            thread_id: thread?.thread_id,
            title: title || 'Unknown',
            subject: thread?.subject,
            to_email: thread?.to_email,
            from_email: thread?.from_email,
            lastActivity: thread?.received_at,
            threads: [thread],
            type: 'personal'
          });
        }
        return acc;
      }, []);

      return grouped;
    },
  });

  const { data: conversations, isLoading, isError: isConversationsError, error: conversationsError, refetch: refetchConversations } = useQuery({
    queryKey: ['active-conversations'],
    refetchInterval: 15000,
    retry: 1,
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
            // Skip sequences with deleted companies or email sequences
            if (!seq.companies || !seq.email_sequences) {
              console.warn(`Skipping sequence ${seq.id} - missing company or email sequence data`);
              return;
            }
            
            const latestThread = threadsData?.find(t => t.company_sequence_id === seq.id);
            allConversations.push({
              id: seq.id,
              type: 'sequence',
              title: seq.companies?.name || 'Unknown Company',
              subtitle: seq.email_sequences?.name || 'Deleted Sequence',
              goal: seq.email_sequences?.goal,
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
        const latestThread = threads?.[0];
        if (!latestThread) return;
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

  // Auto-select conversation from URL parameter (after conversations are loaded)
  useEffect(() => {
    const sequenceId = searchParams.get('sequence');
    if (!sequenceId || !conversations) return;
    const conversation = conversations.find(c => c.id === sequenceId);
    setSelectedSequence(sequenceId);
    setConversationType('sequences');
    setSearchParams({}, { replace: true });
    if (conversation) {
      toast({
        title: "Conversation loaded",
        description: `Viewing conversation with ${conversation.title}`,
      });
    }
    // If not in list (e.g. sequence has no threads yet), we still show the panel and load threads by id
  }, [searchParams, conversations, setSearchParams, toast]);

  const { data: threads, refetch: refetchThreads } = useQuery({
    queryKey: ['email-threads', selectedSequence, selectedPersonalThread, conversationType, conversations],
    enabled: (conversationType === 'sequences' && !!selectedSequence) || 
             (conversationType === 'personal' && !!selectedPersonalThread),
    refetchInterval: 15000, // Refetch every 15 seconds when conversation is selected
    queryFn: async () => {
      if (conversationType === 'sequences') {
        console.log(`Fetching threads for sequence: ${selectedSequence}`);
        const selectedConv = conversations?.find((c: any) => c.id === selectedSequence);
        // When opened from notification URL, sequence may not be in list yet; still load threads by id
        let query = supabase.from('email_threads').select('*');
        if (selectedConv?.type === 'standalone') {
          const recipientEmail = selectedConv.recipientEmail!;
          query = query
            .is('company_sequence_id', null)
            .or(`from_email.eq.${recipientEmail},to_email.eq.${recipientEmail}`);
        } else {
          query = query.eq('company_sequence_id', selectedSequence!);
        }

        const { data, error } = await query.order('received_at', { ascending: true });

        if (error) throw error;
        console.log(`Loaded ${data?.length || 0} threads for sequence conversation`);
        return data as EmailThread[];
      } else {
        // Personal emails
        console.log(`Fetching threads for personal thread: ${selectedPersonalThread}`);
        const personalConv = personalConversations?.find(c => c.id === selectedPersonalThread);
        if (!personalConv) return [];

        let query = supabase.from('email_threads').select('*');

        if (personalConv.thread_id) {
          query = query.eq('thread_id', personalConv.thread_id);
        } else {
          query = query
            .is('company_sequence_id', null)
            .or(`and(to_email.eq.${personalConv.to_email},from_email.eq.${personalConv.from_email}),and(to_email.eq.${personalConv.from_email},from_email.eq.${personalConv.to_email})`);
        }

        const { data, error } = await query.order('received_at', { ascending: true });

        if (error) throw error;
        console.log(`Loaded ${data?.length || 0} threads for personal conversation`);
        return data as EmailThread[];
      }
    },
  });

  // When sequence is from URL but not in list (e.g. notification), fetch it for the header
  const { data: sequenceFromUrl } = useQuery({
    queryKey: ['sequence-by-id', selectedSequence],
    enabled: conversationType === 'sequences' && !!selectedSequence && !conversations?.some((c: any) => c.id === selectedSequence),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('company_sequences')
        .select('*, companies(name), email_sequences(name, goal, auto_respond)')
        .eq('id', selectedSequence!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  // Filter threads based on auto-sent toggle
  const filteredThreads = filterAutoSent 
    ? threads?.filter(t => t.metadata?.auto_sent === true)
    : threads;

  const selectedConversationFromList = conversationType === 'sequences'
    ? conversations?.find((c: any) => c.id === selectedSequence)
    : personalConversations?.find((c: any) => c.id === selectedPersonalThread);
  const selectedConversation = selectedConversationFromList ?? (conversationType === 'sequences' && selectedSequence && sequenceFromUrl
    ? {
        id: sequenceFromUrl.id,
        type: 'sequence' as const,
        title: sequenceFromUrl.companies?.name || 'Unknown Company',
        subtitle: sequenceFromUrl.email_sequences?.name || 'Sequence',
        goal: sequenceFromUrl.email_sequences?.goal,
        latest_activity: sequenceFromUrl.updated_at,
        sequenceData: sequenceFromUrl,
      }
    : undefined);
  const selectedSeqData = selectedConversation?.type === 'sequence' ? selectedConversation?.sequenceData : undefined;

  // Auto-fill reply subject from the conversation thread when threads load or conversation changes
  useEffect(() => {
    const threadSubject = threads?.[0]?.subject ?? (threads?.length ? threads[threads.length - 1]?.subject : undefined) ?? '';
    if (!threadSubject) return;
    const replySubject = threadSubject.toLowerCase().startsWith('re:') ? threadSubject : `Re: ${threadSubject}`;
    setManualReply((prev) => ({ ...prev, subject: replySubject }));
  }, [threads, selectedSequence, selectedPersonalThread]);

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
      
      // Refresh threads
      refetchThreads();

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

  const handleSendManualReply = async () => {
    if (!manualReply.subject || !manualReply.body) {
      toast({
        title: "Missing fields",
        description: "Please enter both subject and body",
        variant: "destructive",
      });
      return;
    }

    // Determine recipient email based on conversation type
    let recipientEmail: string | undefined;

    if (conversationType === 'sequences') {
      const lastInbound = threads?.slice().reverse().find(t => t.direction === 'inbound');
      recipientEmail = lastInbound?.from_email;
    } else {
      // For personal emails, get the recipient from the selected thread
      const personalConv = personalConversations?.find(c => c.id === selectedPersonalThread);
      if (personalConv) {
        // Get the email that's NOT the current user's
        const lastThread = threads?.[threads.length - 1];
        recipientEmail = lastThread?.direction === 'inbound' 
          ? lastThread.from_email 
          : personalConv.to_email || personalConv.from_email;
      }
    }

    if (!recipientEmail) {
      toast({
        title: "Error",
        description: "Cannot determine recipient email",
        variant: "destructive",
      });
      return;
    }

    try {
      await sendEmailMutation.mutateAsync({
        to: recipientEmail,
        subject: manualReply.subject,
        body: manualReply.body,
        companySequenceId: selectedSequence || undefined,
        sender_profile_id: replySenderProfileId || undefined,
      });

      // Clear manual reply
      setManualReply({ subject: "", body: "" });
      
      // Refresh threads
      refetchThreads();

      toast({
        title: "Email sent",
        description: "Your reply has been sent successfully",
      });
    } catch (error: any) {
      console.error('Error sending manual reply:', error);
    }
  };

  const handleQuickTemplate = (subject: string, body: string) => {
    setManualReply({ subject, body });
  };

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([
        refetchConversations(),
        refetchPersonalConversations(),
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

  const handleSyncInbound = async () => {
    setSyncingInbound(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const { data, error } = await supabase.functions.invoke('sync-inbound-from-resend', {
        headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
      });
      if (error) throw error;
      const processed = (data as { processed?: number })?.processed ?? 0;
      const skipped = (data as { skipped?: number })?.skipped ?? 0;
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['active-conversations'] }),
        queryClient.invalidateQueries({ queryKey: ['personal-conversations'] }),
        queryClient.invalidateQueries({ queryKey: ['email-threads'] }),
      ]);
      // Refetch so the list updates immediately; switch to Personal tab when new emails were added (standalone go there)
      const refetches = [refetchConversations(), refetchPersonalConversations()];
      await Promise.all(refetches);
      if (processed > 0) setConversationType('personal');
      toast({
        title: "Inbound sync complete",
        description: processed > 0
          ? `${processed} new message(s) added. Open the Personal tab — they may appear as fewer conversation threads (replies in the same thread are grouped). ${skipped} skipped (already in CRM).`
          : skipped > 0
            ? `${skipped} already in CRM — no new emails to import.`
            : "No new emails from Resend to import (or all were from your own address and are skipped).",
      });
    } catch (e: any) {
      toast({
        title: "Sync failed",
        description: e?.message ?? "Could not sync inbound emails from Resend.",
        variant: "destructive",
      });
    } finally {
      setSyncingInbound(false);
    }
  };

  const handleDeleteConversation = async () => {
    let ids: string[];
    if (conversationToDelete) {
      if (conversationToDelete.type === 'personal' && conversationToDelete.threads?.length) {
        ids = conversationToDelete.threads.map((t) => t.id);
      } else if (conversationToDelete.type === 'sequence') {
        const { data: seqThreads, error: fetchErr } = await supabase
          .from('email_threads')
          .select('id')
          .eq('company_sequence_id', conversationToDelete.id);
        if (fetchErr || !seqThreads?.length) {
          toast({
            title: "Delete failed",
            description: fetchErr?.message ?? "No messages found for this conversation.",
            variant: "destructive",
          });
          setDeleteDialogOpen(false);
          setConversationToDelete(null);
          return;
        }
        ids = seqThreads.map((t) => t.id);
      } else {
        setDeleteDialogOpen(false);
        setConversationToDelete(null);
        return;
      }
    } else {
      if (!threads?.length) return;
      ids = threads.map((t) => t.id);
    }
    if (ids.length === 0) {
      toast({ title: "Nothing to delete", description: "This conversation has no messages.", variant: "destructive" });
      setDeleteDialogOpen(false);
      setConversationToDelete(null);
      return;
    }
    const { error } = await supabase.from('email_threads').delete().in('id', ids);
    if (error) {
      toast({
        title: "Delete failed",
        description: error.message,
        variant: "destructive",
      });
      return;
    }
    setDeleteDialogOpen(false);
    setConversationToDelete(null);
    if (conversationToDelete) {
      if (conversationToDelete.type === 'sequence') {
        if (selectedSequence === conversationToDelete.id) setSelectedSequence(null);
      } else {
        if (selectedPersonalThread === conversationToDelete.id) setSelectedPersonalThread(null);
      }
    } else {
      if (conversationType === 'sequences') {
        setSelectedSequence(null);
      } else {
        setSelectedPersonalThread(null);
      }
    }
    queryClient.invalidateQueries({ queryKey: ['active-conversations'] });
    queryClient.invalidateQueries({ queryKey: ['personal-conversations'] });
    queryClient.invalidateQueries({ queryKey: ['email-threads'] });
    toast({ title: "Conversation deleted", description: "The conversation has been removed." });
  };

  const handleMoveToDeals = async () => {
    if (!threads?.length) return;
    setIsMovingToDeal(true);
    try {
      const { data, error } = await supabase.functions.invoke('analyze-conversation-for-deal', {
        body: { threadIds: threads.map((t) => t.id) },
      });
      if (error) throw error;
      if (!data || typeof data.title !== 'string') {
        throw new Error(data?.error || 'AI could not extract deal details');
      }
      setDealInitialValues({
        title: data.title,
        company_name: data.company_name ?? undefined,
        company_id: undefined,
        amount: data.amount ?? undefined,
        stage: data.stage ?? 'CONTACTED',
        priority: data.priority ?? 'medium',
        notes: data.notes ?? undefined,
      });
      setDealDialogOpen(true);
      toast({
        title: "Deal draft ready",
        description: "Review and save the AI-suggested deal below.",
      });
    } catch (e: any) {
      toast({
        title: "Move to Deals failed",
        description: e?.message || "Could not analyze conversation",
        variant: "destructive",
      });
    } finally {
      setIsMovingToDeal(false);
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
      <div className="container mx-auto p-4 sm:p-6 max-w-7xl flex flex-col items-center justify-center min-h-[400px] gap-3">
        <p className="text-sm text-muted-foreground">Loading conversations…</p>
        <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden />
      </div>
    );
  }

  if (isConversationsError) {
    const errMsg = conversationsError instanceof Error ? conversationsError.message : 'Please try again.';
    return (
      <div className="container mx-auto p-4 sm:p-6 max-w-7xl">
        <Alert variant="destructive">
          <AlertDescription className="flex flex-wrap items-center gap-2">
            <span>Failed to load conversations. {errMsg}</span>
            <Button variant="outline" size="sm" onClick={() => refetchConversations()}>
              Retry
            </Button>
          </AlertDescription>
        </Alert>
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
                  Auto-refresh: 15s
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

      <div className="flex flex-col gap-6">
        {/* Pending Reviews Alert */}
        {pendingReviews && pendingReviews.length > 0 && (
          <div>
            <Card className="border-2 border-primary/30 bg-primary/5">
              <CardHeader className="pb-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
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

        {/* Conversations List with Tabs */}
        <Tabs value={conversationType} onValueChange={(v) => setConversationType(v as "sequences" | "personal")} className="w-full">
          <TabsList className="mb-4 w-full sm:w-auto">
            <TabsTrigger value="sequences" className="flex-1 sm:flex-initial">
              <span className="mr-2">Sequences</span>
              <Badge variant="secondary" className="ml-1">{conversations?.filter((c: any) => c.type === 'sequence').length || 0}</Badge>
            </TabsTrigger>
            <TabsTrigger value="personal" className="flex-1 sm:flex-initial">
              <span className="mr-2">Personal</span>
              <Badge variant="secondary" className="ml-1">{personalConversations?.length || 0}</Badge>
            </TabsTrigger>
          </TabsList>

          <TabsContent value={conversationType}>
            <Card>
              <CardHeader>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <CardTitle>{conversationType === 'sequences' ? 'Sequence Conversations' : 'Personal Emails'}</CardTitle>
                    <CardDescription>
                      {conversationType === 'sequences'
                        ? 'Email threads from active sequences'
                        : 'Standalone emails and replies to test/campaign emails appear here under the sender\'s address. Use Refresh if you don\'t see a reply yet.'}
                    </CardDescription>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSyncInbound}
                    disabled={syncingInbound}
                    className="shrink-0"
                  >
                    {syncingInbound ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Inbox className="h-4 w-4 mr-2" />}
                    Sync inbound
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[400px]">
                  {(() => {
                    const activeList = conversationType === 'sequences'
                      ? (conversations?.filter((c: any) => c.type === 'sequence') ?? [])
                      : (personalConversations ?? []);
                    const selectedId = conversationType === 'sequences' ? selectedSequence : selectedPersonalThread;
                    const setSelectedId = conversationType === 'sequences' ? setSelectedSequence : setSelectedPersonalThread;

                    if (!activeList || activeList.length === 0) {
                      return (
                        <div className="text-center py-12">
                          <MessageSquare className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                          <p className="text-sm text-muted-foreground">
                            {conversationType === 'sequences'
                              ? 'No active sequence conversations'
                              : 'No personal emails yet. Replies to test emails show here under the address you replied from.'}
                          </p>
                          {conversationType === 'sequences' && (
                            <p className="text-xs text-muted-foreground mt-2 max-w-sm">
                              Inbound replies require the Resend <code className="text-xs">email.received</code> webhook pointing to your Supabase function (see docs).
                            </p>
                          )}
                        </div>
                      );
                    }

                    return (
                      <div className="space-y-2">
                        {activeList.map((conv: any) => (
                          <div
                            key={conv.id}
                            onClick={() => setSelectedId(conv.id)}
                            className={`p-3 rounded-lg border cursor-pointer transition-colors overflow-hidden group flex items-start justify-between gap-2 ${
                              selectedId === conv.id
                                ? 'bg-primary/10 border-primary'
                                : 'hover:bg-muted'
                            }`}
                          >
                            <div className="flex flex-col gap-2 w-full min-w-0">
                              <div className="flex items-start justify-between gap-2">
                                <div className="font-medium whitespace-normal line-clamp-2 flex-1">{conv.title}</div>
                                <div className="flex items-center gap-1 shrink-0">
                                  {(conv.type === 'standalone' || conv.type === 'personal') && (
                                    <Badge variant="secondary" className="text-xs">
                                      {conv.type === 'personal' ? 'Personal' : 'Standalone'}
                                    </Badge>
                                  )}
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 shrink-0 opacity-70 hover:opacity-100 hover:bg-destructive/10 hover:text-destructive"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setConversationToDelete({
                                        type: conversationType === 'sequences' ? 'sequence' : 'personal',
                                        id: conv.id,
                                        threads: conv.threads?.map((t: any) => ({ id: t.id })),
                                      });
                                      setDeleteDialogOpen(true);
                                    }}
                                    title="Delete conversation"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                              {conv.subtitle && (
                                <p className="text-sm text-muted-foreground whitespace-normal line-clamp-2">{conv.subtitle}</p>
                              )}
                              {conv.goal && (
                                <p className="text-xs text-muted-foreground whitespace-normal line-clamp-2">Goal: {conv.goal}</p>
                              )}
                              {conv.subject && (
                                <p className="text-xs text-muted-foreground whitespace-normal line-clamp-2">
                                  Subject: {conv.subject}
                                </p>
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
                    );
                  })()}
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Conversation Thread */}
        <Card>
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
              <div className="flex items-center gap-2 shrink-0">
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
                {(selectedSequence || selectedPersonalThread) && threads && threads.length > 0 && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm">
                        Actions
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => handleMoveToDeals()}
                        disabled={isMovingToDeal}
                      >
                        {isMovingToDeal ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <TrendingUp className="h-4 w-4 mr-2" />
                        )}
                        Move to Deals (AI)
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => {
                          setConversationToDelete(null);
                          setDeleteDialogOpen(true);
                        }}
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete conversation
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {!selectedSequence && !selectedPersonalThread ? (
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
                          {thread.body_html?.trim() ? (
                            <div className="text-sm break-words overflow-hidden rounded border border-border/50 bg-background/50">
                              <iframe
                                title="Email content"
                                sandbox="allow-same-origin"
                                src={`data:text/html;charset=utf-8,${encodeURIComponent('<!DOCTYPE html><html><head><meta charset="utf-8"><base target="_blank" rel="noopener noreferrer"></head><body style="margin:0;padding:0.5rem;font-family:inherit;font-size:inherit;line-height:1.5;">' + thread.body_html.replace(/<script\b[\s\S]*?<\/script>/gi, '') + '</body></html>')}`}
                                className="w-full min-h-[80px] border-0"
                                style={{ maxHeight: '400px' }}
                              />
                            </div>
                          ) : (
                            <div className="text-sm whitespace-pre-wrap break-words">{thread.body_text}</div>
                          )}
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

                {/* Reply Section */}
                <div className="space-y-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between flex-wrap gap-3">
                    <div className="flex-1">
                      <h3 className="font-semibold">Reply</h3>
                      {selectedSeqData?.auto_respond_enabled && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Auto-Response is enabled - AI will send responses automatically
                        </p>
                      )}
                      {conversationType === 'personal' && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Personal emails support manual replies only
                        </p>
                      )}
                    </div>
                    {!selectedSeqData?.auto_respond_enabled && conversationType === 'sequences' && (
                      <Tabs value={composeMode} onValueChange={(v) => setComposeMode(v as "ai" | "manual")}>
                        <TabsList>
                          <TabsTrigger value="ai">
                            <Sparkles className="h-4 w-4 mr-1" />
                            AI Compose
                          </TabsTrigger>
                          <TabsTrigger value="manual">
                            Manual
                          </TabsTrigger>
                        </TabsList>
                      </Tabs>
                    )}
                  </div>

                  {!selectedSeqData?.auto_respond_enabled && (
                    <>
                      {conversationType === 'sequences' && composeMode === "ai" ? (
                        <div className="space-y-4">
                          {!generatedResponse && (
                            <Button
                              onClick={handleGenerateResponse}
                              disabled={isGenerating}
                              className="w-full"
                            >
                              {isGenerating ? (
                                <>
                                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                  Generating...
                                </>
                              ) : (
                                <>
                                  <Sparkles className="h-4 w-4 mr-2" />
                                  Generate AI Response
                                </>
                              )}
                            </Button>
                          )}

                          {generatedResponse && (
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
                      ) : (
                        <div className="space-y-4">
                          <QuickReplyTemplates onSelect={handleQuickTemplate} />
                          {senderProfiles.length > 0 && (
                            <div className="space-y-2">
                              <Label>Reply as (branding)</Label>
                              <Select value={replySenderProfileId || "default"} onValueChange={(v) => setReplySenderProfileId(v === "default" ? "" : v)}>
                                <SelectTrigger className="w-full max-w-xs">
                                  <SelectValue placeholder="Default (business branding)" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="default">Default (business branding)</SelectItem>
                                  {senderProfiles.map((p) => (
                                    <SelectItem key={p.id} value={p.id}>
                                      {p.display_name || p.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          )}
                          <div className="space-y-3">
                            <div>
                              <Label>Subject</Label>
                              <Input
                                value={manualReply.subject}
                                onChange={(e) =>
                                  setManualReply({ ...manualReply, subject: e.target.value })
                                }
                                placeholder="Email subject"
                              />
                            </div>
                            <div>
                              <Label>Body</Label>
                              <Textarea
                                value={manualReply.body}
                                onChange={(e) =>
                                  setManualReply({ ...manualReply, body: e.target.value })
                                }
                                className="min-h-[200px]"
                                placeholder="Type your message..."
                              />
                            </div>
                            <Button 
                              className="w-full"
                              onClick={handleSendManualReply}
                              disabled={sendEmailMutation.isPending || !manualReply.subject || !manualReply.body}
                            >
                              {sendEmailMutation.isPending ? (
                                <>
                                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                  Sending...
                                </>
                              ) : (
                                <>
                                  <Send className="h-4 w-4 mr-2" />
                                  Send Reply
                                </>
                              )}
                            </Button>
                          </div>
                        </div>
                      )}
                    </>
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

      <AlertDialog
        open={deleteDialogOpen}
        onOpenChange={(open) => {
          setDeleteDialogOpen(open);
          if (!open) setConversationToDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete conversation?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove this conversation and all its messages. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConversation} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <CreateDealDialog
        open={dealDialogOpen}
        onOpenChange={(open) => {
          setDealDialogOpen(open);
          if (!open) setDealInitialValues(null);
        }}
        initialValues={dealInitialValues}
        onSuccess={() => navigate('/deals')}
      />
    </div>
  );
}