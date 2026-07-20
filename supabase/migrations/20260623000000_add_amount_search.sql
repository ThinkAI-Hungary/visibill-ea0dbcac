-- ==================================================
-- MERGED FROM: 20260623_add_amount_search.sql
-- ==================================================
-- Migration: Add amount search to invoice filter RPC functions
-- Also adds amount fields to the text search (ILIKE) clause
--
-- IMPORTANT: Functions must be VOLATILE (not STABLE) because PostgREST v12+
-- only allows GET for STABLE functions, but Supabase JS client uses POST for .rpc()

-- Drop ALL overloads to avoid PostgREST PGRST203 ambiguous overload errors
DROP FUNCTION IF EXISTS public.get_filtered_nav_invoices(
  uuid, date, date, text, text, text, text, text, text, text, text, numeric, numeric, text, text, integer, integer
);
DROP FUNCTION IF EXISTS public.get_filtered_nav_invoices(
  uuid, date, date, text, text, text, text, text, text, text, text, numeric, numeric, text, text, integer, integer, date, date
);
DROP FUNCTION IF EXISTS public.get_filtered_submitted_invoices(
  uuid, date, date, text, text, text, text, text, numeric, numeric, text, text, integer, integer
);
DROP FUNCTION IF EXISTS public.get_filtered_submitted_invoices(
  uuid, date, date, text, text, text, text, text, text, numeric, numeric, text, text, integer, integer, date, date
);

