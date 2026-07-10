-- Migration: Add Digest Preferences to accounty_email_preferences
-- Description: Adds dedicated columns for the new Digest feature instead of using JSONB.
-- Defaults to disabled (digest_enabled = false) as per user requirements.

ALTER TABLE accounty_email_preferences
  ADD COLUMN IF NOT EXISTS digest_enabled boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS digest_frequency text DEFAULT 'daily',
  ADD COLUMN IF NOT EXISTS digest_delivery_time text DEFAULT '08:00',
  ADD COLUMN IF NOT EXISTS digest_include_kpis boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS digest_include_deadlines boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS digest_include_missing_items boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS digest_include_client_summary boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS digest_include_audit_log boolean DEFAULT false;

-- Add comments for documentation
COMMENT ON COLUMN accounty_email_preferences.digest_enabled IS 'Mornings digest enabled switch (opt-in)';
COMMENT ON COLUMN accounty_email_preferences.digest_frequency IS 'daily, weekly, or biweekly';
COMMENT ON COLUMN accounty_email_preferences.digest_delivery_time IS 'Target delivery hour (e.g. 08:00)';
