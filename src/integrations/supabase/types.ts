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
      barcodes: {
        Row: {
          code: string
          id: string
          latitude: number | null
          longitude: number | null
          order_in_row: number | null
          row_id: string
          timestamp: string
          user_id: string
        }
        Insert: {
          code: string
          id?: string
          latitude?: number | null
          longitude?: number | null
          order_in_row?: number | null
          row_id: string
          timestamp?: string
          user_id: string
        }
        Update: {
          code?: string
          id?: string
          latitude?: number | null
          longitude?: number | null
          order_in_row?: number | null
          row_id?: string
          timestamp?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "barcodes_row_id_fkey"
            columns: ["row_id"]
            isOneToOne: false
            referencedRelation: "rows"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_scans: {
        Row: {
          count: number
          date: string
          id: string
          user_id: string
        }
        Insert: {
          count?: number
          date?: string
          id?: string
          user_id: string
        }
        Update: {
          count?: number
          date?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      parks: {
        Row: {
          archived: boolean | null
          archived_at: string | null
          created_at: string
          expected_barcodes: number | null
          id: string
          name: string
          user_id: string
          validate_barcode_length: boolean | null
        }
        Insert: {
          archived?: boolean | null
          archived_at?: string | null
          created_at?: string
          expected_barcodes?: number | null
          id?: string
          name: string
          user_id: string
          validate_barcode_length?: boolean | null
        }
        Update: {
          archived?: boolean | null
          archived_at?: string | null
          created_at?: string
          expected_barcodes?: number | null
          id?: string
          name?: string
          user_id?: string
          validate_barcode_length?: boolean | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          id: string
          role: string
          user_total_scans: number | null
          username: string
        }
        Insert: {
          created_at?: string
          id: string
          role?: string
          user_total_scans?: number | null
          username: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: string
          user_total_scans?: number | null
          username?: string
        }
        Relationships: []
      }
      rows: {
        Row: {
          created_at: string
          current_barcodes: number | null
          expected_barcodes: number | null
          id: string
          name: string
          park_id: string
        }
        Insert: {
          created_at?: string
          current_barcodes?: number | null
          expected_barcodes?: number | null
          id?: string
          name: string
          park_id: string
        }
        Update: {
          created_at?: string
          current_barcodes?: number | null
          expected_barcodes?: number | null
          id?: string
          name?: string
          park_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rows_park_id_fkey"
            columns: ["park_id"]
            isOneToOne: false
            referencedRelation: "park_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rows_park_id_fkey"
            columns: ["park_id"]
            isOneToOne: false
            referencedRelation: "parks"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      park_stats: {
        Row: {
          archived: boolean | null
          archived_at: string | null
          created_at: string | null
          created_by: string | null
          current_barcodes: number | null
          expected_barcodes: number | null
          id: string | null
          name: string | null
          validate_barcode_length: boolean | null
        }
        Relationships: []
      }
      user_stats: {
        Row: {
          average_daily_scans: number | null
          daily_scans: number | null
          days_active: number | null
          total_scans: number | null
          username: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      get_email_by_username: {
        Args: { p_username: string }
        Returns: {
          email: string
        }[]
      }
      shift_order:
        | { Args: { id: string; index: number }; Returns: undefined }
        | { Args: { p_index: number; p_row_id: string }; Returns: number }
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
  public: {
    Enums: {},
  },
} as const
