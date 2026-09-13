# A-112: Futárszolgálati Kompenzációs Értesítők Kétirányú Automatikus Számlarendezése és Futárriport UI Párosítás (GLS / Courier Compensation Auto-Settlement & UI)

**Status:** Decided  
**Date:** 2026-09-11  
**Utoljára frissítve:** 2026-09-13  

---

## Context

A futárszolgálatokkal (pl. GLS General Logistics Systems Hungary Kft.) szerződött ügyfelek (pl. Victoria Music Kft.) esetében az elszámolás kétirányú:
1. A futárszolgálat beszedi a vevőktől az utánvét összegeket (COD).
2. A futárszolgálat időszakonként kiszámlázza a fuvardíjakat mint bejövő szállítói számla (`invoice_direction = 'INBOUND'`, pl. `HU00869049`, `HU00919877`, `HU00920078`).
3. A felek a fuvardíj tartozást és a beszedett utánvét követelést **kompenzációs értesítővel** (beszámítással) egyenlítik ki.

Korábban az automatikus számlapárosító pipeline kizárólag kimenő vevői számlákat (`invoice_direction = 'OUTBOUND'`) keresett a futárriportokhoz érkező banki átutalásokhoz. Ez két kritikus problémát okozott:
- **Bejövő szállítói számlák nyitva maradása:** A kompenzált fuvardíjszámlák (`HU...`) nyitottak maradtak a rendszerben, mivel banki kifizetés nem kapcsolódott hozzájuk.
- **Kimenő utánvétek (COD) nyitva maradása 0 Ft-os banki utalásnál:** Amikor a futárcég a beszedett utánvétek 100%-át beszámította a fuvardíj tartozásokba, a banki jóváírás 0 Ft volt (nem érkezett banki tranzakció). Ennek következtében a vevői utánvétes számlák sem záródtak le, és a felhasználóknak kézzel kellett volna egyenként megkeresniük és fizetettre állítaniuk az érintett számlákat.
- **Felhasználói felület áttekinthetetlensége:** A futárriportok párosítási dialógusában a kötegelt fejléc sorok (`row_type = 'total'`) és tételsorok (`row_type = 'item'`) összeolvadtak, nem volt látható a kapcsolódó NAV számlaszám, és hiányzott az 1-kattintásos kötegelt elfogadás.

A Kollár Kristóf (Victoria Music Kft.) által beküldött 6. sz. hibajegy nyomán szükségessé vált a kétirányú automatikus beszámítási lánc és a korszerű futárriport UI megvalósítása.

---

## Decision

Az automatikus beszámítás megvalósításához kibővített adatbázis szintű triggert, segédfüggvényt, RPC bővítést és dedikált felületi komponenseket vezettünk be.

### 1. Kétirányú `settle_compensation_for_courier_report` Függvény
A `20260912190000_courier_compensation_outbound_settlement.sql` migrációban a funkció kétirányúvá vált:

#### A) Bejövő szállítói számlák (`INBOUND`) automatikus rendezése
- A kompenzációs sorban szereplő számlaszám(ok) kinyerése (`package_number` és `reference_number` mezőkből), több számlaszám esetén darabolva és alfanumerikusan normalizálva (`regexp_replace(..., '[^a-zA-Z0-9]', '', 'g')`).
- Cég- és irány-izoláció: kizárólag a megadott `company_id` és `invoice_direction = 'INBOUND'` számlákat vizsgálja.
- **Bejövő NAV számlák (`nav_invoices`) frissítése:**
  - `paid = true`
  - `is_manual_payment = true` (kivéve ha létezik banki tranzakció)
  - `manual_payment_type = 'compensation'`
  - `manual_payment_date = delivery_date` (vagy aktuális dátum)
  - `manual_payment_note = '[FUTÁR] kompenzációs értesítő alapján automatikusan rendezve'`
