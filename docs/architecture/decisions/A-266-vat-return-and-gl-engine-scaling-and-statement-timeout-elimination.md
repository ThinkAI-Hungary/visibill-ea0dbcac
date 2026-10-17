# A-266: ÁFA és Főkönyvi Lekérdező Motorok Skálázási Optimalizálása — 2-Fázisú Bázisszűrés (CTE Pushdown), Feltételes MNB Laterális Illesztés és Bizonylatsorszám Indexelés (Statement Timeout 57014 Felszámolás)

**Status:** Decided  
**Date:** 2026-10-17  
**Utoljára frissítve:** 2026-10-17  

## Context

A nagy tranzakciószámmal rendelkező ügyfélcégek (pl. PROCONT KFT, Mandala Fogadó, WR Home Kft.) adatbázis-szintű skálázási és terheléses vizsgálata során kritikus teljesítménybeli szűk keresztmetszetek és futásidejű hibák kerültek felszínre:

1. **ÁFA Motor Időtúllépés (Statement Timeout 57014):** A hivatalos 2665-ös ÁFA bevallást kalkuláló `calculate_hungarian_vat_return` tárolt eljárás futási ideje meghaladta a 8 000 ms-os limitet és leállt (`canceling statement due to statement timeout`). A profilozás feltárta:
   - A lekérdezés a teljes számlaállományt (több ezer számla) tételesen kibontotta és laterális alkérdésekkel dúsította, mielőtt a megadott adóidőszakra (hónap/negyedév) szűkítette volna a sorokat.
   - A `daily_exchange_rates` táblára épülő MNB árfolyam-keresés feltétel nélkül lefutott minden egyes számlára, annak ellenére, hogy a számlák több mint 98%-a forintos belföldi bizonylat (`currency = 'HUF'`).
   - A pénzforgalmi adózású számlák banki kifizetés-keresése laterális subquery-vel minden számlára ráindult, ahelyett, hogy kizárólag a pénzforgalmi adózás alá eső szállítókra korlátozódott volna.
   - Az unindexed `REPLACE(REPLACE(bizonylatsorszam, '-', ''), ' ', '')` duplikáció-szűrés soronkénti szekvenciális táblapásztázást (Seq Scan) kényszerített ki.
2. **Főkönyvi Karton Végzetes Oszlophiba (SQLSTATE 42703) és Sorismétlődés:** A `get_gl_account_card_items` tárolt eljárás a kapcsolódó számlák azonosításakor hibát dobott: `column inv.invoice_number does not exist`. A valóságban a `public.invoices` táblában az oszlop neve `bizonylatsorszam`. Továbbá:
   - A kapcsolódó számlák joinjai nem tartalmaztak `LIMIT 1` korlátot, így az azonos bizonylatszámú vagy javítószámlás esetekben a kartonsorok megsokszorozódtak.
   - Az `acc_open_item_matches` többes részfizetései miatti összekapcsolás több kartonsort generált ugyanahhoz a bizonylathoz, ami felborította a könyvelési egyenleget és a kumulált összegeket.
3. **Folyószámla Analitika Memóriaterhelés:** A `get_subledger_items` tárolt eljárásban a `header_lines_agg` CTE a cég összes bizonylatának összes kontírozási sorát egy gigantikus (6,05 MB) JSONB blobba szerializálta, függetlenül attól, hogy a felhasználó egyetlen partnerre vagy egyetlen naplóra szűrt.

## Decision

1. **Kétfázisú CTE Bázisszűrés (Pushdown) az ÁFA Motorban (`calculate_hungarian_vat_return`):**
   - Bevezettük a `candidate_nav` és `candidate_invoices` előszűrő CTE blokkokat:
     - Az időszaki (teljesítés vagy fizetés dátuma), bérlői (`company_id`) és könyvelési érvényességi szűrők még a tételek kibontása és a relációs joinok előtt lefutnak.
     - A vizsgált számlák köre azonnal 4 467-ről ~400 releváns bizonylatra csökken a feldolgozás első lépésében.
   - **Feltételes MNB Árfolyam Laterális Illesztés:**
     ```sql
     LEFT JOIN LATERAL (
       SELECT rate FROM public.daily_exchange_rates ...
     ) ex ON c.currency <> 'HUF'
     ```
     A belföldi forintos számláknál (a forgalom 98%-a) a rendszer 0 db laterális lemezműveletet végez.
   - **Feltételes Pénzforgalmi Tranzakció Keresés:** A `candidate_tx` laterális subquery kizárólag akkor fut le, ha a számla vagy az eladó pénzforgalmi adózási módban van.
   - **Indexelt Bizonylatszám Egyezés:** A stringmanipulációs szűrést felváltotta a közvetlen B-tree indexed egyezés.
   - **Eredmény:** 8 087 ms-os timeout helyett **436,92 ms-os stabil válaszidő** (18,5x-es gyorsulás), garantálva a 100%-os egyezést a hivatalos Taxology Master baseline-nal (`npm run vat:guard`).

