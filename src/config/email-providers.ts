/**
 * Email Provider Configuration
 * Toggle different email provider implementations on/off
 */

export const EMAIL_PROVIDER_CONFIG = {
  // Enable/disable Nango-based integrations (Gmail, Outlook via Nango)
  nango_enabled: true,
  
  // Enable/disable Direct Gmail OAuth (standalone implementation)
  gmail_direct_enabled: true,
  
  // Default Gmail provider to show/use: 'nango' or 'direct'
  default_gmail: 'direct' as 'nango' | 'direct',
  
  // Show both options in UI (if false, only show default)
  show_both_gmail_options: false,
} as const;

export type EmailProviderConfig = typeof EMAIL_PROVIDER_CONFIG;
