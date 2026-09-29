# P-040 — Partnertörzs: Dual-table számlák + interaktív detail panel

> **Státusz:** ✅ Decided  
> **Dátum:** 2026-06-26  
> **Utoljára frissítve:** 2026-09-29  
> **Implementálva:** `PartnersPage.tsx`, `PartnerInvoiceDetailDialog.tsx`, `navTaxpayerService.ts`

---

## Kontextus

A Partnertörzs jobb oldali paneljén korábban csak NAV Online Számlák (nav_invoices) jelentek meg
statikus listaként. A user nem látott beküldött számlákat, nem tudott kattintani a számlákra,
és a számlaszámok aggregáció sem volt teljes a master listán.

---

## Döntések

### 1. Dual-table számlalekérdezés

A partner számlái mindkét forrásból lekérdezve adószám alapján:
- **NAV:** `nav_invoices` — `supplier_tax_number` / `customer_tax_number` egyezés
- **Beküldött:** `invoices` — `elado_vat_id` / `vevo_vat_id` prefix egyezés (első 8 karakter)
  - A `.or()` filter tartalmazza a HU-prefixes mintákat is: `elado_vat_id.ilike.HU${cleanTax}%`

A két lista merge-elve, dátum szerint csökkenő sorrendben jelenik meg.

**VAT normalizáció** (2026-07-04 fix): Az `invoices` tábla `elado_vat_id` / `vevo_vat_id` mezői
tartalmazhatnak `HU` prefixet és kötőjeleket (pl. `HU22626547`, `22626547-2-41`).
A normalizáció lépései: `replace(/-/g, '')` → `replace(/^HU/i, '')` → `substring(0, 8)`.

**Kapcsolat típusa:** loose coupling — nincs `partner_id` idegen kulcs az `invoices`-ban,
az egyeztetés adószám-prefix alapú (`tax_number.replace(/-/g,'').replace(/^HU/i,'').substring(0,8)`).

### 2. Master lista számlaszám aggregáció

A partnerek listájában az „X db" oszlop most mindkét táblából számítja az összes számlát.
A logika kliensoldali (`Promise.all` párhuzamos lekérdezéssel), nincs RPC/migráció.

**⚠️ 2026-07-04 fix:** A korábbi `if/else if` struktúra csak az eladó VAGY vevő adószámot
nézte — OUTBOUND számláknál az eladó a saját cég, így a partner (vevő) oldal nem számolódott.
Javítás: mindkét oldalt (`elado_vat_id` ÉS `vevo_vat_id`) **egymástól függetlenül** vizsgáljuk.

### 3. Tab-alapú szétválasztás a jobb panelen

A számlákat egy belső tab-sáv választja szét:
- **NAV** tab — `nav_invoices` forrású számlák
- **Beküldött** tab — `invoices` forrású számlák

Minden tabon darabszám badge látható. Aktív tab vizuálisan kiemelve (pill-style switcher).

### 4. Számlakereső

A tabok fölött egy kompakt `h-8` keresőmező szűri az aktív tab számláit számlaszám alapján.
A kereső partner-váltáskor automatikusan törlődik.

### 5. Kattintható számla kártyák → PartnerInvoiceDetailDialog

Minden számla kártya kattintható (`<button>`), ami megnyitja a `PartnerInvoiceDetailDialog`-ot.
A dialógus tartalmazza:
- Fejléc: számlaszám, ellenpartner neve, kiállítás dátuma, fizetési határidő, bruttó összeg, fizetési mód
- Irány badge (Kimenő / Bejövő) + forrás badge (NAV / Beküldött)
- Tételek táblázat: Megnevezés, Mennyiség, Egység, Nettó, ÁFA kulcs, Bruttó, **Főkönyvi szám**

Tételek forrása:
- NAV → `nav_invoice_items` (`nav_invoice_id` join)
- Beküldött → `invoice_items` (`invoice_id` join)

Főkönyvi szám: `gl_classifications` JSONB első elérhető értékének `gl_number` mezője.

#### 5.1 Számlakép előnézet (2026-07-05)

Beküldött számláknál a fejlécben megjelenik egy **„Számlakép megtekintése"** gomb (`FileImage` ikon).
Kattintásra egy **második, stacked Dialog** nyílik meg a detail dialog felett:
- **PDF**: iframe + „Megnyitás új ablakban" gomb
- **Kép** (JPG/PNG/WebP): `<img>` renderelés
- **Egyéb fájltípus**: „Megnyitás új ablakban" fallback
- Loading spinner + error handling

Adatlánc: `invoices.invoice_uploads_id` → `invoice_uploads.file_url`

