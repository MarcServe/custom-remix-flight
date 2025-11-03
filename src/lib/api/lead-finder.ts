import { apiClient } from './client';

export interface Contact {
  name: string;
  email?: string;
  emailVerified?: boolean;
  linkedinUrl?: string;
  title?: string;
  department?: string;
  phone?: string;
  companyName: string;
}

export interface Lead {
  name: string;
  website?: string;
  description?: string;
  industry?: string;
  size?: string;
  geography?: string;
  linkedinUrl?: string;
  wasEnriched?: boolean;
  products?: string;
  recentNews?: string;
  fundingInfo?: string;
  employeeCount?: number;
  companyPhone?: string;
  generalEmail?: string;
  socialProfiles?: {
    twitter?: string;
    facebook?: string;
    instagram?: string;
    youtube?: string;
  };
  keyExecutives?: Array<{
    name: string;
    title: string;
  }>;
  contacts?: Contact[];
  primaryContact?: Contact;
  qualityScore?: number;
  dataCompleteness?: number;
  enrichmentTier?: 'basic' | 'deep';
  contactCount?: number;
}

export interface LeadFinderRequest {
  size: string;
  geography: string;
  industry: string;
  customSearchText?: string;
  dryRun?: boolean;
  provider?: 'lovable' | 'openai' | 'perplexity';
  model?: string;
  enrichWithPerplexity?: boolean;
}

export interface LeadFinderResponse {
  leads: Lead[];
  inserted: number;
  dryRun: boolean;
  provider: string;
  model: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    estimatedCost: number;
  };
  enrichmentUsage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    estimatedCost: number;
  };
  wasEnriched?: boolean;
  traceUrl: string;
  stats?: {
    totalFound: number;
    returned: number;
    filtered: number;
    withContacts: number;
    withLinkedIn: number;
    highQuality: number;
    averageScore: number;
  };
}

/**
 * Lead Finder API methods
 */
export const leadFinderApi = {
  /**
   * Find leads using AI
   */
  async findLeads(request: LeadFinderRequest) {
    return apiClient.callFunction<LeadFinderResponse>('lead-finder', request);
  },
};
