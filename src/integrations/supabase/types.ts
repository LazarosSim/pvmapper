export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
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
          created_at: string
          expected_barcodes: number | null
          id: string
          name: string
          user_id: string
          validate_barcode_length: boolean | null
        }
        Insert: {
          created_at?: string
          expected_barcodes?: number | null
          id?: string
          name: string
          user_id: string
          validate_barcode_length?: boolean | null
        }
        Update: {
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
      shift_order: {
        Args:
          | { index: number; id: string }
          | { p_row_id: string; p_index: number }
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DefaultSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
