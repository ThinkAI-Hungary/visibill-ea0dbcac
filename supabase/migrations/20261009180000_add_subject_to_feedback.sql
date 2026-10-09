-- Migration: 20261009180000_add_subject_to_feedback.sql
-- Description: Add subject (Tárgy) column to public.feedback for structured ticket titles

ALTER TABLE public.feedback ADD COLUMN IF NOT EXISTS subject text;

COMMENT ON COLUMN public.feedback.subject IS 'The title / subject of the ticket entered during creation';
