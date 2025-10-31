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
          geography: string | null
          headquarters: string | null
          id: string
          industry: string | null
          langfuse_trace_id: string | null
          linkedin_url: string | null
          name: string
          recent_news: string | null
          size: string | null
          status: string | null
          tech_stack: string[] | null
          updated_at: string | null
          website: string | null
        }
        Insert: {
          ceo_name?: string | null
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
          geography?: string | null
          headquarters?: string | null
          id?: string
          industry?: string | null
          langfuse_trace_id?: string | null
          linkedin_url?: string | null
          name: string
          recent_news?: string | null
          size?: string | null
          status?: string | null
          tech_stack?: string[] | null
          updated_at?: string | null
          website?: string | null
        }
        Update: {
          ceo_name?: string | null
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
          geography?: string | null
          headquarters?: string | null
          id?: string
          industry?: string | null
          langfuse_trace_id?: string | null
          linkedin_url?: string | null
          name?: string
          recent_news?: string | null
          size?: string | null
          status?: string | null
          tech_stack?: string[] | null
          updated_at?: string | null
          website?: string | null
        }
        Relationships: []
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
          id: string
          stage: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          amount?: number | null
          close_date?: string | null
          company_id?: string | null
          created_at?: string | null
          id?: string
          stage?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          amount?: number | null
          close_date?: string | null
          company_id?: string | null
          created_at?: string | null
          id?: string
          stage?: string | null
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
      email_sequences: {
        Row: {
          created_at: string | null
          created_by: string | null
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
          created_at?: string | null
          created_by?: string | null
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
          created_at?: string | null
          created_by?: string | null
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
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id: string
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string | null
        }
        Relationships: []
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
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
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
