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

export interface LeadFinderRequest {
  size: string;
  geography: string;
  industry: string;
  dryRun?: boolean;
  provider?: 'lovable' | 'openai' | 'perplexity';
  model?: string;
  enrichWithPerplexity?: boolean;
}

export interface LeadFinderResponse {
  leads: Array<{
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
    contacts?: Contact[];
    primaryContact?: Contact;
  }>;
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
