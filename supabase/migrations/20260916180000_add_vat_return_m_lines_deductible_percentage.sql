-- Migration: 20260916180000_add_vat_return_m_lines_deductible_percentage.sql
-- Purpose: Add missing deductible_percentage column to vat_return_m_lines table

ALTER TABLE public.vat_return_m_lines 
  ADD COLUMN IF NOT EXISTS deductible_percentage NUMERIC DEFAULT 100.00;
