-- ============================================================================
-- VISIBILL SANDBOX MOCKUP SEED SCRIPT
-- ============================================================================
-- Replaces: sync_sandbox_from_taxology() cron job
-- Idempotent: safe to re-run — deletes everything first, then inserts
-- Run: Supabase Dashboard → SQL Editor → Paste & Run
-- ============================================================================

DO $$
DECLARE
  v_su  UUID := '938e8745-2796-494f-b186-323d138d452e';  -- sandbox user ID
  v_sc  UUID := '59b545c0-5818-4499-ac5e-06afc0880e73';  -- sandbox company ID

  -- Category IDs
  c_irodaszer  UUID := 'a0000001-0000-0000-0000-000000000001';
  c_berleti    UUID := 'a0000001-0000-0000-0000-000000000002';
  c_kozuzemi   UUID := 'a0000001-0000-0000-0000-000000000003';
  c_tanacsadas UUID := 'a0000001-0000-0000-0000-000000000004';
  c_marketing  UUID := 'a0000001-0000-0000-0000-000000000005';
  c_szallitas  UUID := 'a0000001-0000-0000-0000-000000000006';
  c_it         UUID := 'a0000001-0000-0000-0000-000000000007';
  c_bankkoltseg UUID := 'a0000001-0000-0000-0000-000000000008';
  c_biztositas UUID := 'a0000001-0000-0000-0000-000000000009';
  c_adok       UUID := 'a0000001-0000-0000-0000-000000000010';
  c_berek      UUID := 'a0000001-0000-0000-0000-000000000011';
  c_kepzes     UUID := 'a0000001-0000-0000-0000-000000000012';
  c_utazas     UUID := 'a0000001-0000-0000-0000-000000000013';
  c_karbantartas UUID := 'a0000001-0000-0000-0000-000000000014';
  c_egyeb      UUID := 'a0000001-0000-0000-0000-000000000015';

  -- Project IDs
  p_webdev     UUID := 'b0000001-0000-0000-0000-000000000001';
  p_marketing  UUID := 'b0000001-0000-0000-0000-000000000002';
  p_iroda      UUID := 'b0000001-0000-0000-0000-000000000003';
  p_iso        UUID := 'b0000001-0000-0000-0000-000000000004';
  p_export     UUID := 'b0000001-0000-0000-0000-000000000005';

  -- Partner IDs (first 10 for reference)
  prt_techsol  UUID := 'c0000001-0000-0000-0000-000000000001';
  prt_offmax   UUID := 'c0000001-0000-0000-0000-000000000002';
  prt_mkb      UUID := 'c0000001-0000-0000-0000-000000000003';
  prt_telekom  UUID := 'c0000001-0000-0000-0000-000000000004';
  prt_immo     UUID := 'c0000001-0000-0000-0000-000000000005';
  prt_kreativ  UUID := 'c0000001-0000-0000-0000-000000000006';
  prt_biztbp   UUID := 'c0000001-0000-0000-0000-000000000007';
  prt_delta    UUID := 'c0000001-0000-0000-0000-000000000008';
  prt_omega    UUID := 'c0000001-0000-0000-0000-000000000009';
  prt_alfa     UUID := 'c0000001-0000-0000-0000-000000000010';

  -- Location IDs
  loc_szekh    UUID := 'd0000001-0000-0000-0000-000000000001';
  loc_raktar   UUID := 'd0000001-0000-0000-0000-000000000002';

  -- GL preset ID
  gl_preset    UUID := 'e0000001-0000-0000-0000-000000000001';

  -- Counters
  v_cnt INTEGER;
  v_i   INTEGER;

BEGIN

-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║  PHASE 1: TELJES TÖRLÉS                                           ║
-- ╚══════════════════════════════════════════════════════════════════════╝

RAISE NOTICE '═══ PHASE 1: DELETE ═══';

ALTER TABLE invoices              DISABLE TRIGGER USER;
ALTER TABLE transactions          DISABLE TRIGGER USER;
ALTER TABLE nav_invoices          DISABLE TRIGGER USER;
ALTER TABLE salary                DISABLE TRIGGER USER;
ALTER TABLE salary_files          DISABLE TRIGGER USER;
ALTER TABLE invoice_uploads       DISABLE TRIGGER USER;
ALTER TABLE partners              DISABLE TRIGGER USER;
ALTER TABLE categories            DISABLE TRIGGER USER;
ALTER TABLE projects              DISABLE TRIGGER USER;
ALTER TABLE employee_rates        DISABLE TRIGGER USER;
ALTER TABLE time_entries          DISABLE TRIGGER USER;
ALTER TABLE company_settings      DISABLE TRIGGER USER;
ALTER TABLE gl_accounts           DISABLE TRIGGER USER;
ALTER TABLE chart_of_accounts_presets DISABLE TRIGGER USER;
ALTER TABLE fixed_assets          DISABLE TRIGGER USER;
ALTER TABLE asset_events          DISABLE TRIGGER USER;
ALTER TABLE company_locations     DISABLE TRIGGER USER;
ALTER TABLE invoice_items         DISABLE TRIGGER USER;
ALTER TABLE feedback              DISABLE TRIGGER USER;

-- Delete in reverse FK order
UPDATE transactions SET matched_invoice_id = NULL WHERE company_id = v_sc AND matched_invoice_id IS NOT NULL;

-- Tickets
DELETE FROM ticket_reads WHERE feedback_id IN (SELECT id FROM feedback WHERE company_id = v_sc);
DELETE FROM ticket_events WHERE feedback_id IN (SELECT id FROM feedback WHERE company_id = v_sc);
DELETE FROM ticket_comments WHERE feedback_id IN (SELECT id FROM feedback WHERE company_id = v_sc);
DELETE FROM feedback WHERE company_id = v_sc;

-- Annual reports
DELETE FROM annual_reports WHERE company_id = v_sc;

-- VAT
DELETE FROM vat_return_lines WHERE vat_return_id IN (SELECT id FROM vat_returns WHERE company_id = v_sc);
DELETE FROM vat_returns WHERE company_id = v_sc;

-- Assets
DELETE FROM asset_events WHERE company_id = v_sc;
DELETE FROM fixed_assets WHERE company_id = v_sc;
DELETE FROM company_locations WHERE company_id = v_sc;

-- GL
DELETE FROM bs_mapping WHERE company_id = v_sc;
DELETE FROM pnl_mapping WHERE company_id = v_sc;
UPDATE gl_accounts SET parent_id = NULL WHERE preset_id IN (SELECT id FROM chart_of_accounts_presets WHERE company_id = v_sc) AND parent_id IS NOT NULL;
DELETE FROM gl_accounts WHERE preset_id IN (SELECT id FROM chart_of_accounts_presets WHERE company_id = v_sc);
DELETE FROM chart_of_accounts_presets WHERE company_id = v_sc;
DELETE FROM gl_upload_notifications WHERE company_id = v_sc;

-- Working time
DELETE FROM time_entries WHERE company_id = v_sc;
DELETE FROM employee_rates WHERE company_id = v_sc;
DELETE FROM company_settings WHERE company_id = v_sc;

-- Payroll
DELETE FROM accounty_payroll_calculations WHERE cycle_id IN (SELECT id FROM accounty_payroll_cycles WHERE company_id = v_sc);
DELETE FROM accounty_payroll_items WHERE cycle_id IN (SELECT id FROM accounty_payroll_cycles WHERE company_id = v_sc);
DELETE FROM accounty_payroll_cycles WHERE company_id = v_sc;
DELETE FROM accounty_employments WHERE company_id = v_sc;
DELETE FROM accounty_employees WHERE company_id = v_sc;
DELETE FROM accounty_deadlines WHERE company_id = v_sc;
DELETE FROM accounty_missing_items WHERE company_id = v_sc;
DELETE FROM accounty_filings WHERE company_id = v_sc;

-- Core data
DELETE FROM invoice_items WHERE invoice_id IN (SELECT id FROM invoices WHERE company_id = v_sc);
DELETE FROM nav_invoice_items WHERE nav_invoice_id IN (SELECT id FROM nav_invoices WHERE company_id = v_sc);
DELETE FROM nav_invoices WHERE company_id = v_sc;
DELETE FROM salary WHERE company_id = v_sc;
DELETE FROM salary_files WHERE company_id = v_sc;
DELETE FROM invoices WHERE company_id = v_sc;
DELETE FROM invoice_uploads WHERE company_id = v_sc;
DELETE FROM transactions WHERE company_id = v_sc;
DELETE FROM transaction_uploads WHERE company_id = v_sc;
DELETE FROM partners WHERE company_id = v_sc;
DELETE FROM categories WHERE company_id = v_sc;
DELETE FROM projects WHERE company_id = v_sc;
DELETE FROM tax WHERE company_id = v_sc;
DELETE FROM hp_settings WHERE company_id = v_sc;

RAISE NOTICE '✅ Régi adatok törölve';

-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║  PHASE 2: KATEGÓRIÁK (15 db)                                      ║
-- ╚══════════════════════════════════════════════════════════════════════╝

RAISE NOTICE '═══ PHASE 2: KATEGÓRIÁK ═══';

INSERT INTO categories (id, user_id, company_id, name, description, created_at, updated_at) VALUES
  (c_irodaszer,    v_su, v_sc, 'Irodaszer',              'Irodai kellékek, papír, toner',           '2026-01-02'::timestamptz, now()),
  (c_berleti,      v_su, v_sc, 'Bérleti díj',            'Irodabérleti díjak',                     '2026-01-02'::timestamptz, now()),
  (c_kozuzemi,     v_su, v_sc, 'Közüzemi díjak',         'Víz, gáz, villany, internet',            '2026-01-02'::timestamptz, now()),
  (c_tanacsadas,   v_su, v_sc, 'Tanácsadás',             'Jogi, pénzügyi, IT tanácsadás',          '2026-01-02'::timestamptz, now()),
  (c_marketing,    v_su, v_sc, 'Marketing',              'Reklám, online marketing, PR',            '2026-01-02'::timestamptz, now()),
  (c_szallitas,    v_su, v_sc, 'Szállítás / Logisztika', 'Futárszolgálat, posta',                  '2026-01-02'::timestamptz, now()),
  (c_it,           v_su, v_sc, 'IT és szoftver',         'Szoftver licenszek, hosting, fejlesztés', '2026-01-02'::timestamptz, now()),
  (c_bankkoltseg,  v_su, v_sc, 'Bankköltség',            'Banki díjak, tranzakciós költségek',     '2026-01-02'::timestamptz, now()),
  (c_biztositas,   v_su, v_sc, 'Biztosítás',             'Cégbiztosítás, vagyonbiztosítás',        '2026-01-02'::timestamptz, now()),
  (c_adok,         v_su, v_sc, 'Adók és járulékok',      'Társasági adó, iparűzési adó, járulékok','2026-01-02'::timestamptz, now()),
  (c_berek,        v_su, v_sc, 'Bérek és juttatások',    'Bruttó bérek, cafeteria',                '2026-01-02'::timestamptz, now()),
  (c_kepzes,       v_su, v_sc, 'Képzés / Oktatás',       'Továbbképzések, konferenciák',           '2026-01-02'::timestamptz, now()),
  (c_utazas,       v_su, v_sc, 'Utazás / Kiküldetés',    'Üzleti utak, napidíj, szállásdíj',      '2026-01-02'::timestamptz, now()),
  (c_karbantartas, v_su, v_sc, 'Karbantartás',           'Épület és eszköz karbantartás',          '2026-01-02'::timestamptz, now()),
  (c_egyeb,        v_su, v_sc, 'Egyéb költség',          'Egyéb, nem besorolható tételek',         '2026-01-02'::timestamptz, now());

