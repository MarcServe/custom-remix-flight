import { useMutation } from '@tanstack/react-query';
import { leadFinderApi, LeadFinderRequest } from '@/lib/api/lead-finder';
import { useToast } from '@/hooks/use-toast';

/**
 * Hook to find leads using AI
 */
export const useLeadFinder = () => {
  const { toast } = useToast();

  return useMutation({
    mutationFn: (request: LeadFinderRequest) => leadFinderApi.findLeads(request),
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
        toast({
          title: 'Success',
          description: `Found ${response.data.leads.length} leads. ${
            response.data.dryRun
              ? 'Preview mode - no companies inserted.'
              : `Inserted ${response.data.inserted} companies.`
          }`,
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
