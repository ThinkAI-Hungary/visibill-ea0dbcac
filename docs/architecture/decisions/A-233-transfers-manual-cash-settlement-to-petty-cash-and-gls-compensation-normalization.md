# A-233: Kézi Készpénzes Számlarendezések Automatikus Házipénztár Integrációja és GLS Kompenzációs Normalizálás

**Status:** Decided  
**Date:** 2026-10-08  
**Utoljára frissítve:** 2026-10-08  
**Kapcsolódó PRD:** [P-171: Utalások Tömeges Rendezés, Kiállítási Dátum Alapértelmezés és Alsó Akciósáv UX](../../product/decisions/P-171-transfers-bulk-settlement-date-defaulting-and-sticky-action-bar-ux.md)  
**Kapcsolódó ADR-ek:** [A-036: Pénztárbizonylat Processing](./A-036-penztarbizonylat-processing.md), [A-058: Banki Utalások és Csomagkészítés](./A-058-bank-transfers-architecture.md), [A-098: Készpénzes és Manuális Kifizetésű Számlák Egységes Párosítási Státusza](./A-098-cash-and-manual-payment-matching-status-consistency.md), [A-112: Futár Kompenzációs Értesítők Automatikus Számlakiegyenlítése](./A-112-courier-compensation-inbound-settlement.md)

---

## 1. Context & Problémameghatározás

A Visibill / eaisyBooks pénzügyi rendszerében két szorosan összefüggő manuális és automatikus rendezési anomália merült fel valós éles használat során:

### 1.1 Készpénzes Számlarendezés és a Házipénztár Eltávolodása
Amikor a felhasználó az Utalások (`/transfers`) felületen egy beszállítói számlát (akár egyenként a táblázat soraiban, akár a tömeges rendező modálban) **„Készpénz / Házipénztár” (`cash` / `kp`)** fizetési móddal rendezett:
1. A háttérben hívott `record_manual_invoice_payment` RPC a számlát kifizetettre állította (`is_manual_payment = true`, `manual_payment_type = 'cash'`), és generált egy kiadási tételt a `transactions` (banki tranzakciók) táblába `type = 'manual_expense'` típussal a tranzakció-számla párosítási integritás fenntartására.
2. **Kritikus hiányosság:** A rendszer soha nem írt a `petty_cash_entries` (házipénztár napló) táblába. Emiatt a cég házipénztára nem észlelte a pénztári kifizetést, az egyenleg nem csökkent, és a pénztárjelentésekben sem jelent meg a kiadás.
3. Továbbá a háttérbeli `sync_petty_cash_entries` szinkronizáló RPC kizárólag azokat a számlákat vette figyelembe, amelyeknek az eredeti NAV vagy bizonylati fizetési módja `CASH` vagy `KÉSZPÉNZ` volt (`payment_method IN ('CASH', 'KÉSZPÉNZ')`). Mivel az Utalások oldalon szereplő számlák eredetileg banki átutalásosak voltak, a szinkronizáló sem vette át őket a házipénztárba.

### 1.2 GLS Kompenzációs Értesítők Elcsúszott Előtagjai és Fuvardíj-részletezők Kihagyása
1. **Szomszédos oszlop átcsorgás:** A GLS kompenzációs PDF leveleinek OCR és LLM beolvasásakor a többhasábos táblázatokban az utánvét összeg előtti vagy fuvardíj melletti `0` karakter bizonyos esetekben közvetlenül a számlaszám elé csúszott (pl. `0 HU00929915` -> `HU000929915`). Mivel a NAV számlaszám `HU00929915`, a rendszer nem találta meg a számlapárt, és a futárjelentés nyitva maradt.
2. **Settlement dokumentumok szűrése:** A GLS fuvardíj-részletező táblázatok (`SettlementDocument_*.xlsx`) az 1–15. sorokban nem tartalmaznak céges bankszámlaszámot, emiatt a worker korábbi szigorú bankszámla-validátora futárjelentés helyett kihagyta a fájlokat, nyitva hagyva a bejövő GLS fuvardíjszámlákat.

---

## 2. Decision & Architektúrális Megoldás

