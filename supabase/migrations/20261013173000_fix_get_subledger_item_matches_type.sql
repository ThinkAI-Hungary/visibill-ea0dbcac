-- Migration: 20261013173000_fix_get_subledger_item_matches_type.sql
-- Description: Fix column 15 return type mismatch (text vs varchar) in get_subledger_item_matches RPC (Error 42804)

DROP FUNCTION IF EXISTS public.get_subledger_item_matches(uuid, uuid);

CREATE OR REPLACE FUNCTION public.get_subledger_item_matches(
  p_company_id uuid,
  p_line_id uuid
)
RETURNS TABLE(
  match_id uuid,
  settled_amount_huf numeric,
  settled_amount_foreign numeric,
  currency character,
  settled_at timestamp with time zone,
  match_type character varying,
  notes text,
  other_line_id uuid,
  other_header_id uuid,
  other_document_id character varying,
  other_posting_date date,
  other_dc_type character,
  other_amount numeric,
  other_journal_code character varying,
  other_description text
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    m.id AS match_id,
    m.settled_amount_huf,
    m.settled_amount_foreign,
    m.currency,
    m.settled_at,
    m.match_type,
    m.notes,
    other_l.id AS other_line_id,
    other_h.id AS other_header_id,
    other_h.document_id AS other_document_id,
    other_h.posting_date AS other_posting_date,
    other_l.dc_type AS other_dc_type,
    other_l.amount AS other_amount,
    other_j.code AS other_journal_code,
    other_l.description::TEXT AS other_description
  FROM public.acc_open_item_matches m
  JOIN public.acc_journal_lines other_l 
    ON other_l.id = (CASE WHEN m.invoice_line_id = p_line_id THEN m.settling_line_id ELSE m.invoice_line_id END)
  JOIN public.acc_journal_headers other_h ON other_h.id = other_l.header_id
  JOIN public.acc_journals other_j ON other_j.id = other_h.journal_id
  WHERE m.company_id = p_company_id
    AND (m.invoice_line_id = p_line_id OR m.settling_line_id = p_line_id)
  ORDER BY m.settled_at DESC;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.get_subledger_item_matches(uuid, uuid) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_subledger_item_matches(uuid, uuid) TO authenticated, service_role;
