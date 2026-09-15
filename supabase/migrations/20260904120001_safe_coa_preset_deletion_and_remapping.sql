-- ============================================================
-- Migration: 20260904120000_safe_coa_preset_deletion_and_remapping.sql
-- Description: Tranzakcionális és biztonságos számlatükör sablon törlés,
--              függőség-ellenőrzés és hivatkozás-átkötés (remapping).
-- ============================================================

-- 0. Immutability trigger felokosítása: kizárólag a set_config('visibill.allow_gl_remap', 'true', true)
--    esetén engedi a gl_account_id cseréjét, miközben az összegek és a könyvelési egyensúly szigorúan zárt marad!
CREATE OR REPLACE FUNCTION public.acc_enforce_line_immutability()
RETURNS TRIGGER AS $$
DECLARE
  v_header_status VARCHAR;
  v_allow_remap TEXT;
BEGIN
  -- Ellenőrizzük, hogy a tranzakció explicit módon engedélyezte-e a számlatükör átkötést
  v_allow_remap := current_setting('visibill.allow_gl_remap', true);
  IF v_allow_remap = 'true' THEN
    -- Szigorú integritási garancia: csak akkor engedélyezett, ha az összeg, tartozik/követel jelleg,
    -- sorszám és fejléc teljesen változatlan (kizárólag a gl_account_id változik azonos főkönyvi számra)!
    IF TG_OP = 'UPDATE' 
       AND NEW.header_id = OLD.header_id 
       AND NEW.sequence_number = OLD.sequence_number 
       AND NEW.dc_type = OLD.dc_type 
       AND NEW.amount = OLD.amount THEN
      RETURN NEW;
    END IF;
  END IF;

  SELECT status INTO v_header_status 
    FROM public.acc_journal_headers 
   WHERE id = COALESCE(NEW.header_id, OLD.header_id);
   
  IF v_header_status IN ('KONYVELT', 'SZTORNOZOTT') THEN
    RAISE EXCEPTION 'Cannot modify or delete lines belonging to a posted/stornoed journal entry.';
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;


