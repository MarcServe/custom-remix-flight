import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';

/**
 * Live toasts for new notifications (replies, texts, finished sends, bounces…).
 * Reads the `notifications` table over realtime; the rows are created by
 * database triggers, so every source (webhooks, crons, API) is covered.
 */
export const useAllEmailNotifications = () => {
  const queryClient = useQueryClient();
  useEffect(() => {
    let userId: string | null = null;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    supabase.auth.getUser().then(({ data }) => {
      userId = data.user?.id ?? null;
      if (!userId) return;
      channel = supabase
        .channel('notification-toasts')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` }, (payload) => {
          const n = payload.new as { id: string; type: string; title: string; body: string | null; link: string | null };
          queryClient.invalidateQueries({ queryKey: ['notifications', userId] });
          queryClient.invalidateQueries({ queryKey: ['pending-counts'] });
          const isAlert = n.type === 'bounce' || n.type === 'sms_opt_out';
          (isAlert ? toast.warning : toast.success)(n.title, {
            description: n.body || undefined,
            duration: 6000,
            action: n.link ? { label: 'Open', onClick: () => { window.location.href = n.link!; } } : undefined,
          });
        })
        .subscribe();
    });
    return () => { if (channel) supabase.removeChannel(channel); };
  }, [queryClient]);
};

/** @deprecated kept for imports; notifications now come from the notifications table. */
export const useEmailNotifications = useAllEmailNotifications;

/** @deprecated no-ops kept so older imports compile; covered by useAllEmailNotifications. */
export const usePendingReviewNotifications = () => {};
export const useSequenceNotifications = () => {};
