-- Migration: 20260916000000_add_skonto_support.sql
-- Purpose: Add dual payment terms (Skontó) support across partners, invoices, nav_invoices, and payment_transfers.

-- 1. Extend partners table with default skonto rules
ALTER TABLE public.partners 
ADD COLUMN IF NOT EXISTS has_skonto boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS skonto_days integer,
ADD COLUMN IF NOT EXISTS skonto_percent numeric(5,2),
ADD COLUMN IF NOT EXISTS skonto_excludes_shipping boolean DEFAULT true;

-- 2. Extend invoices (uploaded/manual inbound & outbound)
ALTER TABLE public.invoices
ADD COLUMN IF NOT EXISTS has_skonto boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS skonto_days integer,
ADD COLUMN IF NOT EXISTS skonto_percent numeric(5,2),
ADD COLUMN IF NOT EXISTS skonto_due_date date,
ADD COLUMN IF NOT EXISTS skonto_amount numeric(15,2),
ADD COLUMN IF NOT EXISTS skonto_shipping_amount numeric(15,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS skonto_selected boolean DEFAULT false;

-- 3. Extend nav_invoices (NAV Online Számla inbound & outbound)
ALTER TABLE public.nav_invoices
ADD COLUMN IF NOT EXISTS has_skonto boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS skonto_days integer,
ADD COLUMN IF NOT EXISTS skonto_percent numeric(5,2),
ADD COLUMN IF NOT EXISTS skonto_due_date date,
ADD COLUMN IF NOT EXISTS skonto_amount numeric(15,2),
ADD COLUMN IF NOT EXISTS skonto_shipping_amount numeric(15,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS skonto_selected boolean DEFAULT false;

-- 4. Extend payment_transfers to track skonto execution in transfer history
ALTER TABLE public.payment_transfers
ADD COLUMN IF NOT EXISTS is_skonto boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS original_gross_amount numeric(15,2),
ADD COLUMN IF NOT EXISTS skonto_saved_amount numeric(15,2) DEFAULT 0;

-- 5. Indexes for fast lookup of skonto-enabled records
CREATE INDEX IF NOT EXISTS idx_partners_company_skonto ON public.partners(company_id) WHERE has_skonto = true;
CREATE INDEX IF NOT EXISTS idx_invoices_company_skonto ON public.invoices(company_id) WHERE has_skonto = true;
CREATE INDEX IF NOT EXISTS idx_nav_invoices_company_skonto ON public.nav_invoices(company_id) WHERE has_skonto = true;