RAISE NOTICE '✅ 15 kategória létrehozva';

-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║  PHASE 3: PROJEKTEK (5 db)                                        ║
-- ╚══════════════════════════════════════════════════════════════════════╝

RAISE NOTICE '═══ PHASE 3: PROJEKTEK ═══';

INSERT INTO projects (id, user_id, company_id, name, description, project_code, project_type, client_name, budget, start_date, end_date, status, created_at, updated_at) VALUES
  (p_webdev,    v_su, v_sc, 'Webshop fejlesztés',   'Új e-commerce platform kiépítése',        'PRJ-001', 'internal',  NULL,              5000000,  '2026-01-15', '2026-06-30', 'active',    '2026-01-10'::timestamptz, now()),
  (p_marketing, v_su, v_sc, 'Marketing kampány Q1',  'Online és offline marketing kampány',       'PRJ-002', 'client',    'MegaCorp Kft.',   2500000,  '2026-01-01', '2026-03-31', 'completed', '2026-01-05'::timestamptz, now()),
  (p_iroda,     v_su, v_sc, 'Irodabővítés',          'Új iroda kialakítása és berendezése',      'PRJ-003', 'internal',  NULL,              8000000,  '2026-02-01', '2026-04-30', 'completed', '2026-02-01'::timestamptz, now()),
  (p_iso,       v_su, v_sc, 'ISO 9001 tanúsítás',   'Minőségirányítási rendszer bevezetése',    'PRJ-004', 'internal',  NULL,              1500000,  '2026-03-01', '2026-09-30', 'active',    '2026-03-01'::timestamptz, now()),
  (p_export,    v_su, v_sc, 'Export pályázat',       'EU export támogatási pályázat',            'PRJ-005', 'client',    'EuroTrade Zrt.',  3000000,  '2026-04-01', '2026-12-31', 'active',    '2026-04-01'::timestamptz, now());

RAISE NOTICE '✅ 5 projekt létrehozva';

-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║  PHASE 4: PARTNERTÖRZS (30 db)                                    ║
-- ╚══════════════════════════════════════════════════════════════════════╝

RAISE NOTICE '═══ PHASE 4: PARTNEREK ═══';

INSERT INTO partners (id, user_id, company_id, name, tax_number, partner_type, address, email, default_project_id, created_at, updated_at) VALUES
  -- Szállítók (suppliers)
  (prt_techsol,  v_su, v_sc, 'TechSolution Kft.',       '11223344-2-41', 'supplier', '1052 Budapest, Váci u. 10.',       'info@techsolution.hu',   p_webdev,    '2026-01-05'::timestamptz, now()),
  (prt_offmax,   v_su, v_sc, 'OfficeMax Hungary Kft.',   '22334455-2-42', 'supplier', '1134 Budapest, Róbert K. krt. 64.','rendeles@officemax.hu',   NULL,        '2026-01-05'::timestamptz, now()),
  (prt_mkb,      v_su, v_sc, 'MKB Bank Nyrt.',           '10011922-4-44', 'supplier', '1056 Budapest, Váci u. 38.',       'ugyfel@mkb.hu',          NULL,        '2026-01-05'::timestamptz, now()),
  (prt_telekom,  v_su, v_sc, 'Magyar Telekom Nyrt.',     '10773381-4-44', 'supplier', '1013 Budapest, Krisztina krt. 55.','uzleti@telekom.hu',      NULL,        '2026-01-05'::timestamptz, now()),
  (prt_immo,     v_su, v_sc, 'ImmoCenter Zrt.',          '33445566-2-43', 'supplier', '1062 Budapest, Andrássy út 100.',  'berles@immocenter.hu',   p_iroda,     '2026-01-05'::timestamptz, now()),
  (prt_kreativ,  v_su, v_sc, 'Kreatív Stúdió Bt.',      '44556677-2-41', 'supplier', '1074 Budapest, Dohány u. 22.',     'hello@kreativstudio.hu', p_marketing, '2026-01-05'::timestamptz, now()),
  (prt_biztbp,   v_su, v_sc, 'Generali Biztosító Zrt.',  '10308024-4-44', 'supplier', '1066 Budapest, Teréz krt. 42.',   'ajanlat@generali.hu',    NULL,        '2026-01-05'::timestamptz, now()),
  (prt_delta,    v_su, v_sc, 'Delta Logisztika Kft.',    '55667788-2-42', 'supplier', '2040 Budaörs, Gyár u. 2.',         'fuvar@deltalog.hu',      NULL,        '2026-01-05'::timestamptz, now()),
  (prt_omega,    v_su, v_sc, 'Omega Consulting Kft.',    '66778899-2-43', 'supplier', '1051 Budapest, Sas u. 6.',         'tanacsadas@omega.hu',    p_iso,       '2026-01-05'::timestamptz, now()),
  (prt_alfa,     v_su, v_sc, 'Alfa Karbantartó Kft.',    '77889900-2-41', 'supplier', '1106 Budapest, Maglódi út 8.',     'szerviz@alfakarban.hu',  NULL,        '2026-01-05'::timestamptz, now()),
  -- Additional suppliers
  ('c0000001-0000-0000-0000-000000000011', v_su, v_sc, 'Számalk Zrt.',            '88990011-2-44', 'supplier', '1134 Budapest, Váci út 35.',     'kepzes@szamalk.hu',     p_iso,    '2026-01-10'::timestamptz, now()),
  ('c0000001-0000-0000-0000-000000000012', v_su, v_sc, 'GreenEnergy Kft.',        '99001122-2-42', 'supplier', '1118 Budapest, Ménesi út 12.',   'info@greenenergy.hu',   NULL,     '2026-01-15'::timestamptz, now()),
  ('c0000001-0000-0000-0000-000000000013', v_su, v_sc, 'NetPrint Nyomda Bt.',     '10112233-2-41', 'supplier', '1097 Budapest, Könyves K. krt.', 'rendeles@netprint.hu',  NULL,     '2026-01-15'::timestamptz, now()),
  ('c0000001-0000-0000-0000-000000000014', v_su, v_sc, 'CleanPro Takarítás Kft.', '11223344-2-43', 'supplier', '1036 Budapest, Lajos u. 48.',    'ajanlat@cleanpro.hu',   NULL,     '2026-02-01'::timestamptz, now()),
  ('c0000001-0000-0000-0000-000000000015', v_su, v_sc, 'DataGuard Security Kft.', '12334455-2-41', 'supplier', '1138 Budapest, Népfürdő u. 22.', 'info@dataguard.hu',     NULL,     '2026-02-01'::timestamptz, now()),
  -- Vevők (customers)
  ('c0000001-0000-0000-0000-000000000016', v_su, v_sc, 'MegaCorp Kft.',           '21334455-2-42', 'customer', '1054 Budapest, Szabadság tér 7.','eladas@megacorp.hu',     p_marketing, '2026-01-05'::timestamptz, now()),
  ('c0000001-0000-0000-0000-000000000017', v_su, v_sc, 'StarBuild Építő Zrt.',    '22445566-2-43', 'customer', '2100 Gödöllő, Szabadság tér 1.','szerzodes@starbuild.hu', NULL,        '2026-01-05'::timestamptz, now()),
  ('c0000001-0000-0000-0000-000000000018', v_su, v_sc, 'EuroTrade Zrt.',          '23556677-2-44', 'customer', '9021 Győr, Baross G. út 6.',    'info@eurotrade.hu',      p_export,    '2026-01-05'::timestamptz, now()),
  ('c0000001-0000-0000-0000-000000000019', v_su, v_sc, 'HungaroFarm Kft.',        '24667788-2-41', 'customer', '6000 Kecskemét, Petőfi S. u. 4.','rendeles@hungarofarm.hu',NULL,       '2026-01-10'::timestamptz, now()),
  ('c0000001-0000-0000-0000-000000000020', v_su, v_sc, 'NovaTech Solutions Kft.', '25778899-2-42', 'customer', '4032 Debrecen, Egyetem tér 1.', 'info@novatech.hu',       p_webdev,    '2026-01-15'::timestamptz, now()),
  ('c0000001-0000-0000-0000-000000000021', v_su, v_sc, 'PannonWood Kft.',         '26889900-2-43', 'customer', '8200 Veszprém, Kossuth L. u. 3.','rendeles@pannonwood.hu',NULL,       '2026-02-01'::timestamptz, now()),
  ('c0000001-0000-0000-0000-000000000022', v_su, v_sc, 'SkyMedia Group Zrt.',     '27990011-2-44', 'customer', '1132 Budapest, Visegrádi u. 47.','media@skygroup.hu',     p_marketing, '2026-02-01'::timestamptz, now()),
  ('c0000001-0000-0000-0000-000000000023', v_su, v_sc, 'AutoParts Hungary Kft.',  '28001122-2-41', 'customer', '2330 Dunaharaszti, Ipari park 5.','info@autoparts.hu',    NULL,        '2026-02-15'::timestamptz, now()),
  ('c0000001-0000-0000-0000-000000000024', v_su, v_sc, 'HealthCare Plus Kft.',    '29112233-2-42', 'customer', '7621 Pécs, Király u. 19.',       'eladas@healthcare.hu',  NULL,        '2026-03-01'::timestamptz, now()),
  ('c0000001-0000-0000-0000-000000000025', v_su, v_sc, 'BudapestDesign Bt.',      '30223344-2-41', 'customer', '1061 Budapest, Liszt F. tér 8.', 'info@bpdesign.hu',      p_webdev,    '2026-03-01'::timestamptz, now()),
  -- Mixed
  ('c0000001-0000-0000-0000-000000000026', v_su, v_sc, 'DunaTransport Kft.',      '31334455-2-42', 'both',     '1095 Budapest, Mester u. 50.',  'info@dunatransport.hu', NULL,        '2026-03-15'::timestamptz, now()),
  ('c0000001-0000-0000-0000-000000000027', v_su, v_sc, 'ProService Kft.',         '32445566-2-43', 'both',     '1113 Budapest, Bartók B. út 10.','hello@proservice.hu',  NULL,        '2026-03-15'::timestamptz, now()),
  ('c0000001-0000-0000-0000-000000000028', v_su, v_sc, 'EliteConsulting Kft.',     '33556677-2-41', 'both',     '1024 Budapest, Keleti K. u. 5.','info@eliteconsult.hu',  p_iso,       '2026-04-01'::timestamptz, now()),
  ('c0000001-0000-0000-0000-000000000029', v_su, v_sc, 'SmartOffice Kft.',        '34667788-2-42', 'supplier', '1075 Budapest, Kazinczy u. 14.','rendeles@smartoffice.hu',NULL,       '2026-04-01'::timestamptz, now()),
  ('c0000001-0000-0000-0000-000000000030', v_su, v_sc, 'FreshFood Catering Kft.', '35778899-2-43', 'supplier', '1036 Budapest, Kiskorona u. 7.','rendeles@freshfood.hu', NULL,        '2026-04-15'::timestamptz, now());

