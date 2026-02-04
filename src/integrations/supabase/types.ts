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
      companies: {
        Row: {
          address: string | null
          created_at: string
          id: string
          name: string
          owner_id: string
          tax_number: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          id?: string
          name: string
          owner_id: string
          tax_number?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          id?: string
          name?: string
          owner_id?: string
          tax_number?: string | null
          updated_at?: string
        }
        Relationships: []
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
      invoice_uploads: {
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
          id: string
          image_url: string | null
          invoice_type: string
          kibocsatas_datuma: string
          letrehozva: string
          melleklet_url: string | null
          onszamlazas: boolean | null
          penzforgalmi_elszamolas: boolean | null
          penznem: string | null
          project_id: string | null
          statusz: string | null
          szamlaszam: string
          teljesites_datuma: string | null
          termek_szolgaltatas_tipusa: string | null
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
          id?: string
          image_url?: string | null
          invoice_type?: string
          kibocsatas_datuma: string
          letrehozva?: string
          melleklet_url?: string | null
          onszamlazas?: boolean | null
          penzforgalmi_elszamolas?: boolean | null
          penznem?: string | null
          project_id?: string | null
          statusz?: string | null
          szamlaszam: string
          teljesites_datuma?: string | null
          termek_szolgaltatas_tipusa?: string | null
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
          id?: string
          image_url?: string | null
          invoice_type?: string
          kibocsatas_datuma?: string
          letrehozva?: string
          melleklet_url?: string | null
          onszamlazas?: boolean | null
          penzforgalmi_elszamolas?: boolean | null
          penznem?: string | null
          project_id?: string | null
          statusz?: string | null
          szamlaszam?: string
          teljesites_datuma?: string | null
          termek_szolgaltatas_tipusa?: string | null
          user_id?: string
          vevo_cim?: string | null
          vevo_nev?: string
          vevo_vat_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_project_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      nav_invoice_items: {
        Row: {
          created_at: string | null
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
      profiles: {
        Row: {
          avatar_url: string | null
          company: string | null
          created_at: string
          has_completed_tour: boolean | null
          id: string
          name: string | null
          position: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          company?: string | null
          created_at?: string
          has_completed_tour?: boolean | null
          id?: string
          name?: string | null
          position?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          company?: string | null
          created_at?: string
          has_completed_tour?: boolean | null
          id?: string
          name?: string | null
          position?: string | null
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
          id: string
          név: string
          összeg: number
          updated_at: string
          user_id: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          dátum?: string | null
          id?: string
          név: string
          összeg: number
          updated_at?: string
          user_id: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          dátum?: string | null
          id?: string
          név?: string
          összeg?: number
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
          szamlaszam: string
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
          szamlaszam: string
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
          szamlaszam?: string
          teljesites_datuma?: string | null
          updated_at?: string
          user_id?: string
          vevo_cim?: string | null
          vevo_nev?: string
          vevo_vat_id?: string | null
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
            foreignKeyName: "transactions_matched_invoice_id_fkey"
            columns: ["matched_invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
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
          created_at: string | null
          id: string
          invoice_failed: boolean | null
          invoice_processed: boolean | null
          monthly_summary: boolean | null
          subscription_warnings: boolean | null
          updated_at: string | null
          user_id: string
          weekly_summary: boolean | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          invoice_failed?: boolean | null
          invoice_processed?: boolean | null
          monthly_summary?: boolean | null
          subscription_warnings?: boolean | null
          updated_at?: string | null
          user_id: string
          weekly_summary?: boolean | null
        }
        Update: {
          created_at?: string | null
          id?: string
          invoice_failed?: boolean | null
          invoice_processed?: boolean | null
          monthly_summary?: boolean | null
          subscription_warnings?: boolean | null
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
      [_ in never]: never
    }
    Functions: {
      assign_supplier_default_projects: {
        Args: { p_company_id: string }
        Returns: number
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
      increment_invoice_usage: { Args: { user_uuid: string }; Returns: boolean }
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
      user_has_company_access: {
        Args: { p_company_id: string }
        Returns: boolean
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
