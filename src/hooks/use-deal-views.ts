import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export const useMarkDealAsViewed = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (dealId: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');
      
      const { error } = await supabase
        .from('user_deal_views')
        .upsert({
          user_id: user.id,
          deal_id: dealId,
          viewed_at: new Date().toISOString()
        }, {
          onConflict: 'user_id,deal_id'
        });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-counts'] });
    }
  });
};

export const useMarkMultipleDealsAsViewed = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (dealIds: string[]) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');
      
      const records = dealIds.map(dealId => ({
        user_id: user.id,
        deal_id: dealId,
        viewed_at: new Date().toISOString()
      }));
      
      const { error } = await supabase
        .from('user_deal_views')
        .upsert(records, {
          onConflict: 'user_id,deal_id'
        });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-counts'] });
    }
  });
};
