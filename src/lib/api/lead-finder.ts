import { apiClient } from './client';

export interface LeadFinderRequest {
  size: string;
  geography: string;
  industry: string;
  dryRun?: boolean;
  provider?: 'lovable' | 'openai';
  model?: string;
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
