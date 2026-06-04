-- Add requested_item_ids to portal tokens so we know exactly which documents were requested via this magic link
ALTER TABLE public.accounty_portal_tokens
  ADD COLUMN IF NOT EXISTS requested_item_ids UUID[] DEFAULT '{}';

COMMENT ON COLUMN public.accounty_portal_tokens.requested_item_ids
  IS 'Array of accounty_missing_items IDs that were specifically requested via this portal link';
