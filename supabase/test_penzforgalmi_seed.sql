-- ============================================================
-- Pénzforgalmi ÁFA — TESZT ADATOK
-- ============================================================
-- Cég ID: a397c0c8-b295-415e-9f78-0451fea9cd09
-- Időszak: 2026. június (06.01 – 06.30)
-- ============================================================
--
-- TESZT ESETEK:
--
-- ┌──────────────────────────────────────────────────────────────┐
-- │ A) OUTBOUND számlák (fizetendő ÁFA)                        │
-- │    OUT-001: KIFIZETETT   → 1.000.000 nettó, 270.000 ÁFA    │
-- │    OUT-002: KIFIZETETT   →   500.000 nettó, 135.000 ÁFA    │
-- │    OUT-003: NEM FIZETVE  →   800.000 nettó, 216.000 ÁFA    │
-- │    OUT-004: NEM FIZETVE  →   300.000 nettó,  81.000 ÁFA    │
-- │                                                              │
-- │    Normál cég fizetendő ÁFA:  702.000 (mind a 4)            │
-- │    Pénzforgalmi fizetendő:    405.000 (csak OUT-001, OUT-002)│
-- ├──────────────────────────────────────────────────────────────┤
-- │ B) INBOUND számlák — normál szállító                       │
-- │    INB-001: KIFIZETETT   →   600.000 nettó, 162.000 ÁFA    │
-- │    INB-002: NEM FIZETVE  →   400.000 nettó, 108.000 ÁFA    │
-- │    INB-003: KIFIZETETT   →   200.000 nettó,  54.000 ÁFA    │
-- │                                                              │
-- │    Normál cég levonható:     324.000 (mind a 3)              │
-- │    Pénzforgalmi levonható:  216.000 (csak INB-001, INB-003)  │
-- ├──────────────────────────────────────────────────────────────┤
-- │ C) INBOUND számlák — PÉNZFORGALMI szállító (is_cash_acc.)  │
-- │    INB-PF-001: KIFIZETETT →  350.000 nettó,  94.500 ÁFA    │
-- │    INB-PF-002: NEM FIZETVE → 250.000 nettó,  67.500 ÁFA    │
-- │                                                              │
-- │    Normál cég levonható:     94.500 (csak INB-PF-001!)       │
-- │    Pénzforgalmi levonható:  94.500 (csak INB-PF-001)         │
-- └──────────────────────────────────────────────────────────────┘
--
-- ÖSSZESÍTŐ:
--   Normál cég:
--     Fizetendő:   702.000
--     Levonható:    324.000 + 94.500 = 418.500
--     Egyenleg:     702.000 - 418.500 = 283.500 (befizetendő)
--
--   Normál cég (ha van pénzforgalmi szállító):
--     Fizetendő:   702.000
--     Levonható:    324.000 + 94.500 = 418.500
--       (INB-PF-002 NEM levonható, mert a szállító pénzforgalmi és nem fizettük)
--     Egyenleg:     702.000 - 418.500 = 283.500
--
--   Pénzforgalmi cég:
--     Fizetendő:   405.000 (csak kifizetett OUTBOUND)
--     Levonható:   216.000 + 94.500 = 310.500 (csak kifizetett INBOUND)
--     Egyenleg:    405.000 - 310.500 = 94.500 (befizetendő)
-- ============================================================

DO $$
DECLARE
  v_company_id UUID := 'a397c0c8-b295-415e-9f78-0451fea9cd09';

  -- Transaction IDs (for "paid" invoices)
  v_tx_out1 UUID := gen_random_uuid();
  v_tx_out2 UUID := gen_random_uuid();
  v_tx_inb1 UUID := gen_random_uuid();
  v_tx_inb3 UUID := gen_random_uuid();
  v_tx_pf1  UUID := gen_random_uuid();

  -- Invoice IDs
  v_out1 UUID := gen_random_uuid();
  v_out2 UUID := gen_random_uuid();
  v_out3 UUID := gen_random_uuid();
  v_out4 UUID := gen_random_uuid();
  v_inb1 UUID := gen_random_uuid();
  v_inb2 UUID := gen_random_uuid();
  v_inb3 UUID := gen_random_uuid();
  v_pf1  UUID := gen_random_uuid();
  v_pf2  UUID := gen_random_uuid();

