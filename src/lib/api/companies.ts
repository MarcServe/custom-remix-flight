import { apiClient } from './client';

export interface Company {
  id: string;
  name: string;
  website?: string;
  description?: string;
  industry?: string;
  size?: string;
  geography?: string;
  status?: string;
  linkedin_url?: string;
  enrichment_provider?: string;
  enrichment_model?: string;
  langfuse_trace_id?: string;
  enriched_at?: string;
  created_at?: string;
  updated_at?: string;
}

export interface CompanyFilters {
  status?: string;
  industry?: string;
  size?: string;
  geography?: string;
}

/**
 * Company API methods
 */
export const companiesApi = {
  /**
   * Get all companies with optional filters
   */
  async getCompanies(filters?: CompanyFilters) {
    let query = apiClient.supabase.from('companies').select('*');

    if (filters?.status) {
      query = query.eq('status', filters.status);
    }
    if (filters?.industry) {
      query = query.eq('industry', filters.industry);
    }
    if (filters?.size) {
      query = query.eq('size', filters.size);
    }
    if (filters?.geography) {
      query = query.eq('geography', filters.geography);
    }

    query = query.order('created_at', { ascending: false });

    const { data, error } = await query;
    return { data: data as Company[] | null, error };
  },

  /**
   * Get a single company by ID
   */
  async getCompany(id: string) {
    const { data, error } = await apiClient.supabase
      .from('companies')
      .select('*, people(*), deals(*), events(*)')
      .eq('id', id)
      .single();

    return { data, error };
  },

  /**
   * Create a new company
   */
  async createCompany(company: Partial<Company>) {
    const { data, error } = await apiClient.supabase
      .from('companies')
      .insert([company as any])
      .select()
      .single();

    return { data, error };
  },

  /**
   * Update a company
   */
  async updateCompany(id: string, updates: Partial<Company>) {
    const { data, error } = await apiClient.supabase
      .from('companies')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    return { data, error };
  },

  /**
   * Delete a company
   */
  async deleteCompany(id: string) {
    const { error } = await apiClient.supabase
      .from('companies')
      .delete()
      .eq('id', id);

    return { error };
  },

  /**
   * Search companies using full-text search
   */
  async searchCompanies(query: string) {
    const { data, error } = await apiClient.supabase.rpc('search_companies', {
      search_query: query,
    });

    return { data, error };
  },
};
