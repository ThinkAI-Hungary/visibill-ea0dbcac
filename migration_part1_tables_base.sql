-- ============================================================
-- VISIBILL DATABASE MIGRATION - PART 1: Base Tables
-- ============================================================
CREATE SCHEMA IF NOT EXISTS public;

-- Custom ENUM types
DO $$ BEGIN
  CREATE TYPE public.audit_action_type AS ENUM ('létrehozás','módosítás','törlés','feltöltés','párosítás','aktiválás');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE TYPE public.audit_entity_type AS ENUM ('számla','bérjegyzék','tranzakció','kategória','dokumentum','tárgyi_eszköz');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Sequence
CREATE SEQUENCE IF NOT EXISTS public.projects_code_seq;

-- profiles
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id),
  name text,
  "position" text,
  company text,
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  has_completed_tour boolean DEFAULT false,
  email_verified boolean NOT NULL DEFAULT true,
  email_verify_token text
);

-- companies
CREATE TABLE IF NOT EXISTS public.companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  tax_number text,
  address text,
  owner_id uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  share_token text UNIQUE,
  share_token_created_at timestamptz
);

-- company_members
CREATE TABLE IF NOT EXISTS public.company_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  company_id uuid NOT NULL REFERENCES public.companies(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  role text NOT NULL DEFAULT 'member' CHECK (role = ANY(ARRAY['owner','admin','member','employee'])),
  UNIQUE(user_id, company_id)
);

-- company_locations
CREATE TABLE IF NOT EXISTS public.company_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id),
  name text NOT NULL,
  address text NOT NULL,
  location_type text NOT NULL DEFAULT 'branch' CHECK (location_type = ANY(ARRAY['headquarters','branch'])),
  is_default boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- company_settings
CREATE TABLE IF NOT EXISTS public.company_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL UNIQUE REFERENCES public.companies(id),
  work_start_time time NOT NULL DEFAULT '09:00:00',
  work_end_time time NOT NULL DEFAULT '17:00:00',
  admin_deadline time NOT NULL DEFAULT '20:00:00',
  monthly_working_hours numeric NOT NULL DEFAULT 168,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- user_subscriptions
CREATE TABLE IF NOT EXISTS public.user_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id),
  tier text NOT NULL DEFAULT 'teszt' CHECK (tier = ANY(ARRAY['salmon','tuna','shark','orca','teszt'])),
  invoice_limit integer NOT NULL DEFAULT 999999,
  invoices_used integer NOT NULL DEFAULT 0,
  period_start timestamptz NOT NULL DEFAULT now(),
  period_end timestamptz NOT NULL DEFAULT (now() + interval '1 month'),
  stripe_customer_id text,
  stripe_subscription_id text,
  stripe_product_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- user_email_preferences
CREATE TABLE IF NOT EXISTS public.user_email_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id),
  invoice_processed boolean DEFAULT true,
  invoice_failed boolean DEFAULT true,
  subscription_warnings boolean DEFAULT true,
  monthly_summary boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  weekly_summary boolean DEFAULT true,
  payment_reminders boolean DEFAULT true,
  team_notifications boolean DEFAULT true,
  bank_statement_processed boolean DEFAULT true,
  salary_processed boolean DEFAULT true,
  nav_sync_complete boolean DEFAULT true,
  transaction_matched boolean DEFAULT true,
  email_invoice_processed boolean DEFAULT true,
  missing_invoices boolean DEFAULT true
);

-- settings
CREATE TABLE IF NOT EXISTS public.settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  category text NOT NULL,
  key text NOT NULL,
  value jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, category, key)
);

-- nylas_tokens
CREATE TABLE IF NOT EXISTS public.nylas_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  grant_id text NOT NULL,
  access_token text NOT NULL,
  refresh_token text,
  email_address text NOT NULL,
  provider text NOT NULL,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, email_address)
);

-- categories
CREATE TABLE IF NOT EXISTS public.categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  name text NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  company_id uuid REFERENCES public.companies(id)
);

-- projects
CREATE TABLE IF NOT EXISTS public.projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  client_name text,
  status text NOT NULL DEFAULT 'active',
  budget numeric,
  start_date date,
  end_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  company_id uuid REFERENCES public.companies(id),
  project_code text UNIQUE,
  project_type text NOT NULL DEFAULT 'one_time'
);

-- tao_depreciation_templates
CREATE TABLE IF NOT EXISTS public.tao_depreciation_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  tao_rate_percent numeric NOT NULL,
  category_code text,
  created_at timestamptz DEFAULT now()
);

-- chart_of_accounts_presets
CREATE TABLE IF NOT EXISTS public.chart_of_accounts_presets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id),
  type varchar NOT NULL CHECK (type::text = ANY(ARRAY['generic','custom']::text[])),
  name varchar NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- hp_settings
CREATE TABLE IF NOT EXISTS public.hp_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL UNIQUE REFERENCES public.companies(id),
  created_by uuid REFERENCES auth.users(id),
  start_date date,
  opening_balance numeric,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- email_aliases
CREATE TABLE IF NOT EXISTS public.email_aliases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  alias_email text NOT NULL UNIQUE,
  company_name text NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status = ANY(ARRAY['active','inactive','pending'])),
  mailgun_route_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  verified_at timestamptz,
  company_id uuid REFERENCES public.companies(id),
  UNIQUE(user_id, company_name)
);

-- feedback
CREATE TABLE IF NOT EXISTS public.feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  company_id uuid REFERENCES public.companies(id),
  company_name text,
  type text NOT NULL CHECK (type = ANY(ARRAY['bug','feedback'])),
  message text NOT NULL,
  user_email text,
  user_name text,
  status text NOT NULL DEFAULT 'new' CHECK (status = ANY(ARRAY['new','read','resolved','dismissed'])),
  slack_sent boolean NOT NULL DEFAULT false,
  slack_sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- dunning_sends
CREATE TABLE IF NOT EXISTS public.dunning_sends (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  company_id uuid NOT NULL REFERENCES public.companies(id),
  debtor_company_name text NOT NULL,
  debtor_tax_number text,
  debtor_email text NOT NULL,
  invoice_ids text[] NOT NULL DEFAULT '{}',
  sent_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'sent',
  error_message text,
  total_amount numeric DEFAULT 0,
  currency text DEFAULT 'HUF',
  created_at timestamptz NOT NULL DEFAULT now()
);
