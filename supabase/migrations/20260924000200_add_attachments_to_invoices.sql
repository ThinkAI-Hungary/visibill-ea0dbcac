-- Migration: Add attachments jsonb column to invoices table
-- Ticket: EB-0177 (Ván Iroda Kft. - többszörös mellékletkezelés és munkalapok megőrzése)

ALTER TABLE public.invoices 
ADD COLUMN IF NOT EXISTS attachments jsonb DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.invoices.attachments IS 'Kiegészítő mellékletek listája (munkalapok, szerződések, teljesítésigazolások)';
