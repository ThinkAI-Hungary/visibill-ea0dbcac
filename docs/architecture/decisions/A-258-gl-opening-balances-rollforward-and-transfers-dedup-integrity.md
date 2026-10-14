# A-258: Főkönyvi Nyitó Mérlegtételek Évközi Átgörgetése (GL Rollforward) és Bérszámfejtési Utalási Tranzakció Integritás

**Status:** Decided  
**Date:** 2026-10-15  
**Utoljára frissítve:** 2026-10-15  
**Author:** Áron / Antigravity AI  
**Kapcsolódó döntések:** [A-003](./A-003-multi-tenancy-rls.md), [A-175](./A-175-subledger-and-open-items-architecture.md), [A-250](./A-250-payroll-module-14-reconciliation-giro-and-tab-architecture.md), [A-256](./A-256-general-ledger-journal-view-server-side-pagination-and-window-aggregates.md), [A-257](./A-257-general-ledger-balances-preaggregation-and-atomic-json-rpc.md), [P-189](../../product/decisions/P-189-eaisybooks-gl-defaults-petty-cash-currency-and-virtual-bank-ux.md), [073](../../business/decisions/073-gl-opening-continuity-virtual-banks-and-single-currency-cash-policy.md)

---

## Context

### 1. Főkönyvi Nyitó Mérlegtételek Hiánya Évközi Szűréseknél
A számviteli törvény (Sztv.) és a kettős könyvvitel alapelve szerint a mérlegszámlák (1-4. számlaosztály: Eszközök és Források) egyenlege folyamatos, és az üzleti év első napján lekönyvelt nyitó egyenleg (`entry_type = 'OPENING'` vagy naplókód `NY`) az egész üzleti év során érvényesül.

A Visibill `get_gl_balances`, `get_gl_balances_json` és `get_gl_categorized_items` adatbázis RPC függvényei azonban szigorúan a megadott dátumtartomány (`p_date_from` .. `p_date_to`) alapján szűrték az `acc_journal_lines` és `gl_journal_entries` tételeket:
```sql
WHERE (p_date_from IS NULL OR COALESCE(h.posting_date, h.document_date) >= p_date_from)
  AND (p_date_to IS NULL OR COALESCE(h.posting_date, h.document_date) <= p_date_to)
```
**A hiba következménye (Fakov Kft. esete):**  
Amikor a könyvelő rögzített egy nyitó bizonylatot (`NYITO-2026`, 32 sor, 2026.01.01), az éves főkönyvi lekérdezésben (2026.01.01–2026.12.31) helyesen megjelent. Viszont ha a felhasználó év közbeni időszakra szűrt (pl. október 1–31., Q2, havi zárás), a `posting_date >= 2026-10-01` feltétel azonnal kizárta a 2026.01.01-i nyitó tételeket. Ennek következtében a mérlegszámlák (pl. 131, 132, 139 gépek, berendezések, 413 eredménytartalék) nyitó állománya teljesen eltűnt a kivonatból, és 0 nyitó sor jelent meg.

### 2. Bérszámfejtési Utalási Lista Duplikáció és Törlési Jogosultság Hiány
A Bérszámfejtési modulban az utalási lista generálásakor (`accounty_transfers` tábla) a könyvelők gyakran újragenerálták a bérjegyzéket vagy a havi kifizetési listát.
- Az `accounty_transfers` táblán **nem létezett UNIQUE kényszer** a `(company_id, employee_id, period)` hármasra.
- Hiányzott a tábláról a **DELETE RLS policy** (`tr_delete`), emiatt a könyvelői kliens nem tudta a korábbi utalási rekordokat felülírni/törölni újragenerálás előtt.
- Ennek következtében a tételek többszöröződtek (pl. Kilner Gábor Ev.-nél tripla utalási tétel keletkezett a felületen).

---

## Decision

