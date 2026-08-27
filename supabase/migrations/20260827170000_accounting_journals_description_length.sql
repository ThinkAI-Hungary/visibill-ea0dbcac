-- Migration: Fix Journals Description Length
-- Date: 2026-08-27

-- Change description columns to TEXT to avoid string length overflow exceptions
ALTER TABLE public.acc_journal_headers ALTER COLUMN description TYPE TEXT;
ALTER TABLE public.acc_journal_lines ALTER COLUMN description TYPE TEXT;
