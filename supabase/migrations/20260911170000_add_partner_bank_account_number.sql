-- Migration: 20260911170000_add_partner_bank_account_number.sql
-- Description: Add bank_account_number column to partners table to persist supplier/customer bank accounts

ALTER TABLE public.partners
  ADD COLUMN IF NOT EXISTS bank_account_number TEXT;

COMMENT ON COLUMN public.partners.bank_account_number IS 'Partner hivatalos belföldi (16/24 jegyű GIRO) vagy nemzetközi IBAN bankszámlaszáma';