RAISE NOTICE '✅ 30 partner létrehozva';

-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║  PHASE 5: TELEPHELYEK + BEÁLLÍTÁSOK                                ║
-- ╚══════════════════════════════════════════════════════════════════════╝

RAISE NOTICE '═══ PHASE 5: TELEPHELY + BEÁLLÍTÁSOK ═══';

INSERT INTO company_locations (id, company_id, name, address, location_type, is_default, created_at, updated_at) VALUES
  (loc_szekh,  v_sc, 'Székhely',      '1234 Budapest, Sandbox utca 1.',   'office',    true,  now(), now()),
  (loc_raktar, v_sc, 'Raktár',        '2040 Budaörs, Gyár utca 15.',     'warehouse', false, now(), now());

INSERT INTO hp_settings (id, company_id, created_by, opening_balance, start_date, created_at, updated_at) VALUES
  (gen_random_uuid(), v_sc, v_su, 250000, '2026-01-01', now(), now());

INSERT INTO company_settings (id, company_id, work_start_time, work_end_time, admin_deadline, monthly_working_hours, created_at, updated_at) VALUES
  (gen_random_uuid(), v_sc, '08:00', '17:00', 5, 176, now(), now());

RAISE NOTICE '✅ Telephelyek és beállítások kész';

-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║  PHASE 6: NAV SZÁMLÁK (200 db, 6 hónap)                           ║
-- ╚══════════════════════════════════════════════════════════════════════╝

RAISE NOTICE '═══ PHASE 6: NAV SZÁMLÁK ═══';

-- Generate 200 NAV invoices across 6 months
-- Mix of INBOUND (70) and OUTBOUND (130)

-- Helper: generate series of NAV invoices
FOR v_i IN 1..130 LOOP
  INSERT INTO nav_invoices (
    id, user_id, company_id, invoice_number, invoice_direction, invoice_operation,
    supplier_name, supplier_tax_number, supplier_address,
    customer_name, customer_tax_number, customer_address,
    invoice_issue_date, invoice_delivery_date,
    invoice_net_amount, invoice_vat_amount, invoice_gross_amount,
    currency, payment_method, payment_date, paid, submitted,
    details_fetched, fetched_at,
    category_id, project_id, supplier_partner_id,
    created_at
  ) VALUES (
    gen_random_uuid(), v_su, v_sc,
    'SBX-OUT-2026-' || lpad(v_i::text, 5, '0'),
    'OUTBOUND', 'CREATE',
    'SANDBOX Kft.', '12345678-2-42', '1234 Budapest, Sandbox utca 1.',
    -- Customer: cycle through partners
    CASE (v_i % 10)
      WHEN 0 THEN 'MegaCorp Kft.'      WHEN 1 THEN 'StarBuild Építő Zrt.'
      WHEN 2 THEN 'EuroTrade Zrt.'      WHEN 3 THEN 'HungaroFarm Kft.'
      WHEN 4 THEN 'NovaTech Solutions Kft.' WHEN 5 THEN 'PannonWood Kft.'
      WHEN 6 THEN 'SkyMedia Group Zrt.' WHEN 7 THEN 'AutoParts Hungary Kft.'
      WHEN 8 THEN 'HealthCare Plus Kft.' ELSE 'BudapestDesign Bt.'
    END,
    CASE (v_i % 10)
      WHEN 0 THEN '21334455-2-42' WHEN 1 THEN '22445566-2-43'
      WHEN 2 THEN '23556677-2-44' WHEN 3 THEN '24667788-2-41'
      WHEN 4 THEN '25778899-2-42' WHEN 5 THEN '26889900-2-43'
      WHEN 6 THEN '27990011-2-44' WHEN 7 THEN '28001122-2-41'
      WHEN 8 THEN '29112233-2-42' ELSE '30223344-2-41'
    END,
    'Budapest',
    ('2026-01-01'::date + ((v_i * 45) % 180 || ' days')::interval)::date,  -- issue date spread over 6 months
    ('2026-01-01'::date + ((v_i * 45) % 180 || ' days')::interval)::date,  -- delivery = issue
    (50000 + (v_i * 7919) % 450000)::numeric,     -- net: 50k-500k range
    ((50000 + (v_i * 7919) % 450000) * 0.27)::numeric,  -- 27% VAT
    ((50000 + (v_i * 7919) % 450000) * 1.27)::numeric,  -- gross
    'HUF', 'TRANSFER',
    CASE WHEN v_i % 3 = 0 THEN ('2026-01-15'::date + ((v_i * 45) % 180 || ' days')::interval)::date ELSE NULL END,
    v_i % 3 = 0,   -- 33% paid
    true,
    true, now(),
    -- Assign category/project to some
    CASE WHEN v_i % 5 = 0 THEN c_tanacsadas WHEN v_i % 5 = 1 THEN c_it WHEN v_i % 5 = 2 THEN c_marketing ELSE NULL END,
    CASE WHEN v_i % 7 = 0 THEN p_webdev WHEN v_i % 7 = 1 THEN p_marketing WHEN v_i % 7 = 2 THEN p_export ELSE NULL END,
    NULL,
    ('2026-01-02'::date + ((v_i * 45) % 180 || ' days')::interval)::timestamptz
  );
END LOOP;

-- INBOUND invoices (70)
FOR v_i IN 1..70 LOOP
  INSERT INTO nav_invoices (
    id, user_id, company_id, invoice_number, invoice_direction, invoice_operation,
    supplier_name, supplier_tax_number, supplier_address,
    customer_name, customer_tax_number, customer_address,
    invoice_issue_date, invoice_delivery_date,
    invoice_net_amount, invoice_vat_amount, invoice_gross_amount,
    currency, payment_method, payment_date, paid, submitted,
    details_fetched, fetched_at,
    category_id, project_id, supplier_partner_id,
    created_at
  ) VALUES (
    gen_random_uuid(), v_su, v_sc,
    'INV-' || CASE (v_i % 10)
      WHEN 0 THEN 'TS'  WHEN 1 THEN 'OM'  WHEN 2 THEN 'MKB'
      WHEN 3 THEN 'TEL' WHEN 4 THEN 'IMM' WHEN 5 THEN 'KRE'
      WHEN 6 THEN 'GEN' WHEN 7 THEN 'DLG' WHEN 8 THEN 'OMG'
      ELSE 'ALF' END || '-2026-' || lpad(v_i::text, 4, '0'),
    'INBOUND', 'CREATE',
    CASE (v_i % 10)
      WHEN 0 THEN 'TechSolution Kft.'       WHEN 1 THEN 'OfficeMax Hungary Kft.'
      WHEN 2 THEN 'MKB Bank Nyrt.'          WHEN 3 THEN 'Magyar Telekom Nyrt.'
      WHEN 4 THEN 'ImmoCenter Zrt.'         WHEN 5 THEN 'Kreatív Stúdió Bt.'
      WHEN 6 THEN 'Generali Biztosító Zrt.' WHEN 7 THEN 'Delta Logisztika Kft.'
      WHEN 8 THEN 'Omega Consulting Kft.'   ELSE 'Alfa Karbantartó Kft.'
    END,
    CASE (v_i % 10)
      WHEN 0 THEN '11223344-2-41' WHEN 1 THEN '22334455-2-42'
      WHEN 2 THEN '10011922-4-44' WHEN 3 THEN '10773381-4-44'
      WHEN 4 THEN '33445566-2-43' WHEN 5 THEN '44556677-2-41'
      WHEN 6 THEN '10308024-4-44' WHEN 7 THEN '55667788-2-42'
      WHEN 8 THEN '66778899-2-43' ELSE '77889900-2-41'
    END,
    'Budapest',
    'SANDBOX Kft.', '12345678-2-42', '1234 Budapest, Sandbox utca 1.',
    ('2026-01-05'::date + ((v_i * 50) % 175 || ' days')::interval)::date,
    ('2026-01-05'::date + ((v_i * 50) % 175 || ' days')::interval)::date,
    (20000 + (v_i * 6151) % 280000)::numeric,
    ((20000 + (v_i * 6151) % 280000) * 0.27)::numeric,
    ((20000 + (v_i * 6151) % 280000) * 1.27)::numeric,
    'HUF', 'TRANSFER',
    CASE WHEN v_i % 4 = 0 THEN ('2026-01-20'::date + ((v_i * 50) % 175 || ' days')::interval)::date ELSE NULL END,
    v_i % 4 = 0,
    true,
    true, now(),
    -- Categories: all inbound get a category
    CASE (v_i % 8)
      WHEN 0 THEN c_it          WHEN 1 THEN c_irodaszer
      WHEN 2 THEN c_bankkoltseg WHEN 3 THEN c_kozuzemi
      WHEN 4 THEN c_berleti     WHEN 5 THEN c_marketing
      WHEN 6 THEN c_biztositas  ELSE c_karbantartas
    END,
    CASE WHEN v_i % 5 = 0 THEN p_webdev WHEN v_i % 5 = 1 THEN p_iroda WHEN v_i % 5 = 2 THEN p_iso ELSE NULL END,
    CASE (v_i % 10)
      WHEN 0 THEN prt_techsol  WHEN 1 THEN prt_offmax
      WHEN 2 THEN prt_mkb      WHEN 3 THEN prt_telekom
      WHEN 4 THEN prt_immo     WHEN 5 THEN prt_kreativ
      WHEN 6 THEN prt_biztbp   WHEN 7 THEN prt_delta
      WHEN 8 THEN prt_omega    ELSE prt_alfa
    END,
    ('2026-01-06'::date + ((v_i * 50) % 175 || ' days')::interval)::timestamptz
  );