BEGIN

-- ══════════════════════════════════════════
-- 0. Régi teszt adatok törlése
-- ══════════════════════════════════════════
DELETE FROM vat_return_m_lines WHERE vat_return_id IN (SELECT id FROM vat_returns WHERE company_id = v_company_id);
DELETE FROM vat_return_lines WHERE vat_return_id IN (SELECT id FROM vat_returns WHERE company_id = v_company_id);
DELETE FROM vat_returns WHERE company_id = v_company_id;
DELETE FROM nav_invoice_items WHERE nav_invoice_id IN (SELECT id FROM nav_invoices WHERE company_id = v_company_id);
UPDATE nav_invoices SET transaction_id = NULL WHERE company_id = v_company_id AND transaction_id IS NOT NULL;
DELETE FROM nav_invoices WHERE company_id = v_company_id;
-- Törli a teszt tranzakciókat (description LIKE 'TESZT-PF%')
DELETE FROM transactions WHERE company_id = v_company_id AND description LIKE 'TESZT-PF%';

RAISE NOTICE '✅ Régi adatok törölve';

-- ══════════════════════════════════════════
-- 1. Cég beállítása pénzforgalmira
-- ══════════════════════════════════════════
UPDATE companies
SET vat_regime = 'penzforgalmi',
    vat_regime_effective_from = '2026-01-01'
WHERE id = v_company_id;

RAISE NOTICE '✅ Cég beállítva: pénzforgalmi';

-- ══════════════════════════════════════════
-- 1.5 Dummy tranzakciók (a transaction_id FK-hez)
-- ══════════════════════════════════════════
INSERT INTO transactions (id, company_id, amount, currency, description, transaction_date, type, is_verified, created_at) VALUES
  (v_tx_out1, v_company_id,  1270000, 'HUF', 'TESZT-PF Vevő Alpha befizetés',   '2026-06-15', 'vevői tranzakció', true, now()),
  (v_tx_out2, v_company_id,   635000, 'HUF', 'TESZT-PF Vevő Beta befizetés',    '2026-06-20', 'vevői tranzakció', true, now()),
  (v_tx_inb1, v_company_id,  -762000, 'HUF', 'TESZT-PF Szállító Uno kifizetés', '2026-06-10', 'szállítói tranzakció', true, now()),
  (v_tx_inb3, v_company_id,  -254000, 'HUF', 'TESZT-PF Szállító Tre kifizetés', '2026-06-25', 'szállítói tranzakció', true, now()),
  (v_tx_pf1,  v_company_id,  -444500, 'HUF', 'TESZT-PF PénzF szállító kifiz.',  '2026-06-18', 'szállítói tranzakció', true, now());

RAISE NOTICE '✅ 5 dummy tranzakció létrehozva';

-- ══════════════════════════════════════════
-- A) OUTBOUND számlák
-- ══════════════════════════════════════════

-- OUT-001: KIFIZETETT (transaction_id beállítva)
INSERT INTO nav_invoices (id, company_id, invoice_number, invoice_direction, invoice_operation,
  supplier_name, supplier_tax_number, customer_name, customer_tax_number,
  invoice_issue_date, invoice_delivery_date,
  invoice_net_amount, invoice_vat_amount, invoice_gross_amount,
  currency, payment_method, transaction_id,
  details_fetched, submitted, created_at)
VALUES (v_out1, v_company_id, 'TESZT-OUT-001', 'OUTBOUND', 'CREATE',
  'Teszt Pénzforgalmi Kft.', '99887766-2-42',
  'Vevő Alpha Kft.', '11112222-2-41',
  '2026-06-05', '2026-06-05',
  1000000, 270000, 1270000,
  'HUF', 'TRANSFER', v_tx_out1,
  true, true, now());

-- OUT-002: KIFIZETETT
INSERT INTO nav_invoices (id, company_id, invoice_number, invoice_direction, invoice_operation,
  supplier_name, supplier_tax_number, customer_name, customer_tax_number,
  invoice_issue_date, invoice_delivery_date,
  invoice_net_amount, invoice_vat_amount, invoice_gross_amount,
  currency, payment_method, transaction_id,
  details_fetched, submitted, created_at)
