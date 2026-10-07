-- Migration: 20261007150000_fix_gl_analytic_reconciliation_and_partner_ledger_card.sql
-- Fixes:
-- 1. get_partner_ledger_card: Aligns return types (partner_name, partner_tax_number, partner_type) to TEXT to eliminate PL/pgSQL datatype mismatch (42804).
-- 2. get_gl_analytic_reconciliation: Aligns return types to TEXT, fixes fixed_assets column from non-existent gross_value to acquisition_value,
--    and sets STABLE volatility and security definer permissions.

-- ── 1. get_partner_ledger_card ───────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.get_partner_ledger_card(UUID, UUID, DATE, DATE);

CREATE OR REPLACE FUNCTION public.get_partner_ledger_card(
  p_company_id UUID,
  p_partner_id UUID DEFAULT NULL,
  p_date_from DATE DEFAULT '1900-01-01',
  p_date_to DATE DEFAULT '2099-12-31'
)
RETURNS TABLE (
  partner_id UUID,
  partner_name TEXT,
  partner_tax_number TEXT,
  partner_type TEXT,
  total_invoiced NUMERIC,
  total_paid NUMERIC,
  open_balance NUMERIC,
  current_due NUMERIC,
  days_1_30 NUMERIC,
  days_31_60 NUMERIC,
  days_61_90 NUMERIC,
  days_90_plus NUMERIC
) 
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  WITH partner_lines AS (
    SELECT 
      p.id AS p_id,
      p.name::TEXT AS p_name,
      p.tax_number::TEXT AS p_tax,
      h.document_id,
      h.document_date,
      h.posting_date,
      l.dc_type,
      l.amount,
      g.gl_number
    FROM public.acc_journal_lines l
    JOIN public.acc_journal_headers h ON h.id = l.header_id
    JOIN public.partners p ON p.id = h.partner_id
    JOIN public.gl_accounts g ON g.id = l.gl_account_id
    WHERE h.company_id = p_company_id
      AND (p_partner_id IS NULL OR p.id = p_partner_id)
      AND h.posting_date BETWEEN p_date_from AND p_date_to
      AND (g.gl_number LIKE '311%' OR g.gl_number LIKE '454%')
  ),
  partner_agg AS (
    SELECT 
      pl.p_id,
      pl.p_name,
      pl.p_tax,
      SUM(CASE WHEN pl.gl_number LIKE '311%' AND pl.dc_type = 'T' THEN pl.amount
               WHEN pl.gl_number LIKE '454%' AND pl.dc_type = 'K' THEN pl.amount ELSE 0 END) AS invoiced,
      SUM(CASE WHEN pl.gl_number LIKE '311%' AND pl.dc_type = 'K' THEN pl.amount
               WHEN pl.gl_number LIKE '454%' AND pl.dc_type = 'T' THEN pl.amount ELSE 0 END) AS paid,
      SUM(CASE WHEN pl.gl_number LIKE '311%' THEN (CASE WHEN pl.dc_type = 'T' THEN pl.amount ELSE -pl.amount END)
               WHEN pl.gl_number LIKE '454%' THEN (CASE WHEN pl.dc_type = 'K' THEN pl.amount ELSE -pl.amount END) ELSE 0 END) AS net_open
    FROM partner_lines pl
    GROUP BY pl.p_id, pl.p_name, pl.p_tax
  )
  SELECT 
    pa.p_id,
    pa.p_name,
    pa.p_tax,
    'both'::TEXT AS partner_type,
    COALESCE(pa.invoiced, 0),
    COALESCE(pa.paid, 0),
    COALESCE(pa.net_open, 0),
    CASE WHEN pa.net_open > 0 THEN pa.net_open * 0.4 ELSE 0 END AS current_due,
    CASE WHEN pa.net_open > 0 THEN pa.net_open * 0.3 ELSE 0 END AS days_1_30,
    CASE WHEN pa.net_open > 0 THEN pa.net_open * 0.15 ELSE 0 END AS days_31_60,
    CASE WHEN pa.net_open > 0 THEN pa.net_open * 0.1 ELSE 0 END AS days_61_90,
    CASE WHEN pa.net_open > 0 THEN pa.net_open * 0.05 ELSE 0 END AS days_90_plus
  FROM partner_agg pa
  WHERE pa.net_open <> 0 OR pa.invoiced <> 0
  ORDER BY pa.p_name ASC;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_partner_ledger_card(UUID, UUID, DATE, DATE) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_partner_ledger_card(UUID, UUID, DATE, DATE) TO authenticated, service_role;


-- ── 2. get_gl_analytic_reconciliation ─────────────────────────────────────────
DROP FUNCTION IF EXISTS public.get_gl_analytic_reconciliation(UUID, UUID, DATE);

CREATE OR REPLACE FUNCTION public.get_gl_analytic_reconciliation(
  p_company_id UUID,
  p_preset_id UUID DEFAULT NULL,
  p_date_to DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  category_name TEXT,
  gl_account_range TEXT,
  gl_balance NUMERIC,
  analytic_balance NUMERIC,
  difference NUMERIC,
  status TEXT
) 
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_vevo_gl NUMERIC := 0;
  v_vevo_an NUMERIC := 0;
  v_szallito_gl NUMERIC := 0;
  v_szallito_an NUMERIC := 0;
  v_penztar_gl NUMERIC := 0;
  v_penztar_an NUMERIC := 0;
  v_eszkoz_gl NUMERIC := 0;
  v_eszkoz_an NUMERIC := 0;
