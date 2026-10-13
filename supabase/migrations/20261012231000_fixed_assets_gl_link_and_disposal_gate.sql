-- =============================================================================
-- TENY M1.1 – Főkönyvi kapcsolat (fixed_asset_id) és kivezetési státusz séma
-- Terv: implementation-plans/TENY_implementacios_terv.md (D-1, D-4)
--
--  1. acc_journal_lines.fixed_asset_id  (analitika ↔ főkönyv közvetlen kapcsolat)
--  2. fixed_assets.disposal_*           (jóváhagyási kapu + jegyzőkönyv adatok)
--  3. asset_events.event_type CHECK     (hiányzó + új kivezetési esemény típusok)
--  4. Őr triggerek                      (cég-konzisztencia, jóváhagyási jogosultság)
--
-- Tervezési megjegyzések:
--  * A fixed_asset_id FK szándékosan ON DELETE RESTRICT (nem SET NULL): a
--    trg_acc_enforce_line_immutability a KONYVELT/SZTORNOZOTT sorok UPDATE-jét
--    tiltja, így a SET NULL kaszkád úgyis hibára futna; RESTRICT egyértelmű
--    hibaüzenetet és audit-védelmet ad (könyvelt eszköz nem törölhető).
--  * Meglévő sorok visszatöltése (backfill) SZÁNDÉKOSAN NINCS ebben a migrációban.
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. acc_journal_lines.fixed_asset_id
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.acc_journal_lines
  ADD COLUMN IF NOT EXISTS fixed_asset_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'acc_journal_lines_fixed_asset_id_fkey'
       AND conrelid = 'public.acc_journal_lines'::regclass
  ) THEN
    ALTER TABLE public.acc_journal_lines
      ADD CONSTRAINT acc_journal_lines_fixed_asset_id_fkey
      FOREIGN KEY (fixed_asset_id) REFERENCES public.fixed_assets(id)
      ON DELETE RESTRICT NOT VALID;
  END IF;
END $$;

ALTER TABLE public.acc_journal_lines
  VALIDATE CONSTRAINT acc_journal_lines_fixed_asset_id_fkey;

-- FK-index (a RESTRICT ellenőrzéshez és a rekonciliációs aggregációhoz).
-- A "nincs analitika" (IS NULL) ág a meglévő idx_acc_journal_lines_gl_account
-- indexen keresztül szűrt (gl_account_id = 1x számlák), ezért itt parciális elég.
CREATE INDEX IF NOT EXISTS idx_acc_journal_lines_fixed_asset_id
  ON public.acc_journal_lines (fixed_asset_id)
  WHERE fixed_asset_id IS NOT NULL;

COMMENT ON COLUMN public.acc_journal_lines.fixed_asset_id IS
  'TENY analitika kapcsolat: a főkönyvi sor melyik tárgyi eszközhöz tartozik (aktiválás, ÉCS, kivezetés). NULL = nincs analitika.';

-- Cég-konzisztencia őr: a sor fejlécének cége = az eszköz cége (A-003 multi-tenancy).
-- Csak akkor fut, ha fixed_asset_id ki van töltve (WHEN), így a legtöbb sort nem terheli.
-- SECURITY DEFINER: a külső könyvelők (accounty_assignments) nem feltétlenül
-- company_members tagok, így az eszköz-ellenőrzésnek RLS-függetlennek kell lennie.
CREATE OR REPLACE FUNCTION public.acc_guard_line_fixed_asset_company()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM public.acc_journal_headers h
      JOIN public.fixed_assets fa ON fa.company_id = h.company_id
     WHERE h.id = NEW.header_id
       AND fa.id = NEW.fixed_asset_id
  ) THEN
    RAISE EXCEPTION 'A tárgyi eszköz (%) nem ugyanahhoz a céghez tartozik, mint a könyvelési tétel fejléce.', NEW.fixed_asset_id
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.acc_guard_line_fixed_asset_company() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_acc_guard_line_fixed_asset_company ON public.acc_journal_lines;
CREATE TRIGGER trg_acc_guard_line_fixed_asset_company
  BEFORE INSERT OR UPDATE OF fixed_asset_id, header_id ON public.acc_journal_lines
  FOR EACH ROW
  WHEN (NEW.fixed_asset_id IS NOT NULL)
  EXECUTE FUNCTION public.acc_guard_line_fixed_asset_company();

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. fixed_assets.disposal_* (D-4 jóváhagyási kapu + jegyzőkönyv adatok)
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.fixed_assets
  ADD COLUMN IF NOT EXISTS disposal_status text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS disposal_reason_type text,
  ADD COLUMN IF NOT EXISTS disposal_committee jsonb,
  ADD COLUMN IF NOT EXISTS disposal_waste_info jsonb,
  ADD COLUMN IF NOT EXISTS disposal_details jsonb,
  ADD COLUMN IF NOT EXISTS disposal_journal_entry_id uuid;

ALTER TABLE public.fixed_assets
  DROP CONSTRAINT IF EXISTS fixed_assets_disposal_status_check;
ALTER TABLE public.fixed_assets
  ADD CONSTRAINT fixed_assets_disposal_status_check
  CHECK (disposal_status IN ('none', 'pending_approval', 'approved', 'rejected'));

