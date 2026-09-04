# A-087: Magnum Audit XML Főkönyvi Import, Tükörkód Feloldás, Számlatükör Auto-Szinkronizáció és RPC Robusztusság

**Status:** Decided  
**Date:** 2026-09-04  
**Utoljára frissítve:** 2026-09-04  

## Context

A könyvelőirodák által használt könyvelőprogramokból (pl. Magyar Szoftver / Magnum, Kulcs-Soft, Novitax) exportált szabványos és fél-szabványos könyvelési XML audit állományok beemelése kritikus fontosságú a Visibill / eaisyBooks főkönyvi moduljában.

A Victoria Music Kft. 2026.01.01–2026.07.31 közötti időszaki főkönyvi XML-jének (`AuditXML_FK_VictMusiKft_20260101-20260731.xml`) feldolgozása során három súlyos architekturális és adat-inkonzisztencia probléma merült fel:

1. **Magnum Tükörkód (`<TKod>`) szemantika:**
   A Magnum rendszer nem különálló Tartozik és Követel számla tag-eket exportál tételenként, hanem egyetlen főkönyvi számlát (`<FSzla>`) és egy jelleg indikátort (`<Jel>T</Jel>` vagy `<Jel>K</Jel>`), a tétel ellenszámláját pedig egy tükörkód tag-ben (`<TKod>`) adja meg. Ha ezt a pipeline nem párosította megfelelően, a bejegyzések egyik fele elveszett, vagy nem jött létre érvényes kettős könyvelési pár.

2. **Főkönyvi Mérlegkimutatás Eltűnés (`CROSS JOIN LATERAL` hiba a `get_gl_balances` RPC-ben):**
   A `get_gl_balances` és `get_gl_categorized_items` tárolt eljárások korábban `CROSS JOIN LATERAL (SELECT ... FROM gl_accounts ga WHERE ... LIMIT 1)` kapcsolattal keresték a számla adatait. Amennyiben a cégnél a beimportált naplóbejegyzésben szereplő alszámla (pl. `261111` Áruk) még nem létezett a cég kiválasztott `gl_presets` számlatükrében, a `CROSS JOIN LATERAL` eldobta az adott napló tételt! Ennek következtében a mérlegből több mint 115,4 millió Ft értékű készlet- és egyéb tétel teljesen hiányzott a frontend kimutatásokból.

3. **Sztornó és Negatív Tételek Elvesztése:**
   A `get_gl_categorized_items` eljárásban szereplő hardcoded `AND je.amount > 0` szűrő miatt a sztornó és helyesbítő tételek (negatív összegek) kiszűrődtek, megbontva a főkönyvi egyezőséget és a tételes auditálhatóságot.

4. **Hiányzó Cég Számlatükör (`gl_accounts`) és RLS Jogosultságok:**
   Ha a céghez nem volt még konfigurálva vagy hiányos volt a számlatükör preset, az importált tételek nem tudtak összekapcsolódni a számlákkal. Továbbá a `gl_journal_entries` táblán csak `SELECT` RLS policy létezett authenticated felhasználókra, így webes import vagy kézi felülbírálás esetén permission denied hiba keletkezett.

---

## Decision

### 1. Magnum XML Streaming Parser Tükörkód Feloldás (`audit_xml_parser.py`)
A parser felismeri a Magnum-specifikus `<TKod>` címkét és a `<Jel>` értékét:
- Ha `jel == 'T'`: a bejegyzés elsődleges számlája (`account_code`) a **Tartozik** oldal, a `<TKod>` (tükörkód) pedig a **Követel** oldal (`credit_account_code`).
- Ha `jel == 'K'`: az elsődleges számla (`account_code`) a **Követel** oldal, a `<TKod>` pedig a **Tartozik** oldal (`debit_account_code`).
- A parser garantálja, hogy a kimeneti tételeknél mind a `debit_account_code`, mind a `credit_account_code` kitöltött legyen, megvalósítva a szigorú kettős könyvelési egyensúlyt.
- Bizonylatszám fallback: ha a `<Bizonylatszam>` üres, a `<pu_azo>` (pénzügyi azonosító) vagy a tételszám kerül be bizonylatszámként.

