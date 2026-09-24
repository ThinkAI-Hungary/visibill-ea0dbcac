-- Migration: Add optional category column to feedback table
-- Description: Adds category column and index to support categorizing tickets with accounting/system categories

ALTER TABLE public.feedback 
ADD COLUMN IF NOT EXISTS category text;

-- Add index on category for performant filtering in ticket lists
CREATE INDEX IF NOT EXISTS idx_feedback_category ON public.feedback(category);

-- Comment on column
COMMENT ON COLUMN public.feedback.category IS 'Opcionális hibajegy kategória besorolás (pl. áfa, bank napló, bérjegyzék, stb.)';
