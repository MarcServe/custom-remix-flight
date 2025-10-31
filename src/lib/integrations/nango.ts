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
   * Initialize OAuth flow for Gmail or Outlook in popup window
   */
  async initiateOAuth(provider: 'gmail' | 'outlook'): Promise<{ data: any; error: Error | null }> {
    try {
      const { data, error } = await apiClient.callFunction('nango-oauth-init', {
        provider,
      });

      if (error) throw error;

      // Open OAuth in popup window
      if (data?.authUrl) {
        const width = 600;
        const height = 700;
        const left = (window.screen.width - width) / 2;
        const top = (window.screen.height - height) / 2;

        const popup = window.open(
          data.authUrl,
          'oauth',
          `width=${width},height=${height},left=${left},top=${top},popup=yes`
        );

        if (!popup) {
          return {
            data: null,
            error: new Error('Popup blocked. Please allow popups and try again.'),
          };
        }

        // Return a promise that resolves when OAuth completes
        return new Promise((resolve) => {
          const messageHandler = (event: MessageEvent) => {
            if (event.data.type === 'oauth-success') {
              window.removeEventListener('message', messageHandler);
              resolve({ data: { success: true }, error: null });
            } else if (event.data.type === 'oauth-error') {
              window.removeEventListener('message', messageHandler);
              resolve({ 
                data: null, 
                error: new Error(event.data.error || 'OAuth failed') 
              });
            }
          };

          window.addEventListener('message', messageHandler);

          // Check if popup was closed without completing
          const checkClosed = setInterval(() => {
            if (popup.closed) {
              clearInterval(checkClosed);
              window.removeEventListener('message', messageHandler);
              resolve({ 
                data: null, 
                error: new Error('OAuth window closed') 
              });
            }
          }, 500);
        });
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
