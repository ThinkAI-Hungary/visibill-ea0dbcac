-- Migration: Add last_computed_status to accounty_assignments
-- Required for: accounty-detect-missing client status change detection
-- Run this in Supabase SQL Editor BEFORE deploying the updated accounty-detect-missing function

-- Add the column (idempotent — won't fail if already exists)
ALTER TABLE accounty_assignments
  ADD COLUMN IF NOT EXISTS last_computed_status text DEFAULT 'Rendben';

-- Set initial status for existing assignments based on current missing items
UPDATE accounty_assignments aa
SET last_computed_status = CASE
  WHEN (SELECT count(*) FROM accounty_missing_items mi
        WHERE mi.company_id = aa.company_id
        AND mi.status IN ('open', 'notified')) > 3 THEN 'Kritikus'
  WHEN (SELECT count(*) FROM accounty_missing_items mi
        WHERE mi.company_id = aa.company_id
        AND mi.status IN ('open', 'notified')) > 0 THEN 'Feldolgozandó'
  ELSE 'Rendben'
END;

-- ═══════════════════════════════════════════════════════════════════
-- Email preferences: set ALL existing users to OFF (opt-in model)
-- Users can manually enable the ones they want in Settings → Értesítések
-- ═══════════════════════════════════════════════════════════════════

-- Change column defaults to false
ALTER TABLE accounty_email_preferences
  ALTER COLUMN missing_invoice_alert SET DEFAULT false,
  ALTER COLUMN deadline_reminder SET DEFAULT false,
  ALTER COLUMN client_status_change SET DEFAULT false,
  ALTER COLUMN approval_request SET DEFAULT false,
  ALTER COLUMN weekly_report SET DEFAULT false,
  ALTER COLUMN monthly_report SET DEFAULT false;

-- Reset all existing preferences to false
UPDATE accounty_email_preferences
SET
  missing_invoice_alert = false,
  deadline_reminder = false,
  client_status_change = false,
  approval_request = false,
  weekly_report = false,
  monthly_report = false;

-- Verify
SELECT company_id, last_computed_status, count(*) as assignment_count
FROM accounty_assignments
GROUP BY company_id, last_computed_status
ORDER BY last_computed_status;
