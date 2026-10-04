-- ==============================================================================
-- pgTAP Test: service-role-only queue & NAV persistence RPCs
-- Covers migration: 20261003225350_restrict_service_only_queue_and_nav_rpcs.sql
-- Threat model: logged-in users (authenticated) must NOT be able to
--   * overwrite another tenant's NAV invoice/items (save_nav_invoice_details_and_items)
--   * hide / inject / inspect PGMQ messages (pgmq_set_vt, pgmq_send_retry,
--     peek_queue_items, pgmq_metrics_all)
--   * trigger full-table aggregation scans at will (refresh_company_counts_cache)
-- All legitimate callers use service_role (Edge Functions, Python worker) or run
-- inside other SECURITY DEFINER functions / pg_cron as owner.
-- Run: npx supabase test db  (or execute directly - ends with ROLLBACK)
-- ==============================================================================

BEGIN;

SET search_path TO 'public', 'extensions';

SELECT plan(27);

-- ---------------------------------------------------------------------------
-- 1. Privilege matrix (catalog level) - 6 functions x 4 checks = 24 tests
-- ---------------------------------------------------------------------------
CREATE TEMP TABLE _svc_only_fns(sig regprocedure) ON COMMIT DROP;
INSERT INTO _svc_only_fns VALUES
  ('public.save_nav_invoice_details_and_items(uuid, jsonb, jsonb)'::regprocedure),
  ('public.pgmq_set_vt(text, bigint, integer)'::regprocedure),
  ('public.pgmq_send_retry(text, jsonb)'::regprocedure),
  ('public.peek_queue_items(text, integer)'::regprocedure),
  ('public.pgmq_metrics_all()'::regprocedure),
  ('public.refresh_company_counts_cache()'::regprocedure);

SELECT ok(NOT has_function_privilege('anon', sig, 'EXECUTE'),
          format('anon must NOT execute %s', sig))
FROM _svc_only_fns;

SELECT ok(NOT has_function_privilege('authenticated', sig, 'EXECUTE'),
          format('authenticated must NOT execute %s', sig))
FROM _svc_only_fns;

SELECT ok(has_function_privilege('service_role', sig, 'EXECUTE'),
          format('service_role MUST execute %s', sig))
FROM _svc_only_fns;

-- PUBLIC pseudo-role must not hold EXECUTE (would leak to every role)
SELECT ok(
  NOT EXISTS (
    SELECT 1 FROM pg_proc p, aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
    WHERE p.oid = sig AND a.grantee = 0 AND a.privilege_type = 'EXECUTE'
  ),
  format('PUBLIC must NOT hold EXECUTE on %s', sig))
FROM _svc_only_fns;

-- ---------------------------------------------------------------------------
-- 2. Behavioural check: authenticated call is rejected with 42501
-- ---------------------------------------------------------------------------
SELECT throws_ok(
  $$SET LOCAL ROLE authenticated;
    SELECT public.save_nav_invoice_details_and_items('00000000-0000-0000-0000-000000000000'::uuid, '{}'::jsonb, '[]'::jsonb)$$,
  '42501',
  NULL,
  'authenticated call to save_nav_invoice_details_and_items must be denied (42501)'
);
RESET ROLE;

-- ---------------------------------------------------------------------------
-- 3. Tenant integrity: item-level company_id override is ignored
--    (rows always inherit the parent invoice company_id)
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_inv  uuid;
  v_comp uuid;
BEGIN
  SELECT id, company_id INTO v_inv, v_comp
  FROM public.nav_invoices WHERE company_id IS NOT NULL LIMIT 1;
  PERFORM set_config('test.inv', v_inv::text, true);
  PERFORM set_config('test.comp', v_comp::text, true);
END $$;

-- Re-send the invoice's existing lines + one probe line carrying a FOREIGN company_id.
-- Existing lines must be preserved (no deletion), probe must land on the invoice's own company.
SELECT lives_ok(
  $$SELECT public.save_nav_invoice_details_and_items(
      current_setting('test.inv')::uuid,
      '{}'::jsonb,
      coalesce((SELECT jsonb_agg(jsonb_build_object(
                  'line_number', line_number, 'company_id', company_id,
                  'net_amount', net_amount, 'vat_amount', vat_amount, 'gross_amount', gross_amount,
                  'line_description', line_description, 'vat_rate', vat_rate,
                  'quantity', quantity, 'unit_price', unit_price, 'unit_of_measure', unit_of_measure,
                  'product_code', product_code))
                FROM public.nav_invoice_items WHERE nav_invoice_id = current_setting('test.inv')::uuid),
               '[]'::jsonb)
      || jsonb_build_array(jsonb_build_object(
           'line_number', 99999, 'company_id', '11111111-1111-1111-1111-111111111111',
           'net_amount', 1, 'vat_amount', 0, 'gross_amount', 1, 'line_description', 'pgtap probe')))$$,
  'service-level call with a foreign item company_id must not error'
);

SELECT is(
  (SELECT company_id FROM public.nav_invoice_items
    WHERE nav_invoice_id = current_setting('test.inv')::uuid AND line_number = 99999),
  current_setting('test.comp')::uuid,
  'inserted line must inherit the parent invoice company_id, foreign company_id is ignored'
);

SELECT * FROM finish();

ROLLBACK;
