-- =============================================================================
-- Migration: 20260824_optimize_query_rpcs.sql
-- Description: High-performance RPC functions and foreign key covering indexes
--              to eliminate full-table scans, N+1 loops, and JS-side aggregations.
-- =============================================================================

-- 1. Missing Foreign Key Covering Indexes
CREATE INDEX IF NOT EXISTS idx_company_bank_accounts_company_id ON public.company_bank_accounts(company_id);
CREATE INDEX IF NOT EXISTS idx_payment_transfers_company_id ON public.payment_transfers(company_id);
CREATE INDEX IF NOT EXISTS idx_payment_transfers_matched_tx ON public.payment_transfers(matched_transaction_id) WHERE matched_transaction_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_payment_transfers_bank_acc ON public.payment_transfers(bank_account_id) WHERE bank_account_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_petty_cash_entries_partner_id ON public.petty_cash_entries(partner_id) WHERE partner_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_transaction_rules_company_id ON public.transaction_rules(company_id);
CREATE INDEX IF NOT EXISTS idx_gl_audit_accounts_company_id ON public.gl_audit_accounts(company_id);
CREATE INDEX IF NOT EXISTS idx_gl_audit_partners_company_id ON public.gl_audit_partners(company_id);
CREATE INDEX IF NOT EXISTS idx_accounty_documents_company_id ON public.accounty_documents(company_id);
CREATE INDEX IF NOT EXISTS idx_accounty_employee_jobs_company_id ON public.accounty_employee_jobs(company_id);
CREATE INDEX IF NOT EXISTS idx_accounty_departments_company_id ON public.accounty_departments(company_id);
CREATE INDEX IF NOT EXISTS idx_accounty_sites_company_id ON public.accounty_sites(company_id);
CREATE INDEX IF NOT EXISTS idx_accounty_transfers_company_id ON public.accounty_transfers(company_id);
CREATE INDEX IF NOT EXISTS idx_accounty_year_end_tasks_company_id ON public.accounty_year_end_tasks(company_id);

-- 2. Fast Missing Item Counts (replaces 15,000-row JS iteration)
DROP FUNCTION IF EXISTS public.get_accounty_missing_item_counts(uuid[], date, date);

CREATE OR REPLACE FUNCTION public.get_accounty_missing_item_counts(
  p_company_ids uuid[],
  p_date_from date DEFAULT NULL,
  p_date_to date DEFAULT NULL
)
RETURNS TABLE(
  company_id uuid, 
  count bigint, 
  critical_count bigint,
  last_notified_at timestamp with time zone,
  max_notification_count int,
  total_notified bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    ami.company_id,
    count(*)::bigint AS count,
    count(*) FILTER (WHERE ami.priority = 'urgent')::bigint AS critical_count,
    max(ami.last_notified_at) AS last_notified_at,
    COALESCE(max(ami.notification_count), 0)::int AS max_notification_count,
    count(*) FILTER (WHERE ami.status = 'notified')::bigint AS total_notified
  FROM public.accounty_missing_items ami
  WHERE ami.company_id = ANY(p_company_ids)
    AND ami.status IN ('open', 'notified')
    AND (p_date_from IS NULL OR ami.item_date >= p_date_from)
    AND (p_date_to IS NULL OR ami.item_date <= p_date_to)
  GROUP BY ami.company_id;
$$;

-- 3. KATA 3M Partner Totals (replaces unconstrained full-table scan on nav_invoices)
CREATE OR REPLACE FUNCTION public.get_portfolio_kata_partner_totals(
  p_company_ids uuid[],
  p_year int
)
RETURNS TABLE(company_id uuid, customer_name text, total numeric)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    ni.company_id,
    COALESCE(ni.customer_name, 'Ismeretlen partner') AS customer_name,
    COALESCE(SUM(ni.invoice_gross_amount), 0)::numeric AS total
  FROM public.nav_invoices ni
  WHERE ni.company_id = ANY(p_company_ids)
    AND ni.invoice_direction = 'OUTBOUND'
    AND EXTRACT(year FROM ni.invoice_issue_date) = p_year
  GROUP BY ni.company_id, ni.customer_name;
$$;

-- 4. EV YTD Totals by Company (replaces full-table client-side summing)
CREATE OR REPLACE FUNCTION public.get_ev_ytd_totals(
  p_company_ids uuid[],
  p_tax_year int
)
RETURNS TABLE(company_id uuid, revenue numeric, expense numeric)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    i.company_id,
    COALESCE(SUM(CASE WHEN UPPER(i.invoice_direction) = 'OUTBOUND' THEN i.brutto_vegosszeg ELSE 0 END), 0)::numeric AS revenue,
    COALESCE(SUM(CASE WHEN UPPER(i.invoice_direction) = 'INBOUND' THEN i.brutto_vegosszeg ELSE 0 END), 0)::numeric AS expense
  FROM public.invoices i
  WHERE i.company_id = ANY(p_company_ids)
    AND (
      (i.teljesites_datuma >= (p_tax_year || '-01-01')::date AND i.teljesites_datuma <= (p_tax_year || '-12-31')::date)
      OR (i.teljesites_datuma IS NULL AND i.kibocsatas_datuma >= (p_tax_year || '-01-01')::date AND i.kibocsatas_datuma <= (p_tax_year || '-12-31')::date)
    )
    AND (i.exclude_from_accounting IS NULL OR i.exclude_from_accounting = false)
  GROUP BY i.company_id;
$$;
