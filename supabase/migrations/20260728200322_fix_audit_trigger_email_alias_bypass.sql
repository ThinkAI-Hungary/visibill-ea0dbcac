-- Migration: fix_audit_trigger_email_alias_bypass
-- Purpose: Allow email_alias (Mailgun) INSERT events to be written to audit_logs
--          even when the Edge Function runs with service_role.
--
-- Root cause: The global_audit_trigger_func() guard `auth.role() <> 'service_role'`
--   was correctly blocking management-dashboard UPDATEs/DELETEs from polluting
--   audit_logs, but also blocked all Mailgun webhook INSERTs (which also run with
--   service_role). This caused the Activity Log to stop showing email-delivered
--   files after the first service_role-authenticated upload.
--
-- Fix: Add a targeted bypass for INSERT operations where metadata->>'source' =
--   'email_alias'. The `TG_OP = 'INSERT'` constraint ensures UPDATEs and DELETEs
--   by service_role are still blocked — only new email-alias file inserts bypass.
--
-- Security analysis:
--   - Regular authenticated users cannot insert with service_role (RLS blocks them)
--   - service_role is only used by trusted Edge Functions (server-side code we own)
--   - The bypass only applies to INSERT, not UPDATE or DELETE operations
--   - Adding TG_OP = 'INSERT' prevents any UPDATE-based metadata manipulation
--
-- Also adds tr_audit_global trigger to transaction_uploads and report_uploads
--   so that manually-initiated uploads from those tables are also tracked.
--   (Mailgun uploads into those tables were also missing from the Activity Log.)
--
-- Affected tables: invoice_uploads (trigger function change)
--                  transaction_uploads (new trigger)
--                  report_uploads (new trigger)
-- ADR references: A-017 (audit trail), A-020 (trigger SECURITY DEFINER rules)

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Update the global_audit_trigger_func to allow email_alias INSERT bypass
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.global_audit_trigger_func()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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
        ELSIF (TG_TABLE_NAME IN ('invoice_uploads', 'transaction_uploads', 'report_uploads', 'salary_files')) THEN
            v_entity_type := 'dokumentum'::audit_entity_type;
            v_entity_name := NEW.file_name;
        ELSIF (TG_TABLE_NAME = 'transactions') THEN
            v_entity_type := 'tranzakció'::audit_entity_type;
            v_entity_name := COALESCE(NEW.description, 'Új tranzakció');
        END IF;

        -- Extract upload source from metadata (email_alias, manual, etc.)
        IF (TG_TABLE_NAME IN ('invoice_uploads', 'transaction_uploads', 'report_uploads')) THEN
            v_upload_source := NEW.metadata->>'source';
        END IF;

    ELSIF (TG_OP = 'DELETE') THEN
        v_action := 'törlés'::audit_action_type;
        v_company_id := OLD.company_id;
        
        IF (TG_TABLE_NAME = 'invoices') THEN
            v_entity_type := 'számla'::audit_entity_type;
            v_entity_name := OLD.bizonylatsorszam;
        ELSIF (TG_TABLE_NAME IN ('invoice_uploads', 'transaction_uploads', 'report_uploads', 'salary_files')) THEN
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
    
    -- Add upload source info (email_alias, manual, etc.)
    IF v_upload_source IS NOT NULL THEN
        v_details := v_details || jsonb_build_object('upload_source', v_upload_source);
    END IF;
    
    -- For processing completion, add is_system flag
    IF (TG_OP = 'UPDATE' AND TG_TABLE_NAME = 'invoice_uploads') THEN
        v_details := v_details || jsonb_build_object('is_system', true, 'processing_type', 'invoice_processed');
    END IF;

    -- Write to audit_logs if:
    --   a) caller is NOT service_role (regular frontend actions), OR
    --   b) caller IS service_role BUT this is an email_alias INSERT
    --      (Mailgun webhook EF runs as service_role; TG_OP guard prevents
    --       UPDATE/DELETE service_role operations from bypassing the guard)
    IF (
        v_company_id IS NOT NULL
        AND v_entity_name IS NOT NULL
        AND (
            auth.role() <> 'service_role'
            OR (TG_OP = 'INSERT' AND v_upload_source = 'email_alias')
        )
    ) THEN
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

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Add tr_audit_global trigger to transaction_uploads (was missing)
-- ─────────────────────────────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS tr_audit_global ON public.transaction_uploads;

CREATE TRIGGER tr_audit_global
AFTER INSERT OR UPDATE OR DELETE ON public.transaction_uploads
FOR EACH ROW EXECUTE FUNCTION public.global_audit_trigger_func();

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Add tr_audit_global trigger to report_uploads (was missing)
-- ─────────────────────────────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS tr_audit_global ON public.report_uploads;

CREATE TRIGGER tr_audit_global
AFTER INSERT OR UPDATE OR DELETE ON public.report_uploads
FOR EACH ROW EXECUTE FUNCTION public.global_audit_trigger_func();
