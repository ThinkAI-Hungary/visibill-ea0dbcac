-- ============================================================
-- V8: ÁFA kód audit log — target_rows változás naplózása
-- ============================================================

-- 1. Audit log tábla
CREATE TABLE IF NOT EXISTS public.vat_code_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vat_code_id UUID NOT NULL REFERENCES public.vat_codes(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  changed_by UUID REFERENCES auth.users(id),
  vat_code_code TEXT NOT NULL,
  old_target_rows JSONB,
  new_target_rows JSONB,
  old_label TEXT,
  new_label TEXT,
  change_type TEXT NOT NULL DEFAULT 'update', -- 'update', 'create', 'delete'
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast company lookups
CREATE INDEX IF NOT EXISTS idx_vat_code_audit_company
  ON public.vat_code_audit_log(company_id, changed_at DESC);

-- 2. Trigger function
CREATE OR REPLACE FUNCTION log_vat_code_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Only log if target_rows or label actually changed
  IF TG_OP = 'UPDATE' AND (
    OLD.target_rows IS DISTINCT FROM NEW.target_rows
    OR OLD.label IS DISTINCT FROM NEW.label
  ) THEN
    INSERT INTO public.vat_code_audit_log (
      vat_code_id, company_id, changed_by, vat_code_code,
      old_target_rows, new_target_rows,
      old_label, new_label,
      change_type
    ) VALUES (
      NEW.id, NEW.company_id, auth.uid(), NEW.code,
      OLD.target_rows, NEW.target_rows,
      OLD.label, NEW.label,
      'update'
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Attach trigger
DROP TRIGGER IF EXISTS trg_vat_code_audit ON public.vat_codes;
CREATE TRIGGER trg_vat_code_audit
  AFTER UPDATE ON public.vat_codes
  FOR EACH ROW
  EXECUTE FUNCTION log_vat_code_change();

-- 4. RLS policies
ALTER TABLE public.vat_code_audit_log ENABLE ROW LEVEL SECURITY;

-- Company members can read audit log
CREATE POLICY "Company members can view vat code audit log"
  ON public.vat_code_audit_log
  FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM public.company_memberships
      WHERE user_id = auth.uid()
    )
  );

-- Trigger inserts bypass RLS (SECURITY DEFINER function)
-- No INSERT/UPDATE/DELETE policies needed for users

COMMENT ON TABLE public.vat_code_audit_log IS 'Audit log for VAT code target_rows and label changes';