### 2. Automatikus Számlatükör Szinkronizáció a Workerben (`audit_xml_handler.py`, Step 5.5)
Az import során a worker az 5.5 lépésben automatikusan:
- Ellenőrzi a cég aktív presetjét a `gl_presets` táblában; ha nem létezik, automatikusan létrehoz egy alapértelmezett számlatükröt (`[Cég neve] Alapértelmezett számlatükör`).
- Biztosítja a magyar számlakeret 1–9-es főosztályait a `gl_account_classes` táblában (1: Eszközök, 2: Készletek, 3: Követelések/Pénzeszközök, 4: Források, 5: Költségnemek, 8: Ráfordítások, 9: Bevételek).
- Összegyűjti az összes, XML-ben szereplő egyedi főkönyvi számlaszámot, hierarchikusan felépíti a hiányzó 2-3 jegyű számlacsoportokat, és a hiányzó számlákat kötegelten beszúrja a `gl_accounts` táblába a megfelelő számlatípussal (`asset`, `liability`, `equity`, `revenue`, `expense`).

### 3. Főkönyvi RPC Robusztusítás (`LEFT JOIN LATERAL` és Sztornó Támogatás)
- A `get_gl_balances` és `get_gl_categorized_items` RPC-kben a `CROSS JOIN LATERAL` helyett `LEFT JOIN LATERAL (...) ON true` került alkalmazásra. Ha egy tételhez nem talál közvetlen számla mappinget a presetben, a rendszer a számlaszám első számjegye (1–9) alapján fallbackel az alapértelmezett főosztályra, így egyetlen tétel sem vész el a mérlegből.
- A `get_gl_categorized_items` szűrését `AND je.amount != 0`-ra módosítottuk (az `AND je.amount > 0` helyett), biztosítva a sztornó és negatív korrekciós tételek megjelenését és a pontos egyenleg-egyezést.
- Az eljárás kiegészült a devizás mezők (`original_amount`, `currency`, `exchange_rate`) átadásával.

### 4. Frontend Deviza Támogatás (`GeneralLedgerTable.tsx`)
A tétel részletező oldalán (Detail Sheet) a nem HUF devizanemű könyvelési tételeknél megjelenik az eredeti devizaösszeg, a devizanem (pl. EUR, USD) és az alkalmazott könyvelési árfolyam.

### 5. `gl_journal_entries` RLS Szabályzatok Bővítése
A `gl_journal_entries` táblán a korábbi kizárólagos `SELECT` jogosultság mellett létrehoztuk az `INSERT`, `UPDATE`, és `DELETE` RLS szabályokat autentikált felhasználók számára (`company_members` tagsági ellenőrzéssel).

---

## Consequences

### Pozitív:
- **Tökéletes Főkönyvi Egyezőség:** A Victoria Music Kft. 4 805 tételének beemelése után a Tartozik (1 555 894 103 Ft) és Követel (1 555 894 103 Ft) forgalom centire egyezik (`balance_diff = 0 Ft`).
- **Nincs Adatvesztés:** A `LEFT JOIN LATERAL` miatt még ismeretlen alszámlák esetén sem esik ki egyetlen forint sem a kimutatásokból.
- **Nulla Kézi Konfiguráció:** Új cég XML importálásakor nem kell előre manuálisan felvenni a számlatükröt; a worker felépíti a teljes számlaszerkezetet az XML alapján.
- **Multi-vendor Kompatibilitás:** A parser mostantól zökkenőmentesen kezeli a Kulcs-Soft és a Magyar Szoftver (Magnum) formátumokat is.

### Negatív / Kockázatok:
- Az auto-generált számlák megnevezése az XML-ben szereplő leírásra támaszkodik; ha az XML-ben nincs megnevezés a számlához, szintetikus név (pl. `Számla 261111`) generálódik, amelyet a könyvelő később módosíthat.

---

## Kapcsolódó
- [A-006: Python Worker Architektúra](./A-006-python-worker.md)
- [A-085: Főkönyvi Dátum Alap RPC Pushdown](./A-085-gl-date-basis-rpc-and-chunk-error-recovery.md)
- [A-086: Főkönyvi Könyvelési Státusz Szűrő](./A-086-gl-posting-status-filter-and-journal-governance.md)