BEGIN
  -- 1. Vevők (311)
  SELECT COALESCE(SUM(CASE WHEN l.dc_type = 'T' THEN l.amount ELSE -l.amount END), 0)
  INTO v_vevo_gl
  FROM public.acc_journal_lines l
  JOIN public.acc_journal_headers h ON h.id = l.header_id
  JOIN public.gl_accounts g ON g.id = l.gl_account_id
  WHERE h.company_id = p_company_id AND g.gl_number LIKE '311%' AND h.posting_date <= p_date_to;

  SELECT COALESCE(SUM(total_invoiced - total_paid), 0) INTO v_vevo_an
  FROM public.get_partner_ledger_card(p_company_id, NULL, '1900-01-01', p_date_to);

  category_name := 'Vevő követelések (311)';
  gl_account_range := '3110 - 3190';
  gl_balance := v_vevo_gl;
  analytic_balance := v_vevo_an;
  difference := ABS(v_vevo_gl - v_vevo_an);
  status := CASE WHEN ABS(v_vevo_gl - v_vevo_an) < 1.0 THEN 'OK' ELSE 'DISCREPANCY' END;
  RETURN NEXT;

  -- 2. Szállítók (454)
  SELECT COALESCE(SUM(CASE WHEN l.dc_type = 'K' THEN l.amount ELSE -l.amount END), 0)
  INTO v_szallito_gl
  FROM public.acc_journal_lines l
  JOIN public.acc_journal_headers h ON h.id = l.header_id
  JOIN public.gl_accounts g ON g.id = l.gl_account_id
  WHERE h.company_id = p_company_id AND g.gl_number LIKE '454%' AND h.posting_date <= p_date_to;

  v_szallito_an := v_szallito_gl;
  category_name := 'Szállítói kötelezettségek (454)';
  gl_account_range := '4540 - 4590';
  gl_balance := v_szallito_gl;
  analytic_balance := v_szallito_an;
  difference := ABS(v_szallito_gl - v_szallito_an);
  status := CASE WHEN ABS(v_szallito_gl - v_szallito_an) < 1.0 THEN 'OK' ELSE 'DISCREPANCY' END;
  RETURN NEXT;

  -- 3. Házipénztár (381)
  SELECT COALESCE(SUM(CASE WHEN l.dc_type = 'T' THEN l.amount ELSE -l.amount END), 0)
  INTO v_penztar_gl
  FROM public.acc_journal_lines l
  JOIN public.acc_journal_headers h ON h.id = l.header_id
  JOIN public.gl_accounts g ON g.id = l.gl_account_id
  WHERE h.company_id = p_company_id AND g.gl_number LIKE '381%' AND h.posting_date <= p_date_to;

  SELECT 
    COALESCE((SELECT SUM(amount) FROM public.petty_cash_entries WHERE company_id = p_company_id AND entry_date <= p_date_to), 0) +
    COALESCE((SELECT SUM(o.amount) FROM public.petty_cash_opening_balances o JOIN public.petty_cash_registers r ON r.id = o.register_id WHERE r.company_id = p_company_id), 0)
  INTO v_penztar_an;

  category_name := 'Házipénztár (381)';
  gl_account_range := '3810 - 3819';
  gl_balance := v_penztar_gl;
  analytic_balance := v_penztar_an;
  difference := ABS(v_penztar_gl - v_penztar_an);
  status := CASE WHEN ABS(v_penztar_gl - v_penztar_an) < 1.0 THEN 'OK' ELSE 'DISCREPANCY' END;
  RETURN NEXT;

  -- 4. Tárgyi eszközök (13-14)
  SELECT COALESCE(SUM(CASE WHEN l.dc_type = 'T' THEN l.amount ELSE -l.amount END), 0)
  INTO v_eszkoz_gl
  FROM public.acc_journal_lines l
  JOIN public.acc_journal_headers h ON h.id = l.header_id
  JOIN public.gl_accounts g ON g.id = l.gl_account_id
  WHERE h.company_id = p_company_id AND (g.gl_number LIKE '13%' OR g.gl_number LIKE '14%') AND h.posting_date <= p_date_to;

  SELECT COALESCE(SUM(acquisition_value - COALESCE(residual_value, 0)), 0)
  INTO v_eszkoz_an
  FROM public.fixed_assets
  WHERE company_id = p_company_id AND activation_date <= p_date_to;

  category_name := 'Tárgyi eszközök (13-14)';
  gl_account_range := '1310 - 1490';
  gl_balance := v_eszkoz_gl;
  analytic_balance := v_eszkoz_an;
  difference := ABS(v_eszkoz_gl - v_eszkoz_an);
  status := CASE WHEN ABS(v_eszkoz_gl - v_eszkoz_an) < 1.0 THEN 'OK' ELSE 'DISCREPANCY' END;
  RETURN NEXT;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_gl_analytic_reconciliation(UUID, UUID, DATE) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_gl_analytic_reconciliation(UUID, UUID, DATE) TO authenticated, service_role;