-- ══════════════════════════════════════════════════════════════════
-- NAV invoices filter function (single overload with all features)
-- ══════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.get_filtered_nav_invoices(
  p_company_id uuid,
  p_date_from date,
  p_date_to date,
  p_direction text,
  p_search text DEFAULT NULL,
  p_currency text DEFAULT NULL,
  p_paid text DEFAULT NULL,
  p_submitted text DEFAULT NULL,
  p_project_id text DEFAULT NULL,
  p_category_id text DEFAULT NULL,
  p_payment_method text DEFAULT NULL,
  p_amount_min numeric DEFAULT NULL,
  p_amount_max numeric DEFAULT NULL,
  p_sort_field text DEFAULT 'invoice_issue_date',
  p_sort_dir text DEFAULT 'desc',
  p_page integer DEFAULT 1,
  p_page_size integer DEFAULT 50,
  p_issue_date_from date DEFAULT NULL,
  p_issue_date_to date DEFAULT NULL
)
RETURNS TABLE(
  id uuid,
  invoice_number text,
  invoice_direction text,
  invoice_issue_date date,
  invoice_delivery_date date,
  supplier_tax_number text,
  supplier_name text,
  supplier_address text,
  customer_tax_number text,
  customer_name text,
  customer_address text,
  invoice_net_amount numeric,
  invoice_gross_amount numeric,
  invoice_vat_amount numeric,
  currency text,
  payment_method text,
  invoice_operation text,
  payment_date date,
  paid boolean,
  submitted boolean,
  details_fetched boolean,
  company_id uuid,
  user_id uuid,
  created_at timestamptz,
  fetched_at timestamptz,
  project_id uuid,
  category_id uuid,
  transaction_id uuid,
  exclude_from_accounting boolean,
  total_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ni.id, ni.invoice_number, ni.invoice_direction,
    ni.invoice_issue_date, ni.invoice_delivery_date,
    ni.supplier_tax_number, ni.supplier_name, ni.supplier_address,
    ni.customer_tax_number, ni.customer_name, ni.customer_address,
    ni.invoice_net_amount, ni.invoice_gross_amount, ni.invoice_vat_amount,
    ni.currency, ni.payment_method, ni.invoice_operation,
    ni.payment_date, ni.paid, ni.submitted, ni.details_fetched,
    ni.company_id, ni.user_id, ni.created_at, ni.fetched_at,
    ni.project_id, ni.category_id, ni.transaction_id,
    ni.exclude_from_accounting,
    count(*) OVER()::bigint AS total_count
  FROM nav_invoices ni
  WHERE ni.company_id = p_company_id
    AND ni.invoice_direction = p_direction
    AND ni.invoice_issue_date >= p_date_from
    AND ni.invoice_issue_date <= p_date_to
    AND (p_issue_date_from IS NULL OR ni.invoice_issue_date >= p_issue_date_from)
    AND (p_issue_date_to IS NULL OR ni.invoice_issue_date <= p_issue_date_to)
    AND (p_search IS NULL OR p_search = '' OR (
      ni.invoice_number ILIKE '%' || p_search || '%'
      OR ni.supplier_name ILIKE '%' || p_search || '%'
      OR ni.customer_name ILIKE '%' || p_search || '%'
      OR ni.supplier_tax_number ILIKE '%' || p_search || '%'
      OR ni.customer_tax_number ILIKE '%' || p_search || '%'
      OR ni.invoice_gross_amount::text ILIKE '%' || p_search || '%'
      OR ni.invoice_net_amount::text ILIKE '%' || p_search || '%'
    ))
    AND (p_currency IS NULL OR p_currency = 'all' OR ni.currency = p_currency)
    AND (p_paid IS NULL OR p_paid = 'all'
      OR (p_paid = 'yes' AND ni.transaction_id IS NOT NULL)
      OR (p_paid = 'no' AND ni.transaction_id IS NULL))
    AND (p_submitted IS NULL OR p_submitted = 'all'
      OR (p_submitted = 'yes' AND ni.submitted = true)
      OR (p_submitted = 'no' AND (ni.submitted IS NULL OR ni.submitted = false)))
    AND (p_project_id IS NULL OR p_project_id = 'all'
      OR (p_project_id = 'none' AND ni.project_id IS NULL)
      OR ni.project_id = p_project_id::uuid)
    AND (p_category_id IS NULL OR p_category_id = 'all'
      OR (p_category_id = 'none' AND ni.category_id IS NULL)
      OR ni.category_id = p_category_id::uuid)
    AND (p_payment_method IS NULL OR p_payment_method = 'all'
      OR (p_payment_method = 'none' AND ni.payment_method IS NULL)
      OR ni.payment_method = p_payment_method)
    AND (p_amount_min IS NULL OR COALESCE(ni.invoice_gross_amount, 0) >= p_amount_min)
    AND (p_amount_max IS NULL OR COALESCE(ni.invoice_gross_amount, 0) <= p_amount_max)
  ORDER BY
    CASE WHEN p_sort_dir = 'asc' THEN
      CASE p_sort_field
        WHEN 'invoice_issue_date' THEN ni.invoice_issue_date::text
        WHEN 'invoice_delivery_date' THEN ni.invoice_delivery_date::text
        WHEN 'invoice_number' THEN ni.invoice_number
        WHEN 'invoice_net_amount' THEN lpad(COALESCE(ni.invoice_net_amount, 0)::text, 20, '0')
        WHEN 'invoice_gross_amount' THEN lpad(COALESCE(ni.invoice_gross_amount, 0)::text, 20, '0')
        WHEN 'invoice_vat_amount' THEN lpad(COALESCE(ni.invoice_vat_amount, 0)::text, 20, '0')
        WHEN 'partner_name' THEN COALESCE(
          CASE WHEN p_direction = 'INBOUND' THEN ni.supplier_name ELSE ni.customer_name END, '')
        ELSE ni.invoice_issue_date::text
      END
    END ASC NULLS LAST,
    CASE WHEN p_sort_dir = 'desc' OR p_sort_dir IS NULL THEN
      CASE p_sort_field
        WHEN 'invoice_issue_date' THEN ni.invoice_issue_date::text
        WHEN 'invoice_delivery_date' THEN ni.invoice_delivery_date::text
        WHEN 'invoice_number' THEN ni.invoice_number
        WHEN 'invoice_net_amount' THEN lpad(COALESCE(ni.invoice_net_amount, 0)::text, 20, '0')
        WHEN 'invoice_gross_amount' THEN lpad(COALESCE(ni.invoice_gross_amount, 0)::text, 20, '0')
        WHEN 'invoice_vat_amount' THEN lpad(COALESCE(ni.invoice_vat_amount, 0)::text, 20, '0')
        WHEN 'partner_name' THEN COALESCE(
          CASE WHEN p_direction = 'INBOUND' THEN ni.supplier_name ELSE ni.customer_name END, '')
        ELSE ni.invoice_issue_date::text
      END
    END DESC NULLS LAST
  LIMIT p_page_size
  OFFSET (p_page - 1) * p_page_size;
END;
$$;

-- ══════════════════════════════════════════════════════════════════
-- Submitted invoices filter function (single overload with all features)
-- ══════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.get_filtered_submitted_invoices(
  p_company_id uuid,
  p_date_from date,
  p_date_to date,
  p_direction text,
  p_search text DEFAULT NULL,
  p_currency text DEFAULT NULL,
  p_category_id text DEFAULT NULL,
  p_project_id text DEFAULT NULL,
  p_amount_min numeric DEFAULT NULL,
  p_amount_max numeric DEFAULT NULL,
  p_sort_field text DEFAULT 'kibocsatas_datuma',
  p_sort_dir text DEFAULT 'desc',
  p_page integer DEFAULT 1,
  p_page_size integer DEFAULT 50,
  p_payment_method text DEFAULT NULL,
  p_issue_date_from date DEFAULT NULL,
  p_issue_date_to date DEFAULT NULL
)
RETURNS TABLE(
  id uuid,
  bizonylatsorszam text,
  kibocsatas_datuma date,
  teljesites_datuma date,
  elado_nev text,
  vevo_nev text,
  adoalap_osszesen numeric,
  brutto_vegosszeg numeric,
  afa_osszeg_osszesen numeric,
  penznem text,
  category_id uuid,
  project_id uuid,
  image_url text,
  melleklet_url text,
  invoice_direction text,
  reference_number text,
  exclude_from_accounting boolean,
  fizetesi_mod text,
  total_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT
    i.id, i.bizonylatsorszam, i.kibocsatas_datuma, i.teljesites_datuma,
    i.elado_nev, i.vevo_nev, i.adoalap_osszesen, i.brutto_vegosszeg,
    i.afa_osszeg_osszesen, i.penznem, i.category_id, i.project_id,
    i.image_url, i.melleklet_url, i.invoice_direction, i.reference_number,
    i.exclude_from_accounting, i.fizetesi_mod,
    count(*) OVER()::bigint AS total_count
  FROM invoices i
  WHERE i.company_id = p_company_id
    AND i.invoice_direction = p_direction
    AND i.kibocsatas_datuma >= p_date_from
    AND i.kibocsatas_datuma <= p_date_to
    AND (p_issue_date_from IS NULL OR i.kibocsatas_datuma >= p_issue_date_from)
    AND (p_issue_date_to IS NULL OR i.kibocsatas_datuma <= p_issue_date_to)
    AND (p_search IS NULL OR p_search = '' OR (
      i.elado_nev ILIKE '%' || p_search || '%'
      OR i.vevo_nev ILIKE '%' || p_search || '%'
      OR i.bizonylatsorszam ILIKE '%' || p_search || '%'
      OR i.brutto_vegosszeg::text ILIKE '%' || p_search || '%'
      OR i.adoalap_osszesen::text ILIKE '%' || p_search || '%'
    ))
    AND (p_currency IS NULL OR p_currency = 'all' OR i.penznem = p_currency)
    AND (p_category_id IS NULL OR p_category_id = 'all'
      OR (p_category_id = 'none' AND i.category_id IS NULL)
      OR i.category_id = p_category_id::uuid)
    AND (p_project_id IS NULL OR p_project_id = 'all'
      OR (p_project_id = 'none' AND i.project_id IS NULL)
      OR i.project_id = p_project_id::uuid)
    AND (p_payment_method IS NULL OR p_payment_method = 'all'
      OR (p_payment_method = 'none' AND i.fizetesi_mod IS NULL)
      OR i.fizetesi_mod = p_payment_method)
    AND (p_amount_min IS NULL OR COALESCE(i.brutto_vegosszeg, 0) >= p_amount_min)
    AND (p_amount_max IS NULL OR COALESCE(i.brutto_vegosszeg, 0) <= p_amount_max)
  ORDER BY
    CASE WHEN p_sort_dir = 'asc' THEN
      CASE p_sort_field
        WHEN 'kibocsatas_datuma' THEN i.kibocsatas_datuma::text
        WHEN 'invoice_issue_date' THEN i.kibocsatas_datuma::text
        WHEN 'teljesites_datuma' THEN i.teljesites_datuma::text
        WHEN 'invoice_delivery_date' THEN i.teljesites_datuma::text
        WHEN 'bizonylatsorszam' THEN i.bizonylatsorszam
        WHEN 'invoice_number' THEN i.bizonylatsorszam
        WHEN 'elado_nev' THEN i.elado_nev
        WHEN 'partner_name' THEN i.elado_nev
        WHEN 'vevo_nev' THEN i.vevo_nev
        WHEN 'adoalap_osszesen' THEN lpad(COALESCE(i.adoalap_osszesen, 0)::text, 20, '0')
        WHEN 'invoice_net_amount' THEN lpad(COALESCE(i.adoalap_osszesen, 0)::text, 20, '0')
        WHEN 'brutto_vegosszeg' THEN lpad(COALESCE(i.brutto_vegosszeg, 0)::text, 20, '0')
        WHEN 'invoice_gross_amount' THEN lpad(COALESCE(i.brutto_vegosszeg, 0)::text, 20, '0')
        WHEN 'afa_osszeg_osszesen' THEN lpad(COALESCE(i.afa_osszeg_osszesen, 0)::text, 20, '0')
        WHEN 'invoice_vat_amount' THEN lpad(COALESCE(i.afa_osszeg_osszesen, 0)::text, 20, '0')
        ELSE i.kibocsatas_datuma::text
      END
    END ASC NULLS LAST,
    CASE WHEN p_sort_dir = 'desc' OR p_sort_dir IS NULL THEN
      CASE p_sort_field
        WHEN 'kibocsatas_datuma' THEN i.kibocsatas_datuma::text
        WHEN 'invoice_issue_date' THEN i.kibocsatas_datuma::text
        WHEN 'teljesites_datuma' THEN i.teljesites_datuma::text
        WHEN 'invoice_delivery_date' THEN i.teljesites_datuma::text
        WHEN 'bizonylatsorszam' THEN i.bizonylatsorszam
        WHEN 'invoice_number' THEN i.bizonylatsorszam
        WHEN 'elado_nev' THEN i.elado_nev
        WHEN 'partner_name' THEN i.elado_nev
        WHEN 'vevo_nev' THEN i.vevo_nev
        WHEN 'adoalap_osszesen' THEN lpad(COALESCE(i.adoalap_osszesen, 0)::text, 20, '0')
        WHEN 'invoice_net_amount' THEN lpad(COALESCE(i.adoalap_osszesen, 0)::text, 20, '0')
        WHEN 'brutto_vegosszeg' THEN lpad(COALESCE(i.brutto_vegosszeg, 0)::text, 20, '0')
        WHEN 'invoice_gross_amount' THEN lpad(COALESCE(i.brutto_vegosszeg, 0)::text, 20, '0')
        WHEN 'afa_osszeg_osszesen' THEN lpad(COALESCE(i.afa_osszeg_osszesen, 0)::text, 20, '0')
        WHEN 'invoice_vat_amount' THEN lpad(COALESCE(i.afa_osszeg_osszesen, 0)::text, 20, '0')
        ELSE i.kibocsatas_datuma::text
      END
    END DESC NULLS LAST
  LIMIT p_page_size
  OFFSET (p_page - 1) * p_page_size;
END;
$$;

-- ══════════════════════════════════════════════════════════════════
-- Permissions
-- ══════════════════════════════════════════════════════════════════
GRANT EXECUTE ON FUNCTION public.get_filtered_nav_invoices(uuid, date, date, text, text, text, text, text, text, text, text, numeric, numeric, text, text, integer, integer, date, date) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_filtered_submitted_invoices(uuid, date, date, text, text, text, text, text, numeric, numeric, text, text, integer, integer, text, date, date) TO authenticated, service_role;


-- ==================================================
-- MERGED FROM: 20260623_add_api_keys_table.sql
-- ==================================================
-- ============================================================================
-- Migration: API Keys table for external integrations (OpenClaw)
-- Date: 2026-06-23
-- Description: Adds api_keys table with SHA-256 hashed keys for secure
--              external API access. Supports company-scoped and project-wide keys.
-- ============================================================================

-- Ensure pgcrypto is available (for digest function)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- API Keys table
CREATE TABLE IF NOT EXISTS public.api_keys (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,  -- NULL = project-wide access
  created_by uuid,                                -- auth.uid() who created it
  key_hash text NOT NULL,                         -- SHA-256 hash (raw key NEVER stored)
  key_prefix text NOT NULL,                       -- first 11 chars (vb_xxxxxxxx) for display
  name text NOT NULL DEFAULT 'API Key',
  scope text NOT NULL DEFAULT 'read',             -- 'read' | 'read_write' (future)
  is_active boolean NOT NULL DEFAULT true,
  last_used_at timestamptz,
  expires_at timestamptz,                         -- NULL = no expiry
  rate_limit_per_minute integer NOT NULL DEFAULT 100,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Comment
COMMENT ON TABLE public.api_keys IS 'API kulcsok külső integrációkhoz (OpenClaw). A nyers kulcs soha nem tárolódik, csak SHA-256 hash.';

-- RLS
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

-- Policy: owner/admin can manage their company keys
CREATE POLICY "api_keys_company_admin" ON public.api_keys
  FOR ALL USING (
    company_id IN (
      SELECT cm.company_id FROM public.company_members cm
      WHERE cm.user_id = (SELECT auth.uid())
      AND cm.role IN ('owner', 'admin')
    )
    OR
    -- Project-wide keys (company_id IS NULL): only thinkai/management can manage
    (company_id IS NULL AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid())
      AND p.role IN ('thinkai', 'management')
    ))
  );

-- Indexes
CREATE INDEX IF NOT EXISTS idx_api_keys_key_hash ON public.api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_api_keys_company_id ON public.api_keys(company_id);

-- Grants
REVOKE ALL ON public.api_keys FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.api_keys TO authenticated;
GRANT ALL ON public.api_keys TO service_role;

-- ============================================================================
-- RPC: generate_api_key — generates a new API key and returns the raw key ONCE
-- ============================================================================
CREATE OR REPLACE FUNCTION public.generate_api_key(
  p_company_id uuid DEFAULT NULL,
  p_name text DEFAULT 'OpenClaw API Key'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  v_raw_key text;
  v_key_hash text;
  v_key_prefix text;
  v_key_id uuid;
BEGIN
  -- Permission check: owner/admin for company keys, thinkai for project-wide
  IF p_company_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM company_members
      WHERE company_id = p_company_id
      AND user_id = auth.uid()
      AND role IN ('owner', 'admin')
    ) THEN
      RAISE EXCEPTION 'Nincs jogosultság API kulcs generáláshoz ehhez a céghez';
    END IF;
  ELSE
    IF NOT EXISTS (
      SELECT 1 FROM profiles
      WHERE user_id = auth.uid()
      AND role IN ('thinkai', 'management')
    ) THEN
      RAISE EXCEPTION 'Projekt-szintű API kulcs generálásához thinkai jogosultság szükséges';
    END IF;
  END IF;

  -- Generate key: vb_ prefix + 40 hex characters (20 random bytes)
  v_raw_key := 'vb_' || encode(gen_random_bytes(20), 'hex');
  v_key_hash := encode(digest(v_raw_key, 'sha256'), 'hex');
  v_key_prefix := left(v_raw_key, 11);

  -- Insert
  INSERT INTO api_keys (company_id, created_by, key_hash, key_prefix, name)
  VALUES (p_company_id, auth.uid(), v_key_hash, v_key_prefix, p_name)
  RETURNING id INTO v_key_id;

  -- Return the raw key ONCE — it cannot be retrieved again
  RETURN jsonb_build_object(
    'id', v_key_id,
    'api_key', v_raw_key,
    'prefix', v_key_prefix,
    'name', p_name,
    'company_id', p_company_id,
    'warning', 'Ez a kulcs CSAK MOST jelenik meg! Mentsd el biztonságos helyre.'
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.generate_api_key FROM anon, public;
GRANT EXECUTE ON FUNCTION public.generate_api_key TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_api_key TO service_role;

-- ============================================================================
-- RPC: revoke_api_key — deactivates an API key
-- ============================================================================
CREATE OR REPLACE FUNCTION public.revoke_api_key(p_key_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE api_keys
  SET is_active = false, updated_at = now()
  WHERE id = p_key_id
  AND (
    -- Company key: owner/admin
    (company_id IS NOT NULL AND company_id IN (
      SELECT cm.company_id FROM company_members cm
      WHERE cm.user_id = auth.uid() AND cm.role IN ('owner', 'admin')
    ))
    OR
    -- Project-wide key: thinkai
    (company_id IS NULL AND EXISTS (
      SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role IN ('thinkai', 'management')
    ))
  );

  IF NOT FOUND THEN
    RAISE EXCEPTION 'API kulcs nem található vagy nincs jogosultság';
  END IF;

  RETURN jsonb_build_object('success', true, 'message', 'API kulcs visszavonva');
END;
$$;

REVOKE EXECUTE ON FUNCTION public.revoke_api_key FROM anon, public;
GRANT EXECUTE ON FUNCTION public.revoke_api_key TO authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_api_key TO service_role;


-- ==================================================
-- MERGED FROM: 20260623_ai_chat_persistence.sql
-- ==================================================
-- ============================================================================
-- AI Chat Persistence — accounty_ai_chat_sessions + accounty_ai_chat_messages
-- ============================================================================
-- Stores AI assistant conversation history per user.
-- Sessions are auto-titled from the first user message.
-- ============================================================================

-- ── 1. Sessions table ──
CREATE TABLE IF NOT EXISTS public.accounty_ai_chat_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'Új beszélgetés',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── 2. Messages table ──
CREATE TABLE IF NOT EXISTS public.accounty_ai_chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.accounty_ai_chat_sessions(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── 3. RLS ──
ALTER TABLE public.accounty_ai_chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounty_ai_chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own chat sessions"
  ON public.accounty_ai_chat_sessions FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can manage own chat messages"
  ON public.accounty_ai_chat_messages FOR ALL
  USING (session_id IN (
    SELECT id FROM public.accounty_ai_chat_sessions WHERE user_id = auth.uid()
  ))
  WITH CHECK (session_id IN (
    SELECT id FROM public.accounty_ai_chat_sessions WHERE user_id = auth.uid()
  ));

-- ── 4. Indexes ──
CREATE INDEX idx_accounty_ai_sessions_user
  ON public.accounty_ai_chat_sessions(user_id, updated_at DESC);

CREATE INDEX idx_accounty_ai_messages_session
  ON public.accounty_ai_chat_messages(session_id, created_at ASC);

-- ── 5. Auto-update updated_at trigger ──
CREATE OR REPLACE FUNCTION public.accounty_ai_session_touch()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  UPDATE public.accounty_ai_chat_sessions
  SET updated_at = now()
  WHERE id = NEW.session_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_accounty_ai_message_touch
  AFTER INSERT ON public.accounty_ai_chat_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.accounty_ai_session_touch();

COMMENT ON TABLE public.accounty_ai_chat_sessions IS
  'AI Assistant chat sessions per user. Each session is a separate conversation thread.';
COMMENT ON TABLE public.accounty_ai_chat_messages IS
  'Individual messages within an AI chat session. Ordered by created_at.';


-- ==================================================
-- MERGED FROM: 20260623_fix_owner_demotion_and_protect_auth.sql
-- ==================================================
-- ============================================================================
-- PREVENT OWNER DEMOTION & SECURITY HARDENING
-- ============================================================================

-- 1. Trigger function to protect company owner from being demoted or removed,
-- and protect the companies.owner_id from pointing to non-members.
CREATE OR REPLACE FUNCTION public.protect_company_owner_demotion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company_owner_id UUID;
BEGIN
  -- Get the current owner of the company
  SELECT owner_id INTO v_company_owner_id
  FROM public.companies
  WHERE id = COALESCE(NEW.company_id, OLD.company_id);

  -- If the user being modified is the company owner
  IF (TG_OP = 'UPDATE' AND OLD.user_id = v_company_owner_id) THEN
    -- Prevent changing their role to anything other than owner
    IF NEW.role != 'owner' THEN
      RAISE EXCEPTION 'A cég tulajdonosának szerepköre nem módosítható alacsonyabb szintre!';
    END IF;
    -- Prevent changing the user_id of the owner row
    IF NEW.user_id != OLD.user_id THEN
      RAISE EXCEPTION 'A tulajdonosi tagsági bejegyzés felhasználója nem módosítható!';
    END IF;
  ELSIF (TG_OP = 'DELETE' AND OLD.user_id = v_company_owner_id) THEN
    -- Prevent deleting the owner's membership
    RAISE EXCEPTION 'A cég tulajdonosának tagsága nem törölhető!';
  END IF;

  IF (TG_OP = 'DELETE') THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

-- Attach trigger to company_members
DROP TRIGGER IF EXISTS trg_protect_company_owner ON public.company_members;
CREATE TRIGGER trg_protect_company_owner
  BEFORE UPDATE OR DELETE ON public.company_members
  FOR EACH ROW EXECUTE FUNCTION public.protect_company_owner_demotion();

-- 2. Trigger on companies table to ensure owner_id can only be set to a user 
-- who is already a member with 'owner' role in company_members.
CREATE OR REPLACE FUNCTION public.validate_company_owner_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only validate if owner_id changes
  IF (TG_OP = 'UPDATE' AND NEW.owner_id = OLD.owner_id) THEN
    RETURN NEW;
  END IF;

  -- Verify new owner is a member and has 'owner' role
  IF NOT EXISTS (
    SELECT 1 FROM public.company_members
    WHERE company_id = NEW.id
      AND user_id = NEW.owner_id
      AND role = 'owner'
  ) THEN
    RAISE EXCEPTION 'Az új tulajdonosnak a cég tagjának kell lennie "owner" szerepkörrel!';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_company_owner ON public.companies;
CREATE TRIGGER trg_validate_company_owner
  BEFORE UPDATE OF owner_id ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.validate_company_owner_change();


-- ==================================================
-- MERGED FROM: 20260623_missing_counts_rpc.sql
-- ==================================================
-- Drop and recreate to force PostgREST schema cache invalidation
DROP FUNCTION IF EXISTS public.get_missing_counts_by_company(UUID[]);

CREATE OR REPLACE FUNCTION public.get_missing_counts_by_company(p_company_ids UUID[])
RETURNS TABLE(company_id UUID, missing_count BIGINT) AS $$
  SELECT mi.company_id, COUNT(*)
  FROM accounty_missing_items mi
  JOIN companies c ON c.id = mi.company_id
  WHERE mi.company_id = ANY(p_company_ids)
    AND mi.status IN ('open', 'notified')
    AND c.name != 'SANDBOX'
  GROUP BY mi.company_id;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.get_missing_counts_by_company(UUID[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_missing_counts_by_company(UUID[]) TO anon;

-- Force PostgREST to reload its schema cache
SELECT pg_notify('pgrst', 'reload schema');


-- ==================================================
-- MERGED FROM: 20260623_szep_card_transactions.sql
-- ==================================================
-- SZÉP Kártya (Széchenyi Pihenőkártya) elfogadóhelyi tranzakciók
-- Külön tábla a speciális oszlopok (jutalék, alszámla, kártyatulajdonos stb.) miatt

CREATE TABLE IF NOT EXISTS public.szep_card_transactions (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id        uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  upload_id         uuid REFERENCES transaction_uploads(id) ON DELETE SET NULL,

  -- Alap tranzakciós adatok
  transaction_date  date NOT NULL,
  gross_amount      numeric NOT NULL,            -- Összeg (bruttó, amit a vendég fizetett)
  commission_amount numeric NOT NULL DEFAULT 0,  -- Jutalék összeg
  commission_vat    numeric NOT NULL DEFAULT 0,  -- Jutalék ÁFA
  net_amount        numeric NOT NULL,            -- Utalandó összeg (bruttó - jutalék)
  currency          text NOT NULL DEFAULT 'HUF',

  -- SZÉP specifikus
  merchant_name     text,                        -- Elfogadóhely megnevezése
  sub_account       text NOT NULL,               -- Szálláshely / Vendéglátás / Szabadidő
  card_number_masked text,                       -- **** **** **** 4175
  card_holder       text,                        -- Kártyatulajdonos neve
  issuer_bank       text,                        -- Kibocsátó bank (OTP, K&H, MBH)

  -- POS / tranzakció azonosítók
  pos_terminal_id   text,
  approval_code     text,
  transaction_ref   text,
  is_webshop        boolean NOT NULL DEFAULT false,

  -- Utalás adatok
  transfer_reference text,                       -- Utalás bizonylatszám
  transfer_date     date,                        -- Utalás dátum
  bank_account      text,                        -- Számlaszám

  -- Státusz
  status            text NOT NULL DEFAULT 'Sikeres',
  is_reversal       boolean NOT NULL DEFAULT false,

  -- Timestamps
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

-- Trigger for updated_at
CREATE TRIGGER set_szep_updated_at
  BEFORE UPDATE ON public.szep_card_transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Indexes
CREATE INDEX idx_szep_company_date ON public.szep_card_transactions(company_id, transaction_date DESC);
CREATE INDEX idx_szep_sub_account ON public.szep_card_transactions(company_id, sub_account);
CREATE INDEX idx_szep_upload ON public.szep_card_transactions(upload_id);
CREATE INDEX idx_szep_issuer_bank ON public.szep_card_transactions(issuer_bank);

-- RLS
ALTER TABLE public.szep_card_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view szep transactions"
  ON public.szep_card_transactions FOR SELECT
  USING (company_id IN (
    SELECT company_id FROM public.company_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "Members can insert szep transactions"
  ON public.szep_card_transactions FOR INSERT
  WITH CHECK (company_id IN (
    SELECT company_id FROM public.company_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "Members can update szep transactions"
  ON public.szep_card_transactions FOR UPDATE
  USING (company_id IN (
    SELECT company_id FROM public.company_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "Members can delete szep transactions"
  ON public.szep_card_transactions FOR DELETE
  USING (company_id IN (
    SELECT company_id FROM public.company_members WHERE user_id = auth.uid()
  ));

-- Unique constraint: prevent duplicate imports (same date + approval_code + company)
CREATE UNIQUE INDEX idx_szep_unique_transaction
  ON public.szep_card_transactions(company_id, transaction_date, approval_code)
  WHERE approval_code IS NOT NULL;
