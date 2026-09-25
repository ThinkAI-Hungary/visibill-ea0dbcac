-- Migration: Mark read-only reporting and calculation RPC functions as STABLE
-- Prevents PostgREST from treating analytical read queries as mutating POST requests
-- in public.check_request(), eliminating false-positive HTTP 429 rate limit triggers.

ALTER FUNCTION public.get_gl_balances(
  uuid, uuid, date, date, jsonb, text, text
) STABLE;

ALTER FUNCTION public.get_gl_categorized_items(
  uuid, uuid, date, date, jsonb, text, text, uuid, integer, integer
) STABLE;

ALTER FUNCTION public.get_pnl_report(
  uuid, uuid, date, date, jsonb
) STABLE;

ALTER FUNCTION public.get_vat_breakdown(
  uuid, date, date
) STABLE;
