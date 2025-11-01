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
   * Initialize OAuth flow for Gmail or Outlook using redirect flow
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

      // Store provider in localStorage so we know what to do after callback
      localStorage.setItem('nango_connecting_provider', provider);
      localStorage.setItem('nango_redirect_url', window.location.pathname);

      // Dynamically import Nango frontend SDK
      const { default: Nango } = await import('@nangohq/frontend');
      
      const nango = new Nango({ 
        connectSessionToken: sessionData.sessionToken
      });

      // Map provider to Nango integration ID
      const integrationId = provider === 'gmail' ? 'google-mail' : 'outlook';

      // Initiate redirect flow - this will redirect the user to Google/Microsoft
      await nango.auth(integrationId, {
        user_scope: ['email'],
      });

      return { data: { success: true }, error: null };
    } catch (error) {
      return {
        data: null,
        error: error instanceof Error ? error : new Error('OAuth initialization failed'),
      };
    }
  },

  /**
   * Handle OAuth callback after redirect
   */
  async handleOAuthCallback(): Promise<{ success: boolean; provider?: string; error?: string }> {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      
      // Check if this is an OAuth callback
      if (!urlParams.has('state') || !urlParams.has('code')) {
        return { success: false };
      }

      const provider = localStorage.getItem('nango_connecting_provider') as 'gmail' | 'outlook';
      const redirectUrl = localStorage.getItem('nango_redirect_url');
      
      if (!provider) {
        return { success: false, error: 'No provider found in storage' };
      }

      // Get a new session token
      const { data: sessionData, error: sessionError } = await apiClient.callFunction('nango-oauth-init', {
        provider,
      });

      if (sessionError || !sessionData?.sessionToken) {
        throw new Error('Failed to get session token');
      }

      // Initialize Nango with session token
      const { default: Nango } = await import('@nangohq/frontend');
      const nango = new Nango({ 
        connectSessionToken: sessionData.sessionToken
      });

      // Map provider to Nango integration ID
      const integrationId = provider === 'gmail' ? 'google-mail' : 'outlook';

      // Complete the OAuth flow
      await nango.auth(integrationId, {
        user_scope: ['email'],
      });

      // Clean up localStorage
      localStorage.removeItem('nango_connecting_provider');
      localStorage.removeItem('nango_redirect_url');

      // Remove OAuth params from URL
      const cleanUrl = redirectUrl || window.location.pathname;
      window.history.replaceState({}, document.title, cleanUrl);

      return { success: true, provider };
    } catch (error) {
      // Clean up localStorage on error
      localStorage.removeItem('nango_connecting_provider');
      localStorage.removeItem('nango_redirect_url');
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'OAuth callback failed',
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
