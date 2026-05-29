import { apiClient } from './client';

export interface SequenceRequest {
  size: string;
  geography: string;
  industry: string;
  steps?: number;
  tone?: 'professional' | 'casual' | 'technical';
  provider?: 'openai' | 'perplexity';
  model?: string;
  customInstructions?: string;
  autoRespond?: boolean;
  /** When true (default), sequence emails use the same email branding template as campaigns for consistent look. */
  use_email_branding?: boolean;
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
      .maybeSingle();

    return { data, error };
  },

  /**
   * Update a sequence
   */
  async updateSequence(id: string, updates: { 
    name?: string; 
    steps?: Array<{
      subject: string;
      body: string;
      delayDays?: number;
      automation_rule?: {
        type: 'wait_for_open' | 'wait_for_click' | 'time_based' | 'none';
        wait_hours?: number;
      };
    }>;
    segment_filters?: any;
    custom_instructions?: string;
    use_email_branding?: boolean;
    repeat_sequence?: boolean;
    repeat_after_days?: number;
    repeat_only_for?: string;
    description?: string | null;
  }) {
    // Serialize steps to JSON string array format expected by database
    const dbUpdates: any = { ...updates };
    if (updates.steps) {
      dbUpdates.steps = updates.steps.map(step => JSON.stringify(step));
    }
    // Remove undefined values so Supabase doesn't receive them
    Object.keys(dbUpdates).forEach((key) => {
      if (dbUpdates[key] === undefined) delete dbUpdates[key];
    });
    if (dbUpdates.segment_filters && typeof dbUpdates.segment_filters === 'object') {
      const seg = dbUpdates.segment_filters as Record<string, unknown>;
      dbUpdates.segment_filters = Object.fromEntries(
        Object.entries(seg).filter(([, v]) => v !== undefined && v !== '')
      );
    }

    const { data, error } = await apiClient.supabase
      .from('email_sequences')
      .update(dbUpdates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(error.message || 'Failed to update sequence');
    }
    return { data, error: null };
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
