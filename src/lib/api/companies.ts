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
  company_phone?: string;
  general_email?: string;
  social_profiles?: {
    twitter?: string;
    facebook?: string;
    instagram?: string;
    youtube?: string;
    linkedin?: string;
  };
  key_executives?: Array<{
    name: string;
    title: string;
  }>;
  headquarters?: string;
  employee_count?: number;
  founded_year?: number;
  funding_stage?: string;
  funding_total?: string;
  tech_stack?: string[];
  recent_news?: string;
  ceo_name?: string;
  enrichment_data?: any;
  enrichment_status?: string;
  enrichment_confidence?: string;
  enrichment_error?: string;
  // Relations
  people?: any[];
  contacts?: any[];
  deals?: any[];
  events?: any[];
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
      .select('*, people(*), contacts(*), deals(*), events(*)')
      .eq('id', id)
      .maybeSingle();

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
      .maybeSingle();

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
      .maybeSingle();

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
