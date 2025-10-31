import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { companiesApi, CompanyFilters, Company } from '@/lib/api/companies';
import { useToast } from '@/hooks/use-toast';

/**
 * Hook to fetch companies with filters
 */
export const useCompanies = (filters?: CompanyFilters) => {
  return useQuery({
    queryKey: ['companies', filters],
    queryFn: () => companiesApi.getCompanies(filters),
  });
};

/**
 * Hook to fetch a single company
 */
export const useCompany = (id: string) => {
  return useQuery({
    queryKey: ['company', id],
    queryFn: () => companiesApi.getCompany(id),
    enabled: !!id,
  });
};

/**
 * Hook to create a company
 */
export const useCreateCompany = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (company: Partial<Company>) => companiesApi.createCompany(company),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['companies'] });
      toast({
        title: 'Success',
        description: 'Company created successfully',
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
 * Hook to update a company
 */
export const useUpdateCompany = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<Company> }) =>
      companiesApi.updateCompany(id, updates),
    onMutate: async ({ id, updates }) => {
      // Cancel outgoing queries
      await queryClient.cancelQueries({ queryKey: ['companies'] });
      await queryClient.cancelQueries({ queryKey: ['company', id] });

      // Snapshot previous value
      const previousCompanies = queryClient.getQueryData(['companies']);
      const previousCompany = queryClient.getQueryData(['company', id]);

      // Optimistically update
      queryClient.setQueryData(['companies'], (old: any) => {
        if (!old?.data) return old;
        return {
          ...old,
          data: old.data.map((c: Company) =>
            c.id === id ? { ...c, ...updates } : c
          ),
        };
      });

      return { previousCompanies, previousCompany };
    },
    onSuccess: (data, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['companies'] });
      queryClient.invalidateQueries({ queryKey: ['company', id] });
      toast({
        title: 'Success',
        description: 'Company updated successfully',
      });
    },
    onError: (error: Error, variables, context) => {
      // Rollback on error
      if (context?.previousCompanies) {
        queryClient.setQueryData(['companies'], context.previousCompanies);
      }
      if (context?.previousCompany) {
        queryClient.setQueryData(['company', variables.id], context.previousCompany);
      }
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
};

/**
 * Hook to delete a company
 */
export const useDeleteCompany = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (id: string) => companiesApi.deleteCompany(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['companies'] });
      toast({
        title: 'Success',
        description: 'Company deleted successfully',
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
 * Hook to search companies
 */
export const useSearchCompanies = (query: string) => {
  return useQuery({
    queryKey: ['companies', 'search', query],
    queryFn: () => companiesApi.searchCompanies(query),
    enabled: query.length > 2,
  });
};
