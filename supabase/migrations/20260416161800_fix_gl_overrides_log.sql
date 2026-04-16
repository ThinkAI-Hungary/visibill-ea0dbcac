-- Add source_table column to gl_overrides_log which is required by the updated RPC
ALTER TABLE public.gl_overrides_log ADD COLUMN IF NOT EXISTS source_table text;
