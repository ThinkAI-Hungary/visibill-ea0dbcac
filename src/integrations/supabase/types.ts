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
      accounty_assignments: {
        Row: {
          accountant_user_id: string
          accounting_firm_id: string | null
          assigned_at: string | null
          company_id: string
          created_at: string | null
          id: string
          is_main_accountant: boolean
          is_primary: boolean | null
          kanban_status: string | null
          role: string
          source: string
          updated_at: string | null
        }
        Insert: {
          accountant_user_id: string
          accounting_firm_id?: string | null
          assigned_at?: string | null
          company_id: string
          created_at?: string | null
          id?: string
          is_main_accountant?: boolean
          is_primary?: boolean | null
          kanban_status?: string | null
          role?: string
          source?: string
          updated_at?: string | null
        }
        Update: {
          accountant_user_id?: string
          accounting_firm_id?: string | null
          assigned_at?: string | null
          company_id?: string
          created_at?: string | null
          id?: string
          is_main_accountant?: boolean
          is_primary?: boolean | null
          kanban_status?: string | null
          role?: string
          source?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "accounty_assignments_accounting_firm_id_fkey"
            columns: ["accounting_firm_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounty_assignments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      accounty_audit_log: {
        Row: {
          action: string
          company_id: string | null
          company_name: string | null
          created_at: string | null
          details: Json | null
          entity_id: string | null
          entity_type: string
          id: string
          user_id: string | null
          user_name: string | null
        }
        Insert: {
          action: string
          company_id?: string | null
          company_name?: string | null
          created_at?: string | null
          details?: Json | null
          entity_id?: string | null
          entity_type: string
          id?: string
          user_id?: string | null
          user_name?: string | null
        }
        Update: {
          action?: string
          company_id?: string | null
          company_name?: string | null
          created_at?: string | null
          details?: Json | null
          entity_id?: string | null
          entity_type?: string
          id?: string
          user_id?: string | null
          user_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "accounty_audit_log_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      accounty_cafeteria: {
        Row: {
          amount: number
          benefit_type: string
          card_number: string | null
          created_at: string | null
          cycle_id: string | null
          employment_id: string
          id: string
          provider: string | null
          status: string | null
          tax_rate: number | null
        }
        Insert: {
          amount: number
          benefit_type: string
          card_number?: string | null
          created_at?: string | null
          cycle_id?: string | null
          employment_id: string
          id?: string
          provider?: string | null
          status?: string | null
          tax_rate?: number | null
        }
        Update: {
          amount?: number
          benefit_type?: string
          card_number?: string | null
          created_at?: string | null
          cycle_id?: string | null
          employment_id?: string
          id?: string
          provider?: string | null
          status?: string | null
          tax_rate?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "accounty_cafeteria_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "accounty_payroll_cycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounty_cafeteria_employment_id_fkey"
            columns: ["employment_id"]
            isOneToOne: false
            referencedRelation: "accounty_employments"
            referencedColumns: ["id"]
          },
        ]
      }
      accounty_cegkapu_settings: {
        Row: {
          auto_receipt: boolean | null
          capacity_total: number | null
          capacity_used: number | null
          company_id: string
          created_at: string | null
          id: string
          last_sync: string | null
          polling_frequency: string | null
          signer_kau_id: string | null
          signer_kau_type: string | null
          signer_name: string | null
          signer_verified: boolean | null
          tarhely_company_name: string | null
          tarhely_id: string | null
          tarhely_status: string
          tarhely_type: string
          updated_at: string | null
        }
        Insert: {
          auto_receipt?: boolean | null
          capacity_total?: number | null
          capacity_used?: number | null
          company_id: string
          created_at?: string | null
          id?: string
          last_sync?: string | null
          polling_frequency?: string | null
          signer_kau_id?: string | null
          signer_kau_type?: string | null
          signer_name?: string | null
          signer_verified?: boolean | null
          tarhely_company_name?: string | null
          tarhely_id?: string | null
          tarhely_status?: string
          tarhely_type?: string
          updated_at?: string | null
        }
        Update: {
          auto_receipt?: boolean | null
          capacity_total?: number | null
          capacity_used?: number | null
          company_id?: string
          created_at?: string | null
          id?: string
          last_sync?: string | null
          polling_frequency?: string | null
          signer_kau_id?: string | null
          signer_kau_type?: string | null
          signer_name?: string | null
          signer_verified?: boolean | null
          tarhely_company_name?: string | null
          tarhely_id?: string | null
          tarhely_status?: string
          tarhely_type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "accounty_cegkapu_settings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      accounty_communication_preferences: {
        Row: {
          auto_reminder: boolean | null
          channel_email: boolean | null
          channel_phone: boolean | null
          channel_sms: boolean | null
          channel_viber: boolean | null
          company_id: string
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string | null
          gdpr_opted_in: boolean | null
          gdpr_opted_in_at: string | null
          id: string
          preferred_language: string | null
          reminder_frequency: string | null
          updated_at: string | null
        }
        Insert: {
          auto_reminder?: boolean | null
          channel_email?: boolean | null
          channel_phone?: boolean | null
          channel_sms?: boolean | null
          channel_viber?: boolean | null
          company_id: string
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string | null
          gdpr_opted_in?: boolean | null
          gdpr_opted_in_at?: string | null
          id?: string
          preferred_language?: string | null
          reminder_frequency?: string | null
          updated_at?: string | null
        }
        Update: {
          auto_reminder?: boolean | null
          channel_email?: boolean | null
          channel_phone?: boolean | null
          channel_sms?: boolean | null
          channel_viber?: boolean | null
          company_id?: string
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string | null
          gdpr_opted_in?: boolean | null
          gdpr_opted_in_at?: string | null
          id?: string
          preferred_language?: string | null
          reminder_frequency?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "accounty_communication_preferences_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      accounty_cost_centers: {
        Row: {
          code: string
          company_id: string
          created_at: string | null
          headcount: number | null
          id: string
          name: string
          parent_id: string | null
          responsible: string | null
          updated_at: string | null
        }
        Insert: {
          code?: string
          company_id: string
          created_at?: string | null
          headcount?: number | null
          id?: string
          name: string
          parent_id?: string | null
          responsible?: string | null
          updated_at?: string | null
        }
        Update: {
          code?: string
          company_id?: string
          created_at?: string | null
          headcount?: number | null
          id?: string
          name?: string
          parent_id?: string | null
          responsible?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "accounty_cost_centers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounty_cost_centers_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "accounty_cost_centers"
            referencedColumns: ["id"]
          },
        ]
      }
      accounty_data_contracts: {
        Row: {
          company_id: string
          created_at: string | null
          file_name: string | null
          file_url: string | null
          id: string
          partner_name: string
          status: string
          updated_at: string | null
          upload_date: string | null
          valid_until: string | null
        }
        Insert: {
          company_id: string
          created_at?: string | null
          file_name?: string | null
          file_url?: string | null
          id?: string
          partner_name: string
          status?: string
          updated_at?: string | null
          upload_date?: string | null
          valid_until?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string | null
          file_name?: string | null
          file_url?: string | null
          id?: string
          partner_name?: string
          status?: string
          updated_at?: string | null
          upload_date?: string | null
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "accounty_data_contracts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      accounty_deadlines: {
        Row: {
          company_id: string
          completed_at: string | null
          completed_by: string | null
          created_at: string | null
          deadline_type: string
          due_date: string
          id: string
          is_manual_override: boolean | null
          notes: string | null
          status: string | null
          title: string | null
          updated_at: string | null
        }
        Insert: {
          company_id: string
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string | null
          deadline_type: string
          due_date: string
          id?: string
          is_manual_override?: boolean | null
          notes?: string | null
          status?: string | null
          title?: string | null
          updated_at?: string | null
        }
        Update: {
          company_id?: string
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string | null
          deadline_type?: string
          due_date?: string
          id?: string
          is_manual_override?: boolean | null
          notes?: string | null
          status?: string | null
          title?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "accounty_deadlines_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      accounty_declarations: {
        Row: {
          created_at: string | null
          declaration_type: string
          document_url: string | null
          employee_id: string
          id: string
          nav_receipt_id: string | null
          parameters: Json
          status: string | null
          updated_at: string | null
          valid_from: string
          valid_until: string | null
        }
        Insert: {
          created_at?: string | null
          declaration_type: string
          document_url?: string | null
          employee_id: string
          id?: string
          nav_receipt_id?: string | null
          parameters?: Json
          status?: string | null
          updated_at?: string | null
          valid_from: string
          valid_until?: string | null
        }
        Update: {
          created_at?: string | null
          declaration_type?: string
          document_url?: string | null
          employee_id?: string
          id?: string
          nav_receipt_id?: string | null
          parameters?: Json
          status?: string | null
          updated_at?: string | null
          valid_from?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "accounty_declarations_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "accounty_employees"
            referencedColumns: ["id"]
          },
        ]
      }
      accounty_departments: {
        Row: {
          company_id: string
          created_at: string | null
          headcount: number | null
          id: string
          manager: string | null
          name: string
          site_id: string | null
          updated_at: string | null
        }
        Insert: {
          company_id: string
          created_at?: string | null
          headcount?: number | null
          id?: string
          manager?: string | null
          name: string
          site_id?: string | null
          updated_at?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string | null
          headcount?: number | null
          id?: string
          manager?: string | null
          name?: string
          site_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "accounty_departments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounty_departments_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "accounty_sites"
            referencedColumns: ["id"]
          },
        ]
      }
      accounty_documents: {
        Row: {
          company_id: string
          created_at: string | null
          doc_type: string
          employee_id: string | null
          file_url: string | null
          generated_at: string | null
          id: string
          period: string | null
          status: string
          title: string
          updated_at: string | null
        }
        Insert: {
          company_id: string
          created_at?: string | null
          doc_type?: string
          employee_id?: string | null
          file_url?: string | null
          generated_at?: string | null
          id?: string
          period?: string | null
          status?: string
          title: string
          updated_at?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string | null
          doc_type?: string
          employee_id?: string | null
          file_url?: string | null
          generated_at?: string | null
          id?: string
          period?: string | null
          status?: string
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "accounty_documents_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounty_documents_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "accounty_employees"
            referencedColumns: ["id"]
          },
        ]
      }
      accounty_employee_jobs: {
        Row: {
          base_salary: number | null
          company_id: string
          created_at: string | null
          employee_id: string
          employer: string | null
          end_date: string | null
          feor: string | null
          id: string
          insured: boolean | null
          job_code: string
          job_code_label: string | null
          minimum_base: boolean | null
          position: string | null
          seq_num: number | null
          start_date: string
          status: string
          updated_at: string | null
          weekly_hours: number | null
        }
        Insert: {
          base_salary?: number | null
          company_id: string
          created_at?: string | null
          employee_id: string
          employer?: string | null
          end_date?: string | null
          feor?: string | null
          id?: string
          insured?: boolean | null
          job_code?: string
          job_code_label?: string | null
          minimum_base?: boolean | null
          position?: string | null
          seq_num?: number | null
          start_date: string
          status?: string
          updated_at?: string | null
          weekly_hours?: number | null
        }
        Update: {
          base_salary?: number | null
          company_id?: string
          created_at?: string | null
          employee_id?: string
          employer?: string | null
          end_date?: string | null
          feor?: string | null
          id?: string
          insured?: boolean | null
          job_code?: string
          job_code_label?: string | null
          minimum_base?: boolean | null
          position?: string | null
          seq_num?: number | null
          start_date?: string
          status?: string
          updated_at?: string | null
          weekly_hours?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "accounty_employee_jobs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounty_employee_jobs_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "accounty_employees"
            referencedColumns: ["id"]
          },
        ]
      }
      accounty_employees: {
        Row: {
          address: Json | null
          avatar_url: string | null
          bank_account: string | null
          birth_date: string | null
          birth_name: string | null
          birth_place: string | null
          company_id: string
          created_at: string | null
          email: string | null
          first_name: string
          gender: string | null
          iban: string | null
          id: string
          id_card_number: string | null
          last_name: string
          mothers_name: string | null
          nationality: string | null
          phone: string | null
          status: string | null
          taj_number: string | null
          tax_id: string | null
          temp_address: Json | null
          updated_at: string | null
        }
        Insert: {
          address?: Json | null
          avatar_url?: string | null
          bank_account?: string | null
          birth_date?: string | null
          birth_name?: string | null
          birth_place?: string | null
          company_id: string
          created_at?: string | null
          email?: string | null
          first_name: string
          gender?: string | null
          iban?: string | null
          id?: string
          id_card_number?: string | null
          last_name: string
          mothers_name?: string | null
          nationality?: string | null
          phone?: string | null
          status?: string | null
          taj_number?: string | null
          tax_id?: string | null
          temp_address?: Json | null
          updated_at?: string | null
        }
        Update: {
          address?: Json | null
          avatar_url?: string | null
          bank_account?: string | null
          birth_date?: string | null
          birth_name?: string | null
          birth_place?: string | null
          company_id?: string
          created_at?: string | null
          email?: string | null
          first_name?: string
          gender?: string | null
          iban?: string | null
          id?: string
          id_card_number?: string | null
          last_name?: string
          mothers_name?: string | null
          nationality?: string | null
          phone?: string | null
          status?: string | null
          taj_number?: string | null
          tax_id?: string | null
          temp_address?: Json | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "accounty_employees_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      accounty_employments: {
        Row: {
          base_salary: number | null
          company_id: string
          cost_center: string | null
          created_at: string | null
          department: string | null
          employee_id: string
          employment_type: string
          end_date: string | null
          feor_code: string | null
          id: string
          is_fixed_term: boolean | null
          is_insured: boolean | null
          job_code: string
          job_serial_number: number | null
          job_title: string | null
          location_id: string | null
          metadata: Json | null
          probation_end: string | null
          remote_work_days_per_week: number | null
          remote_work_type: string | null
          salary_type: string | null
          start_date: string
          status: string | null
          updated_at: string | null
          weekly_hours: number | null
        }
        Insert: {
          base_salary?: number | null
          company_id: string
          cost_center?: string | null
          created_at?: string | null
          department?: string | null
          employee_id: string
          employment_type: string
          end_date?: string | null
          feor_code?: string | null
          id?: string
          is_fixed_term?: boolean | null
          is_insured?: boolean | null
          job_code: string
          job_serial_number?: number | null
          job_title?: string | null
          location_id?: string | null
          metadata?: Json | null
          probation_end?: string | null
          remote_work_days_per_week?: number | null
          remote_work_type?: string | null
          salary_type?: string | null
          start_date: string
          status?: string | null
          updated_at?: string | null
          weekly_hours?: number | null
        }
        Update: {
          base_salary?: number | null
          company_id?: string
          cost_center?: string | null
          created_at?: string | null
          department?: string | null
          employee_id?: string
          employment_type?: string
          end_date?: string | null
          feor_code?: string | null
          id?: string
          is_fixed_term?: boolean | null
          is_insured?: boolean | null
          job_code?: string
          job_serial_number?: number | null
          job_title?: string | null
          location_id?: string | null
          metadata?: Json | null
          probation_end?: string | null
          remote_work_days_per_week?: number | null
          remote_work_type?: string | null
          salary_type?: string | null
          start_date?: string
          status?: string | null
          updated_at?: string | null
          weekly_hours?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "accounty_employments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounty_employments_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "accounty_employees"
            referencedColumns: ["id"]
          },
        ]
      }
      accounty_filings: {
        Row: {
          channel: string | null
          company_id: string
          created_at: string | null
          error_codes: Json | null
          filing_type: string
          id: string
          nav_receipt_id: string | null
          nav_receipt_status: string | null
          period_month: number | null
          period_quarter: number | null
          period_year: number | null
          signed_at: string | null
          signed_by: string | null
          status: string | null
          submitted_at: string | null
          updated_at: string | null
          xml_data: string | null
        }
        Insert: {
          channel?: string | null
          company_id: string
          created_at?: string | null
          error_codes?: Json | null
          filing_type: string
          id?: string
          nav_receipt_id?: string | null
          nav_receipt_status?: string | null
          period_month?: number | null
          period_quarter?: number | null
          period_year?: number | null
          signed_at?: string | null
          signed_by?: string | null
          status?: string | null
          submitted_at?: string | null
          updated_at?: string | null
          xml_data?: string | null
        }
        Update: {
          channel?: string | null
          company_id?: string
          created_at?: string | null
          error_codes?: Json | null
          filing_type?: string
          id?: string
          nav_receipt_id?: string | null
          nav_receipt_status?: string | null
          period_month?: number | null
          period_quarter?: number | null
          period_year?: number | null
          signed_at?: string | null
          signed_by?: string | null
          status?: string | null
          submitted_at?: string | null
          updated_at?: string | null
          xml_data?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "accounty_filings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      accounty_garnishments: {
        Row: {
          created_at: string | null
          creditor_account: string | null
          creditor_name: string | null
          decree_number: string | null
          employee_id: string
          garnishment_type: string
          id: string
          is_active: boolean | null
          max_deduction_pct: number | null
          monthly_deduction: number | null
          original_amount: number | null
          priority: number | null
          remaining_amount: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          creditor_account?: string | null
          creditor_name?: string | null
          decree_number?: string | null
          employee_id: string
          garnishment_type: string
          id?: string
          is_active?: boolean | null
          max_deduction_pct?: number | null
          monthly_deduction?: number | null
          original_amount?: number | null
          priority?: number | null
          remaining_amount?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          creditor_account?: string | null
          creditor_name?: string | null
          decree_number?: string | null
          employee_id?: string
          garnishment_type?: string
          id?: string
          is_active?: boolean | null
          max_deduction_pct?: number | null
          monthly_deduction?: number | null
          original_amount?: number | null
          priority?: number | null
          remaining_amount?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "accounty_garnishments_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "accounty_employees"
            referencedColumns: ["id"]
          },
        ]
      }
      accounty_gdpr_requests: {
        Row: {
          company_id: string
          completed_at: string | null
          created_at: string
          employee_id: string | null
          employee_name: string
          handled_by: string | null
          id: string
          notes: string | null
          request_type: string
          requested_at: string
          status: string
        }
        Insert: {
          company_id: string
          completed_at?: string | null
          created_at?: string
          employee_id?: string | null
          employee_name: string
          handled_by?: string | null
          id?: string
          notes?: string | null
          request_type: string
          requested_at?: string
          status?: string
        }
        Update: {
          company_id?: string
          completed_at?: string | null
          created_at?: string
          employee_id?: string | null
          employee_name?: string
          handled_by?: string | null
          id?: string
          notes?: string | null
          request_type?: string
          requested_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "accounty_gdpr_requests_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      accounty_job_codes: {
        Row: {
          code: string
          created_at: string | null
          description: string | null
          id: string | null
          is_active: boolean | null
          is_insured: boolean | null
          min_contribution_base_rule: string | null
          name: string
          nav_reference_url: string | null
          notes: string | null
          updated_at: string | null
          valid_from: string | null
          valid_to: string | null
          valid_until: string | null
        }
        Insert: {
          code: string
          created_at?: string | null
          description?: string | null
          id?: string | null
          is_active?: boolean | null
          is_insured?: boolean | null
          min_contribution_base_rule?: string | null
          name: string
          nav_reference_url?: string | null
          notes?: string | null
          updated_at?: string | null
          valid_from?: string | null
          valid_to?: string | null
          valid_until?: string | null
        }
        Update: {
          code?: string
          created_at?: string | null
          description?: string | null
          id?: string | null
          is_active?: boolean | null
          is_insured?: boolean | null
          min_contribution_base_rule?: string | null
          name?: string
          nav_reference_url?: string | null
          notes?: string | null
          updated_at?: string | null
          valid_from?: string | null
          valid_to?: string | null
          valid_until?: string | null
        }
        Relationships: []
      }
      accounty_job_modifications: {
        Row: {
          change_type: string
          company_id: string
          created_at: string | null
          effective_date: string
          employee_id: string
          generate_08e: boolean | null
          id: string
          job_id: string | null
          new_value: string | null
          old_value: string | null
          reason: string | null
        }
        Insert: {
          change_type: string
          company_id: string
          created_at?: string | null
          effective_date: string
          employee_id: string
          generate_08e?: boolean | null
          id?: string
          job_id?: string | null
          new_value?: string | null
          old_value?: string | null
          reason?: string | null
        }
        Update: {
          change_type?: string
          company_id?: string
          created_at?: string | null
          effective_date?: string
          employee_id?: string
          generate_08e?: boolean | null
          id?: string
          job_id?: string | null
          new_value?: string | null
          old_value?: string | null
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "accounty_job_modifications_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounty_job_modifications_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "accounty_employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounty_job_modifications_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "accounty_employee_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      accounty_leaves: {
        Row: {
          created_at: string | null
          cycle_id: string | null
          daily_rate: number | null
          days: number
          employment_id: string
          end_date: string
          id: string
          leave_type: string
          metadata: Json | null
          start_date: string
          status: string | null
        }
        Insert: {
          created_at?: string | null
          cycle_id?: string | null
          daily_rate?: number | null
          days: number
          employment_id: string
          end_date: string
          id?: string
          leave_type: string
          metadata?: Json | null
          start_date: string
          status?: string | null
        }
        Update: {
          created_at?: string | null
          cycle_id?: string | null
          daily_rate?: number | null
          days?: number
          employment_id?: string
          end_date?: string
          id?: string
          leave_type?: string
          metadata?: Json | null
          start_date?: string
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "accounty_leaves_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "accounty_payroll_cycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounty_leaves_employment_id_fkey"
            columns: ["employment_id"]
            isOneToOne: false
            referencedRelation: "accounty_employments"
            referencedColumns: ["id"]
          },
        ]
      }
      accounty_legal_updates: {
        Row: {
          affected_modules: string[] | null
          created_at: string
          created_by: string | null
          id: string
          implementation_status: string
          notes: string | null
          published_at: string | null
          source: string
          title: string
          updated_at: string
        }
        Insert: {
          affected_modules?: string[] | null
          created_at?: string
          created_by?: string | null
          id?: string
          implementation_status?: string
          notes?: string | null
          published_at?: string | null
          source: string
          title: string
          updated_at?: string
        }
        Update: {
          affected_modules?: string[] | null
          created_at?: string
          created_by?: string | null
          id?: string
          implementation_status?: string
          notes?: string | null
          published_at?: string | null
          source?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      accounty_messages: {
        Row: {
          company_id: string
          created_at: string | null
          id: string
          is_from_client: boolean | null
          message: string
          sender_name: string
          sender_user_id: string | null
        }
        Insert: {
          company_id: string
          created_at?: string | null
          id?: string
          is_from_client?: boolean | null
          message: string
          sender_name: string
          sender_user_id?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string | null
          id?: string
          is_from_client?: boolean | null
          message?: string
          sender_name?: string
          sender_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "accounty_messages_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      accounty_missing_items: {
        Row: {
          amount: number | null
          category: string
          company_id: string
          created_at: string | null
          details: string | null
          escalation_level: number | null
          id: string
          ignored_at: string | null
          ignored_by: string | null
          invoice_number: string | null
          is_ignored: boolean | null
          item_date: string | null
          last_notified_at: string | null
          nav_invoice_id: string | null
          notification_count: number | null
          priority: string | null
          resolve_route: string | null
          resolved_at: string | null
          resolved_by: string | null
          source: string
          status: string | null
          subtitle: string | null
          title: string
          transaction_id: string | null
          updated_at: string | null
          uploaded_files: string[] | null
        }
        Insert: {
          amount?: number | null
          category: string
          company_id: string
          created_at?: string | null
          details?: string | null
          escalation_level?: number | null
          id?: string
          ignored_at?: string | null
          ignored_by?: string | null
          invoice_number?: string | null
          is_ignored?: boolean | null
          item_date?: string | null
          last_notified_at?: string | null
          nav_invoice_id?: string | null
          notification_count?: number | null
          priority?: string | null
          resolve_route?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          source: string
          status?: string | null
          subtitle?: string | null
          title: string
          transaction_id?: string | null
          updated_at?: string | null
          uploaded_files?: string[] | null
        }
        Update: {
          amount?: number | null
          category?: string
          company_id?: string
          created_at?: string | null
          details?: string | null
          escalation_level?: number | null
          id?: string
          ignored_at?: string | null
          ignored_by?: string | null
          invoice_number?: string | null
          is_ignored?: boolean | null
          item_date?: string | null
          last_notified_at?: string | null
          nav_invoice_id?: string | null
          notification_count?: number | null
          priority?: string | null
          resolve_route?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          source?: string
          status?: string | null
          subtitle?: string | null
          title?: string
          transaction_id?: string | null
          updated_at?: string | null
          uploaded_files?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "accounty_missing_items_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounty_missing_items_nav_invoice_id_fkey"
            columns: ["nav_invoice_id"]
            isOneToOne: false
            referencedRelation: "nav_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounty_missing_items_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      accounty_module_permissions: {
        Row: {
          accounting_firm_id: string
          can_read: boolean | null
          can_write: boolean | null
          created_at: string | null
          id: string
          module_name: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          accounting_firm_id: string
          can_read?: boolean | null
          can_write?: boolean | null
          created_at?: string | null
          id?: string
          module_name: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          accounting_firm_id?: string
          can_read?: boolean | null
          can_write?: boolean | null
          created_at?: string | null
          id?: string
          module_name?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "accounty_module_permissions_accounting_firm_id_fkey"
            columns: ["accounting_firm_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      accounty_nav_representations: {
        Row: {
          company_id: string
          created_at: string | null
          end_date: string | null
          id: string
          name: string
          registration_number: string | null
          rep_type: string
          scope: string
          scope_details: string | null
          start_date: string
          status: string
          tax_id: string
          updated_at: string | null
        }
        Insert: {
          company_id: string
          created_at?: string | null
          end_date?: string | null
          id?: string
          name?: string
          registration_number?: string | null
          rep_type?: string
          scope?: string
          scope_details?: string | null
          start_date?: string
          status?: string
          tax_id?: string
          updated_at?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string | null
          end_date?: string | null
          id?: string
          name?: string
          registration_number?: string | null
          rep_type?: string
          scope?: string
          scope_details?: string | null
          start_date?: string
          status?: string
          tax_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "accounty_nav_representations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      accounty_office_settings: {
        Row: {
          created_at: string | null
          id: string
          settings: Json
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          settings?: Json
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          settings?: Json
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      accounty_payroll_calculations: {
        Row: {
          cafeteria_tax: Json | null
          created_at: string | null
          cycle_id: string
          deductions: Json | null
          employment_id: string
          gross_salary: number | null
          id: string
          metadata: Json | null
          net_salary: number | null
          szja_amount: number | null
          szja_base: number | null
          szocho_amount: number | null
          szocho_credits: Json | null
          tax_credits: Json | null
          tb_amount: number | null
        }
        Insert: {
          cafeteria_tax?: Json | null
          created_at?: string | null
          cycle_id: string
          deductions?: Json | null
          employment_id: string
          gross_salary?: number | null
          id?: string
          metadata?: Json | null
          net_salary?: number | null
          szja_amount?: number | null
          szja_base?: number | null
          szocho_amount?: number | null
          szocho_credits?: Json | null
          tax_credits?: Json | null
          tb_amount?: number | null
        }
        Update: {
          cafeteria_tax?: Json | null
          created_at?: string | null
          cycle_id?: string
          deductions?: Json | null
          employment_id?: string
          gross_salary?: number | null
          id?: string
          metadata?: Json | null
          net_salary?: number | null
          szja_amount?: number | null
          szja_base?: number | null
          szocho_amount?: number | null
          szocho_credits?: Json | null
          tax_credits?: Json | null
          tb_amount?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "accounty_payroll_calculations_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "accounty_payroll_cycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounty_payroll_calculations_employment_id_fkey"
            columns: ["employment_id"]
            isOneToOne: false
            referencedRelation: "accounty_employments"
            referencedColumns: ["id"]
          },
        ]
      }
      accounty_payroll_cycles: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          company_id: string
          created_at: string | null
          current_step: number | null
          id: string
          month: number
          notes: string | null
          status: string | null
          updated_at: string | null
          year: number
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          company_id: string
          created_at?: string | null
          current_step?: number | null
          id?: string
          month: number
          notes?: string | null
          status?: string | null
          updated_at?: string | null
          year: number
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          company_id?: string
          created_at?: string | null
          current_step?: number | null
          id?: string
          month?: number
          notes?: string | null
          status?: string | null
          updated_at?: string | null
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "accounty_payroll_cycles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      accounty_payroll_items: {
        Row: {
          amount: number
          created_at: string | null
          cycle_id: string
          days: number | null
          description: string | null
          employment_id: string
          hours: number | null
          id: string
          is_deduction: boolean | null
          item_type: string
          rate_pct: number | null
        }
        Insert: {
          amount: number
          created_at?: string | null
          cycle_id: string
          days?: number | null
          description?: string | null
          employment_id: string
          hours?: number | null
          id?: string
          is_deduction?: boolean | null
          item_type: string
          rate_pct?: number | null
        }
        Update: {
          amount?: number
          created_at?: string | null
          cycle_id?: string
          days?: number | null
          description?: string | null
          employment_id?: string
          hours?: number | null
          id?: string
          is_deduction?: boolean | null
          item_type?: string
          rate_pct?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "accounty_payroll_items_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "accounty_payroll_cycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounty_payroll_items_employment_id_fkey"
            columns: ["employment_id"]
            isOneToOne: false
            referencedRelation: "accounty_employments"
            referencedColumns: ["id"]
          },
        ]
      }
      accounty_portal_tokens: {
        Row: {
          company_id: string
          created_at: string | null
          created_by: string
          expires_at: string
          id: string
          is_active: boolean | null
          last_accessed_at: string | null
          last_used_at: string | null
          requested_item_ids: string[] | null
          token: string
          visit_count: number | null
        }
        Insert: {
          company_id: string
          created_at?: string | null
          created_by: string
          expires_at: string
          id?: string
          is_active?: boolean | null
          last_accessed_at?: string | null
          last_used_at?: string | null
          requested_item_ids?: string[] | null
          token: string
          visit_count?: number | null
        }
        Update: {
          company_id?: string
          created_at?: string | null
          created_by?: string
          expires_at?: string
          id?: string
          is_active?: boolean | null
          last_accessed_at?: string | null
          last_used_at?: string | null
          requested_item_ids?: string[] | null
          token?: string
          visit_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "accounty_portal_tokens_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      accounty_retention_rules: {
        Row: {
          auto_delete: boolean | null
          company_id: string
          created_at: string | null
          doc_type: string
          id: string
          legal_basis: string | null
          retention_years: number
          updated_at: string | null
        }
        Insert: {
          auto_delete?: boolean | null
          company_id: string
          created_at?: string | null
          doc_type: string
          id?: string
          legal_basis?: string | null
          retention_years?: number
          updated_at?: string | null
        }
        Update: {
          auto_delete?: boolean | null
          company_id?: string
          created_at?: string | null
          doc_type?: string
          id?: string
          legal_basis?: string | null
          retention_years?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "accounty_retention_rules_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      accounty_sites: {
        Row: {
          address: string | null
          code: string
          company_id: string
          created_at: string | null
          headcount: number | null
          id: string
          main_activity: string | null
          name: string
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          code?: string
          company_id: string
          created_at?: string | null
          headcount?: number | null
          id?: string
          main_activity?: string | null
          name: string
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          code?: string
          company_id?: string
          created_at?: string | null
          headcount?: number | null
          id?: string
          main_activity?: string | null
          name?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "accounty_sites_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      accounty_tao_yearly: {
        Row: {
          advance_payments: number | null
          aee: number | null
          approved_at: string | null
          approved_by: string | null
          calculated_tax: number | null
          cfc_data: Json | null
          company_id: string
          created_at: string | null
          current_step: number | null
          decreasing_items: Json | null
          decreasing_total: number | null
          depreciation: number | null
          donations: Json | null
          donations_total: number | null
          ebitda: number | null
          filing_reference: string | null
          filing_status: string | null
          financial_result: number | null
          has_cfc: boolean | null
          id: string
          increasing_items: Json | null
          increasing_total: number | null
          interest_adjustment: number | null
          interest_expense: number | null
          interest_limit: number | null
          material_costs: number | null
          metadata: Json | null
          modified_tax_base: number | null
          notes: string | null
          other_costs: number | null
          other_revenue: number | null
          payable_tax: number | null
          personnel_costs: number | null
          revenue: number | null
          status: string | null
          submitted_at: string | null
          submitted_by: string | null
          tax_base: number | null
          tax_credits: Json | null
          tax_credits_total: number | null
          tax_year: number
          updated_at: string | null
        }
        Insert: {
          advance_payments?: number | null
          aee?: number | null
          approved_at?: string | null
          approved_by?: string | null
          calculated_tax?: number | null
          cfc_data?: Json | null
          company_id: string
          created_at?: string | null
          current_step?: number | null
          decreasing_items?: Json | null
          decreasing_total?: number | null
          depreciation?: number | null
          donations?: Json | null
          donations_total?: number | null
          ebitda?: number | null
          filing_reference?: string | null
          filing_status?: string | null
          financial_result?: number | null
          has_cfc?: boolean | null
          id?: string
          increasing_items?: Json | null
          increasing_total?: number | null
          interest_adjustment?: number | null
          interest_expense?: number | null
          interest_limit?: number | null
          material_costs?: number | null
          metadata?: Json | null
          modified_tax_base?: number | null
          notes?: string | null
          other_costs?: number | null
          other_revenue?: number | null
          payable_tax?: number | null
          personnel_costs?: number | null
          revenue?: number | null
          status?: string | null
          submitted_at?: string | null
          submitted_by?: string | null
          tax_base?: number | null
          tax_credits?: Json | null
          tax_credits_total?: number | null
          tax_year: number
          updated_at?: string | null
        }
        Update: {
          advance_payments?: number | null
          aee?: number | null
          approved_at?: string | null
          approved_by?: string | null
          calculated_tax?: number | null
          cfc_data?: Json | null
          company_id?: string
          created_at?: string | null
          current_step?: number | null
          decreasing_items?: Json | null
          decreasing_total?: number | null
          depreciation?: number | null
          donations?: Json | null
          donations_total?: number | null
          ebitda?: number | null
          filing_reference?: string | null
          filing_status?: string | null
          financial_result?: number | null
          has_cfc?: boolean | null
          id?: string
          increasing_items?: Json | null
          increasing_total?: number | null
          interest_adjustment?: number | null
          interest_expense?: number | null
          interest_limit?: number | null
          material_costs?: number | null
          metadata?: Json | null
          modified_tax_base?: number | null
          notes?: string | null
          other_costs?: number | null
          other_revenue?: number | null
          payable_tax?: number | null
          personnel_costs?: number | null
          revenue?: number | null
          status?: string | null
          submitted_at?: string | null
          submitted_by?: string | null
          tax_base?: number | null
          tax_credits?: Json | null
          tax_credits_total?: number | null
          tax_year?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "accounty_tao_yearly_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      accounty_tax_parameters: {
        Row: {
          description: string | null
          id: string
          legal_reference: string | null
          parameter_key: string
          parameter_value: number
          tax_year: number
        }
        Insert: {
          description?: string | null
          id?: string
          legal_reference?: string | null
          parameter_key: string
          parameter_value: number
          tax_year: number
        }
        Update: {
          description?: string | null
          id?: string
          legal_reference?: string | null
          parameter_key?: string
          parameter_value?: number
          tax_year?: number
        }
        Relationships: []
      }
      accounty_tax_params_global: {
        Row: {
          id: string
          key: string
          legal_reference: string | null
          notes: string | null
          updated_at: string
          updated_by: string | null
          valid_from: string | null
          value: number
          year: number
        }
        Insert: {
          id?: string
          key: string
          legal_reference?: string | null
          notes?: string | null
          updated_at?: string
          updated_by?: string | null
          valid_from?: string | null
          value: number
          year: number
        }
        Update: {
          id?: string
          key?: string
          legal_reference?: string | null
          notes?: string | null
          updated_at?: string
          updated_by?: string | null
          valid_from?: string | null
          value?: number
          year?: number
        }
        Relationships: []
      }
      accounty_tax_profiles: {
        Row: {
          company_id: string
          contribution_frequency: string | null
          created_at: string | null
          has_payroll: boolean | null
          id: string
          is_kata: boolean | null
          is_kiva: boolean | null
          last_nav_sync_at: string | null
          nav_synced: boolean | null
          payroll_settings: Json | null
          tax_group: string | null
          updated_at: string | null
          vat_frequency: string | null
        }
        Insert: {
          company_id: string
          contribution_frequency?: string | null
          created_at?: string | null
          has_payroll?: boolean | null
          id?: string
          is_kata?: boolean | null
          is_kiva?: boolean | null
          last_nav_sync_at?: string | null
          nav_synced?: boolean | null
          payroll_settings?: Json | null
          tax_group?: string | null
          updated_at?: string | null
          vat_frequency?: string | null
        }
        Update: {
          company_id?: string
          contribution_frequency?: string | null
          created_at?: string | null
          has_payroll?: boolean | null
          id?: string
          is_kata?: boolean | null
          is_kiva?: boolean | null
          last_nav_sync_at?: string | null
          nav_synced?: boolean | null
          payroll_settings?: Json | null
          tax_group?: string | null
          updated_at?: string | null
          vat_frequency?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "accounty_tax_profiles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      accounty_template_versions: {
        Row: {
          body_html: string | null
          body_markdown: string
          changed_by: string | null
          created_at: string
          id: string
          subject: string | null
          template_id: string
          version: number
        }
        Insert: {
          body_html?: string | null
          body_markdown: string
          changed_by?: string | null
          created_at?: string
          id?: string
          subject?: string | null
          template_id: string
          version: number
        }
        Update: {
          body_html?: string | null
          body_markdown?: string
          changed_by?: string | null
          created_at?: string
          id?: string
          subject?: string | null
          template_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "accounty_template_versions_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "accounty_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      accounty_templates: {
        Row: {
          body_html: string | null
          body_markdown: string
          category: string
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          name: string
          subject: string | null
          updated_at: string
          variables: Json | null
          version: number
        }
        Insert: {
          body_html?: string | null
          body_markdown?: string
          category: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          name: string
          subject?: string | null
          updated_at?: string
          variables?: Json | null
          version?: number
        }
        Update: {
          body_html?: string | null
          body_markdown?: string
          category?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          name?: string
          subject?: string | null
          updated_at?: string
          variables?: Json | null
          version?: number
        }
        Relationships: []
      }
      accounty_timesheets: {
        Row: {
          created_at: string | null
          cycle_id: string
          document_url: string | null
          employment_id: string
          id: string
          is_verified: boolean | null
          ocr_confidence: number | null
          ocr_data: Json | null
          updated_at: string | null
          verified_by: string | null
        }
        Insert: {
          created_at?: string | null
          cycle_id: string
          document_url?: string | null
          employment_id: string
          id?: string
          is_verified?: boolean | null
          ocr_confidence?: number | null
          ocr_data?: Json | null
          updated_at?: string | null
          verified_by?: string | null
        }
        Update: {
          created_at?: string | null
          cycle_id?: string
          document_url?: string | null
          employment_id?: string
          id?: string
          is_verified?: boolean | null
          ocr_confidence?: number | null
          ocr_data?: Json | null
          updated_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "accounty_timesheets_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "accounty_payroll_cycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounty_timesheets_employment_id_fkey"
            columns: ["employment_id"]
            isOneToOne: false
            referencedRelation: "accounty_employments"
            referencedColumns: ["id"]
          },
        ]
      }
      accounty_transfers: {
        Row: {
          bank_account: string | null
          company_id: string
          created_at: string | null
          employee_id: string | null
          employee_name: string | null
          id: string
          net_salary: number | null
          period: string
          status: string
        }
        Insert: {
          bank_account?: string | null
          company_id: string
          created_at?: string | null
          employee_id?: string | null
          employee_name?: string | null
          id?: string
          net_salary?: number | null
          period: string
          status?: string
        }
        Update: {
          bank_account?: string | null
          company_id?: string
          created_at?: string | null
          employee_id?: string | null
          employee_name?: string | null
          id?: string
          net_salary?: number | null
          period?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "accounty_transfers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounty_transfers_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "accounty_employees"
            referencedColumns: ["id"]
          },
        ]
      }
      accounty_uploads: {
        Row: {
          company_id: string
          completed_at: string | null
          created_at: string
          error_message: string | null
          file_name: string
          file_path: string | null
          file_size_bytes: number | null
          file_type: string | null
          id: string
          missing_item_id: string | null
          portal_token: string | null
          status: string
          storage_bucket: string | null
          upload_source: string | null
          uploaded_by: string | null
        }
        Insert: {
          company_id: string
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          file_name: string
          file_path?: string | null
          file_size_bytes?: number | null
          file_type?: string | null
          id?: string
          missing_item_id?: string | null
          portal_token?: string | null
          status?: string
          storage_bucket?: string | null
          upload_source?: string | null
          uploaded_by?: string | null
        }
        Update: {
          company_id?: string
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          file_name?: string
          file_path?: string | null
          file_size_bytes?: number | null
          file_type?: string | null
          id?: string
          missing_item_id?: string | null
          portal_token?: string | null
          status?: string
          storage_bucket?: string | null
          upload_source?: string | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "accounty_uploads_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounty_uploads_missing_item_id_fkey"
            columns: ["missing_item_id"]
            isOneToOne: false
            referencedRelation: "accounty_missing_items"
            referencedColumns: ["id"]
          },
        ]
      }
      accounty_year_end_tasks: {
        Row: {
          category: string | null
          checklist: Json | null
          color: string | null
          company_id: string
          created_at: string | null
          deadline: string | null
          icon_name: string | null
          id: string
          legal_ref: string | null
          output_label: string | null
          sort_order: number | null
          status: string
          subtitle: string | null
          title: string
          updated_at: string | null
          year: number
        }
        Insert: {
          category?: string | null
          checklist?: Json | null
          color?: string | null
          company_id: string
          created_at?: string | null
          deadline?: string | null
          icon_name?: string | null
          id?: string
          legal_ref?: string | null
          output_label?: string | null
          sort_order?: number | null
          status?: string
          subtitle?: string | null
          title: string
          updated_at?: string | null
          year?: number
        }
        Update: {
          category?: string | null
          checklist?: Json | null
          color?: string | null
          company_id?: string
          created_at?: string | null
          deadline?: string | null
          icon_name?: string | null
          id?: string
          legal_ref?: string | null
          output_label?: string | null
          sort_order?: number | null
          status?: string
          subtitle?: string | null
          title?: string
          updated_at?: string | null
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "accounty_year_end_tasks_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      annual_report_notes_templates: {
        Row: {
          category: string
          default_text: string
          id: string
          is_required: boolean | null
          order_num: number
          section_key: string
          section_title: string
        }
        Insert: {
          category: string
          default_text: string
          id?: string
          is_required?: boolean | null
          order_num: number
          section_key: string
          section_title: string
        }
        Update: {
          category?: string
          default_text?: string
          id?: string
          is_required?: boolean | null
          order_num?: number
          section_key?: string
          section_title?: string
        }
        Relationships: []
      }
      annual_reports: {
        Row: {
          accounting_method: string | null
          company_id: string
          created_at: string | null
          created_by: string | null
          dividend_amount: number | null
          dividend_resolution_date: string | null
          dividend_resolution_number: string | null
          fiscal_year: number
          frozen_at: string | null
          frozen_bs_data: Json | null
          frozen_pnl_data: Json | null
          id: string
          net_income: number | null
          notes_sections: Json | null
          preset_id: string
          report_date: string | null
          representative_name: string | null
          representative_role: string | null
          retained_earnings: number | null
          status: string
          updated_at: string | null
          validated_at: string | null
          validation_results: Json | null
        }
        Insert: {
          accounting_method?: string | null
          company_id: string
          created_at?: string | null
          created_by?: string | null
          dividend_amount?: number | null
          dividend_resolution_date?: string | null
          dividend_resolution_number?: string | null
          fiscal_year: number
          frozen_at?: string | null
          frozen_bs_data?: Json | null
          frozen_pnl_data?: Json | null
          id?: string
          net_income?: number | null
          notes_sections?: Json | null
          preset_id: string
          report_date?: string | null
          representative_name?: string | null
          representative_role?: string | null
          retained_earnings?: number | null
          status?: string
          updated_at?: string | null
          validated_at?: string | null
          validation_results?: Json | null
        }
        Update: {
          accounting_method?: string | null
          company_id?: string
          created_at?: string | null
          created_by?: string | null
          dividend_amount?: number | null
          dividend_resolution_date?: string | null
          dividend_resolution_number?: string | null
          fiscal_year?: number
          frozen_at?: string | null
          frozen_bs_data?: Json | null
          frozen_pnl_data?: Json | null
          id?: string
          net_income?: number | null
          notes_sections?: Json | null
          preset_id?: string
          report_date?: string | null
          representative_name?: string | null
          representative_role?: string | null
          retained_earnings?: number | null
          status?: string
          updated_at?: string | null
          validated_at?: string | null
          validation_results?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "annual_reports_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      api_keys: {
        Row: {
          company_id: string | null
          created_at: string
          created_by: string | null
          expires_at: string | null
          id: string
          is_active: boolean
          key_hash: string
          key_prefix: string
          last_used_at: string | null
          name: string
          rate_limit_per_minute: number
          scope: string
          updated_at: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          key_hash: string
          key_prefix: string
          last_used_at?: string | null
          name?: string
          rate_limit_per_minute?: number
          scope?: string
          updated_at?: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          key_hash?: string
          key_prefix?: string
          last_used_at?: string | null
          name?: string
          rate_limit_per_minute?: number
          scope?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "api_keys_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      app_error_logs: {
        Row: {
          action: string | null
          company_id: string | null
          component: string | null
          context: Json | null
          created_at: string
          error_type: string
          id: string
          message: string
          severity: string | null
          stack_trace: string | null
          url: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action?: string | null
          company_id?: string | null
          component?: string | null
          context?: Json | null
          created_at?: string
          error_type: string
          id?: string
          message: string
          severity?: string | null
          stack_trace?: string | null
          url?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string | null
          company_id?: string | null
          component?: string | null
          context?: Json | null
          created_at?: string
          error_type?: string
          id?: string
          message?: string
          severity?: string | null
          stack_trace?: string | null
          url?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "app_error_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
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
      bs_mapping: {
        Row: {
          bs_structure_id: string
          company_id: string
          created_at: string | null
          gl_account_id: string
          id: string
          preset_id: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          bs_structure_id: string
          company_id: string
          created_at?: string | null
          gl_account_id: string
          id?: string
          preset_id: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          bs_structure_id?: string
          company_id?: string
          created_at?: string | null
          gl_account_id?: string
          id?: string
          preset_id?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bs_mapping_bs_structure_id_fkey"
            columns: ["bs_structure_id"]
            isOneToOne: false
            referencedRelation: "bs_structure"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bs_mapping_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bs_mapping_gl_account_id_fkey"
            columns: ["gl_account_id"]
            isOneToOne: false
            referencedRelation: "gl_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bs_mapping_preset_id_fkey"
            columns: ["preset_id"]
            isOneToOne: false
            referencedRelation: "chart_of_accounts_presets"
            referencedColumns: ["id"]
          },
        ]
      }
      bs_prior_year: {
        Row: {
          bs_structure_id: string
          company_id: string
          fiscal_year: number
          id: string
          prior_year_adjustment: number
          prior_year_balance: number
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          bs_structure_id: string
          company_id: string
          fiscal_year: number
          id?: string
          prior_year_adjustment?: number
          prior_year_balance?: number
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          bs_structure_id?: string
          company_id?: string
          fiscal_year?: number
          id?: string
          prior_year_adjustment?: number
          prior_year_balance?: number
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bs_prior_year_bs_structure_id_fkey"
            columns: ["bs_structure_id"]
            isOneToOne: false
            referencedRelation: "bs_structure"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bs_prior_year_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      bs_structure: {
        Row: {
          created_at: string | null
          id: string
          is_pnl_bridge: boolean
          name: string
          order_num: number
          parent_id: string | null
          row_code: string
          section: string
          type: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_pnl_bridge?: boolean
          name: string
          order_num: number
          parent_id?: string | null
          row_code: string
          section: string
          type: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_pnl_bridge?: boolean
          name?: string
          order_num?: number
          parent_id?: string | null
          row_code?: string
          section?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "bs_structure_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "bs_structure"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          color: string | null
          company_id: string | null
          created_at: string
          description: string | null
          icon: string | null
          id: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          color?: string | null
          company_id?: string | null
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          color?: string | null
          company_id?: string | null
          created_at?: string
          description?: string | null
          icon?: string | null
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
      company_fx_settings: {
        Row: {
          company_id: string
          created_at: string
          id: string
          rate_source: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          rate_source?: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          rate_source?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_fx_settings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
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
      courier_reports: {
        Row: {
          cod_amount: number | null
          company_id: string
          created_at: string | null
          delivery_date: string | null
          id: string
          match_confidence: number | null
          match_reason: string | null
          match_status: string
          matched_nav_invoice_id: string | null
          matched_transaction_id: string | null
          package_number: string | null
          raw_data: Json | null
          recipient_address: string | null
          recipient_name: string | null
          reference_number: string | null
          report_number: string | null
          report_type: string
          row_type: string
          upload_id: string
        }
        Insert: {
          cod_amount?: number | null
          company_id: string
          created_at?: string | null
          delivery_date?: string | null
          id?: string
          match_confidence?: number | null
          match_reason?: string | null
          match_status?: string
          matched_nav_invoice_id?: string | null
          matched_transaction_id?: string | null
          package_number?: string | null
          raw_data?: Json | null
          recipient_address?: string | null
          recipient_name?: string | null
          reference_number?: string | null
          report_number?: string | null
          report_type: string
          row_type?: string
          upload_id: string
        }
        Update: {
          cod_amount?: number | null
          company_id?: string
          created_at?: string | null
          delivery_date?: string | null
          id?: string
          match_confidence?: number | null
          match_reason?: string | null
          match_status?: string
          matched_nav_invoice_id?: string | null
          matched_transaction_id?: string | null
          package_number?: string | null
          raw_data?: Json | null
          recipient_address?: string | null
          recipient_name?: string | null
          reference_number?: string | null
          report_number?: string | null
          report_type?: string
          row_type?: string
          upload_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "courier_reports_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "courier_reports_matched_nav_invoice_id_fkey"
            columns: ["matched_nav_invoice_id"]
            isOneToOne: false
            referencedRelation: "nav_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "courier_reports_matched_transaction_id_fkey"
            columns: ["matched_transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "courier_reports_upload_id_fkey"
            columns: ["upload_id"]
            isOneToOne: false
            referencedRelation: "report_uploads"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_exchange_rates: {
        Row: {
          created_at: string
          currency: string
          id: string
          rate: number
          rate_date: string
          source: string
        }
        Insert: {
          created_at?: string
          currency: string
          id?: string
          rate: number
          rate_date: string
          source?: string
        }
        Update: {
          created_at?: string
          currency?: string
          id?: string
          rate?: number
          rate_date?: string
          source?: string
        }
        Relationships: []
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
      eaisybill_module_permissions: {
        Row: {
          can_read: boolean
          can_write: boolean
          company_id: string
          created_at: string
          id: string
          module_name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          can_read?: boolean
          can_write?: boolean
          company_id: string
          created_at?: string
          id?: string
          module_name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          can_read?: boolean
          can_write?: boolean
          company_id?: string
          created_at?: string
          id?: string
          module_name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "eaisybill_module_permissions_company_id_fkey"
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
          attachments: string[] | null
          assigned_to: string | null
          company_id: string | null
          company_name: string | null
          created_at: string
          id: string
          message: string
          page_url: string | null
          priority: string | null
          service: string | null
          slack_sent: boolean
          slack_sent_at: string | null
          status: string
          ticket_number: string | null
          type: string
          updated_at: string
          user_email: string | null
          user_id: string
          user_name: string | null
        }
        Insert: {
          attachments?: string[] | null
          assigned_to?: string | null
          company_id?: string | null
          company_name?: string | null
          created_at?: string
          id?: string
          message: string
          page_url?: string | null
          priority?: string | null
          service?: string | null
          slack_sent?: boolean
          slack_sent_at?: string | null
          status?: string
          ticket_number?: string | null
          type: string
          updated_at?: string
          user_email?: string | null
          user_id: string
          user_name?: string | null
        }
        Update: {
          attachments?: string[] | null
          assigned_to?: string | null
          company_id?: string | null
          company_name?: string | null
          created_at?: string
          id?: string
          message?: string
          page_url?: string | null
          priority?: string | null
          service?: string | null
          slack_sent?: boolean
          slack_sent_at?: string | null
          status?: string
          ticket_number?: string | null
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
      gl_audit_accounts: {
        Row: {
          account_code: string
          account_name: string
          company_id: string
          id: string
          import_id: string
        }
        Insert: {
          account_code: string
          account_name: string
          company_id: string
          id?: string
          import_id: string
        }
        Update: {
          account_code?: string
          account_name?: string
          company_id?: string
          id?: string
          import_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "gl_audit_accounts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gl_audit_accounts_import_id_fkey"
            columns: ["import_id"]
            isOneToOne: false
            referencedRelation: "gl_audit_imports"
            referencedColumns: ["id"]
          },
        ]
      }
      gl_audit_imports: {
        Row: {
          account_count: number | null
          company_id: string
          currency: string | null
          entry_count: number | null
          error_message: string | null
          file_name: string
          id: string
          imported_at: string | null
          imported_by: string | null
          partner_count: number | null
          period_end: string
          period_start: string
          preset_id: string | null
          processing_status: string | null
          source_program: string | null
          source_version: string | null
          storage_path: string | null
          voucher_count: number | null
        }
        Insert: {
          account_count?: number | null
          company_id: string
          currency?: string | null
          entry_count?: number | null
          error_message?: string | null
          file_name: string
          id?: string
          imported_at?: string | null
          imported_by?: string | null
          partner_count?: number | null
          period_end: string
          period_start: string
          preset_id?: string | null
          processing_status?: string | null
          source_program?: string | null
          source_version?: string | null
          storage_path?: string | null
          voucher_count?: number | null
        }
        Update: {
          account_count?: number | null
          company_id?: string
          currency?: string | null
          entry_count?: number | null
          error_message?: string | null
          file_name?: string
          id?: string
          imported_at?: string | null
          imported_by?: string | null
          partner_count?: number | null
          period_end?: string
          period_start?: string
          preset_id?: string | null
          processing_status?: string | null
          source_program?: string | null
          source_version?: string | null
          storage_path?: string | null
          voucher_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "gl_audit_imports_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gl_audit_imports_preset_id_fkey"
            columns: ["preset_id"]
            isOneToOne: false
            referencedRelation: "chart_of_accounts_presets"
            referencedColumns: ["id"]
          },
        ]
      }
      gl_audit_partners: {
        Row: {
          company_id: string
          eu_tax_number: string | null
          id: string
          import_id: string
          partner_code: string
          partner_name: string
          tax_number: string | null
        }
        Insert: {
          company_id: string
          eu_tax_number?: string | null
          id?: string
          import_id: string
          partner_code: string
          partner_name: string
          tax_number?: string | null
        }
        Update: {
          company_id?: string
          eu_tax_number?: string | null
          id?: string
          import_id?: string
          partner_code?: string
          partner_name?: string
          tax_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gl_audit_partners_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gl_audit_partners_import_id_fkey"
            columns: ["import_id"]
            isOneToOne: false
            referencedRelation: "gl_audit_imports"
            referencedColumns: ["id"]
          },
        ]
      }
      gl_journal_entries: {
        Row: {
          amount: number
          company_id: string
          cost_center: string | null
          credit_account: string
          debit_account: string
          description: string | null
          entry_index: number | null
          exchange_rate: number | null
          foreign_amount: number | null
          foreign_currency: string | null
          id: string
          import_id: string
          partner_code: string | null
          partner_name: string | null
          payment_due_date: string | null
          service_date: string | null
          vat_base: number | null
          vat_rate: string | null
          voucher_date: string | null
          voucher_id: number | null
          voucher_number: string | null
          work_number: string | null
        }
        Insert: {
          amount: number
          company_id: string
          cost_center?: string | null
          credit_account: string
          debit_account: string
          description?: string | null
          entry_index?: number | null
          exchange_rate?: number | null
          foreign_amount?: number | null
          foreign_currency?: string | null
          id?: string
          import_id: string
          partner_code?: string | null
          partner_name?: string | null
          payment_due_date?: string | null
          service_date?: string | null
          vat_base?: number | null
          vat_rate?: string | null
          voucher_date?: string | null
          voucher_id?: number | null
          voucher_number?: string | null
          work_number?: string | null
        }
        Update: {
          amount?: number
          company_id?: string
          cost_center?: string | null
          credit_account?: string
          debit_account?: string
          description?: string | null
          entry_index?: number | null
          exchange_rate?: number | null
          foreign_amount?: number | null
          foreign_currency?: string | null
          id?: string
          import_id?: string
          partner_code?: string | null
          partner_name?: string | null
          payment_due_date?: string | null
          service_date?: string | null
          vat_base?: number | null
          vat_rate?: string | null
          voucher_date?: string | null
          voucher_id?: number | null
          voucher_number?: string | null
          work_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gl_journal_entries_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gl_journal_entries_import_id_fkey"
            columns: ["import_id"]
            isOneToOne: false
            referencedRelation: "gl_audit_imports"
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
          exclude_from_accounting: boolean
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
          exclude_from_accounting?: boolean
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
          exclude_from_accounting?: boolean
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
          exclude_from_accounting: boolean
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
          intermediary_service: boolean
          invoice_direction: string | null
          invoice_type: string
          invoice_uploads_id: string | null
          kibocsatas_datuma: string
          letrehozva: string
          melleklet_url: string | null
          onszamlazas: boolean | null
          penzforgalmi_elszamolas: boolean | null
          penznem: string | null
          planned_payment_date: string | null
          position_numbers: string[] | null
          project_id: string | null
          reference_number: string | null
          reverse_charge_category: string | null
          selexped_registry_number: string | null
          shipment_match_status: string | null
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
          exclude_from_accounting?: boolean
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
          intermediary_service?: boolean
          invoice_direction?: string | null
          invoice_type?: string
          invoice_uploads_id?: string | null
          kibocsatas_datuma: string
          letrehozva?: string
          melleklet_url?: string | null
          onszamlazas?: boolean | null
          penzforgalmi_elszamolas?: boolean | null
          penznem?: string | null
          planned_payment_date?: string | null
          position_numbers?: string[] | null
          project_id?: string | null
          reference_number?: string | null
          reverse_charge_category?: string | null
          selexped_registry_number?: string | null
          shipment_match_status?: string | null
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
          exclude_from_accounting?: boolean
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
          intermediary_service?: boolean
          invoice_direction?: string | null
          invoice_type?: string
          invoice_uploads_id?: string | null
          kibocsatas_datuma?: string
          letrehozva?: string
          melleklet_url?: string | null
          onszamlazas?: boolean | null
          penzforgalmi_elszamolas?: boolean | null
          penznem?: string | null
          planned_payment_date?: string | null
          position_numbers?: string[] | null
          project_id?: string | null
          reference_number?: string | null
          reverse_charge_category?: string | null
          selexped_registry_number?: string | null
          shipment_match_status?: string | null
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
      match_transaction_overrides_log: {
        Row: {
          company_id: string
          corrected_invoice_id: string | null
          corrected_match_type: string
          corrected_partner_name: string | null
          created_at: string | null
          created_by: string | null
          id: string
          original_invoice_id: string | null
          original_match_type: string | null
          original_partner_name: string | null
          transaction_amount: number
          transaction_description: string
          transaction_id: string
        }
        Insert: {
          company_id: string
          corrected_invoice_id?: string | null
          corrected_match_type: string
          corrected_partner_name?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          original_invoice_id?: string | null
          original_match_type?: string | null
          original_partner_name?: string | null
          transaction_amount: number
          transaction_description: string
          transaction_id: string
        }
        Update: {
          company_id?: string
          corrected_invoice_id?: string | null
          corrected_match_type?: string
          corrected_partner_name?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          original_invoice_id?: string | null
          original_match_type?: string | null
          original_partner_name?: string | null
          transaction_amount?: number
          transaction_description?: string
          transaction_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "match_transaction_overrides_log_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_transaction_overrides_log_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      nav_invoice_items: {
        Row: {
          created_at: string | null
          exclude_from_accounting: boolean
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
          exclude_from_accounting?: boolean
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
          exclude_from_accounting?: boolean
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
          exclude_from_accounting: boolean
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
          is_reverse_charge: boolean | null
          paid: boolean | null
          payment_date: string | null
          payment_method: string | null
          project_id: string | null
          rc_confidence: string | null
          rc_vat_date: string | null
          reverse_charge_category: string | null
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
          exclude_from_accounting?: boolean
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
          is_reverse_charge?: boolean | null
          paid?: boolean | null
          payment_date?: string | null
          payment_method?: string | null
          project_id?: string | null
          rc_confidence?: string | null
          rc_vat_date?: string | null
          reverse_charge_category?: string | null
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
          exclude_from_accounting?: boolean
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
          is_reverse_charge?: boolean | null
          paid?: boolean | null
          payment_date?: string | null
          payment_method?: string | null
          project_id?: string | null
          rc_confidence?: string | null
          rc_vat_date?: string | null
          reverse_charge_category?: string | null
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
      outgoing_emails: {
        Row: {
          category: string
          company_id: string
          company_name: string
          created_at: string | null
          error_message: string | null
          id: string
          message_id: string | null
          missing_item_ids: Json | null
          portal_link: string | null
          recipient_email: string
          resend_id: string | null
          status: string
          subject: string
          user_id: string | null
        }
        Insert: {
          category?: string
          company_id: string
          company_name: string
          created_at?: string | null
          error_message?: string | null
          id?: string
          message_id?: string | null
          missing_item_ids?: Json | null
          portal_link?: string | null
          recipient_email: string
          resend_id?: string | null
          status?: string
          subject: string
          user_id?: string | null
        }
        Update: {
          category?: string
          company_id?: string
          company_name?: string
          created_at?: string | null
          error_message?: string | null
          id?: string
          message_id?: string | null
          missing_item_ids?: Json | null
          portal_link?: string | null
          recipient_email?: string
          resend_id?: string | null
          status?: string
          subject?: string
          user_id?: string | null
        }
        Relationships: []
      }
      partners: {
        Row: {
          address: string | null
          company_id: string | null
          created_at: string
          custom_color: string | null
          custom_bg_color: string | null
          custom_monogram: string | null
          default_project_id: string | null
          email: string | null
          exclude_from_accounting: boolean
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
          custom_color?: string | null
          custom_bg_color?: string | null
          custom_monogram?: string | null
          default_project_id?: string | null
          email?: string | null
          exclude_from_accounting?: boolean
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
          custom_color?: string | null
          custom_bg_color?: string | null
          custom_monogram?: string | null
          default_project_id?: string | null
          email?: string | null
          exclude_from_accounting?: boolean
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
      petty_cash_entries: {
        Row: {
          amount: number
          company_id: string
          created_at: string
          created_by: string | null
          currency: string
          description: string | null
          entry_date: string
          id: string
          register_id: string
          routed_by: string
          source_id: string | null
          source_table: string | null
          source_type: string
        }
        Insert: {
          amount: number
          company_id: string
          created_at?: string
          created_by?: string | null
          currency?: string
          description?: string | null
          entry_date: string
          id?: string
          register_id: string
          routed_by?: string
          source_id?: string | null
          source_table?: string | null
          source_type: string
        }
        Update: {
          amount?: number
          company_id?: string
          created_at?: string
          created_by?: string | null
          currency?: string
          description?: string | null
          entry_date?: string
          id?: string
          register_id?: string
          routed_by?: string
          source_id?: string | null
          source_table?: string | null
          source_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "petty_cash_entries_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "petty_cash_entries_register_id_fkey"
            columns: ["register_id"]
            isOneToOne: false
            referencedRelation: "petty_cash_registers"
            referencedColumns: ["id"]
          },
        ]
      }
      petty_cash_opening_balances: {
        Row: {
          amount: number
          currency: string
          id: string
          register_id: string
          start_date: string | null
        }
        Insert: {
          amount?: number
          currency?: string
          id?: string
          register_id: string
          start_date?: string | null
        }
        Update: {
          amount?: number
          currency?: string
          id?: string
          register_id?: string
          start_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "petty_cash_opening_balances_register_id_fkey"
            columns: ["register_id"]
            isOneToOne: false
            referencedRelation: "petty_cash_registers"
            referencedColumns: ["id"]
          },
        ]
      }
      petty_cash_registers: {
        Row: {
          company_id: string
          created_at: string
          created_by: string | null
          currencies: string[]
          id: string
          is_default: boolean
          location: string | null
          name: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by?: string | null
          currencies?: string[]
          id?: string
          is_default?: boolean
          location?: string | null
          name: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string | null
          currencies?: string[]
          id?: string
          is_default?: boolean
          location?: string | null
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "petty_cash_registers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      petty_cash_routing_rules: {
        Row: {
          company_id: string
          created_at: string
          id: string
          is_active: boolean
          match_currency: string | null
          match_description_pattern: string | null
          match_partner_pattern: string | null
          match_source_type: string | null
          priority: number
          target_register_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          match_currency?: string | null
          match_description_pattern?: string | null
          match_partner_pattern?: string | null
          match_source_type?: string | null
          priority?: number
          target_register_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          match_currency?: string | null
          match_description_pattern?: string | null
          match_partner_pattern?: string | null
          match_source_type?: string | null
          priority?: number
          target_register_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "petty_cash_routing_rules_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "petty_cash_routing_rules_target_register_id_fkey"
            columns: ["target_register_id"]
            isOneToOne: false
            referencedRelation: "petty_cash_registers"
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
          eaisybill_access: boolean
          email_verified: boolean
          email_verify_token: string | null
          has_completed_tour: boolean | null
          id: string
          is_support_admin: boolean | null
          name: string | null
          position: string | null
          registration_source: string | null
          role: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          company?: string | null
          created_at?: string
          eaisybill_access?: boolean
          email_verified?: boolean
          email_verify_token?: string | null
          has_completed_tour?: boolean | null
          id?: string
          is_support_admin?: boolean | null
          name?: string | null
          position?: string | null
          registration_source?: string | null
          role?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          company?: string | null
          created_at?: string
          eaisybill_access?: boolean
          email_verified?: boolean
          email_verify_token?: string | null
          has_completed_tour?: boolean | null
          id?: string
          is_support_admin?: boolean | null
          name?: string | null
          position?: string | null
          registration_source?: string | null
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
          color: string | null
          company_id: string | null
          created_at: string
          description: string | null
          end_date: string | null
          icon: string | null
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
          color?: string | null
          company_id?: string | null
          created_at?: string
          description?: string | null
          end_date?: string | null
          icon?: string | null
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
          color?: string | null
          company_id?: string | null
          created_at?: string
          description?: string | null
          end_date?: string | null
          icon?: string | null
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
      report_uploads: {
        Row: {
          company_id: string | null
          created_at: string | null
          error_message: string | null
          file_name: string
          file_size: number | null
          file_type: string | null
          file_url: string
          id: string
          metadata: Json | null
          processing_status: string
          report_type: string
          updated_at: string | null
          upload_status: string
          user_id: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string | null
          error_message?: string | null
          file_name: string
          file_size?: number | null
          file_type?: string | null
          file_url: string
          id?: string
          metadata?: Json | null
          processing_status?: string
          report_type: string
          updated_at?: string | null
          upload_status?: string
          user_id: string
        }
        Update: {
          company_id?: string | null
          created_at?: string | null
          error_message?: string | null
          file_name?: string
          file_size?: number | null
          file_type?: string | null
          file_url?: string
          id?: string
          metadata?: Json | null
          processing_status?: string
          report_type?: string
          updated_at?: string | null
          upload_status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "report_uploads_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      reverse_charge_entries: {
        Row: {
          category: string
          company_id: string
          created_at: string
          deadline_date: string | null
          deduction_ratio: number
          detail_data: Json | null
          effective_vat_date: string
          id: string
          invoice_id: string | null
          invoice_received_date: string | null
          is_deductible: boolean
          nav_invoice_id: string | null
          net_amount: number
          payment_date: string | null
          status: string
          updated_at: string
          vat_amount: number
          vat_period_month: number
          vat_period_year: number
          vat_rate: number
        }
        Insert: {
          category: string
          company_id: string
          created_at?: string
          deadline_date?: string | null
          deduction_ratio?: number
          detail_data?: Json | null
          effective_vat_date: string
          id?: string
          invoice_id?: string | null
          invoice_received_date?: string | null
          is_deductible?: boolean
          nav_invoice_id?: string | null
          net_amount: number
          payment_date?: string | null
          status?: string
          updated_at?: string
          vat_amount: number
          vat_period_month: number
          vat_period_year: number
          vat_rate?: number
        }
        Update: {
          category?: string
          company_id?: string
          created_at?: string
          deadline_date?: string | null
          deduction_ratio?: number
          detail_data?: Json | null
          effective_vat_date?: string
          id?: string
          invoice_id?: string | null
          invoice_received_date?: string | null
          is_deductible?: boolean
          nav_invoice_id?: string | null
          net_amount?: number
          payment_date?: string | null
          status?: string
          updated_at?: string
          vat_amount?: number
          vat_period_month?: number
          vat_period_year?: number
          vat_rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "reverse_charge_entries_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reverse_charge_entries_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reverse_charge_entries_nav_invoice_id_fkey"
            columns: ["nav_invoice_id"]
            isOneToOne: false
            referencedRelation: "nav_invoices"
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
      shipment_import_batches: {
        Row: {
          company_id: string
          created_at: string
          errors: Json
          file_name: string
          file_path: string
          id: string
          imported_rows: number
          skipped_rows: number
          status: string
          total_rows: number
          uploaded_by: string | null
        }
        Insert: {
          company_id: string
          created_at?: string
          errors?: Json
          file_name: string
          file_path: string
          id?: string
          imported_rows?: number
          skipped_rows?: number
          status?: string
          total_rows?: number
          uploaded_by?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          errors?: Json
          file_name?: string
          file_path?: string
          id?: string
          imported_rows?: number
          skipped_rows?: number
          status?: string
          total_rows?: number
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shipment_import_batches_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      shipment_matches: {
        Row: {
          company_id: string
          confidence_score: number
          created_at: string
          discrepancies: Json
          id: string
          invoice_id: string
          match_details: Json
          match_type: string
          resolved_at: string | null
          resolved_by: string | null
          shipment_id: string
          status: string
        }
        Insert: {
          company_id: string
          confidence_score: number
          created_at?: string
          discrepancies?: Json
          id?: string
          invoice_id: string
          match_details?: Json
          match_type: string
          resolved_at?: string | null
          resolved_by?: string | null
          shipment_id: string
          status?: string
        }
        Update: {
          company_id?: string
          confidence_score?: number
          created_at?: string
          discrepancies?: Json
          id?: string
          invoice_id?: string
          match_details?: Json
          match_type?: string
          resolved_at?: string | null
          resolved_by?: string | null
          shipment_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_shipment_matches_invoice_id"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipment_matches_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipment_matches_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: false
            referencedRelation: "shipments"
            referencedColumns: ["id"]
          },
        ]
      }
      shipments: {
        Row: {
          calculated_amount_eur: number | null
          calculated_amount_huf: number | null
          carrier_name: string | null
          company_id: string
          created_at: string
          delivery_date: string | null
          id: string
          import_batch_id: string | null
          match_status: string
          matched_invoice_id: string | null
          pickup_date: string | null
          position_number: string
          source_row_data: Json
          updated_at: string
        }
        Insert: {
          calculated_amount_eur?: number | null
          calculated_amount_huf?: number | null
          carrier_name?: string | null
          company_id: string
          created_at?: string
          delivery_date?: string | null
          id?: string
          import_batch_id?: string | null
          match_status?: string
          matched_invoice_id?: string | null
          pickup_date?: string | null
          position_number: string
          source_row_data?: Json
          updated_at?: string
        }
        Update: {
          calculated_amount_eur?: number | null
          calculated_amount_huf?: number | null
          carrier_name?: string | null
          company_id?: string
          created_at?: string
          delivery_date?: string | null
          id?: string
          import_batch_id?: string | null
          match_status?: string
          matched_invoice_id?: string | null
          pickup_date?: string | null
          position_number?: string
          source_row_data?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_shipments_matched_invoice_id"
            columns: ["matched_invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipments_import_batch_id_fkey"
            columns: ["import_batch_id"]
            isOneToOne: false
            referencedRelation: "shipment_import_batches"
            referencedColumns: ["id"]
          },
        ]
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
      szep_card_transactions: {
        Row: {
          approval_code: string | null
          bank_account: string | null
          card_holder: string | null
          card_number_masked: string | null
          commission_amount: number
          commission_vat: number
          company_id: string
          created_at: string
          currency: string
          gross_amount: number
          id: string
          is_reversal: boolean
          is_webshop: boolean
          issuer_bank: string | null
          merchant_name: string | null
          net_amount: number
          pos_terminal_id: string | null
          status: string
          sub_account: string
          transaction_date: string
          transaction_ref: string | null
          transfer_date: string | null
          transfer_reference: string | null
          updated_at: string
          upload_id: string | null
        }
        Insert: {
          approval_code?: string | null
          bank_account?: string | null
          card_holder?: string | null
          card_number_masked?: string | null
          commission_amount?: number
          commission_vat?: number
          company_id: string
          created_at?: string
          currency?: string
          gross_amount: number
          id?: string
          is_reversal?: boolean
          is_webshop?: boolean
          issuer_bank?: string | null
          merchant_name?: string | null
          net_amount: number
          pos_terminal_id?: string | null
          status?: string
          sub_account: string
          transaction_date: string
          transaction_ref?: string | null
          transfer_date?: string | null
          transfer_reference?: string | null
          updated_at?: string
          upload_id?: string | null
        }
        Update: {
          approval_code?: string | null
          bank_account?: string | null
          card_holder?: string | null
          card_number_masked?: string | null
          commission_amount?: number
          commission_vat?: number
          company_id?: string
          created_at?: string
          currency?: string
          gross_amount?: number
          id?: string
          is_reversal?: boolean
          is_webshop?: boolean
          issuer_bank?: string | null
          merchant_name?: string | null
          net_amount?: number
          pos_terminal_id?: string | null
          status?: string
          sub_account?: string
          transaction_date?: string
          transaction_ref?: string | null
          transfer_date?: string | null
          transfer_reference?: string | null
          updated_at?: string
          upload_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "szep_card_transactions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "szep_card_transactions_upload_id_fkey"
            columns: ["upload_id"]
            isOneToOne: false
            referencedRelation: "transaction_uploads"
            referencedColumns: ["id"]
          },
        ]
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
      ticket_comments: {
        Row: {
          attachments: string[] | null
          created_at: string | null
          feedback_id: string
          id: string
          is_admin: boolean | null
          message: string
          user_email: string | null
          user_id: string
          user_name: string | null
        }
        Insert: {
          attachments?: string[] | null
          created_at?: string | null
          feedback_id: string
          id?: string
          is_admin?: boolean | null
          message: string
          user_email?: string | null
          user_id: string
          user_name?: string | null
        }
        Update: {
          attachments?: string[] | null
          created_at?: string | null
          feedback_id?: string
          id?: string
          is_admin?: boolean | null
          message?: string
          user_email?: string | null
          user_id?: string
          user_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ticket_comments_feedback_id_fkey"
            columns: ["feedback_id"]
            isOneToOne: false
            referencedRelation: "feedback"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_events: {
        Row: {
          actor_email: string | null
          actor_id: string | null
          actor_name: string | null
          created_at: string | null
          event_type: string
          feedback_id: string
          id: string
          metadata: Json | null
          new_value: string | null
          old_value: string | null
        }
        Insert: {
          actor_email?: string | null
          actor_id?: string | null
          actor_name?: string | null
          created_at?: string | null
          event_type: string
          feedback_id: string
          id?: string
          metadata?: Json | null
          new_value?: string | null
          old_value?: string | null
        }
        Update: {
          actor_email?: string | null
          actor_id?: string | null
          actor_name?: string | null
          created_at?: string | null
          event_type?: string
          feedback_id?: string
          id?: string
          metadata?: Json | null
          new_value?: string | null
          old_value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ticket_events_feedback_id_fkey"
            columns: ["feedback_id"]
            isOneToOne: false
            referencedRelation: "feedback"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_reads: {
        Row: {
          feedback_id: string
          id: string
          last_read_at: string
          user_id: string
        }
        Insert: {
          feedback_id: string
          id?: string
          last_read_at?: string
          user_id: string
        }
        Update: {
          feedback_id?: string
          id?: string
          last_read_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_reads_feedback_id_fkey"
            columns: ["feedback_id"]
            isOneToOne: false
            referencedRelation: "feedback"
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
      transaction_invoice_matches: {
        Row: {
          created_at: string
          created_by: string
          id: string
          invoice_id: string
          invoice_source: string
          transaction_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string
          id?: string
          invoice_id: string
          invoice_source?: string
          transaction_id: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          invoice_id?: string
          invoice_source?: string
          transaction_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transaction_invoice_matches_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      transaction_uploads: {
        Row: {
          bank_hint: string | null
          company_id: string
          created_at: string | null
          detected_bank: string | null
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
          bank_hint?: string | null
          company_id: string
          created_at?: string | null
          detected_bank?: string | null
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
          bank_hint?: string | null
          company_id?: string
          created_at?: string | null
          detected_bank?: string | null
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
          terheles_datuma: string | null
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
          terheles_datuma?: string | null
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
          terheles_datuma?: string | null
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
      transport_documents: {
        Row: {
          company_id: string
          created_at: string
          document_type: string
          file_name: string
          file_path: string
          file_size: number
          id: string
          linked_invoice_id: string | null
          linked_shipment_id: string | null
          match_confidence: number | null
          metadata: Json
          mime_type: string
          position_number: string | null
          source_email_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          document_type?: string
          file_name: string
          file_path: string
          file_size: number
          id?: string
          linked_invoice_id?: string | null
          linked_shipment_id?: string | null
          match_confidence?: number | null
          metadata?: Json
          mime_type: string
          position_number?: string | null
          source_email_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          document_type?: string
          file_name?: string
          file_path?: string
          file_size?: number
          id?: string
          linked_invoice_id?: string | null
          linked_shipment_id?: string | null
          match_confidence?: number | null
          metadata?: Json
          mime_type?: string
          position_number?: string | null
          source_email_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cmr_documents_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cmr_documents_linked_shipment_id_fkey"
            columns: ["linked_shipment_id"]
            isOneToOne: false
            referencedRelation: "shipments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_cmr_documents_linked_invoice_id"
            columns: ["linked_invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      user_company_access_cache: {
        Row: {
          access_source: string
          can_read_hr: boolean | null
          can_read_invoices: boolean | null
          can_read_salaries: boolean | null
          can_read_transactions: boolean | null
          can_write_invoices: boolean | null
          company_id: string
          role: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          access_source: string
          can_read_hr?: boolean | null
          can_read_invoices?: boolean | null
          can_read_salaries?: boolean | null
          can_read_transactions?: boolean | null
          can_write_invoices?: boolean | null
          company_id: string
          role: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          access_source?: string
          can_read_hr?: boolean | null
          can_read_invoices?: boolean | null
          can_read_salaries?: boolean | null
          can_read_transactions?: boolean | null
          can_write_invoices?: boolean | null
          company_id?: string
          role?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_company_access_cache_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
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
      vat_codes: {
        Row: {
          code: string
          company_id: string
          created_at: string
          direction: string
          fad_category: string | null
          id: string
          is_deductible: boolean
          is_eu: boolean
          is_reverse_charge: boolean
          label: string
          sort_order: number
          target_rows: Json
          updated_at: string
          vat_percent: number
        }
        Insert: {
          code: string
          company_id: string
          created_at?: string
          direction: string
          fad_category?: string | null
          id?: string
          is_deductible?: boolean
          is_eu?: boolean
          is_reverse_charge?: boolean
          label: string
          sort_order?: number
          target_rows?: Json
          updated_at?: string
          vat_percent?: number
        }
        Update: {
          code?: string
          company_id?: string
          created_at?: string
          direction?: string
          fad_category?: string | null
          id?: string
          is_deductible?: boolean
          is_eu?: boolean
          is_reverse_charge?: boolean
          label?: string
          sort_order?: number
          target_rows?: Json
          updated_at?: string
          vat_percent?: number
        }
        Relationships: [
          {
            foreignKeyName: "vat_codes_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      vat_form_rows: {
        Row: {
          has_base: boolean | null
          has_tax: boolean | null
          is_summary: boolean | null
          label: string
          page: string
          row_number: string
          section: string
          sort_order: number
        }
        Insert: {
          has_base?: boolean | null
          has_tax?: boolean | null
          is_summary?: boolean | null
          label: string
          page: string
          row_number: string
          section: string
          sort_order?: number
        }
        Update: {
          has_base?: boolean | null
          has_tax?: boolean | null
          is_summary?: boolean | null
          label?: string
          page?: string
          row_number?: string
          section?: string
          sort_order?: number
        }
        Relationships: []
      }
      vat_return_lines: {
        Row: {
          base_amount: number | null
          base_amount_rounded: number | null
          id: string
          is_calculated: boolean | null
          row_number: string
          source_vat_codes: string[] | null
          tax_amount: number | null
          tax_amount_rounded: number | null
          vat_return_id: string
        }
        Insert: {
          base_amount?: number | null
          base_amount_rounded?: number | null
          id?: string
          is_calculated?: boolean | null
          row_number: string
          source_vat_codes?: string[] | null
          tax_amount?: number | null
          tax_amount_rounded?: number | null
          vat_return_id: string
        }
        Update: {
          base_amount?: number | null
          base_amount_rounded?: number | null
          id?: string
          is_calculated?: boolean | null
          row_number?: string
          source_vat_codes?: string[] | null
          tax_amount?: number | null
          tax_amount_rounded?: number | null
          vat_return_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vat_return_lines_vat_return_id_fkey"
            columns: ["vat_return_id"]
            isOneToOne: false
            referencedRelation: "vat_returns"
            referencedColumns: ["id"]
          },
        ]
      }
      vat_return_m_lines: {
        Row: {
          base_amount: number | null
          base_amount_rounded: number | null
          id: string
          invoice_count: number
          invoice_details: Json | null
          partner_id: string | null
          partner_name: string
          partner_tax_number: string
          tax_18_amount: number | null
          tax_27_amount: number | null
          tax_5_amount: number | null
          tax_amount: number | null
          tax_amount_rounded: number | null
          tax_prorated: number | null
          vat_return_id: string
        }
        Insert: {
          base_amount?: number | null
          base_amount_rounded?: number | null
          id?: string
          invoice_count?: number
          invoice_details?: Json | null
          partner_id?: string | null
          partner_name: string
          partner_tax_number: string
          tax_18_amount?: number | null
          tax_27_amount?: number | null
          tax_5_amount?: number | null
          tax_amount?: number | null
          tax_amount_rounded?: number | null
          tax_prorated?: number | null
          vat_return_id: string
        }
        Update: {
          base_amount?: number | null
          base_amount_rounded?: number | null
          id?: string
          invoice_count?: number
          invoice_details?: Json | null
          partner_id?: string | null
          partner_name?: string
          partner_tax_number?: string
          tax_18_amount?: number | null
          tax_27_amount?: number | null
          tax_5_amount?: number | null
          tax_amount?: number | null
          tax_amount_rounded?: number | null
          tax_prorated?: number | null
          vat_return_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vat_return_m_lines_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vat_return_m_lines_vat_return_id_fkey"
            columns: ["vat_return_id"]
            isOneToOne: false
            referencedRelation: "vat_returns"
            referencedColumns: ["id"]
          },
        ]
      }
      vat_returns: {
        Row: {
          amount_carryforward: number | null
          amount_reclaimable: number | null
          amount_to_pay: number | null
          company_id: string
          created_at: string
          finalized_at: string | null
          frequency: string
          id: string
          m_sheet_summary: Json | null
          net_result: number | null
          period_month: number | null
          period_quarter: number | null
          period_year: number
          prev_period_carryforward: number | null
          row_data: Json | null
          status: string
          total_deductible_base: number | null
          total_deductible_tax: number | null
          total_payable_base: number | null
          total_payable_tax: number | null
          updated_at: string
          user_id: string | null
          validated_at: string | null
          validation_errors: Json | null
        }
        Insert: {
          amount_carryforward?: number | null
          amount_reclaimable?: number | null
          amount_to_pay?: number | null
          company_id: string
          created_at?: string
          finalized_at?: string | null
          frequency?: string
          id?: string
          m_sheet_summary?: Json | null
          net_result?: number | null
          period_month?: number | null
          period_quarter?: number | null
          period_year: number
          prev_period_carryforward?: number | null
          row_data?: Json | null
          status?: string
          total_deductible_base?: number | null
          total_deductible_tax?: number | null
          total_payable_base?: number | null
          total_payable_tax?: number | null
          updated_at?: string
          user_id?: string | null
          validated_at?: string | null
          validation_errors?: Json | null
        }
        Update: {
          amount_carryforward?: number | null
          amount_reclaimable?: number | null
          amount_to_pay?: number | null
          company_id?: string
          created_at?: string
          finalized_at?: string | null
          frequency?: string
          id?: string
          m_sheet_summary?: Json | null
          net_result?: number | null
          period_month?: number | null
          period_quarter?: number | null
          period_year?: number
          prev_period_carryforward?: number | null
          row_data?: Json | null
          status?: string
          total_deductible_base?: number | null
          total_deductible_tax?: number | null
          total_payable_base?: number | null
          total_payable_tax?: number | null
          updated_at?: string
          user_id?: string | null
          validated_at?: string | null
          validation_errors?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "vat_returns_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
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
      cmr_documents: {
        Row: {
          company_id: string | null
          created_at: string | null
          document_type: string | null
          file_name: string | null
          file_path: string | null
          file_size: number | null
          id: string | null
          linked_invoice_id: string | null
          linked_shipment_id: string | null
          match_confidence: number | null
          metadata: Json | null
          mime_type: string | null
          position_number: string | null
          source_email_id: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string | null
          document_type?: string | null
          file_name?: string | null
          file_path?: string | null
          file_size?: number | null
          id?: string | null
          linked_invoice_id?: string | null
          linked_shipment_id?: string | null
          match_confidence?: number | null
          metadata?: Json | null
          mime_type?: string | null
          position_number?: string | null
          source_email_id?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          company_id?: string | null
          created_at?: string | null
          document_type?: string | null
          file_name?: string | null
          file_path?: string | null
          file_size?: number | null
          id?: string | null
          linked_invoice_id?: string | null
          linked_shipment_id?: string | null
          match_confidence?: number | null
          metadata?: Json | null
          mime_type?: string | null
          position_number?: string | null
          source_email_id?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cmr_documents_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cmr_documents_linked_shipment_id_fkey"
            columns: ["linked_shipment_id"]
            isOneToOne: false
            referencedRelation: "shipments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_cmr_documents_linked_invoice_id"
            columns: ["linked_invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
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
      calculate_vat_return: {
        Args: {
          p_company_id: string
          p_frequency?: string
          p_month: number
          p_year: number
        }
        Returns: string
      }
      check_request: { Args: never; Returns: undefined }
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
          bank_hint: string | null
          company_id: string
          created_at: string | null
          detected_bank: string | null
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
      delete_audit_import: { Args: { p_import_id: string }; Returns: undefined }
      delete_upload_with_data: {
        Args: { p_upload_id: string; p_upload_type: string }
        Returns: Json
      }
      freeze_annual_data: {
        Args: {
          p_company_id: string
          p_exchange_rates?: Json
          p_fiscal_year: number
          p_preset_id: string
          p_report_id: string
        }
        Returns: Json
      }
      generate_api_key: {
        Args: { p_company_id?: string; p_name?: string }
        Returns: Json
      }
      get_accounty_company_names: {
        Args: { p_company_ids: string[] }
        Returns: {
          id: string
          name: string
          tax_number: string
        }[]
      }
      get_accounty_company_summary: {
        Args: { p_user_id: string }
        Returns: {
          company_id: string
          company_name: string
          company_tax_number: string
          critical_count: number
          last_notified_at: string
          max_notification_count: number
          missing_count: number
          total_notified: number
        }[]
      }
      get_audit_gl_balances: {
        Args: { p_date_from?: string; p_date_to?: string; p_import_id: string }
        Returns: {
          account_code: string
          account_name: string
          balance: number
          credit_total: number
          debit_total: number
        }[]
      }
      get_bs_report: {
        Args: {
          p_company_id: string
          p_date_to?: string
          p_exchange_rates?: Json
          p_fiscal_year?: number
          p_preset_id: string
        }
        Returns: {
          bs_structure_id: string
          current_balance: number
          gl_accounts: Json
          is_pnl_bridge: boolean
          name: string
          order_num: number
          parent_id: string
          prior_year_adjustment: number
          prior_year_balance: number
          row_code: string
          section: string
          type: string
        }[]
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
          exclude_from_accounting: boolean
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
          exclude_from_accounting: boolean
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
      get_fx_differences: {
        Args: { p_company_id: string; p_date_from?: string; p_date_to?: string }
        Returns: {
          currency: string
          delivery_date: string
          delivery_huf: number
          delivery_rate: number
          foreign_amount: number
          fx_difference: number
          invoice_direction: string
          invoice_id: string
          invoice_number: string
          invoice_source: string
          partner_name: string
          settlement_date: string
          settlement_huf: number
          settlement_month: string
          settlement_rate: number
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
      get_petty_cash_summary: {
        Args: { p_company_id: string }
        Returns: {
          currency: string
          current_balance: number
          is_default: boolean
          opening_balance: number
          register_id: string
          register_name: string
          start_date: string
          total_expense: number
          total_income: number
        }[]
      }
      get_pnl_report: {
        Args: {
          p_company_id: string
          p_date_from?: string
          p_date_to?: string
          p_exchange_rates?: Json
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
      get_user_id_by_email: { Args: { p_email: string }; Returns: string }
      get_user_role: { Args: { p_company_id: string }; Returns: string }
      has_accounty_company_access: {
        Args: { p_company_id: string }
        Returns: boolean
      }
      has_company_access_via_cache: {
        Args: { p_company_id: string; p_source?: string }
        Returns: boolean
      }
      has_company_module_access: {
        Args: { p_company_id: string; p_module?: string }
        Returns: boolean
      }
      increment_invoice_usage: { Args: { user_uuid: string }; Returns: boolean }
      is_company_admin: { Args: { p_company_id: string }; Returns: boolean }
      is_company_member_or_above: {
        Args: { p_company_id: string }
        Returns: boolean
      }
      is_iroda_admin_for_firm: { Args: { p_firm_id: string }; Returns: boolean }
      is_member_of_firm: { Args: { p_firm_id: string }; Returns: boolean }
      lookup_user_by_email: {
        Args: { p_email: string }
        Returns: {
          email: string
          name: string
          user_id: string
        }[]
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
      pgmq_send_retry: {
        Args: { msg: Json; queue_name: string }
        Returns: number
      }
      rematch_courier_report: { Args: { p_report_id: string }; Returns: Json }
      reset_monthly_usage: { Args: never; Returns: number }
      revoke_api_key: { Args: { p_key_id: string }; Returns: Json }
      save_bs_mappings: {
        Args: { p_company_id: string; p_mappings: Json; p_preset_id: string }
        Returns: undefined
      }
      save_bs_prior_year: {
        Args: { p_company_id: string; p_data: Json; p_fiscal_year: number }
        Returns: undefined
      }
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
      seed_default_vat_codes: {
        Args: { p_company_id: string }
        Returns: undefined
      }
      seed_fad_vat_codes: { Args: { p_company_id: string }; Returns: undefined }
      sync_petty_cash_entries: {
        Args: { p_company_id: string }
        Returns: {
          inserted_count: number
          skipped_count: number
        }[]
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
      validate_annual_report: { Args: { p_report_id: string }; Returns: Json }
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
  graphql_public: {
    Enums: {},
  },
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
