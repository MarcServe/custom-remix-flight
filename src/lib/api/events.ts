import { apiClient } from './client';

export interface Event {
  id: string;
  type: 'note' | 'call' | 'email' | 'meeting' | 'task' | 'reminder';
  content: {
    title?: string;
    description?: string;
    [key: string]: any;
  };
  due_at?: string;
  company_id?: string;
  deal_id?: string;
  created_at: string;
}

export interface EventFilters {
  type?: string;
  company_id?: string;
  deal_id?: string;
  start_date?: string;
  end_date?: string;
}

export interface CreateEventRequest {
  type: Event['type'];
  content: Event['content'];
  due_at?: string;
  company_id?: string;
  deal_id?: string;
}

export const eventsApi = {
  async getEvents(filters?: EventFilters) {
    let query = apiClient.supabase
      .from('events')
      .select('*, companies(name), deals(title)')
      .order('created_at', { ascending: false });

    if (filters?.type) {
      query = query.eq('type', filters.type);
    }
    if (filters?.company_id) {
      query = query.eq('company_id', filters.company_id);
    }
    if (filters?.deal_id) {
      query = query.eq('deal_id', filters.deal_id);
    }
    if (filters?.start_date) {
      query = query.gte('created_at', filters.start_date);
    }
    if (filters?.end_date) {
      query = query.lte('created_at', filters.end_date);
    }

    const { data, error } = await query;
    return { data, error };
  },

  async createEvent(event: CreateEventRequest) {
    const { data, error } = await apiClient.supabase
      .from('events')
      .insert(event)
      .select()
      .single();
    return { data, error };
  },

  async updateEvent(id: string, updates: Partial<CreateEventRequest>) {
    const { data, error } = await apiClient.supabase
      .from('events')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    return { data, error };
  },

  async deleteEvent(id: string) {
    const { error } = await apiClient.supabase
      .from('events')
      .delete()
      .eq('id', id);
    return { error };
  },

  async getCompanyEvents(companyId: string) {
    const { data, error } = await apiClient.supabase
      .from('events')
      .select('*')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false });
    return { data, error };
  },

  async getDealEvents(dealId: string) {
    const { data, error } = await apiClient.supabase
      .from('events')
      .select('*')
      .eq('deal_id', dealId)
      .order('created_at', { ascending: false });
    return { data, error };
  },
};
