-- Migration: add_performance_indexes_nav_invoices_and_items
-- Created: 2026-09-29 23:00:00
-- Purpose: Remediate statement timeouts and optimize VAT calculation queries on nav_invoices and nav_invoice_items

-- 1. Index on nav_invoices for delivery date filtering (used heavily by VAT returns, 2665 replica, and VAT drilldown)
CREATE INDEX IF NOT EXISTS idx_nav_invoices_company_dir_deliv_date
  ON public.nav_invoices (company_id, invoice_direction, invoice_delivery_date DESC);

-- 2. Covering index on nav_invoice_items for fast VAT calculations (enables Index-Only Scans)
CREATE INDEX IF NOT EXISTS idx_nav_invoice_items_nav_inv_vat_covering
  ON public.nav_invoice_items (nav_invoice_id)
  INCLUDE (vat_rate, net_amount, vat_amount);

-- 3. Composite index on nav_invoice_items for company-level queries and RLS filtering
CREATE INDEX IF NOT EXISTS idx_nav_invoice_items_comp_inv
  ON public.nav_invoice_items (company_id, nav_invoice_id);