END LOOP;

-- Add invoice items to all NAV invoices (1-3 items each)
INSERT INTO nav_invoice_items (id, nav_invoice_id, line_number, line_description, quantity, unit_of_measure, unit_price, net_amount, vat_rate, vat_amount, gross_amount, created_at)
SELECT
  gen_random_uuid(),
  ni.id,
  1,
  CASE (ROW_NUMBER() OVER (ORDER BY ni.created_at) % 8)
    WHEN 0 THEN 'Szolgáltatási díj' WHEN 1 THEN 'Irodaszer csomag'
    WHEN 2 THEN 'IT support havi díj' WHEN 3 THEN 'Bérleti díj'
    WHEN 4 THEN 'Szállítási költség' WHEN 5 THEN 'Marketing szolgáltatás'
    WHEN 6 THEN 'Tanácsadási díj' ELSE 'Karbantartási díj'
  END,
  1, 'db',
  ni.invoice_net_amount,
  ni.invoice_net_amount,
  '27%', ni.invoice_vat_amount, ni.invoice_gross_amount,
  ni.created_at
FROM nav_invoices ni WHERE ni.company_id = v_sc;

-- Add a second line item to ~30% of invoices
INSERT INTO nav_invoice_items (id, nav_invoice_id, line_number, line_description, quantity, unit_of_measure, unit_price, net_amount, vat_rate, vat_amount, gross_amount, created_at)
SELECT
  gen_random_uuid(),
  ni.id,
  2,
  'Kiegészítő tétel',
  2, 'db',
  5000,
  10000, '27%', 2700, 12700,
  ni.created_at
FROM nav_invoices ni WHERE ni.company_id = v_sc
AND (EXTRACT(DAY FROM ni.invoice_issue_date)::int % 3) = 0;

GET DIAGNOSTICS v_cnt = ROW_COUNT;
RAISE NOTICE '✅ 200 NAV számla + % tételsor létrehozva', v_cnt;

-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║  PHASE 7: FELTÖLTÖTT SZÁMLÁK (50 db)                              ║
-- ╚══════════════════════════════════════════════════════════════════════╝

RAISE NOTICE '═══ PHASE 7: UPLOAD SZÁMLÁK ═══';

-- Invoice uploads first
FOR v_i IN 1..20 LOOP
  INSERT INTO invoice_uploads (id, user_id, company_id, file_name, file_size, file_type, file_url, upload_status, processing_status, created_at, updated_at) VALUES
    (('f1000001-0000-0000-0000-' || lpad(v_i::text, 12, '0'))::uuid,
     v_su, v_sc,
     'szamla_' || v_i || '.pdf',
     (50000 + v_i * 3000),
     'application/pdf',
     'uploads/sandbox/' || v_i || '.pdf',
     'completed', 'completed',
     ('2026-01-10'::date + ((v_i * 9) || ' days')::interval)::timestamptz,
     now());
END LOOP;

-- Invoices (50 uploaded + OCR processed)
FOR v_i IN 1..50 LOOP
  INSERT INTO invoices (
    id, user_id, company_id, bizonylatsorszam, kibocsatas_datuma,
    elado_nev, elado_cim, elado_vat_id,
    vevo_nev, vevo_cim, vevo_vat_id,
    adoalap_osszesen, afa_osszeg_osszesen, brutto_vegosszeg,
    fizetendo_osszeg, fizetesi_hatarido, fizetesi_mod,
    penznem, fizetve, statusz,
    category_id, project_id,
    invoice_uploads_id,
    invoice_direction, invoice_type,
    teljesites_datuma,
    feldolgozva,
    letrehozva, frissitve
  ) VALUES (
    ('f2000001-0000-0000-0000-' || lpad(v_i::text, 12, '0'))::uuid,
    v_su, v_sc,
    'UPL-2026-' || lpad(v_i::text, 5, '0'),
    ('2026-01-10'::date + ((v_i * 35) % 170 || ' days')::interval)::date,
    -- Supplier info
    CASE (v_i % 10)
      WHEN 0 THEN 'TechSolution Kft.' WHEN 1 THEN 'OfficeMax Hungary Kft.'
      WHEN 2 THEN 'Magyar Telekom Nyrt.' WHEN 3 THEN 'ImmoCenter Zrt.'
      WHEN 4 THEN 'Kreatív Stúdió Bt.' WHEN 5 THEN 'Delta Logisztika Kft.'
      WHEN 6 THEN 'Omega Consulting Kft.' WHEN 7 THEN 'GreenEnergy Kft.'
      WHEN 8 THEN 'NetPrint Nyomda Bt.' ELSE 'CleanPro Takarítás Kft.'
    END,
    'Budapest', '12345678-2-42',
    'SANDBOX Kft.', '1234 Budapest, Sandbox utca 1.', '12345678-2-42',
    (30000 + (v_i * 5113) % 350000)::numeric,
    ((30000 + (v_i * 5113) % 350000) * 0.27)::numeric,
    ((30000 + (v_i * 5113) % 350000) * 1.27)::numeric,
    ((30000 + (v_i * 5113) % 350000) * 1.27)::numeric,
    ('2026-01-25'::date + ((v_i * 35) % 170 || ' days')::interval)::date,
    CASE WHEN v_i % 3 = 0 THEN 'átutalás' ELSE 'készpénz' END,
    'HUF',
    v_i % 4 = 0,   -- 25% paid
    'feldolgozott',
    -- Category
    CASE (v_i % 7)
      WHEN 0 THEN c_it WHEN 1 THEN c_irodaszer WHEN 2 THEN c_kozuzemi
      WHEN 3 THEN c_berleti WHEN 4 THEN c_marketing WHEN 5 THEN c_tanacsadas
      ELSE c_szallitas
    END,
    -- Project
    CASE WHEN v_i % 6 = 0 THEN p_webdev WHEN v_i % 6 = 1 THEN p_iroda WHEN v_i % 6 = 2 THEN p_iso ELSE NULL END,
    -- Upload reference (cycle through 20 uploads)
    ('f1000001-0000-0000-0000-' || lpad(((v_i % 20) + 1)::text, 12, '0'))::uuid,
    'INBOUND', 'sima_szla',
    ('2026-01-10'::date + ((v_i * 35) % 170 || ' days')::interval)::date,
    true,
    ('2026-01-12'::date + ((v_i * 35) % 170 || ' days')::interval)::timestamptz,
    now()
  );

  -- Add invoice items
  INSERT INTO invoice_items (id, invoice_id, line_number, line_description, quantity, unit_of_measure, unit_price, net_amount, vat_rate, vat_amount, gross_amount, created_at) VALUES
    (gen_random_uuid(),
     ('f2000001-0000-0000-0000-' || lpad(v_i::text, 12, '0'))::uuid,
     1,
     CASE (v_i % 6)
       WHEN 0 THEN 'IT fejlesztés' WHEN 1 THEN 'Irodaszer csomag'
       WHEN 2 THEN 'Villanyszámla' WHEN 3 THEN 'Havi bérleti díj'
       WHEN 4 THEN 'Online hirdetés' ELSE 'Konzultációs díj'
     END,
     1, 'db',
     (30000 + (v_i * 5113) % 350000)::numeric,
     (30000 + (v_i * 5113) % 350000)::numeric,
     '27%',
     ((30000 + (v_i * 5113) % 350000) * 0.27)::numeric,
     ((30000 + (v_i * 5113) % 350000) * 1.27)::numeric,
     now());
END LOOP;

RAISE NOTICE '✅ 50 feltöltött számla + tételek kész';

-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║  PHASE 8: TRANZAKCIÓK (200 db)                                    ║
-- ╚══════════════════════════════════════════════════════════════════════╝

RAISE NOTICE '═══ PHASE 8: TRANZAKCIÓK ═══';

-- Transaction upload
INSERT INTO transaction_uploads (id, company_id, user_id, file_name, file_url, file_type, file_size, upload_status, processing_status, created_at, updated_at) VALUES
  ('f3000001-0000-0000-0000-000000000001', v_sc, v_su, 'bankszamlakivonat_2026_q1.csv', 'uploads/tx/q1.csv', 'text/csv', 125000, 'completed', 'completed', '2026-02-01'::timestamptz, now()),
  ('f3000001-0000-0000-0000-000000000002', v_sc, v_su, 'bankszamlakivonat_2026_q2.csv', 'uploads/tx/q2.csv', 'text/csv', 98000,  'completed', 'completed', '2026-05-01'::timestamptz, now());

-- Supplier transactions (120)
FOR v_i IN 1..120 LOOP
  INSERT INTO transactions (id, company_id, amount, currency, description, transaction_date, type, match_type, confidence_score, reason, is_verified, upload_id, created_at) VALUES
    (('f4000001-0000-0000-0000-' || lpad(v_i::text, 12, '0'))::uuid,
     v_sc,
     -(25000 + (v_i * 4397) % 300000)::numeric,  -- negative = outgoing
     'HUF',
     CASE (v_i % 10)
       WHEN 0 THEN 'TechSolution Kft. - szla kifizetés'
       WHEN 1 THEN 'OfficeMax - irodaszer'
       WHEN 2 THEN 'MKB Bank - havi díj'
       WHEN 3 THEN 'Telekom - telefon+internet'
       WHEN 4 THEN 'ImmoCenter - bérleti díj'
       WHEN 5 THEN 'Kreatív Stúdió - design munka'
       WHEN 6 THEN 'Generali - biztosítás'
       WHEN 7 THEN 'Delta Log - szállítás'
       WHEN 8 THEN 'Omega Consulting - tanácsadás'
       ELSE 'Alfa Karbantartó - szerviz'
     END,
     ('2026-01-05'::date + ((v_i * 46) % 178 || ' days')::interval)::date,
     'szállítói tranzakció',
     CASE WHEN v_i % 5 = 0 THEN 'auto' ELSE 'manual' END,
     CASE WHEN v_i % 5 = 0 THEN 0.92 ELSE 0.85 END,
     'Szállítói kifizetés',
     v_i % 3 = 0,  -- 33% verified
     CASE WHEN v_i <= 60 THEN 'f3000001-0000-0000-0000-000000000001'::uuid ELSE 'f3000001-0000-0000-0000-000000000002'::uuid END,
     ('2026-01-06'::date + ((v_i * 46) % 178 || ' days')::interval)::timestamptz);
