# A-161: ÁFA Bizonylatköri Adatkör Architektúra (Backend RPC + Kliens Reaktív Szűrés)

> **Státusz:** ✅ Decided & Implemented  
> **Dátum:** 2026-09-26  
> **Szerző:** Antigravity Pairing  
> **Érintett komponensek:** `supabase/migrations/20260927000000_add_vat_return_image_scope.sql`, `calculate_vat_return` RPC, `useVatScope.ts`, `useVatReturnData.ts`, `VatScopeRadioGroup.tsx`, `VatReturnContainer.tsx`, `VatAnnualMatrixView.tsx`, `VatItemizedJournalView.tsx`, `VatCollectorAnalyticsView.tsx`, `VatMLineMasterDetail.tsx`  
> **Kapcsolódó döntések:** [A-159](./A-159-statutory-vat-views-upgrade-and-osa-reconciliation.md), [P-121](../product/decisions/P-121-vat-image-scope-selector.md)

---

## 1. Architekturális Kontextus és Kihívás

Az adóbevallás és az analitikai nézetek két különböző forrásból építkeznek:
1. **Adatbázis táblák:** `vat_returns`, `vat_return_lines`, `vat_return_m_lines` (amelyeket a `calculate_vat_return` tárolt eljárás számol ki).
2. **Közvetlen tranzakciós lekérdezések:** `nav_invoices`, `invoices`, `nav_invoice_items`, `invoice_items` (amelyeket az Éves Mátrix, ÁFA Tétellista és Gyűjtőkódos analitika kérdez le és aggregál kliens oldalon).

A feladat az volt, hogy a bizonylatkör-választó kapcsoló (`all` vs. `with_image`) **mind a perzisztens adatbázis számításokban, mind az összes tranzakciós analitikai nézetben** szinkronban és determinisztikusan működjön, elkerülve a számítási aszinkronitást vagy a nézetek közötti adateltérést.

---

## 2. Számlakép Meghatározási Szabály (Image Resolution Invariant)

Egy számla akkor minősül számlaképpel rendelkezőnek, ha a beküldött/feltöltött bizonylatok között legalább egy hiteles állomány megtalálható:
```sql
(image_url IS NOT NULL 
 OR melleklet_url IS NOT NULL 
 OR invoice_uploads_id IS NOT NULL 
 OR jsonb_array_length(attachments) > 0)
```
A NAV Online Számlából érkező `nav_invoices` rekordok esetében az egyeztetés az `invoices` táblával történik normalizált bizonylatszám alapján:
`normalizeInvNum(s) = REPLACE(REGEXP_REPLACE(s, '[^A-Za-z0-9]', '', 'g'), ' ', '') UPPER`.

---

## 3. Adatbázis Réteg (Migration: `20260927000000_add_vat_return_image_scope.sql`)

1. **Tábla bővítés:**
   ```sql
   ALTER TABLE public.vat_returns ADD COLUMN IF NOT EXISTS vat_scope TEXT DEFAULT 'all';
   ```
2. **RPC Frissítés (`calculate_vat_return`):**
   - Új paraméter: `p_scope text DEFAULT 'all'::text`.
   - A fő kalkulációs ciklusban a bejövő számlák szűrése:
     ```sql
     IF p_scope = 'with_image' AND NOT v_has_image THEN
       CONTINUE;
     END IF;
     ```
   - A 65M lapok (`vat_return_m_lines`) generálásakor az `all_inbounds` CTE szűrése:
     ```sql
     WHERE (p_scope = 'all' OR sub_has_img)
     ```
   - A fejléc mentésekor rögzíti a felhasznált hatókört: `vat_scope = p_scope`.

---

## 4. Kliens Réteg és Reaktív Adatfolyam

```mermaid
flowchart TD
    URL[URL Query: ?vat_scope=all|with_image] <--> Hook[useVatScope Hook]
    Storage[(localStorage: visibill_vat_scope_companyId)] <--> Hook
    Hook --> Group[VatScopeRadioGroup UI]
    Group -->|onChange| Container[VatReturnContainer]
    Container -->|p_scope| RPC[calculate_vat_return RPC]
    RPC --> DB[(vat_returns / vat_return_lines / vat_return_m_lines)]
    Container -->|vatScope| V1[VatAnnualMatrixView]
    Container -->|vatScope| V2[VatItemizedJournalView]
    Container -->|vatScope| V3[VatCollectorAnalyticsView]
    Container -->|vatScope| V4[VatMLineMasterDetail]
    Container -->|vatScope| V5[VatReturnViewTab]
```

1. **`useVatScope` Hook:**
   - Kétirányú URL és LocalStorage szinkronizáció.
   - Párhuzamos lekérdezéssel kiszámolja az adott időszakban elérhető összes szállítói számla számát (`totalCount`), a számlaképpel rendelkezők számát (`withImageCount`), és a hiányzók számát (`missingCount`).
2. **Kliens Nézetek Reaktív Szűrése:**
   - Mind a 4 analitikai komponens (`VatAnnualMatrixView`, `VatItemizedJournalView`, `VatCollectorAnalyticsView`, `VatMLineMasterDetail`) fogadja a `vatScope` propot és figyeli az URL paramétert (`effectiveScope`).
   - A lekérdezési kulcsok (`queryKey`) tartalmazzák az `effectiveScope` értéket, így az opcióváltás azonnali, villámgyors újraszámítást eredményez 0 ms lag mellett.
   - Mind a 4 nézet fejrészében megjelenik a kiválasztott hatókört jelző vizuális Badge (`Csak számlaképpel` / `Minden számla`).
3. **Kimenő Számlák Invariánsa:**
   - A TypeScript és PostgreSQL szűrők garantálják, hogy `invoice_direction === 'OUTBOUND'` esetén semmilyen számlakép-ellenőrzés nem zárja ki az értékesítési számlákat.

---

## 5. Tesztelés & Minőségbiztosítás

- Automatikus egységtesztek: `src/test/vatScopeFilter.test.tsx` (6 teszt):
  - Üzleti invariáns: `all` nézetben az összes tétel szerepel.
  - Üzleti invariáns: `with_image` nézetben a kép nélküli bejövők kikerülnek.
  - Szigorú invariáns: Kimenő számlák sosem esnek ki.
  - Képdetektálási szabály tesztelése (4 mező mentén).
  - `VatScopeRadioGroup` interaktív kártya és gombkattintási események ellenőrzése.
- TypeScript fordítás: `npx tsc --noEmit` hiba nélkül fut le.
