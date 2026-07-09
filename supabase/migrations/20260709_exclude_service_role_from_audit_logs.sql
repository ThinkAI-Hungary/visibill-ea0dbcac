-- Modify global_audit_trigger_func to:
-- Exclude service_role actions from audit_logs
CREATE OR REPLACE FUNCTION public.global_audit_trigger_func()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    current_user_id UUID := auth.uid();
    v_entity_type audit_entity_type;
    v_entity_name TEXT;
    v_company_id UUID;
    v_action audit_action_type;
    v_details JSONB;
    v_upload_source TEXT;
BEGIN
    IF (TG_OP = 'INSERT') THEN
        v_action := 'feltöltés'::audit_action_type;
        v_company_id := NEW.company_id;
        
        IF (TG_TABLE_NAME = 'invoices') THEN
            v_entity_type := 'számla'::audit_entity_type;
            v_entity_name := NEW.bizonylatsorszam;
        ELSIF (TG_TABLE_NAME IN ('invoice_uploads', 'salary_files')) THEN
            v_entity_type := 'dokumentum'::audit_entity_type;
            v_entity_name := NEW.file_name;
        ELSIF (TG_TABLE_NAME = 'transactions') THEN
            v_entity_type := 'tranzakció'::audit_entity_type;
            v_entity_name := COALESCE(NEW.description, 'Új tranzakció');
        END IF;

        -- Extract upload source from metadata (email_alias, manual, etc.)
        IF (TG_TABLE_NAME = 'invoice_uploads') THEN
            v_upload_source := NEW.metadata->>'source';
        END IF;

    ELSIF (TG_OP = 'DELETE') THEN
        v_action := 'törlés'::audit_action_type;
        v_company_id := OLD.company_id;
        
        IF (TG_TABLE_NAME = 'invoices') THEN
            v_entity_type := 'számla'::audit_entity_type;
            v_entity_name := OLD.bizonylatsorszam;
        ELSIF (TG_TABLE_NAME IN ('invoice_uploads', 'salary_files')) THEN
            v_entity_type := 'dokumentum'::audit_entity_type;
            v_entity_name := OLD.file_name;
        ELSIF (TG_TABLE_NAME = 'transactions') THEN
            v_entity_type := 'tranzakció'::audit_entity_type;
            v_entity_name := COALESCE(OLD.description, 'Törölt tranzakció');
        END IF;

    ELSIF (TG_OP = 'UPDATE') THEN
        v_company_id := NEW.company_id;
        
        IF (TG_TABLE_NAME = 'invoices') THEN
            IF (OLD.statusz IS DISTINCT FROM NEW.statusz AND NEW.statusz = 'feldolgozott') THEN
                v_action := 'módosítás'::audit_action_type;
                v_entity_type := 'számla'::audit_entity_type;
                v_entity_name := NEW.bizonylatsorszam;
            ELSE RETURN NEW; END IF;
        ELSIF (TG_TABLE_NAME = 'invoice_uploads') THEN
            IF (OLD.processing_status IS DISTINCT FROM NEW.processing_status 
                AND NEW.processing_status = 'processed') THEN
                v_action := 'módosítás'::audit_action_type;
                v_entity_type := 'dokumentum'::audit_entity_type;
                v_entity_name := NEW.file_name;
            ELSE RETURN NEW; END IF;
        ELSIF (TG_TABLE_NAME = 'salary_files') THEN
            IF (OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'completed') THEN
                v_action := 'módosítás'::audit_action_type;
                v_entity_type := 'dokumentum'::audit_entity_type;
                v_entity_name := NEW.file_name;
            ELSE RETURN NEW; END IF;
        ELSE RETURN NEW; END IF;
    END IF;

    -- Build details JSON
    v_details := jsonb_build_object('source', 'trigger', 'table', TG_TABLE_NAME, 'op', TG_OP);
    
    -- Add upload source info (mailgun, manual, etc.)
    IF v_upload_source IS NOT NULL THEN
        v_details := v_details || jsonb_build_object('upload_source', v_upload_source);
    END IF;
    
    -- For processing completion, add is_system flag
    IF (TG_OP = 'UPDATE' AND TG_TABLE_NAME = 'invoice_uploads') THEN
        v_details := v_details || jsonb_build_object('is_system', true, 'processing_type', 'invoice_processed');
    END IF;

    -- Only write to audit logs if auth.role() is not 'service_role' (to exclude management dashboard deletions/background processing)
    IF (v_company_id IS NOT NULL AND v_entity_name IS NOT NULL AND auth.role() <> 'service_role') THEN
        INSERT INTO public.audit_logs (company_id, user_id, action, entity, entity_name, details)
        VALUES (
            v_company_id, 
            current_user_id, 
            v_action, 
            v_entity_type, 
            v_entity_name,
            v_details
        );
    END IF;

    IF (TG_OP = 'DELETE') THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$function$;
