-- ════════════════════════════════════════════════════════════════════════════
-- Migration: Mailgun webhook idempotency — DB-level UNIQUE dedup index
-- Date: 2026-07-20
-- ════════════════════════════════════════════════════════════════════════════

-- ── 1. Clean up existing duplicates (keep oldest per group) ──────────────────

DELETE FROM invoice_uploads
WHERE id IN (
  SELECT id FROM (
    SELECT id, ROW_NUMBER() OVER (
      PARTITION BY company_id, file_name, (metadata->>'mailgun_message_id')
      ORDER BY created_at ASC
    ) AS rn
    FROM invoice_uploads
    WHERE metadata->>'mailgun_message_id' IS NOT NULL
  ) ranked
  WHERE rn > 1
);

DELETE FROM transaction_uploads
WHERE id IN (
  SELECT id FROM (
    SELECT id, ROW_NUMBER() OVER (
      PARTITION BY company_id, file_name, (metadata->>'mailgun_message_id')
      ORDER BY created_at ASC
    ) AS rn
    FROM transaction_uploads
    WHERE metadata->>'mailgun_message_id' IS NOT NULL
  ) ranked
  WHERE rn > 1
);

DELETE FROM report_uploads
WHERE id IN (
  SELECT id FROM (
    SELECT id, ROW_NUMBER() OVER (
      PARTITION BY company_id, file_name, (metadata->>'mailgun_message_id')
      ORDER BY created_at ASC
    ) AS rn
    FROM report_uploads
    WHERE metadata->>'mailgun_message_id' IS NOT NULL
  ) ranked
  WHERE rn > 1
);

-- ── 2. Create partial UNIQUE indexes ─────────────────────────────────────────

CREATE UNIQUE INDEX IF NOT EXISTS idx_invoice_uploads_mailgun_dedup
  ON invoice_uploads (company_id, file_name, (metadata->>'mailgun_message_id'))
  WHERE metadata->>'mailgun_message_id' IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_transaction_uploads_mailgun_dedup
  ON transaction_uploads (company_id, file_name, (metadata->>'mailgun_message_id'))
  WHERE metadata->>'mailgun_message_id' IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_report_uploads_mailgun_dedup
  ON report_uploads (company_id, file_name, (metadata->>'mailgun_message_id'))
  WHERE metadata->>'mailgun_message_id' IS NOT NULL;