VALUES (v_out2, v_company_id, 'TESZT-OUT-002', 'OUTBOUND', 'CREATE',
  'Teszt Pénzforgalmi Kft.', '99887766-2-42',
  'Vevő Beta Zrt.', '22223333-2-43',
  '2026-06-12', '2026-06-12',
  500000, 135000, 635000,
  'HUF', 'TRANSFER', v_tx_out2,
  true, true, now());

-- OUT-003: NEM FIZETVE (transaction_id = NULL)
INSERT INTO nav_invoices (id, company_id, invoice_number, invoice_direction, invoice_operation,
  supplier_name, supplier_tax_number, customer_name, customer_tax_number,
  invoice_issue_date, invoice_delivery_date,
  invoice_net_amount, invoice_vat_amount, invoice_gross_amount,
  currency, payment_method,
  details_fetched, submitted, created_at)
VALUES (v_out3, v_company_id, 'TESZT-OUT-003', 'OUTBOUND', 'CREATE',
  'Teszt Pénzforgalmi Kft.', '99887766-2-42',
  'Vevő Gamma Kft.', '33334444-2-41',
  '2026-06-18', '2026-06-18',
  800000, 216000, 1016000,
  'HUF', 'TRANSFER',
  true, true, now());

-- OUT-004: NEM FIZETVE
INSERT INTO nav_invoices (id, company_id, invoice_number, invoice_direction, invoice_operation,
  supplier_name, supplier_tax_number, customer_name, customer_tax_number,
  invoice_issue_date, invoice_delivery_date,
  invoice_net_amount, invoice_vat_amount, invoice_gross_amount,
  currency, payment_method,
  details_fetched, submitted, created_at)
VALUES (v_out4, v_company_id, 'TESZT-OUT-004', 'OUTBOUND', 'CREATE',
  'Teszt Pénzforgalmi Kft.', '99887766-2-42',
  'Vevő Delta Bt.', '44445555-2-42',
  '2026-06-25', '2026-06-25',
  300000, 81000, 381000,
  'HUF', 'TRANSFER',
  true, true, now());

RAISE NOTICE '✅ 4 OUTBOUND számla létrehozva (2 kifizetett, 2 nem)';

-- ══════════════════════════════════════════
-- B) INBOUND számlák — normál szállító
-- ══════════════════════════════════════════

-- INB-001: KIFIZETETT
INSERT INTO nav_invoices (id, company_id, invoice_number, invoice_direction, invoice_operation,
  supplier_name, supplier_tax_number, customer_name, customer_tax_number,
  invoice_issue_date, invoice_delivery_date,
  invoice_net_amount, invoice_vat_amount, invoice_gross_amount,
  currency, payment_method, transaction_id, is_cash_accounting,
  details_fetched, submitted, created_at)
VALUES (v_inb1, v_company_id, 'TESZT-INB-001', 'INBOUND', 'CREATE',
  'Szállító Uno Kft.', '55556666-2-41',
  'Teszt Pénzforgalmi Kft.', '99887766-2-42',
  '2026-06-03', '2026-06-03',
  600000, 162000, 762000,
  'HUF', 'TRANSFER', v_tx_inb1, false,
  true, true, now());

-- INB-002: NEM FIZETVE
INSERT INTO nav_invoices (id, company_id, invoice_number, invoice_direction, invoice_operation,
  supplier_name, supplier_tax_number, customer_name, customer_tax_number,
  invoice_issue_date, invoice_delivery_date,
  invoice_net_amount, invoice_vat_amount, invoice_gross_amount,
  currency, payment_method, is_cash_accounting,
  details_fetched, submitted, created_at)
VALUES (v_inb2, v_company_id, 'TESZT-INB-002', 'INBOUND', 'CREATE',
  'Szállító Due Zrt.', '66667777-2-43',
  'Teszt Pénzforgalmi Kft.', '99887766-2-42',
  '2026-06-10', '2026-06-10',
  400000, 108000, 508000,
  'HUF', 'TRANSFER', false,
  true, true, now());

-- INB-003: KIFIZETETT
INSERT INTO nav_invoices (id, company_id, invoice_number, invoice_direction, invoice_operation,
  supplier_name, supplier_tax_number, customer_name, customer_tax_number,
  invoice_issue_date, invoice_delivery_date,
  invoice_net_amount, invoice_vat_amount, invoice_gross_amount,
  currency, payment_method, transaction_id, is_cash_accounting,
  details_fetched, submitted, created_at)
