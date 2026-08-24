-- Migration: 20260824_add_metadata_to_llm_koltsegek.sql
-- Purpose: Add metadata jsonb column and GIN index to llm_koltsegek to support Layer 2 idempotency checking in Mailgun webhook handler (ADR A-041).

ALTER TABLE public.llm_koltsegek 
  ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_llm_koltsegek_metadata 
  ON public.llm_koltsegek USING gin (metadata);
