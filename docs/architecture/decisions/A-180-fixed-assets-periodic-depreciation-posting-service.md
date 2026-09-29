# A-180: Tárgyi Eszköz Időszaki Értékcsökkenés (ÉCS) Elszámolás és Vegyes Napló Feladási Architektúra

**Status:** Decided  
**Date:** 2026-09-29  
**Utoljára frissítve:** 2026-09-29  

## Context

A Visibill / eaisyBooks Tárgyi Eszköz Nyilvántartó (TENY) modulja ([A-164](./A-164-development-reserve-fixed-assets-db-and-depreciation.md)) analitikus szinten pontosan nyilvántartotta a tárgyi eszközöket, a bruttó értéket, maradványértéket, hasznos élettartamot és a számviteli/társasági adó szerinti havi leírási összegeket.

Azonban a kettős könyvviteli főkönyvi modul felé nem létezett automatizált vagy kötegelt feladási folyamat:
1. **Analitika és Főkönyv szétválása:** Az értékcsökkenés csak a tárgyi eszköz kártyákon és számítási segédtáblákon létezett. A főkönyvi Vegyes naplóba (`acc_journal_headers`, `acc_journal_lines`) a könyvelőknek kézzel, tételenként vagy külső kalkulációk alapján kellett volna rögzíteniük a leírási tételeket.
2. **Különböző számviteli politikák:** A cégek eltérő zárási gyakorisággal dolgoznak: van, aki havonta, van, aki negyedévente, és van, aki kizárólag év végén számolja el az amortizációt egy összegben. Egy merev, csak havi ütemezésű rendszer nem fedte le a valós könyvelői igényeket.
3. **Számlatükör-preset relációs inkonzisztencia:** A korábbi auto-poster implementációk a nem létező `companies.active_coa_preset_id` oszlopot próbálták olvasni, ami miatt a cégek (pl. Test Kft.) egyedi számlatükreihez tartozó számlák feloldása meghiúsult, és az eszközökhöz nem rendelődött hozzá halmozott ÉCS főkönyvi számlaszám.
4. **Duplakönyvelés kockázata:** Időszaki elszámolás újrafuttatásakor szigorúan meg kell akadályozni, hogy ugyanarra az időszakra kétszer generálódjon le az értékcsökkenési bizonylat.

## Decision

Kifejlesztettük a tárgyi eszközök időszaki értékcsökkenés elszámolási és Vegyes naplóba történő automatikus feladási szolgáltatását (`src/lib/fixed-assets/depreciationPostingService.ts`), kiegészítve a hibajavított számlatükör-preset feloldó logikával.

### 1. Dinamikus Számlatükör-Preset Feloldás (`resolveActivePresetId`)
A `companies` tábla nem tartalmaz közvetlen `active_coa_preset_id` oszlopot. A preset-feloldás determinisztikus prioritási sorrendet követ a `chart_of_accounts_presets` táblából:
1. **Cég-specifikus aktív sablon:** `company_id = companyId AND is_active = true`
2. **Céghez rendelt bármely sablon:** `company_id = companyId` (ha nincs explicit aktív jelölő)
3. **Rendszerszintű általános sablon:** `type = 'generic'`

A feloldott preset vagy cégazonosító alapján a rendszer lekéri a főkönyvi számlákat:
- **Költség számla (Tartozik):** Keresi a `5711` (Terv szerinti ÉCS leírás) vagy `571` kezdetű számlaszámokat, illetve az 5-ös számlaosztályban lévő „értékcsökkenés” megnevezésű számlát.
- **Halmozott ÉCS számla (Követel):** Az eszköz saját bruttó főkönyvi számlája (pl. `1341`, `143`), vagy kategóriája / leltári száma alapján intelligensen párosít:
  - `11x` (Vagyoni értékű jogok, szellemi termékek) $\rightarrow$ `119xx`
  - `12x` (Ingatlanok) $\rightarrow$ `129xx`
  - `13x` (Műszaki berendezések, gépek, járművek) $\rightarrow$ `139xx` (pl. `1341` $\rightarrow$ `13941` vagy `1399`)
  - `14x` (Egyéb berendezések, felszerelések, járművek) $\rightarrow$ `149xx` (pl. `1431` $\rightarrow$ `1493` vagy `1499`)

### 2. Rugalmas Számviteli Időszak Típusok és Determinisztikus Bizonylatszámok
A rendszer 4 időszaki elszámolási módot támogat, szabványosított, egyedi bizonylatszám-képzéssel (`document_id`):
- **Havi elszámolás (`monthly`):** `ECS-YYYY-MM` (pl. `ECS-2026-08`)
- **Negyedéves elszámolás (`quarterly`):** `ECS-YYYY-Qx` (pl. `ECS-2026-Q3`)
- **Éves záró elszámolás (`annual`):** `ECS-YYYY-EVES` (pl. `ECS-2026-EVES`)
- **Egyedi intervallum (`custom`):** `ECS-YYYYMMDD-YYYYMMDD`

