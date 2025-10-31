import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { sequencesApi, SequenceRequest } from '@/lib/api/sequences';
import { useToast } from '@/hooks/use-toast';

/**
 * Hook to generate an email sequence
 */
export const useGenerateSequence = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (request: SequenceRequest) => sequencesApi.generateSequence(request),
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
        queryClient.invalidateQueries({ queryKey: ['sequences'] });
        toast({
          title: 'Success',
          description: `Generated ${response.data.sequence.length}-step email sequence`,
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
 * Hook to fetch all sequences
 */
export const useSequences = () => {
  return useQuery({
    queryKey: ['sequences'],
    queryFn: () => sequencesApi.getSequences(),
  });
};

/**
 * Hook to fetch a single sequence
 */
export const useSequence = (id: string) => {
  return useQuery({
    queryKey: ['sequence', id],
    queryFn: () => sequencesApi.getSequence(id),
    enabled: !!id,
  });
};

/**
 * Hook to delete a sequence
 */
export const useDeleteSequence = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (id: string) => sequencesApi.deleteSequence(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sequences'] });
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