END LOOP;

-- Customer transactions (incoming, 30)
FOR v_i IN 1..30 LOOP
  INSERT INTO transactions (id, company_id, amount, currency, description, transaction_date, type, match_type, confidence_score, reason, is_verified, created_at) VALUES
    (('f4000001-0000-0000-0001-' || lpad(v_i::text, 12, '0'))::uuid,
     v_sc,
     (80000 + (v_i * 13337) % 500000)::numeric,  -- positive = incoming
     'HUF',
     CASE (v_i % 5)
       WHEN 0 THEN 'MegaCorp - szla kiegyenlítés'
       WHEN 1 THEN 'EuroTrade - export szla'
       WHEN 2 THEN 'NovaTech - projekt díj'
       WHEN 3 THEN 'SkyMedia - reklám díj'
       ELSE 'HungaroFarm - szállítmány'
     END,
     ('2026-01-10'::date + ((v_i * 55) % 175 || ' days')::interval)::date,
     'vevői tranzakció',
     'auto', 0.95, 'Vevői befizetés',
     true,
     ('2026-01-11'::date + ((v_i * 55) % 175 || ' days')::interval)::timestamptz);
END LOOP;

-- Bank fees (24 — monthly)
FOR v_i IN 1..24 LOOP
  INSERT INTO transactions (id, company_id, amount, currency, description, transaction_date, type, is_verified, created_at) VALUES
    (('f4000001-0000-0000-0002-' || lpad(v_i::text, 12, '0'))::uuid,
     v_sc, -(1500 + (v_i * 200))::numeric, 'HUF',
     'MKB Bank - havi számlavezetési díj',
     ('2026-01-01'::date + ((v_i - 1) * 7 || ' days')::interval)::date,
     'bankköltség', true,
     ('2026-01-02'::date + ((v_i - 1) * 7 || ' days')::interval)::timestamptz);
END LOOP;

-- Salary payments (6 — monthly)
FOR v_i IN 1..6 LOOP
  INSERT INTO transactions (id, company_id, amount, currency, description, transaction_date, type, is_verified, created_at) VALUES
    (('f4000001-0000-0000-0003-' || lpad(v_i::text, 12, '0'))::uuid,
     v_sc, -2850000, 'HUF',
     'Bérfizetés - ' || v_i || '. hó',
     ('2026-01-10'::date + ((v_i - 1) * 30 || ' days')::interval)::date,
     'bérek', true,
     ('2026-01-11'::date + ((v_i - 1) * 30 || ' days')::interval)::timestamptz);
END LOOP;

-- Tax payments (12)
FOR v_i IN 1..12 LOOP
  INSERT INTO transactions (id, company_id, amount, currency, description, transaction_date, type, is_verified, created_at) VALUES
    (('f4000001-0000-0000-0004-' || lpad(v_i::text, 12, '0'))::uuid,
     v_sc, -(150000 + (v_i * 25000))::numeric, 'HUF',
     CASE (v_i % 4)
       WHEN 0 THEN 'NAV - ÁFA befizetés' WHEN 1 THEN 'NAV - SZJA előleg'
       WHEN 2 THEN 'NAV - SZOCHO' ELSE 'NAV - Iparűzési adó'
     END,
     ('2026-01-12'::date + ((v_i - 1) * 15 || ' days')::interval)::date,
     'járulékok/adók', true,
     ('2026-01-13'::date + ((v_i - 1) * 15 || ' days')::interval)::timestamptz);
END LOOP;

-- ATM (8)
FOR v_i IN 1..8 LOOP
  INSERT INTO transactions (id, company_id, amount, currency, description, transaction_date, type, is_verified, created_at) VALUES
    (('f4000001-0000-0000-0005-' || lpad(v_i::text, 12, '0'))::uuid,
     v_sc, -(50000 + (v_i * 20000))::numeric, 'HUF',
     'ATM készpénzfelvét - ' || CASE (v_i % 3) WHEN 0 THEN 'Váci út' WHEN 1 THEN 'Westend' ELSE 'Mammut' END,
     ('2026-01-15'::date + ((v_i - 1) * 22 || ' days')::interval)::date,
     'atm készpénzfelvét', false,
     ('2026-01-16'::date + ((v_i - 1) * 22 || ' days')::interval)::timestamptz);
END LOOP;

RAISE NOTICE '✅ 200 tranzakció létrehozva';

-- ── Match some transactions to invoices ──
-- Match ~80 supplier transactions to NAV invoices
UPDATE transactions t
SET matched_invoice_id = (
  SELECT ni.id FROM nav_invoices ni
  WHERE ni.company_id = v_sc
    AND ni.invoice_direction = 'INBOUND'
    AND ABS(ni.invoice_gross_amount + t.amount) < 1000  -- close match
  ORDER BY ABS(ni.invoice_gross_amount + t.amount)
  LIMIT 1
)
WHERE t.company_id = v_sc
  AND t.type = 'szállítói tranzakció'
  AND t.matched_invoice_id IS NULL
  AND EXISTS (
    SELECT 1 FROM nav_invoices ni
    WHERE ni.company_id = v_sc AND ni.invoice_direction = 'INBOUND'
      AND ABS(ni.invoice_gross_amount + t.amount) < 1000
  );

GET DIAGNOSTICS v_cnt = ROW_COUNT;
RAISE NOTICE '✅ % tranzakció-számla párosítás', v_cnt;

-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║  PHASE 9: BÉREK + BÉRFÁJLOK                                       ║
-- ╚══════════════════════════════════════════════════════════════════════╝

RAISE NOTICE '═══ PHASE 9: BÉREK ═══';

-- Salary files (6 hónapra)
FOR v_i IN 1..6 LOOP
  INSERT INTO salary_files (id, user_id, company_id, recipient_name, description, amount_to_transfer, payment_type, source, status, period_year, period_month, created_at, updated_at) VALUES
    (('f5000001-0000-0000-0000-' || lpad(v_i::text, 12, '0'))::uuid,
     v_su, v_sc,
     'SANDBOX Kft. - dolgozók',
     '2026/' || v_i || '. hó bérjegyzék',
     2850000, 'salary', 'automated', 'completed',
     2026, v_i,
     ('2026-01-08'::date + ((v_i - 1) * 30 || ' days')::interval)::timestamptz, now());
END LOOP;

-- Individual salary records (5 employee × 6 months = 30)
FOR v_i IN 1..30 LOOP
  INSERT INTO salary (id, user_id, company_id, név, munkavallalo_neve, összeg, tipus, fizetesi_mod, statusz, dátum, megjegyzes,
    salary_file_id, created_at, updated_at) VALUES
    (gen_random_uuid(), v_su, v_sc,
     CASE (v_i % 5) WHEN 0 THEN 'Nettó bér' WHEN 1 THEN 'Nettó bér' WHEN 2 THEN 'Nettó bér' WHEN 3 THEN 'Nettó bér' ELSE 'Nettó bér' END,
     CASE (v_i % 5)
       WHEN 0 THEN 'Kovács Anna'   WHEN 1 THEN 'Nagy Péter'
       WHEN 2 THEN 'Szabó Mária'   WHEN 3 THEN 'Tóth László'
       ELSE 'Horváth Katalin'
     END,
     CASE (v_i % 5)
       WHEN 0 THEN 485000 WHEN 1 THEN 620000 WHEN 2 THEN 415000
       WHEN 3 THEN 550000 ELSE 380000
     END,
     'nettó_bér', 'átutalás', 'feldolgozott',
     ('2026-01-10'::date + ((((v_i - 1) / 5)) * 30 || ' days')::interval)::date,
     '2026/' || (((v_i - 1) / 5) + 1) || '. hó',
     ('f5000001-0000-0000-0000-' || lpad((((v_i - 1) / 5) + 1)::text, 12, '0'))::uuid,
     ('2026-01-08'::date + ((((v_i - 1) / 5)) * 30 || ' days')::interval)::timestamptz, now());
END LOOP;

RAISE NOTICE '✅ 30 bérjegyzék kész';

-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║  PHASE 10: ADÓ REKORDOK                                           ║
-- ╚══════════════════════════════════════════════════════════════════════╝

RAISE NOTICE '═══ PHASE 10: ADÓK ═══';

INSERT INTO tax (id, user_id, company_id, adonem, osszeg, datum, created_at, updated_at) VALUES
  (gen_random_uuid(), v_su, v_sc, 'ÁFA',              2450000,  '2026-01-20', now(), now()),
  (gen_random_uuid(), v_su, v_sc, 'ÁFA',              2780000,  '2026-02-20', now(), now()),
  (gen_random_uuid(), v_su, v_sc, 'ÁFA',              3100000,  '2026-03-20', now(), now()),
  (gen_random_uuid(), v_su, v_sc, 'ÁFA',              2950000,  '2026-04-20', now(), now()),
  (gen_random_uuid(), v_su, v_sc, 'ÁFA',              3200000,  '2026-05-20', now(), now()),
  (gen_random_uuid(), v_su, v_sc, 'ÁFA',              2890000,  '2026-06-20', now(), now()),
  (gen_random_uuid(), v_su, v_sc, 'Társasági adó',     1500000,  '2026-03-31', now(), now()),
  (gen_random_uuid(), v_su, v_sc, 'Iparűzési adó',     850000,  '2026-03-15', now(), now()),
  (gen_random_uuid(), v_su, v_sc, 'Iparűzési adó',     850000,  '2026-06-15', now(), now()),
  (gen_random_uuid(), v_su, v_sc, 'SZJA előleg',       1800000,  '2026-02-12', now(), now()),
  (gen_random_uuid(), v_su, v_sc, 'SZJA előleg',       1800000,  '2026-05-12', now(), now()),
  (gen_random_uuid(), v_su, v_sc, 'Szociális hozzájárulási adó', 950000, '2026-04-12', now(), now());

RAISE NOTICE '✅ 12 adó rekord kész';

-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║  PHASE 11: FŐKÖNYV (Számlatükör + GL számlák)                     ║
-- ╚══════════════════════════════════════════════════════════════════════╝

