-- ============================================================
-- VISIBILL DATABASE MIGRATION - PART 2: Data Tables (with FK deps)
-- ============================================================

-- gl_accounts
CREATE TABLE IF NOT EXISTS public.gl_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  preset_id uuid NOT NULL REFERENCES public.chart_of_accounts_presets(id),
  gl_number varchar NOT NULL,
  short_name varchar NOT NULL,
  description text,
  parent_id uuid REFERENCES public.gl_accounts(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  company_id uuid REFERENCES public.companies(id),
  UNIQUE(preset_id, gl_number)
);

-- partners
CREATE TABLE IF NOT EXISTS public.partners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  company_id uuid REFERENCES public.companies(id),
  tax_number text NOT NULL,
  name text NOT NULL,
  partner_type text NOT NULL DEFAULT 'both' CHECK (partner_type = ANY(ARRAY['customer','supplier','both'])),
  address text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  default_project_id uuid REFERENCES public.projects(id),
  email text,
  UNIQUE(company_id, tax_number),
  UNIQUE(user_id, tax_number)
);

-- transaction_uploads
CREATE TABLE IF NOT EXISTS public.transaction_uploads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id),
  company_id uuid NOT NULL,
  file_name text NOT NULL,
  file_size bigint,
  file_type text,
  file_url text NOT NULL,
  upload_status text DEFAULT 'uploaded',
  processing_status text DEFAULT 'pending',
  error_message text,
  metadata jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- transactions
CREATE TABLE IF NOT EXISTS public.transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  transaction_date date NOT NULL,
  description text,
  amount numeric NOT NULL,
  currency char(3) DEFAULT 'HUF',
  type text,
  matched_invoice_id uuid,
  match_type text,
  confidence_score double precision DEFAULT 0,
  is_verified boolean DEFAULT false,
  upload_id uuid REFERENCES public.transaction_uploads(id),
  company_id uuid NOT NULL REFERENCES public.companies(id),
  reason text,
  gl_account_id uuid REFERENCES public.gl_accounts(id),
  gl_is_manually_overridden boolean DEFAULT false,
  gl_ai_confidence_score numeric,
  gl_reasoning text,
  gl_classifications jsonb DEFAULT '{}'::jsonb
);
CREATE UNIQUE INDEX IF NOT EXISTS unique_transaction_entry ON public.transactions(transaction_date, description);

-- invoice_uploads
CREATE TABLE IF NOT EXISTS public.invoice_uploads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  file_name text NOT NULL,
  file_size integer NOT NULL,
  file_type text NOT NULL,
  file_url text NOT NULL,
  upload_status text NOT NULL DEFAULT 'uploaded',
  processing_status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  error_message text,
  metadata jsonb,
  company_id uuid REFERENCES public.companies(id)
);

-- invoices
CREATE TABLE IF NOT EXISTS public.invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  category_id uuid REFERENCES public.categories(id),
  bizonylatsorszam text NOT NULL,
  kibocsatas_datuma date NOT NULL,
  elado_vat_id text,
  elado_nev text NOT NULL,
  elado_cim text,
  vevo_nev text NOT NULL,
  vevo_cim text,
  vevo_vat_id text,
  teljesites_datuma date,
  adoalap_osszesen numeric NOT NULL DEFAULT 0,
  afa_kulcsok_bontasban text,
  afa_osszeg_osszesen numeric NOT NULL DEFAULT 0,
  brutto_vegosszeg numeric NOT NULL DEFAULT 0,
  forditott_adozas boolean DEFAULT false,
  adomentesseg_hivatkozas text,
  onszamlazas boolean DEFAULT false,
  penzforgalmi_elszamolas boolean DEFAULT false,
  penznem text DEFAULT 'HUF',
  statusz text DEFAULT 'feldolgozas_alatt' CHECK (statusz = ANY(ARRAY['feldolgozas_alatt','feldolgozott','kifizetve','keses','torolt'])),
  melleklet_url text,
  email_uzenet_id text,
  feldolgozva timestamptz,
  letrehozva timestamptz NOT NULL DEFAULT now(),
  frissitve timestamptz NOT NULL DEFAULT now(),
  invoice_type text NOT NULL DEFAULT 'sima_szla' CHECK (invoice_type = ANY(ARRAY['sima_szla','egyszerusitett_szla','dijbekero_proforma','dijbekero','vegszamla'])),
  termek_szolgaltatas_tipusa text,
  dokumentum_azonosito text,
  fizetendo_osszeg numeric,
  fizetesi_mod text,
  bankszamlaszam_iban text,
  adojogi_megjegyzes text,
  fizetesi_hatarido date,
  elolegszamla_hivatkozas text,
  elszamolt_eloleg_osszeg numeric,
  fizetve boolean DEFAULT false,
  project_id uuid REFERENCES public.projects(id),
  image_url text,
  company_id uuid REFERENCES public.companies(id),
  invoice_direction text,
  reference_number text,
  invoice_uploads_id uuid REFERENCES public.invoice_uploads(id),
  transaction_id uuid REFERENCES public.transactions(id),
  gl_account_id uuid REFERENCES public.gl_accounts(id),
  gl_is_manually_overridden boolean DEFAULT false,
  gl_ai_confidence_score numeric,
  gl_reasoning text,
  gl_classifications jsonb DEFAULT '{}'::jsonb
);
CREATE UNIQUE INDEX IF NOT EXISTS invoices_company_id_bizonylatsorszam_key ON public.invoices(company_id, bizonylatsorszam);

