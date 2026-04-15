CREATE OR REPLACE FUNCTION public.override_gl_classification(
    p_item_id uuid,
    p_source_table text,
    p_new_gl_account_id uuid,
    p_original_gl_account_id uuid,
    p_company_id uuid,
    p_user_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- 1. Update the actual table
    IF p_source_table = 'transactions' THEN
        UPDATE public.transactions
        SET gl_account_id = p_new_gl_account_id,
            gl_is_manually_overridden = true
        WHERE id = p_item_id;
    ELSIF p_source_table = 'invoices' THEN
        UPDATE public.invoices
        SET gl_account_id = p_new_gl_account_id,
            gl_is_manually_overridden = true
        WHERE id = p_item_id;
    ELSIF p_source_table = 'nav_invoices' THEN
        UPDATE public.nav_invoices
        SET gl_account_id = p_new_gl_account_id,
            gl_is_manually_overridden = true
        WHERE id = p_item_id;
    ELSE
        RAISE EXCEPTION 'Unknown source table: %', p_source_table;
    END IF;

    -- 2. Insert into the gl_overrides_log
    INSERT INTO public.gl_overrides_log (
        item_id,
        new_gl_account_id,
        original_gl_account_id,
        company_id,
        user_id,
        created_at
    ) VALUES (
        p_item_id,
        p_new_gl_account_id,
        p_original_gl_account_id,
        p_company_id,
        p_user_id,
        now()
    );

    RETURN true;
END;
$$;