RAISE NOTICE '═══ PHASE 11: FŐKÖNYV ═══';

-- Copy the GL structure from Taxology (source) to SANDBOX
-- First create the preset
INSERT INTO chart_of_accounts_presets (id, company_id, type, name, is_active, created_at, updated_at) VALUES
  (gl_preset, v_sc, 'custom', 'Egyéni számlatükör', true, now(), now());

-- Copy all GL accounts from Taxology, remapping IDs
CREATE TEMP TABLE _gl_map (old_id UUID, new_id UUID) ON COMMIT DROP;
INSERT INTO _gl_map SELECT id, gen_random_uuid() FROM gl_accounts WHERE preset_id = 'ddeb3691-caf9-44d0-964c-2246ff2f400e';

INSERT INTO gl_accounts (id, preset_id, company_id, gl_number, short_name, description, parent_id, created_at, updated_at)
  SELECT gm.new_id, gl_preset, v_sc, ga.gl_number, ga.short_name, ga.description, NULL, ga.created_at, ga.updated_at
  FROM gl_accounts ga JOIN _gl_map gm ON gm.old_id = ga.id
  WHERE ga.preset_id = 'ddeb3691-caf9-44d0-964c-2246ff2f400e';

-- Set parent_id references
UPDATE gl_accounts g SET parent_id = gm_parent.new_id
  FROM _gl_map gm_self
  JOIN gl_accounts orig ON orig.id = gm_self.old_id
  JOIN _gl_map gm_parent ON gm_parent.old_id = orig.parent_id
  WHERE g.id = gm_self.new_id AND orig.parent_id IS NOT NULL;

GET DIAGNOSTICS v_cnt = ROW_COUNT;
RAISE NOTICE '✅ GL számlatükör másolva (% szülő hivatkozás)', v_cnt;

-- BS Mapping — copy from Taxology
INSERT INTO bs_mapping (id, company_id, preset_id, gl_account_id, bs_structure_id, user_id, created_at, updated_at)
  SELECT gen_random_uuid(), v_sc, gl_preset, gm.new_id, bsm.bs_structure_id, v_su, now(), now()
  FROM bs_mapping bsm
  JOIN _gl_map gm ON gm.old_id = bsm.gl_account_id
  WHERE bsm.company_id = '377d28cb-edc9-48a7-b261-bcd9c91d81a1';

GET DIAGNOSTICS v_cnt = ROW_COUNT;
RAISE NOTICE '✅ BS mapping: % sor', v_cnt;

-- PnL Mapping — copy from Taxology
INSERT INTO pnl_mapping (id, company_id, preset_id, gl_account_id, pnl_structure_id, user_id, created_at, updated_at)
  SELECT gen_random_uuid(), v_sc, gl_preset, gm.new_id, pm.pnl_structure_id, v_su, now(), now()
  FROM pnl_mapping pm
  JOIN _gl_map gm ON gm.old_id = pm.gl_account_id
  WHERE pm.company_id = '377d28cb-edc9-48a7-b261-bcd9c91d81a1';

GET DIAGNOSTICS v_cnt = ROW_COUNT;
RAISE NOTICE '✅ PnL mapping: % sor', v_cnt;

-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║  PHASE 12: ÁFA BEVALLÁS (6 havi)                                  ║
-- ╚══════════════════════════════════════════════════════════════════════╝

RAISE NOTICE '═══ PHASE 12: ÁFA BEVALLÁS ═══';

FOR v_i IN 1..6 LOOP
  INSERT INTO vat_returns (id, company_id, user_id, period_year, period_month, frequency, status,
    total_payable_base, total_payable_tax, total_deductible_base, total_deductible_tax,
    net_result, amount_to_pay, created_at, updated_at) VALUES
    (('f6000001-0000-0000-0000-' || lpad(v_i::text, 12, '0'))::uuid,
     v_sc, v_su, 2026, v_i, 'monthly',
     CASE WHEN v_i <= 4 THEN 'finalized' WHEN v_i = 5 THEN 'draft' ELSE 'draft' END,
     (8000000 + v_i * 500000)::numeric,
     ((8000000 + v_i * 500000) * 0.27)::numeric,
     (5000000 + v_i * 300000)::numeric,
     ((5000000 + v_i * 300000) * 0.27)::numeric,
     ((8000000 + v_i * 500000 - 5000000 - v_i * 300000) * 0.27)::numeric,
     ((8000000 + v_i * 500000 - 5000000 - v_i * 300000) * 0.27)::numeric,
     ('2026-01-20'::date + ((v_i - 1) * 30 || ' days')::interval)::timestamptz, now());

  -- Add a few return lines per period
  INSERT INTO vat_return_lines (id, vat_return_id, row_number, base_amount, tax_amount, base_amount_rounded, tax_amount_rounded, is_calculated) VALUES
    (gen_random_uuid(), ('f6000001-0000-0000-0000-' || lpad(v_i::text, 12, '0'))::uuid, '01', (8000000 + v_i * 500000)::numeric, ((8000000 + v_i * 500000) * 0.27)::numeric, (8000000 + v_i * 500000)::int, ((8000000 + v_i * 500000) * 0.27)::int, true),
    (gen_random_uuid(), ('f6000001-0000-0000-0000-' || lpad(v_i::text, 12, '0'))::uuid, '06', (5000000 + v_i * 300000)::numeric, ((5000000 + v_i * 300000) * 0.27)::numeric, (5000000 + v_i * 300000)::int, ((5000000 + v_i * 300000) * 0.27)::int, true),
    (gen_random_uuid(), ('f6000001-0000-0000-0000-' || lpad(v_i::text, 12, '0'))::uuid, '65', ((8000000 + v_i * 500000 - 5000000 - v_i * 300000) * 0.27)::numeric, 0, ((8000000 + v_i * 500000 - 5000000 - v_i * 300000) * 0.27)::int, 0, true);
END LOOP;

RAISE NOTICE '✅ 6 ÁFA bevallás kész';

-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║  PHASE 13: TÁRGYI ESZKÖZÖK (8 db)                                 ║
-- ╚══════════════════════════════════════════════════════════════════════╝

RAISE NOTICE '═══ PHASE 13: TÁRGYI ESZKÖZÖK ═══';

INSERT INTO fixed_assets (id, company_id, user_id, inventory_number, name, description,
  acquisition_value, residual_value, currency, purchase_date, activation_date,
  useful_life_months, depreciation_method, location_id,
  activated_by_user_id, activated_by_name,
  supplier_name, status, created_at, updated_at) VALUES
  (gen_random_uuid(), v_sc, v_su, 'TE-001', 'MacBook Pro 16" M4',        'Fejlesztői laptop',           899000,  0,      'HUF', '2026-01-15', '2026-01-20', 36,  'straight_line', loc_szekh,  v_su, 'Sandbox', 'TechSolution Kft.',       'active', '2026-01-15'::timestamptz, now()),
  (gen_random_uuid(), v_sc, v_su, 'TE-002', 'Dell Monitor U2723QE',      '4K monitor',                  285000,  0,      'HUF', '2026-01-15', '2026-01-20', 36,  'straight_line', loc_szekh,  v_su, 'Sandbox', 'TechSolution Kft.',       'active', '2026-01-15'::timestamptz, now()),
  (gen_random_uuid(), v_sc, v_su, 'TE-003', 'Irodai bútor garnitúra',    '6 fős open office berendezés',1250000, 50000,  'HUF', '2026-02-10', '2026-02-15', 60,  'straight_line', loc_szekh,  v_su, 'Sandbox', 'SmartOffice Kft.',        'active', '2026-02-10'::timestamptz, now()),
  (gen_random_uuid(), v_sc, v_su, 'TE-004', 'Samsung Galaxy S24 Ultra',  'Céges telefon (ügyvezető)',   549000,  0,      'HUF', '2026-02-20', '2026-02-25', 24,  'straight_line', loc_szekh,  v_su, 'Sandbox', 'Magyar Telekom Nyrt.',    'active', '2026-02-20'::timestamptz, now()),
  (gen_random_uuid(), v_sc, v_su, 'TE-005', 'Toyota Proace City L2',     'Céges kisfurgon',            8500000, 500000, 'HUF', '2026-03-01', '2026-03-05', 60,  'straight_line', loc_raktar, v_su, 'Sandbox', 'Toyota Magyarország Kft.','active', '2026-03-01'::timestamptz, now()),
  (gen_random_uuid(), v_sc, v_su, 'TE-006', 'Klímaberendezés 3 db',     'Split klíma irodához',         720000,  0,      'HUF', '2026-03-15', '2026-03-20', 60,  'straight_line', loc_szekh,  v_su, 'Sandbox', 'Alfa Karbantartó Kft.',   'active', '2026-03-15'::timestamptz, now()),
  (gen_random_uuid(), v_sc, v_su, 'TE-007', 'HP LaserJet Pro MFP',       'Hálózati nyomtató/szkenner',  245000,  0,      'HUF', '2026-01-20', '2026-01-25', 36,  'straight_line', loc_szekh,  v_su, 'Sandbox', 'OfficeMax Hungary Kft.',  'active', '2026-01-20'::timestamptz, now()),
  (gen_random_uuid(), v_sc, v_su, 'TE-008', 'Raktári polcrendszer',      'Nehézteherbírású polcok',      480000,  20000,  'HUF', '2026-04-01', '2026-04-05', 120, 'straight_line', loc_raktar, v_su, 'Sandbox', 'Delta Logisztika Kft.',   'active', '2026-04-01'::timestamptz, now());

-- Asset events
INSERT INTO asset_events (id, asset_id, company_id, user_id, event_type, event_date, description, created_at)
SELECT gen_random_uuid(), fa.id, v_sc, v_su, 'activation', fa.activation_date, 'Eszköz aktiválva és üzembe helyezve', now()
FROM fixed_assets fa WHERE fa.company_id = v_sc;

RAISE NOTICE '✅ 8 tárgyi eszköz + események kész';

-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║  PHASE 14: MUNKAIDŐ (employee_rates + time_entries)                ║
-- ╚══════════════════════════════════════════════════════════════════════╝

RAISE NOTICE '═══ PHASE 14: MUNKAIDŐ ═══';

