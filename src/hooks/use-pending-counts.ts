import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Hook to fetch pending counts for navigation badges
 */
export const usePendingCounts = () => {
  return useQuery({
    queryKey: ['pending-counts'],
    queryFn: async () => {
      const now = new Date().toISOString();
      
      try {
        // Get active deals count - using or filter instead of in
        const { data: dealsData } = await supabase
          .from('deals')
          .select('id')
          .or('status.eq.qualification,status.eq.proposal,status.eq.negotiation');

        // Get active company sequences count
        const { data: companySequencesData } = await supabase
          .from('company_sequences')
          .select('id')
          .eq('status', 'active');

        // Get upcoming events (next 7 days)
        const nextWeek = new Date();
        nextWeek.setDate(nextWeek.getDate() + 7);
        
        const { data: eventsData } = await supabase
          .from('events')
          .select('id')
          .gte('event_date', now)
          .lte('event_date', nextWeek.toISOString());

        return {
          deals: dealsData?.length || 0,
          sequences: 0, // Not counting sequences for now
          campaigns: companySequencesData?.length || 0,
          events: eventsData?.length || 0,
        };
      } catch (error) {
        console.error('Error fetching pending counts:', error);
        return {
          deals: 0,
          sequences: 0,
          campaigns: 0,
          events: 0,
        };
      }
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });
};
