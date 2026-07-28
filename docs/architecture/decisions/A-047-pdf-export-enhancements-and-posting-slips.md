# A-047: Robust PDF Export Pipeline, Paired Image Resolution & eaisybill Brand Kontírozó Lap

**Status:** Decided  
**Date:** 2026-07-28  
**Utoljára frissítve:** 2026-07-28  

## Context

A Visibill / eaisybill platform PDF exportálási funkciója ("Tételes Kontírozott" bizonylat exportálás) több kritikus működési és megjelenítési problémával küzdött:

1. **Auto-select & Realtime felülírás antipattern:** Az `InvoiceDataExportDialog` komponens a megnyitáskor automatikusan kijelölte a lapon lévő összes számlát, ha a főtáblázatban nem volt előzetes kijelölés. Továbbá a háttérbeli Supabase Realtime adatszinkronizáció re-renderelései törölték a felhasználó manuálisan beállított kijelölését, mert a `useEffect` a `invoices` tömb változására is újra lefutott.
2. **NAV ↔ Feltöltött Számlakép párosítás hiánya:** Amikor a felhasználó a NAV számlák fülről indított PDF exportot egy olyan NAV számlára, amelyhez létezett feltöltött fizikai számlakép (`invoices` tábla), az exportált PDF-be csak a Kontírozó Lap került bele, az eredeti számlakép hiányzott. A háttérbeli lekérdezés egy nem létező `nav_invoice_id` oszlopra hivatkozott.
3. **Karakterkorrupció és olvashatatlan Kontírozó Lap:** A Python Worker `_generate_posting_slip_image` modulja a szerverkörnyezetben (Linux Docker / Cloud) nem találta a relatív `arial.ttf` fájlt, emiatt a PIL modul beépített ASCII bitmap betűtípusára (`load_default()`) esett vissza. Ez a font nem támogatja a UTF-8 magyar ékezeteket (`ő`, `ű`, `é`, `á`, `ó`, `Í`), ami a betűk torzulásához, egymásra rajzolódásához és olvashatatlanságához vezetett.
4. **Hiányos számkonverzió:** A `%` jelet tartalmazó ÁFA kulcsok (`"0%"`, `"27%"`) és szöveges számok `float()` konverziója kivételt váltott ki, ami megszakította a Kontírozó Lap generálását.

---

## Decision

### 1. Dialógus Állapotkezelés (`InvoiceDataExportDialog.tsx`)
- **Alapértelmezett üres kijelölés:** Ha a dialógus úgy nyílik meg, hogy nincsenek előzetesen kijelölt számlák a főtáblázatban, az export dialógus üres kijelöléssel (`new Set()`) indít.
- **`prevOpenRef` használata:** A dialógus inicializálása kizárólag a zárt állapotból nyitott állapotba történő átmenetkor (`open && !prevOpenRef.current`) fut le. Háttérbeli adatszinkron és re-render esetén a felhasználó kijelölése sértetlen marad.

### 2. Kétrétegű NAV ↔ Feltöltött Számlakép Párosítás
- **Frontend szint (`InvoicesPage.tsx`):** NAV számlák exportálásakor a rendszer megkeresi a párosított feltöltött számlát a `bizonylatsorszam === invoice_number` feltétel alapján, és átadja annak `image_url` és `melleklet_url` mezőit.
- **Worker fallback szint (`pdf_export_processor.py`):** Ha a kérésben az URL mégis üres lenne, a worker az adatbázisból automatikusan kikeresi a párosított számlaképet az `id` és a `bizonylatsorszam` mezők alapján.
- **Oldalsorrend garancia:** Minden párosított számlánál a generált PDF sorrendje: **`[Számlakép / PDF]` ➔ `[Tételes Kontírozó Lap]`**.

### 3. Dinamikus Rendszer-Font Betöltés (`_get_font`)
- Létrehoztuk a `_get_font(size, bold)` segédfüggvényt, amely Windows és Linux (Ubuntu/Debian Docker) rendszereken felkutatja a feltelepített valódi TrueType betűtípusokat (`Arial`, `Segoe UI`, `Calibri`, `DejaVu Sans`, `Liberation Sans`).
- Ez garantálja a kristálytiszta, nagy felbontású, 100%-ig olvasható magyar ékezetes feliratokat.

### 4. Hibatűrő Numerikus Parser (`_safe_float`)
- Bevezettük a `_safe_float(val, default)` függvényt, amely eltávolítja a `%` jeleket, szóközöket, kicseréli a tizedesvesszőket, és kivételmentesen kezeli a szöveges és `null` értékeket.

### 5. eaisybill Brand Design Palette
- A Kontírozó Lap vizuális megjelenése a hivatalos **eaisybill Fintech Teal** brand színrendszert használja:
  - Fejléc banner: `#0D9488` (Fintech Teal)
  - Főkönyvi kártya: `#F0FDFA` (Light Teal Tint) kerettel (`#99F6E4`) és teal feliratokkal (`#0F766E` / `#0D9488`)
  - Táblázat fejlécsor: `#0F766E` (Dark Teal)
  - Összesítő banner: `#042F2E` (Deep Teal Slate) `#2DD4BF` (Bright Cyan) kiemeléssel a Bruttó Végösszegnél.

---

## Consequences

**Pozitív:**
- Törölve az automatikus kijelölés, a felhasználó teljes kontrollt kap az exportálandó számlák felett.
- A háttérbeli Realtime frissítések többé nem rontják el a kijelölést.
- A NAV számlák exportálásakor az elért feltöltött számlakép és a generált kontírozó lap tökéletes sorrendben kerül a PDF-be.
- Nyomdai minőségű, ékezetes, márkázott Kontírozó Lap jön létre.

**Negatív:**
- A szerver-oldali TTF betűtípus-keresés minimális (mikromásodperces) többletet jelent az első font-betöltéskor, de a memóriában elmarad a lassulás.

---

## Kapcsolódó
- [A-005: Edge Functions](./A-005-edge-functions.md) — `generate-pdf-export` (v18)
- [A-006: Python Worker](./A-006-python-worker.md) — `pdf_export_processor.py`
- [A-028: PDF Export Lifecycle](./A-028-pdf-export-lifecycle.md) — PGMQ queue export workflow
- [docs/design/02-design-tokens.md](../../design/02-design-tokens.md) — eaisybill Fintech Teal színrendszer
