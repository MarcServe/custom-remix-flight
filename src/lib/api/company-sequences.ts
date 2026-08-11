import { apiClient } from './client';

export interface PersonalizeSequenceRequest {
  sequenceId: string;
  companyId: string;
  contactId?: string;
  tone?: 'professional' | 'casual' | 'technical';
}

export interface PersonalizedEmail {
  subject: string;
  body: string;
  delayDays: number;
  stepNumber: number;
}

export interface CompanySequence {
  id: string;
  sequence_id: string;
  company_id: string;
  status: 'draft' | 'active' | 'paused' | 'completed';
  current_step: number;
  personalized_emails: PersonalizedEmail[];
  metadata?: any;
  created_at: string;
  updated_at: string;
}

/**
 * Company Sequences API methods
 */
export const companySequencesApi = {
  /**
   * Personalize a sequence for a company
   */
  async personalizeSequence(request: PersonalizeSequenceRequest) {
    return apiClient.callFunction<{ companySequence: CompanySequence }>('personalize-sequence', request);
  },

  /**
   * Get all company sequences
   */
  async getCompanySequences() {
    const { data, error } = await apiClient.supabase
      .from('company_sequences')
      .select(`
        *,
        sequence:email_sequences(name, steps),
        company:companies(name, website, industry)
      `)
      .order('created_at', { ascending: false });

    return { data, error };
  },

  /**
   * Get sequences for a specific company
   */
  async getCompanySequencesByCompany(companyId: string) {
    const { data, error } = await apiClient.supabase
      .from('company_sequences')
      .select(`
        *,
        sequence:email_sequences(name, steps),
        company:companies(name, website, industry)
      `)
      .eq('company_id', companyId)
      .order('created_at', { ascending: false });

    return { data, error };
  },

  /**
   * Update company sequence status
   */
  async updateSequenceStatus(id: string, status: 'draft' | 'active' | 'paused' | 'completed') {
    const { data, error } = await apiClient.supabase
      .from('company_sequences')
      .update({ status })
      .eq('id', id)
      .select()
      .single();

    return { data, error };
  },

  /**
   * Delete a company sequence
   */
  async deleteCompanySequence(id: string) {
    const { error: actErr } = await apiClient.supabase
      .from('email_activities')
      .delete()
      .eq('company_sequence_id', id);
    if (actErr) throw actErr;

    const { error } = await apiClient.supabase
      .from('company_sequences')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return { error: null };
  },

  /**
   * Send next email in sequence
   */
  async sendSequenceEmail(companySequenceId: string, stepNumber: number) {
    return apiClient.callFunction('send-sequence-email', {
      companySequenceId,
      stepNumber,
    });
  },

  /**
   * Get email activities for a sequence
   */
  async getEmailActivities(companySequenceId: string) {
    const { data, error } = await apiClient.supabase
      .from('email_activities')
      .select('*')
      .eq('company_sequence_id', companySequenceId)
      .order('step_number', { ascending: true });

    return { data, error };
  },

  /**
   * Update sequence settings (auto-respond and automation rules)
   */
  async updateSequenceSettings(
    id: string,
    autoRespondEnabled: boolean,
    automationRules: {
      enabled: boolean;
      rules: Array<{
        type: string;
        action: string;
        wait_hours: number;
      }>;
      step_rules?: Record<string, {
        enabled: boolean;
        type: 'wait_for_open' | 'wait_for_click' | 'time_based' | 'none';
        wait_hours: number;
      }>;
    }
  ) {
    // Also stamp enabled per-step rules onto personalized_emails[].automation_rule
    // so process-sequence-steps can prefer nextStep.automation_rule directly.
    const { data: existing, error: loadErr } = await apiClient.supabase
      .from('company_sequences')
      .select('personalized_emails')
      .eq('id', id)
      .maybeSingle();
    if (loadErr) return { data: null, error: loadErr };

    let personalizedEmails = (existing?.personalized_emails as any[]) || [];
    const stepRules = automationRules.step_rules || {};
    if (personalizedEmails.length > 0 && Object.keys(stepRules).length > 0) {
      personalizedEmails = personalizedEmails.map((email: any, idx: number) => {
        // Template step index is usually personalized stepNumber - 1 when step 0 is campaign stub
        const stepNumber = typeof email?.stepNumber === 'number' ? email.stepNumber : idx;
        const rule =
          stepRules[String(stepNumber)] ||
          stepRules[String(Math.max(0, stepNumber - 1))] ||
          stepRules[String(idx)] ||
          null;
        if (!rule?.enabled) {
          const { automation_rule: _drop, ...rest } = email || {};
          return rest;
        }
        return {
          ...email,
          automation_rule: {
            type: rule.type,
            wait_hours: rule.wait_hours ?? 24,
          },
        };
      });
    }

    const { data, error } = await apiClient.supabase
      .from('company_sequences')
      .update({
        auto_respond_enabled: autoRespondEnabled,
        automation_rules: automationRules,
        personalized_emails: personalizedEmails,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    return { data, error };
  },
};
