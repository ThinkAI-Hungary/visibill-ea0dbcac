-- 1. Fix invoice_type DEFAULT to match CHECK constraint
ALTER TABLE public.invoices ALTER COLUMN invoice_type SET DEFAULT 'sima_szla';

-- 2. Fix invoices UNIQUE: user_id → company_id
ALTER TABLE public.invoices DROP CONSTRAINT invoices_user_id_szamlaszam_key;
ALTER TABLE public.invoices ADD CONSTRAINT invoices_company_id_bizonylatsorszam_key UNIQUE (company_id, bizonylatsorszam);

-- 3. Fix nav_invoices UNIQUE: user_id → company_id
ALTER TABLE public.nav_invoices DROP CONSTRAINT nav_invoices_user_id_invoice_number_key;
ALTER TABLE public.nav_invoices ADD CONSTRAINT nav_invoices_company_id_invoice_number_key UNIQUE (company_id, invoice_number);

-- 4. Drop orphan global_audit_trigger_func
DROP FUNCTION IF EXISTS public.global_audit_trigger_func() CASCADE;

-- 5. Add search_path to audit_insert_delete_func
CREATE OR REPLACE FUNCTION public.audit_insert_delete_func()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_entity_name TEXT;
    v_company_id UUID;
    v_entity_type audit_entity_type;
BEGIN
    IF (TG_OP = 'INSERT') THEN
        v_company_id := NEW.company_id;
        IF (TG_TABLE_NAME = 'invoices') THEN
            v_entity_type := 'számla'; v_entity_name := NEW.bizonylatsorszam;
        ELSIF (TG_TABLE_NAME = 'invoice_uploads' OR TG_TABLE_NAME = 'salary_files') THEN
            v_entity_type := 'dokumentum'; v_entity_name := NEW.file_name;
        END IF;
    ELSIF (TG_OP = 'DELETE') THEN
        v_company_id := OLD.company_id;
        IF (TG_TABLE_NAME = 'invoices') THEN
            v_entity_type := 'számla'; v_entity_name := OLD.bizonylatsorszam;
        ELSIF (TG_TABLE_NAME = 'invoice_uploads' OR TG_TABLE_NAME = 'salary_files') THEN
            v_entity_type := 'dokumentum'; v_entity_name := OLD.file_name;
        END IF;
    END IF;

    IF (v_company_id IS NOT NULL AND v_entity_name IS NOT NULL) THEN
        INSERT INTO public.audit_logs (company_id, user_id, action, entity, entity_name)
        VALUES (v_company_id, auth.uid(), CASE WHEN TG_OP = 'INSERT' THEN 'feltöltés'::audit_action_type ELSE 'törlés'::audit_action_type END, v_entity_type, v_entity_name);
    END IF;
    IF (TG_OP = 'DELETE') THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$function$;

-- 6. Add search_path to audit_update_processed_func
CREATE OR REPLACE FUNCTION public.audit_update_processed_func()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
    IF (TG_TABLE_NAME = 'invoice_uploads') THEN
        IF (OLD.processing_status IS DISTINCT FROM NEW.processing_status AND NEW.processing_status = 'completed') THEN
            INSERT INTO public.audit_logs (company_id, user_id, action, entity, entity_name, details)
            VALUES (NEW.company_id, auth.uid(), 'módosítás', 'dokumentum', NEW.file_name,
                    jsonb_build_object('is_system', true, 'source', 'trigger', 'table', TG_TABLE_NAME));
        END IF;
    ELSIF (TG_TABLE_NAME = 'salary_files') THEN
        IF (OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'completed') THEN
            INSERT INTO public.audit_logs (company_id, user_id, action, entity, entity_name, details)
            VALUES (NEW.company_id, auth.uid(), 'módosítás', 'dokumentum', NEW.file_name,
                    jsonb_build_object('is_system', true, 'source', 'trigger', 'table', TG_TABLE_NAME));
        END IF;
    END IF;
    RETURN NEW;
END;
$function$;

-- 7. Create missing indexes on FK columns
CREATE INDEX IF NOT EXISTS idx_nav_invoices_transaction_id ON public.nav_invoices (transaction_id);
CREATE INDEX IF NOT EXISTS idx_salary_user_id ON public.salary (user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_upload_id ON public.transactions (upload_id);

-- 8. Add missing FK for invoices.project_id
ALTER TABLE public.invoices ADD CONSTRAINT invoices_project_id_fkey 
  FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE SET NULL;