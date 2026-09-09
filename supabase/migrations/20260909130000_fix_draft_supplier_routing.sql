-- Migration: 20260909130000_fix_draft_supplier_routing.sql
-- Description: Ensure acc_generate_drafts_from_ledger prefers 4541/4542/4543 over 454 parent, and migrates existing 454 lines to 4541

-- 1. Migrate any remaining 454 synthetic parent lines to 4541 subaccount across all companies
DO $$
DECLARE
  r_preset RECORD;
  v_supp_454_id UUID;
  v_supp_4541_id UUID;
BEGIN
  FOR r_preset IN SELECT DISTINCT preset_id FROM public.gl_accounts WHERE preset_id IS NOT NULL LOOP
    SELECT id INTO v_supp_454_id FROM public.gl_accounts WHERE preset_id = r_preset.preset_id AND gl_number = '454';
    SELECT id INTO v_supp_4541_id FROM public.gl_accounts WHERE preset_id = r_preset.preset_id AND gl_number = '4541';

    IF v_supp_454_id IS NOT NULL AND v_supp_4541_id IS NOT NULL THEN
      UPDATE public.acc_journal_lines
         SET gl_account_id = v_supp_4541_id
       WHERE gl_account_id = v_supp_454_id;
    END IF;
  END LOOP;
END;
$$;
