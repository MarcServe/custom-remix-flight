import { apiClient } from '../api/client';

export interface NangoConnection {
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
   * Initialize OAuth flow for Gmail or Outlook using Nango Connect UI
   */
  async initiateOAuth(provider: 'gmail' | 'outlook'): Promise<{ data: any; error: Error | null }> {
    try {
      // Get session token from our edge function
      const { data: sessionData, error: sessionError } = await apiClient.callFunction('nango-oauth-init', {
        provider,
      });

      if (sessionError) throw sessionError;
      if (!sessionData?.sessionToken) {
        throw new Error('No session token received');
      }

      // Dynamically import Nango frontend SDK
      const { default: Nango } = await import('@nangohq/frontend');
      
      const nango = new Nango({ 
        connectSessionToken: sessionData.sessionToken
      });

      // Open Nango Connect UI and wait for completion
      return new Promise((resolve) => {
        nango.openConnectUI({
          onEvent: (event: any) => {
            if (event.type === 'close') {
              resolve({
                data: null,
                error: new Error('Authentication window was closed'),
              });
            } else if (event.type === 'connect') {
              resolve({ 
                data: { 
                  success: true,
                  connectionId: event.payload?.connectionId 
                }, 
                error: null 
              });
            }
          },
        });
      });
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