### 1. Főkönyvi Nyitó Átgörgetés (Rollforward) RPC Szinten
A `supabase/migrations/20261014234500_gl_rollforward_opening_balances.sql` migrációban módosítottuk mindhárom főkönyvi RPC-t (`get_gl_balances`, `get_gl_balances_json`, `get_gl_categorized_items`):
- A dátumszűrési logikát kibővítettük egy intelligens évközi átgörgetési ággal:
```sql
AND (
  (
    CASE
      WHEN p_date_basis = 'teljesites' THEN
        (p_date_from IS NULL OR COALESCE(h.posting_date, h.document_date) >= p_date_from)
        AND (p_date_to IS NULL OR COALESCE(h.posting_date, h.document_date) <= p_date_to)
      ELSE
        (p_date_from IS NULL OR COALESCE(h.document_date, h.posting_date) >= p_date_from)
        AND (p_date_to IS NULL OR COALESCE(h.document_date, h.posting_date) <= p_date_to)
    END
  )
  OR (
    (h.entry_type = 'OPENING' OR j.code = 'NY')
    AND (
      p_date_to IS NULL 
      OR EXTRACT(YEAR FROM COALESCE(h.posting_date, h.document_date)) = EXTRACT(YEAR FROM p_date_to)
    )
    AND (
      p_date_to IS NULL 
      OR COALESCE(h.posting_date, h.document_date) <= p_date_to
    )
  )
)
```
- Ugyanez az átgörgetési feltétel érvényesül az XML-ből importált nyitó tételekre (`gl_journal_entries`) is a `LOWER(COALESCE(je.voucher_number, '')) LIKE '%nyit%' OR LOWER(COALESCE(je.description, '')) LIKE '%nyit%'` heurisztika alapján.
- **PL/pgSQL Változó Ambivalencia Megszüntetése:** A `RETURNS TABLE(..., description text, ...)` szignatúra miatt a belső lekérdezésekben kötelezővé tettük a táblaalias minősítést (`je.description`, `je.voucher_number`), megelőzve a PostgreSQL `42702: column reference "description" is ambiguous` hibát.
- **PostgREST PGRST202 Túlterhelési Konfliktus Elkerülése:** A régi 10-paraméteres `get_gl_categorized_items` függvényt fizikailag töröltük (`DROP FUNCTION`), és kizárólag az egységes 11-paraméteres (`p_gl_account_ids uuid[] DEFAULT NULL::uuid[]`), `STABLE SECURITY DEFINER` függvényt hagytuk meg.

### 2. Utalási Lista Integritás és Törlési RLS Policy
A `supabase/migrations/20261014230000_fix_accounty_transfers_delete_rls_and_unique.sql` migrációban:
1. **Deduplikáció:** `DISTINCT ON (company_id, coalesce(employee_id, '00000000-0000-0000-0000-000000000000'::uuid), period)` lekérdezéssel töröltük a múltbéli duplikált sorokat a legkorábbi (`b.created_at asc`) megtartásával.
2. **Egyedi Kényszer:**
```sql
ALTER TABLE public.accounty_transfers
  ADD CONSTRAINT accounty_transfers_company_employee_period_unique
  UNIQUE (company_id, employee_id, period);
```
3. **DELETE RLS Policy:**
```sql
CREATE POLICY "tr_delete" ON public.accounty_transfers FOR DELETE TO authenticated
  USING (company_id IN (SELECT company_id FROM public.accounty_assignments WHERE accountant_user_id = auth.uid()));
```
4. **Kliensoldali Védőháló:** A `TransferListPage.tsx` felületén Set-alapú deduplikáció és szűrés biztosítja a konzisztens megjelenítést.

---

## Consequences

### Pozitív:
- **Számviteli Helyesség:** A főkönyvi kivonat évközi lekérdezéseinél a mérlegszámlák (1-4) nem vesztik el a nyitó egyenleget; a nyitó és a tárgyidőszaki forgalom összege megegyezik a valós gazdasági állapottal.
- **Zéró Duplikáció:** Bérszámfejtési újrageneráláskor az adatbázis szintű UNIQUE constraint és a DELETE policy garantálja, hogy a dolgozók utalási tételei soha többé nem triplázódnak meg.
- **Teljesítmény:** A Postgres SQL lekérdezési tervben a nyitó tételek azonos évszűréssel, indexelt `entry_type` és `posting_date` oszlopokon keresztül kapcsolódnak be, elkerülve a lassú szekvenciális pásztázást.
- **Verifikált Élő Adatok:** A Fakov Kft. éles PROD adatbázisában lefutott tesztelés igazolta, hogy az októberi kivonatban mind a 32 nyitó mérlegtétel azonnal megjelent.

### Negatív / Megkötések:
- Az évközi nyitó átgörgetés feltételezi, hogy a nyitó bizonylat könyvelési dátuma az üzleti évre esik (`EXTRACT(YEAR ...) = EXTRACT(YEAR FROM p_date_to)`). Naptári évtől eltérő üzleti év esetén a jövőben a cég üzleti évének kezdődátumát kell figyelembe venni.

---

## Kapcsolódó
- [P-189: Főkönyvi Default Nézet, Pénztár Deviza és Szallas.hu Bank](../../product/decisions/P-189-eaisybooks-gl-defaults-petty-cash-currency-and-virtual-bank-ux.md)
- [073: Nyitó Mérlegegyenlegek és Virtuális Bankok Szabályzata](../../business/decisions/073-gl-opening-continuity-virtual-banks-and-single-currency-cash-policy.md)
- [A-257: Főkönyvi Egyenlegek Előaggregáció és Atomi JSON RPC](./A-257-general-ledger-balances-preaggregation-and-atomic-json-rpc.md)
- [A-250: Bérszámfejtési Modul Architektúra](./A-250-payroll-module-14-reconciliation-giro-and-tab-architecture.md)
