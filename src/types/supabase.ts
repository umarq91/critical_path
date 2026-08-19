// Hand-authored to match `supabase/migrations/0001_profiles_roles.sql`, `0003_seasons.sql`,
// `0005_brands.sql`, `0006_tasks.sql`, `0007_tasks_tracking_and_timeline.sql`,
// `0008_key_stages.sql`, and `0009_departments.sql`.
// Regenerate after every migration: `supabase gen types typescript --linked > src/types/supabase.ts`

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string | null;
          avatar_url: string | null;
          role: Database["public"]["Enums"]["user_role"];
          department_id: string | null;
          google_group_id: string | null;
          status: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          full_name?: string | null;
          avatar_url?: string | null;
          role?: Database["public"]["Enums"]["user_role"];
          department_id?: string | null;
          google_group_id?: string | null;
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          full_name?: string | null;
          avatar_url?: string | null;
          role?: Database["public"]["Enums"]["user_role"];
          department_id?: string | null;
          google_group_id?: string | null;
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "profiles_department_id_fkey";
            columns: ["department_id"];
            isOneToOne: false;
            referencedRelation: "departments";
            referencedColumns: ["id"];
          },
        ];
      };
      seasons: {
        Row: {
          id: string;
          season_code: string;
          season_name: string;
          status: Database["public"]["Enums"]["season_status"];
          start_date: string;
          end_date: string;
          color: string;
          owner_id: string | null;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          season_code: string;
          season_name: string;
          status?: Database["public"]["Enums"]["season_status"];
          start_date: string;
          end_date: string;
          color?: string;
          owner_id?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          season_code?: string;
          season_name?: string;
          status?: Database["public"]["Enums"]["season_status"];
          start_date?: string;
          end_date?: string;
          color?: string;
          owner_id?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "seasons_owner_id_fkey";
            columns: ["owner_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      brands: {
        Row: {
          id: string;
          brand_code: string;
          brand_name: string;
          description: string | null;
          status: Database["public"]["Enums"]["brand_status"];
          color: string;
          season_id: string;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          brand_code: string;
          brand_name: string;
          description?: string | null;
          status?: Database["public"]["Enums"]["brand_status"];
          color?: string;
          season_id: string;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          brand_code?: string;
          brand_name?: string;
          description?: string | null;
          status?: Database["public"]["Enums"]["brand_status"];
          color?: string;
          season_id?: string;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "brands_season_id_fkey";
            columns: ["season_id"];
            isOneToOne: false;
            referencedRelation: "seasons";
            referencedColumns: ["id"];
          },
        ];
      };
      key_stages: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Relationships: [];
      };
      departments: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Relationships: [];
      };
      tasks: {
        Row: {
          id: string;
          task_name: string;
          season_id: string;
          brand_id: string;
          key_stage_id: string | null;
          gender: Database["public"]["Enums"]["task_gender"];
          due_date: string;
          start_date: string | null;
          end_date: string | null;
          assignee_id: string | null;
          status: Database["public"]["Enums"]["task_status"];
          notes: string | null;
          created_by: string | null;
          last_edited_by: string | null;
          deleted_by: string | null;
          is_locked: boolean;
          locked_by: string | null;
          locked_at: string | null;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          task_name: string;
          season_id: string;
          brand_id: string;
          key_stage_id?: string | null;
          gender: Database["public"]["Enums"]["task_gender"];
          due_date: string;
          start_date?: string | null;
          end_date?: string | null;
          assignee_id?: string | null;
          status?: Database["public"]["Enums"]["task_status"];
          notes?: string | null;
          created_by?: string | null;
          last_edited_by?: string | null;
          deleted_by?: string | null;
          is_locked?: boolean;
          locked_by?: string | null;
          locked_at?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          task_name?: string;
          season_id?: string;
          brand_id?: string;
          key_stage_id?: string | null;
          gender?: Database["public"]["Enums"]["task_gender"];
          due_date?: string;
          start_date?: string | null;
          end_date?: string | null;
          assignee_id?: string | null;
          status?: Database["public"]["Enums"]["task_status"];
          notes?: string | null;
          created_by?: string | null;
          last_edited_by?: string | null;
          deleted_by?: string | null;
          is_locked?: boolean;
          locked_by?: string | null;
          locked_at?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "tasks_season_id_fkey";
            columns: ["season_id"];
            isOneToOne: false;
            referencedRelation: "seasons";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "tasks_brand_id_fkey";
            columns: ["brand_id"];
            isOneToOne: false;
            referencedRelation: "brands";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "tasks_key_stage_id_fkey";
            columns: ["key_stage_id"];
            isOneToOne: false;
            referencedRelation: "key_stages";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "tasks_assignee_id_fkey";
            columns: ["assignee_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "tasks_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "tasks_last_edited_by_fkey";
            columns: ["last_edited_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "tasks_deleted_by_fkey";
            columns: ["deleted_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "tasks_locked_by_fkey";
            columns: ["locked_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: {
      current_user_role: {
        Args: Record<string, never>;
        Returns: Database["public"]["Enums"]["user_role"];
      };
      is_admin: {
        Args: Record<string, never>;
        Returns: boolean;
      };
    };
    Enums: {
      user_role: "admin" | "standard_user" | "viewer";
      season_status: "planning" | "upcoming" | "active" | "completed";
      brand_status: "active" | "inactive";
      task_gender: "men" | "women" | "unisex";
      task_status: "not_started" | "in_progress" | "completed" | "overdue";
    };
    CompositeTypes: Record<string, never>;
  };
};
