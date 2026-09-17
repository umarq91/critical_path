// Generated via `supabase gen types typescript --linked > src/types/supabase.ts`. Do not hand-edit.
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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      // Hand-added (0025_api_keys.sql) — no linked Supabase CLI in this environment to
      // regenerate from. Re-run `supabase gen types typescript --linked` once the migration is
      // applied and replace this block with the real output.
      api_keys: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          key_hash: string
          key_prefix: string
          last_used_at: string | null
          name: string
          revoked_at: string | null
          revoked_by: string | null
          status: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          key_hash: string
          key_prefix: string
          last_used_at?: string | null
          name: string
          revoked_at?: string | null
          revoked_by?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          key_hash?: string
          key_prefix?: string
          last_used_at?: string | null
          name?: string
          revoked_at?: string | null
          revoked_by?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "api_keys_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "api_keys_revoked_by_fkey"
            columns: ["revoked_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          actor_email: string | null
          actor_id: string | null
          changes: Json
          created_at: string
          entity_id: string | null
          entity_label: string | null
          entity_type: string
          id: string
        }
        Insert: {
          action: string
          actor_email?: string | null
          actor_id?: string | null
          changes?: Json
          created_at?: string
          entity_id?: string | null
          entity_label?: string | null
          entity_type: string
          id?: string
        }
        Update: {
          action?: string
          actor_email?: string | null
          actor_id?: string | null
          changes?: Json
          created_at?: string
          entity_id?: string | null
          entity_label?: string | null
          entity_type?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_seasons: {
        Row: {
          brand_id: string
          created_at: string
          id: string
          season_id: string
        }
        Insert: {
          brand_id: string
          created_at?: string
          id?: string
          season_id: string
        }
        Update: {
          brand_id?: string
          created_at?: string
          id?: string
          season_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "brand_seasons_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brand_seasons_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      brands: {
        Row: {
          brand_code: string
          brand_name: string
          color: string
          created_at: string
          deleted_at: string | null
          description: string | null
          id: string
          status: Database["public"]["Enums"]["brand_status"]
          updated_at: string
        }
        Insert: {
          brand_code: string
          brand_name: string
          color?: string
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          id?: string
          status?: Database["public"]["Enums"]["brand_status"]
          updated_at?: string
        }
        Update: {
          brand_code?: string
          brand_name?: string
          color?: string
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          id?: string
          status?: Database["public"]["Enums"]["brand_status"]
          updated_at?: string
        }
        Relationships: []
      }
      departments: {
        Row: {
          contact_email: string | null
          created_at: string
          deleted_at: string | null
          description: string | null
          id: string
          is_external: boolean
          name: string
          updated_at: string
        }
        Insert: {
          contact_email?: string | null
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          id?: string
          is_external?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          contact_email?: string | null
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          id?: string
          is_external?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      external_links: {
        Row: {
          created_at: string
          deleted_at: string | null
          description: string | null
          id: string
          title: string
          updated_at: string
          url: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          id?: string
          title: string
          updated_at?: string
          url: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          id?: string
          title?: string
          updated_at?: string
          url?: string
        }
        Relationships: []
      }
      google_oauth_tokens: {
        Row: {
          access_token: string
          created_at: string
          expires_at: string
          id: string
          profile_id: string
          refresh_token: string | null
          scope: string | null
          updated_at: string
        }
        Insert: {
          access_token: string
          created_at?: string
          expires_at: string
          id?: string
          profile_id: string
          refresh_token?: string | null
          scope?: string | null
          updated_at?: string
        }
        Update: {
          access_token?: string
          created_at?: string
          expires_at?: string
          id?: string
          profile_id?: string
          refresh_token?: string | null
          scope?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "google_oauth_tokens_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      key_stages: {
        Row: {
          created_at: string
          deleted_at: string | null
          description: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      notifications_log: {
        Row: {
          id: string
          rule_id: string
          task_id: string
          offset_days: number
          sent_at: string
        }
        Insert: {
          id?: string
          rule_id: string
          task_id: string
          offset_days: number
          sent_at?: string
        }
        Update: {
          id?: string
          rule_id?: string
          task_id?: string
          offset_days?: number
          sent_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_log_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "reminder_rules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_log_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          department_id: string | null
          email: string
          full_name: string | null
          google_group_id: string | null
          id: string
          role: Database["public"]["Enums"]["user_role"]
          status: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          department_id?: string | null
          email: string
          full_name?: string | null
          google_group_id?: string | null
          id: string
          role?: Database["public"]["Enums"]["user_role"]
          status?: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          department_id?: string | null
          email?: string
          full_name?: string | null
          google_group_id?: string | null
          id?: string
          role?: Database["public"]["Enums"]["user_role"]
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      reminder_rule_tasks: {
        Row: {
          id: string
          rule_id: string
          task_id: string
          created_at: string
        }
        Insert: {
          id?: string
          rule_id: string
          task_id: string
          created_at?: string
        }
        Update: {
          id?: string
          rule_id?: string
          task_id?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reminder_rule_tasks_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "reminder_rules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reminder_rule_tasks_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      reminder_rules: {
        Row: {
          id: string
          profile_id: string
          offset_days: number[]
          notify_hour: number
          is_enabled: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          profile_id: string
          offset_days?: number[]
          notify_hour?: number
          is_enabled?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          profile_id?: string
          offset_days?: number[]
          notify_hour?: number
          is_enabled?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reminder_rules_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      seasons: {
        Row: {
          color: string
          created_at: string
          deleted_at: string | null
          end_date: string
          id: string
          owner_id: string | null
          season_code: string
          season_name: string
          start_date: string
          status: Database["public"]["Enums"]["season_status"]
          updated_at: string
        }
        Insert: {
          color?: string
          created_at?: string
          deleted_at?: string | null
          end_date: string
          id?: string
          owner_id?: string | null
          season_code: string
          season_name: string
          start_date: string
          status?: Database["public"]["Enums"]["season_status"]
          updated_at?: string
        }
        Update: {
          color?: string
          created_at?: string
          deleted_at?: string | null
          end_date?: string
          id?: string
          owner_id?: string | null
          season_code?: string
          season_name?: string
          start_date?: string
          status?: Database["public"]["Enums"]["season_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "seasons_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      task_participants: {
        Row: {
          created_at: string
          department_id: string | null
          id: string
          profile_id: string | null
          role: Database["public"]["Enums"]["task_participant_role"]
          task_id: string
        }
        Insert: {
          created_at?: string
          department_id?: string | null
          id?: string
          profile_id?: string | null
          role: Database["public"]["Enums"]["task_participant_role"]
          task_id: string
        }
        Update: {
          created_at?: string
          department_id?: string | null
          id?: string
          profile_id?: string | null
          role?: Database["public"]["Enums"]["task_participant_role"]
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_participants_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_participants_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_participants_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_people: {
        Row: {
          created_at: string
          id: string
          profile_id: string
          task_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          profile_id: string
          task_id: string
        }
        Update: {
          created_at?: string
          id?: string
          profile_id?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_people_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_people_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          assignee_id: string | null
          brand_id: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          dpsp_category: Database["public"]["Enums"]["task_dpsp_category"] | null
          due_date: string | null
          end_date: string | null
          gender: Database["public"]["Enums"]["task_gender"]
          google_calendar_owner_id: string | null
          google_event_id: string | null
          google_synced_at: string | null
          id: string
          is_locked: boolean
          key_stage_id: string | null
          last_edited_by: string | null
          locked_at: string | null
          locked_by: string | null
          notes: string | null
          priority: Database["public"]["Enums"]["task_priority"]
          season_id: string
          start_date: string | null
          status: Database["public"]["Enums"]["task_status"]
          task_name: string
          updated_at: string
        }
        Insert: {
          assignee_id?: string | null
          brand_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          dpsp_category?: Database["public"]["Enums"]["task_dpsp_category"] | null
          due_date?: string | null
          end_date?: string | null
          gender: Database["public"]["Enums"]["task_gender"]
          google_calendar_owner_id?: string | null
          google_event_id?: string | null
          google_synced_at?: string | null
          id?: string
          is_locked?: boolean
          key_stage_id?: string | null
          last_edited_by?: string | null
          locked_at?: string | null
          locked_by?: string | null
          notes?: string | null
          priority?: Database["public"]["Enums"]["task_priority"]
          season_id: string
          start_date?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          task_name: string
          updated_at?: string
        }
        Update: {
          assignee_id?: string | null
          brand_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          dpsp_category?: Database["public"]["Enums"]["task_dpsp_category"] | null
          due_date?: string | null
          end_date?: string | null
          gender?: Database["public"]["Enums"]["task_gender"]
          google_calendar_owner_id?: string | null
          google_event_id?: string | null
          google_synced_at?: string | null
          id?: string
          is_locked?: boolean
          key_stage_id?: string | null
          last_edited_by?: string | null
          locked_at?: string | null
          locked_by?: string | null
          notes?: string | null
          priority?: Database["public"]["Enums"]["task_priority"]
          season_id?: string
          start_date?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          task_name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_google_calendar_owner_id_fkey"
            columns: ["google_calendar_owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_key_stage_id_fkey"
            columns: ["key_stage_id"]
            isOneToOne: false
            referencedRelation: "key_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_last_edited_by_fkey"
            columns: ["last_edited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_locked_by_fkey"
            columns: ["locked_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      task_participant_profiles: {
        Row: {
          profile_id: string | null
          role: Database["public"]["Enums"]["task_participant_role"] | null
          task_id: string | null
          via: string | null
        }
        Relationships: [
          {
            foreignKeyName: "task_participants_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_participants_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      current_user_role: {
        Args: never
        Returns: Database["public"]["Enums"]["user_role"]
      }
      is_active_user: { Args: never; Returns: boolean }
      is_admin: { Args: never; Returns: boolean }
      is_external_user: { Args: never; Returns: boolean }
      profile_shares_task_with_current_user: {
        Args: { p_profile_id: string }
        Returns: boolean
      }
      task_involves_current_user: {
        Args: { p_task_id: string }
        Returns: boolean
      }
    }
    Enums: {
      brand_status: "active" | "inactive"
      season_status: "planning" | "upcoming" | "active" | "completed"
      task_dpsp_category: "demand" | "product" | "sales" | "profit"
      task_gender: "guys" | "girls" | "unisex"
      task_participant_role: "owner" | "involved"
      task_priority: "high" | "med" | "low"
      task_status: "not_started" | "in_progress" | "completed" | "overdue"
      user_role: "admin" | "standard_user" | "viewer" | "external"
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
      brand_status: ["active", "inactive"],
      season_status: ["planning", "upcoming", "active", "completed"],
      task_dpsp_category: ["demand", "product", "sales", "profit"],
      task_gender: ["guys", "girls", "unisex"],
      task_priority: ["high", "med", "low"],
      task_status: ["not_started", "in_progress", "completed", "overdue"],
      user_role: ["admin", "standard_user", "viewer", "external"],
    },
  },
} as const
