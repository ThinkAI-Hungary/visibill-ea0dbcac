-- Migration: 20260909194500_ticket_statuses_assigned.sql
-- Description: Expand feedback_status_check constraint to support 'assigned' status (Nyitott -> Hozzárendelt -> Folyamatban -> Megoldva)

ALTER TABLE public.feedback DROP CONSTRAINT IF EXISTS feedback_status_check;
ALTER TABLE public.feedback ADD CONSTRAINT feedback_status_check 
  CHECK (status = ANY (ARRAY['new'::text, 'created'::text, 'open'::text, 'assigned'::text, 'in_progress'::text, 'resolved'::text, 'read'::text, 'dismissed'::text]));
