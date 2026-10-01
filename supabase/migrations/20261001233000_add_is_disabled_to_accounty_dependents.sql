-- Migration: Add is_disabled to accounty_dependents for Mt. 118. § (2) disabled child extra leave
ALTER TABLE public.accounty_dependents 
ADD COLUMN IF NOT EXISTS is_disabled boolean DEFAULT false;

COMMENT ON COLUMN public.accounty_dependents.is_disabled IS 'Tartósan beteg vagy súlyosan fogyatékos gyermek jelölése (Mt. 118. § (2) szerint +2 munkanap pótszabadság)';
