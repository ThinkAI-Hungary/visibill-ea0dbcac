-- RPC to delete an audit import and all its journal entries
-- SECURITY DEFINER allows us to override statement_timeout
CREATE OR REPLACE FUNCTION public.delete_audit_import(p_import_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET statement_timeout = '120s'
AS $$
BEGIN
  -- Delete journal entries first (bulk, can be 70k+ rows)
  DELETE FROM public.gl_journal_entries WHERE import_id = p_import_id;
  
  -- Delete the import record
  DELETE FROM public.gl_audit_imports WHERE id = p_import_id;
END;
$$;
