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
      auto_approval_rules: {
        Row: {
          conditions: Json
          created_at: string
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          priority: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          conditions?: Json
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          priority?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          conditions?: Json
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          priority?: number | null
          updated_at?: string
          user_id?: string
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
      autonomous_discovery_settings: {
        Row: {
          apify_max_results: number | null
          apify_quality_weight: number | null
          apify_search_radius: number | null
          auto_approve_threshold: number | null
          auto_create_campaign: boolean | null
          auto_enroll_enabled: boolean | null
          auto_enroll_sequence_id: string | null
          auto_extract_all_emails: boolean | null
          auto_extract_emails: boolean | null
          avoid_industries: string[] | null
          avoid_keywords: string[] | null
          campaign_send_time: string | null
          campaign_template_id: string | null
          created_at: string
          custom_search_query: string | null
          daily_lead_target: number | null
          deep_enrichment_mode: boolean | null
          discord_webhook_url: string | null
          discovery_frequency: string
          enabled: boolean
          enrich_with_perplexity: boolean
          exa_quality_weight: number | null
          feedback_learning_enabled: boolean | null
          full_auto_mode: boolean | null
          hot_lead_threshold: number | null
          id: string
          last_run_at: string | null
          learned_company_sizes: string[] | null
          learned_geographies: string[] | null
          learned_industries: string[] | null
          learned_keywords: string[] | null
          max_leads_per_run: number
          max_perplexity_enriched: number | null
          next_run_at: string | null
          notify_min_quality_score: number | null
          notify_on_auto_approve: boolean | null
          notify_on_discovery_complete: boolean | null
          notify_on_hot_leads: boolean | null
          pre_discovery_hours: number | null
          preferred_discovery_hour: number | null
          serpapi_quality_weight: number | null
          slack_webhook_url: string | null
          target_company_sizes: string[] | null
          target_geographies: string[] | null
          target_industries: string[] | null
          timezone: string | null
          total_approved: number | null
          total_rejected: number | null
          updated_at: string
          use_apify: boolean | null
          use_serp_api: boolean
          user_id: string
          webhook_enabled: boolean | null
          webhook_url: string | null
        }
        Insert: {
          apify_max_results?: number | null
          apify_quality_weight?: number | null
          apify_search_radius?: number | null
          auto_approve_threshold?: number | null
          auto_create_campaign?: boolean | null
          auto_enroll_enabled?: boolean | null
          auto_enroll_sequence_id?: string | null
          auto_extract_all_emails?: boolean | null
          auto_extract_emails?: boolean | null
          avoid_industries?: string[] | null
          avoid_keywords?: string[] | null
          campaign_send_time?: string | null
          campaign_template_id?: string | null
          created_at?: string
          custom_search_query?: string | null
          daily_lead_target?: number | null
          deep_enrichment_mode?: boolean | null
          discord_webhook_url?: string | null
          discovery_frequency?: string
          enabled?: boolean
          enrich_with_perplexity?: boolean
          exa_quality_weight?: number | null
          feedback_learning_enabled?: boolean | null
          full_auto_mode?: boolean | null
          hot_lead_threshold?: number | null
          id?: string
          last_run_at?: string | null
          learned_company_sizes?: string[] | null
          learned_geographies?: string[] | null
          learned_industries?: string[] | null
          learned_keywords?: string[] | null
          max_leads_per_run?: number
          max_perplexity_enriched?: number | null
          next_run_at?: string | null
          notify_min_quality_score?: number | null
          notify_on_auto_approve?: boolean | null
          notify_on_discovery_complete?: boolean | null
          notify_on_hot_leads?: boolean | null
          pre_discovery_hours?: number | null
          preferred_discovery_hour?: number | null
          serpapi_quality_weight?: number | null
          slack_webhook_url?: string | null
          target_company_sizes?: string[] | null
          target_geographies?: string[] | null
          target_industries?: string[] | null
          timezone?: string | null
          total_approved?: number | null
          total_rejected?: number | null
          updated_at?: string
          use_apify?: boolean | null
          use_serp_api?: boolean
          user_id: string
          webhook_enabled?: boolean | null
          webhook_url?: string | null
        }
        Update: {
          apify_max_results?: number | null
          apify_quality_weight?: number | null
          apify_search_radius?: number | null
          auto_approve_threshold?: number | null
          auto_create_campaign?: boolean | null
          auto_enroll_enabled?: boolean | null
          auto_enroll_sequence_id?: string | null
          auto_extract_all_emails?: boolean | null
          auto_extract_emails?: boolean | null
          avoid_industries?: string[] | null
          avoid_keywords?: string[] | null
          campaign_send_time?: string | null
          campaign_template_id?: string | null
          created_at?: string
          custom_search_query?: string | null
          daily_lead_target?: number | null
          deep_enrichment_mode?: boolean | null
          discord_webhook_url?: string | null
          discovery_frequency?: string
          enabled?: boolean
          enrich_with_perplexity?: boolean
          exa_quality_weight?: number | null
          feedback_learning_enabled?: boolean | null
          full_auto_mode?: boolean | null
          hot_lead_threshold?: number | null
          id?: string
          last_run_at?: string | null
          learned_company_sizes?: string[] | null
          learned_geographies?: string[] | null
          learned_industries?: string[] | null
          learned_keywords?: string[] | null
          max_leads_per_run?: number
          max_perplexity_enriched?: number | null
          next_run_at?: string | null
          notify_min_quality_score?: number | null
          notify_on_auto_approve?: boolean | null
          notify_on_discovery_complete?: boolean | null
          notify_on_hot_leads?: boolean | null
          pre_discovery_hours?: number | null
          preferred_discovery_hour?: number | null
          serpapi_quality_weight?: number | null
          slack_webhook_url?: string | null
          target_company_sizes?: string[] | null
          target_geographies?: string[] | null
          target_industries?: string[] | null
          timezone?: string | null
          total_approved?: number | null
          total_rejected?: number | null
          updated_at?: string
          use_apify?: boolean | null
          use_serp_api?: boolean
          user_id?: string
          webhook_enabled?: boolean | null
          webhook_url?: string | null
        }
        Relationships: []
      }
      autonomous_leads: {
        Row: {
          approval_confidence: number | null
          approval_reason: string | null
          campaign_id: string | null
          company_data: Json
          company_id: string | null
          company_name: string
          company_size: string | null
          company_website: string | null
          contacts: Json | null
          created_at: string
          discovery_run_id: string | null
          enrichment_data: Json | null
          geography: string | null
          id: string
          industry: string | null
          matched_rules: string[] | null
          persona_id: string | null
          quality_score: number | null
          reviewed_at: string | null
          source: string | null
          source_breakdown: Json | null
          sources_used: string[] | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          approval_confidence?: number | null
          approval_reason?: string | null
          campaign_id?: string | null
          company_data?: Json
          company_id?: string | null
          company_name: string
          company_size?: string | null
          company_website?: string | null
          contacts?: Json | null
          created_at?: string
          discovery_run_id?: string | null
          enrichment_data?: Json | null
          geography?: string | null
          id?: string
          industry?: string | null
          matched_rules?: string[] | null
          persona_id?: string | null
          quality_score?: number | null
          reviewed_at?: string | null
          source?: string | null
          source_breakdown?: Json | null
          sources_used?: string[] | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          approval_confidence?: number | null
          approval_reason?: string | null
          campaign_id?: string | null
          company_data?: Json
          company_id?: string | null
          company_name?: string
          company_size?: string | null
          company_website?: string | null
          contacts?: Json | null
          created_at?: string
          discovery_run_id?: string | null
          enrichment_data?: Json | null
          geography?: string | null
          id?: string
          industry?: string | null
          matched_rules?: string[] | null
          persona_id?: string | null
          quality_score?: number | null
          reviewed_at?: string | null
          source?: string | null
          source_breakdown?: Json | null
          sources_used?: string[] | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "autonomous_leads_persona_id_fkey"
            columns: ["persona_id"]
            isOneToOne: false
            referencedRelation: "discovery_personas"
            referencedColumns: ["id"]
          },
        ]
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
          default_follow_up_sequence_id: string | null
          email_brand_color: string | null
          email_footer_image_url: string | null
          email_footer_logo_url: string | null
          email_footer_text: string | null
          email_header_name: string | null
          email_logo_url: string | null
          email_provider: string | null
          email_sender_address: string | null
          email_sender_email: string | null
          email_sender_image_url: string | null
          email_sender_name: string | null
          email_sender_phone: string | null
          email_sender_title: string | null
          email_signature: string | null
          email_signature_closing: string | null
          email_signature_name: string | null
          email_signature_use_structured: boolean | null
          email_template_style: string | null
          id: string
          industry: string | null
          newsletter_cron_end_hour_utc: number | null
          newsletter_cron_start_hour_utc: number | null
          newsletter_cron_timezone: string | null
          phone: string | null
          services_description: string
          signature_show_email: boolean
          target_audience: string | null
          tone_preference: string | null
          updated_at: string
          user_id: string
          value_proposition: string | null
          website: string | null
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
          default_follow_up_sequence_id?: string | null
          email_brand_color?: string | null
          email_footer_image_url?: string | null
          email_footer_logo_url?: string | null
          email_footer_text?: string | null
          email_header_name?: string | null
          email_logo_url?: string | null
          email_provider?: string | null
          email_sender_address?: string | null
          email_sender_email?: string | null
          email_sender_image_url?: string | null
          email_sender_name?: string | null
          email_sender_phone?: string | null
          email_sender_title?: string | null
          email_signature?: string | null
          email_signature_closing?: string | null
          email_signature_name?: string | null
          email_signature_use_structured?: boolean | null
          email_template_style?: string | null
          id?: string
          industry?: string | null
          newsletter_cron_end_hour_utc?: number | null
          newsletter_cron_start_hour_utc?: number | null
          newsletter_cron_timezone?: string | null
          phone?: string | null
          services_description: string
          signature_show_email?: boolean
          target_audience?: string | null
          tone_preference?: string | null
          updated_at?: string
          user_id: string
          value_proposition?: string | null
          website?: string | null
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
          default_follow_up_sequence_id?: string | null
          email_brand_color?: string | null
          email_footer_image_url?: string | null
          email_footer_logo_url?: string | null
          email_footer_text?: string | null
          email_header_name?: string | null
          email_logo_url?: string | null
          email_provider?: string | null
          email_sender_address?: string | null
          email_sender_email?: string | null
          email_sender_image_url?: string | null
          email_sender_name?: string | null
          email_sender_phone?: string | null
          email_sender_title?: string | null
          email_signature?: string | null
          email_signature_closing?: string | null
          email_signature_name?: string | null
          email_signature_use_structured?: boolean | null
          email_template_style?: string | null
          id?: string
          industry?: string | null
          newsletter_cron_end_hour_utc?: number | null
          newsletter_cron_start_hour_utc?: number | null
          newsletter_cron_timezone?: string | null
          phone?: string | null
          services_description?: string
          signature_show_email?: boolean
          target_audience?: string | null
          tone_preference?: string | null
          updated_at?: string
          user_id?: string
          value_proposition?: string | null
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "business_profiles_default_follow_up_sequence_id_fkey"
            columns: ["default_follow_up_sequence_id"]
            isOneToOne: false
            referencedRelation: "email_sequences"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_events: {
        Row: {
          attendees: Json | null
          company_id: string | null
          created_at: string | null
          deal_id: string | null
          description: string | null
          end_time: string
          event_type: string | null
          id: string
          is_all_day: boolean | null
          location: string | null
          metadata: Json | null
          recurrence_rule: string | null
          reminder_minutes: number | null
          start_time: string
          status: string | null
          team_id: string | null
          title: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          attendees?: Json | null
          company_id?: string | null
          created_at?: string | null
          deal_id?: string | null
          description?: string | null
          end_time: string
          event_type?: string | null
          id?: string
          is_all_day?: boolean | null
          location?: string | null
          metadata?: Json | null
          recurrence_rule?: string | null
          reminder_minutes?: number | null
          start_time: string
          status?: string | null
          team_id?: string | null
          title: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          attendees?: Json | null
          company_id?: string | null
          created_at?: string | null
          deal_id?: string | null
          description?: string | null
          end_time?: string
          event_type?: string | null
          id?: string
          is_all_day?: boolean | null
          location?: string | null
          metadata?: Json | null
          recurrence_rule?: string | null
          reminder_minutes?: number | null
          start_time?: string
          status?: string | null
          team_id?: string | null
          title?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_events_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_events_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_events_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
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
          last_analyzed_at: string | null
          linkedin_url: string | null
          name: string
          recent_news: string | null
          size: string | null
          social_profiles: Json | null
          status: string | null
          suggested_actions: Json | null
          tags: string[] | null
          tech_stack: string[] | null
          temperature: string | null
          updated_at: string | null
          user_id: string
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
          last_analyzed_at?: string | null
          linkedin_url?: string | null
          name: string
          recent_news?: string | null
          size?: string | null
          social_profiles?: Json | null
          status?: string | null
          suggested_actions?: Json | null
          tags?: string[] | null
          tech_stack?: string[] | null
          temperature?: string | null
          updated_at?: string | null
          user_id: string
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
          last_analyzed_at?: string | null
          linkedin_url?: string | null
          name?: string
          recent_news?: string | null
          size?: string | null
          social_profiles?: Json | null
          status?: string | null
          suggested_actions?: Json | null
          tags?: string[] | null
          tech_stack?: string[] | null
          temperature?: string | null
          updated_at?: string | null
          user_id?: string
          website?: string | null
        }
        Relationships: []
      }
      company_sequences: {
        Row: {
          ai_context: Json | null
          auto_respond_enabled: boolean
          automation_rules: Json | null
          campaign_id: string | null
          company_id: string
          conversation_history: Json | null
          created_at: string
          current_step: number
          id: string
          metadata: Json | null
          next_action: string | null
          personalized_emails: Json | null
          sender_profile_id: string | null
          sequence_id: string
          status: string
          updated_at: string
        }
        Insert: {
          ai_context?: Json | null
          auto_respond_enabled?: boolean
          automation_rules?: Json | null
          campaign_id?: string | null
          company_id: string
          conversation_history?: Json | null
          created_at?: string
          current_step?: number
          id?: string
          metadata?: Json | null
          next_action?: string | null
          personalized_emails?: Json | null
          sender_profile_id?: string | null
          sequence_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          ai_context?: Json | null
          auto_respond_enabled?: boolean
          automation_rules?: Json | null
          campaign_id?: string | null
          company_id?: string
          conversation_history?: Json | null
          created_at?: string
          current_step?: number
          id?: string
          metadata?: Json | null
          next_action?: string | null
          personalized_emails?: Json | null
          sender_profile_id?: string | null
          sequence_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_sequences_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "email_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_sequences_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_sequences_sender_profile_id_fkey"
            columns: ["sender_profile_id"]
            isOneToOne: false
            referencedRelation: "sender_profiles"
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
      company_tag_presets: {
        Row: {
          category: string | null
          color: string | null
          created_at: string | null
          id: string
          name: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          category?: string | null
          color?: string | null
          created_at?: string | null
          id?: string
          name: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          category?: string | null
          color?: string | null
          created_at?: string | null
          id?: string
          name?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
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
          capabilities: Json | null
          connection_id: string
          created_at: string
          from_email: string | null
          id: string
          last_sync_at: string | null
          metadata: Json | null
          provider: string
          scopes: string[] | null
          sending_method: string | null
          status: string
          tracking_enabled: boolean | null
          updated_at: string
          user_id: string
          verification_expires_at: string | null
          verification_token: string | null
          verified_at: string | null
        }
        Insert: {
          capabilities?: Json | null
          connection_id: string
          created_at?: string
          from_email?: string | null
          id?: string
          last_sync_at?: string | null
          metadata?: Json | null
          provider: string
          scopes?: string[] | null
          sending_method?: string | null
          status?: string
          tracking_enabled?: boolean | null
          updated_at?: string
          user_id: string
          verification_expires_at?: string | null
          verification_token?: string | null
          verified_at?: string | null
        }
        Update: {
          capabilities?: Json | null
          connection_id?: string
          created_at?: string
          from_email?: string | null
          id?: string
          last_sync_at?: string | null
          metadata?: Json | null
          provider?: string
          scopes?: string[] | null
          sending_method?: string | null
          status?: string
          tracking_enabled?: boolean | null
          updated_at?: string
          user_id?: string
          verification_expires_at?: string | null
          verification_token?: string | null
          verified_at?: string | null
        }
        Relationships: []
      }
      crm_files: {
        Row: {
          created_at: string | null
          description: string | null
          entity_id: string | null
          entity_type: string | null
          file_name: string
          file_size: number
          file_type: string
          id: string
          is_public: boolean | null
          metadata: Json | null
          storage_path: string
          tags: string[] | null
          team_id: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          entity_id?: string | null
          entity_type?: string | null
          file_name: string
          file_size: number
          file_type: string
          id?: string
          is_public?: boolean | null
          metadata?: Json | null
          storage_path: string
          tags?: string[] | null
          team_id?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          entity_id?: string | null
          entity_type?: string | null
          file_name?: string
          file_size?: number
          file_type?: string
          id?: string
          is_public?: boolean | null
          metadata?: Json | null
          storage_path?: string
          tags?: string[] | null
          team_id?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_files_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_notes: {
        Row: {
          content: string
          created_at: string
          id: string
          source: string | null
          source_metadata: Json | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content?: string
          created_at?: string
          id?: string
          source?: string | null
          source_metadata?: Json | null
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          source?: string | null
          source_metadata?: Json | null
          title?: string
          updated_at?: string
          user_id?: string
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
          user_id: string
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
          user_id: string
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
          user_id?: string
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
      discovery_personas: {
        Row: {
          auto_approve_threshold: number | null
          auto_enroll_sequence_id: string | null
          call_to_action: string | null
          conversion_rate: number | null
          created_at: string
          custom_search_query: string | null
          description: string | null
          email_signature_override: string | null
          email_tone: string | null
          exclude_industries: string[] | null
          exclude_keywords: string[] | null
          id: string
          is_active: boolean | null
          learned_company_sizes: string[] | null
          learned_geographies: string[] | null
          learned_industries: string[] | null
          name: string
          priority: number | null
          product_focus: string | null
          talking_points: string[] | null
          target_company_sizes: string[] | null
          target_geographies: string[] | null
          target_industries: string[] | null
          target_keywords: string[] | null
          total_approved: number | null
          total_leads_found: number | null
          total_rejected: number | null
          updated_at: string
          user_id: string
          value_proposition: string | null
        }
        Insert: {
          auto_approve_threshold?: number | null
          auto_enroll_sequence_id?: string | null
          call_to_action?: string | null
          conversion_rate?: number | null
          created_at?: string
          custom_search_query?: string | null
          description?: string | null
          email_signature_override?: string | null
          email_tone?: string | null
          exclude_industries?: string[] | null
          exclude_keywords?: string[] | null
          id?: string
          is_active?: boolean | null
          learned_company_sizes?: string[] | null
          learned_geographies?: string[] | null
          learned_industries?: string[] | null
          name: string
          priority?: number | null
          product_focus?: string | null
          talking_points?: string[] | null
          target_company_sizes?: string[] | null
          target_geographies?: string[] | null
          target_industries?: string[] | null
          target_keywords?: string[] | null
          total_approved?: number | null
          total_leads_found?: number | null
          total_rejected?: number | null
          updated_at?: string
          user_id: string
          value_proposition?: string | null
        }
        Update: {
          auto_approve_threshold?: number | null
          auto_enroll_sequence_id?: string | null
          call_to_action?: string | null
          conversion_rate?: number | null
          created_at?: string
          custom_search_query?: string | null
          description?: string | null
          email_signature_override?: string | null
          email_tone?: string | null
          exclude_industries?: string[] | null
          exclude_keywords?: string[] | null
          id?: string
          is_active?: boolean | null
          learned_company_sizes?: string[] | null
          learned_geographies?: string[] | null
          learned_industries?: string[] | null
          name?: string
          priority?: number | null
          product_focus?: string | null
          talking_points?: string[] | null
          target_company_sizes?: string[] | null
          target_geographies?: string[] | null
          target_industries?: string[] | null
          target_keywords?: string[] | null
          total_approved?: number | null
          total_leads_found?: number | null
          total_rejected?: number | null
          updated_at?: string
          user_id?: string
          value_proposition?: string | null
        }
        Relationships: []
      }
      discovery_runs: {
        Row: {
          campaigns_created: number | null
          completed_at: string | null
          contacts_created: number | null
          created_at: string
          discovery_run_id: string
          emails_extracted: number | null
          error_message: string | null
          errors: Json | null
          id: string
          leads_auto_approved: number | null
          leads_enriched: number | null
          leads_pending: number | null
          persona_id: string | null
          persona_name: string | null
          sequences_enrolled: number | null
          settings_snapshot: Json | null
          source_breakdown: Json | null
          started_at: string
          status: string
          total_leads_found: number | null
          trigger_type: string | null
          user_id: string
        }
        Insert: {
          campaigns_created?: number | null
          completed_at?: string | null
          contacts_created?: number | null
          created_at?: string
          discovery_run_id: string
          emails_extracted?: number | null
          error_message?: string | null
          errors?: Json | null
          id?: string
          leads_auto_approved?: number | null
          leads_enriched?: number | null
          leads_pending?: number | null
          persona_id?: string | null
          persona_name?: string | null
          sequences_enrolled?: number | null
          settings_snapshot?: Json | null
          source_breakdown?: Json | null
          started_at?: string
          status?: string
          total_leads_found?: number | null
          trigger_type?: string | null
          user_id: string
        }
        Update: {
          campaigns_created?: number | null
          completed_at?: string | null
          contacts_created?: number | null
          created_at?: string
          discovery_run_id?: string
          emails_extracted?: number | null
          error_message?: string | null
          errors?: Json | null
          id?: string
          leads_auto_approved?: number | null
          leads_enriched?: number | null
          leads_pending?: number | null
          persona_id?: string | null
          persona_name?: string | null
          sequences_enrolled?: number | null
          settings_snapshot?: Json | null
          source_breakdown?: Json | null
          started_at?: string
          status?: string
          total_leads_found?: number | null
          trigger_type?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "discovery_runs_persona_id_fkey"
            columns: ["persona_id"]
            isOneToOne: false
            referencedRelation: "discovery_personas"
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
          email_period: string | null
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
          email_period?: string | null
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
          email_period?: string | null
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
          ab_variant: string | null
          bounced_at: string | null
          campaign_id: string
          clicked_at: string | null
          created_at: string
          delivered_at: string | null
          email: string
          email_period: string | null
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
          ab_variant?: string | null
          bounced_at?: string | null
          campaign_id: string
          clicked_at?: string | null
          created_at?: string
          delivered_at?: string | null
          email: string
          email_period?: string | null
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
          ab_variant?: string | null
          bounced_at?: string | null
          campaign_id?: string
          clicked_at?: string | null
          created_at?: string
          delivered_at?: string | null
          email?: string
          email_period?: string | null
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
          ab_body_html_b: string | null
          ab_body_text_b: string | null
          ab_subject_b: string | null
          ab_test_enabled: boolean
          ab_traffic_split: number
          ab_winner_metric: string | null
          auto_follow_up_enabled: boolean
          body_html_template: string
          body_text_template: string
          completed_at: string | null
          created_at: string
          failed_count: number
          follow_up_sequence_id: string | null
          header_image_url: string | null
          id: string
          name: string
          opened_count: number
          scheduled_at: string | null
          sender_connection_id: string | null
          sender_profile_id: string | null
          sent_count: number
          started_at: string | null
          status: string
          subject_template: string
          tags: string[] | null
          total_recipients: number
          updated_at: string
          user_id: string
        }
        Insert: {
          ab_body_html_b?: string | null
          ab_body_text_b?: string | null
          ab_subject_b?: string | null
          ab_test_enabled?: boolean
          ab_traffic_split?: number
          ab_winner_metric?: string | null
          auto_follow_up_enabled?: boolean
          body_html_template: string
          body_text_template: string
          completed_at?: string | null
          created_at?: string
          failed_count?: number
          follow_up_sequence_id?: string | null
          header_image_url?: string | null
          id?: string
          name: string
          opened_count?: number
          scheduled_at?: string | null
          sender_connection_id?: string | null
          sender_profile_id?: string | null
          sent_count?: number
          started_at?: string | null
          status?: string
          subject_template: string
          tags?: string[] | null
          total_recipients?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          ab_body_html_b?: string | null
          ab_body_text_b?: string | null
          ab_subject_b?: string | null
          ab_test_enabled?: boolean
          ab_traffic_split?: number
          ab_winner_metric?: string | null
          auto_follow_up_enabled?: boolean
          body_html_template?: string
          body_text_template?: string
          completed_at?: string | null
          created_at?: string
          failed_count?: number
          follow_up_sequence_id?: string | null
          header_image_url?: string | null
          id?: string
          name?: string
          opened_count?: number
          scheduled_at?: string | null
          sender_connection_id?: string | null
          sender_profile_id?: string | null
          sent_count?: number
          started_at?: string | null
          status?: string
          subject_template?: string
          tags?: string[] | null
          total_recipients?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_campaigns_follow_up_sequence_id_fkey"
            columns: ["follow_up_sequence_id"]
            isOneToOne: false
            referencedRelation: "email_sequences"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_campaigns_sender_connection_id_fkey"
            columns: ["sender_connection_id"]
            isOneToOne: false
            referencedRelation: "crm_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_campaigns_sender_profile_id_fkey"
            columns: ["sender_profile_id"]
            isOneToOne: false
            referencedRelation: "sender_profiles"
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
          description: string | null
          goal: string | null
          id: string
          langfuse_trace_id: string | null
          model: string | null
          name: string
          provider: string | null
          repeat_after_days: number
          repeat_only_for: string
          repeat_sequence: boolean
          segment_filters: Json | null
          steps: string[] | null
          updated_at: string | null
          use_email_branding: boolean
        }
        Insert: {
          ai_instructions?: string | null
          auto_respond?: boolean
          created_at?: string | null
          created_by?: string | null
          custom_instructions?: string | null
          description?: string | null
          goal?: string | null
          id?: string
          langfuse_trace_id?: string | null
          model?: string | null
          name: string
          provider?: string | null
          repeat_after_days?: number
          repeat_only_for?: string
          repeat_sequence?: boolean
          segment_filters?: Json | null
          steps?: string[] | null
          updated_at?: string | null
          use_email_branding?: boolean
        }
        Update: {
          ai_instructions?: string | null
          auto_respond?: boolean
          created_at?: string | null
          created_by?: string | null
          custom_instructions?: string | null
          description?: string | null
          goal?: string | null
          id?: string
          langfuse_trace_id?: string | null
          model?: string | null
          name?: string
          provider?: string | null
          repeat_after_days?: number
          repeat_only_for?: string
          repeat_sequence?: boolean
          segment_filters?: Json | null
          steps?: string[] | null
          updated_at?: string | null
          use_email_branding?: boolean
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
          metadata: Json | null
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
          metadata?: Json | null
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
          metadata?: Json | null
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
      enrichment_queue: {
        Row: {
          created_at: string
          description: string | null
          email: string | null
          email_extraction_attempts: number | null
          email_extraction_status: string | null
          enriched_at: string | null
          enrichment_data: Json | null
          enrichment_errors: string[] | null
          enrichment_provider: string | null
          enrichment_status: string | null
          extracted_email: string | null
          geography: string | null
          id: string
          industry: string | null
          linkedin_url: string | null
          metadata: Json | null
          moved_to_crm_at: string | null
          name: string
          notes: string | null
          phone: string | null
          source: string | null
          source_metadata: Json | null
          updated_at: string
          user_id: string
          website: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          email?: string | null
          email_extraction_attempts?: number | null
          email_extraction_status?: string | null
          enriched_at?: string | null
          enrichment_data?: Json | null
          enrichment_errors?: string[] | null
          enrichment_provider?: string | null
          enrichment_status?: string | null
          extracted_email?: string | null
          geography?: string | null
          id?: string
          industry?: string | null
          linkedin_url?: string | null
          metadata?: Json | null
          moved_to_crm_at?: string | null
          name: string
          notes?: string | null
          phone?: string | null
          source?: string | null
          source_metadata?: Json | null
          updated_at?: string
          user_id: string
          website?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          email?: string | null
          email_extraction_attempts?: number | null
          email_extraction_status?: string | null
          enriched_at?: string | null
          enrichment_data?: Json | null
          enrichment_errors?: string[] | null
          enrichment_provider?: string | null
          enrichment_status?: string | null
          extracted_email?: string | null
          geography?: string | null
          id?: string
          industry?: string | null
          linkedin_url?: string | null
          metadata?: Json | null
          moved_to_crm_at?: string | null
          name?: string
          notes?: string | null
          phone?: string | null
          source?: string | null
          source_metadata?: Json | null
          updated_at?: string
          user_id?: string
          website?: string | null
        }
        Relationships: []
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
      invoices: {
        Row: {
          ai_context: Json | null
          ai_generated: boolean | null
          company_id: string | null
          created_at: string | null
          currency: string | null
          deal_id: string | null
          due_date: string
          id: string
          invoice_number: string
          invoice_type: string | null
          issue_date: string
          line_items: Json | null
          metadata: Json | null
          notes: string | null
          paid_at: string | null
          payment_status: string | null
          status: string | null
          subtotal: number
          tax_amount: number | null
          tax_rate: number | null
          team_id: string | null
          terms: string | null
          total_amount: number
          updated_at: string | null
          user_id: string
        }
        Insert: {
          ai_context?: Json | null
          ai_generated?: boolean | null
          company_id?: string | null
          created_at?: string | null
          currency?: string | null
          deal_id?: string | null
          due_date: string
          id?: string
          invoice_number: string
          invoice_type?: string | null
          issue_date?: string
          line_items?: Json | null
          metadata?: Json | null
          notes?: string | null
          paid_at?: string | null
          payment_status?: string | null
          status?: string | null
          subtotal?: number
          tax_amount?: number | null
          tax_rate?: number | null
          team_id?: string | null
          terms?: string | null
          total_amount?: number
          updated_at?: string | null
          user_id: string
        }
        Update: {
          ai_context?: Json | null
          ai_generated?: boolean | null
          company_id?: string | null
          created_at?: string | null
          currency?: string | null
          deal_id?: string | null
          due_date?: string
          id?: string
          invoice_number?: string
          invoice_type?: string | null
          issue_date?: string
          line_items?: Json | null
          metadata?: Json | null
          notes?: string | null
          paid_at?: string | null
          payment_status?: string | null
          status?: string | null
          subtotal?: number
          tax_amount?: number | null
          tax_rate?: number | null
          team_id?: string | null
          terms?: string | null
          total_amount?: number
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_feedback_analytics: {
        Row: {
          action: string
          autonomous_lead_id: string | null
          company_id: string | null
          company_sequence_id: string | null
          company_size: string | null
          created_at: string
          email_bounced: boolean | null
          email_clicked: boolean | null
          email_opened: boolean | null
          email_replied: boolean | null
          engagement_score: number | null
          geography: string | null
          id: string
          industry: string | null
          quality_score: number | null
          source: string | null
          time_to_decision_seconds: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          action: string
          autonomous_lead_id?: string | null
          company_id?: string | null
          company_sequence_id?: string | null
          company_size?: string | null
          created_at?: string
          email_bounced?: boolean | null
          email_clicked?: boolean | null
          email_opened?: boolean | null
          email_replied?: boolean | null
          engagement_score?: number | null
          geography?: string | null
          id?: string
          industry?: string | null
          quality_score?: number | null
          source?: string | null
          time_to_decision_seconds?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          action?: string
          autonomous_lead_id?: string | null
          company_id?: string | null
          company_sequence_id?: string | null
          company_size?: string | null
          created_at?: string
          email_bounced?: boolean | null
          email_clicked?: boolean | null
          email_opened?: boolean | null
          email_replied?: boolean | null
          engagement_score?: number | null
          geography?: string | null
          id?: string
          industry?: string | null
          quality_score?: number | null
          source?: string | null
          time_to_decision_seconds?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_feedback_analytics_autonomous_lead_id_fkey"
            columns: ["autonomous_lead_id"]
            isOneToOne: false
            referencedRelation: "autonomous_leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_feedback_analytics_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_feedback_analytics_company_sequence_id_fkey"
            columns: ["company_sequence_id"]
            isOneToOne: false
            referencedRelation: "company_sequences"
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
      newsletter_categories: {
        Row: {
          color: string | null
          created_at: string | null
          description: string | null
          id: string
          name: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          color?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      newsletter_sends: {
        Row: {
          clicked_at: string | null
          created_at: string | null
          error_message: string | null
          id: string
          newsletter_id: string
          opened_at: string | null
          sender_connection_id: string | null
          sent_at: string | null
          status: string | null
          subscriber_id: string
        }
        Insert: {
          clicked_at?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          newsletter_id: string
          opened_at?: string | null
          sender_connection_id?: string | null
          sent_at?: string | null
          status?: string | null
          subscriber_id: string
        }
        Update: {
          clicked_at?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          newsletter_id?: string
          opened_at?: string | null
          sender_connection_id?: string | null
          sent_at?: string | null
          status?: string | null
          subscriber_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "newsletter_sends_newsletter_id_fkey"
            columns: ["newsletter_id"]
            isOneToOne: false
            referencedRelation: "newsletters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "newsletter_sends_sender_connection_id_fkey"
            columns: ["sender_connection_id"]
            isOneToOne: false
            referencedRelation: "crm_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "newsletter_sends_subscriber_id_fkey"
            columns: ["subscriber_id"]
            isOneToOne: false
            referencedRelation: "newsletter_subscribers"
            referencedColumns: ["id"]
          },
        ]
      }
      newsletter_series: {
        Row: {
          ai_target_audience: string | null
          ai_tone: string | null
          ai_topic_template: string | null
          created_at: string | null
          duration_days: number
          header_image_urls: Json | null
          id: string
          name: string
          scheduled_send_options: Json | null
          send_time: string
          sender_profile_id: string | null
          start_date: string
          status: string
          template_styles: Json | null
          timezone: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          ai_target_audience?: string | null
          ai_tone?: string | null
          ai_topic_template?: string | null
          created_at?: string | null
          duration_days: number
          header_image_urls?: Json | null
          id?: string
          name: string
          scheduled_send_options?: Json | null
          send_time?: string
          sender_profile_id?: string | null
          start_date: string
          status?: string
          template_styles?: Json | null
          timezone?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          ai_target_audience?: string | null
          ai_tone?: string | null
          ai_topic_template?: string | null
          created_at?: string | null
          duration_days?: number
          header_image_urls?: Json | null
          id?: string
          name?: string
          scheduled_send_options?: Json | null
          send_time?: string
          sender_profile_id?: string | null
          start_date?: string
          status?: string
          template_styles?: Json | null
          timezone?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "newsletter_series_sender_profile_id_fkey"
            columns: ["sender_profile_id"]
            isOneToOne: false
            referencedRelation: "sender_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      newsletter_series_editions: {
        Row: {
          created_at: string | null
          edition_date: string
          id: string
          newsletter_id: string
          series_id: string
        }
        Insert: {
          created_at?: string | null
          edition_date: string
          id?: string
          newsletter_id: string
          series_id: string
        }
        Update: {
          created_at?: string | null
          edition_date?: string
          id?: string
          newsletter_id?: string
          series_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "newsletter_series_editions_newsletter_id_fkey"
            columns: ["newsletter_id"]
            isOneToOne: false
            referencedRelation: "newsletters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "newsletter_series_editions_series_id_fkey"
            columns: ["series_id"]
            isOneToOne: false
            referencedRelation: "newsletter_series"
            referencedColumns: ["id"]
          },
        ]
      }
      newsletter_subscriber_categories: {
        Row: {
          category_id: string
          subscriber_id: string
        }
        Insert: {
          category_id: string
          subscriber_id: string
        }
        Update: {
          category_id?: string
          subscriber_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "newsletter_subscriber_categories_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "newsletter_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "newsletter_subscriber_categories_subscriber_id_fkey"
            columns: ["subscriber_id"]
            isOneToOne: false
            referencedRelation: "newsletter_subscribers"
            referencedColumns: ["id"]
          },
        ]
      }
      newsletter_subscribers: {
        Row: {
          company: string | null
          created_at: string | null
          email: string
          first_name: string | null
          id: string
          industry: string | null
          last_name: string | null
          source: string | null
          status: string | null
          unsubscribe_token: string | null
          unsubscribed_at: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          company?: string | null
          created_at?: string | null
          email: string
          first_name?: string | null
          id?: string
          industry?: string | null
          last_name?: string | null
          source?: string | null
          status?: string | null
          unsubscribe_token?: string | null
          unsubscribed_at?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          company?: string | null
          created_at?: string | null
          email?: string
          first_name?: string | null
          id?: string
          industry?: string | null
          last_name?: string | null
          source?: string | null
          status?: string | null
          unsubscribe_token?: string | null
          unsubscribed_at?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      newsletter_target_categories: {
        Row: {
          category_id: string
          newsletter_id: string
        }
        Insert: {
          category_id: string
          newsletter_id: string
        }
        Update: {
          category_id?: string
          newsletter_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "newsletter_target_categories_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "newsletter_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "newsletter_target_categories_newsletter_id_fkey"
            columns: ["newsletter_id"]
            isOneToOne: false
            referencedRelation: "newsletters"
            referencedColumns: ["id"]
          },
        ]
      }
      newsletters: {
        Row: {
          batch_next_at: string | null
          batch_send: boolean
          batch_sent_count: number
          batch_size: number | null
          body_html: string | null
          body_json: Json | null
          created_at: string | null
          cta_text: string | null
          cta_url: string | null
          header_image_url: string | null
          id: string
          scheduled_at: string | null
          scheduled_send_options: Json | null
          sender_profile_id: string | null
          sent_at: string | null
          status: string | null
          subject: string
          template_style: string | null
          title: string
          total_clicked: number | null
          total_opened: number | null
          total_recipients: number | null
          total_sent: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          batch_next_at?: string | null
          batch_send?: boolean
          batch_sent_count?: number
          batch_size?: number | null
          body_html?: string | null
          body_json?: Json | null
          created_at?: string | null
          cta_text?: string | null
          cta_url?: string | null
          header_image_url?: string | null
          id?: string
          scheduled_at?: string | null
          scheduled_send_options?: Json | null
          sender_profile_id?: string | null
          sent_at?: string | null
          status?: string | null
          subject?: string
          template_style?: string | null
          title?: string
          total_clicked?: number | null
          total_opened?: number | null
          total_recipients?: number | null
          total_sent?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          batch_next_at?: string | null
          batch_send?: boolean
          batch_sent_count?: number
          batch_size?: number | null
          body_html?: string | null
          body_json?: Json | null
          created_at?: string | null
          cta_text?: string | null
          cta_url?: string | null
          header_image_url?: string | null
          id?: string
          scheduled_at?: string | null
          scheduled_send_options?: Json | null
          sender_profile_id?: string | null
          sent_at?: string | null
          status?: string | null
          subject?: string
          template_style?: string | null
          title?: string
          total_clicked?: number | null
          total_opened?: number | null
          total_recipients?: number | null
          total_sent?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "newsletters_sender_profile_id_fkey"
            columns: ["sender_profile_id"]
            isOneToOne: false
            referencedRelation: "sender_profiles"
            referencedColumns: ["id"]
          },
        ]
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
          tags: string[] | null
          title: string | null
          twitter_url: string | null
          updated_at: string
          user_id: string
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
          tags?: string[] | null
          title?: string | null
          twitter_url?: string | null
          updated_at?: string
          user_id: string
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
          tags?: string[] | null
          title?: string | null
          twitter_url?: string | null
          updated_at?: string
          user_id?: string
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
          phone: string | null
          updated_at: string | null
          website: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id: string
          job_title?: string | null
          phone?: string | null
          updated_at?: string | null
          website?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          job_title?: string | null
          phone?: string | null
          updated_at?: string | null
          website?: string | null
        }
        Relationships: []
      }
      recipient_group_members: {
        Row: {
          company: string | null
          created_at: string
          email: string
          first_name: string | null
          group_id: string
          id: string
          last_name: string | null
          person_id: string | null
        }
        Insert: {
          company?: string | null
          created_at?: string
          email: string
          first_name?: string | null
          group_id: string
          id?: string
          last_name?: string | null
          person_id?: string | null
        }
        Update: {
          company?: string | null
          created_at?: string
          email?: string
          first_name?: string | null
          group_id?: string
          id?: string
          last_name?: string | null
          person_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "recipient_group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "recipient_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipient_group_members_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
        ]
      }
      recipient_groups: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      research_chat_history: {
        Row: {
          messages: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          messages?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          messages?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      sender_profiles: {
        Row: {
          brand_color: string | null
          created_at: string
          display_name: string | null
          footer_image_url: string | null
          footer_logo_url: string | null
          footer_text: string | null
          id: string
          logo_url: string | null
          name: string
          sender_address: string | null
          sender_email: string | null
          sender_image_url: string | null
          sender_name: string | null
          sender_phone: string | null
          sender_title: string | null
          signature: string | null
          signature_closing: string | null
          signature_company: string | null
          signature_name: string | null
          signature_show_email: boolean
          signature_use_structured: boolean | null
          sort_order: number
          template_style: string
          updated_at: string
          user_id: string
          website_url: string | null
        }
        Insert: {
          brand_color?: string | null
          created_at?: string
          display_name?: string | null
          footer_image_url?: string | null
          footer_logo_url?: string | null
          footer_text?: string | null
          id?: string
          logo_url?: string | null
          name: string
          sender_address?: string | null
          sender_email?: string | null
          sender_image_url?: string | null
          sender_name?: string | null
          sender_phone?: string | null
          sender_title?: string | null
          signature?: string | null
          signature_closing?: string | null
          signature_company?: string | null
          signature_name?: string | null
          signature_show_email?: boolean
          signature_use_structured?: boolean | null
          sort_order?: number
          template_style?: string
          updated_at?: string
          user_id: string
          website_url?: string | null
        }
        Update: {
          brand_color?: string | null
          created_at?: string
          display_name?: string | null
          footer_image_url?: string | null
          footer_logo_url?: string | null
          footer_text?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          sender_address?: string | null
          sender_email?: string | null
          sender_image_url?: string | null
          sender_name?: string | null
          sender_phone?: string | null
          sender_title?: string | null
          signature?: string | null
          signature_closing?: string | null
          signature_company?: string | null
          signature_name?: string | null
          signature_show_email?: boolean
          signature_use_structured?: boolean | null
          sort_order?: number
          template_style?: string
          updated_at?: string
          user_id?: string
          website_url?: string | null
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
      get_campaign_recipient_status_counts: {
        Args: { p_campaign_id: string }
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
      update_discovery_learning: {
        Args: {
          p_action: string
          p_company_size: string
          p_geography: string
          p_industry: string
          p_user_id: string
        }
        Returns: undefined
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
