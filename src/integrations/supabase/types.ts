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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      attendance: {
        Row: {
          check_in: string | null
          check_out: string | null
          created_at: string
          date: string
          id: string
          notes: string | null
          staff_id: string
          status: Database["public"]["Enums"]["attendance_status"]
        }
        Insert: {
          check_in?: string | null
          check_out?: string | null
          created_at?: string
          date?: string
          id?: string
          notes?: string | null
          staff_id: string
          status?: Database["public"]["Enums"]["attendance_status"]
        }
        Update: {
          check_in?: string | null
          check_out?: string | null
          created_at?: string
          date?: string
          id?: string
          notes?: string | null
          staff_id?: string
          status?: Database["public"]["Enums"]["attendance_status"]
        }
        Relationships: [
          {
            foreignKeyName: "attendance_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          created_at: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      customers: {
        Row: {
          address: string | null
          created_at: string
          id: string
          monthly_income: number | null
          name: string
          nid: string | null
          nid_back_url: string | null
          nid_front_url: string | null
          occupation: string | null
          permanent_address: string | null
          phone: string | null
          photo_url: string | null
          present_address: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          id?: string
          monthly_income?: number | null
          name: string
          nid?: string | null
          nid_back_url?: string | null
          nid_front_url?: string | null
          occupation?: string | null
          permanent_address?: string | null
          phone?: string | null
          photo_url?: string | null
          present_address?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          id?: string
          monthly_income?: number | null
          name?: string
          nid?: string | null
          nid_back_url?: string | null
          nid_front_url?: string | null
          occupation?: string | null
          permanent_address?: string | null
          phone?: string | null
          photo_url?: string | null
          present_address?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      expense_categories: {
        Row: {
          created_at: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      expenses: {
        Row: {
          amount: number
          category_id: string | null
          created_at: string
          created_by: string | null
          expense_date: string
          id: string
          notes: string | null
          payment_method: string | null
          title: string
        }
        Insert: {
          amount: number
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          expense_date?: string
          id?: string
          notes?: string | null
          payment_method?: string | null
          title: string
        }
        Update: {
          amount?: number
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          expense_date?: string
          id?: string
          notes?: string | null
          payment_method?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "expenses_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "expense_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      guarantors: {
        Row: {
          address: string | null
          created_at: string
          customer_id: string | null
          id: string
          name: string
          nid: string | null
          nid_back_url: string | null
          nid_front_url: string | null
          phone: string | null
          photo_url: string | null
          relation: string | null
          sale_id: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          customer_id?: string | null
          id?: string
          name: string
          nid?: string | null
          nid_back_url?: string | null
          nid_front_url?: string | null
          phone?: string | null
          photo_url?: string | null
          relation?: string | null
          sale_id?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          customer_id?: string | null
          id?: string
          name?: string
          nid?: string | null
          nid_back_url?: string | null
          nid_front_url?: string | null
          phone?: string | null
          photo_url?: string | null
          relation?: string | null
          sale_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "guarantors_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      installment_payments: {
        Row: {
          amount: number
          id: string
          installment_id: string
          note: string | null
          paid_at: string
          received_by: string | null
        }
        Insert: {
          amount: number
          id?: string
          installment_id: string
          note?: string | null
          paid_at?: string
          received_by?: string | null
        }
        Update: {
          amount?: number
          id?: string
          installment_id?: string
          note?: string | null
          paid_at?: string
          received_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "installment_payments_installment_id_fkey"
            columns: ["installment_id"]
            isOneToOne: false
            referencedRelation: "installments"
            referencedColumns: ["id"]
          },
        ]
      }
      installments: {
        Row: {
          amount: number
          created_at: string
          due_date: string
          id: string
          installment_no: number
          paid_amount: number
          sale_id: string
          status: Database["public"]["Enums"]["installment_status"]
        }
        Insert: {
          amount: number
          created_at?: string
          due_date: string
          id?: string
          installment_no: number
          paid_amount?: number
          sale_id: string
          status?: Database["public"]["Enums"]["installment_status"]
        }
        Update: {
          amount?: number
          created_at?: string
          due_date?: string
          id?: string
          installment_no?: number
          paid_amount?: number
          sale_id?: string
          status?: Database["public"]["Enums"]["installment_status"]
        }
        Relationships: [
          {
            foreignKeyName: "installments_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          barcode: string | null
          category_id: string | null
          cost: number
          created_at: string
          id: string
          image_url: string | null
          is_active: boolean
          name: string
          price: number
          sku: string | null
          stock: number
          unit: string | null
          updated_at: string
        }
        Insert: {
          barcode?: string | null
          category_id?: string | null
          cost?: number
          created_at?: string
          id?: string
          image_url?: string | null
          is_active?: boolean
          name: string
          price?: number
          sku?: string | null
          stock?: number
          unit?: string | null
          updated_at?: string
        }
        Update: {
          barcode?: string | null
          category_id?: string | null
          cost?: number
          created_at?: string
          id?: string
          image_url?: string | null
          is_active?: boolean
          name?: string
          price?: number
          sku?: string | null
          stock?: number
          unit?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          full_name?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          full_name?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      purchase_items: {
        Row: {
          created_at: string
          id: string
          product_id: string
          product_name: string
          purchase_id: string
          qty: number
          subtotal: number
          unit_cost: number
        }
        Insert: {
          created_at?: string
          id?: string
          product_id: string
          product_name: string
          purchase_id: string
          qty: number
          subtotal: number
          unit_cost: number
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string
          product_name?: string
          purchase_id?: string
          qty?: number
          subtotal?: number
          unit_cost?: number
        }
        Relationships: [
          {
            foreignKeyName: "purchase_items_purchase_id_fkey"
            columns: ["purchase_id"]
            isOneToOne: false
            referencedRelation: "purchases"
            referencedColumns: ["id"]
          },
        ]
      }
      purchases: {
        Row: {
          bill_no: string
          created_at: string
          created_by: string | null
          discount: number
          due: number
          id: string
          notes: string | null
          paid: number
          subtotal: number
          supplier_id: string | null
          total: number
        }
        Insert: {
          bill_no?: string
          created_at?: string
          created_by?: string | null
          discount?: number
          due?: number
          id?: string
          notes?: string | null
          paid?: number
          subtotal?: number
          supplier_id?: string | null
          total?: number
        }
        Update: {
          bill_no?: string
          created_at?: string
          created_by?: string | null
          discount?: number
          due?: number
          id?: string
          notes?: string | null
          paid?: number
          subtotal?: number
          supplier_id?: string | null
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "purchases_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      sale_items: {
        Row: {
          created_at: string
          id: string
          product_id: string
          product_name: string
          qty: number
          sale_id: string
          subtotal: number
          unit_price: number
        }
        Insert: {
          created_at?: string
          id?: string
          product_id: string
          product_name: string
          qty: number
          sale_id: string
          subtotal: number
          unit_price: number
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string
          product_name?: string
          qty?: number
          sale_id?: string
          subtotal?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "sale_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_items_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      sales: {
        Row: {
          agreement_url: string | null
          created_at: string
          created_by: string | null
          customer_id: string | null
          discount: number
          down_payment: number
          due: number
          emi_amount: number | null
          guarantor_id: string | null
          id: string
          interest_rate: number
          invoice_no: string
          late_fee_per_day: number
          notes: string | null
          paid: number
          payment_type: Database["public"]["Enums"]["payment_type"]
          status: Database["public"]["Enums"]["sale_status"]
          subtotal: number
          tenure_months: number | null
          total: number
        }
        Insert: {
          agreement_url?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          discount?: number
          down_payment?: number
          due?: number
          emi_amount?: number | null
          guarantor_id?: string | null
          id?: string
          interest_rate?: number
          invoice_no?: string
          late_fee_per_day?: number
          notes?: string | null
          paid?: number
          payment_type?: Database["public"]["Enums"]["payment_type"]
          status?: Database["public"]["Enums"]["sale_status"]
          subtotal?: number
          tenure_months?: number | null
          total?: number
        }
        Update: {
          agreement_url?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          discount?: number
          down_payment?: number
          due?: number
          emi_amount?: number | null
          guarantor_id?: string | null
          id?: string
          interest_rate?: number
          invoice_no?: string
          late_fee_per_day?: number
          notes?: string | null
          paid?: number
          payment_type?: Database["public"]["Enums"]["payment_type"]
          status?: Database["public"]["Enums"]["sale_status"]
          subtotal?: number
          tenure_months?: number | null
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "sales_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_guarantor_id_fkey"
            columns: ["guarantor_id"]
            isOneToOne: false
            referencedRelation: "guarantors"
            referencedColumns: ["id"]
          },
        ]
      }
      staff: {
        Row: {
          address: string | null
          created_at: string
          id: string
          is_active: boolean
          joined_at: string | null
          name: string
          nid: string | null
          phone: string | null
          position: string | null
          salary: number
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          joined_at?: string | null
          name: string
          nid?: string | null
          phone?: string | null
          position?: string | null
          salary?: number
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          joined_at?: string | null
          name?: string
          nid?: string | null
          phone?: string | null
          position?: string | null
          salary?: number
          updated_at?: string
        }
        Relationships: []
      }
      stock_adjustments: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          product_id: string
          product_name: string
          qty: number
          reason: string | null
          type: Database["public"]["Enums"]["adjustment_type"]
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          product_id: string
          product_name: string
          qty: number
          reason?: string | null
          type: Database["public"]["Enums"]["adjustment_type"]
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          product_id?: string
          product_name?: string
          qty?: number
          reason?: string | null
          type?: Database["public"]["Enums"]["adjustment_type"]
        }
        Relationships: []
      }
      suppliers: {
        Row: {
          address: string | null
          contact_person: string | null
          created_at: string
          email: string | null
          id: string
          name: string
          opening_balance: number
          phone: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          contact_person?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name: string
          opening_balance?: number
          phone?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          contact_person?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          opening_balance?: number
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
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
    }
    Enums: {
      adjustment_type:
        | "damage"
        | "return"
        | "count"
        | "transfer_in"
        | "transfer_out"
      app_role: "admin" | "cashier" | "super_admin" | "staff"
      attendance_status: "present" | "absent" | "leave" | "half_day"
      installment_status: "pending" | "paid" | "overdue"
      payment_type: "cash" | "installment"
      sale_status: "completed" | "partial" | "cancelled"
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
      adjustment_type: [
        "damage",
        "return",
        "count",
        "transfer_in",
        "transfer_out",
      ],
      app_role: ["admin", "cashier", "super_admin", "staff"],
      attendance_status: ["present", "absent", "leave", "half_day"],
      installment_status: ["pending", "paid", "overdue"],
      payment_type: ["cash", "installment"],
      sale_status: ["completed", "partial", "cancelled"],
    },
  },
} as const
