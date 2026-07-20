-- =========================================================================
-- Migration: Add dry_run flag and general ledger reconciliation/mapping RPCs
-- =========================================================================

-- 1. Add dry_run column to gl_audit_imports
ALTER TABLE public.gl_audit_imports ADD COLUMN IF NOT EXISTS dry_run BOOLEAN DEFAULT false;

-- 2. get_reconciliation_status RPC
CREATE OR REPLACE FUNCTION public.get_reconciliation_status(
    p_company_id UUID,
    p_preset_id UUID,
    p_date_to DATE
)
RETURNS TABLE (
    account_type TEXT,
    account_name TEXT,
    currency TEXT,
    system_balance NUMERIC,
    ledger_balance NUMERIC,
    difference NUMERIC
)
LANGUAGE plpgsql STABLE
AS $$
DECLARE
    v_import_id UUID;
BEGIN
    -- Find the active completed import
    SELECT id INTO v_import_id 
    FROM public.gl_audit_imports
    WHERE company_id = p_company_id 
      AND preset_id = p_preset_id 
      AND processing_status = 'completed' 
      AND NOT dry_run
    ORDER BY imported_at DESC 
    LIMIT 1;

    IF v_import_id IS NULL THEN
        -- No active import, return empty or zero comparison
        RETURN;
    END IF;

    -- Return cash registers compared to 381 accounts
    RETURN QUERY
    WITH cash_system AS (
        SELECT 
            r.currencies[1] as cur,
            COALESCE(SUM(ob.amount), 0) + COALESCE(SUM(e_sum.total_amount), 0) AS sys_bal
        FROM public.petty_cash_registers r
        LEFT JOIN public.petty_cash_opening_balances ob ON ob.register_id = r.id
        LEFT JOIN LATERAL (
            SELECT SUM(e.amount) AS total_amount
            FROM public.petty_cash_entries e
            WHERE e.register_id = r.id 
              AND e.currency = COALESCE(ob.currency, 'HUF')
              AND e.entry_date <= p_date_to
        ) e_sum ON true
        WHERE r.company_id = p_company_id
        GROUP BY r.currencies[1]
    ),
    cash_ledger AS (
        SELECT 
            COALESCE(SUM(b.balance), 0) AS led_bal
        FROM public.get_audit_gl_balances(v_import_id, NULL, p_date_to) b
        WHERE b.account_code LIKE '381%'
    )
    SELECT 
        'cash'::TEXT AS account_type,
        'Házipénztár (HUF)'::TEXT AS account_name,
        'HUF'::TEXT AS currency,
        COALESCE((SELECT sys_bal FROM cash_system WHERE cur = 'HUF'), 0)::NUMERIC AS system_balance,
        COALESCE((SELECT led_bal FROM cash_ledger), 0)::NUMERIC AS ledger_balance,
        (COALESCE((SELECT sys_bal FROM cash_system WHERE cur = 'HUF'), 0) - COALESCE((SELECT led_bal FROM cash_ledger), 0))::NUMERIC AS difference;

    -- Return bank accounts compared to 384 accounts
    RETURN QUERY
    WITH bank_system AS (
        SELECT 
            bs.currency as cur,
            COALESCE(SUM(bs.opening_balance), 0) + COALESCE(SUM(bt.amount), 0) AS sys_bal
        FROM public.bank_statements bs
        LEFT JOIN public.bank_transactions bt ON bt.bank_statement_id = bs.id AND bt.transaction_date <= p_date_to
        WHERE bs.company_id = p_company_id
        GROUP BY bs.currency
    ),
    bank_ledger AS (
        SELECT 
            COALESCE(SUM(b.balance), 0) AS led_bal
        FROM public.get_audit_gl_balances(v_import_id, NULL, p_date_to) b
        WHERE b.account_code LIKE '384%'
    )
    SELECT 
        'bank'::TEXT AS account_type,
        'Bankszámla (HUF)'::TEXT AS account_name,
        'HUF'::TEXT AS currency,
        COALESCE((SELECT sys_bal FROM bank_system WHERE cur = 'HUF'), 0)::NUMERIC AS system_balance,
        COALESCE((SELECT led_bal FROM bank_ledger), 0)::NUMERIC AS ledger_balance,
        (COALESCE((SELECT sys_bal FROM bank_system WHERE cur = 'HUF'), 0) - COALESCE((SELECT led_bal FROM bank_ledger), 0))::NUMERIC AS difference;
