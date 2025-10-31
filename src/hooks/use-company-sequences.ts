import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { companySequencesApi, PersonalizeSequenceRequest } from '@/lib/api/company-sequences';
import { useToast } from '@/hooks/use-toast';

/**
 * Hook to personalize a sequence for a company
 */
export const usePersonalizeSequence = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (request: PersonalizeSequenceRequest) => companySequencesApi.personalizeSequence(request),
    onSuccess: (response) => {
      if (response.error) {
        toast({
          title: 'Error',
          description: response.error.message,
          variant: 'destructive',
        });
        return;
      }

      if (response.data) {
        queryClient.invalidateQueries({ queryKey: ['company-sequences'] });
        toast({
          title: 'Success',
          description: 'Sequence personalized successfully',
        });
      }
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

/**
 * Hook to fetch all company sequences
 */
export const useCompanySequences = () => {
  return useQuery({
    queryKey: ['company-sequences'],
    queryFn: () => companySequencesApi.getCompanySequences(),
  });
};

/**
 * Hook to fetch sequences for a specific company
 */
export const useCompanySequencesByCompany = (companyId: string) => {
  return useQuery({
    queryKey: ['company-sequences', 'company', companyId],
    queryFn: () => companySequencesApi.getCompanySequencesByCompany(companyId),
    enabled: !!companyId,
  });
};

/**
 * Hook to update sequence status
 */
export const useUpdateSequenceStatus = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'draft' | 'active' | 'paused' | 'completed' }) =>
      companySequencesApi.updateSequenceStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-sequences'] });
      toast({
        title: 'Success',
        description: 'Sequence status updated',
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

/**
 * Hook to delete a company sequence
 */
export const useDeleteCompanySequence = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (id: string) => companySequencesApi.deleteCompanySequence(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-sequences'] });
      toast({
        title: 'Success',
        description: 'Sequence deleted successfully',
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
