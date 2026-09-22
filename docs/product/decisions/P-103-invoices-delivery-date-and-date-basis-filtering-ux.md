# P-103: Számlák Teljesítés Dátuma Szűrés és Dátum Alap Kapcsoló UX

**Status:** Decided  
**Date:** 2026-09-22  
**Category:** UI / Accounting UX / Invoices / Settings  
**Releváns jegy:** Kollár Kristóf (Victoria Music Kft., 2026. szept. 21. 22:15)  

---

## Question
Hogyan biztosítsuk a számlák modulban (`/invoices`) a teljesítés dátuma (`teljesites_datuma` / `invoice_delivery_date`) és a kibocsátás kelte (`kibocsatas_datuma` / `invoice_issue_date`) szerinti szűrést, támogatva a céges szintű alapbeállítást (`gl_date_basis`), anélkül, hogy a meglévő szűrősáv és URL paraméterezés sérülne?

## Decision

1. **Szegmentált Dátum Alap Kapcsoló a Számlák Szűrősávban:**
   - Az `InvoiceFilterBar` komponensben a dátumválasztó mezők elé bekerült egy szegmentált kapcsoló:
     - `[ 📅 Kibocsátás | 📅 Teljesítés ]`
   - Vizuálisan és működésben illeszkedik a Főkönyvi modulban (`P-066`) bevezetett felületi mintához.
2. **Dinamikus Dátumválasztó Bekötés:**
   - A dátumválasztó (`-tól` és `-ig` popover) aktív módja a kiválasztott dátum alaphoz kötődik:
     - Kibocsátás módban: `issueDateFrom` és `issueDateTo`
     - Teljesítés módban: `deliveryDateFrom` és `deliveryDateTo`
   - Ha a nem aktív dátumtípusra korábban be volt állítva szűrőérték, a szűrősáv egy kompakt chip jelvényben (`Kibocsátás: ÉÉÉÉ-HH-NN – ÉÉÉÉ-HH-NN [x]` vagy `Teljesítés: ...`) jeleníti meg azt, 1 kattintásos törlési lehetőséggel.
3. **Cégbeállítások Alapértelmezés Érvényesítése:**
   - A számlák felület (`useInvoiceFilters`) figyelembe veszi a cégbeállításokban rögzített `gl_date_basis` értéket (`companySettings?.gl_date_basis`). Amennyiben a felhasználó a beállításokban "Teljesítés szerint"-re állította a számlakezelést, az oldal megnyitásakor automatikusan a Teljesítés alapú nézet és szűrés töltődik be.
4. **Kétirányú URL Szinkronizáció:**
   - URL paraméterek: `db` (`kibocsatas` | `teljesites`), `ddf` (`delivery_date_from`), `ddt` (`delivery_date_to`).
   - Kompatibilitás a megosztott linkekkel és könyvjelzőkkel, visszafelé kompatibilis fallback az `idf` / `idt` paraméterekkel.

## Rationale
- **Könyvelői és ÁFA Egyezés:** Az áfa-bevallások és folyószámla-egyeztetések alapja gyakran a teljesítés dátuma. Ha a cég teljesítés alapú elszámolást választ, elengedhetetlen, hogy a számlalistát is a teljesítés dátuma szerint tudja ellenőrizni, kiszűrve az adott időszaki számlákat.
- **Zéró Felületi Túlterhelés:** A szegmentált kapcsoló és a dinamikus beviteli mező révén nem kell 4 külön naptár inputot kitenni a szűrősávba, a felület tiszta és átlátható marad.

## Kapcsolódó
- PRD: [P-066: Főkönyvi Dátum Alap Kapcsoló és Beállítások UX](./P-066-gl-date-basis-toggle-and-settings-ux.md)
- ADR: [A-138: Számlák Teljesítés Dátuma és Dátum Alap RPC Szűrés](../../architecture/decisions/A-138-invoices-delivery-date-and-date-basis-rpc-filters.md)
