-- ============================================================
-- App Error Logs — Frontend hiba logolás
-- ============================================================

CREATE TABLE IF NOT EXISTS app_error_logs (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at  timestamptz DEFAULT now() NOT NULL,

  -- Ki és hol
  user_id     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  company_id  uuid REFERENCES companies(id) ON DELETE SET NULL,

  -- Mi történt
  error_type  text NOT NULL,          -- 'auth' | 'db_query' | 'api_call' | 'upload' | 'validation' | 'navigation' | 'unhandled'
  severity    text DEFAULT 'error',   -- 'error' | 'warning' | 'info'
  component   text,                   -- React component neve
  action      text,                   -- User action neve

  -- Hiba részletek
  message     text NOT NULL,
  stack_trace text,
  context     jsonb DEFAULT '{}',

  -- Env
  url         text,
  user_agent  text
);

-- Indexek
CREATE INDEX idx_app_error_logs_created   ON app_error_logs(created_at DESC);
CREATE INDEX idx_app_error_logs_company   ON app_error_logs(company_id);
CREATE INDEX idx_app_error_logs_type      ON app_error_logs(error_type);
CREATE INDEX idx_app_error_logs_user      ON app_error_logs(user_id);
CREATE INDEX idx_app_error_logs_severity  ON app_error_logs(severity);

-- RLS
ALTER TABLE app_error_logs ENABLE ROW LEVEL SECURITY;

-- Insert: bárki bejelentkezve VAGY anonym auth hiba logolás
CREATE POLICY "Anyone can insert error logs"
  ON app_error_logs FOR INSERT
  WITH CHECK (true);

-- Select: nincs direct SELECT — management-stats EF service_role-lal olvassa

-- Delete: nincs direct DELETE — management-stats EF service_role-lal törli

-- ============================================================
-- Auto-cleanup: 90 napon túli logok törlése
-- ============================================================
SELECT cron.schedule(
  'cleanup-app-error-logs',
  '0 3 * * 0', -- Vasárnap hajnali 3-kor
  $$DELETE FROM app_error_logs WHERE created_at < now() - interval '90 days'$$
);
