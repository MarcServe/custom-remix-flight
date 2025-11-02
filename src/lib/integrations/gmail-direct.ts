import { supabase } from '@/integrations/supabase/client';

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
      
      const { data, error } = await supabase.functions.invoke('gmail-oauth-init', {
        body: {},
      });

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
      const { data, error } = await supabase
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
      const { error } = await supabase
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
   * Open OAuth popup and wait for connection
   */
  async connectWithPopup(): Promise<{ success: boolean; error: Error | null }> {
    try {
      const { authUrl, error: authError } = await this.initiateOAuth();

      if (authError || !authUrl) {
        throw authError || new Error('Failed to get auth URL');
      }

      // Open popup
      const width = 600;
      const height = 700;
      const left = window.screen.width / 2 - width / 2;
      const top = window.screen.height / 2 - height / 2;

      const popup = window.open(
        authUrl,
        'Gmail OAuth',
        `width=${width},height=${height},left=${left},top=${top}`
      );

      if (!popup) {
        throw new Error('Failed to open popup. Please allow popups for this site.');
      }

      // Wait for popup to close
      return new Promise((resolve) => {
        const checkInterval = setInterval(() => {
          if (popup.closed) {
            clearInterval(checkInterval);
            // Give a moment for the database to update
            setTimeout(() => {
              resolve({ success: true, error: null });
            }, 1000);
          }
        }, 500);

        // Timeout after 5 minutes
        setTimeout(() => {
          clearInterval(checkInterval);
          if (!popup.closed) {
            popup.close();
          }
          resolve({ 
            success: false, 
            error: new Error('OAuth timeout') 
          });
        }, 300000);
      });
    } catch (error) {
      console.error('Exception in connectWithPopup:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error : new Error('Unknown error') 
      };
    }
  },
};