-- invoice_items
CREATE TABLE IF NOT EXISTS public.invoice_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.invoices(id),
  line_number integer NOT NULL,
  line_description text,
  quantity numeric,
  unit_of_measure text,
  unit_price numeric,
  net_amount numeric,
  vat_rate text,
  vat_amount numeric,
  gross_amount numeric,
  product_code text,
  gl_classifications jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- nav_invoices
CREATE TABLE IF NOT EXISTS public.nav_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id),
  invoice_number text NOT NULL,
  invoice_direction text,
  invoice_operation text,
  supplier_tax_number text,
  customer_tax_number text,
  invoice_issue_date date,
  invoice_delivery_date date,
  invoice_net_amount numeric,
  invoice_vat_amount numeric,
  invoice_gross_amount numeric,
  payment_method text,
  currency text DEFAULT 'HUF',
  fetched_at timestamptz,
  created_at timestamptz DEFAULT now(),
  company_id uuid REFERENCES public.companies(id),
  paid boolean DEFAULT false,
  submitted boolean DEFAULT false,
  supplier_name text,
  supplier_address text,
  customer_name text,
  customer_address text,
  payment_date date,
  details_fetched boolean DEFAULT false,
  project_id uuid REFERENCES public.projects(id),
  category_id uuid REFERENCES public.categories(id),
  ai_categorization_reason text,
  supplier_partner_id uuid REFERENCES public.partners(id),
  transaction_id uuid REFERENCES public.transactions(id),
  gl_account_id uuid REFERENCES public.gl_accounts(id),
  gl_is_manually_overridden boolean DEFAULT false,
  gl_ai_confidence_score numeric,
  gl_reasoning text,
  gl_classifications jsonb DEFAULT '{}'::jsonb
);
CREATE UNIQUE INDEX IF NOT EXISTS nav_invoices_company_id_invoice_number_key ON public.nav_invoices(company_id, invoice_number);

-- nav_invoice_items
CREATE TABLE IF NOT EXISTS public.nav_invoice_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nav_invoice_id uuid NOT NULL REFERENCES public.nav_invoices(id),
  line_number integer NOT NULL,
  line_description text,
  quantity numeric,
  unit_of_measure text,
  unit_price numeric,
  net_amount numeric,
  vat_rate text,
  vat_amount numeric,
  gross_amount numeric,
  product_code text,
  created_at timestamptz DEFAULT now(),
  gl_classifications jsonb DEFAULT '{}'::jsonb
);

-- nav_sync_logs
CREATE TABLE IF NOT EXISTS public.nav_sync_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id),
  sync_type text NOT NULL,
  invoice_direction text,
  date_from date,
  date_to date,
  invoices_fetched integer DEFAULT 0,
  status text NOT NULL,
  error_message text,
  duration_ms integer,
  started_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  company_id uuid REFERENCES public.companies(id)
);

-- user_nav_credentials
CREATE TABLE IF NOT EXISTS public.user_nav_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id),
  nav_username text NOT NULL,
  nav_tax_number text NOT NULL,
  software_dev_name text,
  software_dev_contact text,
  is_test_environment boolean DEFAULT true,
  password_secret_id uuid,
  sign_key_secret_id uuid,
  exchange_key_secret_id uuid,
  software_id text,
  last_validated_at timestamptz,
  validation_status text DEFAULT 'pending',
  validation_error text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  company_id uuid REFERENCES public.companies(id),
  UNIQUE(user_id, company_id)
);

-- salary_files
CREATE TABLE IF NOT EXISTS public.salary_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  payment_type text NOT NULL CHECK (payment_type = ANY(ARRAY['salary','tax_contribution','social_security','health_insurance','pension','other'])),
  employee_name text,
  recipient_name text NOT NULL,
  description text NOT NULL,
  amount_to_transfer numeric NOT NULL CHECK (amount_to_transfer >= 0),
  payment_date date,
  due_date date,
  period_month integer CHECK (period_month >= 1 AND period_month <= 12),
  period_year integer CHECK (period_year >= 2000),
  status text NOT NULL DEFAULT 'pending' CHECK (status = ANY(ARRAY['pending','paid','cancelled','overdue','processing','webhook_sent','webhook_failed','completed'])),
  payment_reference text,
  file_url text,
  file_name text,
  source text NOT NULL DEFAULT 'manual' CHECK (source = ANY(ARRAY['manual','automated'])),
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  company_id uuid REFERENCES public.companies(id),
  file_size integer
);

