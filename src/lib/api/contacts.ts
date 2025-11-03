import { apiClient } from './client';

export interface Contact {
  id: string;
  company_id: string;
  name: string;
  email?: string;
  phone?: string;
  title?: string;
  department?: string;
  linkedin_url?: string;
  is_primary_contact?: boolean;
  email_verified?: boolean;
  created_at?: string;
  updated_at?: string;
}

export const contactsApi = {
  async createContact(contact: Omit<Contact, 'id' | 'created_at' | 'updated_at'>) {
    const { data, error } = await apiClient.supabase
      .from('contacts')
      .insert(contact)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async getContactsByCompany(companyId: string) {
    const { data, error } = await apiClient.supabase
      .from('contacts')
      .select('*')
      .eq('company_id', companyId);

    if (error) throw error;
    return data;
  },

  async updateContact(id: string, updates: Partial<Contact>) {
    const { data, error } = await apiClient.supabase
      .from('contacts')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async deleteContact(id: string) {
    const { error } = await apiClient.supabase
      .from('contacts')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }
};