NAV számláknál a gomb NEM jelenik meg (nincs feltöltött fájl).

### 6. NAV státusz eltávolítása

A cégadatok grid-ből eltávolítva a statikus „NAV státusz: Kapcsolódva" mező — értéke
nem volt valós adatból számítva, félrevezető volt. Helyette a header-ben feltételes
„NAV szinkronizált" badge látható, csak akkor, ha valóban van NAV számla a partnernél.

### 7. Layout és Kártya Igazítás (2026-09-29)

A Partnertörzs alsó mester-részletező (master-detail) szekciójának külső margója és paddingja korábban eltért a felette elhelyezkedő Top 10 Partner ranking kártyák (`PartnerRankingCard`) dobozától, vizuális lépcsőzetességet okozva.
- **Megoldás:** A mester táblázat és a jobb oldali panel közös konténere egységes `px-6 py-6` térközt kapott, pontosan igazodva a ranking kártyák bal és jobb margójához.
- A kártyakeretek egységes `border-border/60` szegéllyel, konzisztens lekerekítéssel és belső görgetősáv-kezeléssel rendelkeznek, biztosítva a zökkenőmentes vizuális ritmust.

### 8. NAV Lekérdezés Dialógus Integráció (2026-09-29)

Új partner felvitelekor vagy meglévő adatainak szerkesztésekor a modal adószám beviteli mezője mellé beépítésre került a közvetlen "NAV lekérdezés" gomb (`navTaxpayerService` / `nav-query-taxpayer`).
- **Autofill funkció:** Az adószám beírása után egyetlen kattintással kinyeri a hivatalos cégnevet, a szabványosított székhelycímet, és az adószámot automatikusan a hivatalos magyar 8-1-2 formátumra (`XXXXXXXX-Y-ZZ`) konvertálja.
- **Hiba- és állapotkezelés:** Sikeres betöltésnél zöld sikerjelzés, érvénytelen vagy nem létező adószámnál informatív toast értesítés.

### 9. "✨ NAV 8-1-2" Gyorsdúsítás és Prefix Számlapárosítás Védelme (2026-09-29)

- **Jobb oldali Detail Panel Gyorsdúsító Gomb:** Ha a kiválasztott belföldi partner adószáma még a régi 8 számjegyű formátumban szerepel (`isDomestic8DigitTaxNumber`), a jobb oldali panel fejlécében megjelenik a "✨ NAV 8-1-2" gomb.
  - Kattintásra a rendszer a háttérben lekérdezi a NAV Online Számla v3 adatbázist, és frissíti a rekordot: hivatalos 8-1-2 adószám, `incorporation` cégforma, valamint hiányzó címadatok pótlása.
  - Optimista UI frissítés garantálja az azonnali visszajelzést, miközben a backend védi az egyediséget a `UNIQUE(company_id, tax_number)` megszorítás mellett.
- **Számla-összerendelés Védelme (Prefix Search):** A partner adószámának 8-ról 11 karakterre (8-1-2) való bővülésekor a számlakapcsolat nem sérül: a lekérdezés a korábbi egzakt `supplier_tax_number.eq.${cleanTax}` helyett prefix alapú `supplier_tax_number.ilike.${cleanTax}%` szűrést alkalmaz, így a korábbi 8 jegyű vagy kötőjel nélküli számlák is hiánytalanul megjelennek a listában.

---

## Elutasított alternatívák

- **RPC/View a számlaszámok aggregáláshoz:** Overhead, kliensoldali számítás elegendő.
- **partner_id idegen kulcs az invoices-ban:** Migráció kell, adószám alapú lazy match elég.
- **All-in-one lista (nincs tab):** Nehezen olvasható ha mindkét forrás vegyesen van.

---

## Kapcsolódó fájlok

- `src/pages/PartnersPage.tsx`
- `src/components/partners/PartnerInvoiceDetailDialog.tsx`
- `src/components/partners/PartnerRankingCard.tsx`
- `src/services/navTaxpayerService.ts`
- Táblák: `partners`, `nav_invoices`, `nav_invoice_items`, `invoices`, `invoice_items`, `invoice_uploads`

## Kapcsolódó
- [A-024: Partner Upsert Stratégia](../../architecture/decisions/A-024-partner-upsert-strategy.md)
- [A-027: Partner Ranking & Treemap](../../architecture/decisions/A-027-partner-ranking-treemap.md)
- [A-132: NAV Online Számla v3.0 queryTaxpayer Integráció](../../architecture/decisions/A-132-nav-query-taxpayer-auto-fill.md)