ALTER TABLE public.fixed_assets
  DROP CONSTRAINT IF EXISTS fixed_assets_disposal_reason_type_check;
ALTER TABLE public.fixed_assets
  ADD CONSTRAINT fixed_assets_disposal_reason_type_check
  CHECK (disposal_reason_type IS NULL
         OR disposal_reason_type IN ('sale', 'scrapping', 'inventory_shortage', 'donation'));

-- Ha van folyamatban lévő / lezárt kivezetési kérelem, a jogcím kötelező.
ALTER TABLE public.fixed_assets
  DROP CONSTRAINT IF EXISTS fixed_assets_disposal_reason_required_check;
ALTER TABLE public.fixed_assets
  ADD CONSTRAINT fixed_assets_disposal_reason_required_check
  CHECK (disposal_status = 'none' OR disposal_reason_type IS NOT NULL);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'fixed_assets_disposal_journal_entry_id_fkey'
       AND conrelid = 'public.fixed_assets'::regclass
  ) THEN
    ALTER TABLE public.fixed_assets
      ADD CONSTRAINT fixed_assets_disposal_journal_entry_id_fkey
      FOREIGN KEY (disposal_journal_entry_id) REFERENCES public.acc_journal_headers(id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_fixed_assets_disposal_journal_entry_id
  ON public.fixed_assets (disposal_journal_entry_id)
  WHERE disposal_journal_entry_id IS NOT NULL;

-- Jóváhagyásra váró kivezetések gyors listázásához (könyvelői "Jóváhagyásra vár" nézet).
CREATE INDEX IF NOT EXISTS idx_fixed_assets_company_disposal_pending
  ON public.fixed_assets (company_id)
  WHERE disposal_status = 'pending_approval';

COMMENT ON COLUMN public.fixed_assets.disposal_status IS
  'Kivezetési jóváhagyási kapu: none → pending_approval → approved|rejected. Főkönyvi kontírozás csak approved-nél.';
COMMENT ON COLUMN public.fixed_assets.disposal_reason_type IS
  'Kivezetés jogcíme: sale (értékesítés), scrapping (selejtezés), inventory_shortage (leltárhiány), donation (térítés nélküli átadás).';
COMMENT ON COLUMN public.fixed_assets.disposal_committee IS
  'Selejtezési bizottság: {"chair": "...", "members": ["..."]}';
COMMENT ON COLUMN public.fixed_assets.disposal_waste_info IS
  'Hulladékkezelési adatok: {"hazardous": bool, "handler": "...", "waste_code": "...", "handover_date": "..."}';
COMMENT ON COLUMN public.fixed_assets.disposal_details IS
  'Jogcím-specifikus adatok (műszaki indoklás, eladási ár, vevő, felelős dolgozó, kártérítés összege stb.).';
COMMENT ON COLUMN public.fixed_assets.disposal_journal_entry_id IS
  'A jóváhagyás után létrejött kivezetési főkönyvi bizonylat fejléce.';

-- Jóváhagyási kapu őr: approved / rejected státuszba csak ledger_write jogosultságú
-- felhasználó (kijelölt könyvelő, vagy könyvelő nélküli cégnél owner/admin/member) léptethet.
-- A jóváhagyott kivezetés státusza végleges.
CREATE OR REPLACE FUNCTION public.fixed_assets_disposal_status_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.disposal_status IS DISTINCT FROM OLD.disposal_status THEN
    IF OLD.disposal_status = 'approved' THEN
      RAISE EXCEPTION 'Jóváhagyott kivezetés státusza nem módosítható (leltári szám: %).', OLD.inventory_number
        USING ERRCODE = '23514';
    END IF;

    IF NEW.disposal_status IN ('approved', 'rejected') THEN
      PERFORM public.assert_company_role_tier(NEW.company_id, 'ledger_write');
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.fixed_assets_disposal_status_guard() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_fixed_assets_disposal_status_guard ON public.fixed_assets;
CREATE TRIGGER trg_fixed_assets_disposal_status_guard
  BEFORE UPDATE OF disposal_status ON public.fixed_assets
  FOR EACH ROW
  EXECUTE FUNCTION public.fixed_assets_disposal_status_guard();

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. asset_events.event_type CHECK bővítése
--    Javítja a meglévő hibát is: a kód 'performance_log', 'document_upload' és
--    'project_transfer' típust szúr be, amit a korábbi CHECK elutasított (23514).
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.asset_events
  DROP CONSTRAINT IF EXISTS asset_events_event_type_check;
ALTER TABLE public.asset_events
  ADD CONSTRAINT asset_events_event_type_check
  CHECK (event_type = ANY (ARRAY[
    'activation'::text,
    'transfer'::text,
    'project_transfer'::text,
    'reactivation'::text,
    'disposal'::text,
    'disposal_requested'::text,
    'disposal_approved'::text,
    'disposal_rejected'::text,
    'inventory_check'::text,
    'value_change'::text,
    'document_upload'::text,
    'performance_log'::text
  ]));

NOTIFY pgrst, 'reload schema';
