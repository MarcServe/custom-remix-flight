import { apiClient } from '../api/client';

export interface NangoConnection {
  id: string;
  provider: 'gmail' | 'outlook' | 'smtp' | 'verified_email';
  connection_id: string;
  status: 'active' | 'error' | 'disconnected' | 'pending';
  metadata?: {
    email?: string;
    scopes?: string[];
    verification_code?: string;
  };
  last_sync_at?: string;
  from_email?: string;
  verified_at?: string;
}

/**
 * Nango integration utilities for OAuth and SMTP connections
 */
export const nangoClient = {
  /**
   * Initialize OAuth flow for Gmail or Outlook using manual popup
   */
  async initiateOAuth(provider: 'gmail' | 'outlook'): Promise<{ data: any; error: Error | null }> {
    try {
      // Get session token and connect link from our edge function
      const { data: sessionData, error: sessionError } = await apiClient.callFunction('nango-oauth-init', {
        provider,
      });

      if (sessionError) throw sessionError;
      if (!sessionData?.sessionToken || !sessionData?.connectLink) {
        throw new Error('No session token or connect link received');
      }

      console.log('Opening OAuth popup for', provider);

      // Manually open popup window with proper dimensions
      const popupWidth = 500;
      const popupHeight = 600;
      const left = window.screen.width / 2 - popupWidth / 2;
      const top = window.screen.height / 2 - popupHeight / 2;
      
      const popup = window.open(
        sessionData.connectLink,
        'nango-oauth',
        `width=${popupWidth},height=${popupHeight},left=${left},top=${top},toolbar=no,menubar=no,scrollbars=yes,resizable=yes`
      );

      // Check if popup was blocked
      if (!popup || popup.closed || typeof popup.closed === 'undefined') {
        throw new Error('Popup blocked. Please allow popups for this site and try again.');
      }

      // Poll for connection completion
      return new Promise((resolve, reject) => {
        let checkCount = 0;
        const maxChecks = 300; // 5 minutes (300 seconds)
        
        const checkInterval = setInterval(async () => {
          checkCount++;

          // Check if popup was closed by user
          if (popup.closed) {
            clearInterval(checkInterval);
            console.log('Popup closed, checking for connection...');
            
            // Give webhook a moment to process
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // Poll for new connection in database
            const { user } = await apiClient.getCurrentUser();
            if (!user) {
              reject(new Error('User not authenticated'));
              return;
            }

            const { data: connections, error: fetchError } = await apiClient.supabase
              .from('crm_connections')
              .select('*')
              .eq('user_id', user.id)
              .eq('provider', provider)
              .eq('status', 'active')
              .order('created_at', { ascending: false })
              .limit(1);
            
            if (fetchError) {
              console.error('Error fetching connections:', fetchError);
              reject(new Error('Failed to verify connection. Please try again.'));
              return;
            }

            if (connections && connections.length > 0) {
              console.log('Connection found:', connections[0]);
              resolve({ 
                data: { 
                  success: true,
                  connection: connections[0]
                }, 
                error: null 
              });
            } else {
              console.log('No connection found after popup closed');
              reject(new Error('Connection not completed. Please try again.'));
            }
            return;
          }

          // Timeout after 5 minutes
          if (checkCount >= maxChecks) {
            clearInterval(checkInterval);
            if (!popup.closed) popup.close();
            reject(new Error('Connection timeout. Please try again.'));
          }
        }, 1000); // Check every second
      });
    } catch (error) {
      console.error('OAuth error:', error);
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

  /**
   * Send email verification
   */
  async sendVerificationEmail(email: string) {
    const { data, error } = await apiClient.callFunction('send-verification-email', { email });
    return { data, error };
  },

  /**
   * Verify email with code
   */
  async verifyEmail(code: string, connectionId: string) {
    const { data, error } = await apiClient.callFunction('verify-email', { 
      code, 
      connectionId 
    });
    return { data, error };
  },

  /**
   * Resend verification email
   */
  async resendVerification(email: string) {
    return this.sendVerificationEmail(email);
  },
};