-- salary
CREATE TABLE IF NOT EXISTS public.salary (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  "név" text NOT NULL,
  "összeg" numeric NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  "dátum" date,
  company_id uuid REFERENCES public.companies(id),
  tipus text NOT NULL,
  statusz text NOT NULL,
  kifizetes_ideje timestamptz,
  megjegyzes text,
  fizetesi_mod text NOT NULL,
  transaction_id uuid REFERENCES public.transactions(id),
  salary_file_id uuid REFERENCES public.salary_files(id),
  munkavallalo_neve text
);

-- tax
CREATE TABLE IF NOT EXISTS public.tax (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  adonem text NOT NULL,
  osszeg numeric NOT NULL,
  datum date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  company_id uuid REFERENCES public.companies(id)
);

-- audit_logs
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id),
  user_id uuid REFERENCES auth.users(id),
  action audit_action_type NOT NULL,
  entity audit_entity_type NOT NULL,
  entity_name text,
  details jsonb,
  created_at timestamptz DEFAULT now()
);

-- gl_overrides_log
CREATE TABLE IF NOT EXISTS public.gl_overrides_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL,
  original_gl_account_id uuid,
  new_gl_account_id uuid NOT NULL,
  user_id uuid NOT NULL,
  created_at timestamptz DEFAULT now(),
  company_id uuid REFERENCES public.companies(id),
  source_table text
);

-- gl_upload_notifications
CREATE TABLE IF NOT EXISTS public.gl_upload_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  message text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- employee_rates
CREATE TABLE IF NOT EXISTS public.employee_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id),
  user_id uuid REFERENCES auth.users(id),
  employee_name text NOT NULL,
  employee_type text NOT NULL DEFAULT 'employee' CHECK (employee_type = ANY(ARRAY['employee','contractor'])),
  base_salary_cost numeric,
  hourly_rate numeric,
  effective_date date NOT NULL DEFAULT CURRENT_DATE,
  email text,
  phone text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  registration_token text UNIQUE DEFAULT encode(extensions.gen_random_bytes(16), 'hex')
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_employee_rates_company_name ON public.employee_rates(company_id, employee_name);

-- time_entries
CREATE TABLE IF NOT EXISTS public.time_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  project_id uuid REFERENCES public.projects(id),
  date date NOT NULL DEFAULT CURRENT_DATE,
  hours numeric NOT NULL CHECK (hours > 0 AND hours <= 24),
  description text,
  status text NOT NULL DEFAULT 'draft' CHECK (status = ANY(ARRAY['draft','submitted','approved'])),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  absence_type text CHECK (absence_type IS NULL OR absence_type = ANY(ARRAY['vacation','sick','personal','other']))
);

-- leave_requests
CREATE TABLE IF NOT EXISTS public.leave_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  leave_type text NOT NULL DEFAULT 'vacation' CHECK (leave_type = ANY(ARRAY['vacation','sick','personal','other'])),
  start_date date NOT NULL,
  end_date date NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status = ANY(ARRAY['pending','approved','rejected'])),
  note text,
  admin_note text,
  reviewed_by uuid REFERENCES auth.users(id),
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- fixed_assets
CREATE TABLE IF NOT EXISTS public.fixed_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  inventory_number text NOT NULL,
  name text NOT NULL,
  description text,
  vtsz_teszor text,
  acquisition_value numeric NOT NULL,
  residual_value numeric DEFAULT 0,
  currency text DEFAULT 'HUF',
  purchase_date date NOT NULL,
  activation_date date NOT NULL,
  disposal_date date,
  useful_life_months integer NOT NULL,
  depreciation_method text DEFAULT 'linear',
  tao_template_id uuid REFERENCES public.tao_depreciation_templates(id),
  tao_rate_override numeric,
  location_id uuid REFERENCES public.company_locations(id),
  activated_by_user_id uuid REFERENCES auth.users(id),
  activated_by_name text,
  source_invoice_id uuid,
  source_invoice_type text CHECK (source_invoice_type IS NULL OR source_invoice_type = ANY(ARRAY['submitted','nav'])),
  source_invoice_number text,
  supplier_name text,
  status text NOT NULL DEFAULT 'active' CHECK (status = ANY(ARRAY['active','disposed','sold','missing'])),
  documents jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  gl_account_id uuid REFERENCES public.gl_accounts(id),
  UNIQUE(company_id, inventory_number)
);

