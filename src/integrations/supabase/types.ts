export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      assignment_rules: {
        Row: {
          assign_to_role: string | null
          assign_to_user_id: string | null
          conditions: Json
          created_at: string
          description: string | null
          enabled: boolean | null
          id: string
          metadata: Json | null
          name: string
          notify_assignee: boolean | null
          priority: number | null
          shared_inbox_id: string | null
          team_id: string
          updated_at: string
        }
        Insert: {
          assign_to_role?: string | null
          assign_to_user_id?: string | null
          conditions?: Json
          created_at?: string
          description?: string | null
          enabled?: boolean | null
          id?: string
          metadata?: Json | null
          name: string
          notify_assignee?: boolean | null
          priority?: number | null
          shared_inbox_id?: string | null
          team_id: string
          updated_at?: string
        }
        Update: {
          assign_to_role?: string | null
          assign_to_user_id?: string | null
          conditions?: Json
          created_at?: string
          description?: string | null
          enabled?: boolean | null
          id?: string
          metadata?: Json | null
          name?: string
          notify_assignee?: boolean | null
          priority?: number | null
          shared_inbox_id?: string | null
          team_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "assignment_rules_shared_inbox_id_fkey"
            columns: ["shared_inbox_id"]
            isOneToOne: false
            referencedRelation: "shared_inboxes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignment_rules_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      assignments: {
        Row: {
          assigned_by_user_id: string
          assigned_to_user_id: string
          completed_at: string | null
          created_at: string
          due_date: string | null
          entity_id: string
          entity_type: string
          id: string
          metadata: Json | null
          notes: string | null
          status: string | null
          team_id: string
          updated_at: string
        }
        Insert: {
          assigned_by_user_id: string
          assigned_to_user_id: string
          completed_at?: string | null
          created_at?: string
          due_date?: string | null
          entity_id: string
          entity_type: string
          id?: string
          metadata?: Json | null
          notes?: string | null
          status?: string | null
          team_id: string
          updated_at?: string
        }
        Update: {
          assigned_by_user_id?: string
          assigned_to_user_id?: string
          completed_at?: string | null
          created_at?: string
          due_date?: string | null
          entity_id?: string
          entity_type?: string
          id?: string
          metadata?: Json | null
          notes?: string | null
          status?: string | null
          team_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "assignments_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string | null
          id: string
          new_data: Json | null
          old_data: Json | null
          record_id: string
          table_name: string
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          record_id: string
          table_name: string
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string
          table_name?: string
          user_id?: string | null
        }
        Relationships: []
      }
      auto_response_analytics: {
        Row: {
          ai_model: string
          ai_temperature: number | null
          company_sequence_id: string | null
          completion_tokens: number | null
          created_at: string
          email_activity_id: string | null
          generated_at: string
          id: string
          metadata: Json | null
          opened_at: string | null
          prompt_tokens: number | null
          replied_at: string | null
          requires_review: boolean | null
          response_time_ms: number | null
          review_status: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          sent_at: string | null
          sentiment_score: number | null
          success_score: number | null
          token_count: number | null
          user_id: string
        }
        Insert: {
          ai_model: string
          ai_temperature?: number | null
          company_sequence_id?: string | null
          completion_tokens?: number | null
          created_at?: string
          email_activity_id?: string | null
          generated_at?: string
          id?: string
          metadata?: Json | null
          opened_at?: string | null
          prompt_tokens?: number | null
          replied_at?: string | null
          requires_review?: boolean | null
          response_time_ms?: number | null
          review_status?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          sent_at?: string | null
          sentiment_score?: number | null
          success_score?: number | null
          token_count?: number | null
          user_id: string
        }
        Update: {
          ai_model?: string
          ai_temperature?: number | null
          company_sequence_id?: string | null
          completion_tokens?: number | null
          created_at?: string
          email_activity_id?: string | null
          generated_at?: string
          id?: string
          metadata?: Json | null
          opened_at?: string | null
          prompt_tokens?: number | null
          replied_at?: string | null
          requires_review?: boolean | null
          response_time_ms?: number | null
          review_status?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          sent_at?: string | null
          sentiment_score?: number | null
          success_score?: number | null
          token_count?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "auto_response_analytics_company_sequence_id_fkey"
            columns: ["company_sequence_id"]
            isOneToOne: false
            referencedRelation: "company_sequences"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auto_response_analytics_email_activity_id_fkey"
            columns: ["email_activity_id"]
            isOneToOne: false
            referencedRelation: "email_activities"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_rule_executions: {
        Row: {
          action_taken: string | null
          company_sequence_id: string | null
          conditions_met: Json | null
          error_message: string | null
          executed_at: string
          id: string
          metadata: Json | null
          rule_id: string
          success: boolean
        }
        Insert: {
          action_taken?: string | null
          company_sequence_id?: string | null
          conditions_met?: Json | null
          error_message?: string | null
          executed_at?: string
          id?: string
          metadata?: Json | null
          rule_id: string
          success: boolean
        }
        Update: {
          action_taken?: string | null
          company_sequence_id?: string | null
          conditions_met?: Json | null
          error_message?: string | null
          executed_at?: string
          id?: string
          metadata?: Json | null
          rule_id?: string
          success?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "automation_rule_executions_company_sequence_id_fkey"
            columns: ["company_sequence_id"]
            isOneToOne: false
            referencedRelation: "company_sequences"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_rule_executions_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "automation_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_rules: {
        Row: {
          actions: Json
          company_ids: string[] | null
          conditions: Json
          created_at: string
          description: string | null
          enabled: boolean | null
          id: string
          max_sends_per_day: number | null
          metadata: Json | null
          min_time_between_sends_hours: number | null
          name: string
          priority: number | null
          rule_type: string
          send_time_preference: string | null
          sequence_ids: string[] | null
          specific_days: number[] | null
          specific_time: string | null
          timezone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          actions?: Json
          company_ids?: string[] | null
          conditions?: Json
          created_at?: string
          description?: string | null
          enabled?: boolean | null
          id?: string
          max_sends_per_day?: number | null
          metadata?: Json | null
          min_time_between_sends_hours?: number | null
          name: string
          priority?: number | null
          rule_type: string
          send_time_preference?: string | null
          sequence_ids?: string[] | null
          specific_days?: number[] | null
          specific_time?: string | null
          timezone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          actions?: Json
          company_ids?: string[] | null
          conditions?: Json
          created_at?: string
          description?: string | null
          enabled?: boolean | null
          id?: string
          max_sends_per_day?: number | null
          metadata?: Json | null
          min_time_between_sends_hours?: number | null
          name?: string
          priority?: number | null
          rule_type?: string
          send_time_preference?: string | null
          sequence_ids?: string[] | null
          specific_days?: number[] | null
          specific_time?: string | null
          timezone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      business_profiles: {
        Row: {
          ai_max_tokens: number | null
          ai_model: string | null
          ai_response_style: string | null
          ai_temperature: number | null
          auto_response_count_today: number | null
          auto_response_daily_limit: number | null
          auto_response_last_reset_date: string | null
          auto_response_paused: boolean | null
          company_name: string | null
          created_at: string
          email_brand_color: string | null
          email_footer_text: string | null
          email_logo_url: string | null
          email_provider: string | null
          email_signature: string | null
          email_template_style: string | null
          id: string
          industry: string | null
          services_description: string
          target_audience: string | null
          tone_preference: string | null
          updated_at: string
          user_id: string
          value_proposition: string | null
        }
        Insert: {
          ai_max_tokens?: number | null
          ai_model?: string | null
          ai_response_style?: string | null
          ai_temperature?: number | null
          auto_response_count_today?: number | null
          auto_response_daily_limit?: number | null
          auto_response_last_reset_date?: string | null
          auto_response_paused?: boolean | null
          company_name?: string | null
          created_at?: string
          email_brand_color?: string | null
          email_footer_text?: string | null
          email_logo_url?: string | null
          email_provider?: string | null
          email_signature?: string | null
          email_template_style?: string | null
          id?: string
          industry?: string | null
          services_description: string
          target_audience?: string | null
          tone_preference?: string | null
          updated_at?: string
          user_id: string
          value_proposition?: string | null
        }
        Update: {
          ai_max_tokens?: number | null
          ai_model?: string | null
          ai_response_style?: string | null
          ai_temperature?: number | null
          auto_response_count_today?: number | null
          auto_response_daily_limit?: number | null
          auto_response_last_reset_date?: string | null
          auto_response_paused?: boolean | null
          company_name?: string | null
          created_at?: string
          email_brand_color?: string | null
          email_footer_text?: string | null
          email_logo_url?: string | null
          email_provider?: string | null
          email_signature?: string | null
          email_template_style?: string | null
          id?: string
          industry?: string | null
          services_description?: string
          target_audience?: string | null
          tone_preference?: string | null
          updated_at?: string
          user_id?: string
          value_proposition?: string | null
        }
        Relationships: []
      }
      chat_conversations: {
        Row: {
          company_id: string | null
          created_at: string | null
          id: string
          messages: string[] | null
          metadata: Json | null
          title: string | null
          updated_at: string | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string | null
          id?: string
          messages?: string[] | null
          metadata?: Json | null
          title?: string | null
          updated_at?: string | null
        }
        Update: {
          company_id?: string | null
          created_at?: string | null
          id?: string
          messages?: string[] | null
          metadata?: Json | null
          title?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chat_conversations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          ceo_name: string | null
          company_phone: string | null
          created_at: string | null
          description: string | null
          employee_count: number | null
          enriched_at: string | null
          enrichment_confidence: string | null
          enrichment_data: Json | null
          enrichment_error: string | null
          enrichment_model: string | null
          enrichment_provider: string | null
          enrichment_status: string | null
          founded_year: number | null
          funding_stage: string | null
          funding_total: string | null
          general_email: string | null
          geography: string | null
          headquarters: string | null
          id: string
          industry: string | null
          key_executives: Json | null
          langfuse_trace_id: string | null
          linkedin_url: string | null
          name: string
          recent_news: string | null
          size: string | null
          social_profiles: Json | null
          status: string | null
          tech_stack: string[] | null
          updated_at: string | null
          website: string | null
        }
        Insert: {
          ceo_name?: string | null
          company_phone?: string | null
          created_at?: string | null
          description?: string | null
          employee_count?: number | null
          enriched_at?: string | null
          enrichment_confidence?: string | null
          enrichment_data?: Json | null
          enrichment_error?: string | null
          enrichment_model?: string | null
          enrichment_provider?: string | null
          enrichment_status?: string | null
          founded_year?: number | null
          funding_stage?: string | null
          funding_total?: string | null
          general_email?: string | null
          geography?: string | null
          headquarters?: string | null
          id?: string
          industry?: string | null
          key_executives?: Json | null
          langfuse_trace_id?: string | null
          linkedin_url?: string | null
          name: string
          recent_news?: string | null
          size?: string | null
          social_profiles?: Json | null
          status?: string | null
          tech_stack?: string[] | null
          updated_at?: string | null
          website?: string | null
        }
        Update: {
          ceo_name?: string | null
          company_phone?: string | null
          created_at?: string | null
          description?: string | null
          employee_count?: number | null
          enriched_at?: string | null
          enrichment_confidence?: string | null
          enrichment_data?: Json | null
          enrichment_error?: string | null
          enrichment_model?: string | null
          enrichment_provider?: string | null
          enrichment_status?: string | null
          founded_year?: number | null
          funding_stage?: string | null
          funding_total?: string | null
          general_email?: string | null
          geography?: string | null
          headquarters?: string | null
          id?: string
          industry?: string | null
          key_executives?: Json | null
          langfuse_trace_id?: string | null
          linkedin_url?: string | null
          name?: string
          recent_news?: string | null
          size?: string | null
          social_profiles?: Json | null
          status?: string | null
          tech_stack?: string[] | null
          updated_at?: string | null
          website?: string | null
        }
        Relationships: []
      }
      company_sequences: {
        Row: {
          ai_context: Json | null
          auto_respond_enabled: boolean
          automation_rules: Json | null
          company_id: string
          conversation_history: Json | null
          created_at: string
          current_step: number
          id: string
          metadata: Json | null
          next_action: string | null
          personalized_emails: Json | null
          sequence_id: string
          status: string
          updated_at: string
        }
        Insert: {
          ai_context?: Json | null
          auto_respond_enabled?: boolean
          automation_rules?: Json | null
          company_id: string
          conversation_history?: Json | null
          created_at?: string
          current_step?: number
          id?: string
          metadata?: Json | null
          next_action?: string | null
          personalized_emails?: Json | null
          sequence_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          ai_context?: Json | null
          auto_respond_enabled?: boolean
          automation_rules?: Json | null
          company_id?: string
          conversation_history?: Json | null
          created_at?: string
          current_step?: number
          id?: string
          metadata?: Json | null
          next_action?: string | null
          personalized_emails?: Json | null
          sequence_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_sequences_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_sequences_sequence_id_fkey"
            columns: ["sequence_id"]
            isOneToOne: false
            referencedRelation: "email_sequences"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          company_id: string | null
          created_at: string | null
          department: string | null
          email: string | null
          email_verified: boolean | null
          id: string
          is_primary_contact: boolean | null
          linkedin_url: string | null
          name: string
          phone: string | null
          title: string | null
          updated_at: string | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string | null
          department?: string | null
          email?: string | null
          email_verified?: boolean | null
          id?: string
          is_primary_contact?: boolean | null
          linkedin_url?: string | null
          name: string
          phone?: string | null
          title?: string | null
          updated_at?: string | null
        }
        Update: {
          company_id?: string | null
          created_at?: string | null
          department?: string | null
          email?: string | null
          email_verified?: boolean | null
          id?: string
          is_primary_contact?: boolean | null
          linkedin_url?: string | null
          name?: string
          phone?: string | null
          title?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contacts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_connections: {
        Row: {
          connection_id: string
          created_at: string
          from_email: string | null
          id: string
          last_sync_at: string | null
          metadata: Json | null
          provider: string
          scopes: string[] | null
          status: string
          updated_at: string
          user_id: string
          verification_expires_at: string | null
          verification_token: string | null
          verified_at: string | null
        }
        Insert: {
          connection_id: string
          created_at?: string
          from_email?: string | null
          id?: string
          last_sync_at?: string | null
          metadata?: Json | null
          provider: string
          scopes?: string[] | null
          status?: string
          updated_at?: string
          user_id: string
          verification_expires_at?: string | null
          verification_token?: string | null
          verified_at?: string | null
        }
        Update: {
          connection_id?: string
          created_at?: string
          from_email?: string | null
          id?: string
          last_sync_at?: string | null
          metadata?: Json | null
          provider?: string
          scopes?: string[] | null
          status?: string
          updated_at?: string
          user_id?: string
          verification_expires_at?: string | null
          verification_token?: string | null
          verified_at?: string | null
        }
        Relationships: []
      }
      crm_sync_state: {
        Row: {
          connection_id: string
          created_at: string
          entity_type: string
          error_message: string | null
          id: string
          last_sync_token: string | null
          last_synced_at: string | null
          sync_status: string
        }
        Insert: {
          connection_id: string
          created_at?: string
          entity_type: string
          error_message?: string | null
          id?: string
          last_sync_token?: string | null
          last_synced_at?: string | null
          sync_status?: string
        }
        Update: {
          connection_id?: string
          created_at?: string
          entity_type?: string
          error_message?: string | null
          id?: string
          last_sync_token?: string | null
          last_synced_at?: string | null
          sync_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_sync_state_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "crm_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_contacts: {
        Row: {
          created_at: string | null
          deal_id: string
          person_id: string
        }
        Insert: {
          created_at?: string | null
          deal_id: string
          person_id: string
        }
        Update: {
          created_at?: string | null
          deal_id?: string
          person_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "deal_contacts_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_contacts_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
        ]
      }
      deals: {
        Row: {
          amount: number | null
          close_date: string | null
          company_id: string | null
          created_at: string | null
          follow_up_date: string | null
          id: string
          notes: string | null
          priority: string | null
          stage: string | null
          tags: string[] | null
          title: string
          updated_at: string | null
        }
        Insert: {
          amount?: number | null
          close_date?: string | null
          company_id?: string | null
          created_at?: string | null
          follow_up_date?: string | null
          id?: string
          notes?: string | null
          priority?: string | null
          stage?: string | null
          tags?: string[] | null
          title: string
          updated_at?: string | null
        }
        Update: {
          amount?: number | null
          close_date?: string | null
          company_id?: string | null
          created_at?: string | null
          follow_up_date?: string | null
          id?: string
          notes?: string | null
          priority?: string | null
          stage?: string | null
          tags?: string[] | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deals_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      email_ab_test_assignments: {
        Row: {
          ab_test_id: string
          clicked_at: string | null
          converted_at: string | null
          created_at: string
          email_activity_id: string
          id: string
          metadata: Json | null
          opened_at: string | null
          replied_at: string | null
          sent_at: string | null
          variant: string
        }
        Insert: {
          ab_test_id: string
          clicked_at?: string | null
          converted_at?: string | null
          created_at?: string
          email_activity_id: string
          id?: string
          metadata?: Json | null
          opened_at?: string | null
          replied_at?: string | null
          sent_at?: string | null
          variant: string
        }
        Update: {
          ab_test_id?: string
          clicked_at?: string | null
          converted_at?: string | null
          created_at?: string
          email_activity_id?: string
          id?: string
          metadata?: Json | null
          opened_at?: string | null
          replied_at?: string | null
          sent_at?: string | null
          variant?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_ab_test_assignments_ab_test_id_fkey"
            columns: ["ab_test_id"]
            isOneToOne: false
            referencedRelation: "email_ab_tests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_ab_test_assignments_email_activity_id_fkey"
            columns: ["email_activity_id"]
            isOneToOne: false
            referencedRelation: "email_activities"
            referencedColumns: ["id"]
          },
        ]
      }
      email_ab_tests: {
        Row: {
          auto_select_winner: boolean | null
          completed_at: string | null
          confidence_level: number | null
          created_at: string
          description: string | null
          id: string
          metadata: Json | null
          min_sample_size: number | null
          name: string
          results: Json | null
          started_at: string | null
          status: string
          test_type: string
          traffic_split: Json
          updated_at: string
          user_id: string
          variant_a: Json
          variant_b: Json
          variant_c: Json | null
          winner_metric: string | null
          winning_variant: string | null
        }
        Insert: {
          auto_select_winner?: boolean | null
          completed_at?: string | null
          confidence_level?: number | null
          created_at?: string
          description?: string | null
          id?: string
          metadata?: Json | null
          min_sample_size?: number | null
          name: string
          results?: Json | null
          started_at?: string | null
          status?: string
          test_type?: string
          traffic_split?: Json
          updated_at?: string
          user_id: string
          variant_a: Json
          variant_b: Json
          variant_c?: Json | null
          winner_metric?: string | null
          winning_variant?: string | null
        }
        Update: {
          auto_select_winner?: boolean | null
          completed_at?: string | null
          confidence_level?: number | null
          created_at?: string
          description?: string | null
          id?: string
          metadata?: Json | null
          min_sample_size?: number | null
          name?: string
          results?: Json | null
          started_at?: string | null
          status?: string
          test_type?: string
          traffic_split?: Json
          updated_at?: string
          user_id?: string
          variant_a?: Json
          variant_b?: Json
          variant_c?: Json | null
          winner_metric?: string | null
          winning_variant?: string | null
        }
        Relationships: []
      }
      email_activities: {
        Row: {
          body: string | null
          bounced_at: string | null
          company_sequence_id: string | null
          contact_id: string | null
          created_at: string
          external_message_id: string | null
          id: string
          in_reply_to: string | null
          metadata: Json | null
          opened_at: string | null
          replied_at: string | null
          sent_at: string | null
          status: string
          step_number: number
          subject: string | null
          thread_id: string | null
        }
        Insert: {
          body?: string | null
          bounced_at?: string | null
          company_sequence_id?: string | null
          contact_id?: string | null
          created_at?: string
          external_message_id?: string | null
          id?: string
          in_reply_to?: string | null
          metadata?: Json | null
          opened_at?: string | null
          replied_at?: string | null
          sent_at?: string | null
          status?: string
          step_number: number
          subject?: string | null
          thread_id?: string | null
        }
        Update: {
          body?: string | null
          bounced_at?: string | null
          company_sequence_id?: string | null
          contact_id?: string | null
          created_at?: string
          external_message_id?: string | null
          id?: string
          in_reply_to?: string | null
          metadata?: Json | null
          opened_at?: string | null
          replied_at?: string | null
          sent_at?: string | null
          status?: string
          step_number?: number
          subject?: string | null
          thread_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_activities_company_sequence_id_fkey"
            columns: ["company_sequence_id"]
            isOneToOne: false
            referencedRelation: "company_sequences"
            referencedColumns: ["id"]
          },
        ]
      }
      email_bounce_events: {
        Row: {
          bounce_reason: string | null
          bounce_type: string
          created_at: string
          email_activity_id: string | null
          external_message_id: string | null
          id: string
          metadata: Json | null
          occurred_at: string
          recipient_email: string
          user_id: string
        }
        Insert: {
          bounce_reason?: string | null
          bounce_type: string
          created_at?: string
          email_activity_id?: string | null
          external_message_id?: string | null
          id?: string
          metadata?: Json | null
          occurred_at?: string
          recipient_email: string
          user_id: string
        }
        Update: {
          bounce_reason?: string | null
          bounce_type?: string
          created_at?: string
          email_activity_id?: string | null
          external_message_id?: string | null
          id?: string
          metadata?: Json | null
          occurred_at?: string
          recipient_email?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_bounce_events_email_activity_id_fkey"
            columns: ["email_activity_id"]
            isOneToOne: false
            referencedRelation: "email_activities"
            referencedColumns: ["id"]
          },
        ]
      }
      email_campaign_recipients: {
        Row: {
          bounced_at: string | null
          campaign_id: string
          clicked_at: string | null
          created_at: string
          email: string
          error_message: string | null
          external_message_id: string | null
          id: string
          name: string
          opened_at: string | null
          person_id: string | null
          personalized_body_html: string
          personalized_body_text: string
          personalized_subject: string
          sent_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          bounced_at?: string | null
          campaign_id: string
          clicked_at?: string | null
          created_at?: string
          email: string
          error_message?: string | null
          external_message_id?: string | null
          id?: string
          name: string
          opened_at?: string | null
          person_id?: string | null
          personalized_body_html: string
          personalized_body_text: string
          personalized_subject: string
          sent_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          bounced_at?: string | null
          campaign_id?: string
          clicked_at?: string | null
          created_at?: string
          email?: string
          error_message?: string | null
          external_message_id?: string | null
          id?: string
          name?: string
          opened_at?: string | null
          person_id?: string | null
          personalized_body_html?: string
          personalized_body_text?: string
          personalized_subject?: string
          sent_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_campaign_recipients_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "email_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_campaign_recipients_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
        ]
      }
      email_campaigns: {
        Row: {
          body_html_template: string
          body_text_template: string
          completed_at: string | null
          created_at: string
          failed_count: number
          id: string
          name: string
          opened_count: number
          scheduled_at: string | null
          sender_connection_id: string | null
          sent_count: number
          started_at: string | null
          status: string
          subject_template: string
          total_recipients: number
          updated_at: string
          user_id: string
        }
        Insert: {
          body_html_template: string
          body_text_template: string
          completed_at?: string | null
          created_at?: string
          failed_count?: number
          id?: string
          name: string
          opened_count?: number
          scheduled_at?: string | null
          sender_connection_id?: string | null
          sent_count?: number
          started_at?: string | null
          status?: string
          subject_template: string
          total_recipients?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          body_html_template?: string
          body_text_template?: string
          completed_at?: string | null
          created_at?: string
          failed_count?: number
          id?: string
          name?: string
          opened_count?: number
          scheduled_at?: string | null
          sender_connection_id?: string | null
          sent_count?: number
          started_at?: string | null
          status?: string
          subject_template?: string
          total_recipients?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_campaigns_sender_connection_id_fkey"
            columns: ["sender_connection_id"]
            isOneToOne: false
            referencedRelation: "crm_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      email_deliverability_metrics: {
        Row: {
          blacklist_providers: string[] | null
          blacklisted: boolean | null
          bounce_rate: number | null
          checked_at: string
          created_at: string
          dkim_valid: boolean | null
          dmarc_valid: boolean | null
          domain: string
          hard_bounce_count: number | null
          id: string
          metadata: Json | null
          mx_records_valid: boolean | null
          overall_score: number | null
          sender_reputation: number | null
          soft_bounce_count: number | null
          spam_complaint_count: number | null
          spam_complaint_rate: number | null
          spam_score: number | null
          spf_valid: boolean | null
          total_sent: number | null
          user_id: string
        }
        Insert: {
          blacklist_providers?: string[] | null
          blacklisted?: boolean | null
          bounce_rate?: number | null
          checked_at?: string
          created_at?: string
          dkim_valid?: boolean | null
          dmarc_valid?: boolean | null
          domain: string
          hard_bounce_count?: number | null
          id?: string
          metadata?: Json | null
          mx_records_valid?: boolean | null
          overall_score?: number | null
          sender_reputation?: number | null
          soft_bounce_count?: number | null
          spam_complaint_count?: number | null
          spam_complaint_rate?: number | null
          spam_score?: number | null
          spf_valid?: boolean | null
          total_sent?: number | null
          user_id: string
        }
        Update: {
          blacklist_providers?: string[] | null
          blacklisted?: boolean | null
          bounce_rate?: number | null
          checked_at?: string
          created_at?: string
          dkim_valid?: boolean | null
          dmarc_valid?: boolean | null
          domain?: string
          hard_bounce_count?: number | null
          id?: string
          metadata?: Json | null
          mx_records_valid?: boolean | null
          overall_score?: number | null
          sender_reputation?: number | null
          soft_bounce_count?: number | null
          spam_complaint_count?: number | null
          spam_complaint_rate?: number | null
          spam_score?: number | null
          spf_valid?: boolean | null
          total_sent?: number | null
          user_id?: string
        }
        Relationships: []
      }
      email_sequences: {
        Row: {
          ai_instructions: string | null
          auto_respond: boolean
          created_at: string | null
          created_by: string | null
          custom_instructions: string | null
          goal: string | null
          id: string
          langfuse_trace_id: string | null
          model: string | null
          name: string
          provider: string | null
          segment_filters: Json | null
          steps: string[] | null
          updated_at: string | null
        }
        Insert: {
          ai_instructions?: string | null
          auto_respond?: boolean
          created_at?: string | null
          created_by?: string | null
          custom_instructions?: string | null
          goal?: string | null
          id?: string
          langfuse_trace_id?: string | null
          model?: string | null
          name: string
          provider?: string | null
          segment_filters?: Json | null
          steps?: string[] | null
          updated_at?: string | null
        }
        Update: {
          ai_instructions?: string | null
          auto_respond?: boolean
          created_at?: string | null
          created_by?: string | null
          custom_instructions?: string | null
          goal?: string | null
          id?: string
          langfuse_trace_id?: string | null
          model?: string | null
          name?: string
          provider?: string | null
          segment_filters?: Json | null
          steps?: string[] | null
          updated_at?: string | null
        }
        Relationships: []
      }
      email_threads: {
        Row: {
          ai_analysis: Json | null
          body_html: string | null
          body_text: string | null
          company_sequence_id: string | null
          created_at: string
          direction: string
          from_email: string
          id: string
          message_id: string | null
          received_at: string
          sentiment: string | null
          subject: string | null
          thread_id: string | null
          to_email: string
        }
        Insert: {
          ai_analysis?: Json | null
          body_html?: string | null
          body_text?: string | null
          company_sequence_id?: string | null
          created_at?: string
          direction: string
          from_email: string
          id?: string
          message_id?: string | null
          received_at?: string
          sentiment?: string | null
          subject?: string | null
          thread_id?: string | null
          to_email: string
        }
        Update: {
          ai_analysis?: Json | null
          body_html?: string | null
          body_text?: string | null
          company_sequence_id?: string | null
          created_at?: string
          direction?: string
          from_email?: string
          id?: string
          message_id?: string | null
          received_at?: string
          sentiment?: string | null
          subject?: string | null
          thread_id?: string | null
          to_email?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_threads_company_sequence_id_fkey"
            columns: ["company_sequence_id"]
            isOneToOne: false
            referencedRelation: "company_sequences"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          company_id: string | null
          content: Json | null
          created_at: string | null
          deal_id: string | null
          due_at: string | null
          id: string
          type: string
        }
        Insert: {
          company_id?: string | null
          content?: Json | null
          created_at?: string | null
          deal_id?: string | null
          due_at?: string | null
          id?: string
          type: string
        }
        Update: {
          company_id?: string | null
          content?: Json | null
          created_at?: string | null
          deal_id?: string | null
          due_at?: string | null
          id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "events_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      internal_notes: {
        Row: {
          author_id: string
          content: string
          created_at: string
          entity_id: string
          entity_type: string
          id: string
          mentions: Json | null
          metadata: Json | null
          team_id: string
          updated_at: string
        }
        Insert: {
          author_id: string
          content: string
          created_at?: string
          entity_id: string
          entity_type: string
          id?: string
          mentions?: Json | null
          metadata?: Json | null
          team_id: string
          updated_at?: string
        }
        Update: {
          author_id?: string
          content?: string
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: string
          mentions?: Json | null
          metadata?: Json | null
          team_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "internal_notes_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_finder_leads: {
        Row: {
          company_data: Json
          contact_status: string
          created_at: string
          enrichment_status: string
          id: string
          quality_score: number | null
          search_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          company_data?: Json
          contact_status?: string
          created_at?: string
          enrichment_status?: string
          id?: string
          quality_score?: number | null
          search_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          company_data?: Json
          contact_status?: string
          created_at?: string
          enrichment_status?: string
          id?: string
          quality_score?: number | null
          search_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_finder_leads_search_id_fkey"
            columns: ["search_id"]
            isOneToOne: false
            referencedRelation: "lead_finder_searches"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_finder_searches: {
        Row: {
          created_at: string
          current_status: string | null
          error_message: string | null
          id: string
          progress: number
          search_params: Json
          stats: Json | null
          status: string
          trace_url: string | null
          updated_at: string
          usage: Json | null
          user_id: string
        }
        Insert: {
          created_at?: string
          current_status?: string | null
          error_message?: string | null
          id?: string
          progress?: number
          search_params?: Json
          stats?: Json | null
          status?: string
          trace_url?: string | null
          updated_at?: string
          usage?: Json | null
          user_id: string
        }
        Update: {
          created_at?: string
          current_status?: string | null
          error_message?: string | null
          id?: string
          progress?: number
          search_params?: Json
          stats?: Json | null
          status?: string
          trace_url?: string | null
          updated_at?: string
          usage?: Json | null
          user_id?: string
        }
        Relationships: []
      }
      people: {
        Row: {
          bio: string | null
          company_id: string | null
          created_at: string | null
          email: string | null
          enriched_at: string | null
          first_name: string | null
          id: string
          last_name: string | null
          linkedin_url: string | null
          location: string | null
          phone: string | null
          title: string | null
          twitter_url: string | null
          updated_at: string
        }
        Insert: {
          bio?: string | null
          company_id?: string | null
          created_at?: string | null
          email?: string | null
          enriched_at?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          linkedin_url?: string | null
          location?: string | null
          phone?: string | null
          title?: string | null
          twitter_url?: string | null
          updated_at?: string
        }
        Update: {
          bio?: string | null
          company_id?: string | null
          created_at?: string | null
          email?: string | null
          enriched_at?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          linkedin_url?: string | null
          location?: string | null
          phone?: string | null
          title?: string | null
          twitter_url?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "people_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          email: string | null
          full_name: string | null
          id: string
          job_title: string | null
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id: string
          job_title?: string | null
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          job_title?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      shared_inboxes: {
        Row: {
          assignment_strategy: string | null
          auto_assign: boolean | null
          created_at: string
          description: string | null
          email_address: string | null
          id: string
          name: string
          settings: Json | null
          team_id: string
          updated_at: string
        }
        Insert: {
          assignment_strategy?: string | null
          auto_assign?: boolean | null
          created_at?: string
          description?: string | null
          email_address?: string | null
          id?: string
          name: string
          settings?: Json | null
          team_id: string
          updated_at?: string
        }
        Update: {
          assignment_strategy?: string | null
          auto_assign?: boolean | null
          created_at?: string
          description?: string | null
          email_address?: string | null
          id?: string
          name?: string
          settings?: Json | null
          team_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shared_inboxes_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      team_invitations: {
        Row: {
          accepted_at: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by_user_id: string
          role: string
          status: string
          team_id: string
          token: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by_user_id: string
          role?: string
          status?: string
          team_id: string
          token?: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by_user_id?: string
          role?: string
          status?: string
          team_id?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_invitations_invited_by_user_id_fkey"
            columns: ["invited_by_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_invitations_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      team_members: {
        Row: {
          id: string
          joined_at: string
          permissions: Json | null
          role: string
          team_id: string
          user_id: string
        }
        Insert: {
          id?: string
          joined_at?: string
          permissions?: Json | null
          role?: string
          team_id: string
          user_id: string
        }
        Update: {
          id?: string
          joined_at?: string
          permissions?: Json | null
          role?: string
          team_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_members_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          owner_id: string
          settings: Json | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          owner_id: string
          settings?: Json | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          owner_id?: string
          settings?: Json | null
          updated_at?: string
        }
        Relationships: []
      }
      user_campaign_views: {
        Row: {
          company_sequence_id: string
          id: string
          user_id: string
          viewed_at: string | null
        }
        Insert: {
          company_sequence_id: string
          id?: string
          user_id: string
          viewed_at?: string | null
        }
        Update: {
          company_sequence_id?: string
          id?: string
          user_id?: string
          viewed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_campaign_views_company_sequence_id_fkey"
            columns: ["company_sequence_id"]
            isOneToOne: false
            referencedRelation: "company_sequences"
            referencedColumns: ["id"]
          },
        ]
      }
      user_deal_views: {
        Row: {
          deal_id: string
          id: string
          user_id: string
          viewed_at: string | null
        }
        Insert: {
          deal_id: string
          id?: string
          user_id: string
          viewed_at?: string | null
        }
        Update: {
          deal_id?: string
          id?: string
          user_id?: string
          viewed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_deal_views_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      user_event_views: {
        Row: {
          event_id: string
          id: string
          user_id: string
          viewed_at: string | null
        }
        Insert: {
          event_id: string
          id?: string
          user_id: string
          viewed_at?: string | null
        }
        Update: {
          event_id?: string
          id?: string
          user_id?: string
          viewed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_event_views_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_team_invitation: {
        Args: { invitation_token: string }
        Returns: Json
      }
      get_user_team_role: {
        Args: { _team_id: string; _user_id: string }
        Returns: string
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      has_team_membership: {
        Args: { _team_id: string; _user_id: string }
        Returns: boolean
      }
      is_team_admin: {
        Args: { _team_id: string; _user_id: string }
        Returns: boolean
      }
      search_companies: {
        Args: { search_query: string }
        Returns: {
          geography: string
          id: string
          industry: string
          name: string
          rank: number
          size: string
          status: string
          website: string
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "sales_rep" | "viewer"
      company_status:
        | "NEW"
        | "QUALIFIED"
        | "CONTACTED"
        | "MEETING"
        | "PROPOSAL"
        | "WON"
        | "LOST"
      deal_stage:
        | "LEAD"
        | "QUALIFIED"
        | "PROPOSAL"
        | "NEGOTIATION"
        | "WON"
        | "LOST"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "sales_rep", "viewer"],
      company_status: [
        "NEW",
        "QUALIFIED",
        "CONTACTED",
        "MEETING",
        "PROPOSAL",
        "WON",
        "LOST",
      ],
      deal_stage: [
        "LEAD",
        "QUALIFIED",
        "PROPOSAL",
        "NEGOTIATION",
        "WON",
        "LOST",
      ],
    },
  },
} as const
