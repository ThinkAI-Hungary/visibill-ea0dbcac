-- Activate Skonto for Yamaha Music Europe GmbH and GEWA music GmbH for Victoria Music Kft.

DO $$
DECLARE
  v_company_id UUID := '86ac88ac-4b2f-4d79-8eeb-251e3db7a02e';
  v_yamaha_id UUID;
  v_gewa_id UUID;
BEGIN
  -- 1. Update Yamaha partner
  UPDATE partners
  SET 
    has_skonto = true,
    skonto_days = 14,
    skonto_percent = 2.0,
    skonto_excludes_shipping = false
  WHERE company_id = v_company_id
    AND (name ILIKE '%yamaha%' OR tax_number = 'ATU64673623')
  RETURNING id INTO v_yamaha_id;

  -- 2. Update GEWA partner
  UPDATE partners
  SET 
    has_skonto = true,
    skonto_days = 10,
    skonto_percent = 2.0,
    skonto_excludes_shipping = true
  WHERE company_id = v_company_id
    AND (name ILIKE '%gewa%' OR tax_number = 'DE125086297')
  RETURNING id INTO v_gewa_id;

  -- 3. Update Yamaha open invoices
  UPDATE invoices
  SET
    has_skonto = true,
    skonto_days = 14,
    skonto_percent = 2.0,
    skonto_shipping_amount = 0,
    skonto_due_date = COALESCE(kibocsatas_datuma, teljesites_datuma, fizetesi_hatarido) + INTERVAL '14 days',
    skonto_amount = ROUND(brutto_vegosszeg * 0.98),
    skonto_selected = true
  WHERE company_id = v_company_id
    AND (elado_nev ILIKE '%yamaha%' OR elado_vat_id = 'ATU64673623')
    AND fizetve = false
    AND invoice_direction = 'INBOUND';

  -- 4. Update GEWA open invoices (detecting shipping 7000 if present or standard)
  UPDATE invoices
  SET
    has_skonto = true,
    skonto_days = 10,
    skonto_percent = 2.0,
    skonto_shipping_amount = CASE WHEN brutto_vegosszeg = 561164 THEN 7000 ELSE 0 END,
    skonto_due_date = COALESCE(kibocsatas_datuma, teljesites_datuma, fizetesi_hatarido) + INTERVAL '10 days',
    skonto_amount = CASE 
      WHEN brutto_vegosszeg = 561164 THEN ROUND((561164 - 7000) * 0.98 + 7000)
      ELSE ROUND(brutto_vegosszeg * 0.98)
    END,
    skonto_selected = true
  WHERE company_id = v_company_id
    AND (elado_nev ILIKE '%gewa%' OR elado_vat_id = 'DE125086297')
    AND fizetve = false
    AND invoice_direction = 'INBOUND';

  -- 5. Repeat for nav_invoices just in case
  UPDATE nav_invoices
  SET
    has_skonto = true,
    skonto_days = 14,
    skonto_percent = 2.0,
    skonto_shipping_amount = 0,
    skonto_due_date = COALESCE(invoice_issue_date, invoice_delivery_date, payment_date) + INTERVAL '14 days',
    skonto_amount = ROUND(invoice_gross_amount * 0.98),
    skonto_selected = true
  WHERE company_id = v_company_id
    AND (supplier_name ILIKE '%yamaha%' OR supplier_tax_number = 'ATU64673623')
    AND paid = false
    AND invoice_direction = 'INBOUND';

  UPDATE nav_invoices
  SET
    has_skonto = true,
    skonto_days = 10,
    skonto_percent = 2.0,
    skonto_shipping_amount = 0,
    skonto_due_date = COALESCE(invoice_issue_date, invoice_delivery_date, payment_date) + INTERVAL '10 days',
    skonto_amount = ROUND(invoice_gross_amount * 0.98),
    skonto_selected = true
  WHERE company_id = v_company_id
    AND (supplier_name ILIKE '%gewa%' OR supplier_tax_number = 'DE125086297')
    AND paid = false
    AND invoice_direction = 'INBOUND';

END $$;