INSERT INTO employee_rates (id, company_id, user_id, employee_name, employee_type, base_salary_cost, hourly_rate, effective_date, email, phone, created_at, updated_at) VALUES
  ('f7000001-0000-0000-0000-000000000001', v_sc, v_su, 'Kovács Anna',      'full_time', 650000,  3700, '2026-01-01', 'kovacs.anna@sandbox.hu',    '+36 20 111 2222', now(), now()),
  ('f7000001-0000-0000-0000-000000000002', v_sc, v_su, 'Nagy Péter',       'full_time', 850000,  4800, '2026-01-01', 'nagy.peter@sandbox.hu',     '+36 30 333 4444', now(), now()),
  ('f7000001-0000-0000-0000-000000000003', v_sc, v_su, 'Szabó Mária',      'part_time', 420000,  3200, '2026-01-01', 'szabo.maria@sandbox.hu',    '+36 70 555 6666', now(), now()),
  ('f7000001-0000-0000-0000-000000000004', v_sc, v_su, 'Tóth László',      'full_time', 750000,  4250, '2026-01-01', 'toth.laszlo@sandbox.hu',    '+36 20 777 8888', now(), now());

-- Time entries (random across 5 months, ~100 entries)
FOR v_i IN 1..100 LOOP
  INSERT INTO time_entries (id, company_id, user_id, project_id, date, hours, description, status, created_at, updated_at) VALUES
    (gen_random_uuid(), v_sc, v_su,
     CASE (v_i % 5)
       WHEN 0 THEN p_webdev  WHEN 1 THEN p_marketing WHEN 2 THEN p_iroda
       WHEN 3 THEN p_iso     ELSE p_export
     END,
     ('2026-01-06'::date + ((v_i * 17) % 150 || ' days')::interval)::date,
     CASE WHEN v_i % 4 = 0 THEN 4.0 WHEN v_i % 4 = 1 THEN 8.0 WHEN v_i % 4 = 2 THEN 6.0 ELSE 2.0 END,
     CASE (v_i % 6)
       WHEN 0 THEN 'Frontend fejlesztés' WHEN 1 THEN 'Kampány tervezés'
       WHEN 2 THEN 'Irodarendezés' WHEN 3 THEN 'ISO dokumentáció'
       WHEN 4 THEN 'Pályázati adminisztráció' ELSE 'Megbeszélés'
     END,
     'approved',
     ('2026-01-07'::date + ((v_i * 17) % 150 || ' days')::interval)::timestamptz, now());
END LOOP;

RAISE NOTICE '✅ 4 dolgozó + 100 munkaidő bejegyzés kész';

-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║  PHASE 15: ACCOUNTY — PAYROLL MODUL                                ║
-- ╚══════════════════════════════════════════════════════════════════════╝

RAISE NOTICE '═══ PHASE 15: ACCOUNTY PAYROLL ═══';

-- Enable payroll on tax profile
UPDATE accounty_tax_profiles SET has_payroll = true, payroll_settings = '{"payment_day": 10, "default_weekly_hours": 40}'::jsonb
WHERE company_id = v_sc;

-- Employees (5)
INSERT INTO accounty_employees (id, company_id, first_name, last_name, birth_name, birth_place, birth_date, mothers_name, gender, nationality, taj_number, tax_id, address, email, phone, bank_account, status, created_at, updated_at) VALUES
  ('f8000001-0000-0000-0000-000000000001', v_sc, 'Anna',     'Kovács',   'Kis Anna',      'Budapest',   '1992-05-14', 'Kis Éva',        'female', 'HU', '123-456-789', '8472345678', '{"zip":"1052","city":"Budapest","street":"Váci u. 10.","country":"HU"}'::jsonb, 'kovacs.anna@sandbox.hu',   '+36 20 111 2222', '11773016-12345678-00000000', 'active', now(), now()),
  ('f8000001-0000-0000-0000-000000000002', v_sc, 'Péter',    'Nagy',     NULL,             'Debrecen',   '1988-09-22', 'Varga Mária',    'male',   'HU', '234-567-890', '8473456789', '{"zip":"1134","city":"Budapest","street":"Róbert K. krt. 64.","country":"HU"}'::jsonb, 'nagy.peter@sandbox.hu',    '+36 30 333 4444', '11773016-23456789-00000000', 'active', now(), now()),
  ('f8000001-0000-0000-0000-000000000003', v_sc, 'Mária',    'Szabó',    'Tóth Mária',    'Szeged',     '1995-03-08', 'Tóth Katalin',   'female', 'HU', '345-678-901', '8474567890', '{"zip":"1074","city":"Budapest","street":"Dohány u. 22.","country":"HU"}'::jsonb, 'szabo.maria@sandbox.hu',   '+36 70 555 6666', '11773016-34567890-00000000', 'active', now(), now()),
  ('f8000001-0000-0000-0000-000000000004', v_sc, 'László',   'Tóth',     NULL,             'Győr',       '1985-11-30', 'Fehér Erzsébet', 'male',   'HU', '456-789-012', '8475678901', '{"zip":"1051","city":"Budapest","street":"Sas u. 6.","country":"HU"}'::jsonb, 'toth.laszlo@sandbox.hu',   '+36 20 777 8888', '11773016-45678901-00000000', 'active', now(), now()),
  ('f8000001-0000-0000-0000-000000000005', v_sc, 'Katalin',  'Horváth',  'Molnár Katalin', 'Pécs',       '1990-07-19', 'Molnár Anna',    'female', 'HU', '567-890-123', '8476789012', '{"zip":"1062","city":"Budapest","street":"Andrássy út 100.","country":"HU"}'::jsonb, 'horvath.katalin@sandbox.hu','+36 30 999 0000', '11773016-56789012-00000000', 'active', now(), now());

-- Employments
INSERT INTO accounty_employments (id, employee_id, company_id, employment_type, start_date, weekly_hours, feor_code, job_title, base_salary, salary_type, is_insured, status, created_at, updated_at) VALUES
  (gen_random_uuid(), 'f8000001-0000-0000-0000-000000000001', v_sc, 'full_time', '2024-03-01', 40, '3611', 'Könyvelő',        485000,  'monthly', true, 'active', now(), now()),
  (gen_random_uuid(), 'f8000001-0000-0000-0000-000000000002', v_sc, 'full_time', '2023-06-15', 40, '2141', 'Szoftverfejlesztő',720000,  'monthly', true, 'active', now(), now()),
  (gen_random_uuid(), 'f8000001-0000-0000-0000-000000000003', v_sc, 'part_time', '2025-01-10', 20, '4121', 'Adminisztrátor',   250000,  'monthly', true, 'active', now(), now()),
  (gen_random_uuid(), 'f8000001-0000-0000-0000-000000000004', v_sc, 'full_time', '2022-09-01', 40, '1321', 'Értékesítési vezető',650000,'monthly', true, 'active', now(), now()),
  (gen_random_uuid(), 'f8000001-0000-0000-0000-000000000005', v_sc, 'full_time', '2024-11-01', 40, '2431', 'Marketing menedzser',550000,'monthly', true, 'active', now(), now());

-- Payroll cycles (3 months: April, May, June 2026)
INSERT INTO accounty_payroll_cycles (id, company_id, year, month, status, current_step, created_at, updated_at) VALUES
  ('f8100001-0000-0000-0000-000000000001', v_sc, 2026, 4, 'approved',  5, '2026-04-25'::timestamptz, now()),
  ('f8100001-0000-0000-0000-000000000002', v_sc, 2026, 5, 'approved',  5, '2026-05-25'::timestamptz, now()),
  ('f8100001-0000-0000-0000-000000000003', v_sc, 2026, 6, 'draft',     2, '2026-06-10'::timestamptz, now());

RAISE NOTICE '✅ Payroll modul kész (5 alkalmazott, 3 ciklus)';

-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║  PHASE 16: ACCOUNTY EXTRAS                                        ║
-- ╚══════════════════════════════════════════════════════════════════════╝

RAISE NOTICE '═══ PHASE 16: ACCOUNTY EXTRAS ═══';

-- Deadlines (10)
INSERT INTO accounty_deadlines (id, company_id, deadline_type, title, due_date, status, created_at, updated_at) VALUES
  (gen_random_uuid(), v_sc, 'vat',          'ÁFA bevallás - 2026. január',     '2026-02-20', 'completed', now(), now()),
  (gen_random_uuid(), v_sc, 'vat',          'ÁFA bevallás - 2026. február',    '2026-03-20', 'completed', now(), now()),
  (gen_random_uuid(), v_sc, 'vat',          'ÁFA bevallás - 2026. március',    '2026-04-20', 'completed', now(), now()),
  (gen_random_uuid(), v_sc, 'vat',          'ÁFA bevallás - 2026. április',    '2026-05-20', 'completed', now(), now()),
  (gen_random_uuid(), v_sc, 'vat',          'ÁFA bevallás - 2026. május',      '2026-06-20', 'pending',   now(), now()),
  (gen_random_uuid(), v_sc, 'vat',          'ÁFA bevallás - 2026. június',     '2026-07-20', 'pending',   now(), now()),
  (gen_random_uuid(), v_sc, 'corporate_tax','Társasági adó előleg',            '2026-07-20', 'pending',   now(), now()),
  (gen_random_uuid(), v_sc, 'contribution', 'SZOCHO bevallás - 2026. május',   '2026-06-12', 'overdue',   now(), now()),
  (gen_random_uuid(), v_sc, 'contribution', 'TB járulék bevallás - Q2',        '2026-07-31', 'pending',   now(), now()),
  (gen_random_uuid(), v_sc, 'local_tax',    'Iparűzési adó előleg',            '2026-09-15', 'pending',   now(), now());

