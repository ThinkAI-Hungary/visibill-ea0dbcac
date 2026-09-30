-- Migration: standardize_491_492_balance_accounts
-- Purpose: Standardize 491 as 'Nyitó mérleg számla' and 492 as 'Záró mérleg számla' across all presets and clean up descriptions/names

-- 1. Standardize 491 as 'Nyitó mérleg számla'
UPDATE public.gl_accounts
   SET short_name = 'Nyitó mérleg számla'
 WHERE gl_number IN ('491', '491.', '4910')
    OR (gl_number LIKE '491%' AND short_name ILIKE '%nyit%m%rleg%');

-- 2. Standardize 492 as 'Záró mérleg számla'
UPDATE public.gl_accounts
   SET short_name = 'Záró mérleg számla'
 WHERE gl_number IN ('492', '492.', '4920')
    OR (gl_number LIKE '492%' AND short_name ILIKE '%z%r%m%rleg%');

-- 3. Ensure every preset has 491 and 492
DO $$
DECLARE
  r RECORD;
  v_49_id UUID;
BEGIN
  FOR r IN SELECT id FROM public.chart_of_accounts_presets LOOP
    -- Check if 49 parent exists
    SELECT id INTO v_49_id FROM public.gl_accounts WHERE preset_id = r.id AND gl_number IN ('49', '49.') LIMIT 1;
    
    -- Ensure 491 exists
    IF NOT EXISTS (SELECT 1 FROM public.gl_accounts WHERE preset_id = r.id AND gl_number IN ('491', '491.', '4910')) THEN
      INSERT INTO public.gl_accounts (preset_id, gl_number, short_name, parent_id)
      VALUES (r.id, '491', 'Nyitó mérleg számla', v_49_id);
    END IF;

    -- Ensure 492 exists
    IF NOT EXISTS (SELECT 1 FROM public.gl_accounts WHERE preset_id = r.id AND gl_number IN ('492', '492.', '4920')) THEN
      INSERT INTO public.gl_accounts (preset_id, gl_number, short_name, parent_id)
      VALUES (r.id, '492', 'Záró mérleg számla', v_49_id);
    END IF;
  END LOOP;
END $$;