2. **Főkönyvi Karton Hibajavítás és Részfizetés Deduplikáció (`get_gl_account_card_items`):**
   - Javítottuk a hibás mezőhivatkozást: `COALESCE(ni.invoice_number, inv.bizonylatsorszam, ni.bizonylatsorszam)`.
   - Cégazonosító szűrések kiterjesztése a joinokra (`inv.company_id = p_company_id`, `ni.company_id = p_company_id`) és `LEFT JOIN LATERAL (...) LIMIT 1` védelem a sormegsokszorozódás ellen.
   - A többszörös kiegyenlítések aggregációja: `(array_agg(raw_m.id))[1] AS match_id` és `COALESCE(SUM(raw_m.settled_amount_huf), 0) AS total_settled_huf`, megszüntetve a részfizetések miatti duplikált sorokat és egyenlegtorzulást.
   - Eredmény: 1 000 kartontétel kiolvasása 1 747 ms alatt, nulla hibával.

3. **Célzott Aggregáció a Folyószámla Lekérdezésben (`get_subledger_items`):**
   - Bevezettük a `candidate_headers` CTE-t, amely szigorúan csak a felületi szűrőknek (partner, dátumintervallum, nyitott/zárt státusz, napló) megfelelő bizonylatfejeket gyűjti ki.
   - A sorok aggregációja (`header_lines_agg`) kizárólag ezen a leszűkített fejkészleten fut le.
   - Eredmény: A 6,05 MB-os JSON payload < 200 KB-ra csökkent, a válaszidő 531 ms-ra stabilizálódott.

## Consequences

**Pozitív:**
- **Zero Statement Timeout:** A legnagyobb könyvelt cégeknél is garantáltan lefut az ÁFA bevallás és a főkönyvi karton generálás.
- **Skálázhatósági Stabilitás:** A szerver CPU- és memória-terhelése töredékére csökkent, a kapcsolatok nem ragadnak be hosszú lekérdezések miatt.
- **Számviteli Integritás:** A kartonon megszűnt a tételek ismétlődése, a futó egyenleg minden pillanatban matematikai és számviteli pontossággal követi a valóságot.
- **ÁFA Védőkapu Védettség:** A gyorsítás nem változtatott a számítási szabályokon; az automatikus `vat:guard` ellenőrzés 0 Ft eltérést igazolt.

**Negatív / Kockázatok:**
- A CTE pushdown szerkezet gondos karbantartást igényel: ha a jövőben új szűrési feltétel érkezik az ÁFA motorba, azt a `candidate` CTE szintre is le kell vinni a hatékonyság megőrzéséhez.

## Kapcsolódó
- [A-092: Teljes Adatbázis Biztonsági és Teljesítménybeli Audit & Optimalizáció](./A-092-database-security-and-performance-optimization.md)
- [A-240: ÁFA Regresszióvédelmi Kapu (Golden Master & Snapshot Guard)](./A-240-vat-regression-taxology-golden-master-and-snapshot-guard-architecture.md)
- [A-245: calculate_hungarian_vat_return Kurzus-Dátumkorlát és Árfolyam Optimalizáció](./A-245-calculate-hungarian-vat-return-cursor-bounding-and-exchange-rate-optimization.md)
- [BDR 060: NAV 2665 ÁFA Bevallási Szabályok és Gyűjtőkódok](../../business/decisions/060-nav-2665-vat-rules-and-steel-reporting.md)
- [BDR 068: ÁFA tv. Szerinti Adófizetési Kötelezettség és Levonási Jog](../../business/decisions/068-vat-effective-tax-date-regime-rules.md)
