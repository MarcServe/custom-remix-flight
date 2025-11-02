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

/**
 * Hook to send next email in sequence
 */
export const useSendSequenceEmail = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: ({ companySequenceId, stepNumber }: { companySequenceId: string; stepNumber: number }) =>
      companySequencesApi.sendSequenceEmail(companySequenceId, stepNumber),
    onSuccess: (response, variables) => {
      if (response.error) {
        toast({
          title: 'Error',
          description: response.error.message,
          variant: 'destructive',
        });
        return;
      }

      queryClient.invalidateQueries({ queryKey: ['company-sequences'] });
      queryClient.invalidateQueries({ queryKey: ['email-activities', variables.companySequenceId] });
      
      toast({
        title: 'Email sent!',
        description: `Step ${variables.stepNumber + 1} sent successfully`,
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
 * Hook to fetch email activities for a sequence
 */
export const useEmailActivities = (companySequenceId: string) => {
  return useQuery({
    queryKey: ['email-activities', companySequenceId],
    queryFn: () => companySequencesApi.getEmailActivities(companySequenceId),
    enabled: !!companySequenceId,
  });
};

/**
 * Hook to update sequence settings (auto-respond and automation rules)
 */
export const useUpdateSequenceSettings = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (params: {
      id: string;
      autoRespondEnabled: boolean;
      automationRules: {
        enabled: boolean;
        rules: Array<{
          type: string;
          action: string;
          wait_hours: number;
        }>;
      };
    }) => companySequencesApi.updateSequenceSettings(params.id, params.autoRespondEnabled, params.automationRules),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-sequences'] });
      queryClient.invalidateQueries({ queryKey: ['company-sequences-page'] });
      toast({
        title: 'Settings updated',
        description: 'Sequence settings saved successfully',
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
