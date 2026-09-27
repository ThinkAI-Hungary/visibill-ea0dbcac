-- Migration: 20260927150000_tb_social_security_module.sql
-- Description: TB (Társadalombiztosítás) és 08E bejelentési modul adatmodell bővítése

-- 1. Bővítések az accounty_employments táblában
ALTER TABLE public.accounty_employments
  ADD COLUMN IF NOT EXISTS pension_start_date date,
  ADD COLUMN IF NOT EXISTS termination_reason_code text,
  ADD COLUMN IF NOT EXISTS filing_08e_status text DEFAULT 'bejelentendo',
  ADD COLUMN IF NOT EXISTS filing_08e_receipt_id text,
  ADD COLUMN IF NOT EXISTS filing_08e_date date;

-- Index a 08E státuszra a gyors munkalista szűréshez
CREATE INDEX IF NOT EXISTS idx_accounty_employments_08e_status
  ON public.accounty_employments(company_id, filing_08e_status);

-- 2. Automatikus jogviszonysorszám (job_serial_number) kiosztó trigger
CREATE OR REPLACE FUNCTION public.fn_assign_job_serial_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.job_serial_number IS NULL OR NEW.job_serial_number <= 0 THEN
    SELECT COALESCE(MAX(job_serial_number), 0) + 1
      INTO NEW.job_serial_number
      FROM public.accounty_employments
     WHERE employee_id = NEW.employee_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_assign_job_serial_number ON public.accounty_employments;
CREATE TRIGGER trg_assign_job_serial_number
  BEFORE INSERT ON public.accounty_employments
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_assign_job_serial_number();

-- 3. Bővítések az accounty_payroll_calculations táblában (TB bontás és időszakok)
ALTER TABLE public.accounty_payroll_calculations
  ADD COLUMN IF NOT EXISTS tb_pension numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tb_health_nature numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tb_health_cash numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tb_labor numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS min_base_diff numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS min_base_employer_contribution numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS insured_days integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS suspension_days integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sick_leave_days integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tappenz_days integer DEFAULT 0;

-- 4. Bővítések az accounty_leaves táblában (Biztosítás szünetelése)
ALTER TABLE public.accounty_leaves
  ADD COLUMN IF NOT EXISTS is_suspension boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS suspension_code text;
