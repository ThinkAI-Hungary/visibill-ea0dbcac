-- ============================================================================
-- VISIBILL SANDBOX SETUP SCRIPT
-- ============================================================================
-- Futtatás: Supabase Dashboard → SQL Editor → Paste & Run
-- FONTOS: Ez a script service_role jogosultsággal fut a SQL Editor-ban!
-- ============================================================================

-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║  STEP 0: SANDBOX FELHASZNÁLÓ LÉTREHOZÁSA                           ║
-- ╚══════════════════════════════════════════════════════════════════════╝

DO $$
DECLARE
  v_sandbox_user_id UUID;
  v_source_company_id UUID;
  v_sandbox_company_id UUID;
BEGIN

  -- ── 0a. Auth user létrehozása ──
  -- Ellenőrizzük, hogy létezik-e már
  SELECT id INTO v_sandbox_user_id
  FROM auth.users
  WHERE email = 'sandbox@thinkai.hu';

  IF v_sandbox_user_id IS NULL THEN
    -- Új user létrehozása
    INSERT INTO auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      confirmation_token,
      email_change,
      email_change_token_new,
      recovery_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      gen_random_uuid(),
      'authenticated',
      'authenticated',
      'sandbox@thinkai.hu',
      crypt('SANDBOXTHINKAI.', gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"name":"Sandbox"}'::jsonb,
      now(),
      now(),
      '',
      '',
      '',
      ''
    )
    RETURNING id INTO v_sandbox_user_id;

    -- Identitás sor létrehozása (szükséges a belépéshez)
    INSERT INTO auth.identities (
      id,
      user_id,
      identity_data,
      provider,
      provider_id,
      last_sign_in_at,
      created_at,
      updated_at
    ) VALUES (
      gen_random_uuid(),
      v_sandbox_user_id,
      jsonb_build_object('sub', v_sandbox_user_id::text, 'email', 'sandbox@thinkai.hu'),
      'email',
      v_sandbox_user_id::text,
      now(),
      now(),
      now()
    );

    RAISE NOTICE '✅ Sandbox user létrehozva: %', v_sandbox_user_id;
  ELSE
    RAISE NOTICE '⚠️ Sandbox user már létezik: %', v_sandbox_user_id;
  END IF;

  -- ── 0b. Profil létrehozása/biztosítása ──
  -- A trigger már létrehozta, de ha mégsem:
  INSERT INTO public.profiles (user_id, name)
  VALUES (v_sandbox_user_id, 'Sandbox')
  ON CONFLICT (user_id) DO UPDATE SET name = 'Sandbox';

  RAISE NOTICE '✅ Profil biztosítva';

  -- ── 0c. Subscription létrehozása (Enterprise szintű, végtelen) ──
  INSERT INTO public.user_subscriptions (
    user_id, tier, invoice_limit, invoices_used,
    period_start, period_end
  ) VALUES (
    v_sandbox_user_id, 'enterprise', 999999, 0,
    now(), (now() + interval '10 years')
  )
  ON CONFLICT DO NOTHING;

  RAISE NOTICE '✅ Subscription biztosítva';

  -- ╔══════════════════════════════════════════════════════════════════════╗
  -- ║  STEP 1: SANDBOX CÉG LÉTREHOZÁSA                                  ║
  -- ╚══════════════════════════════════════════════════════════════════════╝

  -- Ellenőrizzük, hogy létezik-e már SANDBOX nevű cég
  SELECT id INTO v_sandbox_company_id
  FROM public.companies
  WHERE name = 'SANDBOX' AND owner_id = v_sandbox_user_id;

  IF v_sandbox_company_id IS NULL THEN
    INSERT INTO public.companies (
      id, name, tax_number, address, owner_id, created_at, updated_at
    ) VALUES (
      gen_random_uuid(),
      'SANDBOX',
      '12345678-2-42',
      '1234 Budapest, Sandbox utca 1',
      v_sandbox_user_id,
      now(),
      now()
    )
    RETURNING id INTO v_sandbox_company_id;

    RAISE NOTICE '✅ SANDBOX cég létrehozva: %', v_sandbox_company_id;
  ELSE
    RAISE NOTICE '⚠️ SANDBOX cég már létezik: %', v_sandbox_company_id;
  END IF;

  -- ── 1b. Company member hozzárendelés ──
  INSERT INTO public.company_members (user_id, company_id)
  VALUES (v_sandbox_user_id, v_sandbox_company_id)
  ON CONFLICT DO NOTHING;

  RAISE NOTICE '✅ Company member hozzárendelve';

  -- ╔══════════════════════════════════════════════════════════════════════╗
  -- ║  STEP 2: FORRÁS CÉG (Taxology Kft.) AZONOSÍTÁSA                   ║
  -- ╚══════════════════════════════════════════════════════════════════════╝

  SELECT id INTO v_source_company_id
  FROM public.companies
  WHERE name ILIKE '%Taxology%'
  LIMIT 1;

  IF v_source_company_id IS NULL THEN
    RAISE EXCEPTION '❌ Taxology Kft. nem található a companies táblában!';
  END IF;

  RAISE NOTICE '✅ Forrás cég (Taxology): %', v_source_company_id;

  -- ╔══════════════════════════════════════════════════════════════════════╗
  -- ║  STEP 3: ADAT TÜKRÖZÉS (FK-k megtartásával)                       ║
  -- ╚══════════════════════════════════════════════════════════════════════╝

  -- ═══════════════════════════════════════════════════════════
  -- 3a. KATEGÓRIÁK
  -- ═══════════════════════════════════════════════════════════
  -- Ideiglenes map tábla az ID-k összerendeléséhez
  CREATE TEMP TABLE _map_categories (old_id UUID, new_id UUID) ON COMMIT DROP;

  INSERT INTO _map_categories (old_id, new_id)
  SELECT id, gen_random_uuid()
  FROM public.categories
  WHERE company_id = v_source_company_id;

  INSERT INTO public.categories (id, user_id, company_id, name, description, created_at, updated_at)
  SELECT
    mc.new_id,
    v_sandbox_user_id,
    v_sandbox_company_id,
    REPLACE(c.name, 'Taxology', 'SANDBOX'),
    c.description,
    c.created_at,
    c.updated_at
  FROM public.categories c
  JOIN _map_categories mc ON mc.old_id = c.id
  WHERE c.company_id = v_source_company_id;

  RAISE NOTICE '✅ Kategóriák másolva: %', (SELECT count(*) FROM _map_categories);

  -- ═══════════════════════════════════════════════════════════
  -- 3b. PROJEKTEK
  -- ═══════════════════════════════════════════════════════════
  CREATE TEMP TABLE _map_projects (old_id UUID, new_id UUID) ON COMMIT DROP;

  INSERT INTO _map_projects (old_id, new_id)
  SELECT id, gen_random_uuid()
  FROM public.projects
  WHERE company_id = v_sandbox_company_id
  UNION ALL -- ez üres lesz, de biztonság kedvéért
  SELECT id, gen_random_uuid()
  FROM public.projects
  WHERE company_id = v_source_company_id;

  -- Töröljük a duplikákat — csak a forrás cég rekordjait kell
  DELETE FROM _map_projects WHERE old_id NOT IN (SELECT id FROM public.projects WHERE company_id = v_source_company_id);

  INSERT INTO public.projects (id, user_id, company_id, name, description, project_code, project_type, client_name, budget, start_date, end_date, status, created_at, updated_at)
  SELECT
    mp.new_id,
    v_sandbox_user_id,
    v_sandbox_company_id,
    REPLACE(p.name, 'Taxology', 'SANDBOX'),
    p.description,
    p.project_code,
    p.project_type,
    REPLACE(COALESCE(p.client_name, ''), 'Taxology', 'SANDBOX'),
    p.budget,
    p.start_date,
    p.end_date,
    p.status,
    p.created_at,
    p.updated_at
  FROM public.projects p
  JOIN _map_projects mp ON mp.old_id = p.id
  WHERE p.company_id = v_source_company_id;

  RAISE NOTICE '✅ Projektek másolva: %', (SELECT count(*) FROM _map_projects);

  -- ═══════════════════════════════════════════════════════════
  -- 3c. PARTNEREK
  -- ═══════════════════════════════════════════════════════════
  CREATE TEMP TABLE _map_partners (old_id UUID, new_id UUID) ON COMMIT DROP;

  INSERT INTO _map_partners (old_id, new_id)
  SELECT id, gen_random_uuid()
  FROM public.partners
  WHERE company_id = v_source_company_id;

  INSERT INTO public.partners (id, user_id, company_id, name, tax_number, partner_type, address, email, default_project_id, created_at, updated_at)
  SELECT
    mpart.new_id,
    v_sandbox_user_id,
    v_sandbox_company_id,
    REPLACE(p.name, 'Taxology', 'SANDBOX'),
    p.tax_number,
    p.partner_type,
    p.address,
    p.email,
    mp.new_id,  -- remapped project ID
    p.created_at,
    p.updated_at
  FROM public.partners p
  JOIN _map_partners mpart ON mpart.old_id = p.id
  LEFT JOIN _map_projects mp ON mp.old_id = p.default_project_id
  WHERE p.company_id = v_source_company_id;

  RAISE NOTICE '✅ Partnerek másolva: %', (SELECT count(*) FROM _map_partners);

  -- ═══════════════════════════════════════════════════════════
  -- 3d. TRANSACTION UPLOADS (szükséges FK a transactions-hoz)
  -- ═══════════════════════════════════════════════════════════
  CREATE TEMP TABLE _map_transaction_uploads (old_id UUID, new_id UUID) ON COMMIT DROP;

  INSERT INTO _map_transaction_uploads (old_id, new_id)
  SELECT id, gen_random_uuid()
  FROM public.transaction_uploads
  WHERE company_id = v_source_company_id::text;

  INSERT INTO public.transaction_uploads (id, company_id, user_id, file_name, file_url, file_type, file_size, upload_status, processing_status, error_message, metadata, created_at, updated_at)
  SELECT
    mtu.new_id,
    v_sandbox_company_id::text,
    v_sandbox_user_id,
    tu.file_name,
    tu.file_url,
    tu.file_type,
    tu.file_size,
    tu.upload_status,
    tu.processing_status,
    tu.error_message,
    tu.metadata,
    tu.created_at,
    tu.updated_at
  FROM public.transaction_uploads tu
  JOIN _map_transaction_uploads mtu ON mtu.old_id = tu.id
  WHERE tu.company_id = v_source_company_id::text;

  RAISE NOTICE '✅ Transaction uploads másolva: %', (SELECT count(*) FROM _map_transaction_uploads);

  -- ═══════════════════════════════════════════════════════════
  -- 3e. TRANZAKCIÓK
  -- ═══════════════════════════════════════════════════════════
  CREATE TEMP TABLE _map_transactions (old_id UUID, new_id UUID) ON COMMIT DROP;

  INSERT INTO _map_transactions (old_id, new_id)
  SELECT id, gen_random_uuid()
  FROM public.transactions
  WHERE company_id = v_source_company_id;

  INSERT INTO public.transactions (id, company_id, amount, currency, description, transaction_date, type, matched_invoice_id, match_type, confidence_score, reason, is_verified, upload_id, created_at)
  SELECT
    mt.new_id,
    v_sandbox_company_id,
    t.amount,
    t.currency,
    REPLACE(COALESCE(t.description, ''), 'Taxology', 'SANDBOX'),
    t.transaction_date,
    t.type,
    NULL,  -- matched_invoice_id — majd később frissítjük
    t.match_type,
    t.confidence_score,
    t.reason,
    t.is_verified,
    mtu.new_id,  -- remapped upload_id
    t.created_at
  FROM public.transactions t
  JOIN _map_transactions mt ON mt.old_id = t.id
  LEFT JOIN _map_transaction_uploads mtu ON mtu.old_id = t.upload_id
  WHERE t.company_id = v_source_company_id;

  RAISE NOTICE '✅ Tranzakciók másolva: %', (SELECT count(*) FROM _map_transactions);

  -- ═══════════════════════════════════════════════════════════
  -- 3f. INVOICE UPLOADS
  -- ═══════════════════════════════════════════════════════════
  CREATE TEMP TABLE _map_invoice_uploads (old_id UUID, new_id UUID) ON COMMIT DROP;

  INSERT INTO _map_invoice_uploads (old_id, new_id)
  SELECT id, gen_random_uuid()
  FROM public.invoice_uploads
  WHERE company_id = v_source_company_id;

  INSERT INTO public.invoice_uploads (id, user_id, company_id, file_name, file_size, file_type, file_url, upload_status, processing_status, error_message, metadata, created_at, updated_at)
  SELECT
    miu.new_id,
    v_sandbox_user_id,
    v_sandbox_company_id,
    iu.file_name,
    iu.file_size,
    iu.file_type,
    iu.file_url,
    iu.upload_status,
    iu.processing_status,
    iu.error_message,
    iu.metadata,
    iu.created_at,
    iu.updated_at
  FROM public.invoice_uploads iu
  JOIN _map_invoice_uploads miu ON miu.old_id = iu.id
  WHERE iu.company_id = v_source_company_id;

  RAISE NOTICE '✅ Invoice uploads másolva: %', (SELECT count(*) FROM _map_invoice_uploads);

  -- ═══════════════════════════════════════════════════════════
  -- 3g. SZÁMLÁK (invoices)
  -- ═══════════════════════════════════════════════════════════
  CREATE TEMP TABLE _map_invoices (old_id UUID, new_id UUID) ON COMMIT DROP;

  INSERT INTO _map_invoices (old_id, new_id)
  SELECT id, gen_random_uuid()
  FROM public.invoices
  WHERE company_id = v_source_company_id;

  INSERT INTO public.invoices (
    id, user_id, company_id, bizonylatsorszam, kibocsatas_datuma,
    elado_nev, elado_cim, elado_vat_id,
    vevo_nev, vevo_cim, vevo_vat_id,
    adoalap_osszesen, afa_osszeg_osszesen, brutto_vegosszeg,
    fizetendo_osszeg, fizetesi_hatarido, fizetesi_mod,
    penznem, fizetve, statusz,
    category_id, project_id, transaction_id, invoice_uploads_id,
    invoice_direction, invoice_type,
    teljesites_datuma, dokumentum_azonosito,
    afa_kulcsok_bontasban, adojogi_megjegyzes,
    adomentesseg_hivatkozas, forditott_adozas,
    penzforgalmi_elszamolas, onszamlazas,
    bankszamlaszam_iban, melleklet_url, image_url,
    feldolgozva, reference_number,
    elolegszamla_hivatkozas, elszamolt_eloleg_osszeg,
    email_uzenet_id, termek_szolgaltatas_tipusa,
    letrehozva, frissitve
  )
  SELECT
    mi.new_id,
    v_sandbox_user_id,
    v_sandbox_company_id,
    i.bizonylatsorszam,
    i.kibocsatas_datuma,
    REPLACE(i.elado_nev, 'Taxology', 'SANDBOX'),
    REPLACE(COALESCE(i.elado_cim, ''), 'Taxology', 'SANDBOX'),
    i.elado_vat_id,
    REPLACE(i.vevo_nev, 'Taxology', 'SANDBOX'),
    REPLACE(COALESCE(i.vevo_cim, ''), 'Taxology', 'SANDBOX'),
    i.vevo_vat_id,
    i.adoalap_osszesen, i.afa_osszeg_osszesen, i.brutto_vegosszeg,
    i.fizetendo_osszeg, i.fizetesi_hatarido, i.fizetesi_mod,
    i.penznem, i.fizetve, i.statusz,
    mc.new_id,   -- remapped category_id
    mp.new_id,   -- remapped project_id
    mt.new_id,   -- remapped transaction_id
    miu.new_id,  -- remapped invoice_uploads_id
    i.invoice_direction, i.invoice_type,
    i.teljesites_datuma, i.dokumentum_azonosito,
    i.afa_kulcsok_bontasban, i.adojogi_megjegyzes,
    i.adomentesseg_hivatkozas, i.forditott_adozas,
    i.penzforgalmi_elszamolas, i.onszamlazas,
    i.bankszamlaszam_iban, i.melleklet_url, i.image_url,
    i.feldolgozva, i.reference_number,
    i.elolegszamla_hivatkozas, i.elszamolt_eloleg_osszeg,
    i.email_uzenet_id, i.termek_szolgaltatas_tipusa,
    i.letrehozva, i.frissitve
  FROM public.invoices i
  JOIN _map_invoices mi ON mi.old_id = i.id
  LEFT JOIN _map_categories mc ON mc.old_id = i.category_id
  LEFT JOIN _map_projects mp ON mp.old_id = i.project_id
  LEFT JOIN _map_transactions mt ON mt.old_id = i.transaction_id
  LEFT JOIN _map_invoice_uploads miu ON miu.old_id = i.invoice_uploads_id
  WHERE i.company_id = v_source_company_id;

  RAISE NOTICE '✅ Számlák másolva: %', (SELECT count(*) FROM _map_invoices);

  -- ── Tranzakciók matched_invoice_id frissítése ──
  UPDATE public.transactions t
  SET matched_invoice_id = mi.new_id
  FROM _map_transactions mt
  JOIN public.transactions orig_t ON orig_t.id = mt.old_id
  JOIN _map_invoices mi ON mi.old_id = orig_t.matched_invoice_id
  WHERE t.id = mt.new_id
    AND orig_t.matched_invoice_id IS NOT NULL;

  RAISE NOTICE '✅ Tranzakció-számla párosítások frissítve';

  -- ═══════════════════════════════════════════════════════════
  -- 3h. SALARY FILES
  -- ═══════════════════════════════════════════════════════════
  CREATE TEMP TABLE _map_salary_files (old_id UUID, new_id UUID) ON COMMIT DROP;

  INSERT INTO _map_salary_files (old_id, new_id)
  SELECT id, gen_random_uuid()
  FROM public.salary_files
  WHERE company_id = v_source_company_id;

  INSERT INTO public.salary_files (
    id, user_id, company_id,
    recipient_name, description, amount_to_transfer,
    payment_type, source, status,
    employee_name, period_year, period_month,
    due_date, payment_date, payment_reference,
    file_name, file_url, file_size, metadata,
    created_at, updated_at
  )
  SELECT
    msf.new_id,
    v_sandbox_user_id,
    v_sandbox_company_id,
    REPLACE(sf.recipient_name, 'Taxology', 'SANDBOX'),
    sf.description,
    sf.amount_to_transfer,
    sf.payment_type, sf.source, sf.status,
    sf.employee_name, sf.period_year, sf.period_month,
    sf.due_date, sf.payment_date, sf.payment_reference,
    sf.file_name, sf.file_url, sf.file_size, sf.metadata,
    sf.created_at, sf.updated_at
  FROM public.salary_files sf
  JOIN _map_salary_files msf ON msf.old_id = sf.id
  WHERE sf.company_id = v_source_company_id;

  RAISE NOTICE '✅ Salary files másolva: %', (SELECT count(*) FROM _map_salary_files);

  -- ═══════════════════════════════════════════════════════════
  -- 3i. BÉREK (salary)
  -- ═══════════════════════════════════════════════════════════
  INSERT INTO public.salary (
    id, user_id, company_id,
    név, munkavallalo_neve, összeg, tipus, fizetesi_mod,
    statusz, dátum, kifizetes_ideje, megjegyzes,
    salary_file_id, transaction_id,
    created_at, updated_at
  )
  SELECT
    gen_random_uuid(),
    v_sandbox_user_id,
    v_sandbox_company_id,
    s.név,
    s.munkavallalo_neve,
    s.összeg, s.tipus, s.fizetesi_mod,
    s.statusz, s.dátum, s.kifizetes_ideje, s.megjegyzes,
    msf.new_id,  -- remapped salary_file_id
    mt.new_id,   -- remapped transaction_id
    s.created_at, s.updated_at
  FROM public.salary s
  LEFT JOIN _map_salary_files msf ON msf.old_id = s.salary_file_id
  LEFT JOIN _map_transactions mt ON mt.old_id = s.transaction_id
  WHERE s.company_id = v_source_company_id;

  RAISE NOTICE '✅ Bérek másolva';

  -- ═══════════════════════════════════════════════════════════
  -- 3j. NAV SZÁMLÁK (nav_invoices)
  -- ═══════════════════════════════════════════════════════════
  CREATE TEMP TABLE _map_nav_invoices (old_id UUID, new_id UUID) ON COMMIT DROP;

  INSERT INTO _map_nav_invoices (old_id, new_id)
  SELECT id, gen_random_uuid()
  FROM public.nav_invoices
  WHERE company_id = v_source_company_id;

  INSERT INTO public.nav_invoices (
    id, user_id, company_id,
    invoice_number, invoice_direction, invoice_operation,
    supplier_name, supplier_tax_number, supplier_address,
    customer_name, customer_tax_number, customer_address,
    invoice_issue_date, invoice_delivery_date,
    invoice_net_amount, invoice_vat_amount, invoice_gross_amount,
    currency, payment_method, payment_date,
    paid, submitted, details_fetched, fetched_at,
    category_id, project_id, transaction_id, supplier_partner_id,
    ai_categorization_reason,
    created_at
  )
  SELECT
    mni.new_id,
    v_sandbox_user_id,
    v_sandbox_company_id,
    ni.invoice_number, ni.invoice_direction, ni.invoice_operation,
    REPLACE(COALESCE(ni.supplier_name, ''), 'Taxology', 'SANDBOX'),
    ni.supplier_tax_number,
    REPLACE(COALESCE(ni.supplier_address, ''), 'Taxology', 'SANDBOX'),
    REPLACE(COALESCE(ni.customer_name, ''), 'Taxology', 'SANDBOX'),
    ni.customer_tax_number,
    REPLACE(COALESCE(ni.customer_address, ''), 'Taxology', 'SANDBOX'),
    ni.invoice_issue_date, ni.invoice_delivery_date,
    ni.invoice_net_amount, ni.invoice_vat_amount, ni.invoice_gross_amount,
    ni.currency, ni.payment_method, ni.payment_date,
    ni.paid, ni.submitted, ni.details_fetched, ni.fetched_at,
    mc.new_id,      -- remapped category_id
    mp.new_id,      -- remapped project_id
    mt.new_id,      -- remapped transaction_id
    mpart.new_id,   -- remapped supplier_partner_id
    ni.ai_categorization_reason,
    ni.created_at
  FROM public.nav_invoices ni
  JOIN _map_nav_invoices mni ON mni.old_id = ni.id
  LEFT JOIN _map_categories mc ON mc.old_id = ni.category_id
  LEFT JOIN _map_projects mp ON mp.old_id = ni.project_id
  LEFT JOIN _map_transactions mt ON mt.old_id = ni.transaction_id
  LEFT JOIN _map_partners mpart ON mpart.old_id = ni.supplier_partner_id
  WHERE ni.company_id = v_source_company_id;

  RAISE NOTICE '✅ NAV számlák másolva: %', (SELECT count(*) FROM _map_nav_invoices);

  -- ═══════════════════════════════════════════════════════════
  -- 3k. NAV SZÁMLA TÉTELEK (nav_invoice_items)
  -- ═══════════════════════════════════════════════════════════
  INSERT INTO public.nav_invoice_items (
    id, nav_invoice_id, line_number, line_description,
    quantity, unit_of_measure, unit_price,
    net_amount, vat_rate, vat_amount, gross_amount,
    product_code, created_at
  )
  SELECT
    gen_random_uuid(),
    mni.new_id,  -- remapped nav_invoice_id
    nii.line_number, nii.line_description,
    nii.quantity, nii.unit_of_measure, nii.unit_price,
    nii.net_amount, nii.vat_rate, nii.vat_amount, nii.gross_amount,
    nii.product_code, nii.created_at
  FROM public.nav_invoice_items nii
  JOIN _map_nav_invoices mni ON mni.old_id = nii.nav_invoice_id;

  RAISE NOTICE '✅ NAV számla tételek másolva';

  -- ═══════════════════════════════════════════════════════════
  -- 3l. ADÓ TÁBLA (tax)
  -- ═══════════════════════════════════════════════════════════
  INSERT INTO public.tax (id, user_id, company_id, adonem, osszeg, datum, created_at, updated_at)
  SELECT
    gen_random_uuid(),
    v_sandbox_user_id,
    v_sandbox_company_id,
    t.adonem, t.osszeg, t.datum, t.created_at, t.updated_at
  FROM public.tax t
  WHERE t.company_id = v_source_company_id;

  RAISE NOTICE '✅ Adó rekordok másolva';

  -- ═══════════════════════════════════════════════════════════
  -- 3m. HÁZIPÉNZTÁR BEÁLLÍTÁSOK (hp_settings)
  -- ═══════════════════════════════════════════════════════════
  INSERT INTO public.hp_settings (id, company_id, created_by, opening_balance, start_date, created_at, updated_at)
  SELECT
    gen_random_uuid(),
    v_sandbox_company_id,
    v_sandbox_user_id,
    hp.opening_balance, hp.start_date, hp.created_at, hp.updated_at
  FROM public.hp_settings hp
  WHERE hp.company_id = v_source_company_id
  ON CONFLICT DO NOTHING;

  RAISE NOTICE '✅ HP beállítások másolva';

  -- ╔══════════════════════════════════════════════════════════════════════╗
  -- ║  STEP 4: ÖSSZESÍTÉS                                                ║
  -- ╚══════════════════════════════════════════════════════════════════════╝

  RAISE NOTICE '══════════════════════════════════════════';
  RAISE NOTICE '🎉 SANDBOX SETUP KÉSZ!';
  RAISE NOTICE '══════════════════════════════════════════';
  RAISE NOTICE 'Sandbox user ID:    %', v_sandbox_user_id;
  RAISE NOTICE 'Sandbox company ID: %', v_sandbox_company_id;
  RAISE NOTICE 'Source company ID:  %', v_source_company_id;
  RAISE NOTICE '';
  RAISE NOTICE 'Bejelentkezés:';
  RAISE NOTICE '  Email: sandbox@thinkai.hu';
  RAISE NOTICE '  Jelszó: SANDBOXTHINKAI.';
  RAISE NOTICE '══════════════════════════════════════════';

END $$;