END;
$$;

-- 3. suggest_gl_mappings RPC
CREATE OR REPLACE FUNCTION public.suggest_gl_mappings(
    p_company_id UUID,
    p_preset_id UUID
)
RETURNS TABLE (
    gl_account_id UUID,
    gl_number TEXT,
    short_name TEXT,
    pnl_structure_id UUID,
    pnl_row_code TEXT,
    pnl_row_name TEXT,
    bs_structure_id UUID,
    bs_row_code TEXT,
    bs_row_name TEXT,
    reasoning TEXT
)
LANGUAGE plpgsql STABLE
AS $$
BEGIN
    RETURN QUERY
    WITH pnl_rules (prefix, pnl_id, label) AS (
        VALUES
            ('51', '00000000-0000-0000-0000-000000000400'::UUID, 'IV. Anyagjellegű ráfordítások'),
            ('52', '00000000-0000-0000-0000-000000000400'::UUID, 'IV. Anyagjellegű ráfordítások'),
            ('53', '00000000-0000-0000-0000-000000000400'::UUID, 'IV. Anyagjellegű ráfordítások'),
            ('54', '00000000-0000-0000-0000-000000000500'::UUID, 'V. Személyi jellegű ráfordítások'),
            ('55', '00000000-0000-0000-0000-000000000500'::UUID, 'V. Személyi jellegű ráfordítások'),
            ('56', '00000000-0000-0000-0000-000000000500'::UUID, 'V. Személyi jellegű ráfordítások'),
            ('57', '00000000-0000-0000-0000-000000000600'::UUID, 'VI. Értékcsökkenési leírás'),
            ('58', '00000000-0000-0000-0000-000000000200'::UUID, 'II. Aktivált saját teljesítmények értéke'),
            ('81', '00000000-0000-0000-0000-000000000400'::UUID, 'IV. Anyagjellegű ráfordítások'),
            ('82', '00000000-0000-0000-0000-000000000500'::UUID, 'V. Személyi jellegű ráfordítások'),
            ('83', '00000000-0000-0000-0000-000000000600'::UUID, 'VI. Értékcsökkenési leírás'),
            ('84', '00000000-0000-0000-0000-000000000700'::UUID, 'VII. Egyéb ráfordítások'),
            ('85', '00000000-0000-0000-0000-000000000700'::UUID, 'VII. Egyéb ráfordítások'),
            ('86', '00000000-0000-0000-0000-000000000700'::UUID, 'VII. Egyéb ráfordítások'),
            ('87', '00000000-0000-0000-0000-000000001000'::UUID, 'IX. Pénzügyi műveletek ráfordításai'),
            ('88', '00000000-0000-0000-0000-000000000700'::UUID, 'VII. Egyéb ráfordítások'),
            ('89', '00000000-0000-0000-0000-000000001300'::UUID, 'X. Adófizetési kötelezettség'),
            ('91', '00000000-0000-0000-0000-000000000100'::UUID, 'I. Értékesítés nettó árbevétele'),
            ('92', '00000000-0000-0000-0000-000000000100'::UUID, 'I. Értékesítés nettó árbevétele'),
            ('93', '00000000-0000-0000-0000-000000000100'::UUID, 'I. Értékesítés nettó árbevétele'),
            ('94', '00000000-0000-0000-0000-000000000100'::UUID, 'I. Értékesítés nettó árbevétele'),
            ('95', '00000000-0000-0000-0000-000000000100'::UUID, 'I. Értékesítés nettó árbevétele'),
            ('96', '00000000-0000-0000-0000-000000000300'::UUID, 'III. Egyéb bevételek'),
            ('97', '00000000-0000-0000-0000-000000000900'::UUID, 'VIII. Pénzügyi műveletek bevételei'),
            ('98', '00000000-0000-0000-0000-000000000300'::UUID, 'III. Egyéb bevételek')
    ),
    bs_rules (prefix, bs_id, label) AS (
        VALUES
            ('111', '00000000-0000-0000-0001-000000000111'::UUID, 'A/I/1. Alapítás-átszervezés aktivált értéke'),
            ('112', '00000000-0000-0000-0001-000000000112'::UUID, 'A/I/2. Kísérleti fejlesztés aktivált értéke'),
            ('113', '00000000-0000-0000-0001-000000000113'::UUID, 'A/I/3. Vagyoni értékű jogok'),
            ('114', '00000000-0000-0000-0001-000000000114'::UUID, 'A/I/4. Szellemi termékek'),
            ('115', '00000000-0000-0000-0001-000000000115'::UUID, 'A/I/5. Üzleti vagy cégérték'),
            ('116', '00000000-0000-0000-0001-000000000116'::UUID, 'A/I/6. Immateriális javakra adott előlegek'),
            ('117', '00000000-0000-0000-0001-000000000117'::UUID, 'A/I/7. Immateriális javak értékhelyesbítése'),
            ('118', '00000000-0000-0000-0001-000000000111'::UUID, 'A/I/1. Alapítás-átszervezés (terv felüli ÉCS)'),
            ('119', '00000000-0000-0000-0001-000000000111'::UUID, 'A/I/1. Alapítás-átszervezés (értékvesztés)'),
            ('121', '00000000-0000-0000-0001-000000000121'::UUID, 'A/II/1. Ingatlanok és a kapcsolódó vagyoni értékű jogok'),
            ('122', '00000000-0000-0000-0001-000000000121'::UUID, 'A/II/1. Ingatlanok és a kapcsolódó vagyoni értékű jogok'),
            ('123', '00000000-0000-0000-0001-000000000121'::UUID, 'A/II/1. Ingatlanok és a kapcsolódó vagyoni értékű jogok'),
            ('124', '00000000-0000-0000-0001-000000000122'::UUID, 'A/II/2. Műszaki berendezések, gépek, járművek'),
            ('125', '00000000-0000-0000-0001-000000000123'::UUID, 'A/II/3. Egyéb berendezések, felszerelések, járművek'),
            ('126', '00000000-0000-0000-0001-000000000124'::UUID, 'A/II/4. Tenyészállatok'),
            ('127', '00000000-0000-0000-0001-000000000125'::UUID, 'A/II/5. Beruházások, felújítások'),
            ('128', '00000000-0000-0000-0001-000000000126'::UUID, 'A/II/6. Beruházásokra adott előlegek'),
            ('129', '00000000-0000-0000-0001-000000000127'::UUID, 'A/II/7. Tárgyi eszközök értékhelyesbítése'),
            ('13', '00000000-0000-0000-0001-000000000121'::UUID, 'A/II/1. Ingatlanok (ÉCS)'),
            ('14', '00000000-0000-0000-0001-000000000122'::UUID, 'A/II/2. Műszaki (ÉCS)'),
            ('15', '00000000-0000-0000-0001-000000000123'::UUID, 'A/II/3. Egyéb (ÉCS)'),
            ('16', '00000000-0000-0000-0001-000000000125'::UUID, 'A/II/5. Beruházások (ÉCS)'),
            ('17', '00000000-0000-0000-0001-000000000131'::UUID, 'A/III/1. Tartós részesedés kapcsolt vállalkozásban'),
            ('18', '00000000-0000-0000-0001-000000000135'::UUID, 'A/III/5. Egyéb tartósan adott kölcsön'),
            ('19', '00000000-0000-0000-0001-000000000136'::UUID, 'A/III/6. Tartós hitelviszonyt megtestesítő értékpapír'),
            ('21', '00000000-0000-0000-0001-000000000211'::UUID, 'B/I/1. Anyagok'),
            ('22', '00000000-0000-0000-0001-000000000211'::UUID, 'B/I/1. Anyagok'),
            ('23', '00000000-0000-0000-0001-000000000212'::UUID, 'B/I/2. Befejezetlen termelés és félkész termékek'),
            ('24', '00000000-0000-0000-0001-000000000213'::UUID, 'B/I/3. Növendék-, hízó- és egyéb állatok'),
            ('25', '00000000-0000-0000-0001-000000000214'::UUID, 'B/I/4. Késztermékek'),
            ('26', '00000000-0000-0000-0001-000000000215'::UUID, 'B/I/5. Áruk'),
            ('27', '00000000-0000-0000-0001-000000000215'::UUID, 'B/I/5. Áruk (közvetített szolgáltatások)'),
            ('28', '00000000-0000-0000-0001-000000000216'::UUID, 'B/I/6. Készletekre adott előlegek'),
            ('29', '00000000-0000-0000-0001-000000000211'::UUID, 'B/I/1. Anyagok (értékvesztés)'),
            ('311', '00000000-0000-0000-0001-000000000221'::UUID, 'B/II/1. Vevők'),
            ('312', '00000000-0000-0000-0001-000000000221'::UUID, 'B/II/1. Vevők'),
            ('313', '00000000-0000-0000-0001-000000000221'::UUID, 'B/II/1. Vevők'),
            ('314', '00000000-0000-0000-0001-000000000221'::UUID, 'B/II/1. Vevők'),
            ('315', '00000000-0000-0000-0001-000000000221'::UUID, 'B/II/1. Vevők'),
            ('316', '00000000-0000-0000-0001-000000000222'::UUID, 'B/II/2. Követelések kapcsolt vállalkozással szemben'),
            ('317', '00000000-0000-0000-0001-000000000223'::UUID, 'B/II/3. Követelések egyéb részesedési viszonyban lévővel'),
            ('318', '00000000-0000-0000-0001-000000000221'::UUID, 'B/II/1. Vevők (értékvesztés)'),
            ('319', '00000000-0000-0000-0001-000000000221'::UUID, 'B/II/1. Vevők (értékvesztés)'),
            ('32', '00000000-0000-0000-0001-000000000224'::UUID, 'B/II/4. Váltókövetelések'),
            ('33', '00000000-0000-0000-0001-000000000225'::UUID, 'B/II/5. Egyéb követelések'),
            ('34', '00000000-0000-0000-0001-000000000225'::UUID, 'B/II/5. Egyéb követelések'),
            ('35', '00000000-0000-0000-0001-000000000225'::UUID, 'B/II/5. Egyéb követelések'),
            ('36', '00000000-0000-0000-0001-000000000225'::UUID, 'B/II/5. Egyéb követelések'),
            ('371', '00000000-0000-0000-0001-000000000231'::UUID, 'B/III/1. Részesedés kapcsolt vállalkozásban'),
            ('372', '00000000-0000-0000-0001-000000000232'::UUID, 'B/III/2. Egyéb részesedés'),
            ('373', '00000000-0000-0000-0001-000000000233'::UUID, 'B/III/3. Saját részvények, saját üzletrészek'),
            ('374', '00000000-0000-0000-0001-000000000234'::UUID, 'B/III/4. Forgatási célú hitelviszonyt megtestesítő értékpapírok'),
            ('375', '00000000-0000-0000-0001-000000000234'::UUID, 'B/III/4. Forgatási célú hitelviszonyt megtestesítő értékpapírok'),
            ('379', '00000000-0000-0000-0001-000000000235'::UUID, 'B/III/5. Értékpapírok értékvesztése'),
            ('381', '00000000-0000-0000-0001-000000000241'::UUID, 'B/IV/1. Pénztár, csekkek'),
            ('382', '00000000-0000-0000-0001-000000000241'::UUID, 'B/IV/1. Pénztár, csekkek'),
            ('383', '00000000-0000-0000-0001-000000000241'::UUID, 'B/IV/1. Pénztár, csekkek'),
            ('384', '00000000-0000-0000-0001-000000000242'::UUID, 'B/IV/2. Bankbetétek'),
            ('385', '00000000-0000-0000-0001-000000000242'::UUID, 'B/IV/2. Bankbetétek'),
            ('386', '00000000-0000-0000-0001-000000000242'::UUID, 'B/IV/2. Bankbetétek'),
            ('389', '00000000-0000-0000-0001-000000000242'::UUID, 'B/IV/2. Bankbetétek'),
            ('391', '00000000-0000-0000-0001-000000000301'::UUID, 'C/1. Bevételek aktív időbeli elhatárolása'),
            ('392', '00000000-0000-0000-0001-000000000302'::UUID, 'C/2. Költségek, ráfordítások aktív időbeli elhatárolása'),
            ('393', '00000000-0000-0000-0001-000000000303'::UUID, 'C/3. Halasztott ráfordítások'),
            ('399', '00000000-0000-0000-0001-000000000301'::UUID, 'C/1. Bevételek aktív elhatárolása (értékvesztés)'),
            ('411', '00000000-0000-0000-0001-000000001110'::UUID, 'D/I. Jegyzett tőke'),
            ('412', '00000000-0000-0000-0001-000000001130'::UUID, 'D/III. Tőketartalék'),
            ('413', '00000000-0000-0000-0001-000000001140'::UUID, 'D/IV. Eredménytartalék'),
            ('414', '00000000-0000-0000-0001-000000001150'::UUID, 'D/V. Lekötött tartalék'),
            ('417', '00000000-0000-0000-0001-000000001160'::UUID, 'D/VI. Értékelési tartalék'),
            ('419', '00000000-0000-0000-0001-000000001170'::UUID, 'D/VII. Adózott eredmény (Mérleg szerinti eredmény)'),
            ('421', '00000000-0000-0000-0001-000000001201'::UUID, 'E/1. Céltartalék a várható kötelezettségekre'),
            ('422', '00000000-0000-0000-0001-000000001202'::UUID, 'E/2. Céltartalék a jövőbeni költségekre'),
            ('429', '00000000-0000-0000-0001-000000001203'::UUID, 'E/3. Egyéb céltartalék'),
            ('431', '00000000-0000-0000-0001-000000001311'::UUID, 'F/I/1. Hátrasorolt kötelezettség kapcsolt vállalkozással szemben'),
            ('432', '00000000-0000-0000-0001-000000001312'::UUID, 'F/I/2. Hátrasorolt kötelezettség egyéb részesedési viszonyban lévővel'),
            ('433', '00000000-0000-0000-0001-000000001313'::UUID, 'F/I/3. Hátrasorolt kötelezettség egyéb gazdálkodóval szemben'),
            ('441', '00000000-0000-0000-0001-000000001321'::UUID, 'F/II/1. Hosszú lejáratra kapott kölcsönök'),
            ('442', '00000000-0000-0000-0001-000000001322'::UUID, 'F/II/2. Átváltoztatható kötvények'),
            ('443', '00000000-0000-0000-0001-000000001323'::UUID, 'F/II/3. Tartozások kötvénykibocsátásból'),
            ('444', '00000000-0000-0000-0001-000000001324'::UUID, 'F/II/4. Beruházási és fejlesztési hitelek'),
            ('445', '00000000-0000-0000-0001-000000001325'::UUID, 'F/II/5. Egyéb hosszú lejáratú hitelek'),
            ('446', '00000000-0000-0000-0001-000000001326'::UUID, 'F/II/6. Tartozások kapcsolt vállalkozással szemben'),
            ('447', '00000000-0000-0000-0001-000000001327'::UUID, 'F/II/7. Tartozások egyéb részesedési viszonyban lévővel szemben'),
            ('448', '00000000-0000-0000-0001-000000001328'::UUID, 'F/II/8. Egyéb hosszú lejáratú kötelezettségek'),
            ('449', '00000000-0000-0000-0001-000000001328'::UUID, 'F/II/8. Egyéb hosszú lejáratú kötelezettségek'),
            ('451', '00000000-0000-0000-0001-000000001331'::UUID, 'F/III/1. Rövid lejáratra kapott kölcsönök'),
            ('452', '00000000-0000-0000-0001-000000001332'::UUID, 'F/III/2. Rövid lejáratú hitelek'),
            ('453', '00000000-0000-0000-0001-000000001333'::UUID, 'F/III/3. Vevőktől kapott előlegek'),
            ('454', '00000000-0000-0000-0001-000000001334'::UUID, 'F/III/4. Kötelezettségek áruszállításból és szolgáltatásból (szállítók)'),
            ('455', '00000000-0000-0000-0001-000000001334'::UUID, 'F/III/4. Kötelezettségek áruszállításból (sz szállítók)'),
            ('456', '00000000-0000-0000-0001-000000001334'::UUID, 'F/III/4. Kötelezettségek áruszállításból (faktoring)'),
            ('457', '00000000-0000-0000-0001-000000001335'::UUID, 'F/III/5. Váltótartozások'),
            ('458', '00000000-0000-0000-0001-000000001336'::UUID, 'F/III/6. Rövid lejáratú kötelezettségek kapcsolt vállalkozással szemben'),
            ('459', '00000000-0000-0000-0001-000000001337'::UUID, 'F/III/7. Rövid lejáratú kötelezettségek egyéb részesedési viszonyban lévővel'),
            ('46', '00000000-0000-0000-0001-000000001338'::UUID, 'F/III/8. Egyéb rövid lejáratú kötelezettségek'),
            ('47', '00000000-0000-0000-0001-000000001338'::UUID, 'F/III/8. Egyéb rövid lejáratú kötelezettségek'),
            ('481', '00000000-0000-0000-0001-000000001401'::UUID, 'G/1. Bevételek passzív időbeli elhatárolása'),
            ('482', '00000000-0000-0000-0001-000000001402'::UUID, 'G/2. Költségek, ráfordítások passzív időbeli elhatárolása'),
            ('483', '00000000-0000-0000-0001-000000001403'::UUID, 'G/3. Halasztott bevételek')
    ),
    clean_gl AS (
        SELECT 
            gl.id AS gl_id,
            gl.gl_number AS orig_number,
            gl.short_name AS orig_name,
            -- Remove dots and spaces, take first component of number if hyphenated
            REPLACE(SPLIT_PART(gl.gl_number, '-', 1), '.', '') AS clean_num
        FROM public.gl_accounts gl
        WHERE gl.preset_id = p_preset_id
    )
    SELECT 
        c.gl_id AS gl_account_id,
        c.orig_number AS gl_number,
        c.orig_name AS short_name,
        pnl.pnl_id AS pnl_structure_id,
        ps.row_code AS pnl_row_code,
        ps.name AS pnl_row_name,
        bs.bs_id AS bs_structure_id,
        bss.row_code AS bs_row_code,
        bss.name AS bs_row_name,
        CASE
            WHEN pnl.pnl_id IS NOT NULL AND bs.bs_id IS NOT NULL THEN 'Automatikus javaslat Sztv. "A" szerint (P&L és Mérleg)'
            WHEN pnl.pnl_id IS NOT NULL THEN 'Automatikus javaslat Sztv. "A" szerint (P&L)'
            WHEN bs.bs_id IS NOT NULL THEN 'Automatikus javaslat Sztv. "A" szerint (Mérleg)'
            ELSE 'Nincs egyértelmű hozzárendelési szabály'
        END::TEXT AS reasoning
    FROM clean_gl c
    
    -- Match P&L rule (longest prefix)
    LEFT JOIN LATERAL (
        SELECT r.pnl_id, r.label
        FROM pnl_rules r
        WHERE c.clean_num LIKE r.prefix || '%'
        ORDER BY LENGTH(r.prefix) DESC
        LIMIT 1
    ) pnl ON true
    LEFT JOIN public.pnl_structure ps ON ps.id = pnl.pnl_id

    -- Match Balance Sheet rule (longest prefix)
    LEFT JOIN LATERAL (
        SELECT b.bs_id, b.label
        FROM bs_rules b
        WHERE c.clean_num LIKE b.prefix || '%'
        ORDER BY LENGTH(b.prefix) DESC
        LIMIT 1
    ) bs ON true
    LEFT JOIN public.bs_structure bss ON bss.id = bs.bs_id
    
    -- Filter to only accounts that do not have custom mappings saved yet for this company + preset
    WHERE NOT EXISTS (
        SELECT 1 FROM public.pnl_mapping pm 
        WHERE pm.company_id = p_company_id AND pm.preset_id = p_preset_id AND pm.gl_account_id = c.gl_id
    ) AND NOT EXISTS (
        SELECT 1 FROM public.bs_mapping bm 
        WHERE bm.company_id = p_company_id AND bm.preset_id = p_preset_id AND bm.gl_account_id = c.gl_id
    )
    -- Only return leaf accounts (that have matching suggestions)
    AND (pnl.pnl_id IS NOT NULL OR bs.bs_id IS NOT NULL);
END;
$$;

-- Grant execution permissions
GRANT EXECUTE ON FUNCTION public.get_reconciliation_status TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_reconciliation_status TO service_role;
GRANT EXECUTE ON FUNCTION public.suggest_gl_mappings TO authenticated;
GRANT EXECUTE ON FUNCTION public.suggest_gl_mappings TO service_role;
