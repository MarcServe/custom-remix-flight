import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export const useMarkEventAsViewed = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (eventId: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');
      
      const { error } = await supabase
        .from('user_event_views')
        .upsert({
          user_id: user.id,
          event_id: eventId,
          viewed_at: new Date().toISOString()
        }, {
          onConflict: 'user_id,event_id'
        });
      
      if (error) throw error;
    },
    onSuccess: () => {
      // Invalidate pending counts to update the badge
      queryClient.invalidateQueries({ queryKey: ['pending-counts'] });
    }
  });
};

export const useMarkMultipleEventsAsViewed = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (eventIds: string[]) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');
      
      const records = eventIds.map(eventId => ({
        user_id: user.id,
        event_id: eventId,
        viewed_at: new Date().toISOString()
      }));
      
      const { error } = await supabase
        .from('user_event_views')
        .upsert(records, {
          onConflict: 'user_id,event_id'
        });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-counts'] });
    }
  });
};
