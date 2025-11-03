import { apiClient } from './client';

export interface Deal {
  id: string;
  title: string;
  stage?: string;
  amount?: number;
  close_date?: string;
  company_id?: string;
  created_at?: string;
  updated_at?: string;
  companies?: {
    name: string;
  };
}

/**
 * Deal API methods
 */
export const dealsApi = {
  /**
   * Get all deals
   */
  async getDeals() {
    const { data, error } = await apiClient.supabase
      .from('deals')
      .select('*, companies(name)')
      .order('created_at', { ascending: false });

    return { data: data as Deal[] | null, error };
  },

  /**
   * Update deal stage
   */
  async updateDealStage(id: string, stage: string) {
    const { data, error } = await apiClient.supabase
      .from('deals')
      .update({ stage, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .maybeSingle();

    return { data, error };
  },

  /**
   * Get a single deal by ID
   */
  async getDeal(id: string) {
    const { data, error } = await apiClient.supabase
      .from('deals')
      .select('*, companies(name)')
      .eq('id', id)
      .maybeSingle();

    return { data, error };
  },

  /**
   * Create a new deal
   */
  async createDeal(deal: Partial<Deal>) {
    const { data, error } = await apiClient.supabase
      .from('deals')
      .insert(deal)
      .select()
      .maybeSingle();

    return { data, error };
  },
};
