import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface ActiveSearch {
  id: string;
  search_params: any;
  status: string;
  progress: number;
  current_status: string;
  stats: any;
  created_at: string;
}

/**
 * Hook to track active lead finder searches globally
 * Can be used from any component to show search progress
 */
export const useActiveSearches = () => {
  const [activeSearches, setActiveSearches] = useState<ActiveSearch[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadActiveSearches = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setIsLoading(false);
          return;
        }

        const { data, error } = await supabase
          .from('lead_finder_searches')
          .select('*')
          .eq('user_id', user.id)
          .eq('status', 'running')
          .order('created_at', { ascending: false });

        if (error) throw error;

        setActiveSearches(data || []);
        setIsLoading(false);
      } catch (error) {
        console.error('Error loading active searches:', error);
        setIsLoading(false);
      }
    };

    loadActiveSearches();

    // Setup realtime subscription
    const setupRealtime = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const channel = supabase
        .channel('active_searches_global')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'lead_finder_searches',
            filter: `user_id=eq.${user.id}`,
          },
          (payload) => {
            if (payload.eventType === 'INSERT' && (payload.new as any).status === 'running') {
              setActiveSearches(prev => [payload.new as ActiveSearch, ...prev]);
            } else if (payload.eventType === 'UPDATE') {
              setActiveSearches(prev =>
                prev.map(search =>
                  search.id === (payload.new as any).id ? (payload.new as ActiveSearch) : search
                ).filter(search => search.status === 'running')
              );
            } else if (payload.eventType === 'DELETE') {
              setActiveSearches(prev =>
                prev.filter(search => search.id !== (payload.old as any).id)
              );
            }
          }
        )
        .subscribe();

      return channel;
    };

    const channelPromise = setupRealtime();

    return () => {
      channelPromise.then(channel => {
        if (channel) supabase.removeChannel(channel);
      });
    };
  }, []);

  const cancelSearch = async (searchId: string) => {
    try {
      await supabase
        .from('lead_finder_searches')
        .update({ status: 'paused' })
        .eq('id', searchId);
    } catch (error) {
      console.error('Error canceling search:', error);
    }
  };

  const deleteSearch = async (searchId: string) => {
    try {
      await supabase
        .from('lead_finder_searches')
        .delete()
        .eq('id', searchId);
    } catch (error) {
      console.error('Error deleting search:', error);
    }
  };

  return {
    activeSearches,
    isLoading,
    hasActiveSearches: activeSearches.length > 0,
    activeSearchCount: activeSearches.length,
    cancelSearch,
    deleteSearch,
  };
};
