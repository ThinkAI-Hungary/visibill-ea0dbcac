-- Alter feedback_type_check constraint to allow 'question' as a valid ticket type
ALTER TABLE public.feedback DROP CONSTRAINT IF EXISTS feedback_type_check;
ALTER TABLE public.feedback ADD CONSTRAINT feedback_type_check CHECK (type = ANY (ARRAY['bug'::text, 'feedback'::text, 'question'::text]));
