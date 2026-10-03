-- Migration: 20261003020000_fix_accounty_declarations_declaration_type_check.sql
-- Description: Expand declaration_type CHECK constraint on accounty_declarations to support 'child_leave' and canonical aliases

ALTER TABLE public.accounty_declarations
  DROP CONSTRAINT IF EXISTS accounty_declarations_declaration_type_check;

ALTER TABLE public.accounty_declarations
  ADD CONSTRAINT accounty_declarations_declaration_type_check
  CHECK (declaration_type = ANY (ARRAY[
    'family'::text,
    'child_leave'::text,
    'family_credit'::text,
    'netak'::text,
    'anyak_3'::text,
    'anyak_2'::text,
    'anyacska'::text,
    'young_25'::text,
    'under_25'::text,
    'young'::text,
    'young_mother_30'::text,
    'new_mother'::text,
    'mothers'::text,
    'first_marriage'::text,
    'first-marriage'::text,
    'personal'::text,
    'personal_disability'::text,
    'ekho'::text
  ]));

COMMENT ON CONSTRAINT accounty_declarations_declaration_type_check ON public.accounty_declarations IS 
  'Permitted payroll and leave declaration types including child_leave (Mt. 118. §) and standard tax concessions.';
