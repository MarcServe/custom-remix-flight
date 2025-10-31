import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { eventsApi, EventFilters, CreateEventRequest } from '@/lib/api/events';
import { useToast } from '@/hooks/use-toast';

export const useEvents = (filters?: EventFilters) => {
  return useQuery({
    queryKey: ['events', filters],
    queryFn: () => eventsApi.getEvents(filters),
  });
};

export const useCompanyEvents = (companyId: string) => {
  return useQuery({
    queryKey: ['events', 'company', companyId],
    queryFn: () => eventsApi.getCompanyEvents(companyId),
    enabled: !!companyId,
  });
};

export const useDealEvents = (dealId: string) => {
  return useQuery({
    queryKey: ['events', 'deal', dealId],
    queryFn: () => eventsApi.getDealEvents(dealId),
    enabled: !!dealId,
  });
};

export const useCreateEvent = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (event: CreateEventRequest) => eventsApi.createEvent(event),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      toast({
        title: 'Success',
        description: 'Event created successfully',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
};

export const useUpdateEvent = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<CreateEventRequest> }) =>
      eventsApi.updateEvent(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      toast({
        title: 'Success',
        description: 'Event updated successfully',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
};

export const useDeleteEvent = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (id: string) => eventsApi.deleteEvent(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      toast({
        title: 'Success',
        description: 'Event deleted successfully',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
};
