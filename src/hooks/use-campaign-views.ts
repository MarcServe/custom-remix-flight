import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export const useMarkCampaignAsViewed = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (companySequenceId: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');
      
      const { error } = await supabase
        .from('user_campaign_views')
        .upsert({
          user_id: user.id,
          company_sequence_id: companySequenceId,
          viewed_at: new Date().toISOString()
        }, {
          onConflict: 'user_id,company_sequence_id'
        });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-counts'] });
    }
  });
};

export const useMarkMultipleCampaignsAsViewed = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (companySequenceIds: string[]) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');
      
      const records = companySequenceIds.map(id => ({
        user_id: user.id,
        company_sequence_id: id,
        viewed_at: new Date().toISOString()
      }));
      
      const { error } = await supabase
        .from('user_campaign_views')
        .upsert(records, {
          onConflict: 'user_id,company_sequence_id'
        });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-counts'] });
    }
  });
};
