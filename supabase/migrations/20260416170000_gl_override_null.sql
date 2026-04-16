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
    ELSIF p_source_table = 'nav_invoice_items' THEN
      UPDATE public.nav_invoice_items
      SET gl_classifications = jsonb_set(
        COALESCE(gl_classifications, '{}'::jsonb), 
        array[p_preset_id::text], 
        jsonb_build_object('gl_account_id', p_new_gl_account_id, 'gl_number', p_new_gl_number, 'is_manual', true, 'reasoning', 'Kézi módosítás az admin felületről')
      )
      WHERE id = p_item_id;
    END IF;
  END IF;

  RETURN true;
END;
$$;