### 2.1 Készpénzes Rendezések Valós Idejű Házipénztár Bejegyzése (`record_manual_invoice_payment`)
Módosítottuk a `record_manual_invoice_payment` PostgreSQL RPC-t (`20261008193000_sync_manual_cash_payments_to_petty_cash.sql`):
1. Ha a megadott `p_payment_type` értéke `cash`, `kp` vagy `petty_cash`:
   - Automatikusan feloldja a cég alapértelmezett pénztárát (`petty_cash_registers.is_default = true`, vagy a legkorábban létrehozott pénztár). Ha egyetlen pénztár sem létezik, automatikusan létrehoz egy „Központi pénztár” regisztert.
   - Adószám (8 jegyű törzsszám) vagy pontos partnernév alapján feloldja a `partner_id`-t a `partners` törzsből.
   - Idempotens módon ellenőrzi, hogy létezik-e már tétel az adott számlához (`NOT EXISTS (SELECT 1 FROM petty_cash_entries WHERE source_table = ... AND source_id = p_invoice_id)`).
   - Létrehozza a tételt a `petty_cash_entries` táblában:
     - `amount`: Bejövő számlánál negatív (`-ABS(amount)`), kimenő számlánál pozitív (`ABS(amount)`).
     - `source_type`: `cash_expense` (kiadás) vagy `cash_sale` (bevétel).
     - `source_table`: `nav_invoices` vagy `invoices`.
     - `entry_date`: `p_payment_date`.
     - `status`: `'posted'`.
     - `routed_by`: `'manual'`.
     - `description`: `'Készpénzes kiadás (Kézi rendezés) - ' || partner || ' (' || számlaszám || ')'`.

### 2.2 `sync_petty_cash_entries` Szinkronizáció Kibővítése
Kibővítettük a `sync_petty_cash_entries` RPC feltételrendszerét mind a kimenő és bejövő NAV számlákra, mind a feltöltött bizonylatokra:
```sql
AND (
  payment_method IN ('CASH', 'KÉSZPÉNZ')
  OR (is_manual_payment = true AND LOWER(manual_payment_type) IN ('cash', 'kp', 'petty_cash'))
)
```
A dátumképzésnél a rendszer a tényleges fizetési dátumot preferálja: `COALESCE(manual_payment_date, invoice_issue_date)`.

### 2.3 GLS Kompenzációs Normalizálás és Fuvardíj Részletezők Mentessége
1. **Python Worker szinten (`report_extractor.py`):**
   - Létrehoztuk a `_normalize_invoice_or_package_number` segédfüggvényt, amely regex segítségével normalizálja a `0+HU` és `HU000xxxxxx` mintákat `HU00xxxxxx` szabványos formára a kompenzációs levelek beolvasásakor.
   - A `should_skip_gls_victoria_music` szűrőt felokosítottuk: a `SettlementDocument` és `InvoiceDocument` nevű fájlok, illetve a fuvardíj-fejlécekkel rendelkező táblázatok mentesülnek a bankszámlaszám-kötelezettség alól.
2. **PostgreSQL szinten (`settle_compensation_for_courier_report`):**
   - A kompenzációs elszámoló trigger függvénybe beépítettük a normalizálást, így még közvetlen manuális feltöltés esetén is megtalálja a NAV számlapárt:
     ```sql
     LOWER(REPLACE(REGEXP_REPLACE(REGEXP_REPLACE(cr.package_number, '^0+HU', 'HU', 'i'), '^HU000([0-9]{6})$', 'HU00\1', 'i'), ' ', ''))
     ```

---

## 3. Következmények és Előnyök

### Pozitív:
- **Pénzügyi konzisztencia:** Az Utalások oldalon történt készpénzes rendezés azonnal lecsökkenti a cég fizikai házipénztárának egyenlegét, így a könyvelőiroda és a cégvezető valós egyenleget lát.
- **Automatikus partner- és számlakapcsolat:** A házipénztár naplóban azonnal kattinthatóvá válik a kapcsolódó számla és partner.
- **Deduplikáció:** A szigorú `(source_table, source_id)` és triggermegkötések megelőzik a duplikált pénztárbizonylatok keletkezését.
- **Zökkenőmentes GLS feldolgozás:** Megszűntek a futárszámlák párosítási hibái és a felesleges kézi egyeztetések.

### Megkötések / Figyelmeztetések:
- **Nyitóegyenleg dátumkorlát (`start_date`):** Ha egy cég házipénztárában nyitóegyenleg van beállítva (pl. `2026-01-01`), a `sync_petty_cash_entries` szándékosan kizárja a nyitó dátum előtti számlákat, hogy ne torzítsa a lezárt korábbi évek egyenlegét. Ha egy régebbi számla rendezése ma történt meg készpénzben, a fizetési dátumnak az aktuális évet kell tükröznie.

---

## 4. Érintett Migrációk és Fájlok

- `supabase/migrations/20261008185500_enhance_compensation_invoice_matching.sql`
- `supabase/migrations/20261008193000_sync_manual_cash_payments_to_petty_cash.sql`
- `visibill-worker/report_extractor.py`
- `visibill-709fffdf/src/pages/TransfersPage.tsx`
- `visibill-709fffdf/src/test/bulkSettleAndCompensationNormalization.test.ts`