-- 1. Függőség-ellenőrző RPC
CREATE OR REPLACE FUNCTION public.check_chart_of_accounts_preset_usage(p_preset_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_preset RECORD;
  v_journal_lines_count INT := 0;
  v_invoices_count INT := 0;
  v_transactions_count INT := 0;
  v_nav_invoices_count INT := 0;
  v_fixed_assets_count INT := 0;
  v_annual_reports_count INT := 0;
  v_accrual_entries_count INT := 0;
  v_total_refs INT := 0;
  v_accounts_count INT := 0;
  v_sample_refs JSONB := '[]'::jsonb;
BEGIN
  -- 1. Sablon lekérése
  SELECT * INTO v_preset FROM public.chart_of_accounts_presets WHERE id = p_preset_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'A számlatükör sablon nem található.' USING ERRCODE = 'P0002';
  END IF;

  -- 2. Multi-tenancy ellenőrzés (ha authenticated felhasználó hívja)
  IF auth.uid() IS NOT NULL AND v_preset.company_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.company_members cm
      WHERE cm.company_id = v_preset.company_id AND cm.user_id = auth.uid()
    ) THEN
      RAISE EXCEPTION 'Nincs jogosultságod a cég sablonjainak vizsgálatához.' USING ERRCODE = '42501';
    END IF;
  END IF;

  -- 3. Számlák száma a sablonban
  SELECT COUNT(*) INTO v_accounts_count
  FROM public.gl_accounts
  WHERE preset_id = p_preset_id;

  -- 4. Hivatkozások számlálása
  SELECT COUNT(*) INTO v_journal_lines_count
  FROM public.acc_journal_lines jl
  JOIN public.gl_accounts ga ON ga.id = jl.gl_account_id
  WHERE ga.preset_id = p_preset_id;

  SELECT COUNT(*) INTO v_invoices_count
  FROM public.invoices inv
  JOIN public.gl_accounts ga ON ga.id = inv.gl_account_id
  WHERE ga.preset_id = p_preset_id;

  SELECT COUNT(*) INTO v_transactions_count
  FROM public.transactions tr
  JOIN public.gl_accounts ga ON ga.id = tr.gl_account_id
  WHERE ga.preset_id = p_preset_id;

  SELECT COUNT(*) INTO v_nav_invoices_count
  FROM public.nav_invoices ni
  JOIN public.gl_accounts ga ON ga.id = ni.gl_account_id
  WHERE ga.preset_id = p_preset_id;

  SELECT COUNT(*) INTO v_fixed_assets_count
  FROM public.fixed_assets fa
  JOIN public.gl_accounts ga ON ga.id = fa.gl_account_id
  WHERE ga.preset_id = p_preset_id;

  SELECT COUNT(*) INTO v_annual_reports_count
  FROM public.annual_reports
  WHERE preset_id = p_preset_id;

  SELECT COUNT(*) INTO v_accrual_entries_count
  FROM public.accrual_entries
  WHERE preset_id = p_preset_id;

  v_total_refs := v_journal_lines_count + v_invoices_count + v_transactions_count + v_nav_invoices_count + v_fixed_assets_count + v_annual_reports_count + v_accrual_entries_count;

  -- Minták gyűjtése a hivatkozott számlákból (max 10 db)
  SELECT COALESCE(jsonb_agg(sub.item), '[]'::jsonb) INTO v_sample_refs
  FROM (
    SELECT DISTINCT jsonb_build_object(
      'gl_number', ga.gl_number,
      'short_name', ga.short_name
    ) AS item
    FROM public.gl_accounts ga
    WHERE ga.preset_id = p_preset_id
      AND (
        EXISTS (SELECT 1 FROM public.acc_journal_lines WHERE gl_account_id = ga.id)
        OR EXISTS (SELECT 1 FROM public.invoices WHERE gl_account_id = ga.id)
        OR EXISTS (SELECT 1 FROM public.transactions WHERE gl_account_id = ga.id)
        OR EXISTS (SELECT 1 FROM public.nav_invoices WHERE gl_account_id = ga.id)
        OR EXISTS (SELECT 1 FROM public.fixed_assets WHERE gl_account_id = ga.id)
      )
    LIMIT 10
  ) sub;

  RETURN jsonb_build_object(
    'preset_id', v_preset.id,
    'preset_name', v_preset.name,
    'is_active', COALESCE(v_preset.is_active, false),
    'company_id', v_preset.company_id,
    'accounts_count', v_accounts_count,
    'journal_lines_count', v_journal_lines_count,
    'invoices_count', v_invoices_count,
    'transactions_count', v_transactions_count,
    'nav_invoices_count', v_nav_invoices_count,
    'fixed_assets_count', v_fixed_assets_count,
    'annual_reports_count', v_annual_reports_count,
    'accrual_entries_count', v_accrual_entries_count,
    'total_references', v_total_refs,
    'can_delete_directly', (v_total_refs = 0 AND NOT COALESCE(v_preset.is_active, false)),
    'sample_used_accounts', v_sample_refs
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.check_chart_of_accounts_preset_usage(UUID) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_chart_of_accounts_preset_usage(UUID) TO authenticated, service_role;


-- 2. Biztonságos sablontörlő és átkötő RPC
CREATE OR REPLACE FUNCTION public.delete_chart_of_accounts_preset(
  p_preset_id UUID,
  p_target_preset_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_source RECORD;
  v_target RECORD;
  v_src_account RECORD;
  v_target_account_id UUID;
  v_missing_accounts TEXT[] := ARRAY[]::TEXT[];
  v_remapped_jl INT := 0;
  v_remapped_inv INT := 0;
  v_remapped_tr INT := 0;
  v_remapped_nav INT := 0;
  v_remapped_fa INT := 0;
  v_remapped_rules INT := 0;
  v_deleted_accounts INT := 0;
  v_total_refs INT := 0;
  v_updated_count INT;
BEGIN
  -- 1. Forrás sablon ellenőrzése
  SELECT * INTO v_source FROM public.chart_of_accounts_presets WHERE id = p_preset_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'A törlendő számlatükör sablon nem található.' USING ERRCODE = 'P0002';
  END IF;

  -- Rendszerszintű vagy beépített sablon nem törölhető
  IF v_source.company_id IS NULL OR v_source.type <> 'custom' THEN
    RAISE EXCEPTION 'Rendszerszintű vagy beépített számlatükör sablon nem törölhető.' USING ERRCODE = '42501';
  END IF;

  -- Multi-tenancy ellenőrzés (ha authenticated felhasználó hívja)
  IF auth.uid() IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.company_members cm
      WHERE cm.company_id = v_source.company_id AND cm.user_id = auth.uid()
    ) THEN
      RAISE EXCEPTION 'Nincs jogosultságod a cég sablonjainak törléséhez.' USING ERRCODE = '42501';
    END IF;
  END IF;

  -- Aktív sablon törlésének tiltása
  IF COALESCE(v_source.is_active, false) THEN
    RAISE EXCEPTION 'Az aktív számlatükör sablon nem törölhető. Kérjük, aktiválj egy másik sablont a törlés előtt!' USING ERRCODE = 'P0001';
  END IF;

  -- 2. Célsablon ellenőrzése (ha meg van adva)
  IF p_target_preset_id IS NOT NULL THEN
    IF p_target_preset_id = p_preset_id THEN
      RAISE EXCEPTION 'A cél számlatükör nem lehet azonos a törlendő számlatükörrel.' USING ERRCODE = 'P0005';
    END IF;

    SELECT * INTO v_target FROM public.chart_of_accounts_presets WHERE id = p_target_preset_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'A kiválasztott cél számlatükör nem található.' USING ERRCODE = 'P0002';
    END IF;

    -- Célsablon cégellenőrzés: azonos céghez kell tartoznia VAGY generic sablonnak kell lennie
    IF v_target.company_id IS NOT NULL AND v_source.company_id IS NOT NULL AND v_target.company_id <> v_source.company_id THEN
      RAISE EXCEPTION 'A cél számlatükör nem tartozik a céghez.' USING ERRCODE = '42501';
    END IF;
  END IF;

  -- 3. Hivatkozások számlálása
  SELECT
    (SELECT COUNT(*) FROM public.acc_journal_lines jl JOIN public.gl_accounts ga ON ga.id = jl.gl_account_id WHERE ga.preset_id = p_preset_id) +
    (SELECT COUNT(*) FROM public.invoices inv JOIN public.gl_accounts ga ON ga.id = inv.gl_account_id WHERE ga.preset_id = p_preset_id) +
    (SELECT COUNT(*) FROM public.transactions tr JOIN public.gl_accounts ga ON ga.id = tr.gl_account_id WHERE ga.preset_id = p_preset_id) +
    (SELECT COUNT(*) FROM public.nav_invoices ni JOIN public.gl_accounts ga ON ga.id = ni.gl_account_id WHERE ga.preset_id = p_preset_id) +
    (SELECT COUNT(*) FROM public.fixed_assets fa JOIN public.gl_accounts ga ON ga.id = fa.gl_account_id WHERE ga.preset_id = p_preset_id) +
    (SELECT COUNT(*) FROM public.annual_reports WHERE preset_id = p_preset_id) +
    (SELECT COUNT(*) FROM public.accrual_entries WHERE preset_id = p_preset_id)
  INTO v_total_refs;

  -- Ha vannak hivatkozások, de nincs megadva célsablon → hiba dobása
  IF v_total_refs > 0 AND p_target_preset_id IS NULL THEN
    RAISE EXCEPTION 'A sablon nem törölhető, mert % db könyvelési tétel / bizonylat hivatkozik rá. Kérjük, válassz ki egy cél számlatükröt a tételek átkötéséhez!', v_total_refs
      USING ERRCODE = 'P0003';
  END IF;

  -- 4. Tételek átkötése a célsablonba (ha szükséges)
  IF v_total_refs > 0 AND p_target_preset_id IS NOT NULL THEN
    -- Lokális munkamenet beállítása a tranzakció idejére, hogy a trigger engedélyezze a gl_account_id cseréjét
    PERFORM set_config('visibill.allow_gl_remap', 'true', true);

    -- Végigmegyünk minden olyan számlán a forrássablonból, amire bármilyen hivatkozás mutat
    FOR v_src_account IN
      SELECT DISTINCT ga.id, ga.gl_number, ga.short_name
      FROM public.gl_accounts ga
      WHERE ga.preset_id = p_preset_id
        AND (
          EXISTS (SELECT 1 FROM public.acc_journal_lines WHERE gl_account_id = ga.id)
          OR EXISTS (SELECT 1 FROM public.invoices WHERE gl_account_id = ga.id)
          OR EXISTS (SELECT 1 FROM public.transactions WHERE gl_account_id = ga.id)
          OR EXISTS (SELECT 1 FROM public.nav_invoices WHERE gl_account_id = ga.id)
          OR EXISTS (SELECT 1 FROM public.fixed_assets WHERE gl_account_id = ga.id)
          OR EXISTS (SELECT 1 FROM public.transaction_rules WHERE target_gl_account_id = ga.id)
        )
    LOOP
      v_target_account_id := NULL;

      -- Megkeressük a megfelelő számlát a célsablonban (elsődlegesen pontos gl_number, másodlagosan pontok nélküli egyezés)
      SELECT tgt.id INTO v_target_account_id
      FROM public.gl_accounts tgt
      WHERE tgt.preset_id = p_target_preset_id
        AND (
          tgt.gl_number = v_src_account.gl_number
          OR REPLACE(REPLACE(tgt.gl_number, '.', ''), ' ', '') = REPLACE(REPLACE(v_src_account.gl_number, '.', ''), ' ', '')
        )
      ORDER BY (tgt.gl_number = v_src_account.gl_number) DESC, length(tgt.gl_number) ASC
      LIMIT 1;

      IF v_target_account_id IS NULL THEN
        v_missing_accounts := array_append(v_missing_accounts, v_src_account.gl_number || ' (' || v_src_account.short_name || ')');
      ELSE
        -- Átkötések végrehajtása
        UPDATE public.acc_journal_lines
        SET gl_account_id = v_target_account_id
        WHERE gl_account_id = v_src_account.id;
        GET DIAGNOSTICS v_updated_count = ROW_COUNT;
        v_remapped_jl := v_remapped_jl + v_updated_count;

        UPDATE public.invoices
        SET gl_account_id = v_target_account_id
        WHERE gl_account_id = v_src_account.id;
        GET DIAGNOSTICS v_updated_count = ROW_COUNT;
        v_remapped_inv := v_remapped_inv + v_updated_count;

        UPDATE public.transactions
        SET gl_account_id = v_target_account_id
        WHERE gl_account_id = v_src_account.id;
        GET DIAGNOSTICS v_updated_count = ROW_COUNT;
        v_remapped_tr := v_remapped_tr + v_updated_count;

        UPDATE public.nav_invoices
        SET gl_account_id = v_target_account_id
        WHERE gl_account_id = v_src_account.id;
        GET DIAGNOSTICS v_updated_count = ROW_COUNT;
        v_remapped_nav := v_remapped_nav + v_updated_count;

        UPDATE public.fixed_assets
        SET gl_account_id = v_target_account_id
        WHERE gl_account_id = v_src_account.id;
        GET DIAGNOSTICS v_updated_count = ROW_COUNT;
        v_remapped_fa := v_remapped_fa + v_updated_count;

        UPDATE public.transaction_rules
        SET target_gl_account_id = v_target_account_id
        WHERE target_gl_account_id = v_src_account.id;
        GET DIAGNOSTICS v_updated_count = ROW_COUNT;
        v_remapped_rules := v_remapped_rules + v_updated_count;
      END IF;
    END LOOP;

    -- Ha voltak olyan számlák, amiket nem találtunk meg a célsablonban → rollback és hiba
    IF array_length(v_missing_accounts, 1) > 0 THEN
      RAISE EXCEPTION 'Nem köthető át minden tétel, mert a következő számlák hiányoznak a célszámlatükörből: %',
        array_to_string(v_missing_accounts, ', ')
        USING ERRCODE = 'P0004';
    END IF;
  END IF;

  -- 5. Kapcsolódó leképezések (bs_mapping, pnl_mapping) törlése
  DELETE FROM public.bs_mapping WHERE preset_id = p_preset_id;
  DELETE FROM public.bs_mapping WHERE gl_account_id IN (SELECT id FROM public.gl_accounts WHERE preset_id = p_preset_id);

  DELETE FROM public.pnl_mapping WHERE preset_id = p_preset_id;
  DELETE FROM public.pnl_mapping WHERE gl_account_id IN (SELECT id FROM public.gl_accounts WHERE preset_id = p_preset_id);

  -- gl_audit_imports átkapcsolása a célsablonra (vagy NULL-ra)
  UPDATE public.gl_audit_imports
  SET preset_id = p_target_preset_id
  WHERE preset_id = p_preset_id;

  -- annual_reports és accrual_entries átkapcsolása a célsablonra
  IF p_target_preset_id IS NOT NULL THEN
    UPDATE public.annual_reports
    SET preset_id = p_target_preset_id
    WHERE preset_id = p_preset_id;

    UPDATE public.accrual_entries
    SET preset_id = p_target_preset_id
    WHERE preset_id = p_preset_id;
  END IF;

  -- 6. Self-referencing parent_id feloldása (kulcsfontosságú, hogy ne sérüljön a gl_accounts_parent_id_fkey)
  UPDATE public.gl_accounts
  SET parent_id = NULL
  WHERE preset_id = p_preset_id AND parent_id IS NOT NULL;

  -- 7. Főkönyvi számlák törlése
  DELETE FROM public.gl_accounts
  WHERE preset_id = p_preset_id;
  GET DIAGNOSTICS v_deleted_accounts = ROW_COUNT;

  -- 8. Végül maga a sablon törlése
  DELETE FROM public.chart_of_accounts_presets
  WHERE id = p_preset_id;

  RETURN jsonb_build_object(
    'success', true,
    'deleted_preset_id', p_preset_id,
    'deleted_preset_name', v_source.name,
    'target_preset_id', p_target_preset_id,
    'remapped_journal_lines', v_remapped_jl,
    'remapped_invoices', v_remapped_inv,
    'remapped_transactions', v_remapped_tr,
    'remapped_nav_invoices', v_remapped_nav,
    'remapped_fixed_assets', v_remapped_fa,
    'remapped_rules', v_remapped_rules,
    'deleted_accounts_count', v_deleted_accounts,
    'message', 'A számlatükör sablon és kapcsolódó számlái sikeresen törlésre kerültek.'
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.delete_chart_of_accounts_preset(UUID, UUID) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_chart_of_accounts_preset(UUID, UUID) TO authenticated, service_role;
