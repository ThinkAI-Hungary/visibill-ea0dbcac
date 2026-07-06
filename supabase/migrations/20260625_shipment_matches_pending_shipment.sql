-- Migration: shipment_matches — invoice-first lifecycle support
-- DR-031, DR-032, DR-033: sorrend-független futar-számla-CMR lánc
--
-- Változások:
-- 1. shipment_id → nullable (placeholder rekord ha shipment még nem érkezett)
-- 2. confidence_score → nullable (nincs score placeholder esetén)
-- 3. match_type → nullable (nincs type placeholder esetén)
-- 4. UNIQUE constraint update: (invoice_id, shipment_id) → NULL-safe (pg természetesen kezeli)
-- 5. status mező: 'pending_shipment' érték dokumentálva (nincs CHECK constraint, szabad szöveg)

-- ── 1. shipment_id nullable ────────────────────────────────────────────────────
-- Szükséges: placeholder rekord amikor a számla előbb érkezik mint a futárriport
ALTER TABLE public.shipment_matches
  ALTER COLUMN shipment_id DROP NOT NULL;

-- ── 2. confidence_score nullable ───────────────────────────────────────────────
-- Placeholder rekorodnál nincs matching score
ALTER TABLE public.shipment_matches
  ALTER COLUMN confidence_score DROP NOT NULL;

-- ── 3. match_type nullable ─────────────────────────────────────────────────────
-- Placeholder rekorodnál nincs match type
ALTER TABLE public.shipment_matches
  ALTER COLUMN match_type DROP NOT NULL;

-- ── 4. Megjegyzés a status értékekről ──────────────────────────────────────────
-- A status mező megengedett értékei (nincs CHECK constraint, konvenció alapján):
--   'pending'           → Feldolgozás alatt (eredeti)
--   'matched'           → Teljes automatikus egyezés
--   'escalated'         → Eltérés — emberi felülvizsgálat kell
--   'manually_resolved' → Kézi feloldás
--   'pending_shipment'  → ÚJ: Számla megvan, de a futárriport (shipment) még nem érkezett be
--                         Feltétel: shipment_id IS NULL
--   'rejected'          → Elutasítva

-- ── 5. Partial index: pending_shipment rekordok gyors kereséshez ───────────────
-- Az EF és a retroaktív matching-hez szükséges lekérdezések indexe
CREATE INDEX IF NOT EXISTS idx_shipment_matches_pending_shipment
  ON public.shipment_matches (company_id, invoice_id)
  WHERE status = 'pending_shipment';

-- ── Rollback terv (M-5 checklist) ─────────────────────────────────────────────
-- Ha visszaállítás szükséges:
--   ALTER TABLE public.shipment_matches ALTER COLUMN shipment_id SET NOT NULL;
--   ALTER TABLE public.shipment_matches ALTER COLUMN confidence_score SET NOT NULL;
--   ALTER TABLE public.shipment_matches ALTER COLUMN match_type SET NOT NULL;
--   DROP INDEX IF EXISTS idx_shipment_matches_pending_shipment;
-- FIGYELEM: csak ha nincs egyetlen pending_shipment rekord sem a táblában!
