import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { RealtimePostgresChangesPayload } from '@supabase/supabase-js';

/**
 * Hook to show real-time notifications for email engagement events
 */
export const useEmailNotifications = () => {
  useEffect(() => {
    const channel = supabase
      .channel('email-notifications')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'email_activities',
        },
        (payload: RealtimePostgresChangesPayload<any>) => {
          const oldData = payload.old as any;
          const newData = payload.new as any;

          // Email opened notification
          if (newData.opened_at && !oldData.opened_at) {
            const companyName = newData.metadata?.company_name || 'A recipient';
            toast.success('📧 Email Opened', {
              description: `${companyName} opened your email`,
              duration: 4000,
            });
          }

          // Email clicked notification
          if (newData.metadata?.clicked && !oldData.metadata?.clicked) {
            const companyName = newData.metadata?.company_name || 'A recipient';
            const link = newData.metadata?.clicked_links?.[0];
            toast.success('🖱️ Link Clicked', {
              description: link 
                ? `${companyName} clicked: ${link.substring(0, 50)}...`
                : `${companyName} clicked a link in your email`,
              duration: 4000,
            });
          }

          // Email replied notification
          if (newData.replied_at && !oldData.replied_at) {
            const companyName = newData.metadata?.company_name || 'A recipient';
            toast.success('💬 Reply Received!', {
              description: `${companyName} replied to your email`,
              duration: 5000,
              action: {
                label: 'View',
                onClick: () => window.location.href = '/conversations',
              },
            });
          }

          // Email bounced notification
          if (newData.status === 'bounced' && oldData.status !== 'bounced') {
            const reason = newData.metadata?.bounce_reason || 'Unknown reason';
            toast.error('⚠️ Email Bounced', {
              description: `Email failed to deliver: ${reason}`,
              duration: 6000,
            });
          }

          // Auto-response sent notification
          if (newData.metadata?.auto_sent && !oldData.metadata?.auto_sent) {
            const companyName = newData.metadata?.company_name || 'recipient';
            toast.info('🤖 Auto-Response Sent', {
              description: `AI sent an automatic reply to ${companyName}`,
              duration: 4000,
            });
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'email_threads',
        },
        (payload: RealtimePostgresChangesPayload<any>) => {
          const newThread = payload.new;
          
          // New inbound email (reply) – redirect to Conversations tab and open the right conversation
          if (newThread.direction === 'inbound') {
            const conversationsUrl = newThread.company_sequence_id
              ? `/conversations?sequence=${newThread.company_sequence_id}`
              : '/conversations';
            toast.info('📨 New reply received', {
              description: `From: ${newThread.from_email}`,
              duration: 5000,
              action: {
                label: 'View in Conversations',
                onClick: () => { window.location.href = conversationsUrl; },
              },
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);
};

/**
 * Hook to show notifications for pending review items
 */
export const usePendingReviewNotifications = () => {
  useEffect(() => {
    const channel = supabase
      .channel('pending-review-notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'ai_response_queue',
        },
        (payload: RealtimePostgresChangesPayload<any>) => {
          const newItem = payload.new;
          
          if (newItem.status === 'pending_review') {
            const companyName = newItem.metadata?.company_name || 'a company';
            toast.info('✨ AI Response Ready', {
              description: `AI generated a response for ${companyName}`,
              duration: 6000,
              action: {
                label: 'Review',
                onClick: () => window.location.href = '/conversations',
              },
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);
};

/**
 * Hook to show notifications for sequence status changes
 */
export const useSequenceNotifications = () => {
  useEffect(() => {
    const channel = supabase
      .channel('sequence-notifications')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'company_sequences',
        },
        (payload: RealtimePostgresChangesPayload<any>) => {
          const oldData = payload.old as any;
          const newData = payload.new as any;

          // Sequence completed notification
          if (newData.status === 'completed' && oldData.status !== 'completed') {
            toast.success('✅ Sequence Completed', {
              description: 'A company sequence has finished all steps',
              duration: 4000,
            });
          }

          // Sequence paused notification (usually due to bounce/unsubscribe)
          if (newData.status === 'paused' && oldData.status === 'active') {
            toast.warning('⏸️ Sequence Paused', {
              description: 'A sequence was paused due to deliverability issue',
              duration: 5000,
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);
};

/**
 * Combined hook for all email-related notifications
 */
export const useAllEmailNotifications = () => {
  useEmailNotifications();
  usePendingReviewNotifications();
  useSequenceNotifications();
};
