-- Migration: 20260930050000_grant_get_aggreg8_customer_token_to_anon.sql
-- Description: Restore EXECUTE permission on public.get_aggreg8_customer_token() for anon role.
-- Context: Downstream satellite instances (such as vsweb) retrieve the shared Aggreg8 customer token
--          from eaisybill-prod master via PostgREST RPC using the anon key. Revocation caused 42501 errors.

GRANT EXECUTE ON FUNCTION public.get_aggreg8_customer_token() TO anon;
GRANT EXECUTE ON FUNCTION public.get_aggreg8_customer_token() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_aggreg8_customer_token() TO service_role;