- **Kézi / feltöltött bejövő számlák (`invoices`) frissítése:**
  - `fizetve = true`, `is_manual_payment = true`, `manual_payment_type = 'compensation'`.

#### B) Kimenő vevői COD számlák (`OUTBOUND`) automatikus rendezése (0 Ft-os átutalás esetén)
- Ha a kompenzációs értesítő utánvét-visszatartást tartalmaz (`abs(cod_amount) > 0`), a függvény megkeresi az azonos összegű (`abs(cod_amount - comp_amt) <= 5.0`), banki utalás nélküli `courier_reports` batch-et (`row_type = 'total'`), amelyhez 0 banki jóváírás érkezett:
  - A batch összes tételsorához (`row_type = 'item'`) tartozó vevői NAV számlát (`matched_nav_invoice_id`) automatikusan kifizetettre állítja:
    - `paid = true`, `is_manual_payment = true`, `manual_payment_type = 'compensation'`
    - `manual_payment_note = '[FUTÁR] kompenzációs értesítő alapján automatikusan rendezve'`
  - A futárriport tételsorokat és a total sort lezárja: `match_status = 'full'`, `match_confidence = 1.0`, `match_reason = '[FUTÁR] kompenzáció: 100% beszámítva (banki utalás nélkül)'`.

### 2. Adatbázis Trigger (`trg_courier_reports_auto_settle_compensation`)
- `AFTER INSERT OR UPDATE OF package_number, reference_number, row_type ON courier_reports`
- `WHEN (NEW.row_type = 'compensation')`
- Azonnal lefut a kompenzációs dokumentum worker vagy kézi feltöltésekor, azonnal lezárva a szállítói számlát és a kapcsolódó COD batch-et.

### 3. Frontend UI Fejlesztések (`MatchedCourierReportsCard.tsx`)
- **Összesítő sáv leválasztása:** A kötegelt fejléc sor (`row_type = 'total'`) külön összefoglaló kártyán jelenik meg (futárszolgálat neve, csomagok száma, bruttó utánvét összeg), elválasztva az egyes csomagtételektől.
- **NAV Számlaszám Badge:** A csomagszám és címzett mellett kék kiemelt kitűző jelzi a párosított NAV számla sorszámát (pl. `HU...` vagy `2026/...`), kattintható számlainformációkkal.
- **1-Kattintásos Kötegelt Jóváhagyás:** A `handleBatchMatchAllCourierItems` gomb és a `batchMatchCourierItems` RPC révén a felhasználó egyetlen kattintással véglegesítheti az összes csomagtétel összerendelését a banki tranzakcióval.

---

## Consequences

- **Pozitív:**
  - A felhasználónak sem a beszámított GLS számlákat, sem a 0 Ft-os utalású vevői utánvéteket nem kell manuálisan kifizetettre állítania.
  - A Kintlévőségek és Pénzügyi Áttekintés nézetek valós képet mutatnak, nem jelennek meg fantom-tartozások.
  - Teljes auditnyom: mind a számlák (`manual_payment_note`), mind a futárriportok (`match_reason`) pontosan rögzítik az automatikus kiegyenlítés forrását.
  - A párosítási felületen a NAV sorszám azonnal látható, a kötegelt jóváhagyás 1 kattintás.
- **Negatív/Kockázatok:**
  - Ha a futár elírja a számlaszámot a kompenzációs értesítőben, a tétel `unmatched` marad, ami a futárriportok táblázatában kézzel vagy javított újrafeltöltéssel kezelendő.

## Kapcsolódó
- [A-047: Robust PDF Export Pipeline & Posting Slips](./A-047-pdf-export-enhancements-and-posting-slips.md)
- [A-059: TransactionMatchingCore & Moduláris UI Architektúra](./A-059-transaction-matching-core-and-modular-ui.md)
- [P-017: AI Párosítás & Kapcsolódó Tranzakciók Megjelenítése](../../product/decisions/P-017-matching-display.md)

