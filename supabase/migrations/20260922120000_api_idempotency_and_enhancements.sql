-- ============================================================================
-- Migration: Customer REST API Idempotency and Enhancements
-- Date: 2026-09-22
-- Description:
--   1. Creates public.api_idempotency_keys table for M2M API deduplication and replay.
--   2. Adds unique index and TTL expiry index.
--   3. Configures RLS policies restricted to service_role.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.api_idempotency_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_id uuid REFERENCES public.api_keys(id) ON DELETE CASCADE,
  idempotency_key text NOT NULL,
  endpoint text NOT NULL,
  request_hash text NOT NULL,
  status_code integer NOT NULL,
  response_body jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours')
);

COMMENT ON TABLE public.api_idempotency_keys IS 'Idempotencia-kulcsok és tárolt válaszok a Customer REST API duplikáció-védelméhez (24 órás TTL).';

-- Unique constraint: an API key can only have one active response per idempotency key
CREATE UNIQUE INDEX IF NOT EXISTS idx_api_idempotency_key_lookup 
  ON public.api_idempotency_keys(api_key_id, idempotency_key);

-- Expiry index for fast lookup and cleanup
CREATE INDEX IF NOT EXISTS idx_api_idempotency_expiry 
  ON public.api_idempotency_keys(expires_at);

-- RLS protection
ALTER TABLE public.api_idempotency_keys ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.api_idempotency_keys FROM anon, authenticated;
GRANT ALL ON public.api_idempotency_keys TO service_role;
