// Hand-authored to match `supabase/migrations/0001_profiles_roles.sql`, `0003_seasons.sql`,
// and `0005_brands.sql`.
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
          department: string | null;
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
          department?: string | null;
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
          department?: string | null;
          google_group_id?: string | null;
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
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
    };
    CompositeTypes: Record<string, never>;
  };
};
