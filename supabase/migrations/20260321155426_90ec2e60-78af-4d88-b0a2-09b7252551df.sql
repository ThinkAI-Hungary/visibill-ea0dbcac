
-- Expand salary_files status CHECK constraint to allow processing statuses
ALTER TABLE salary_files DROP CONSTRAINT IF EXISTS salaries_status_check;
ALTER TABLE salary_files ADD CONSTRAINT salaries_status_check
  CHECK (status IN ('pending','paid','cancelled','overdue','processing','webhook_sent','webhook_failed','completed'));

-- Add partners table to Realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE partners;