-- asset_events
CREATE TABLE IF NOT EXISTS public.asset_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id uuid NOT NULL REFERENCES public.fixed_assets(id),
  company_id uuid NOT NULL REFERENCES public.companies(id),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  event_type text NOT NULL CHECK (event_type = ANY(ARRAY['activation','transfer','reactivation','disposal','inventory_check','value_change'])),
  event_date date NOT NULL DEFAULT CURRENT_DATE,
  description text,
  old_values jsonb,
  new_values jsonb,
  created_at timestamptz DEFAULT now()
);

-- bank_statements
CREATE TABLE IF NOT EXISTS public.bank_statements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  file_name text NOT NULL,
  file_url text,
  file_size integer,
  file_type text,
  bank_name text,
  account_number text,
  statement_period_start date,
  statement_period_end date,
  opening_balance numeric,
  closing_balance numeric,
  total_credits numeric DEFAULT 0,
  total_debits numeric DEFAULT 0,
  transaction_count integer DEFAULT 0,
  currency text DEFAULT 'HUF',
  processed_at timestamptz,
  status text DEFAULT 'uploaded' CHECK (status = ANY(ARRAY['uploaded','processing','processed','error'])),
  error_message text,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  company_id uuid REFERENCES public.companies(id)
);

-- bank_transactions
CREATE TABLE IF NOT EXISTS public.bank_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_statement_id uuid NOT NULL REFERENCES public.bank_statements(id),
  transaction_date date NOT NULL,
  value_date date,
  description text NOT NULL,
  reference text,
  amount numeric NOT NULL,
  balance numeric,
  transaction_type text CHECK (transaction_type = ANY(ARRAY['credit','debit'])),
  category text,
  counterparty_name text,
  counterparty_account text,
  currency text DEFAULT 'HUF',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- bank_statement_uploads
CREATE TABLE IF NOT EXISTS public.bank_statement_uploads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  file_name text NOT NULL,
  file_size integer NOT NULL,
  file_type text NOT NULL,
  file_url text NOT NULL,
  upload_status text NOT NULL DEFAULT 'uploaded',
  processing_status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  error_message text,
  metadata jsonb,
  company_id uuid REFERENCES public.companies(id)
);

-- Backup tables
CREATE TABLE IF NOT EXISTS public.sima_szamla_backup (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL, bizonylatsorszam text NOT NULL, kibocsatas_datuma date NOT NULL,
  elado_vat_id text, elado_nev text NOT NULL, elado_cim text, vevo_nev text NOT NULL, vevo_cim text, vevo_vat_id text,
  teljesites_datuma date, adoalap_osszesen numeric DEFAULT 0, afa_kulcsok_bontasban text, afa_osszeg_osszesen numeric DEFAULT 0,
  brutto_vegosszeg numeric DEFAULT 0, forditott_adozas boolean DEFAULT false, adomentesseg_hivatkozas text,
  onszamlazas boolean DEFAULT false, penzforgalmi_elszamolas boolean DEFAULT false, penznem text DEFAULT 'HUF',
  statusz text DEFAULT 'feldolgozas_alatt', category_id uuid, melleklet_url text, email_uzenet_id text,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), project_id uuid
);
CREATE TABLE IF NOT EXISTS public.vegszamla_backup (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL, szamlaszam text NOT NULL, kibocsatas_datuma date NOT NULL,
  elado_vat_id text, elado_nev text NOT NULL, elado_cim text, vevo_nev text NOT NULL, vevo_cim text,
  adoalap_osszesen numeric DEFAULT 0, afa_osszeg_osszesen numeric DEFAULT 0, elolegszamla_hivatkozas text,
  elszamolt_eloleg_osszeg numeric, brutto_vegosszeg numeric DEFAULT 0, teljesites_datuma date,
  forditott_adozas boolean DEFAULT false, category_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), project_id uuid
);
CREATE TABLE IF NOT EXISTS public.proforma_backup (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL, dokumentum_azonosito text, kibocsatas_datuma date NOT NULL,
  elado_vat_id text, fizetendo_osszeg numeric, fizetesi_mod text, vevo_nev text NOT NULL, elado_nev text NOT NULL,
  bankszamlaszam_iban text, adojogi_megjegyzes text, fizetesi_hatarido date, category_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), project_id uuid
);
CREATE TABLE IF NOT EXISTS public.egyszerusitett_szamla_backup (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL, elado_vat_id text, kibocsatas_datuma date NOT NULL,
  termek_szolgaltatas_tipusa text, afa_osszeg numeric, adoalap_osszesen_netto numeric,
  elado_cim text, vevo_nev text NOT NULL, elado_nev text NOT NULL, category_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), project_id uuid
);
