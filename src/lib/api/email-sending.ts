import { apiClient } from './client';
import { supabase } from '@/integrations/supabase/client';

export interface SendEmailRequest {
  to: string;
  subject: string;
  body: string;
  companySequenceId?: string;
  contactId?: string;
  sender_profile_id?: string | null;
}

export interface BulkEmailRequest {
  recipients: Array<{
    email: string;
    name: string;
    personId?: string;
  }>;
  subject: string;
  body: string;
}

export interface ProviderCapabilities {
  provider: string;
  tracking_enabled: boolean;
  sending_method: string;
  capabilities: {
    opens?: boolean;
    clicks?: boolean;
    replies?: boolean;
    bounces?: boolean;
    webhooks?: boolean;
  };
  from_email?: string;
  status: string;
}

/**
 * Email Sending API methods with automatic provider selection
 */
export const emailSendingApi = {
  /**
   * Get available email providers and their capabilities
   */
  async getProviders(): Promise<{ data: ProviderCapabilities[] | null; error: Error | null }> {
    try {
      const { data, error } = await supabase
        .from('crm_connections')
        .select('provider, tracking_enabled, sending_method, capabilities, from_email, status')
        .eq('status', 'active')
        .order('tracking_enabled', { ascending: false });

      if (error) throw error;
      return { data: data as ProviderCapabilities[], error: null };
    } catch (error) {
      return {
        data: null,
        error: error instanceof Error ? error : new Error('Failed to fetch providers'),
      };
    }
  },

  /**
   * Check if user has any configured email providers
   */
  async hasConfiguredProviders(): Promise<boolean> {
    const { data } = await emailSendingApi.getProviders();
    return (data?.length || 0) > 0;
  },

  /**
   * Get the optimal provider based on tracking capabilities
   */
  async getOptimalProvider(): Promise<{ data: ProviderCapabilities | null; error: Error | null }> {
    const { data: providers, error } = await emailSendingApi.getProviders();
    
    if (error) return { data: null, error };
    if (!providers || providers.length === 0) {
      return {
        data: null,
        error: new Error('No email providers configured. Please configure an email provider in Settings.'),
      };
    }

    // Priority: Providers with tracking > Resend/SendGrid > Gmail/Outlook > Others
    const optimal = 
      providers.find(p => p.tracking_enabled && ['resend', 'sendgrid'].includes(p.provider)) ||
      providers.find(p => p.tracking_enabled && ['gmail', 'gmail_direct', 'outlook'].includes(p.provider)) ||
      providers.find(p => p.tracking_enabled) ||
      providers[0];

    return { data: optimal, error: null };
  },

  /**
   * Validate provider configuration before sending
   */
  async validateProviderSetup(): Promise<{
    valid: boolean;
    provider?: ProviderCapabilities;
    warnings: string[];
    errors: string[];
  }> {
    const warnings: string[] = [];
    const errors: string[] = [];

    const { data: provider, error } = await emailSendingApi.getOptimalProvider();

    if (error || !provider) {
      errors.push('No email provider configured');
      errors.push('Please go to Settings > Email Providers to configure an email provider');
      return { valid: false, warnings, errors };
    }

    // Check for tracking capabilities
    if (!provider.tracking_enabled) {
      warnings.push(`Provider ${provider.provider} does not support email tracking`);
      warnings.push('Opens, clicks, and replies cannot be tracked');
      warnings.push('Consider configuring Gmail, Resend, or SendGrid for better tracking');
    }

    // Check for specific capability gaps
    const caps = provider.capabilities;
    if (caps && !caps.opens) {
      warnings.push('Open tracking not available with current provider');
    }
    if (caps && !caps.clicks) {
      warnings.push('Click tracking not available with current provider');
    }
    if (caps && !caps.webhooks) {
      warnings.push('Webhook support not available - some automations may not work');
    }

    return {
      valid: true,
      provider,
      warnings,
      errors,
    };
  },

  /**
   * Send a single email using optimal provider
   */
  async sendEmail(request: SendEmailRequest) {
    const validation = await emailSendingApi.validateProviderSetup();
    
    if (!validation.valid) {
      return {
        data: null,
        error: new Error(validation.errors.join('. ')),
        warnings: validation.warnings,
      };
    }

    // Transform client request to edge function format
    const edgeFunctionRequest = {
      toEmail: request.to,
      toName: request.to.split('@')[0], // Use email prefix as fallback name
      subject: request.subject,
      body: request.body,
      companyId: request.companySequenceId, // Edge function uses companyId
      contactId: request.contactId,
      sender_profile_id: request.sender_profile_id ?? undefined,
    };

    const result = await apiClient.callFunction('send-crm-email', edgeFunctionRequest);
    
    return {
      ...result,
      warnings: validation.warnings,
      provider: validation.provider,
    };
  },

  /**
   * Send bulk emails using optimal provider
   */
  async sendBulkEmails(request: BulkEmailRequest) {
    const validation = await emailSendingApi.validateProviderSetup();
    
    if (!validation.valid) {
      return {
        data: null,
        error: new Error(validation.errors.join('. ')),
        warnings: validation.warnings,
      };
    }

    const result = await apiClient.callFunction('send-bulk-emails', request);
    
    return {
      ...result,
      warnings: validation.warnings,
      provider: validation.provider,
    };
  },

  /**
   * Send sequence email with automatic provider selection
   */
  async sendSequenceEmail(companySequenceId: string, stepNumber: number) {
    const validation = await emailSendingApi.validateProviderSetup();
    
    if (!validation.valid) {
      return {
        data: null,
        error: new Error(validation.errors.join('. ')),
        warnings: validation.warnings,
      };
    }

    const result = await apiClient.callFunction('send-sequence-email', {
      companySequenceId,
      stepNumber,
    });
    
    return {
      ...result,
      warnings: validation.warnings,
      provider: validation.provider,
    };
  },

  /**
   * Send all sequence emails with automatic provider selection
   */
  async sendSequenceEmails(companySequenceId: string, startFromStep = 0) {
    const validation = await emailSendingApi.validateProviderSetup();
    
    if (!validation.valid) {
      return {
        data: null,
        error: new Error(validation.errors.join('. ')),
        warnings: validation.warnings,
      };
    }

    const result = await apiClient.callFunction('send-sequence-emails', {
      companySequenceId,
      startFromStep,
    });
    
    return {
      ...result,
      warnings: validation.warnings,
      provider: validation.provider,
    };
  },
};
