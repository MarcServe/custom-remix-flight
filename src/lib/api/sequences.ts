import { apiClient } from './client';

export interface SequenceRequest {
  size: string;
  geography: string;
  industry: string;
  steps?: number;
  tone?: 'professional' | 'casual' | 'technical';
  provider?: 'lovable' | 'openai';
  model?: string;
}

export interface SequenceResponse {
  sequence: Array<{
    subject: string;
    body: string;
    delayDays: number;
  }>;
  sequenceId: string;
  name: string;
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
 * Email Sequences API methods
 */
export const sequencesApi = {
  /**
   * Generate an email sequence using AI
   */
  async generateSequence(request: SequenceRequest) {
    return apiClient.callFunction<SequenceResponse>('generate-sequence', request);
  },

  /**
   * Get all sequences
   */
  async getSequences() {
    const { data, error } = await apiClient.supabase
      .from('email_sequences')
      .select('*')
      .order('created_at', { ascending: false });

    return { data, error };
  },

  /**
   * Get a single sequence
   */
  async getSequence(id: string) {
    const { data, error } = await apiClient.supabase
      .from('email_sequences')
      .select('*')
      .eq('id', id)
      .single();

    return { data, error };
  },

  /**
   * Delete a sequence
   */
  async deleteSequence(id: string) {
    const { error } = await apiClient.supabase
      .from('email_sequences')
      .delete()
      .eq('id', id);

    return { error };
  },
};
