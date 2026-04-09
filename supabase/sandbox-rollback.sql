-- ============================================================================
-- SANDBOX ROLLBACK SCRIPT
-- ============================================================================
-- Futtatás: Supabase Dashboard → SQL Editor
-- Ez a script TÖRLI a teljes SANDBOX környezetet!
-- ============================================================================

DO $$
DECLARE
  v_sandbox_user_id UUID;
  v_sandbox_company_id UUID;
BEGIN

  -- Sandbox user megkeresése
  SELECT id INTO v_sandbox_user_id
  FROM auth.users
  WHERE email = 'sandbox@thinkai.hu';

  IF v_sandbox_user_id IS NULL THEN
    RAISE NOTICE '⚠️ Sandbox user nem található, nincs mit törölni.';
    RETURN;
  END IF;

  -- Sandbox cég megkeresése
  SELECT id INTO v_sandbox_company_id
  FROM public.companies
  WHERE name = 'SANDBOX' AND owner_id = v_sandbox_user_id;

  IF v_sandbox_company_id IS NOT NULL THEN
    -- Törlés fordított FK sorrendben
    DELETE FROM public.nav_invoice_items WHERE nav_invoice_id IN (SELECT id FROM public.nav_invoices WHERE company_id = v_sandbox_company_id);
    RAISE NOTICE '✅ NAV számla tételek törölve';

    DELETE FROM public.nav_invoices WHERE company_id = v_sandbox_company_id;
    RAISE NOTICE '✅ NAV számlák törölve';

    DELETE FROM public.salary WHERE company_id = v_sandbox_company_id;
    RAISE NOTICE '✅ Bérek törölve';

    DELETE FROM public.salary_files WHERE company_id = v_sandbox_company_id;
    RAISE NOTICE '✅ Salary files törölve';

    DELETE FROM public.invoices WHERE company_id = v_sandbox_company_id;
    RAISE NOTICE '✅ Számlák törölve';

    DELETE FROM public.invoice_uploads WHERE company_id = v_sandbox_company_id;
    RAISE NOTICE '✅ Invoice uploads törölve';

    DELETE FROM public.transactions WHERE company_id = v_sandbox_company_id;
    RAISE NOTICE '✅ Tranzakciók törölve';

    DELETE FROM public.transaction_uploads WHERE company_id = v_sandbox_company_id::text;
    RAISE NOTICE '✅ Transaction uploads törölve';

    DELETE FROM public.partners WHERE company_id = v_sandbox_company_id;
    RAISE NOTICE '✅ Partnerek törölve';

    DELETE FROM public.categories WHERE company_id = v_sandbox_company_id;
    RAISE NOTICE '✅ Kategóriák törölve';

    DELETE FROM public.projects WHERE company_id = v_sandbox_company_id;
    RAISE NOTICE '✅ Projektek törölve';

    DELETE FROM public.tax WHERE company_id = v_sandbox_company_id;
    RAISE NOTICE '✅ Adó rekordok törölve';

    DELETE FROM public.hp_settings WHERE company_id = v_sandbox_company_id;
    RAISE NOTICE '✅ HP beállítások törölve';

    DELETE FROM public.audit_logs WHERE company_id = v_sandbox_company_id;
    RAISE NOTICE '✅ Audit logok törölve';

    DELETE FROM public.company_members WHERE company_id = v_sandbox_company_id;
    RAISE NOTICE '✅ Company members törölve';

    DELETE FROM public.companies WHERE id = v_sandbox_company_id;
    RAISE NOTICE '✅ SANDBOX cég törölve';
  ELSE
    RAISE NOTICE '⚠️ SANDBOX cég nem található';
  END IF;

  -- User-szintű adatok törlése
  DELETE FROM public.user_subscriptions WHERE user_id = v_sandbox_user_id;
  DELETE FROM public.settings WHERE user_id = v_sandbox_user_id;
  DELETE FROM public.user_email_preferences WHERE user_id = v_sandbox_user_id;
  DELETE FROM public.profiles WHERE user_id = v_sandbox_user_id;
  RAISE NOTICE '✅ User adatok törölve (subscription, settings, preferences, profile)';

  -- Auth user törlése
  DELETE FROM auth.identities WHERE user_id = v_sandbox_user_id;
  DELETE FROM auth.users WHERE id = v_sandbox_user_id;
  RAISE NOTICE '✅ Auth user törölve';

  RAISE NOTICE '══════════════════════════════════════════';
  RAISE NOTICE '🗑️ SANDBOX ROLLBACK KÉSZ!';
  RAISE NOTICE '══════════════════════════════════════════';

END $$;
