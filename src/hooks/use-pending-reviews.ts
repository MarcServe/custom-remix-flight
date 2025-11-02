import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface PendingReview {
  id: string;
  company_sequence_id: string;
  email_activity_id: string;
  ai_model: string;
  response_time_ms: number;
  token_count: number;
  generated_at: string;
  review_status: 'pending' | 'approved' | 'rejected' | 'sent';
  requires_review: boolean;
  metadata: {
    subject?: string;
    body?: string;
    inbound_from?: string;
    inbound_subject?: string;
    company_name?: string;
    sequence_name?: string;
  };
}

/**
 * Hook to fetch pending reviews count
 */
export const usePendingReviewsCount = () => {
  return useQuery({
    queryKey: ['pending-reviews-count'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return 0;

      const { count, error } = await supabase
        .from('auto_response_analytics')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('requires_review', true)
        .eq('review_status', 'pending');

      if (error) throw error;
      return count || 0;
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });
};

/**
 * Hook to fetch all pending reviews
 */
export const usePendingReviews = () => {
  return useQuery({
    queryKey: ['pending-reviews'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('auto_response_analytics')
        .select('*')
        .eq('user_id', user.id)
        .eq('requires_review', true)
        .eq('review_status', 'pending')
        .order('generated_at', { ascending: false });

      if (error) throw error;
      return (data || []) as PendingReview[];
    },
  });
};

/**
 * Hook to approve and send a review
 */
export const useApproveReview = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      reviewId, 
      subject, 
      body 
    }: { 
      reviewId: string; 
      subject?: string;
      body?: string;
    }) => {
      const { data: review } = await supabase
        .from('auto_response_analytics')
        .select('company_sequence_id, metadata')
        .eq('id', reviewId)
        .single();

      if (!review) throw new Error('Review not found');

      // Send the email
      const { error: sendError } = await supabase.functions.invoke('send-ai-response', {
        body: {
          companySequenceId: review.company_sequence_id,
          subject: subject || (review.metadata as any)?.subject,
          body: body || (review.metadata as any)?.body,
        },
      });

      if (sendError) throw sendError;

      // Mark as approved and sent
      const { error: updateError } = await supabase
        .from('auto_response_analytics')
        .update({
          review_status: 'sent',
          reviewed_at: new Date().toISOString(),
          reviewed_by: (await supabase.auth.getUser()).data.user?.id,
          sent_at: new Date().toISOString(),
        })
        .eq('id', reviewId);

      if (updateError) throw updateError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-reviews'] });
      queryClient.invalidateQueries({ queryKey: ['pending-reviews-count'] });
      toast.success('Response approved and sent successfully');
    },
    onError: (error: Error) => {
      toast.error('Failed to approve review', {
        description: error.message,
      });
    },
  });
};

/**
 * Hook to reject a review
 */
export const useRejectReview = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (reviewId: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('auto_response_analytics')
        .update({
          review_status: 'rejected',
          reviewed_at: new Date().toISOString(),
          reviewed_by: user.id,
        })
        .eq('id', reviewId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-reviews'] });
      queryClient.invalidateQueries({ queryKey: ['pending-reviews-count'] });
      toast.success('Review rejected');
    },
    onError: (error: Error) => {
      toast.error('Failed to reject review', {
        description: error.message,
      });
    },
  });
};

/**
 * Hook to regenerate a response
 */
export const useRegenerateReview = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (reviewId: string) => {
      const { data: review } = await supabase
        .from('auto_response_analytics')
        .select('company_sequence_id')
        .eq('id', reviewId)
        .single();

      if (!review) throw new Error('Review not found');

      // Find the latest inbound thread
      const { data: threads } = await supabase
        .from('email_threads')
        .select('id')
        .eq('company_sequence_id', review.company_sequence_id)
        .eq('direction', 'inbound')
        .order('received_at', { ascending: false })
        .limit(1);

      if (!threads || threads.length === 0) {
        throw new Error('No inbound emails found');
      }

      // Delete old review
      await supabase
        .from('auto_response_analytics')
        .delete()
        .eq('id', reviewId);

      // Generate new response
      const { error } = await supabase.functions.invoke('generate-ai-response', {
        body: {
          companySequenceId: review.company_sequence_id,
          inboundThreadId: threads[0].id,
          autoSend: false,
        },
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-reviews'] });
      queryClient.invalidateQueries({ queryKey: ['pending-reviews-count'] });
      toast.success('Response regenerated successfully');
    },
    onError: (error: Error) => {
      toast.error('Failed to regenerate response', {
        description: error.message,
      });
    },
  });
};
