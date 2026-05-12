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
      asset_events: {
        Row: {
          asset_id: string
          company_id: string
          created_at: string | null
          description: string | null
          event_date: string
          event_type: string
          id: string
          new_values: Json | null
          old_values: Json | null
          user_id: string
        }
        Insert: {
          asset_id: string
          company_id: string
          created_at?: string | null
          description?: string | null
          event_date?: string
          event_type: string
          id?: string
          new_values?: Json | null
          old_values?: Json | null
          user_id: string
        }
        Update: {
          asset_id?: string
          company_id?: string
          created_at?: string | null
          description?: string | null
          event_date?: string
          event_type?: string
          id?: string
          new_values?: Json | null
          old_values?: Json | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "asset_events_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "fixed_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_events_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: Database["public"]["Enums"]["audit_action_type"]
          company_id: string
          created_at: string | null
          details: Json | null
          entity: Database["public"]["Enums"]["audit_entity_type"]
          entity_name: string | null
          id: string
          user_id: string | null
        }
        Insert: {
          action: Database["public"]["Enums"]["audit_action_type"]
          company_id: string
          created_at?: string | null
          details?: Json | null
          entity: Database["public"]["Enums"]["audit_entity_type"]
          entity_name?: string | null
          id?: string
          user_id?: string | null
        }
        Update: {
          action?: Database["public"]["Enums"]["audit_action_type"]
          company_id?: string
          created_at?: string | null
          details?: Json | null
          entity?: Database["public"]["Enums"]["audit_entity_type"]
          entity_name?: string | null
          id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      bank_statement_uploads: {
        Row: {
          company_id: string | null
          created_at: string
          error_message: string | null
          file_name: string
          file_size: number
          file_type: string
          file_url: string
          id: string
          metadata: Json | null
          processing_status: string
          updated_at: string
          upload_status: string
          user_id: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          error_message?: string | null
          file_name: string
          file_size: number
          file_type: string
          file_url: string
          id?: string
          metadata?: Json | null
          processing_status?: string
          updated_at?: string
          upload_status?: string
          user_id: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          error_message?: string | null
          file_name?: string
          file_size?: number
          file_type?: string
          file_url?: string
          id?: string
          metadata?: Json | null
          processing_status?: string
          updated_at?: string
          upload_status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bank_statement_uploads_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      bank_statements: {
        Row: {
          account_number: string | null
          bank_name: string | null
          closing_balance: number | null
          company_id: string | null
          created_at: string
          currency: string | null
          error_message: string | null
          file_name: string
          file_size: number | null
          file_type: string | null
          file_url: string | null
          id: string
          metadata: Json | null
          opening_balance: number | null
          processed_at: string | null
          statement_period_end: string | null
          statement_period_start: string | null
          status: string | null
          total_credits: number | null
          total_debits: number | null
          transaction_count: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          account_number?: string | null
          bank_name?: string | null
          closing_balance?: number | null
          company_id?: string | null
          created_at?: string
          currency?: string | null
          error_message?: string | null
          file_name: string
          file_size?: number | null
          file_type?: string | null
          file_url?: string | null
          id?: string
          metadata?: Json | null
          opening_balance?: number | null
          processed_at?: string | null
          statement_period_end?: string | null
          statement_period_start?: string | null
          status?: string | null
          total_credits?: number | null
          total_debits?: number | null
          transaction_count?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          account_number?: string | null
          bank_name?: string | null
          closing_balance?: number | null
          company_id?: string | null
          created_at?: string
          currency?: string | null
          error_message?: string | null
          file_name?: string
          file_size?: number | null
          file_type?: string | null
          file_url?: string | null
          id?: string
          metadata?: Json | null
          opening_balance?: number | null
          processed_at?: string | null
          statement_period_end?: string | null
          statement_period_start?: string | null
          status?: string | null
          total_credits?: number | null
          total_debits?: number | null
          transaction_count?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bank_statements_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      bank_transactions: {
        Row: {
          amount: number
          balance: number | null
          bank_statement_id: string
          category: string | null
          counterparty_account: string | null
          counterparty_name: string | null
          created_at: string
          currency: string | null
          description: string
          id: string
          reference: string | null
          transaction_date: string
          transaction_type: string | null
          updated_at: string
          value_date: string | null
        }
        Insert: {
          amount: number
          balance?: number | null
          bank_statement_id: string
          category?: string | null
          counterparty_account?: string | null
          counterparty_name?: string | null
          created_at?: string
          currency?: string | null
          description: string
          id?: string
          reference?: string | null
          transaction_date: string
          transaction_type?: string | null
          updated_at?: string
          value_date?: string | null
        }
        Update: {
          amount?: number
          balance?: number | null
          bank_statement_id?: string
          category?: string | null
          counterparty_account?: string | null
          counterparty_name?: string | null
          created_at?: string
          currency?: string | null
          description?: string
          id?: string
          reference?: string | null
          transaction_date?: string
          transaction_type?: string | null
          updated_at?: string
          value_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bank_transactions_bank_statement_id_fkey"
            columns: ["bank_statement_id"]
            isOneToOne: false
            referencedRelation: "bank_statements"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          company_id: string | null
          created_at: string
          description: string | null
          id: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      chart_of_accounts_presets: {
        Row: {
          company_id: string | null
          created_at: string | null
          id: string
          is_active: boolean | null
          name: string
          type: string
          updated_at: string | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          type: string
          updated_at?: string | null
        }
        Update: {
          company_id?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_presets_company_id"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          address: string | null
          created_at: string
          id: string
          name: string
          owner_id: string
          share_token: string | null
          share_token_created_at: string | null
          tax_number: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          id?: string
          name: string
          owner_id: string
          share_token?: string | null
          share_token_created_at?: string | null
          tax_number?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          id?: string
          name?: string
          owner_id?: string
          share_token?: string | null
          share_token_created_at?: string | null
          tax_number?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      company_locations: {
        Row: {
          address: string
          company_id: string
          created_at: string | null
          id: string
          is_default: boolean | null
          location_type: string
          name: string
          updated_at: string | null
        }
        Insert: {
          address: string
          company_id: string
          created_at?: string | null
          id?: string
          is_default?: boolean | null
          location_type?: string
          name: string
          updated_at?: string | null
        }
        Update: {
          address?: string
          company_id?: string
          created_at?: string | null
          id?: string
          is_default?: boolean | null
          location_type?: string
          name?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "company_locations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      company_members: {
        Row: {
          company_id: string
          created_at: string
          id: string
          role: string
          user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          role?: string
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_members_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      company_settings: {
        Row: {
          admin_deadline: string
          company_id: string
          created_at: string
          id: string
          monthly_working_hours: number
          updated_at: string
          work_end_time: string
          work_start_time: string
        }
        Insert: {
          admin_deadline?: string
          company_id: string
          created_at?: string
          id?: string
          monthly_working_hours?: number
          updated_at?: string
          work_end_time?: string
          work_start_time?: string
        }
        Update: {
          admin_deadline?: string
          company_id?: string
          created_at?: string
          id?: string
          monthly_working_hours?: number
          updated_at?: string
          work_end_time?: string
          work_start_time?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_settings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      dunning_sends: {
        Row: {
          company_id: string
          created_at: string
          currency: string | null
          debtor_company_name: string
          debtor_email: string
          debtor_tax_number: string | null
          error_message: string | null
          id: string
          invoice_ids: string[]
          sent_at: string
          status: string
          total_amount: number | null
          user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          currency?: string | null
          debtor_company_name: string
          debtor_email: string
          debtor_tax_number?: string | null
          error_message?: string | null
          id?: string
          invoice_ids?: string[]
          sent_at?: string
          status?: string
          total_amount?: number | null
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          currency?: string | null
          debtor_company_name?: string
          debtor_email?: string
          debtor_tax_number?: string | null
          error_message?: string | null
          id?: string
          invoice_ids?: string[]
          sent_at?: string
          status?: string
          total_amount?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dunning_sends_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      egyszerusitett_szamla_backup: {
        Row: {
          adoalap_osszesen_netto: number | null
          afa_osszeg: number | null
          category_id: string | null
          created_at: string
          elado_cim: string | null
          elado_nev: string
          elado_vat_id: string | null
          id: string
          kibocsatas_datuma: string
          project_id: string | null
          termek_szolgaltatas_tipusa: string | null
          updated_at: string
          user_id: string
          vevo_nev: string
        }
        Insert: {
          adoalap_osszesen_netto?: number | null
          afa_osszeg?: number | null
          category_id?: string | null
          created_at?: string
          elado_cim?: string | null
          elado_nev: string
          elado_vat_id?: string | null
          id?: string
          kibocsatas_datuma: string
          project_id?: string | null
          termek_szolgaltatas_tipusa?: string | null
          updated_at?: string
          user_id: string
          vevo_nev: string
        }
        Update: {
          adoalap_osszesen_netto?: number | null
          afa_osszeg?: number | null
          category_id?: string | null
          created_at?: string
          elado_cim?: string | null
          elado_nev?: string
          elado_vat_id?: string | null
          id?: string
          kibocsatas_datuma?: string
          project_id?: string | null
          termek_szolgaltatas_tipusa?: string | null
          updated_at?: string
          user_id?: string
          vevo_nev?: string
        }
        Relationships: []
      }
      email_aliases: {
        Row: {
          alias_email: string
          company_id: string | null
          company_name: string
          created_at: string
          id: string
          mailgun_route_id: string | null
          status: string
          updated_at: string
          user_id: string
          verified_at: string | null
        }
        Insert: {
          alias_email: string
          company_id?: string | null
          company_name: string
          created_at?: string
          id?: string
          mailgun_route_id?: string | null
          status?: string
          updated_at?: string
          user_id: string
          verified_at?: string | null
        }
        Update: {
          alias_email?: string
          company_id?: string | null
          company_name?: string
          created_at?: string
          id?: string
          mailgun_route_id?: string | null
          status?: string
          updated_at?: string
          user_id?: string
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_aliases_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_rates: {
        Row: {
          base_salary_cost: number | null
          company_id: string
          created_at: string
          effective_date: string
          email: string | null
          employee_name: string
          employee_type: string
          hourly_rate: number | null
          id: string
          phone: string | null
          registration_token: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          base_salary_cost?: number | null
          company_id: string
          created_at?: string
          effective_date?: string
          email?: string | null
          employee_name: string
          employee_type?: string
          hourly_rate?: number | null
          id?: string
          phone?: string | null
          registration_token?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          base_salary_cost?: number | null
          company_id?: string
          created_at?: string
          effective_date?: string
          email?: string | null
          employee_name?: string
          employee_type?: string
          hourly_rate?: number | null
          id?: string
          phone?: string | null
          registration_token?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employee_rates_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      feedback: {
        Row: {
          company_id: string | null
          company_name: string | null
          created_at: string
          id: string
          message: string
          slack_sent: boolean
          slack_sent_at: string | null
          status: string
          type: string
          updated_at: string
          user_email: string | null
          user_id: string
          user_name: string | null
        }
        Insert: {
          company_id?: string | null
          company_name?: string | null
          created_at?: string
          id?: string
          message: string
          slack_sent?: boolean
          slack_sent_at?: string | null
          status?: string
          type: string
          updated_at?: string
          user_email?: string | null
          user_id: string
          user_name?: string | null
        }
        Update: {
          company_id?: string | null
          company_name?: string | null
          created_at?: string
          id?: string
          message?: string
          slack_sent?: boolean
          slack_sent_at?: string | null
          status?: string
          type?: string
          updated_at?: string
          user_email?: string | null
          user_id?: string
          user_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "feedback_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      fixed_assets: {
        Row: {
          acquisition_value: number
          activated_by_name: string | null
          activated_by_user_id: string | null
          activation_date: string
          company_id: string
          created_at: string | null
          currency: string | null
          depreciation_method: string | null
          description: string | null
          disposal_date: string | null
          documents: Json | null
          gl_account_id: string | null
          id: string
          inventory_number: string
          location_id: string | null
          name: string
          purchase_date: string
          residual_value: number | null
          source_invoice_id: string | null
          source_invoice_number: string | null
          source_invoice_type: string | null
          status: string
          supplier_name: string | null
          tao_rate_override: number | null
          tao_template_id: string | null
          updated_at: string | null
          useful_life_months: number
          user_id: string
          vtsz_teszor: string | null
        }
        Insert: {
          acquisition_value: number
          activated_by_name?: string | null
          activated_by_user_id?: string | null
          activation_date: string
          company_id: string
          created_at?: string | null
          currency?: string | null
          depreciation_method?: string | null
          description?: string | null
          disposal_date?: string | null
          documents?: Json | null
          gl_account_id?: string | null
          id?: string
          inventory_number: string
          location_id?: string | null
          name: string
          purchase_date: string
          residual_value?: number | null
          source_invoice_id?: string | null
          source_invoice_number?: string | null
          source_invoice_type?: string | null
          status?: string
          supplier_name?: string | null
          tao_rate_override?: number | null
          tao_template_id?: string | null
          updated_at?: string | null
          useful_life_months: number
          user_id: string
          vtsz_teszor?: string | null
        }
        Update: {
          acquisition_value?: number
          activated_by_name?: string | null
          activated_by_user_id?: string | null
          activation_date?: string
          company_id?: string
          created_at?: string | null
          currency?: string | null
          depreciation_method?: string | null
          description?: string | null
          disposal_date?: string | null
          documents?: Json | null
          gl_account_id?: string | null
          id?: string
          inventory_number?: string
          location_id?: string | null
          name?: string
          purchase_date?: string
          residual_value?: number | null
          source_invoice_id?: string | null
          source_invoice_number?: string | null
          source_invoice_type?: string | null
          status?: string
          supplier_name?: string | null
          tao_rate_override?: number | null
          tao_template_id?: string | null
          updated_at?: string | null
          useful_life_months?: number
          user_id?: string
          vtsz_teszor?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fixed_assets_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fixed_assets_gl_account_id_fkey"
            columns: ["gl_account_id"]
            isOneToOne: false
            referencedRelation: "gl_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fixed_assets_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "company_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fixed_assets_tao_template_id_fkey"
            columns: ["tao_template_id"]
            isOneToOne: false
            referencedRelation: "tao_depreciation_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      gl_accounts: {
        Row: {
          company_id: string | null
          created_at: string | null
          description: string | null
          gl_number: string
          id: string
          parent_id: string | null
          preset_id: string
          short_name: string
          updated_at: string | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string | null
          description?: string | null
          gl_number: string
          id?: string
          parent_id?: string | null
          preset_id: string
          short_name: string
          updated_at?: string | null
        }
        Update: {
          company_id?: string | null
          created_at?: string | null
          description?: string | null
          gl_number?: string
          id?: string
          parent_id?: string | null
          preset_id?: string
          short_name?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_gl_accounts_company_id"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gl_accounts_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "gl_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gl_accounts_preset_id_fkey"
            columns: ["preset_id"]
            isOneToOne: false
            referencedRelation: "chart_of_accounts_presets"
            referencedColumns: ["id"]
          },
        ]
      }
      gl_overrides_log: {
        Row: {
          company_id: string | null
          created_at: string | null
          id: string
          item_id: string
          new_gl_account_id: string
          original_gl_account_id: string | null
          source_table: string | null
          user_id: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string | null
          id?: string
          item_id: string
          new_gl_account_id: string
          original_gl_account_id?: string | null
          source_table?: string | null
          user_id: string
        }
        Update: {
          company_id?: string | null
          created_at?: string | null
          id?: string
          item_id?: string
          new_gl_account_id?: string
          original_gl_account_id?: string | null
          source_table?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_overrides_company_id"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      gl_upload_notifications: {
        Row: {
          company_id: string
          created_at: string | null
          error_message: string | null
          id: string
          items_processed: number | null
          items_total: number | null
          message: string
          processed_at: string | null
          processing_status: string
          target_preset_id: string | null
        }
        Insert: {
          company_id: string
          created_at?: string | null
          error_message?: string | null
          id?: string
          items_processed?: number | null
          items_total?: number | null
          message: string
          processed_at?: string | null
          processing_status?: string
          target_preset_id?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string | null
          error_message?: string | null
          id?: string
          items_processed?: number | null
          items_total?: number | null
          message?: string
          processed_at?: string | null
          processing_status?: string
          target_preset_id?: string | null
        }
        Relationships: []
      }
      hp_settings: {
        Row: {
          company_id: string
          created_at: string | null
          created_by: string | null
          id: string
          opening_balance: number | null
          start_date: string | null
          updated_at: string | null
        }
        Insert: {
          company_id: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          opening_balance?: number | null
          start_date?: string | null
          updated_at?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          opening_balance?: number | null
          start_date?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hp_settings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_items: {
        Row: {
          created_at: string | null
          gl_classifications: Json | null
          gross_amount: number | null
          id: string
          invoice_id: string
          line_description: string | null
          line_number: number
          net_amount: number | null
          product_code: string | null
          quantity: number | null
          unit_of_measure: string | null
          unit_price: number | null
          vat_amount: number | null
          vat_rate: string | null
        }
        Insert: {
          created_at?: string | null
          gl_classifications?: Json | null
          gross_amount?: number | null
          id?: string
          invoice_id: string
          line_description?: string | null
          line_number: number
          net_amount?: number | null
          product_code?: string | null
          quantity?: number | null
          unit_of_measure?: string | null
          unit_price?: number | null
          vat_amount?: number | null
          vat_rate?: string | null
        }
        Update: {
          created_at?: string | null
          gl_classifications?: Json | null
          gross_amount?: number | null
          id?: string
          invoice_id?: string
          line_description?: string | null
          line_number?: number
          net_amount?: number | null
          product_code?: string | null
          quantity?: number | null
          unit_of_measure?: string | null
          unit_price?: number | null
          vat_amount?: number | null
          vat_rate?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoice_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_uploads: {
        Row: {
          company_id: string | null
          created_at: string
          document_category: string
          error_message: string | null
          file_name: string
          file_size: number
          file_type: string
          file_url: string
          id: string
          metadata: Json | null
          processing_status: string
          updated_at: string
          upload_status: string
          user_id: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          document_category?: string
          error_message?: string | null
          file_name: string
          file_size: number
          file_type: string
          file_url: string
          id?: string
          metadata?: Json | null
          processing_status?: string
          updated_at?: string
          upload_status?: string
          user_id: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          document_category?: string
          error_message?: string | null
          file_name?: string
          file_size?: number
          file_type?: string
          file_url?: string
          id?: string
          metadata?: Json | null
          processing_status?: string
          updated_at?: string
          upload_status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoice_uploads_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          adoalap_osszesen: number
          adojogi_megjegyzes: string | null
          adomentesseg_hivatkozas: string | null
          afa_kulcsok_bontasban: string | null
          afa_osszeg_osszesen: number
          bankszamlaszam_iban: string | null
          bizonylatsorszam: string
          brutto_vegosszeg: number
          category_id: string | null
          company_id: string | null
          dokumentum_azonosito: string | null
          elado_cim: string | null
          elado_nev: string
          elado_vat_id: string | null
          elolegszamla_hivatkozas: string | null
          elszamolt_eloleg_osszeg: number | null
          email_uzenet_id: string | null
          feldolgozva: string | null
          fizetendo_osszeg: number | null
          fizetesi_hatarido: string | null
          fizetesi_mod: string | null
          fizetve: boolean | null
          forditott_adozas: boolean | null
          frissitve: string
          gl_account_id: string | null
          gl_ai_confidence_score: number | null
          gl_classifications: Json | null
          gl_is_manually_overridden: boolean | null
          gl_reasoning: string | null
          id: string
          image_url: string | null
          invoice_direction: string | null
          invoice_type: string
          invoice_uploads_id: string | null
          kibocsatas_datuma: string
          letrehozva: string
          melleklet_url: string | null
          onszamlazas: boolean | null
          penzforgalmi_elszamolas: boolean | null
          penznem: string | null
          project_id: string | null
          reference_number: string | null
          statusz: string | null
          teljesites_datuma: string | null
          termek_szolgaltatas_tipusa: string | null
          transaction_id: string | null
          user_id: string
          vevo_cim: string | null
          vevo_nev: string
          vevo_vat_id: string | null
        }
        Insert: {
          adoalap_osszesen?: number
          adojogi_megjegyzes?: string | null
          adomentesseg_hivatkozas?: string | null
          afa_kulcsok_bontasban?: string | null
          afa_osszeg_osszesen?: number
          bankszamlaszam_iban?: string | null
          bizonylatsorszam: string
          brutto_vegosszeg?: number
          category_id?: string | null
          company_id?: string | null
          dokumentum_azonosito?: string | null
          elado_cim?: string | null
          elado_nev: string
          elado_vat_id?: string | null
          elolegszamla_hivatkozas?: string | null
          elszamolt_eloleg_osszeg?: number | null
          email_uzenet_id?: string | null
          feldolgozva?: string | null
          fizetendo_osszeg?: number | null
          fizetesi_hatarido?: string | null
          fizetesi_mod?: string | null
          fizetve?: boolean | null
          forditott_adozas?: boolean | null
          frissitve?: string
          gl_account_id?: string | null
          gl_ai_confidence_score?: number | null
          gl_classifications?: Json | null
          gl_is_manually_overridden?: boolean | null
          gl_reasoning?: string | null
          id?: string
          image_url?: string | null
          invoice_direction?: string | null
          invoice_type?: string
          invoice_uploads_id?: string | null
          kibocsatas_datuma: string
          letrehozva?: string
          melleklet_url?: string | null
          onszamlazas?: boolean | null
          penzforgalmi_elszamolas?: boolean | null
          penznem?: string | null
          project_id?: string | null
          reference_number?: string | null
          statusz?: string | null
          teljesites_datuma?: string | null
          termek_szolgaltatas_tipusa?: string | null
          transaction_id?: string | null
          user_id: string
          vevo_cim?: string | null
          vevo_nev: string
          vevo_vat_id?: string | null
        }
        Update: {
          adoalap_osszesen?: number
          adojogi_megjegyzes?: string | null
          adomentesseg_hivatkozas?: string | null
          afa_kulcsok_bontasban?: string | null
          afa_osszeg_osszesen?: number
          bankszamlaszam_iban?: string | null
          bizonylatsorszam?: string
          brutto_vegosszeg?: number
          category_id?: string | null
          company_id?: string | null
          dokumentum_azonosito?: string | null
          elado_cim?: string | null
          elado_nev?: string
          elado_vat_id?: string | null
          elolegszamla_hivatkozas?: string | null
          elszamolt_eloleg_osszeg?: number | null
          email_uzenet_id?: string | null
          feldolgozva?: string | null
          fizetendo_osszeg?: number | null
          fizetesi_hatarido?: string | null
          fizetesi_mod?: string | null
          fizetve?: boolean | null
          forditott_adozas?: boolean | null
          frissitve?: string
          gl_account_id?: string | null
          gl_ai_confidence_score?: number | null
          gl_classifications?: Json | null
          gl_is_manually_overridden?: boolean | null
          gl_reasoning?: string | null
          id?: string
          image_url?: string | null
          invoice_direction?: string | null
          invoice_type?: string
          invoice_uploads_id?: string | null
          kibocsatas_datuma?: string
          letrehozva?: string
          melleklet_url?: string | null
          onszamlazas?: boolean | null
          penzforgalmi_elszamolas?: boolean | null
          penznem?: string | null
          project_id?: string | null
          reference_number?: string | null
          statusz?: string | null
          teljesites_datuma?: string | null
          termek_szolgaltatas_tipusa?: string | null
          transaction_id?: string | null
          user_id?: string
          vevo_cim?: string | null
          vevo_nev?: string
          vevo_vat_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_gl_account_id_fkey"
            columns: ["gl_account_id"]
            isOneToOne: false
            referencedRelation: "gl_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_invoice_uploads_id_fkey"
            columns: ["invoice_uploads_id"]
            isOneToOne: false
            referencedRelation: "invoice_uploads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      leave_requests: {
        Row: {
          admin_note: string | null
          company_id: string
          created_at: string
          end_date: string
          id: string
          leave_type: string
          note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          start_date: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_note?: string | null
          company_id: string
          created_at?: string
          end_date: string
          id?: string
          leave_type?: string
          note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          start_date: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_note?: string | null
          company_id?: string
          created_at?: string
          end_date?: string
          id?: string
          leave_type?: string
          note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          start_date?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "leave_requests_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      llm_koltsegek: {
        Row: {
          company_id: string | null
          created_at: string
          estimated_cost_usd: number | null
          file_name: string
          id: string
          input_tokens: number
          llm_calls: number
          model_name: string
          output_tokens: number
          pipeline: string
          processing_duration_ms: number | null
          total_tokens: number | null
          upload_id: string | null
          user_id: string | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          estimated_cost_usd?: number | null
          file_name: string
          id?: string
          input_tokens?: number
          llm_calls?: number
          model_name: string
          output_tokens?: number
          pipeline: string
          processing_duration_ms?: number | null
          total_tokens?: number | null
          upload_id?: string | null
          user_id?: string | null
        }
        Update: {
          company_id?: string | null
          created_at?: string
          estimated_cost_usd?: number | null
          file_name?: string
          id?: string
          input_tokens?: number
          llm_calls?: number
          model_name?: string
          output_tokens?: number
          pipeline?: string
          processing_duration_ms?: number | null
          total_tokens?: number | null
          upload_id?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      nav_invoice_items: {
        Row: {
          created_at: string | null
          gl_classifications: Json | null
          gross_amount: number | null
          id: string
          line_description: string | null
          line_number: number
          nav_invoice_id: string
          net_amount: number | null
          product_code: string | null
          quantity: number | null
          unit_of_measure: string | null
          unit_price: number | null
          vat_amount: number | null
          vat_rate: string | null
        }
        Insert: {
          created_at?: string | null
          gl_classifications?: Json | null
          gross_amount?: number | null
          id?: string
          line_description?: string | null
          line_number: number
          nav_invoice_id: string
          net_amount?: number | null
          product_code?: string | null
          quantity?: number | null
          unit_of_measure?: string | null
          unit_price?: number | null
          vat_amount?: number | null
          vat_rate?: string | null
        }
        Update: {
          created_at?: string | null
          gl_classifications?: Json | null
          gross_amount?: number | null
          id?: string
          line_description?: string | null
          line_number?: number
          nav_invoice_id?: string
          net_amount?: number | null
          product_code?: string | null
          quantity?: number | null
          unit_of_measure?: string | null
          unit_price?: number | null
          vat_amount?: number | null
          vat_rate?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "nav_invoice_items_nav_invoice_id_fkey"
            columns: ["nav_invoice_id"]
            isOneToOne: false
            referencedRelation: "nav_invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      nav_invoices: {
        Row: {
          ai_categorization_reason: string | null
          category_id: string | null
          company_id: string | null
          created_at: string | null
          currency: string | null
          customer_address: string | null
          customer_name: string | null
          customer_tax_number: string | null
          details_fetched: boolean | null
          fetched_at: string | null
          gl_account_id: string | null
          gl_ai_confidence_score: number | null
          gl_classifications: Json | null
          gl_is_manually_overridden: boolean | null
          gl_reasoning: string | null
          id: string
          invoice_delivery_date: string | null
          invoice_direction: string | null
          invoice_gross_amount: number | null
          invoice_issue_date: string | null
          invoice_net_amount: number | null
          invoice_number: string
          invoice_operation: string | null
          invoice_vat_amount: number | null
          paid: boolean | null
          payment_date: string | null
          payment_method: string | null
          project_id: string | null
          submitted: boolean | null
          supplier_address: string | null
          supplier_name: string | null
          supplier_partner_id: string | null
          supplier_tax_number: string | null
          transaction_id: string | null
          user_id: string | null
        }
        Insert: {
          ai_categorization_reason?: string | null
          category_id?: string | null
          company_id?: string | null
          created_at?: string | null
          currency?: string | null
          customer_address?: string | null
          customer_name?: string | null
          customer_tax_number?: string | null
          details_fetched?: boolean | null
          fetched_at?: string | null
          gl_account_id?: string | null
          gl_ai_confidence_score?: number | null
          gl_classifications?: Json | null
          gl_is_manually_overridden?: boolean | null
          gl_reasoning?: string | null
          id?: string
          invoice_delivery_date?: string | null
          invoice_direction?: string | null
          invoice_gross_amount?: number | null
          invoice_issue_date?: string | null
          invoice_net_amount?: number | null
          invoice_number: string
          invoice_operation?: string | null
          invoice_vat_amount?: number | null
          paid?: boolean | null
          payment_date?: string | null
          payment_method?: string | null
          project_id?: string | null
          submitted?: boolean | null
          supplier_address?: string | null
          supplier_name?: string | null
          supplier_partner_id?: string | null
          supplier_tax_number?: string | null
          transaction_id?: string | null
          user_id?: string | null
        }
        Update: {
          ai_categorization_reason?: string | null
          category_id?: string | null
          company_id?: string | null
          created_at?: string | null
          currency?: string | null
          customer_address?: string | null
          customer_name?: string | null
          customer_tax_number?: string | null
          details_fetched?: boolean | null
          fetched_at?: string | null
          gl_account_id?: string | null
          gl_ai_confidence_score?: number | null
          gl_classifications?: Json | null
          gl_is_manually_overridden?: boolean | null
          gl_reasoning?: string | null
          id?: string
          invoice_delivery_date?: string | null
          invoice_direction?: string | null
          invoice_gross_amount?: number | null
          invoice_issue_date?: string | null
          invoice_net_amount?: number | null
          invoice_number?: string
          invoice_operation?: string | null
          invoice_vat_amount?: number | null
          paid?: boolean | null
          payment_date?: string | null
          payment_method?: string | null
          project_id?: string | null
          submitted?: boolean | null
          supplier_address?: string | null
          supplier_name?: string | null
          supplier_partner_id?: string | null
          supplier_tax_number?: string | null
          transaction_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "nav_invoices_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nav_invoices_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nav_invoices_gl_account_id_fkey"
            columns: ["gl_account_id"]
            isOneToOne: false
            referencedRelation: "gl_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nav_invoices_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nav_invoices_supplier_partner_id_fkey"
            columns: ["supplier_partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nav_invoices_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      nav_sync_logs: {
        Row: {
          company_id: string | null
          completed_at: string | null
          date_from: string | null
          date_to: string | null
          duration_ms: number | null
          error_message: string | null
          id: string
          invoice_direction: string | null
          invoices_fetched: number | null
          started_at: string | null
          status: string
          sync_type: string
          user_id: string | null
        }
        Insert: {
          company_id?: string | null
          completed_at?: string | null
          date_from?: string | null
          date_to?: string | null
          duration_ms?: number | null
          error_message?: string | null
          id?: string
          invoice_direction?: string | null
          invoices_fetched?: number | null
          started_at?: string | null
          status: string
          sync_type: string
          user_id?: string | null
        }
        Update: {
          company_id?: string | null
          completed_at?: string | null
          date_from?: string | null
          date_to?: string | null
          duration_ms?: number | null
          error_message?: string | null
          id?: string
          invoice_direction?: string | null
          invoices_fetched?: number | null
          started_at?: string | null
          status?: string
          sync_type?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "nav_sync_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      nylas_tokens: {
        Row: {
          access_token: string
          created_at: string
          email_address: string
          expires_at: string | null
          grant_id: string
          id: string
          provider: string
          refresh_token: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token: string
          created_at?: string
          email_address: string
          expires_at?: string | null
          grant_id: string
          id?: string
          provider: string
          refresh_token?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string
          created_at?: string
          email_address?: string
          expires_at?: string | null
          grant_id?: string
          id?: string
          provider?: string
          refresh_token?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      partners: {
        Row: {
          address: string | null
          company_id: string | null
          created_at: string
          default_project_id: string | null
          email: string | null
          id: string
          name: string
          partner_type: string
          tax_number: string
          updated_at: string
          user_id: string
        }
        Insert: {
          address?: string | null
          company_id?: string | null
          created_at?: string
          default_project_id?: string | null
          email?: string | null
          id?: string
          name: string
          partner_type?: string
          tax_number: string
          updated_at?: string
          user_id: string
        }
        Update: {
          address?: string | null
          company_id?: string | null
          created_at?: string
          default_project_id?: string | null
          email?: string | null
          id?: string
          name?: string
          partner_type?: string
          tax_number?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "partners_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partners_default_project_id_fkey"
            columns: ["default_project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      pnl_mapping: {
        Row: {
          company_id: string
          created_at: string | null
          gl_account_id: string
          id: string
          pnl_structure_id: string
          preset_id: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          company_id: string
          created_at?: string | null
          gl_account_id: string
          id?: string
          pnl_structure_id: string
          preset_id: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string | null
          gl_account_id?: string
          id?: string
          pnl_structure_id?: string
          preset_id?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pnl_mapping_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pnl_mapping_gl_account_id_fkey"
            columns: ["gl_account_id"]
            isOneToOne: false
            referencedRelation: "gl_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pnl_mapping_pnl_structure_id_fkey"
            columns: ["pnl_structure_id"]
            isOneToOne: false
            referencedRelation: "pnl_structure"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pnl_mapping_preset_id_fkey"
            columns: ["preset_id"]
            isOneToOne: false
            referencedRelation: "chart_of_accounts_presets"
            referencedColumns: ["id"]
          },
        ]
      }
      pnl_structure: {
        Row: {
          created_at: string | null
          id: string
          multiplier: number
          name: string
          order_num: number
          parent_id: string | null
          row_code: string
          type: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          multiplier?: number
          name: string
          order_num: number
          parent_id?: string | null
          row_code: string
          type: string
        }
        Update: {
          created_at?: string | null
          id?: string
          multiplier?: number
          name?: string
          order_num?: number
          parent_id?: string | null
          row_code?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "pnl_structure_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "pnl_structure"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          company: string | null
          created_at: string
          email_verified: boolean
          email_verify_token: string | null
          has_completed_tour: boolean | null
          id: string
          name: string | null
          position: string | null
          role: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          company?: string | null
          created_at?: string
          email_verified?: boolean
          email_verify_token?: string | null
          has_completed_tour?: boolean | null
          id?: string
          name?: string | null
          position?: string | null
          role?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          company?: string | null
          created_at?: string
          email_verified?: boolean
          email_verify_token?: string | null
          has_completed_tour?: boolean | null
          id?: string
          name?: string | null
          position?: string | null
          role?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      proforma_backup: {
        Row: {
          adojogi_megjegyzes: string | null
          bankszamlaszam_iban: string | null
          category_id: string | null
          created_at: string
          dokumentum_azonosito: string | null
          elado_nev: string
          elado_vat_id: string | null
          fizetendo_osszeg: number | null
          fizetesi_hatarido: string | null
          fizetesi_mod: string | null
          id: string
          kibocsatas_datuma: string
          project_id: string | null
          updated_at: string
          user_id: string
          vevo_nev: string
        }
        Insert: {
          adojogi_megjegyzes?: string | null
          bankszamlaszam_iban?: string | null
          category_id?: string | null
          created_at?: string
          dokumentum_azonosito?: string | null
          elado_nev: string
          elado_vat_id?: string | null
          fizetendo_osszeg?: number | null
          fizetesi_hatarido?: string | null
          fizetesi_mod?: string | null
          id?: string
          kibocsatas_datuma: string
          project_id?: string | null
          updated_at?: string
          user_id: string
          vevo_nev: string
        }
        Update: {
          adojogi_megjegyzes?: string | null
          bankszamlaszam_iban?: string | null
          category_id?: string | null
          created_at?: string
          dokumentum_azonosito?: string | null
          elado_nev?: string
          elado_vat_id?: string | null
          fizetendo_osszeg?: number | null
          fizetesi_hatarido?: string | null
          fizetesi_mod?: string | null
          id?: string
          kibocsatas_datuma?: string
          project_id?: string | null
          updated_at?: string
          user_id?: string
          vevo_nev?: string
        }
        Relationships: []
      }
      projects: {
        Row: {
          budget: number | null
          client_name: string | null
          company_id: string | null
          created_at: string
          description: string | null
          end_date: string | null
          id: string
          name: string
          project_code: string | null
          project_type: string
          start_date: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          budget?: number | null
          client_name?: string | null
          company_id?: string | null
          created_at?: string
          description?: string | null
          end_date?: string | null
          id?: string
          name: string
          project_code?: string | null
          project_type?: string
          start_date?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          budget?: number | null
          client_name?: string | null
          company_id?: string | null
          created_at?: string
          description?: string | null
          end_date?: string | null
          id?: string
          name?: string
          project_code?: string | null
          project_type?: string
          start_date?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      salary: {
        Row: {
          company_id: string | null
          created_at: string
          dátum: string | null
          fizetesi_mod: string
          id: string
          kifizetes_ideje: string | null
          megjegyzes: string | null
          munkavallalo_neve: string | null
          név: string
          összeg: number
          salary_file_id: string | null
          statusz: string
          tipus: string
          transaction_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          dátum?: string | null
          fizetesi_mod: string
          id?: string
          kifizetes_ideje?: string | null
          megjegyzes?: string | null
          munkavallalo_neve?: string | null
          név: string
          összeg: number
          salary_file_id?: string | null
          statusz: string
          tipus: string
          transaction_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          dátum?: string | null
          fizetesi_mod?: string
          id?: string
          kifizetes_ideje?: string | null
          megjegyzes?: string | null
          munkavallalo_neve?: string | null
          név?: string
          összeg?: number
          salary_file_id?: string | null
          statusz?: string
          tipus?: string
          transaction_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "salary_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "salary_salary_file_id_fkey"
            columns: ["salary_file_id"]
            isOneToOne: false
            referencedRelation: "salary_files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "salary_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      salary_files: {
        Row: {
          amount_to_transfer: number
          company_id: string | null
          created_at: string
          description: string
          due_date: string | null
          employee_name: string | null
          file_name: string | null
          file_size: number | null
          file_url: string | null
          id: string
          metadata: Json | null
          payment_date: string | null
          payment_reference: string | null
          payment_type: string
          period_month: number | null
          period_year: number | null
          recipient_name: string
          source: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount_to_transfer: number
          company_id?: string | null
          created_at?: string
          description: string
          due_date?: string | null
          employee_name?: string | null
          file_name?: string | null
          file_size?: number | null
          file_url?: string | null
          id?: string
          metadata?: Json | null
          payment_date?: string | null
          payment_reference?: string | null
          payment_type: string
          period_month?: number | null
          period_year?: number | null
          recipient_name: string
          source?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount_to_transfer?: number
          company_id?: string | null
          created_at?: string
          description?: string
          due_date?: string | null
          employee_name?: string | null
          file_name?: string | null
          file_size?: number | null
          file_url?: string | null
          id?: string
          metadata?: Json | null
          payment_date?: string | null
          payment_reference?: string | null
          payment_type?: string
          period_month?: number | null
          period_year?: number | null
          recipient_name?: string
          source?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "salary_files_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      settings: {
        Row: {
          category: string
          created_at: string
          id: string
          key: string
          updated_at: string
          user_id: string
          value: Json | null
        }
        Insert: {
          category: string
          created_at?: string
          id?: string
          key: string
          updated_at?: string
          user_id: string
          value?: Json | null
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          key?: string
          updated_at?: string
          user_id?: string
          value?: Json | null
        }
        Relationships: []
      }
      sima_szamla_backup: {
        Row: {
          adoalap_osszesen: number | null
          adomentesseg_hivatkozas: string | null
          afa_kulcsok_bontasban: string | null
          afa_osszeg_osszesen: number | null
          bizonylatsorszam: string
          brutto_vegosszeg: number | null
          category_id: string | null
          created_at: string
          elado_cim: string | null
          elado_nev: string
          elado_vat_id: string | null
          email_uzenet_id: string | null
          forditott_adozas: boolean | null
          id: string
          kibocsatas_datuma: string
          melleklet_url: string | null
          onszamlazas: boolean | null
          penzforgalmi_elszamolas: boolean | null
          penznem: string | null
          project_id: string | null
          statusz: string | null
          teljesites_datuma: string | null
          updated_at: string
          user_id: string
          vevo_cim: string | null
          vevo_nev: string
          vevo_vat_id: string | null
        }
        Insert: {
          adoalap_osszesen?: number | null
          adomentesseg_hivatkozas?: string | null
          afa_kulcsok_bontasban?: string | null
          afa_osszeg_osszesen?: number | null
          bizonylatsorszam: string
          brutto_vegosszeg?: number | null
          category_id?: string | null
          created_at?: string
          elado_cim?: string | null
          elado_nev: string
          elado_vat_id?: string | null
          email_uzenet_id?: string | null
          forditott_adozas?: boolean | null
          id?: string
          kibocsatas_datuma: string
          melleklet_url?: string | null
          onszamlazas?: boolean | null
          penzforgalmi_elszamolas?: boolean | null
          penznem?: string | null
          project_id?: string | null
          statusz?: string | null
          teljesites_datuma?: string | null
          updated_at?: string
          user_id: string
          vevo_cim?: string | null
          vevo_nev: string
          vevo_vat_id?: string | null
        }
        Update: {
          adoalap_osszesen?: number | null
          adomentesseg_hivatkozas?: string | null
          afa_kulcsok_bontasban?: string | null
          afa_osszeg_osszesen?: number | null
          bizonylatsorszam?: string
          brutto_vegosszeg?: number | null
          category_id?: string | null
          created_at?: string
          elado_cim?: string | null
          elado_nev?: string
          elado_vat_id?: string | null
          email_uzenet_id?: string | null
          forditott_adozas?: boolean | null
          id?: string
          kibocsatas_datuma?: string
          melleklet_url?: string | null
          onszamlazas?: boolean | null
          penzforgalmi_elszamolas?: boolean | null
          penznem?: string | null
          project_id?: string | null
          statusz?: string | null
          teljesites_datuma?: string | null
          updated_at?: string
          user_id?: string
          vevo_cim?: string | null
          vevo_nev?: string
          vevo_vat_id?: string | null
        }
        Relationships: []
      }
      tao_depreciation_templates: {
        Row: {
          category_code: string | null
          created_at: string | null
          id: string
          name: string
          tao_rate_percent: number
        }
        Insert: {
          category_code?: string | null
          created_at?: string | null
          id?: string
          name: string
          tao_rate_percent: number
        }
        Update: {
          category_code?: string | null
          created_at?: string | null
          id?: string
          name?: string
          tao_rate_percent?: number
        }
        Relationships: []
      }
      tax: {
        Row: {
          adonem: string
          company_id: string | null
          created_at: string
          datum: string | null
          id: string
          osszeg: number
          updated_at: string
          user_id: string
        }
        Insert: {
          adonem: string
          company_id?: string | null
          created_at?: string
          datum?: string | null
          id?: string
          osszeg: number
          updated_at?: string
          user_id: string
        }
        Update: {
          adonem?: string
          company_id?: string | null
          created_at?: string
          datum?: string | null
          id?: string
          osszeg?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tax_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      time_entries: {
        Row: {
          absence_type: string | null
          company_id: string
          created_at: string
          date: string
          description: string | null
          hours: number
          id: string
          project_id: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          absence_type?: string | null
          company_id: string
          created_at?: string
          date?: string
          description?: string | null
          hours: number
          id?: string
          project_id?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          absence_type?: string | null
          company_id?: string
          created_at?: string
          date?: string
          description?: string | null
          hours?: number
          id?: string
          project_id?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "time_entries_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_entries_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      transaction_uploads: {
        Row: {
          company_id: string
          created_at: string | null
          error_message: string | null
          file_name: string
          file_size: number | null
          file_type: string | null
          file_url: string
          id: string
          metadata: Json | null
          processing_status: string | null
          updated_at: string | null
          upload_status: string | null
          user_id: string | null
        }
        Insert: {
          company_id: string
          created_at?: string | null
          error_message?: string | null
          file_name: string
          file_size?: number | null
          file_type?: string | null
          file_url: string
          id?: string
          metadata?: Json | null
          processing_status?: string | null
          updated_at?: string | null
          upload_status?: string | null
          user_id?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string | null
          error_message?: string | null
          file_name?: string
          file_size?: number | null
          file_type?: string | null
          file_url?: string
          id?: string
          metadata?: Json | null
          processing_status?: string | null
          updated_at?: string | null
          upload_status?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      transactions: {
        Row: {
          amount: number
          company_id: string
          confidence_score: number | null
          created_at: string | null
          currency: string | null
          description: string | null
          gl_account_id: string | null
          gl_ai_confidence_score: number | null
          gl_classifications: Json | null
          gl_is_manually_overridden: boolean | null
          gl_reasoning: string | null
          id: string
          is_verified: boolean | null
          match_type: string | null
          matched_invoice_id: string | null
          reason: string | null
          transaction_date: string
          type: string | null
          upload_id: string | null
        }
        Insert: {
          amount: number
          company_id: string
          confidence_score?: number | null
          created_at?: string | null
          currency?: string | null
          description?: string | null
          gl_account_id?: string | null
          gl_ai_confidence_score?: number | null
          gl_classifications?: Json | null
          gl_is_manually_overridden?: boolean | null
          gl_reasoning?: string | null
          id?: string
          is_verified?: boolean | null
          match_type?: string | null
          matched_invoice_id?: string | null
          reason?: string | null
          transaction_date: string
          type?: string | null
          upload_id?: string | null
        }
        Update: {
          amount?: number
          company_id?: string
          confidence_score?: number | null
          created_at?: string | null
          currency?: string | null
          description?: string | null
          gl_account_id?: string | null
          gl_ai_confidence_score?: number | null
          gl_classifications?: Json | null
          gl_is_manually_overridden?: boolean | null
          gl_reasoning?: string | null
          id?: string
          is_verified?: boolean | null
          match_type?: string | null
          matched_invoice_id?: string | null
          reason?: string | null
          transaction_date?: string
          type?: string | null
          upload_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transactions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_gl_account_id_fkey"
            columns: ["gl_account_id"]
            isOneToOne: false
            referencedRelation: "gl_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_upload_id_fkey"
            columns: ["upload_id"]
            isOneToOne: false
            referencedRelation: "transaction_uploads"
            referencedColumns: ["id"]
          },
        ]
      }
      user_email_preferences: {
        Row: {
          bank_statement_processed: boolean | null
          created_at: string | null
          email_invoice_processed: boolean | null
          id: string
          invoice_failed: boolean | null
          invoice_processed: boolean | null
          missing_invoices: boolean | null
          monthly_summary: boolean | null
          nav_sync_complete: boolean | null
          payment_reminders: boolean | null
          salary_processed: boolean | null
          subscription_warnings: boolean | null
          team_notifications: boolean | null
          transaction_matched: boolean | null
          updated_at: string | null
          user_id: string
          weekly_summary: boolean | null
        }
        Insert: {
          bank_statement_processed?: boolean | null
          created_at?: string | null
          email_invoice_processed?: boolean | null
          id?: string
          invoice_failed?: boolean | null
          invoice_processed?: boolean | null
          missing_invoices?: boolean | null
          monthly_summary?: boolean | null
          nav_sync_complete?: boolean | null
          payment_reminders?: boolean | null
          salary_processed?: boolean | null
          subscription_warnings?: boolean | null
          team_notifications?: boolean | null
          transaction_matched?: boolean | null
          updated_at?: string | null
          user_id: string
          weekly_summary?: boolean | null
        }
        Update: {
          bank_statement_processed?: boolean | null
          created_at?: string | null
          email_invoice_processed?: boolean | null
          id?: string
          invoice_failed?: boolean | null
          invoice_processed?: boolean | null
          missing_invoices?: boolean | null
          monthly_summary?: boolean | null
          nav_sync_complete?: boolean | null
          payment_reminders?: boolean | null
          salary_processed?: boolean | null
          subscription_warnings?: boolean | null
          team_notifications?: boolean | null
          transaction_matched?: boolean | null
          updated_at?: string | null
          user_id?: string
          weekly_summary?: boolean | null
        }
        Relationships: []
      }
      user_nav_credentials: {
        Row: {
          company_id: string | null
          created_at: string | null
          exchange_key_secret_id: string | null
          id: string
          is_test_environment: boolean | null
          last_validated_at: string | null
          nav_tax_number: string
          nav_username: string
          password_secret_id: string | null
          sign_key_secret_id: string | null
          software_dev_contact: string | null
          software_dev_name: string | null
          software_id: string | null
          updated_at: string | null
          user_id: string | null
          validation_error: string | null
          validation_status: string | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string | null
          exchange_key_secret_id?: string | null
          id?: string
          is_test_environment?: boolean | null
          last_validated_at?: string | null
          nav_tax_number: string
          nav_username: string
          password_secret_id?: string | null
          sign_key_secret_id?: string | null
          software_dev_contact?: string | null
          software_dev_name?: string | null
          software_id?: string | null
          updated_at?: string | null
          user_id?: string | null
          validation_error?: string | null
          validation_status?: string | null
        }
        Update: {
          company_id?: string | null
          created_at?: string | null
          exchange_key_secret_id?: string | null
          id?: string
          is_test_environment?: boolean | null
          last_validated_at?: string | null
          nav_tax_number?: string
          nav_username?: string
          password_secret_id?: string | null
          sign_key_secret_id?: string | null
          software_dev_contact?: string | null
          software_dev_name?: string | null
          software_id?: string | null
          updated_at?: string | null
          user_id?: string | null
          validation_error?: string | null
          validation_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_nav_credentials_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      user_subscriptions: {
        Row: {
          created_at: string
          id: string
          invoice_limit: number
          invoices_used: number
          period_end: string
          period_start: string
          stripe_customer_id: string | null
          stripe_product_id: string | null
          stripe_subscription_id: string | null
          tier: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          invoice_limit?: number
          invoices_used?: number
          period_end?: string
          period_start?: string
          stripe_customer_id?: string | null
          stripe_product_id?: string | null
          stripe_subscription_id?: string | null
          tier?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          invoice_limit?: number
          invoices_used?: number
          period_end?: string
          period_start?: string
          stripe_customer_id?: string | null
          stripe_product_id?: string | null
          stripe_subscription_id?: string | null
          tier?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      vegszamla_backup: {
        Row: {
          adoalap_osszesen: number | null
          afa_osszeg_osszesen: number | null
          brutto_vegosszeg: number | null
          category_id: string | null
          created_at: string
          elado_cim: string | null
          elado_nev: string
          elado_vat_id: string | null
          elolegszamla_hivatkozas: string | null
          elszamolt_eloleg_osszeg: number | null
          forditott_adozas: boolean | null
          id: string
          kibocsatas_datuma: string
          project_id: string | null
          szamlaszam: string
          teljesites_datuma: string | null
          updated_at: string
          user_id: string
          vevo_cim: string | null
          vevo_nev: string
        }
        Insert: {
          adoalap_osszesen?: number | null
          afa_osszeg_osszesen?: number | null
          brutto_vegosszeg?: number | null
          category_id?: string | null
          created_at?: string
          elado_cim?: string | null
          elado_nev: string
          elado_vat_id?: string | null
          elolegszamla_hivatkozas?: string | null
          elszamolt_eloleg_osszeg?: number | null
          forditott_adozas?: boolean | null
          id?: string
          kibocsatas_datuma: string
          project_id?: string | null
          szamlaszam: string
          teljesites_datuma?: string | null
          updated_at?: string
          user_id: string
          vevo_cim?: string | null
          vevo_nev: string
        }
        Update: {
          adoalap_osszesen?: number | null
          afa_osszeg_osszesen?: number | null
          brutto_vegosszeg?: number | null
          category_id?: string | null
          created_at?: string
          elado_cim?: string | null
          elado_nev?: string
          elado_vat_id?: string | null
          elolegszamla_hivatkozas?: string | null
          elszamolt_eloleg_osszeg?: number | null
          forditott_adozas?: boolean | null
          id?: string
          kibocsatas_datuma?: string
          project_id?: string | null
          szamlaszam?: string
          teljesites_datuma?: string | null
          updated_at?: string
          user_id?: string
          vevo_cim?: string | null
          vevo_nev?: string
        }
        Relationships: []
      }
    }
    Views: {
      project_labor_costs: {
        Row: {
          company_id: string | null
          project_id: string | null
          project_name: string | null
          total_hours: number | null
          total_labor_cost: number | null
        }
        Relationships: [
          {
            foreignKeyName: "time_entries_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_entries_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      assign_supplier_default_projects: {
        Args: { p_company_id: string }
        Returns: number
      }
      calculate_hourly_cost: {
        Args: { p_base_salary: number; p_monthly_hours?: number }
        Returns: number
      }
      claim_gl_jobs: {
        Args: { p_batch_size?: number }
        Returns: {
          company_id: string
          created_at: string | null
          error_message: string | null
          id: string
          items_processed: number | null
          items_total: number | null
          message: string
          processed_at: string | null
          processing_status: string
          target_preset_id: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "gl_upload_notifications"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      claim_invoice_jobs: {
        Args: { p_batch_size?: number }
        Returns: {
          company_id: string | null
          created_at: string
          document_category: string
          error_message: string | null
          file_name: string
          file_size: number
          file_type: string
          file_url: string
          id: string
          metadata: Json | null
          processing_status: string
          updated_at: string
          upload_status: string
          user_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "invoice_uploads"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      claim_transaction_jobs: {
        Args: { p_batch_size?: number }
        Returns: {
          company_id: string
          created_at: string | null
          error_message: string | null
          file_name: string
          file_size: number | null
          file_type: string | null
          file_url: string
          id: string
          metadata: Json | null
          processing_status: string | null
          updated_at: string | null
          upload_status: string | null
          user_id: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "transaction_uploads"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_filtered_nav_invoices: {
        Args: {
          p_amount_max?: number
          p_amount_min?: number
          p_category_id?: string
          p_company_id: string
          p_currency?: string
          p_date_from: string
          p_date_to: string
          p_direction: string
          p_issue_date_from?: string
          p_issue_date_to?: string
          p_page?: number
          p_page_size?: number
          p_paid?: string
          p_payment_method?: string
          p_project_id?: string
          p_search?: string
          p_sort_dir?: string
          p_sort_field?: string
          p_submitted?: string
        }
        Returns: {
          category_id: string
          company_id: string
          created_at: string
          currency: string
          customer_address: string
          customer_name: string
          customer_tax_number: string
          details_fetched: boolean
          fetched_at: string
          id: string
          invoice_delivery_date: string
          invoice_direction: string
          invoice_gross_amount: number
          invoice_issue_date: string
          invoice_net_amount: number
          invoice_number: string
          invoice_operation: string
          invoice_vat_amount: number
          paid: boolean
          payment_date: string
          payment_method: string
          project_id: string
          submitted: boolean
          supplier_address: string
          supplier_name: string
          supplier_tax_number: string
          total_count: number
          transaction_id: string
          user_id: string
        }[]
      }
      get_filtered_submitted_invoices: {
        Args: {
          p_amount_max?: number
          p_amount_min?: number
          p_category_id?: string
          p_company_id: string
          p_currency?: string
          p_date_from: string
          p_date_to: string
          p_direction: string
          p_issue_date_from?: string
          p_issue_date_to?: string
          p_page?: number
          p_page_size?: number
          p_payment_method?: string
          p_project_id?: string
          p_search?: string
          p_sort_dir?: string
          p_sort_field?: string
        }
        Returns: {
          adoalap_osszesen: number
          afa_osszeg_osszesen: number
          bizonylatsorszam: string
          brutto_vegosszeg: number
          category_id: string
          elado_nev: string
          fizetesi_mod: string
          id: string
          image_url: string
          invoice_direction: string
          kibocsatas_datuma: string
          melleklet_url: string
          penznem: string
          project_id: string
          reference_number: string
          teljesites_datuma: string
          total_count: number
          vevo_nev: string
        }[]
      }
      get_gl_balances: {
        Args: {
          p_company_id: string
          p_date_from?: string
          p_date_to?: string
          p_exchange_rates?: Json
          p_preset_id: string
        }
        Returns: {
          gl_account_id: string
          gl_number: string
          short_name: string
          total_balance: number
        }[]
      }
      get_gl_categorized_items: {
        Args: {
          p_company_id: string
          p_date_from?: string
          p_date_to?: string
          p_exchange_rates?: Json
          p_preset_id: string
        }
        Returns: {
          amount: number
          description: string
          document_url: string
          gl_account_id: string
          item_date: string
          item_id: string
          item_type: string
          original_amount: number
          original_currency: string
          partner: string
          source_table: string
        }[]
      }
      get_invoice_aggregates: {
        Args: { p_company_id: string; p_date_from: string; p_date_to: string }
        Returns: {
          completed_count: number
          currency: string
          processing_count: number
          total_count: number
          total_gross: number
        }[]
      }
      get_linked_invoices: {
        Args: {
          p_company_id: string
          p_exclude_ids: string[]
          p_seed_bizonylat: string[]
          p_seed_reference: string[]
        }
        Returns: {
          adoalap_osszesen: number
          afa_osszeg_osszesen: number
          bizonylatsorszam: string
          brutto_vegosszeg: number
          category_id: string
          elado_nev: string
          id: string
          image_url: string
          invoice_direction: string
          kibocsatas_datuma: string
          melleklet_url: string
          penznem: string
          project_id: string
          reference_number: string
          teljesites_datuma: string
          vevo_nev: string
        }[]
      }
      get_nav_credentials: {
        Args: { p_company_id?: string; p_user_id: string }
        Returns: Json
      }
      get_nav_invoice_aggregates: {
        Args: { p_company_id: string; p_date_from: string; p_date_to: string }
        Returns: {
          currency: string
          invoice_count: number
          invoice_direction: string
          paid_gross: number
          paid_net: number
          total_gross: number
          total_net: number
          total_vat: number
          unpaid_gross: number
          unpaid_net: number
        }[]
      }
      get_petty_cash_balance: {
        Args: { p_company_id: string }
        Returns: {
          balance: number
          has_settings: boolean
        }[]
      }
      get_pnl_report: {
        Args: {
          p_company_id: string
          p_date_from?: string
          p_date_to?: string
          p_preset_id: string
        }
        Returns: {
          balance: number
          gl_accounts: Json
          multiplier: number
          name: string
          order_num: number
          pnl_structure_id: string
          row_code: string
          type: string
        }[]
      }
      get_transaction_filter_options: {
        Args: { p_company_id: string }
        Returns: {
          currencies: string[]
          types: string[]
        }[]
      }
      get_user_emails_for_management: {
        Args: { user_ids: string[] }
        Returns: {
          email: string
          id: string
        }[]
      }
      get_user_role: { Args: { p_company_id: string }; Returns: string }
      increment_invoice_usage: { Args: { user_uuid: string }; Returns: boolean }
      is_company_admin: { Args: { p_company_id: string }; Returns: boolean }
      is_company_member_or_above: {
        Args: { p_company_id: string }
        Returns: boolean
      }
      override_gl_classification: {
        Args: {
          p_company_id: string
          p_item_id: string
          p_new_gl_account_id: string
          p_new_gl_number: string
          p_original_gl_account_id: string
          p_preset_id: string
          p_source_table: string
          p_user_id: string
        }
        Returns: boolean
      }
      override_gl_classifications_batch: {
        Args: {
          p_company_id: string
          p_items: Json
          p_new_gl_account_id: string
          p_new_gl_number: string
          p_preset_id: string
          p_user_id: string
        }
        Returns: boolean
      }
      pgmq_archive: {
        Args: { msg_id: number; queue_name: string }
        Returns: boolean
      }
      pgmq_delete: {
        Args: { msg_id: number; queue_name: string }
        Returns: boolean
      }
      pgmq_metrics: { Args: { queue_name: string }; Returns: Json[] }
      pgmq_read: {
        Args: {
          max_poll_seconds?: number
          poll_interval_ms?: number
          qty?: number
          queue_name: string
          vt: number
        }
        Returns: Json[]
      }
      reset_monthly_usage: { Args: never; Returns: number }
      save_nav_credentials: {
        Args: {
          p_company_id?: string
          p_is_test_environment?: boolean
          p_nav_exchange_key: string
          p_nav_password: string
          p_nav_sign_key: string
          p_nav_tax_number: string
          p_nav_username: string
          p_software_dev_contact?: string
          p_software_dev_name?: string
        }
        Returns: Json
      }
      save_pnl_mappings: {
        Args: { p_company_id: string; p_mappings: Json; p_preset_id: string }
        Returns: undefined
      }
      sync_sandbox_from_taxology: { Args: never; Returns: undefined }
      user_has_company_access: {
        Args: { p_company_id: string }
        Returns: boolean
      }
      user_is_company_member: {
        Args: { p_company_id: string }
        Returns: boolean
      }
    }
    Enums: {
      audit_action_type:
        | "létrehozás"
        | "módosítás"
        | "törlés"
        | "feltöltés"
        | "párosítás"
        | "aktiválás"
      audit_entity_type:
        | "számla"
        | "bérjegyzék"
        | "tranzakció"
        | "kategória"
        | "dokumentum"
        | "tárgyi_eszköz"
      salary_item_type: "bér" | "ÁFA" | "adó" | "járulék"
      salary_payment_method: "banki tranzakció" | "készpénz"
      salary_status_type: "Függő" | "Kifizetve"
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
      audit_action_type: [
        "létrehozás",
        "módosítás",
        "törlés",
        "feltöltés",
        "párosítás",
        "aktiválás",
      ],
      audit_entity_type: [
        "számla",
        "bérjegyzék",
        "tranzakció",
        "kategória",
        "dokumentum",
        "tárgyi_eszköz",
      ],
      salary_item_type: ["bér", "ÁFA", "adó", "járulék"],
      salary_payment_method: ["banki tranzakció", "készpénz"],
      salary_status_type: ["Függő", "Kifizetve"],
    },
  },
} as const
