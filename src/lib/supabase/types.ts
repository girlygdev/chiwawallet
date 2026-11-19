
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "budget_periods": {
                  Row: {
                    "budget_id": string,"carried_in": number,"closed_at": string | null,"created_at": string,"end_date": string,"first_pay_received": boolean,"id": string,"leftover_choice": string | null,"pay_slot": string,"start_date": string,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "budget_id": string,"carried_in"?: number,"closed_at"?: string | null,"created_at"?: string,"end_date": string,"first_pay_received"?: boolean,"id"?: string,"leftover_choice"?: string | null,"pay_slot": string,"start_date": string,"updated_at"?: string,"user_id"?: string
                  }
                  Update: {
                    "budget_id"?: string,"carried_in"?: number,"closed_at"?: string | null,"created_at"?: string,"end_date"?: string,"first_pay_received"?: boolean,"id"?: string,"leftover_choice"?: string | null,"pay_slot"?: string,"start_date"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "budget_periods_budget_fkey"
      columns: ["budget_id","user_id"]
isOneToOne: false
      referencedRelation: "budgets"
      referencedColumns: ["id","user_id"]
    }
                  ]
                },"budgets": {
                  Row: {
                    "ask_on_payday": boolean,"budget_model": string,"carry_over": boolean,"created_at": string,"frequency": string,"id": string,"name": string,"needs_pct": number,"opening_balance": number | null,"pay_day_1": number | null,"pay_day_2": number | null,"pay_weekday": number | null,"savings_debt_pct": number,"updated_at": string,"user_id": string,"wants_pct": number
                  }
                  ComputedFields: never
                  Insert: {
                    "ask_on_payday"?: boolean,"budget_model"?: string,"carry_over"?: boolean,"created_at"?: string,"frequency": string,"id"?: string,"name": string,"needs_pct"?: number,"opening_balance"?: number | null,"pay_day_1"?: number | null,"pay_day_2"?: number | null,"pay_weekday"?: number | null,"savings_debt_pct"?: number,"updated_at"?: string,"user_id"?: string,"wants_pct"?: number
                  }
                  Update: {
                    "ask_on_payday"?: boolean,"budget_model"?: string,"carry_over"?: boolean,"created_at"?: string,"frequency"?: string,"id"?: string,"name"?: string,"needs_pct"?: number,"opening_balance"?: number | null,"pay_day_1"?: number | null,"pay_day_2"?: number | null,"pay_weekday"?: number | null,"savings_debt_pct"?: number,"updated_at"?: string,"user_id"?: string,"wants_pct"?: number
                  }
                  Relationships: [
                    
                  ]
                },"income_sources": {
                  Row: {
                    "amount": number,"amount_varies": boolean,"budget_id": string,"created_at": string,"end_date": string | null,"id": string,"name": string,"pay_slot": string,"start_date": string,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "amount": number,"amount_varies"?: boolean,"budget_id": string,"created_at"?: string,"end_date"?: string | null,"id"?: string,"name": string,"pay_slot": string,"start_date": string,"updated_at"?: string,"user_id"?: string
                  }
                  Update: {
                    "amount"?: number,"amount_varies"?: boolean,"budget_id"?: string,"created_at"?: string,"end_date"?: string | null,"id"?: string,"name"?: string,"pay_slot"?: string,"start_date"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "income_sources_budget_fkey"
      columns: ["budget_id","user_id"]
isOneToOne: false
      referencedRelation: "budgets"
      referencedColumns: ["id","user_id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "bill_reminders": boolean,"consent_at": string | null,"consent_version": string | null,"created_at": string,"display_name": string | null,"id": string,"is_demo": boolean,"mid_period_checkin": boolean,"payday_summary": boolean,"theme": string,"updated_at": string,"user_id": string,"week_start": string
                  }
                  ComputedFields: never
                  Insert: {
                    "bill_reminders"?: boolean,"consent_at"?: string | null,"consent_version"?: string | null,"created_at"?: string,"display_name"?: string | null,"id"?: string,"is_demo"?: boolean,"mid_period_checkin"?: boolean,"payday_summary"?: boolean,"theme"?: string,"updated_at"?: string,"user_id": string,"week_start"?: string
                  }
                  Update: {
                    "bill_reminders"?: boolean,"consent_at"?: string | null,"consent_version"?: string | null,"created_at"?: string,"display_name"?: string | null,"id"?: string,"is_demo"?: boolean,"mid_period_checkin"?: boolean,"payday_summary"?: boolean,"theme"?: string,"updated_at"?: string,"user_id"?: string,"week_start"?: string
                  }
                  Relationships: [
                    
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "record_consent":
{ Args: { "name": string,"version": string }; Returns: undefined
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

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            
          }
        }
} as const
