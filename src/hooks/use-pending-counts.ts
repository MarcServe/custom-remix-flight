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
        const { data: { user } } = await supabase.auth.getUser();
        
        // Get active deals count (using stage, not status)
        const { data: dealsData } = await supabase
          .from('deals')
          .select('id')
          .in('stage', ['QUALIFIED', 'CONTACTED', 'MEETING', 'PROPOSAL']);

        // Get active company sequences count
        const { data: companySequencesData } = await supabase
          .from('company_sequences')
          .select('id')
          .eq('status', 'active');

        // Count unviewed events
        let unviewedEventsCount = 0;
        if (user) {
          // Get all event IDs
          const { data: allEvents } = await supabase
            .from('events')
            .select('id');

          if (allEvents && allEvents.length > 0) {
            // Get event IDs that the user has already viewed
            const { data: viewedEvents } = await supabase
              .from('user_event_views')
              .select('event_id')
              .eq('user_id', user.id);

            const viewedEventIds = new Set(viewedEvents?.map(v => v.event_id) || []);
            unviewedEventsCount = allEvents.filter(e => !viewedEventIds.has(e.id)).length;
          }
        }

        return {
          deals: dealsData?.length || 0,
          sequences: 0, // Not counting sequences for now
          campaigns: companySequencesData?.length || 0,
          events: unviewedEventsCount,
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
