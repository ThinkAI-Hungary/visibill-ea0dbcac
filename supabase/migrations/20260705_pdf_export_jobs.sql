-- PDF Export Jobs — Tracks server-side PDF export jobs for submitted invoices

CREATE TABLE IF NOT EXISTS pdf_export_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','processing','completed','error','cancelled','downloaded','expired')),
  date_from DATE NOT NULL,
  date_to DATE NOT NULL,
  invoice_direction TEXT CHECK (invoice_direction IN ('INBOUND', 'OUTBOUND') OR invoice_direction IS NULL),
  total_invoices INT DEFAULT 0,
  processed_invoices INT DEFAULT 0,
  current_invoice_name TEXT,
  result_urls TEXT[],
  result_sizes BIGINT[],
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ
);

ALTER TABLE pdf_export_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pdf_export_jobs_select_own_company"
  ON pdf_export_jobs FOR SELECT
  USING (company_id IN (SELECT company_id FROM company_members WHERE user_id = auth.uid()));

CREATE POLICY "pdf_export_jobs_insert_own"
  ON pdf_export_jobs FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "pdf_export_jobs_update_own"
  ON pdf_export_jobs FOR UPDATE
  USING (user_id = auth.uid());

CREATE INDEX idx_pdf_export_jobs_company_status ON pdf_export_jobs(company_id, status);
CREATE INDEX idx_pdf_export_jobs_user_status ON pdf_export_jobs(user_id, status);

ALTER PUBLICATION supabase_realtime ADD TABLE pdf_export_jobs;

CREATE OR REPLACE FUNCTION update_pdf_export_jobs_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_pdf_export_jobs_updated_at
  BEFORE UPDATE ON pdf_export_jobs
  FOR EACH ROW EXECUTE FUNCTION update_pdf_export_jobs_updated_at();
