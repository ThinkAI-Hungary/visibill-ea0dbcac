-- Create NAV-specific tables (keeping existing invoices table unchanged)

-- First create the helper function
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 1. User NAV Credentials (using Supabase Vault for encryption)
CREATE TABLE IF NOT EXISTS public.user_nav_credentials (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  
  -- Basic info (not encrypted)
  nav_username TEXT NOT NULL,
  nav_tax_number TEXT NOT NULL,
  software_dev_name TEXT,
  software_dev_contact TEXT,
  is_test_environment BOOLEAN DEFAULT true,
  
  -- Vault secret IDs (these reference encrypted secrets in vault.secrets)
  password_secret_id UUID,
  sign_key_secret_id UUID,
  exchange_key_secret_id UUID,
  
  -- Metadata
  software_id TEXT,
  last_validated_at TIMESTAMP WITH TIME ZONE,
  validation_status TEXT DEFAULT 'pending',
  validation_error TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. NAV Invoices table (separate from existing invoices)
CREATE TABLE IF NOT EXISTS public.nav_invoices (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  
  invoice_number TEXT NOT NULL,
  invoice_direction TEXT, -- 'OUTBOUND' or 'INBOUND'
  invoice_operation TEXT,
  supplier_tax_number TEXT,
  customer_tax_number TEXT,
  invoice_issue_date DATE,
  invoice_delivery_date DATE,
  
  invoice_net_amount NUMERIC(15, 2),
  invoice_vat_amount NUMERIC(15, 2),
  invoice_gross_amount NUMERIC(15, 2),
  
  payment_method TEXT,
  currency TEXT DEFAULT 'HUF',
  
  fetched_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(user_id, invoice_number)
);

-- 3. NAV Sync logs
CREATE TABLE IF NOT EXISTS public.nav_sync_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  
  sync_type TEXT NOT NULL,
  invoice_direction TEXT,
  date_from DATE,
  date_to DATE,
  
  invoices_fetched INTEGER DEFAULT 0,
  status TEXT NOT NULL,
  error_message TEXT,
  duration_ms INTEGER,
  
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_user_nav_credentials_user_id ON public.user_nav_credentials(user_id);
CREATE INDEX IF NOT EXISTS idx_nav_invoices_user_id ON public.nav_invoices(user_id);
CREATE INDEX IF NOT EXISTS idx_nav_invoices_date ON public.nav_invoices(user_id, invoice_issue_date);
CREATE INDEX IF NOT EXISTS idx_nav_sync_logs_user_id ON public.nav_sync_logs(user_id);

-- Enable RLS
ALTER TABLE public.user_nav_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nav_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nav_sync_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can manage own NAV credentials"
  ON public.user_nav_credentials
  FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own NAV invoices"
  ON public.nav_invoices
  FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view own NAV sync logs"
  ON public.nav_sync_logs
  FOR SELECT
  USING (auth.uid() = user_id);

-- Function to save NAV credentials with Vault encryption
CREATE OR REPLACE FUNCTION save_nav_credentials(
  p_nav_username TEXT,
  p_nav_password TEXT,
  p_nav_tax_number TEXT,
  p_nav_sign_key TEXT,
  p_nav_exchange_key TEXT,
  p_software_dev_name TEXT DEFAULT NULL,
  p_software_dev_contact TEXT DEFAULT NULL,
  p_is_test_environment BOOLEAN DEFAULT true
)
RETURNS JSON
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_user_id UUID;
  v_password_secret_id UUID;
  v_sign_key_secret_id UUID;
  v_exchange_key_secret_id UUID;
  v_software_id TEXT;
BEGIN
  -- Get current user
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  
  -- Validate tax number (8 digits)
  IF p_nav_tax_number !~ '^\d{8}$' THEN
    RAISE EXCEPTION 'Tax number must be 8 digits';
  END IF;
  
  -- Generate software ID
  v_software_id := 'HU' || p_nav_tax_number || substr(md5(random()::text), 1, 8);
  v_software_id := upper(substr(v_software_id, 1, 18));
  
  -- Store secrets in Vault
  v_password_secret_id := vault.create_secret(
    p_nav_password,
    'nav_password_' || v_user_id::text,
    'NAV password for user'
  );
  
  v_sign_key_secret_id := vault.create_secret(
    p_nav_sign_key,
    'nav_sign_key_' || v_user_id::text,
    'NAV sign key for user'
  );
  
  v_exchange_key_secret_id := vault.create_secret(
    p_nav_exchange_key,
    'nav_exchange_key_' || v_user_id::text,
    'NAV exchange key for user'
  );
  
  -- Upsert credentials
  INSERT INTO public.user_nav_credentials (
    user_id,
    nav_username,
    nav_tax_number,
    password_secret_id,
    sign_key_secret_id,
    exchange_key_secret_id,
    software_id,
    software_dev_name,
    software_dev_contact,
    is_test_environment,
    validation_status
  ) VALUES (
    v_user_id,
    p_nav_username,
    p_nav_tax_number,
    v_password_secret_id,
    v_sign_key_secret_id,
    v_exchange_key_secret_id,
    v_software_id,
    p_software_dev_name,
    p_software_dev_contact,
    p_is_test_environment,
    'pending'
  )
  ON CONFLICT (user_id) DO UPDATE SET
    nav_username = EXCLUDED.nav_username,
    nav_tax_number = EXCLUDED.nav_tax_number,
    password_secret_id = EXCLUDED.password_secret_id,
    sign_key_secret_id = EXCLUDED.sign_key_secret_id,
    exchange_key_secret_id = EXCLUDED.exchange_key_secret_id,
    software_dev_name = EXCLUDED.software_dev_name,
    software_dev_contact = EXCLUDED.software_dev_contact,
    is_test_environment = EXCLUDED.is_test_environment,
    validation_status = 'pending',
    updated_at = NOW();
  
  RETURN json_build_object(
    'success', true,
    'message', 'Credentials saved successfully',
    'software_id', v_software_id
  );
END;
$$;

-- Function to get decrypted credentials (only callable from Edge Functions)
CREATE OR REPLACE FUNCTION get_nav_credentials(p_user_id UUID)
RETURNS JSON
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_cred RECORD;
  v_password TEXT;
  v_sign_key TEXT;
  v_exchange_key TEXT;
BEGIN
  -- Get credentials
  SELECT * INTO v_cred
  FROM public.user_nav_credentials
  WHERE user_id = p_user_id;
  
  IF NOT FOUND THEN
    RETURN json_build_object('error', 'Credentials not found');
  END IF;
  
  -- Decrypt from Vault
  SELECT decrypted_secret INTO v_password
  FROM vault.decrypted_secrets
  WHERE id = v_cred.password_secret_id;
  
  SELECT decrypted_secret INTO v_sign_key
  FROM vault.decrypted_secrets
  WHERE id = v_cred.sign_key_secret_id;
  
  SELECT decrypted_secret INTO v_exchange_key
  FROM vault.decrypted_secrets
  WHERE id = v_cred.exchange_key_secret_id;
  
  RETURN json_build_object(
    'nav_username', v_cred.nav_username,
    'nav_password', v_password,
    'nav_tax_number', v_cred.nav_tax_number,
    'nav_sign_key', v_sign_key,
    'nav_exchange_key', v_exchange_key,
    'software_id', v_cred.software_id,
    'software_dev_name', v_cred.software_dev_name,
    'software_dev_contact', v_cred.software_dev_contact,
    'is_test_environment', v_cred.is_test_environment
  );
END;
$$;

-- Trigger for updated_at on user_nav_credentials
CREATE TRIGGER update_user_nav_credentials_updated_at
  BEFORE UPDATE ON public.user_nav_credentials
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();