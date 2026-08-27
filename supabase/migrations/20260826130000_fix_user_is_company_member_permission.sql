-- Migration: Fix permission denied for function user_is_company_member in RLS policies
-- Date: 2026-08-26
-- Reason: Grant execute permission to anon and authenticated roles to prevent crashes during RLS evaluation.

GRANT EXECUTE ON FUNCTION public.user_is_company_member(uuid) TO anon, authenticated;