-- Missing items (8)
INSERT INTO accounty_missing_items (id, company_id, category, title, subtitle, source, priority, status, details, amount, invoice_number, item_date, created_at, updated_at) VALUES
  (gen_random_uuid(), v_sc, 'bejovo',  'Hiányzó számla - TechSolution',  'IT szolgáltatás havi díj',         'NAV szinkron',    'urgent', 'open', 'A NAV rendszerben szerepel, de a cégnél nem található a bizonylat.', 385000, 'TS-2026-0089',    '2026-05-15', now(), now()),
  (gen_random_uuid(), v_sc, 'bejovo',  'Hiányzó számla - Telekom',       'Április havi telefondíj',          'NAV szinkron',    'medium', 'open', 'Telefonszámla nem érkezett meg a könyveléshez.',                    42000,  'TEL-2026-4521',   '2026-04-28', now(), now()),
  (gen_random_uuid(), v_sc, 'kimeno',  'Kimenő számla hiányzik',         'MegaCorp felé kiállított számla',  'Tranzakció match','urgent', 'open', 'Beérkezett 850.000 Ft utalás, de nincs hozzá kimenő számla.',       850000, NULL,              '2026-05-20', now(), now()),
  (gen_random_uuid(), v_sc, 'bank',    'Ismeretlen banki tétel',          'Nem azonosított bejövő utalás',    'Bankkivonat',     'medium', 'open', '125.000 Ft jóváírás ismeretlen feladótól, közlemény: "PROJ-2026"',   125000, NULL,              '2026-05-10', now(), now()),
  (gen_random_uuid(), v_sc, 'bank',    'Duplikált banki tétel',           'Kétszer könyvelt kifizetés',       'Bankkivonat',     'low',    'open', 'Delta Logisztika felé kétszer könyvelődött a 45.000 Ft.',            45000,  'DLG-2026-0033',   '2026-04-15', now(), now()),
  (gen_random_uuid(), v_sc, 'ber',     'Hiányzó bérjegyzék',             'Június havi bérpapír',             'Bérszámfejtés',   'urgent', 'open', 'Horváth Katalin júniusi bérjegyzéke nem került feltöltésre.',       380000, NULL,              '2026-06-05', now(), now()),
  (gen_random_uuid(), v_sc, 'bejovo',  'Késedelmes számla',              'OfficeMax irodaszer számla',        'Email figyelmeztetés','low','open','30 napos fizetési határidő lejárt, számla nem került kifizetésre.',  78000,  'OM-2026-1234',    '2026-03-25', now(), now()),
  (gen_random_uuid(), v_sc, 'kimeno',  'Sztornózott számla',             'EuroTrade felé sztornó',            'NAV szinkron',    'medium', 'open', 'Sztornó számla megérkezett, de az eredeti számla könyvelése nem módosult.', 420000, 'SBX-OUT-2026-ST001', '2026-05-28', now(), now());

-- Filings (6)
INSERT INTO accounty_filings (id, company_id, filing_type, period_year, period_month, status, channel, created_at, updated_at) VALUES
  (gen_random_uuid(), v_sc, '2065', 2026, 1, 'submitted', 'online', '2026-02-18'::timestamptz, now()),
  (gen_random_uuid(), v_sc, '2065', 2026, 2, 'submitted', 'online', '2026-03-18'::timestamptz, now()),
  (gen_random_uuid(), v_sc, '2065', 2026, 3, 'submitted', 'online', '2026-04-18'::timestamptz, now()),
  (gen_random_uuid(), v_sc, '2065', 2026, 4, 'submitted', 'online', '2026-05-18'::timestamptz, now()),
  (gen_random_uuid(), v_sc, '2065', 2026, 5, 'draft',     NULL,     '2026-06-10'::timestamptz, now()),
  (gen_random_uuid(), v_sc, '08',   2026, NULL, 'draft',  NULL,     '2026-06-01'::timestamptz, now());

RAISE NOTICE '✅ Accounty extras kész (10 határidő, 8 hiányzó, 6 bevallás)';

-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║  PHASE 17: HIBAJEGYEK (3 db)                                      ║
-- ╚══════════════════════════════════════════════════════════════════════╝

RAISE NOTICE '═══ PHASE 17: HIBAJEGYEK ═══';

INSERT INTO feedback (id, user_id, company_id, company_name, type, message, user_email, user_name, status, slack_sent, priority, page_url, ticket_number, service, created_at, updated_at) VALUES
  ('f9000001-0000-0000-0000-000000000001', v_su, v_sc, 'SANDBOX', 'bug',
   'A NAV szinkronizáció során néhány számla duplikáltan jelenik meg a bejövő számlák listájában. A bizonylatsorszám azonos, de két külön sorban látható.',
   'sandbox@thinkai.hu', 'Sandbox', 'open', false, 'high',
   '/invoices/nav', 'VB-001', 'visibill',
   '2026-06-05'::timestamptz, now()),
  ('f9000001-0000-0000-0000-000000000002', v_su, v_sc, 'SANDBOX', 'feature_request',
   'Lehetne-e az ÁFA bevallás oldalon egy összesítő grafikon az éves ÁFA alakulásról? Nagyon hasznos lenne az ügyfeleknek a trendek áttekintéséhez.',
   'sandbox@thinkai.hu', 'Sandbox', 'in_progress', false, 'medium',
   '/vat-return', 'VB-002', 'visibill',
   '2026-05-20'::timestamptz, now()),
  ('f9000001-0000-0000-0000-000000000003', v_su, v_sc, 'SANDBOX', 'bug',
   'A partnertörzs importálásnál ha az adószám formátuma nem egyezik (kötőjeles vs kötőjel nélküli), duplikált partner jön létre.',
   'sandbox@thinkai.hu', 'Sandbox', 'resolved', false, 'low',
   '/partners', 'VB-003', 'visibill',
   '2026-04-10'::timestamptz, now());

-- Ticket comments
INSERT INTO ticket_comments (id, feedback_id, user_id, user_name, user_email, is_admin, message, created_at) VALUES
  (gen_random_uuid(), 'f9000001-0000-0000-0000-000000000001', v_su, 'Sandbox', 'sandbox@thinkai.hu', false, 'Ez a probléma a múlt héten kezdődött, kb. 5 számla érintett.', '2026-06-06'::timestamptz),
  (gen_random_uuid(), 'f9000001-0000-0000-0000-000000000002', v_su, 'Sandbox', 'sandbox@thinkai.hu', false, 'Köszi az eddigi visszajelzést! Esetleg havi bontásban is jó lenne.', '2026-05-25'::timestamptz),
  (gen_random_uuid(), 'f9000001-0000-0000-0000-000000000003', v_su, 'Sandbox', 'sandbox@thinkai.hu', false, 'A javítás óta tökéletesen működik, köszönöm!', '2026-05-01'::timestamptz);

-- Ticket events
INSERT INTO ticket_events (id, feedback_id, event_type, actor_id, actor_email, actor_name, old_value, new_value, created_at) VALUES
  (gen_random_uuid(), 'f9000001-0000-0000-0000-000000000001', 'status_change', v_su, 'sandbox@thinkai.hu', 'Sandbox', 'new', 'open', '2026-06-05'::timestamptz),
  (gen_random_uuid(), 'f9000001-0000-0000-0000-000000000002', 'status_change', v_su, 'sandbox@thinkai.hu', 'Sandbox', 'open', 'in_progress', '2026-05-22'::timestamptz),
  (gen_random_uuid(), 'f9000001-0000-0000-0000-000000000003', 'status_change', v_su, 'sandbox@thinkai.hu', 'Sandbox', 'open', 'resolved', '2026-04-28'::timestamptz);

RAISE NOTICE '✅ 3 hibajegy + kommentek + események kész';

-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║  PHASE 18: ÉVES BESZÁMOLÓ (draft)                                  ║
-- ╚══════════════════════════════════════════════════════════════════════╝

RAISE NOTICE '═══ PHASE 18: ÉVES BESZÁMOLÓ ═══';

INSERT INTO annual_reports (id, company_id, preset_id, fiscal_year, status, representative_name, representative_role, report_date, accounting_method, created_at, updated_at, created_by) VALUES
  (gen_random_uuid(), v_sc, gl_preset, 2025, 'draft', 'Dr. Sandbox István', 'ügyvezető', '2026-05-31', 'double_entry', now(), now(), v_su);

RAISE NOTICE '✅ Éves beszámoló draft kész';

-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║  PHASE 19: TRIGGER RE-ENABLE                                      ║
-- ╚══════════════════════════════════════════════════════════════════════╝

ALTER TABLE invoices              ENABLE TRIGGER USER;
ALTER TABLE transactions          ENABLE TRIGGER USER;
ALTER TABLE nav_invoices          ENABLE TRIGGER USER;
ALTER TABLE salary                ENABLE TRIGGER USER;
ALTER TABLE salary_files          ENABLE TRIGGER USER;
ALTER TABLE invoice_uploads       ENABLE TRIGGER USER;
ALTER TABLE partners              ENABLE TRIGGER USER;
ALTER TABLE categories            ENABLE TRIGGER USER;
ALTER TABLE projects              ENABLE TRIGGER USER;
ALTER TABLE employee_rates        ENABLE TRIGGER USER;
ALTER TABLE time_entries          ENABLE TRIGGER USER;
ALTER TABLE company_settings      ENABLE TRIGGER USER;
ALTER TABLE gl_accounts           ENABLE TRIGGER USER;
ALTER TABLE chart_of_accounts_presets ENABLE TRIGGER USER;
ALTER TABLE fixed_assets          ENABLE TRIGGER USER;
ALTER TABLE asset_events          ENABLE TRIGGER USER;
ALTER TABLE company_locations     ENABLE TRIGGER USER;
ALTER TABLE invoice_items         ENABLE TRIGGER USER;
ALTER TABLE feedback              ENABLE TRIGGER USER;

-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║  ÖSSZESÍTÉS                                                        ║
-- ╚══════════════════════════════════════════════════════════════════════╝

RAISE NOTICE '══════════════════════════════════════════';
RAISE NOTICE '🎉 SANDBOX MOCKUP SEED KÉSZ!';
RAISE NOTICE '══════════════════════════════════════════';
RAISE NOTICE 'Company: SANDBOX Kft. (%)' , v_sc;
RAISE NOTICE 'User: sandbox@thinkai.hu (%)' , v_su;
RAISE NOTICE '';
RAISE NOTICE '📊 Összesítés:';
RAISE NOTICE '  Kategóriák: 15';
RAISE NOTICE '  Projektek: 5';
RAISE NOTICE '  Partnerek: 30';
RAISE NOTICE '  NAV számlák: 200';
RAISE NOTICE '  Upload számlák: 50';
RAISE NOTICE '  Tranzakciók: ~200';
RAISE NOTICE '  Bérek: 30';
RAISE NOTICE '  Adó rekordok: 12';
RAISE NOTICE '  GL számlák: ~715';
RAISE NOTICE '  ÁFA bevallások: 6';
RAISE NOTICE '  Tárgyi eszközök: 8';
RAISE NOTICE '  Munkaidő bejegyzések: 100';
RAISE NOTICE '  Payroll alkalmazottak: 5';
RAISE NOTICE '  Payroll ciklusok: 3';
RAISE NOTICE '  Accounty határidők: 10';
RAISE NOTICE '  Hiányzó bizonylatok: 8';
RAISE NOTICE '  Bevallások: 6';
RAISE NOTICE '  Hibajegyek: 3';
RAISE NOTICE '  Éves beszámoló: 1 draft';
RAISE NOTICE '══════════════════════════════════════════';

END $$;
