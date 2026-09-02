# P-066: Főkönyvi Dátum Alap Kapcsoló és Beállítások UX

**Status:** Decided  
**Date:** 2026-09-03  
**Category:** UI / Accounting UX / General Ledger / Settings  
**Releváns jegy:** Kiss-Százi Emese (2026. szept. 2. 11:19)  

---

## Question
Hogyan biztosítsuk a könyvelők számára a Főkönyvben a teljesítés és kibocsátás kelte szerinti azonnali nézetváltást, és hol tudják ezt cégszintű alapértelmezettként menteni anélkül, hogy a felület használhatósága vagy a szűrés sebessége sérülne?

## Decision

1. **Szegmentált Dátum Alap Kapcsoló (Segmented Control):**
   - A Főkönyv oldal mindhárom nézetében (**Kivonat**, **Naplófőkönyv**, **Többéves Összehasonlítás**) a kártya fejlécének jobb oldalán elhelyezésre került egy kompakt szegmentált kapcsoló:
     - `[ 📅 Kibocsátás | 📅 Teljesítés ]`
   - A komponens egységes kiszervezést kapott (`renderDateBasisToggle()`), elkerülve a duplikációkat.
2. **URL Kétirányú Szinkronizáció:**
   - A kiválasztott dátum alap szinkronizálódik az URL-lel: `?date_basis=teljesites` vagy `?date_basis=kibocsatas`.
   - Az URL paraméter frissíti a böngészési előzményeket (`replace: true`), így az oldal újratöltésekor vagy könyvjelzőzésekor a könyvelő pontosan ugyanazt a nézetet látja.
3. **Beállítások Felülete (Books & Visibill):**
   - Az **eaisyBooks Beállítások** (`/accounty/settings`) és a **Visibill Cégbeállítások** (`/settings` -> Vállalkozás) oldalon új kártya jelent meg:
     - **„Főkönyvi & Könyvelési beállítások”**
     - Rádiógomb-választóval: *Kibocsátás kelte (Alapértelmezett)* vs. *Teljesítés dátuma*.
   - A kiválasztott érték menthető az adatbázisba (`company_settings.gl_date_basis`), és a felhasználó minden belépéskor ezt kapja alapértelmezésként.
4. **Excel Export és Táblázatfejlécek Megkülönböztetése:**
   - A letöltött Excel fájlok neve és fejléc-adatai egyértelműen mutatják az alkalmazott módot és az exportált időszakot:
     - Fájlnév: `Fokonyvikivonat_<Cég>_<KezdőDátum>_<ZáróDátum>_teljesites_alapjan_<időbélyeg>.xlsx`
     - Első oszlop fejléc: `Főkönyvi szám / Dátum (Teljesítés dátuma)` vagy `Dátum (Kibocsátás kelte)`.

## Rationale
- **Azonnali visszajelzés:** A kapcsoló egyetlen kattintással újraaggregálja az egyenlegeket anélkül, hogy a felhasználónak beállítások menükbe kellene navigálnia.
- **Transzparencia:** Az export fájl neve és az oszlopfejléc garantálja, hogy a könyvelőirodán belül vagy külső audit során ne lehessen összekeverni a teljesítés és kibocsátás szerinti kimutatásokat.

## Kapcsolódó
- BRD: [Decision 049: Főkönyvi Dátum Alap Üzleti Szabály](../../business/decisions/049-gl-date-basis-fulfillment-vs-issue.md)
- ADR: [A-085: Főkönyvi Dátum Alap RPC Pushdown és Dinamikus Chunk Reload Recovery](../../architecture/decisions/A-085-gl-date-basis-rpc-and-chunk-error-recovery.md)
