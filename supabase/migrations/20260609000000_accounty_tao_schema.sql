-- ==================================================
-- MERGED FROM: 20260609_accounty_tao_schema.sql
-- ==================================================
-- ============================================================================
-- ACCOUNTY TAO/KIVA MODULE — DATABASE SCHEMA
-- ============================================================================
-- Migráció: TAO éves adatok és KIVA kalkuláció
-- Dátum: 2026-06-09
-- ============================================================================

-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║  1. accounty_tao_yearly                                           ║
-- ║  Éves TAO-adatok és kalkuláció lépésenként                        ║
-- ╚══════════════════════════════════════════════════════════════════════╝

CREATE TABLE IF NOT EXISTS public.accounty_tao_yearly (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  tax_year INTEGER NOT NULL,

  -- Wizard állapot
  current_step INTEGER DEFAULT 1 CHECK (current_step >= 1 AND current_step <= 11),
  status TEXT DEFAULT 'draft' CHECK (status IN (
    'draft',        -- Tervezet
    'in_progress',  -- Folyamatban
    'calculated',   -- Kiszámolva
    'approved',     -- Jóváhagyva
    'submitted',    -- Beküldve
    'closed'        -- Lezárva
  )),

  -- 1. Beszámoló — eredménykimutatás alapadatok
  revenue NUMERIC DEFAULT 0,                -- Értékesítés nettó árbevétele
  other_revenue NUMERIC DEFAULT 0,          -- Egyéb bevételek
  material_costs NUMERIC DEFAULT 0,         -- Anyagjellegű ráfordítások
  personnel_costs NUMERIC DEFAULT 0,        -- Személyi jellegű ráfordítások
  depreciation NUMERIC DEFAULT 0,           -- Értékcsökkenési leírás
  other_costs NUMERIC DEFAULT 0,            -- Egyéb ráfordítások
  financial_result NUMERIC DEFAULT 0,       -- Pénzügyi eredmény

  -- 2. AEE (Adózás Előtti Eredmény)
  aee NUMERIC DEFAULT 0,                    -- Számított AEE

  -- 3. 7.§ csökkentő tételek (JSONB — rugalmas)
  decreasing_items JSONB DEFAULT '{}',
  -- Struktúra: {
  --   "rd_allowance": 0,           -- K+F költség
  --   "investment_allowance": 0,    -- Beruházási kedvezmény
  --   "provision_release": 0,       -- Céltartalék felszabadítás
  --   "royalty_income": 0,          -- Szellemi tulajdon bevétel
  --   "donation_allowance": 0,      -- Közérdekű adomány
  --   "startup_deduction": 0,       -- Induló vállalkozás
  --   "sme_investment": 0,          -- KKV beruházás
  --   "other": 0
  -- }
  decreasing_total NUMERIC DEFAULT 0,

  -- 4. 8.§ növelő tételek (JSONB)
  increasing_items JSONB DEFAULT '{}',
  -- Struktúra: {
  --   "depreciation_diff": 0,       -- Szv-i vs adó értékcsökkenés különbözet
  --   "thin_cap": 0,                -- Alultőkésítés
  --   "transfer_pricing": 0,        -- Transzferár korrekció
  --   "penalty_fine": 0,            -- Bírság, büntetés
  --   "non_deductible": 0,          -- Nem elismert költségek
  --   "provision_formed": 0,        -- Céltartalék képzés
  --   "other": 0
  -- }
  increasing_total NUMERIC DEFAULT 0,

  -- 5. Kamatkorlát (EBITDA 30%)
  ebitda NUMERIC DEFAULT 0,
  interest_expense NUMERIC DEFAULT 0,
  interest_limit NUMERIC DEFAULT 0,         -- EBITDA × 30%
  interest_adjustment NUMERIC DEFAULT 0,    -- Levonható kamat korrekció

  -- 6. CFC-szabályok
  has_cfc BOOLEAN DEFAULT FALSE,
  cfc_data JSONB DEFAULT '{}',              -- Ellenőrzött külföldi társaság adatai

  -- 7. Módosított adóalap
  modified_tax_base NUMERIC DEFAULT 0,      -- AEE + növelő - csökkentő + kamat kiigazítás
  tax_base NUMERIC DEFAULT 0,              -- max(0, modified_tax_base)

  -- 8. Adókedvezmények (JSONB)
  tax_credits JSONB DEFAULT '{}',
  -- Struktúra: {
  --   "development": 0,             -- Fejlesztési adókedvezmény
  --   "energy_efficiency": 0,       -- Energiahatékonysági
  --   "performing_arts": 0,         -- Előadó-művészeti
  --   "sports_development": 0,      -- Sportfejlesztési
  --   "small_business": 0,          -- Kisvállalkozói
  --   "other": 0
  -- }
  tax_credits_total NUMERIC DEFAULT 0,

  -- 9. Felajánlás
  donations JSONB DEFAULT '{}',
  -- Struktúra: {
  --   "spectator_sports": 0,        -- Látvány-csapatsport
  --   "film": 0,                    -- Filmalkotás
  --   "performing_arts_donation": 0  -- Előadó-művészet
  -- }
  donations_total NUMERIC DEFAULT 0,

  -- 10. Fizetendő adó
  calculated_tax NUMERIC DEFAULT 0,         -- tax_base × 9%
  advance_payments NUMERIC DEFAULT 0,       -- Befizetett adóelőlegek
  payable_tax NUMERIC DEFAULT 0,            -- Fizetendő (calculated - credits - donations - advances)

  -- 11. Beküldés
  filing_status TEXT DEFAULT 'not_started' CHECK (filing_status IN (
    'not_started', 'draft', 'generated', 'submitted', 'accepted'
  )),
  filing_reference TEXT,                    -- NAV hivatkozási szám
  submitted_at TIMESTAMPTZ,
  submitted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Metaadatok
  notes TEXT,
  metadata JSONB DEFAULT '{}',
  approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(company_id, tax_year)
);

