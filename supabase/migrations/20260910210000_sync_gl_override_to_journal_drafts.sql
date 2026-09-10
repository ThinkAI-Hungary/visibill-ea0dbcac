-- Migration: 20260910210000_sync_gl_override_to_journal_drafts.sql
-- Description: Ensure override_gl_classification automatically synchronizes gl_account_id to acc_journal_lines
-- for existing draft and posted journal entries (using allow_gl_remap), preventing classification desynchronization.

CREATE OR REPLACE FUNCTION public.override_gl_classification(
  p_item_id uuid,
  p_source_table text,
  p_new_gl_account_id uuid,
  p_original_gl_account_id uuid,
  p_company_id uuid,
  p_user_id uuid,
  p_preset_id uuid,
  p_new_gl_number text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF p_new_gl_account_id IS NULL THEN
    -- A felhasználó eltávolította a kategóriát (Besorolatlan tétel)
    -- 1. Töröljük a logból
    DELETE FROM public.gl_overrides_log WHERE item_id = p_item_id;

    -- 2. Töröljük a JSON objektumból az aktuális preset kulcsot a megfelelő forrástáblában
    IF p_source_table = 'transactions' THEN
      UPDATE public.transactions 
      SET gl_classifications = gl_classifications - p_preset_id::text 
      WHERE id = p_item_id;
    ELSIF p_source_table = 'invoices' THEN
      UPDATE public.invoices 
      SET gl_classifications = gl_classifications - p_preset_id::text 
      WHERE id = p_item_id;
    ELSIF p_source_table = 'invoice_items' THEN
      UPDATE public.invoice_items 
      SET gl_classifications = gl_classifications - p_preset_id::text 
      WHERE id = p_item_id;
    ELSIF p_source_table = 'nav_invoice_items' THEN
      UPDATE public.nav_invoice_items 
      SET gl_classifications = gl_classifications - p_preset_id::text 
      WHERE id = p_item_id;
    END IF;

  ELSE
    -- Normál kézi módosítás
    -- 1. Naplózás a log táblába
    INSERT INTO public.gl_overrides_log (
      item_id,
      source_table,
      original_gl_account_id,
      new_gl_account_id,
      company_id,
      user_id,
      created_at
    ) VALUES (
      p_item_id,
      p_source_table,
      p_original_gl_account_id,
      p_new_gl_account_id,
      p_company_id,
      p_user_id,
      now()
    );

    -- 2. A forrástábla JSONB mezőjének frissítése
    IF p_source_table = 'transactions' THEN
      UPDATE public.transactions
      SET gl_classifications = jsonb_set(
        COALESCE(gl_classifications, '{}'::jsonb), 
        array[p_preset_id::text], 
        jsonb_build_object('gl_account_id', p_new_gl_account_id, 'gl_number', p_new_gl_number, 'is_manual', true, 'reasoning', 'Kézi módosítás az admin felületről')
      )
      WHERE id = p_item_id;
    ELSIF p_source_table = 'invoices' THEN
      UPDATE public.invoices
      SET gl_classifications = jsonb_set(
        COALESCE(gl_classifications, '{}'::jsonb), 
        array[p_preset_id::text], 
        jsonb_build_object('gl_account_id', p_new_gl_account_id, 'gl_number', p_new_gl_number, 'is_manual', true, 'reasoning', 'Kézi módosítás az admin felületről')
      )
      WHERE id = p_item_id;
    ELSIF p_source_table = 'invoice_items' THEN
      UPDATE public.invoice_items
      SET gl_classifications = jsonb_set(
        COALESCE(gl_classifications, '{}'::jsonb), 
        array[p_preset_id::text], 
        jsonb_build_object('gl_account_id', p_new_gl_account_id, 'gl_number', p_new_gl_number, 'is_manual', true, 'reasoning', 'Kézi módosítás az admin felületről')
      )
      WHERE id = p_item_id;
    ELSIF p_source_table = 'nav_invoice_items' THEN
      UPDATE public.nav_invoice_items
      SET gl_classifications = jsonb_set(
        COALESCE(gl_classifications, '{}'::jsonb), 
        array[p_preset_id::text], 
        jsonb_build_object('gl_account_id', p_new_gl_account_id, 'gl_number', p_new_gl_number, 'is_manual', true, 'reasoning', 'Kézi módosítás az admin felületről')
      )
      WHERE id = p_item_id;
    END IF;

    -- 3. Szinkronizálás a naplótételekkel (acc_journal_lines):
    -- Ha már létezik hozzá naplóbejegyzés, akkor az operatív költség/bevétel sorát is azonnal átállítjuk az új főkönyvi számra!
    -- Az allow_gl_remap engedélyezésével mind a tervezetek, mind a már lekönyvelt tételek szinkronban maradnak.
    PERFORM set_config('visibill.allow_gl_remap', 'true', true);

    UPDATE public.acc_journal_lines ajl
    SET gl_account_id = p_new_gl_account_id
    FROM public.acc_journal_headers ajh
    WHERE ajl.header_id = ajh.id
      AND ajh.import_key = p_item_id::text
      AND ajh.status <> 'SZTORNOZOTT'
      AND (
        (p_original_gl_account_id IS NOT NULL AND ajl.gl_account_id = p_original_gl_account_id)
        OR (p_original_gl_account_id IS NULL AND NOT EXISTS (
          SELECT 1 FROM public.gl_accounts ga 
          WHERE ga.id = ajl.gl_account_id 
            AND (ga.gl_number LIKE '311%' OR ga.gl_number LIKE '454%' OR ga.gl_number LIKE '38%' OR ga.gl_number LIKE '466%' OR ga.gl_number LIKE '467%')
        ))
      );
  END IF;

  RETURN true;
END;
$$;
