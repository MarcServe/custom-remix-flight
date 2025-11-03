import { apiClient } from '@/lib/api/client';

export interface GmailDirectConnection {
  id: string;
  connection_id: string;
  from_email: string | null;
  status: string;
  created_at: string;
  provider: string;
  metadata?: {
    access_token?: string;
    refresh_token?: string;
    expires_at?: string;
  };
}

export const gmailDirectClient = {
  /**
   * Initiate Gmail OAuth flow
   */
  async initiateOAuth(): Promise<{ authUrl: string | null; error: Error | null }> {
    try {
      console.log('Initiating Gmail Direct OAuth...');
      
      const { data, error } = await apiClient.callFunction('gmail-oauth-init', {});

      if (error) {
        console.error('Error initiating OAuth:', error);
        throw error;
      }

      if (!data?.authUrl) {
        throw new Error('No auth URL returned');
      }

      return { authUrl: data.authUrl, error: null };
    } catch (error) {
      console.error('Exception in initiateOAuth:', error);
      return { 
        authUrl: null, 
        error: error instanceof Error ? error : new Error('Unknown error') 
      };
    }
  },

  /**
   * Get all Gmail Direct connections for the current user
   */
  async getConnections(): Promise<GmailDirectConnection[]> {
    try {
      const { data, error } = await apiClient.supabase
        .from('crm_connections')
        .select('*')
        .eq('provider', 'gmail_direct')
        .eq('status', 'active');

      if (error) {
        console.error('Error fetching connections:', error);
        throw error;
      }

      return (data || []) as GmailDirectConnection[];
    } catch (error) {
      console.error('Exception in getConnections:', error);
      return [];
    }
  },

  /**
   * Disconnect a Gmail Direct connection
   */
  async disconnect(connectionId: string): Promise<{ error: Error | null }> {
    try {
      const { error } = await apiClient.supabase
        .from('crm_connections')
        .update({ status: 'disconnected' })
        .eq('id', connectionId)
        .eq('provider', 'gmail_direct');

      if (error) {
        console.error('Error disconnecting:', error);
        throw error;
      }

      return { error: null };
    } catch (error) {
      console.error('Exception in disconnect:', error);
      return { 
        error: error instanceof Error ? error : new Error('Unknown error') 
      };
    }
  },

  /**
   * Connect using redirect flow (recommended for all browsers)
   */
  async connectWithRedirect(): Promise<{ error: Error | null }> {
    try {
      const { authUrl, error: authError } = await this.initiateOAuth();

      if (authError || !authUrl) {
        throw authError || new Error('Failed to get auth URL');
      }

      // Store the current page URL to return to after OAuth
      const returnUrl = window.location.pathname + window.location.search;
      localStorage.setItem('gmail_oauth_return_url', returnUrl);
      localStorage.setItem('gmail_oauth_in_progress', 'true');

      // Redirect to OAuth URL
      window.location.href = authUrl;

      return { error: null };
    } catch (error) {
      console.error('Exception in connectWithRedirect:', error);
      return { 
        error: error instanceof Error ? error : new Error('Unknown error') 
      };
    }
  },

  /**
   * Check if we just returned from OAuth redirect
   */
  isOAuthCallback(): boolean {
    return localStorage.getItem('gmail_oauth_in_progress') === 'true';
  },

  /**
   * Complete OAuth after redirect
   */
  async completeOAuthRedirect(): Promise<{ success: boolean; returnUrl: string | null }> {
    const inProgress = localStorage.getItem('gmail_oauth_in_progress');
    const returnUrl = localStorage.getItem('gmail_oauth_return_url');

    // Clean up
    localStorage.removeItem('gmail_oauth_in_progress');
    localStorage.removeItem('gmail_oauth_return_url');

    if (inProgress === 'true') {
      // Give the database a moment to update
      await new Promise(resolve => setTimeout(resolve, 1000));
      return { success: true, returnUrl };
    }

    return { success: false, returnUrl: null };
  },
};
