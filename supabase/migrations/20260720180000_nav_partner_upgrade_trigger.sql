-- Migration: nav_invoices INSERT trigger → auto-upgrade FOREIGN: partner to real tax_number
--
-- When a new NAV invoice is inserted with a known supplier/customer tax_number,
-- if a partner exists in the same company with a FOREIGN: synthetic ID and
-- a matching normalized name → upgrade the partner's tax_number to the real value.
--
-- This covers the gap where Python worker's partner_upsert handles uploaded invoices,
-- but NAV sync is done via Edge Function (no Python runtime) — hence a DB trigger.
--
-- DB Checklist:
--   DB-12: ✅ SECURITY DEFINER (auth.uid() is NULL in trigger context)
--   DB-13: ✅ SET search_path TO 'public'
--   DB-14: ✅ SECURITY DEFINER explicit on CREATE OR REPLACE
--   M-2:   ✅ CREATE OR REPLACE (idempotent)
--   M-1:   ✅ Non-destructive, no DROP TABLE/COLUMN

-- Step 1: Helper function — normalize company name for matching
-- Mirrors Python's normalize_company_name():
--   lowercase, strip legal suffixes (Kft., Zrt., Bt., etc.), remove punctuation
CREATE OR REPLACE FUNCTION public.normalize_partner_name_for_match(p_name text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path TO 'public'
AS $$
  SELECT trim(
    regexp_replace(
      regexp_replace(
        regexp_replace(
          regexp_replace(
            regexp_replace(
              -- Step 5: Remove legal suffixes (Hungarian + common foreign)
              regexp_replace(
                regexp_replace(
                  -- Step 2: lowercase
                  lower(p_name),
                  -- Step 3: Strip trailing legal suffixes (most common forms)
                  '\s*(korlátolt felelősségű társaság|részvénytársaság|betéti társaság|egyéni vállalkozó|zártkörűen működő részvénytársaság|nyilvánosan működő részvénytársaság|szövetkezet|közkereseti társaság|kft\.?|zrt\.?|bt\.?|rt\.?|nyrt\.?|kkt\.?|ev\.?|inc\.?|llc\.?|ltd\.?|corp\.?|gmbh\.?|ag\.?|sa\.?|s\.a\.?|d\.o\.o\.?|s\.r\.o\.?|oy\.?|ab\.?|as\.?|nv\.?|bv\.?|pbc\.?|plc\.?)\s*$',
                  '',
                  'gi'
                ),
                -- Also strip quotes at start/end
                '^["\'']+|["\'']+$',
                '',
                'g'
              ),
              -- Step 4: Remove dots, commas → spaces
              '[.,]+',
              ' ',
              'g'
            ),
            -- Step 4: hyphens → spaces
            '-',
            ' ',
            'g'
          ),
          -- Step 5: collapse multiple spaces
          '\s+',
          ' ',
          'g'
        ),
        -- Remove trailing punctuation
        '[\s.,-]+$',
        '',
        'g'
      ),
      -- Remove leading punctuation
      '^[\s.,-]+',
      '',
      'g'
    )
  );
$$;

-- Step 2: Trigger function — runs after INSERT on nav_invoices
-- Looks for FOREIGN: partners in the same company with a matching name,
-- upgrades their tax_number to the real tax_number from the NAV invoice.
CREATE OR REPLACE FUNCTION public.upgrade_foreign_partner_on_nav_invoice()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_tax_number text;
  v_name       text;
  v_norm_name  text;
  v_partner_id uuid;
  v_existing_tax text;
  v_norm_existing text;
BEGIN
  -- Process INBOUND invoices: supplier side
  IF NEW.invoice_direction = 'INBOUND' THEN
    v_tax_number := trim(COALESCE(NEW.supplier_tax_number, ''));
    v_name       := trim(COALESCE(NEW.supplier_name, ''));
  -- Process OUTBOUND invoices: customer side
  ELSIF NEW.invoice_direction = 'OUTBOUND' THEN
    v_tax_number := trim(COALESCE(NEW.customer_tax_number, ''));
    v_name       := trim(COALESCE(NEW.customer_name, ''));
  ELSE
    RETURN NEW;
  END IF;

  -- Skip if no real tax number or no name
  IF v_tax_number = '' OR v_name = '' THEN
    RETURN NEW;
  END IF;

  -- Skip synthetic FOREIGN: tax numbers (NAV shouldn't produce these, but safety check)
  IF v_tax_number ILIKE 'FOREIGN:%' THEN
    RETURN NEW;
  END IF;

  -- Normalize the name from the invoice
  v_norm_name := public.normalize_partner_name_for_match(v_name);

  IF length(v_norm_name) < 3 THEN
    RETURN NEW;
  END IF;

  -- Look for a FOREIGN: partner in this company with a matching normalized name
  SELECT p.id, p.tax_number
  INTO v_partner_id, v_existing_tax
  FROM partners p
  WHERE p.company_id = NEW.company_id
    AND p.tax_number ILIKE 'FOREIGN:%'
    AND public.normalize_partner_name_for_match(p.name) = v_norm_name
  LIMIT 1;

  -- If found → upgrade FOREIGN: → real tax_number
  IF v_partner_id IS NOT NULL THEN
    UPDATE partners
    SET tax_number = v_tax_number
    WHERE id = v_partner_id;

    RAISE LOG 'partner_tax_upgraded_by_nav_trigger: partner_id=%, old_tax=%, new_tax=%, name=%',
      v_partner_id, v_existing_tax, v_tax_number, v_name;
  END IF;

  RETURN NEW;
END;
$$;

-- Step 3: Attach trigger to nav_invoices
-- AFTER INSERT ensures the row is committed before we act on it.
-- FOR EACH ROW: runs once per inserted row.
DROP TRIGGER IF EXISTS trg_upgrade_foreign_partner_on_nav_invoice ON nav_invoices;

CREATE TRIGGER trg_upgrade_foreign_partner_on_nav_invoice
  AFTER INSERT ON nav_invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.upgrade_foreign_partner_on_nav_invoice();

-- Step 4: Security — revoke from anon/public, grant to service_role
REVOKE ALL ON FUNCTION public.normalize_partner_name_for_match(text) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.normalize_partner_name_for_match(text) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.upgrade_foreign_partner_on_nav_invoice() FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.upgrade_foreign_partner_on_nav_invoice() TO service_role;
