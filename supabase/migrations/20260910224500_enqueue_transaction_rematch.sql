-- Migration: 20260910224500_enqueue_transaction_rematch.sql
-- Description:
-- Creates public.enqueue_transaction_rematch(p_company_id uuid) RPC
-- Enqueues a rematch job to PGMQ queue 'transaction_jobs' with SECURITY DEFINER
-- Checks membership/permissions for the caller.

CREATE OR REPLACE FUNCTION public.enqueue_transaction_rematch(p_company_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_msg_id bigint;
  v_user_id uuid;
  v_has_access boolean;
BEGIN
  v_user_id := auth.uid();

  -- Verify membership: caller must be owner/member/accountant of the company, or admin
  IF v_user_id IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM public.companies WHERE id = p_company_id AND owner_id = v_user_id
      UNION
      SELECT 1 FROM public.company_members WHERE company_id = p_company_id AND user_id = v_user_id
      UNION
      SELECT 1 FROM public.accounty_assignments WHERE company_id = p_company_id AND accountant_user_id = v_user_id
      UNION
      SELECT 1 FROM public.profiles WHERE id = v_user_id AND role IN ('admin', 'support_admin', 'thinkai_admin')
    ) INTO v_has_access;

    IF NOT v_has_access THEN
      RAISE EXCEPTION 'Access denied: not authorized for this company';
    END IF;
  END IF;

  SELECT public.pgmq_send_retry(
    'transaction_jobs',
    jsonb_build_object(
      'job_type', 'rematch',
      'company_id', p_company_id,
      'user_id', v_user_id,
      'source', 'user_manual'
    )
  ) INTO v_msg_id;

  RETURN jsonb_build_object(
    'success', true,
    'message_id', v_msg_id,
    'company_id', p_company_id
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.enqueue_transaction_rematch(uuid) TO authenticated, service_role;
