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
    linkedin?: string;
    twitter?: string;
    facebook?: string;
    instagram?: string;
    youtube?: string;
    tiktok?: string;
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
  // Match intelligence fields
  matchReason?: string;
  matchSignals?: string[];
  // SerpAPI-specific fields
  source?: 'exa' | 'serpapi' | 'google_maps' | 'apify';
  googleRating?: number;
  googleReviewCount?: number;
  address?: string;
  googleMapsUrl?: string;
  placeId?: string;
  businessHours?: string;
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
  useSerpApi?: boolean;
  useApify?: boolean;
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
  sources?: {
    exa: number;
    serpapi: number;
    googleMaps: number;
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