VALUES (v_inb3, v_company_id, 'TESZT-INB-003', 'INBOUND', 'CREATE',
  'Szállító Tre Bt.', '77778888-2-41',
  'Teszt Pénzforgalmi Kft.', '99887766-2-42',
  '2026-06-20', '2026-06-20',
  200000, 54000, 254000,
  'HUF', 'TRANSFER', v_tx_inb3, false,
  true, true, now());

RAISE NOTICE '✅ 3 INBOUND számla létrehozva (2 kifizetett, 1 nem)';

-- ══════════════════════════════════════════
-- C) INBOUND számlák — PÉNZFORGALMI szállító
-- ══════════════════════════════════════════

-- INB-PF-001: KIFIZETETT + szállító pénzforgalmi
INSERT INTO nav_invoices (id, company_id, invoice_number, invoice_direction, invoice_operation,
  supplier_name, supplier_tax_number, customer_name, customer_tax_number,
  invoice_issue_date, invoice_delivery_date,
  invoice_net_amount, invoice_vat_amount, invoice_gross_amount,
  currency, payment_method, transaction_id, is_cash_accounting,
  details_fetched, submitted, created_at)
VALUES (v_pf1, v_company_id, 'TESZT-INB-PF-001', 'INBOUND', 'CREATE',
  'PénzF Szállító Kft.', '88889999-2-42',
  'Teszt Pénzforgalmi Kft.', '99887766-2-42',
  '2026-06-08', '2026-06-08',
  350000, 94500, 444500,
  'HUF', 'TRANSFER', v_tx_pf1, true,  -- ← is_cash_accounting = TRUE
  true, true, now());

-- INB-PF-002: NEM FIZETVE + szállító pénzforgalmi
INSERT INTO nav_invoices (id, company_id, invoice_number, invoice_direction, invoice_operation,
  supplier_name, supplier_tax_number, customer_name, customer_tax_number,
  invoice_issue_date, invoice_delivery_date,
  invoice_net_amount, invoice_vat_amount, invoice_gross_amount,
  currency, payment_method, is_cash_accounting,
  details_fetched, submitted, created_at)
VALUES (v_pf2, v_company_id, 'TESZT-INB-PF-002', 'INBOUND', 'CREATE',
  'PénzF Szállító Kft.', '88889999-2-42',
  'Teszt Pénzforgalmi Kft.', '99887766-2-42',
  '2026-06-22', '2026-06-22',
  250000, 67500, 317500,
  'HUF', 'TRANSFER', true,  -- ← is_cash_accounting = TRUE, NEM FIZETVE
  true, true, now());

RAISE NOTICE '✅ 2 INBOUND számla pénzforgalmi szállítótól (1 kifizetett, 1 nem)';

-- ══════════════════════════════════════════
-- Tételsorok (nav_invoice_items)
-- ══════════════════════════════════════════
-- FONTOS: vat_rate a NAV formátumban ('0.27', nem '27%')

INSERT INTO nav_invoice_items (id, nav_invoice_id, line_number, line_description, quantity, unit_of_measure, unit_price, net_amount, vat_rate, vat_amount, gross_amount, created_at) VALUES
  -- OUTBOUND
  (gen_random_uuid(), v_out1, 1, 'IT fejlesztési szolgáltatás',      1, 'db', 1000000, 1000000, '0.27', 270000, 1270000, now()),
  (gen_random_uuid(), v_out2, 1, 'Tanácsadási díj',                  1, 'db',  500000,  500000, '0.27', 135000,  635000, now()),
  (gen_random_uuid(), v_out3, 1, 'Szoftverfejlesztés II. mérföldkő', 1, 'db',  800000,  800000, '0.27', 216000, 1016000, now()),
  (gen_random_uuid(), v_out4, 1, 'Support havi díj',                  1, 'db',  300000,  300000, '0.27',  81000,  381000, now()),
  -- INBOUND normál
  (gen_random_uuid(), v_inb1, 1, 'Irodabérleti díj június',          1, 'db',  600000,  600000, '0.27', 162000,  762000, now()),
  (gen_random_uuid(), v_inb2, 1, 'Marketing kampány díj',            1, 'db',  400000,  400000, '0.27', 108000,  508000, now()),
  (gen_random_uuid(), v_inb3, 1, 'Karbantartási szolgáltatás',       1, 'db',  200000,  200000, '0.27',  54000,  254000, now()),
  -- INBOUND pénzforgalmi szállító
  (gen_random_uuid(), v_pf1,  1, 'Grafikai tervezés — PF szla',      1, 'db',  350000,  350000, '0.27',  94500,  444500, now()),
  (gen_random_uuid(), v_pf2,  1, 'Webfejlesztés részlet — PF szla',  1, 'db',  250000,  250000, '0.27',  67500,  317500, now());