### 3. Kettős Könyvvitel és Kiegyensúlyozott Kontírozási Logika
Az elszámolás során a feladási motor (`postDepreciationRunToLedger`) a cég aktív Vegyes naplójába (`acc_journals` ahol `code = 'VE'` vagy névben szerepel a „vegyes”) hoz létre egy könyvelési bizonylatot (`acc_journal_headers`):
- **Fejléc:** `entry_type = 'NORMAL'`, `source = 'AUTOMATIKUS'`, `currency = 'HUF'`, `document_id`, `posting_date`.
- **Tételek (`acc_journal_lines`):** Minden amortizálódó eszközre szigorúan kiegyensúlyozott T/K könyvelési tételpár készül:
  - **T (Tartozik):** `5711` Terv szerinti ÉCS leírás (Összeg: időszaki ÉCS)
  - **K (Követel):** `139xx` / `149xx` Halmozott értékcsökkenés (Összeg: időszaki ÉCS)
- **Matematikai egyensúly:** $\sum \text{Tartozik} = \sum \text{Követel}$, forintra megegyezően.

### 4. Idempotencia és Duplikáció Megelőzés
A könyvelési futtatás előtt a motor ellenőrzi az `acc_journal_headers` táblát:
- Ha létezik azonos `company_id` és `document_id` értékű fejléc, amelynek státusza nem `'SZTORNOZOTT'`, a rendszer megtagadja a könyvelést és hibaüzenetet küld.
- Ez kizárja, hogy ugyanazon hónap vagy negyedév amortizációja kétszer kerüljön a könyvekbe.

### 5. Atomi Véglegesítés és Sorszámozás (`acc_post_journal_entry` RPC)
A sorok beszúrása után a rendszer a PostgreSQL `acc_post_journal_entry` tárolt eljárást hívja meg:
- Az eljárás ellenőrzi a napló-egyensúlyt, lefoglalja a szigorú számadású folyamatos könyvelési sorszámot (`journal_number`), és a státuszt `'PISZKOZAT'`-ról `'KONYVELT'`-re állítja.
- Hálózati vagy jogosultsági hiba esetén a rendszer biztonsági védelmi fallback ágon rögzíti a könyvelt státuszt.

### 6. Analitikus Auditkövetés (`asset_events`)
A főkönyvi könyveléssel párhuzamosan a motor minden érintett eszközre bejegyzést készít az `asset_events` táblába:
- `event_type = 'value_change'`
- `description`: Tartalmazza a generált bizonylatszámot (`ECS-...`), az elszámolt összeget és a maradványértéket.
- `old_values` és `new_values`: JSON formátumban rögzíti az elszámolás előtti és utáni halmozott értékcsökkenést és nettó könyv szerinti értéket.

## Consequences

### Pozitív
- **1-Kattintásos Zárás:** A könyvelőnek nem kell manuálisan számolnia vagy gépelnie a vegyes naplót; egy gombnyomással elkészül a havi vagy éves leírás.
- **Tökéletes Szinkron:** A tárgyi eszköz analitika és a főkönyv mérlege garantáltan egyezik, mivel az analitika számaiból közvetlenül generálódik a főkönyvi bejegyzés.
- **Megbízható Számlatükör-kapcsolat:** Az egyedi számlatükörrel rendelkező cégeknél (pl. 716 egyedi számla) is azonnal feloldódnak a megfelelő T/K számlaszámok.
- **Visszakereshetőség:** A bizonylatszámok (`ECS-YYYY-MM`) alapján a főkönyvből visszakereshető az analitika, és a tárgyi eszköz történetében is látszik a feladás.

### Negatív / Kockázatok
- **Számlatükör Hiányosságok:** Ha egy cég egyéni számlatükrében egyáltalán nincs sem 571/5711, sem 139/149 számla felvéve, az elszámolás figyelmeztetést ad és nem könyvel hibás tételeket. A könyvelőnek előbb pótolnia kell a hiányzó főkönyvi számlát a Kategóriák / Számlatükör felületen.

## Kapcsolódó
- [A-164: Fejlesztési Tartalék és Tárgyi Eszközök Adatmodell, ÉCS Kalkuláció és API](./A-164-development-reserve-fixed-assets-db-and-depreciation.md)
- [A-090: Biztonságos Számlatükör Törlés és Tételek Átkötése](./A-090-safe-chart-of-accounts-preset-deletion-and-remapping.md)
- [A-111: Közvetlen Bizonylat-visszanyitás és Napló Integritás](./A-111-accounting-journal-unpost-gl-storno-and-numbering-integrity.md)
- [P-141: Tárgyi Eszközök Időszaki Értékcsökkenés Elszámolási Varázsló UX](../product/P-141-fixed-assets-periodic-depreciation-posting-wizard-ux.md)
- [P-123: Fejlesztési Tartalék és TENY Összekapcsolása UX](../product/P-123-development-reserve-teny-ux.md)
