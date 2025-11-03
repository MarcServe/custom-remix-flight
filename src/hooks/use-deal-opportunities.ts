import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { toast } from 'sonner';

interface FindOpportunitiesRequest {
  companyIds?: string[];
  maxOpportunities?: number;
}

interface Opportunity {
  companyId: string;
  companyName: string;
  title: string;
  description: string;
  estimatedValue: 'low' | 'medium' | 'high';
  urgency: 'low' | 'medium' | 'high';
  emailSubject: string;
  emailBody: string;
  talkingPoints: string[];
}

interface SendEmailRequest {
  opportunity: Opportunity;
  sendImmediately: boolean;
}

export function useFindDealOpportunities() {
  return useMutation({
    mutationFn: async (request: FindOpportunitiesRequest) => {
      const { data, error } = await apiClient.callFunction('find-deal-opportunities', request);
      if (error) throw error;
      return data;
    },
    onError: (error: Error) => {
      console.error('Error finding opportunities:', error);
      toast.error(error.message || 'Failed to find opportunities');
    },
  });
}

export function useSendOpportunityEmail() {
  return useMutation({
    mutationFn: async ({ opportunity, sendImmediately }: SendEmailRequest) => {
      // Get the company to find a contact email
      const { data: company } = await apiClient.supabase
        .from('companies')
        .select('*, contacts(email)')
        .eq('id', opportunity.companyId)
        .single();

      if (!company) {
        throw new Error('Company not found');
      }

      const recipientEmail = company.contacts?.[0]?.email || company.general_email;
      
      if (!recipientEmail) {
        // Return a special error that indicates missing email but not a complete failure
        return { 
          success: false, 
          missingEmail: true,
          companyName: opportunity.companyName 
        };
      }

      // Send email via CRM email function
      const { data, error } = await apiClient.callFunction('send-crm-email', {
        to: recipientEmail,
        subject: opportunity.emailSubject,
        body: opportunity.emailBody,
        companyId: opportunity.companyId,
        sendImmediately,
      });

      if (error) throw error;
      return { success: true, data };
    },
    onError: (error: Error) => {
      console.error('Error sending email:', error);
      toast.error(error.message || 'Failed to send email');
    },
  });
}

export function useCreateDealFromOpportunity() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (opportunity: Opportunity) => {
      // Get current user
      const { data: { user } } = await apiClient.supabase.auth.getUser();
      
      if (!user) {
        throw new Error('You must be logged in to create deals');
      }

      // Map estimated value to amount
      const amountMap = {
        low: 5000,
        medium: 25000,
        high: 100000,
      };

      const { data, error } = await apiClient.supabase
        .from('deals')
        .insert([{
          user_id: user.id,
          title: opportunity.title,
          company_id: opportunity.companyId,
          stage: 'NEW',
          amount: amountMap[opportunity.estimatedValue],
          priority: opportunity.urgency,
          notes: opportunity.description,
          tags: ['AI Generated', 'New Opportunity'],
        }])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deals'] });
      queryClient.invalidateQueries({ queryKey: ['pipeline-stats'] });
    },
    onError: (error: Error) => {
      console.error('Error creating deal:', error);
      toast.error(error.message || 'Failed to create deal');
    },
  });
}