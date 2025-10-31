import { apiClient } from '../api/client';

export interface NangoConnection {
  provider: 'gmail' | 'outlook' | 'smtp';
  connection_id: string;
  status: 'active' | 'error' | 'disconnected';
  metadata?: {
    email?: string;
    scopes?: string[];
  };
  last_sync_at?: string;
}

/**
 * Nango integration utilities for OAuth and SMTP connections
 */
export const nangoClient = {
  /**
   * Initialize OAuth flow for Gmail or Outlook
   */
  async initiateOAuth(provider: 'gmail' | 'outlook') {
    try {
      const { data, error } = await apiClient.callFunction('nango-oauth-init', {
        provider,
      });

      if (error) throw error;

      // Redirect to Nango OAuth URL
      if (data?.authUrl) {
        window.location.href = data.authUrl;
      }

      return { data, error: null };
    } catch (error) {
      return {
        data: null,
        error: error instanceof Error ? error : new Error('OAuth initialization failed'),
      };
    }
  },

  /**
   * Save SMTP configuration
   */
  async configureSMTP(config: {
    host: string;
    port: number;
    username: string;
    password: string;
    secure: boolean;
  }) {
    const { user } = await apiClient.getCurrentUser();
    if (!user) throw new Error('User not authenticated');

    const { data, error } = await apiClient.supabase
      .from('crm_connections')
      .insert({
        user_id: user.id,
        provider: 'smtp',
        connection_id: `smtp_${Date.now()}`,
        status: 'active',
        metadata: config,
      })
      .select()
      .maybeSingle();

    return { data, error };
  },

  /**
   * Get all user connections
   */
  async getConnections() {
    const { user } = await apiClient.getCurrentUser();
    if (!user) return { data: [], error: null };

    const { data, error } = await apiClient.supabase
      .from('crm_connections')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    return { data: (data || []) as NangoConnection[], error };
  },

  /**
   * Disconnect a provider
   */
  async disconnect(connectionId: string) {
    const { error } = await apiClient.supabase
      .from('crm_connections')
      .update({ status: 'disconnected' })
      .eq('id', connectionId);

    return { error };
  },

  /**
   * Test SMTP connection
   */
  async testSMTPConnection(config: {
    host: string;
    port: number;
    username: string;
    password: string;
    secure: boolean;
  }) {
    const { data, error } = await apiClient.callFunction('test-smtp', config);
    return { data, error };
  },
};
