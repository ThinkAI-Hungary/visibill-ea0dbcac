-- ============================================================
-- VISIBILL DATABASE MIGRATION - PART 4: Functions
-- ============================================================

-- Helper functions
CREATE OR REPLACE FUNCTION public.update_updated_at_column() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$;
CREATE OR REPLACE FUNCTION public.update_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$;
CREATE OR REPLACE FUNCTION public.update_frissitve_column() RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$ BEGIN NEW.frissitve = now(); RETURN NEW; END; $$;
CREATE OR REPLACE FUNCTION public.update_settings_updated_at() RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
CREATE OR REPLACE FUNCTION public.update_user_subscriptions_updated_at() RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
CREATE OR REPLACE FUNCTION public.update_feedback_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- Auth helper functions
CREATE OR REPLACE FUNCTION public.user_is_company_member(p_company_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (SELECT 1 FROM public.company_members WHERE company_id = p_company_id AND user_id = auth.uid());
$$;
CREATE OR REPLACE FUNCTION public.user_has_company_access(p_company_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (SELECT 1 FROM public.company_members WHERE company_id = p_company_id AND user_id = auth.uid());
$$;
CREATE OR REPLACE FUNCTION public.is_company_admin(p_company_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (SELECT 1 FROM company_members WHERE company_id = p_company_id AND user_id = auth.uid() AND role IN ('owner','admin'));
$$;
CREATE OR REPLACE FUNCTION public.is_company_member_or_above(p_company_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (SELECT 1 FROM company_members WHERE company_id = p_company_id AND user_id = auth.uid() AND role IN ('owner','admin','member'));
$$;
CREATE OR REPLACE FUNCTION public.get_user_role(p_company_id uuid) RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT role FROM company_members WHERE company_id = p_company_id AND user_id = auth.uid() LIMIT 1;
$$;
CREATE OR REPLACE FUNCTION public.calculate_hourly_cost(p_base_salary numeric, p_monthly_hours numeric DEFAULT 168) RETURNS numeric LANGUAGE sql IMMUTABLE SET search_path TO 'public' AS $$
  SELECT ROUND(p_base_salary / NULLIF(p_monthly_hours, 0), 2);
$$;

-- on_company_created
CREATE OR REPLACE FUNCTION public.on_company_created() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  INSERT INTO public.company_members (user_id, company_id) VALUES (NEW.owner_id, NEW.id) ON CONFLICT (user_id, company_id) DO NOTHING;
  RETURN NEW;
END; $$;

-- initialize_email_preferences
CREATE OR REPLACE FUNCTION public.initialize_email_preferences() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  INSERT INTO public.user_email_preferences (user_id) VALUES (NEW.user_id) ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END; $$;

-- initialize_user_subscription
CREATE OR REPLACE FUNCTION public.initialize_user_subscription() RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  INSERT INTO public.user_subscriptions (user_id, tier, invoice_limit, invoices_used) VALUES (NEW.user_id, 'teszt', 999999, 0) ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END; $$;

-- increment_invoice_usage
CREATE OR REPLACE FUNCTION public.increment_invoice_usage(user_uuid uuid) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE current_usage INTEGER; current_limit INTEGER;
BEGIN
  SELECT invoices_used, invoice_limit INTO current_usage, current_limit FROM public.user_subscriptions WHERE user_id = user_uuid;
  IF current_usage >= current_limit THEN RETURN FALSE; END IF;
  UPDATE public.user_subscriptions SET invoices_used = invoices_used + 1, updated_at = now() WHERE user_id = user_uuid;
  RETURN TRUE;
END; $$;

-- reset_monthly_usage
CREATE OR REPLACE FUNCTION public.reset_monthly_usage() RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE reset_count INTEGER;
BEGIN
  UPDATE public.user_subscriptions SET invoices_used = 0, period_start = now(),
    period_end = CASE WHEN tier = 'salmon' THEN now() + INTERVAL '1 month' ELSE period_end + INTERVAL '1 month' END, updated_at = now()
  WHERE period_end <= now();
  GET DIAGNOSTICS reset_count = ROW_COUNT; RETURN reset_count;
END; $$;

-- generate_project_code
CREATE OR REPLACE FUNCTION public.generate_project_code() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_year_month TEXT; v_seq_num INTEGER;
BEGIN
  IF NEW.project_code IS NOT NULL THEN RETURN NEW; END IF;
  v_year_month := to_char(NOW(), 'YYYYMM');
  v_seq_num := nextval('projects_code_seq');
  NEW.project_code := 'PRJ-' || v_year_month || '-' || lpad(v_seq_num::TEXT, 4, '0');
  RETURN NEW;
END; $$;

-- audit functions
CREATE OR REPLACE FUNCTION public.audit_insert_delete_func() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_entity_name TEXT; v_company_id UUID; v_entity_type audit_entity_type;
BEGIN
  IF (TG_OP = 'INSERT') THEN
    v_company_id := NEW.company_id;
    IF TG_TABLE_NAME = 'invoices' THEN v_entity_type := 'számla'; v_entity_name := NEW.bizonylatsorszam;
    ELSIF TG_TABLE_NAME IN ('invoice_uploads','salary_files') THEN v_entity_type := 'dokumentum'; v_entity_name := NEW.file_name; END IF;
  ELSIF (TG_OP = 'DELETE') THEN
    v_company_id := OLD.company_id;
    IF TG_TABLE_NAME = 'invoices' THEN v_entity_type := 'számla'; v_entity_name := OLD.bizonylatsorszam;
    ELSIF TG_TABLE_NAME IN ('invoice_uploads','salary_files') THEN v_entity_type := 'dokumentum'; v_entity_name := OLD.file_name; END IF;
  END IF;
  IF v_company_id IS NOT NULL AND v_entity_name IS NOT NULL THEN
    INSERT INTO public.audit_logs (company_id, user_id, action, entity, entity_name)
    VALUES (v_company_id, auth.uid(), CASE WHEN TG_OP = 'INSERT' THEN 'feltöltés'::audit_action_type ELSE 'törlés'::audit_action_type END, v_entity_type, v_entity_name);
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END; $$;

CREATE OR REPLACE FUNCTION public.audit_update_processed_func() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF TG_TABLE_NAME = 'invoice_uploads' THEN
    IF OLD.processing_status IS DISTINCT FROM NEW.processing_status AND NEW.processing_status = 'completed' THEN
      INSERT INTO public.audit_logs (company_id, user_id, action, entity, entity_name, details)
      VALUES (NEW.company_id, auth.uid(), 'módosítás', 'dokumentum', NEW.file_name, jsonb_build_object('is_system', true, 'source', 'trigger', 'table', TG_TABLE_NAME));
    END IF;
  ELSIF TG_TABLE_NAME = 'salary_files' THEN
    IF OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'completed' THEN
      INSERT INTO public.audit_logs (company_id, user_id, action, entity, entity_name, details)
      VALUES (NEW.company_id, auth.uid(), 'módosítás', 'dokumentum', NEW.file_name, jsonb_build_object('is_system', true, 'source', 'trigger', 'table', TG_TABLE_NAME));
    END IF;
  END IF;
  RETURN NEW;
END; $$;

-- Invoice/transaction matching functions
CREATE OR REPLACE FUNCTION public.auto_approve_high_confidence() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.confidence_score IS NOT NULL AND NEW.confidence_score >= 0.9 AND NEW.matched_invoice_id IS NOT NULL AND (NEW.is_verified IS NULL OR NEW.is_verified = false) THEN
    NEW.is_verified := true; NEW.match_type := 'auto';
  END IF;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.auto_match_salary_transaction() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_salary_id UUID;
BEGIN
  IF NEW.type IS DISTINCT FROM 'bérek' THEN RETURN NEW; END IF;
  IF NEW.amount >= 0 OR NEW.matched_invoice_id IS NOT NULL OR NEW.company_id IS NULL THEN RETURN NEW; END IF;
  SELECT s.id INTO v_salary_id FROM salary s
  WHERE s.company_id = NEW.company_id AND s.tipus = 'bér' AND s."összeg" = ABS(NEW.amount)
    AND s.transaction_id IS NULL AND s."dátum" IS NOT NULL AND s."dátum" <= NEW.transaction_date AND s."dátum" >= (NEW.transaction_date - INTERVAL '60 days')
  ORDER BY s."dátum" ASC LIMIT 1;
  IF v_salary_id IS NOT NULL THEN NEW.matched_invoice_id := v_salary_id; NEW.is_verified := TRUE; NEW.match_type := 'auto'; END IF;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.clear_transaction_match_on_invoice_delete() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  UPDATE transactions SET matched_invoice_id = NULL, is_verified = false, match_type = NULL, confidence_score = NULL WHERE matched_invoice_id = OLD.id;
  RETURN OLD;
END; $$;

CREATE OR REPLACE FUNCTION public.set_invoice_feldolgozva_on_upload_link() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.invoice_uploads_id IS NOT NULL THEN
    NEW.statusz := 'feldolgozott';
    IF NEW.feldolgozva IS NULL THEN NEW.feldolgozva := NOW(); END IF;
  END IF;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.mark_invoice_upload_completed_on_invoice_insert() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.invoice_uploads_id IS NOT NULL THEN
    UPDATE invoice_uploads SET processing_status = 'completed', updated_at = now() WHERE id = NEW.invoice_uploads_id AND processing_status IN ('pending','processing','webhook_sent');
  END IF;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.mark_transaction_upload_completed_on_transaction_insert() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.upload_id IS NOT NULL THEN
    UPDATE transaction_uploads SET processing_status = 'completed', updated_at = now() WHERE id = NEW.upload_id AND processing_status IN ('pending','processing','webhook_sent');
  END IF;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.mark_salary_file_completed_on_salary_insert() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.salary_file_id IS NOT NULL THEN
    UPDATE salary_files SET status = 'completed', updated_at = now() WHERE id = NEW.salary_file_id AND status IN ('pending','processing','webhook_sent');
  END IF;
  RETURN NEW;
END; $$;

-- NAV matching functions
CREATE OR REPLACE FUNCTION public.mark_nav_invoice_as_submitted() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  UPDATE public.nav_invoices SET submitted = true
  WHERE invoice_number = NEW.bizonylatsorszam AND (company_id = NEW.company_id OR (company_id IS NULL AND NEW.company_id IS NULL)) AND submitted = false;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.reset_nav_submitted_on_invoice_delete() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  UPDATE nav_invoices SET submitted = false WHERE invoice_number = OLD.bizonylatsorszam AND company_id = OLD.company_id AND submitted = true;
  RETURN OLD;
END; $$;

CREATE OR REPLACE FUNCTION public.match_nav_invoice_on_insert() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_invoice_id UUID; v_has_transaction BOOLEAN;
BEGIN
  SELECT id INTO v_invoice_id FROM invoices WHERE bizonylatsorszam = NEW.invoice_number AND company_id = NEW.company_id LIMIT 1;
  IF v_invoice_id IS NOT NULL THEN
    NEW.submitted := true;
    SELECT EXISTS (SELECT 1 FROM transactions WHERE matched_invoice_id = v_invoice_id) INTO v_has_transaction;
    IF v_has_transaction THEN NEW.paid := true; END IF;
  END IF;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.enforce_invoice_single_project() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_existing_project_name TEXT;
BEGIN
  IF OLD.project_id IS NOT DISTINCT FROM NEW.project_id THEN RETURN NEW; END IF;
  IF OLD.project_id IS NULL OR NEW.project_id IS NULL THEN RETURN NEW; END IF;
  SELECT name INTO v_existing_project_name FROM projects WHERE id = OLD.project_id;
  RAISE EXCEPTION 'INVOICE_ALREADY_ASSIGNED::%::%', OLD.project_id, COALESCE(v_existing_project_name, 'Ismeretlen projekt');
END; $$;

-- Transaction paid/unpaid sync
CREATE OR REPLACE FUNCTION public.mark_nav_invoice_paid_on_transaction_match() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_bizonylatsorszam TEXT; v_company_id UUID;
BEGIN
  IF NEW.matched_invoice_id IS NULL THEN RETURN NEW; END IF;
  IF OLD IS NOT NULL AND OLD.matched_invoice_id IS NOT DISTINCT FROM NEW.matched_invoice_id THEN RETURN NEW; END IF;
  SELECT bizonylatsorszam, company_id INTO v_bizonylatsorszam, v_company_id FROM invoices WHERE id = NEW.matched_invoice_id;
  IF v_bizonylatsorszam IS NOT NULL AND v_company_id IS NOT NULL THEN
    UPDATE invoices SET transaction_id = NEW.id WHERE id = NEW.matched_invoice_id AND transaction_id IS DISTINCT FROM NEW.id;
    UPDATE nav_invoices SET paid = true, submitted = true, transaction_id = NEW.id
    WHERE invoice_number = v_bizonylatsorszam AND company_id = v_company_id AND (paid IS NULL OR paid = false OR submitted IS NULL OR submitted = false);
    RETURN NEW;
  END IF;
  IF EXISTS (SELECT 1 FROM nav_invoices WHERE id = NEW.matched_invoice_id) THEN
    UPDATE nav_invoices SET paid = true, transaction_id = NEW.id WHERE id = NEW.matched_invoice_id AND (paid IS NULL OR paid = false);
    RETURN NEW;
  END IF;
  UPDATE salary SET transaction_id = NEW.id WHERE id = NEW.matched_invoice_id AND transaction_id IS DISTINCT FROM NEW.id;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.reset_paid_on_transaction_delete() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF OLD.matched_invoice_id IS NOT NULL THEN
    UPDATE nav_invoices SET paid = false, transaction_id = NULL WHERE transaction_id = OLD.id;
    UPDATE invoices SET transaction_id = NULL WHERE transaction_id = OLD.id;
    UPDATE salary SET transaction_id = NULL WHERE transaction_id = OLD.id;
  END IF;
  RETURN OLD;
END; $$;

CREATE OR REPLACE FUNCTION public.reset_paid_on_transaction_unmatch() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF OLD.matched_invoice_id IS NOT NULL AND NEW.matched_invoice_id IS NULL THEN
    UPDATE nav_invoices SET paid = false, transaction_id = NULL WHERE transaction_id = OLD.id;
    UPDATE invoices SET transaction_id = NULL WHERE transaction_id = OLD.id;
    UPDATE salary SET transaction_id = NULL WHERE transaction_id = OLD.id;
  END IF;
  RETURN NEW;
END; $$;

-- Salary sync
CREATE OR REPLACE FUNCTION public.sync_salary_to_employee_rates() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_total_cost numeric; v_hourly numeric;
BEGIN
  IF NEW.munkavallalo_neve IS NOT NULL AND NEW.tipus IN ('bér','adó','járulék') THEN
    SELECT COALESCE(SUM("összeg"), 0) INTO v_total_cost FROM public.salary
    WHERE company_id = NEW.company_id AND munkavallalo_neve = NEW.munkavallalo_neve AND tipus IN ('bér','adó','járulék');
    v_hourly := public.calculate_hourly_cost(v_total_cost);
    INSERT INTO public.employee_rates (company_id, employee_name, base_salary_cost, hourly_rate, effective_date)
    VALUES (NEW.company_id, NEW.munkavallalo_neve, v_total_cost, v_hourly, COALESCE(NEW."dátum", CURRENT_DATE))
    ON CONFLICT (company_id, employee_name) DO UPDATE SET
      base_salary_cost = EXCLUDED.base_salary_cost,
      hourly_rate = CASE WHEN employee_rates.base_salary_cost IS NULL AND employee_rates.hourly_rate IS NOT NULL THEN employee_rates.hourly_rate ELSE EXCLUDED.hourly_rate END,
      effective_date = EXCLUDED.effective_date, updated_at = now();
  END IF;
  RETURN NEW;
END; $$;

-- Partner project assignment
CREATE OR REPLACE FUNCTION public.assign_supplier_default_projects(p_company_id uuid) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_updated_count INTEGER;
BEGIN
  UPDATE nav_invoices ni SET project_id = p.default_project_id FROM partners p
  WHERE ni.company_id = p_company_id AND ni.project_id IS NULL AND ni.invoice_direction = 'INBOUND' AND ni.supplier_partner_id = p.id AND p.default_project_id IS NOT NULL;
  GET DIAGNOSTICS v_updated_count = ROW_COUNT; RETURN v_updated_count;
END; $$;

-- NOTE: handle_new_user function needs to be updated with new project's anon key and URL after migration
-- Placeholder - UPDATE the anon_key and supabase_url below with your NEW project values!
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'extensions' AS $$
DECLARE verify_token text; request_id bigint;
  anon_key text := 'YOUR_NEW_ANON_KEY_HERE';
  supabase_url text := 'YOUR_NEW_SUPABASE_URL_HERE';
BEGIN
  verify_token := encode(gen_random_bytes(32), 'hex');
  INSERT INTO public.profiles (user_id, name, email_verified, email_verify_token)
  VALUES (NEW.id, NEW.raw_user_meta_data ->> 'name', false, verify_token);
  SELECT net.http_post(
    url := supabase_url || '/functions/v1/send-welcome-email',
    headers := jsonb_build_object('Content-Type','application/json','apikey',anon_key,'Authorization','Bearer ' || anon_key),
    body := jsonb_build_object('userId',NEW.id::text,'email',NEW.email,'name',COALESCE(NEW.raw_user_meta_data ->> 'name', split_part(NEW.email,'@',1)))
  ) INTO request_id;
  RETURN NEW;
END; $$;
