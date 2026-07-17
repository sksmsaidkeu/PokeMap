export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      catch_attempts: {
        Row: {
          attempt_no: number
          catch_rate_used: number
          created_at: string
          id: number
          session_id: string
          success: boolean
        }
        Insert: {
          attempt_no: number
          catch_rate_used: number
          created_at?: string
          id?: number
          session_id: string
          success: boolean
        }
        Update: {
          attempt_no?: number
          catch_rate_used?: number
          created_at?: string
          id?: number
          session_id?: string
          success?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "catch_attempts_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "encounter_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      cities: {
        Row: {
          centroid: unknown
          id: number
          is_legendary_site: boolean
          living_area_id: number
          name: string
        }
        Insert: {
          centroid: unknown
          id: number
          is_legendary_site?: boolean
          living_area_id: number
          name: string
        }
        Update: {
          centroid?: unknown
          id?: number
          is_legendary_site?: boolean
          living_area_id?: number
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "cities_living_area_id_fkey"
            columns: ["living_area_id"]
            isOneToOne: false
            referencedRelation: "living_areas"
            referencedColumns: ["id"]
          },
        ]
      }
      city_connections: {
        Row: {
          city_a_id: number
          city_b_id: number
        }
        Insert: {
          city_a_id: number
          city_b_id: number
        }
        Update: {
          city_a_id?: number
          city_b_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "city_connections_city_a_id_fkey"
            columns: ["city_a_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "city_connections_city_a_id_fkey"
            columns: ["city_a_id"]
            isOneToOne: false
            referencedRelation: "v_region_pokedex_status"
            referencedColumns: ["city_id"]
          },
          {
            foreignKeyName: "city_connections_city_b_id_fkey"
            columns: ["city_b_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "city_connections_city_b_id_fkey"
            columns: ["city_b_id"]
            isOneToOne: false
            referencedRelation: "v_region_pokedex_status"
            referencedColumns: ["city_id"]
          },
        ]
      }
      encounter_sessions: {
        Row: {
          attempts_used: number
          city_id: number
          created_at: string
          dex_no: number
          expires_at: string
          id: string
          is_legendary: boolean
          spawn_rate_used: number | null
          status: string
          user_id: string
        }
        Insert: {
          attempts_used?: number
          city_id: number
          created_at?: string
          dex_no: number
          expires_at?: string
          id?: string
          is_legendary?: boolean
          spawn_rate_used?: number | null
          status?: string
          user_id: string
        }
        Update: {
          attempts_used?: number
          city_id?: number
          created_at?: string
          dex_no?: number
          expires_at?: string
          id?: string
          is_legendary?: boolean
          spawn_rate_used?: number | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "encounter_sessions_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "encounter_sessions_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "v_region_pokedex_status"
            referencedColumns: ["city_id"]
          },
          {
            foreignKeyName: "encounter_sessions_dex_no_fkey"
            columns: ["dex_no"]
            isOneToOne: false
            referencedRelation: "pokemon_species"
            referencedColumns: ["dex_no"]
          },
          {
            foreignKeyName: "encounter_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "encounter_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_user_province_progress"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "encounter_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_user_tier"
            referencedColumns: ["user_id"]
          },
        ]
      }
      legendary_cooldowns: {
        Row: {
          next_available_at: string
          province_id: number
          user_id: string
        }
        Insert: {
          next_available_at: string
          province_id: number
          user_id: string
        }
        Update: {
          next_available_at?: string
          province_id?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "legendary_cooldowns_province_id_fkey"
            columns: ["province_id"]
            isOneToOne: false
            referencedRelation: "provinces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "legendary_cooldowns_province_id_fkey"
            columns: ["province_id"]
            isOneToOne: false
            referencedRelation: "v_user_province_progress"
            referencedColumns: ["province_id"]
          },
          {
            foreignKeyName: "legendary_cooldowns_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "legendary_cooldowns_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_user_province_progress"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "legendary_cooldowns_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_user_tier"
            referencedColumns: ["user_id"]
          },
        ]
      }
      legendary_pity: {
        Row: {
          fail_visits: number
          province_id: number
          user_id: string
        }
        Insert: {
          fail_visits?: number
          province_id: number
          user_id: string
        }
        Update: {
          fail_visits?: number
          province_id?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "legendary_pity_province_id_fkey"
            columns: ["province_id"]
            isOneToOne: false
            referencedRelation: "provinces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "legendary_pity_province_id_fkey"
            columns: ["province_id"]
            isOneToOne: false
            referencedRelation: "v_user_province_progress"
            referencedColumns: ["province_id"]
          },
          {
            foreignKeyName: "legendary_pity_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "legendary_pity_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_user_province_progress"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "legendary_pity_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_user_tier"
            referencedColumns: ["user_id"]
          },
        ]
      }
      living_areas: {
        Row: {
          color: string
          id: number
          is_endgame_area: boolean
          name: string
          province_id: number
          region_id_override: number | null
        }
        Insert: {
          color: string
          id: number
          is_endgame_area?: boolean
          name: string
          province_id: number
          region_id_override?: number | null
        }
        Update: {
          color?: string
          id?: number
          is_endgame_area?: boolean
          name?: string
          province_id?: number
          region_id_override?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "living_areas_province_id_fkey"
            columns: ["province_id"]
            isOneToOne: false
            referencedRelation: "provinces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "living_areas_province_id_fkey"
            columns: ["province_id"]
            isOneToOne: false
            referencedRelation: "v_user_province_progress"
            referencedColumns: ["province_id"]
          },
          {
            foreignKeyName: "living_areas_region_id_override_fkey"
            columns: ["region_id_override"]
            isOneToOne: false
            referencedRelation: "pokemon_regions"
            referencedColumns: ["id"]
          },
        ]
      }
      pokemon_regions: {
        Row: {
          id: number
          name: string
        }
        Insert: {
          id: number
          name: string
        }
        Update: {
          id?: number
          name?: string
        }
        Relationships: []
      }
      pokemon_species: {
        Row: {
          bst: number
          dex_no: number
          flavor_text: string | null
          height_dm: number | null
          name_en: string
          name_kr: string
          primary_ability: string | null
          type1: string
          type2: string | null
          weight_hg: number | null
        }
        Insert: {
          bst: number
          dex_no: number
          flavor_text?: string | null
          height_dm?: number | null
          name_en: string
          name_kr: string
          primary_ability?: string | null
          type1: string
          type2?: string | null
          weight_hg?: number | null
        }
        Update: {
          bst?: number
          dex_no?: number
          flavor_text?: string | null
          height_dm?: number | null
          name_en?: string
          name_kr?: string
          primary_ability?: string | null
          type1?: string
          type2?: string | null
          weight_hg?: number | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          id: string
          nickname: string
        }
        Insert: {
          created_at?: string
          id: string
          nickname: string
        }
        Update: {
          created_at?: string
          id?: string
          nickname?: string
        }
        Relationships: []
      }
      provinces: {
        Row: {
          id: number
          is_island_endgame: boolean
          legendary_dex_no: number | null
          name: string
          region_id: number
        }
        Insert: {
          id: number
          is_island_endgame?: boolean
          legendary_dex_no?: number | null
          name: string
          region_id: number
        }
        Update: {
          id?: number
          is_island_endgame?: boolean
          legendary_dex_no?: number | null
          name?: string
          region_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "provinces_legendary_dex_no_fkey"
            columns: ["legendary_dex_no"]
            isOneToOne: false
            referencedRelation: "pokemon_species"
            referencedColumns: ["dex_no"]
          },
          {
            foreignKeyName: "provinces_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "pokemon_regions"
            referencedColumns: ["id"]
          },
        ]
      }
      region_spawn_pool: {
        Row: {
          category: string
          dex_no: number
          id: number
          is_legendary: boolean
          living_area_id: number
        }
        Insert: {
          category: string
          dex_no: number
          id?: number
          is_legendary?: boolean
          living_area_id: number
        }
        Update: {
          category?: string
          dex_no?: number
          id?: number
          is_legendary?: boolean
          living_area_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "region_spawn_pool_dex_no_fkey"
            columns: ["dex_no"]
            isOneToOne: false
            referencedRelation: "pokemon_species"
            referencedColumns: ["dex_no"]
          },
          {
            foreignKeyName: "region_spawn_pool_living_area_id_fkey"
            columns: ["living_area_id"]
            isOneToOne: false
            referencedRelation: "living_areas"
            referencedColumns: ["id"]
          },
        ]
      }
      user_pokedex: {
        Row: {
          catch_count: number
          dex_no: number
          first_caught_at: string
          first_caught_city_id: number
          user_id: string
        }
        Insert: {
          catch_count?: number
          dex_no: number
          first_caught_at?: string
          first_caught_city_id: number
          user_id: string
        }
        Update: {
          catch_count?: number
          dex_no?: number
          first_caught_at?: string
          first_caught_city_id?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_pokedex_dex_no_fkey"
            columns: ["dex_no"]
            isOneToOne: false
            referencedRelation: "pokemon_species"
            referencedColumns: ["dex_no"]
          },
          {
            foreignKeyName: "user_pokedex_first_caught_city_id_fkey"
            columns: ["first_caught_city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_pokedex_first_caught_city_id_fkey"
            columns: ["first_caught_city_id"]
            isOneToOne: false
            referencedRelation: "v_region_pokedex_status"
            referencedColumns: ["city_id"]
          },
          {
            foreignKeyName: "user_pokedex_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_pokedex_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_user_province_progress"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "user_pokedex_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_user_tier"
            referencedColumns: ["user_id"]
          },
        ]
      }
      user_progress: {
        Row: {
          current_city_id: number
          updated_at: string
          user_id: string
        }
        Insert: {
          current_city_id: number
          updated_at?: string
          user_id: string
        }
        Update: {
          current_city_id?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_progress_current_city_id_fkey"
            columns: ["current_city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_progress_current_city_id_fkey"
            columns: ["current_city_id"]
            isOneToOne: false
            referencedRelation: "v_region_pokedex_status"
            referencedColumns: ["city_id"]
          },
          {
            foreignKeyName: "user_progress_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_progress_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "v_user_province_progress"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "user_progress_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "v_user_tier"
            referencedColumns: ["user_id"]
          },
        ]
      }
      user_province_unlocks: {
        Row: {
          province_id: number
          unlocked_at: string
          user_id: string
        }
        Insert: {
          province_id: number
          unlocked_at?: string
          user_id: string
        }
        Update: {
          province_id?: number
          unlocked_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_province_unlocks_province_id_fkey"
            columns: ["province_id"]
            isOneToOne: false
            referencedRelation: "provinces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_province_unlocks_province_id_fkey"
            columns: ["province_id"]
            isOneToOne: false
            referencedRelation: "v_user_province_progress"
            referencedColumns: ["province_id"]
          },
          {
            foreignKeyName: "user_province_unlocks_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_province_unlocks_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_user_province_progress"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "user_province_unlocks_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_user_tier"
            referencedColumns: ["user_id"]
          },
        ]
      }
    }
    Views: {
      v_city_neighbors: {
        Row: {
          city_id: number | null
          neighbor_id: number | null
        }
        Relationships: []
      }
      v_region_pokedex_status: {
        Row: {
          catch_count: number | null
          category: string | null
          caught: boolean | null
          city_id: number | null
          dex_no: number | null
          is_legendary: boolean | null
          living_area_id: number | null
        }
        Relationships: [
          {
            foreignKeyName: "region_spawn_pool_dex_no_fkey"
            columns: ["dex_no"]
            isOneToOne: false
            referencedRelation: "pokemon_species"
            referencedColumns: ["dex_no"]
          },
          {
            foreignKeyName: "region_spawn_pool_living_area_id_fkey"
            columns: ["living_area_id"]
            isOneToOne: false
            referencedRelation: "living_areas"
            referencedColumns: ["id"]
          },
        ]
      }
      v_user_province_progress: {
        Row: {
          caught_count: number | null
          pct: number | null
          province_id: number | null
          total_count: number | null
          user_id: string | null
        }
        Relationships: []
      }
      v_user_tier: {
        Row: {
          tier: string | null
          user_id: string | null
        }
        Insert: {
          tier?: never
          user_id?: string | null
        }
        Update: {
          tier?: never
          user_id?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      bootstrap_user: {
        Args: {
          p_city_id?: number
          p_lat: number
          p_lng: number
          p_nickname: string
          p_user_id: string
        }
        Returns: {
          city_id: number
          city_name: string
          fallback: boolean
        }[]
      }
      calc_catch_rate: { Args: { bst: number }; Returns: number }
      calc_catch_rate_tier: { Args: { rate: number }; Returns: string }
      calc_legendary_catch_rate: {
        Args: { fail_visits: number; p_province_id: number; p_user_id: string }
        Returns: number
      }
      calc_session_catch_tier: {
        Args: { p_session_id: string }
        Returns: string
      }
      calc_spawn_rate: { Args: { bst: number }; Returns: number }
      calc_user_tier: { Args: { p_user_id: string }; Returns: string }
      check_endgame_unlock: { Args: { p_user_id: string }; Returns: boolean }
      fn_bootstrap_location: {
        Args: {
          p_city_id?: number
          p_lat: number
          p_lng: number
          p_nickname: string
          p_user_id: string
        }
        Returns: Json
      }
      fn_catch_attempt: {
        Args: { p_session_id: string; p_user_id: string }
        Returns: Json
      }
      fn_move_city: {
        Args: { p_to_city_id: number; p_user_id: string }
        Returns: Json
      }
      fn_session_sweep: { Args: never; Returns: Json }
    }
    Enums: {
      [_ in never]: never
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const

