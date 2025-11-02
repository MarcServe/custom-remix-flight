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
          queryClient.invalidateQueries({ queryKey: ['dashboard-companies-count'] });
          queryClient.invalidateQueries({ queryKey: ['dashboard-recent-companies'] });
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
          queryClient.invalidateQueries({ queryKey: ['dashboard-deals-stats'] });
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
 * Hook to subscribe to real-time updates for people table
 */
export const usePeopleRealtime = () => {
  const queryClient = useQueryClient();

  useEffect(() => {
    const channel = supabase
      .channel('people-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'people',
        },
        (payload: RealtimePostgresChangesPayload<any>) => {
          console.log('People realtime update:', payload.eventType);
          
          queryClient.invalidateQueries({ queryKey: ['people'] });
          queryClient.invalidateQueries({ queryKey: ['dashboard-people-count'] });
          
          if (payload.eventType === 'UPDATE' || payload.eventType === 'DELETE') {
            const personId = payload.old?.id;
            if (personId) {
              queryClient.invalidateQueries({ queryKey: ['person', personId] });
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
 * Hook to subscribe to real-time updates for company_sequences table
 */
export const useCompanySequencesRealtime = () => {
  const queryClient = useQueryClient();

  useEffect(() => {
    const channel = supabase
      .channel('company-sequences-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'company_sequences',
        },
        (payload: RealtimePostgresChangesPayload<any>) => {
          console.log('Company sequences realtime update:', payload.eventType);
          
          queryClient.invalidateQueries({ queryKey: ['company-sequences'] });
          
          if (payload.eventType === 'UPDATE' || payload.eventType === 'DELETE') {
            const sequenceId = payload.old?.id;
            if (sequenceId) {
              queryClient.invalidateQueries({ queryKey: ['company-sequence', sequenceId] });
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
 * Hook to subscribe to real-time updates for events table
 */
export const useEventsRealtime = () => {
  const queryClient = useQueryClient();

  useEffect(() => {
    const channel = supabase
      .channel('events-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'events',
        },
        (payload: RealtimePostgresChangesPayload<any>) => {
          console.log('Events realtime update:', payload.eventType);
          
          queryClient.invalidateQueries({ queryKey: ['events'] });
          queryClient.invalidateQueries({ queryKey: ['pending-counts'] });
          
          if (payload.eventType === 'UPDATE' || payload.eventType === 'DELETE') {
            const eventId = payload.old?.id;
            if (eventId) {
              queryClient.invalidateQueries({ queryKey: ['event', eventId] });
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
 * Hook to subscribe to real-time updates for deals table (for notifications)
 */
export const useDealsRealtimeForNotifications = () => {
  const queryClient = useQueryClient();

  useEffect(() => {
    const channel = supabase
      .channel('deals-notifications-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'deals',
        },
        () => {
          console.log('Deals table changed, invalidating pending counts');
          queryClient.invalidateQueries({ queryKey: ['pending-counts'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);
};

/**
 * Hook to subscribe to real-time updates for company_sequences table (for notifications)
 */
export const useCampaignsRealtimeForNotifications = () => {
  const queryClient = useQueryClient();

  useEffect(() => {
    const channel = supabase
      .channel('campaigns-notifications-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'company_sequences',
        },
        () => {
          console.log('Company sequences table changed, invalidating pending counts');
          queryClient.invalidateQueries({ queryKey: ['pending-counts'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);
};

/**
 * Hook to subscribe to real-time updates for email_activities table
 */
export const useEmailActivitiesRealtime = () => {
  const queryClient = useQueryClient();

  useEffect(() => {
    const channel = supabase
      .channel('email-activities-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'email_activities',
        },
        (payload: RealtimePostgresChangesPayload<any>) => {
          console.log('Email activities realtime update:', payload.eventType);
          
          queryClient.invalidateQueries({ queryKey: ['email-activities'] });
          queryClient.invalidateQueries({ queryKey: ['active-conversations'] });
          queryClient.invalidateQueries({ queryKey: ['company-sequences'] });
          
          if (payload.eventType === 'UPDATE') {
            const activityId = payload.new?.id;
            if (activityId) {
              queryClient.invalidateQueries({ queryKey: ['email-activity', activityId] });
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
 * Hook to subscribe to real-time updates for email_threads table
 * Enhanced with more aggressive invalidation for conversations
 */
export const useEmailThreadsRealtime = () => {
  const queryClient = useQueryClient();

  useEffect(() => {
    console.log('🔴 Setting up email_threads realtime subscription');
    
    const channel = supabase
      .channel('email-threads-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'email_threads',
        },
        (payload: RealtimePostgresChangesPayload<any>) => {
          console.log('✅ Email threads realtime update:', payload.eventType, payload.new);
          
          // Aggressively invalidate all conversation-related queries
          queryClient.invalidateQueries({ queryKey: ['email-threads'] });
          queryClient.invalidateQueries({ queryKey: ['active-conversations'] });
          queryClient.invalidateQueries({ queryKey: ['company-sequences'] });
          queryClient.invalidateQueries({ queryKey: ['pending-reviews'] });
          
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            const threadId = payload.new?.id;
            const sequenceId = payload.new?.company_sequence_id;
            
            if (threadId) {
              queryClient.invalidateQueries({ queryKey: ['email-thread', threadId] });
            }
            
            if (sequenceId) {
              queryClient.invalidateQueries({ queryKey: ['email-threads', sequenceId] });
            }
          }
        }
      )
      .subscribe((status) => {
        console.log('Email threads subscription status:', status);
      });

    return () => {
      console.log('🔴 Cleaning up email_threads realtime subscription');
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
  usePeopleRealtime();
  useCompanySequencesRealtime();
  useEventsRealtime();
  useDealsRealtimeForNotifications();
  useCampaignsRealtimeForNotifications();
  useEmailActivitiesRealtime();
  useEmailThreadsRealtime();
};
