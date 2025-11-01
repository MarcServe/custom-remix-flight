import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Hook to fetch pending counts for navigation badges
 */
export const usePendingCounts = () => {
  return useQuery({
    queryKey: ['pending-counts'],
    queryFn: async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return { deals: 0, sequences: 0, campaigns: 0, events: 0 };

        // 1. DEALS: Count active deals not in user_deal_views
        const { data: allDeals } = await supabase
          .from('deals')
          .select('id')
          .in('stage', ['QUALIFIED', 'CONTACTED', 'MEETING', 'PROPOSAL']);

        let unviewedDealsCount = 0;
        if (allDeals && allDeals.length > 0) {
          const { data: viewedDeals } = await supabase
            .from('user_deal_views')
            .select('deal_id')
            .eq('user_id', user.id);

          const viewedDealIds = new Set(viewedDeals?.map(v => v.deal_id) || []);
          unviewedDealsCount = allDeals.filter(d => !viewedDealIds.has(d.id)).length;
        }

        // 2. CAMPAIGNS: Count active campaigns not in user_campaign_views
        const { data: allCampaigns } = await supabase
          .from('company_sequences')
          .select('id')
          .eq('status', 'active');

        let unviewedCampaignsCount = 0;
        if (allCampaigns && allCampaigns.length > 0) {
          const { data: viewedCampaigns } = await supabase
            .from('user_campaign_views')
            .select('company_sequence_id')
            .eq('user_id', user.id);

          const viewedCampaignIds = new Set(viewedCampaigns?.map(v => v.company_sequence_id) || []);
          unviewedCampaignsCount = allCampaigns.filter(c => !viewedCampaignIds.has(c.id)).length;
        }

        // 3. EVENTS: Count unviewed events
        const { data: allEvents } = await supabase
          .from('events')
          .select('id');

        let unviewedEventsCount = 0;
        if (allEvents && allEvents.length > 0) {
          const { data: viewedEvents } = await supabase
            .from('user_event_views')
            .select('event_id')
            .eq('user_id', user.id);

          const viewedEventIds = new Set(viewedEvents?.map(v => v.event_id) || []);
          unviewedEventsCount = allEvents.filter(e => !viewedEventIds.has(e.id)).length;
        }

        return {
          deals: unviewedDealsCount,
          sequences: 0, // Not counting sequences for now
          campaigns: unviewedCampaignsCount,
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