RAISE NOTICE '✅ 9 tételsor létrehozva';

-- ══════════════════════════════════════════
-- VAT kódok inicializálása (ha még nincs)
-- ══════════════════════════════════════════
INSERT INTO vat_codes (company_id, code, label, vat_percent, direction, is_deductible, is_reverse_charge, is_eu, target_rows, sort_order)
VALUES
  (v_company_id, 'OUT_27', 'Értékesítés 27%', 27.00, 'OUTBOUND', false, false, false,
   '[{"row":"01","col":"base"},{"row":"01","col":"tax"}]'::jsonb, 1),
  (v_company_id, 'INB_27', 'Beszerzés 27%', 27.00, 'INBOUND', true, false, false,
   '[{"row":"67","col":"base"},{"row":"67","col":"tax"}]'::jsonb, 101)
ON CONFLICT (company_id, code) DO NOTHING;

RAISE NOTICE '✅ VAT kódok kész';

RAISE NOTICE '';
RAISE NOTICE '════════════════════════════════════════════════════════════';
RAISE NOTICE '  TESZT ADATOK KÉSZ! Most futtasd a Számítás-t a UI-on:';
RAISE NOTICE '  Időszak: 2026 június (havi)';
RAISE NOTICE '════════════════════════════════════════════════════════════';
RAISE NOTICE '';
RAISE NOTICE '  ELVÁRT EREDMÉNYEK (pénzforgalmi cég):';
RAISE NOTICE '    Fizetendő ÁFA:  405 eFt (csak kifizetett OUTBOUND)';
RAISE NOTICE '    Levonható ÁFA:  311 eFt (csak kifizetett INBOUND)';
RAISE NOTICE '    Egyenleg:        95 eFt (befizetendő)';
RAISE NOTICE '';
RAISE NOTICE '  HA NORMÁLRA ÁLLÍTOD (vat_regime=normal):';
RAISE NOTICE '    Fizetendő ÁFA:  702 eFt (minden OUTBOUND)';
RAISE NOTICE '    Levonható ÁFA:  419 eFt (normál + kifizetett PF)';
RAISE NOTICE '    Egyenleg:       284 eFt (befizetendő)';
RAISE NOTICE '';

END $$;

-- ════════════════════════════════════════════════════════════
-- ELLENŐRZŐ LEKÉRDEZÉSEK
-- ════════════════════════════════════════════════════════════

-- 1. Számla összesítő
SELECT
  invoice_number,
  invoice_direction,
  CASE WHEN transaction_id IS NOT NULL THEN '✅ KIFIZETETT' ELSE '❌ NEM FIZETVE' END as fizetes,
  CASE WHEN is_cash_accounting THEN '🟣 PF SZÁLLÍTÓ' ELSE '' END as pf_szallito,
  invoice_net_amount as netto,
  invoice_vat_amount as afa,
  invoice_gross_amount as brutto
FROM nav_invoices
WHERE company_id = 'a397c0c8-b295-415e-9f78-0451fea9cd09'
ORDER BY invoice_direction, invoice_number;

-- 2. Cég ÁFA rendszer
SELECT name, vat_regime, vat_regime_effective_from
FROM companies
WHERE id = 'a397c0c8-b295-415e-9f78-0451fea9cd09';

-- 3. Ha tesztelni akarod normálként is:
-- UPDATE companies SET vat_regime = 'normal' WHERE id = 'a397c0c8-b295-415e-9f78-0451fea9cd09';
-- ...majd nyomd meg a Számítás gombot újra és hasonlítsd össze!
