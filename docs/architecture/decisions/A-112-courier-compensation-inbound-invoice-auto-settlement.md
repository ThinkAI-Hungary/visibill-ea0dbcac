# A-112: Futárszolgálati Kompenzációs Értesítők Automatikus Bejövő Számla Rendezése (GLS / Courier Compensation Auto-Settlement)

**Status:** Decided  
**Date:** 2026-09-11  
**Utoljára frissítve:** 2026-09-11  

---

## Context

A futárszolgálatokkal (pl. GLS General Logistics Systems Hungary Kft.) szerződött ügyfelek (pl. Victoria Music Kft.) esetében az elszámolás kétirányú:
1. A futárszolgálat beszedi a vevőktől az utánvét összegeket (COD).
2. A futárszolgálat időszakonként kiszámlázza a fuvardíjakat mint bejövő szállítói számla (`invoice_direction = 'INBOUND'`, pl. `HU00869049`, `HU00919877`).
3. A felek a fuvardíj tartozást és a beszedett utánvét követelést **kompenzációs értesítővel** (beszámítással) egyenlítik ki.

Korábban az ADR-047 szerint a `visibill-worker` sikeresen felismerte a kompenzációs leveleket és rögzítette őket a `courier_reports` táblába `row_type = 'compensation'` típussal. Azonban az automatikus számlapárosító pipeline kizárólag kimenő vevői számlákat (`invoice_direction = 'OUTBOUND'`) keresett a COD összegekhez, így a bejövő szállítói számlák (`nav_invoices` és `invoices`) nyitottak maradtak, és a felhasználónak kézzel kellett volna egyenként megjelölnie őket fizetettként.

A Kollár Kristóf (Victoria Music Kft.) által beküldött 6. sz. hibajegy nyomán szükségessé vált az automatikus kiegyenlítési lánc leprogramozása.

---

## Decision

Az automatikus beszámítás megvalósításához adatbázis szintű triggert, segédfüggvényt és RPC bővítést vezettünk be.

### 1. `settle_compensation_for_courier_report` Függvény
- **Felelősség:**
  - A kompenzációs sorban szereplő számlaszám(ok) kinyerése (`package_number` és `reference_number` mezőkből), több számlaszám esetén vesszők, pontosvesszők és szóközök mentén darabolva (`regexp_split_to_table`).
  - Alfanumerikus normalizálás: `regexp_replace(..., '[^a-zA-Z0-9]', '', 'g')`, amely eltávolítja a záró írásjeleket (pl. `'HU00815313,'`).
  - Cég- és irány-izoláció: kizárólag a megadott `company_id` és `invoice_direction = 'INBOUND'` számlákat vizsgálja.
  - **Bejövő NAV számlák (`nav_invoices`) frissítése:**
    - `paid = true`
    - `is_manual_payment = true` (kivéve ha létezik banki tranzakció, ekkor megőrzi az eredeti értéket)
    - `manual_payment_type = 'compensation'`
    - `manual_payment_date = delivery_date` (vagy aktuális dátum)
    - `manual_payment_note = '[FUTÁR] kompenzációs értesítő alapján automatikusan rendezve'`
  - **Kézi / feltöltött bejövő számlák (`invoices`) frissítése:**
    - `fizetve = true`
    - `is_manual_payment = true`
    - `manual_payment_type = 'compensation'`
    - `manual_payment_date = delivery_date`
    - `manual_payment_note = '[FUTÁR] kompenzációs értesítő alapján automatikusan rendezve'`
    - `frissitve = NOW()`
  - **`courier_reports` sor státuszának zárása:**
    - `match_status = 'full'`
    - `match_confidence = 1.0`
    - `matched_nav_invoice_id = [nav_id]`
    - `match_reason = '[FUTÁR] kompenzáció: bejövő számla automatikusan rendezve'`

### 2. Adatbázis Trigger (`trg_courier_reports_auto_settle_compensation`)
- `AFTER INSERT OR UPDATE OF package_number, reference_number, row_type ON courier_reports`
- `WHEN (NEW.row_type = 'compensation')`
- Azonnal és automatikusan lefut, amint a worker vagy a felhasználó feltölt egy kompenzációs értesítőt, nulla késleltetéssel kiegyenlítve a szállítói számlát.
- Mivel a trigger kizárólag a `package_number`, `reference_number`, `row_type` oszlopok változására figyel, a rekord saját státuszának (`match_status`, `matched_nav_invoice_id`) frissítése nem idéz elő végtelen trigger rekurziót.

### 3. `rematch_courier_report` RPC Kiterjesztés
- A manuális és automata újrapárosító RPC (`rematch_courier_report(p_report_id uuid)`) mostantól kezeli a `row_type = 'compensation'` eseteket is, meghívva a fenti rendező logikát.

### 4. Visszamenőleges Alkalmazás
- A migráció lefuttatásával az összes korábban feltöltött, 2026-os GLS kompenzációs értesítő azonnal összerendelésre került a NAV és kézi számlákkal (`HU00919877`, `HU00920078`, `HU00879073`, `HU00871424`, `HU00869049`, `HU00860531`, `HU00842935`).

---

## Consequences

- **Pozitív:**
  - A felhasználónak nem kell kézzel megkeresnie és "fizetett"-re állítania a kompenzált GLS számlákat.
  - A Kintlévőségek és Számlák nézetben nem jelennek meg lejárt/nyitott tartozásként a már beszámított számlák.
  - Teljes auditnyom: mind a számlák (`manual_payment_note`), mind a futárriportok (`match_reason`) pontosan rögzítik az automatikus kiegyenlítés forrását.
- **Negatív/Kockázatok:**
  - Ha egy kompenzációs levélben elírt számlaszám szerepel, a tétel `unmatched` marad, ami a futárriportok táblázatában kézzel vagy javított újrafeltöltéssel kezelendő.
