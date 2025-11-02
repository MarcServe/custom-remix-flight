import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { emailSendingApi } from '@/lib/api/email-sending';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

/**
 * Hook to get available email providers
 */
export function useEmailProviders() {
  return useQuery({
    queryKey: ['email-providers'],
    queryFn: () => emailSendingApi.getProviders(),
  });
}

/**
 * Hook to get optimal email provider
 */
export function useOptimalProvider() {
  return useQuery({
    queryKey: ['optimal-email-provider'],
    queryFn: () => emailSendingApi.getOptimalProvider(),
  });
}

/**
 * Hook to validate provider setup
 */
export function useProviderValidation() {
  return useQuery({
    queryKey: ['provider-validation'],
    queryFn: () => emailSendingApi.validateProviderSetup(),
  });
}

/**
 * Hook to send a single email with provider validation
 */
export function useSendEmail() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: emailSendingApi.sendEmail,
    onSuccess: (result) => {
      if (result.error) {
        toast.error('Failed to send email', {
          description: result.error.message,
          action: result.error.message.includes('No email provider')
            ? {
                label: 'Configure Provider',
                onClick: () => navigate('/integrations/email-providers'),
              }
            : undefined,
        });
        return;
      }

      // Show warnings if any
      if (result.warnings && result.warnings.length > 0) {
        toast.warning('Email sent with limited tracking', {
          description: result.warnings[0],
          action: {
            label: 'View Providers',
            onClick: () => navigate('/integrations/email-providers'),
          },
        });
      } else {
        const providerInfo = (result as any).provider;
        toast.success('Email sent successfully', {
          description: providerInfo
            ? `Sent via ${providerInfo.provider} with tracking enabled`
            : undefined,
        });
      }

      queryClient.invalidateQueries({ queryKey: ['email-activities'] });
    },
    onError: (error: Error) => {
      toast.error('Failed to send email', {
        description: error.message,
      });
    },
  });
}

/**
 * Hook to send bulk emails with provider validation
 */
export function useSendBulkEmails() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: emailSendingApi.sendBulkEmails,
    onSuccess: (result) => {
      if (result.error) {
        toast.error('Failed to send emails', {
          description: result.error.message,
          action: result.error.message.includes('No email provider')
            ? {
                label: 'Configure Provider',
                onClick: () => navigate('/integrations/email-providers'),
              }
            : undefined,
        });
        return;
      }

      // Show warnings if any
      if (result.warnings && result.warnings.length > 0) {
        toast.warning('Emails sent with limited tracking', {
          description: result.warnings[0],
          action: {
            label: 'View Providers',
            onClick: () => navigate('/integrations/email-providers'),
          },
        });
      } else {
        const providerInfo = (result as any).provider;
        toast.success('Emails sent successfully', {
          description: providerInfo
            ? `Sent via ${providerInfo.provider} with tracking enabled`
            : undefined,
        });
      }

      queryClient.invalidateQueries({ queryKey: ['email-activities'] });
      queryClient.invalidateQueries({ queryKey: ['email-campaigns'] });
    },
    onError: (error: Error) => {
      toast.error('Failed to send emails', {
        description: error.message,
      });
    },
  });
}

/**
 * Hook to send sequence email with provider validation
 */
export function useSendSequenceEmailWithValidation() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ companySequenceId, stepNumber }: { companySequenceId: string; stepNumber: number }) =>
      emailSendingApi.sendSequenceEmail(companySequenceId, stepNumber),
    onSuccess: (result) => {
      if (result.error) {
        toast.error('Failed to send sequence email', {
          description: result.error.message,
          action: result.error.message.includes('No email provider')
            ? {
                label: 'Configure Provider',
                onClick: () => navigate('/integrations/email-providers'),
              }
            : undefined,
        });
        return;
      }

      // Show warnings if any
      if (result.warnings && result.warnings.length > 0) {
        toast.warning('Sequence email sent with limited tracking', {
          description: result.warnings[0],
          action: {
            label: 'View Providers',
            onClick: () => navigate('/integrations/email-providers'),
          },
        });
      } else {
        const providerInfo = (result as any).provider;
        toast.success('Sequence email sent', {
          description: providerInfo
            ? `Sent via ${providerInfo.provider}`
            : undefined,
        });
      }

      queryClient.invalidateQueries({ queryKey: ['company-sequences'] });
      queryClient.invalidateQueries({ queryKey: ['email-activities'] });
    },
    onError: (error: Error) => {
      toast.error('Failed to send sequence email', {
        description: error.message,
      });
    },
  });
}
