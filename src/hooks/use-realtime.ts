import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { RealtimePostgresChangesPayload } from '@supabase/supabase-js';

/**
 * Hook to subscribe to real-time updates for companies table
 */
export const useCompaniesRealtime = () => {
  const queryClient = useQueryClient();

  useEffect(() => {
    const channel = supabase
      .channel('companies-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'companies',
        },
        (payload: RealtimePostgresChangesPayload<any>) => {
          console.log('Companies realtime update:', payload.eventType);
          
          // Invalidate all company-related queries
          queryClient.invalidateQueries({ queryKey: ['companies'] });
          queryClient.invalidateQueries({ queryKey: ['pipeline-stats'] });
          
          // If it's a specific company update, invalidate that too
          if (payload.eventType === 'UPDATE' || payload.eventType === 'DELETE') {
            const companyId = payload.old?.id;
            if (companyId) {
              queryClient.invalidateQueries({ queryKey: ['company', companyId] });
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);
};

/**
 * Hook to subscribe to real-time updates for deals table
 */
export const useDealsRealtime = () => {
  const queryClient = useQueryClient();

  useEffect(() => {
    const channel = supabase
      .channel('deals-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'deals',
        },
        (payload: RealtimePostgresChangesPayload<any>) => {
          console.log('Deals realtime update:', payload.eventType);
          
          queryClient.invalidateQueries({ queryKey: ['deals'] });
          queryClient.invalidateQueries({ queryKey: ['pipeline-stats'] });
          
          if (payload.eventType === 'UPDATE' || payload.eventType === 'DELETE') {
            const dealId = payload.old?.id;
            if (dealId) {
              queryClient.invalidateQueries({ queryKey: ['deal', dealId] });
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);
};

/**
 * Hook to subscribe to real-time updates for email sequences
 */
export const useSequencesRealtime = () => {
  const queryClient = useQueryClient();

  useEffect(() => {
    const channel = supabase
      .channel('sequences-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'email_sequences',
        },
        (payload: RealtimePostgresChangesPayload<any>) => {
          console.log('Sequences realtime update:', payload.eventType);
          
          queryClient.invalidateQueries({ queryKey: ['sequences'] });
          
          if (payload.eventType === 'UPDATE' || payload.eventType === 'DELETE') {
            const sequenceId = payload.old?.id;
            if (sequenceId) {
              queryClient.invalidateQueries({ queryKey: ['sequence', sequenceId] });
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);
};

/**
 * Combined hook for all real-time subscriptions
 */
export const useAllRealtime = () => {
  useCompaniesRealtime();
  useDealsRealtime();
  useSequencesRealtime();
};
