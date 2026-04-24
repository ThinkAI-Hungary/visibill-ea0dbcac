-- Batch implementation for overriding GL classifications
-- Iterates over a JSONB array of items and delegates to the single override_gl_classification RPC

CREATE OR REPLACE FUNCTION public.override_gl_classifications_batch(
  p_items jsonb,
  p_new_gl_account_id uuid,
  p_company_id uuid,
  p_user_id uuid,
  p_preset_id uuid,
  p_new_gl_number text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_item jsonb;
  v_item_id uuid;
  v_source_table text;
  v_original_gl_account_id uuid;
BEGIN
  -- Validate input is a JSON array
  IF jsonb_typeof(p_items) != 'array' THEN
    RAISE EXCEPTION 'p_items must be a JSON array';
  END IF;

  -- Iterate through items array
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_item_id := (v_item->>'item_id')::uuid;
    v_source_table := v_item->>'source_table';
    
    -- Handle optional original_gl_account_id
    IF (v_item->>'original_gl_account_id') IS NOT NULL AND (v_item->>'original_gl_account_id') != '' THEN
      v_original_gl_account_id := (v_item->>'original_gl_account_id')::uuid;
    ELSE
      v_original_gl_account_id := NULL;
    END IF;

    -- Call the original single-item function
    PERFORM public.override_gl_classification(
      v_item_id,
      v_source_table,
      p_new_gl_account_id,
      v_original_gl_account_id,
      p_company_id,
      p_user_id,
      p_preset_id,
      p_new_gl_number
    );
  END LOOP;

  RETURN true;
END;
$$;