COMMENT ON TABLE public.accounty_tao_yearly IS 'TAO modul éves adókalkuláció. 11 lépéses wizard állapot és minden számított mező.';

-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║  INDEXES                                                          ║
-- ╚══════════════════════════════════════════════════════════════════════╝

CREATE INDEX IF NOT EXISTS idx_accounty_tao_yearly_company ON public.accounty_tao_yearly(company_id);
CREATE INDEX IF NOT EXISTS idx_accounty_tao_yearly_year ON public.accounty_tao_yearly(tax_year);
CREATE INDEX IF NOT EXISTS idx_accounty_tao_yearly_status ON public.accounty_tao_yearly(status);

-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║  ROW LEVEL SECURITY                                               ║
-- ╚══════════════════════════════════════════════════════════════════════╝

ALTER TABLE public.accounty_tao_yearly ENABLE ROW LEVEL SECURITY;

CREATE POLICY "accounty_tao_yearly_select" ON public.accounty_tao_yearly
  FOR SELECT
  USING (company_id IN (
    SELECT aa.company_id FROM public.accounty_assignments aa
    WHERE aa.accountant_user_id = auth.uid()
  ));

CREATE POLICY "accounty_tao_yearly_modify" ON public.accounty_tao_yearly
  FOR ALL
  USING (company_id IN (
    SELECT aa.company_id FROM public.accounty_assignments aa
    WHERE aa.accountant_user_id = auth.uid()
  ));

-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║  UPDATED_AT TRIGGER                                               ║
-- ╚══════════════════════════════════════════════════════════════════════╝

CREATE TRIGGER trg_accounty_tao_yearly_updated_at
  BEFORE UPDATE ON public.accounty_tao_yearly
  FOR EACH ROW EXECUTE FUNCTION public.accounty_set_updated_at();


-- ==================================================
-- MERGED FROM: 20260609_fix_subscription_trigger_security_definer.sql
-- ==================================================
-- Fix: Registration "Database error saving new user" — TWO root causes
--
-- ROOT CAUSE 1: handle_new_user() uses gen_random_bytes(32) to generate
-- an email verification token, but SET search_path TO 'public' excluded
-- the 'extensions' schema where gen_random_bytes lives (pgcrypto).
-- Error: "function gen_random_bytes(integer) does not exist (SQLSTATE 42883)"
--
-- ROOT CAUSE 2: initialize_user_subscription() was missing SECURITY DEFINER,
-- so RLS on user_subscriptions blocked the cascading INSERT because
-- auth.uid() is NULL in the trigger context.
--
-- Fix: Add 'extensions' to search_path in handle_new_user, and add
-- SECURITY DEFINER to initialize_user_subscription.

-- 1. Fix handle_new_user: add 'extensions' schema to search_path
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  verify_token text;
  request_id bigint;
  anon_key text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ4eGd2ZGxxdnZjaHRsbXFucnFmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc5NzAwNTAsImV4cCI6MjA3MzU0NjA1MH0.Ec9KFcjt89cY6FF9Nq9GnW1hzlnDUhQCCJ_LhWm2evY';
  supabase_url text := 'https://vxxgvdlqvvchtlmqnrqf.supabase.co';
BEGIN
  -- Generate verification token
  verify_token := encode(gen_random_bytes(32), 'hex');

  -- Insert profile
  INSERT INTO public.profiles (user_id, name, email_verified, email_verify_token)
  VALUES (
    NEW.id, 
    NEW.raw_user_meta_data ->> 'name',
    false,
    verify_token
  );

  -- Fire welcome email via pg_net (async server-to-server HTTP, no CORS)
  SELECT net.http_post(
    url := supabase_url || '/functions/v1/send-welcome-email',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', anon_key,
      'Authorization', 'Bearer ' || anon_key
    ),
    body := jsonb_build_object(
      'userId', NEW.id::text,
      'email', NEW.email,
      'name', COALESCE(NEW.raw_user_meta_data ->> 'name', split_part(NEW.email, '@', 1))
    )
  ) INTO request_id;
  
  RAISE LOG '[handle_new_user] Welcome email queued via pg_net, request_id: %', request_id;

  RETURN NEW;
END;
$function$;

-- 2. Fix initialize_user_subscription: add SECURITY DEFINER
CREATE OR REPLACE FUNCTION public.initialize_user_subscription()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.user_subscriptions (user_id, tier, invoice_limit, invoices_used)
  VALUES (NEW.user_id, 'teszt', 999999, 0)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$function$;
