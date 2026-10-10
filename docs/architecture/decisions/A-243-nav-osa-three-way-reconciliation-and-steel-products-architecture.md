# A-243: NAV Online Számla Háromirányú Keresztellenőrzés (Three-Way Reconciliation) és Fordított Adózású Acéltermék VTSZ/SZJ Detektálás Architektúra

**Status:** Decided  
**Date:** 2026-10-10  
**Utoljára frissítve:** 2026-10-10  

---

## 🏛️ Context
A magyar adóhatósági (NAV) ellenőrzések egyik leggyakoribb megállapítása abból ered, hogy a vállalkozás ÁFA bevallásában szereplő adatok, a helyi könyvelési naplók (főkönyvi 466/467 számlák) és a NAV Online Számla (OSA) rendszerébe beérkezett számlák között eltérések mutatkoznak.
A könyvelőknek korábban manuálisan, Excelben kellett összevetniük:
1. A NAV Online Számla XML adatait,
2. A beküldött / iktatott számlákat,
3. A könyvelt vegyes, banki és számlanaplók főkönyvi egyenlegeit.

Emellett a fordított adózás alá eső acéltermékek (Áfa tv. 142. § (1) bek. i) pont, 2665-07 és 08 lapok) speciális termékkód (VTSZ) és statisztikai nómenklatúra (SZJ/TESZOR) szűrést, valamint mennyiségi nyilvántartást igényelnek, amelynek elmulasztása bírságot von maga után.

Olyan integrált architektúrára volt szükség, amely:
- Egyetlen nagy teljesítményű adatbázis RPC-vel automatizálja a háromirányú keresztellenőrzést (Three-Way Reconciliation).
- Felismeri a hiányzó, duplikált, stornózott és főkönyvileg könyveletlen számlákat.
- Automatikusan észleli a fordított adózású acélipari VTSZ kódokat és anomáliákat.

---

## 💡 Decision

### 1. Háromirányú Egyeztető RPC (`get_vat_osa_three_way_reconciliation`)
A `20261010223000_vat_osa_three_way_reconciliation_rpc.sql` migráció bevezette a `get_vat_osa_three_way_reconciliation` SQL függvényt (`SECURITY DEFINER`, `SET search_path = public`):
- **Bemeneti paraméterek:** `p_company_id`, `p_year`, `p_month`, `p_frequency` ('H', 'N', 'E').
- **Dátumablak:** Időszak első és utolsó napjának determinisztikus kiszámítása.
- **Három adatfolyam összevetése Full Outer Join segítségével:**
  1. `nav_invoices`: NAV OSA adatok (nettó, áfa, bruttó, teljesítés dátuma, partner adószám és név).
  2. `invoices`: Helyi számlatár adatai (`bizonylatsorszam`, összegek, partner).
  3. `acc_journal_lines` & `acc_journal_headers`: Főkönyvi könyvelési bejegyzések (Tartozik/Követel forgalom, érintett számlaszámok: `466*`, `467*`, `311*`, `454*`).
- **Anomália és Státusz Besorolás:**
  - `MATCH`: Tökéletes egyezőség a NAV, a helyi számla és a könyvelés között.
  - `DIFF`: Összegbeli vagy dátumbeli eltérés a rendszerek között (>1 Ft toleranciaküszöb).
  - `MISSING_FROM_LOCAL`: A NAV OSA-ban szerepel, de a könyvelési rendszerben még nincs rögzítve.
  - `MISSING_FROM_NAV`: A helyi könyvelésben rögzítették, de a NAV OSA adatbázisában nem található (pl. papíralapú vagy elmaradt adatszolgáltatás).
  - `NOT_POSTED`: A számla rögzítve van, de nincs hozzá könyvelési naplóbejegyzés.

### 2. Kliensoldali Egyeztető Munkaterület (`VatOsaThreeWayReconciliation.tsx`)
A frontend komponens a 65M partneri lapok melletti önálló fülként (`mSubView = 'osa_reconcile'`) épül be a `VatReturnContainer`-be:
- Kereső és szűrősáv: státusz szerint (`DIFF_ONLY`, `MATCH`, `MISSING`, `ALL`) és irány szerint (Bejövő/Kimenő).
- Összegző KPI kártyák: Egyező tételek, Eltérések száma, NAV-ból hiányzók, Könyvelésből hiányzók.
- Interaktív összehasonlító táblázat: egymás mellett mutatja a NAV adatokat, a helyi bizonylatot és a kapcsolódó főkönyvi számlaszámokat.

### 3. Fordított ÁFA Acéltermék és Fémhulladék Detektálás (`useSteelProductsData.ts`, `VatSteelProductsSection.tsx`)
A 2665-ös bevallás 07 (értékesítő) és 08 (beszerző) fordított ÁFA lapjaihoz intelligens felismerő motort építettünk:
- **VTSZ Maszkolás:** `7201-7229` (vas és acél), `7301-7306` (acélcsövek, idomok), fémhulladékok (`7204`, `7404`, stb.).
- **SZJ / TESZOR Besorolás:** `24.10`, `24.20`, `24.31-24.34`.
- **Anomália Kereső:** Figyelmeztet, ha egy acélipari terméket tartalmazó számlát nem fordított adózásúként (FAD) könyveltek le, vagy ha a 07/08-as lap kötelező mennyiségi adatai (kg / tonna) hiányoznak a számlatételekből.

---

## ⚡ Consequences

### Pozitív:
- **NAV Revízióbiztosság:** A könyvelő még a bevallás beküldése előtt felismeri az összes eltérést a NAV OSA és a helyi könyvelés között.
- **Nulla kimaradt számla:** A `MISSING_FROM_LOCAL` szűrővel azonnal kibuknak a beszállítók által a NAV-ba beküldött, de az ügyfél által elfelejtett számlák.
- **Fordított ÁFA automatizmus:** A 07 és 08 lapok adatai közvetlenül a számlatételekből aggregálódnak.

---

## 🔗 Kapcsolódó
- [P-180: NAV OSA Háromirányú Egyeztetés és Fordított ÁFA Acéltermékek UX](../../product/decisions/P-180-nav-osa-three-way-reconciliation-and-steel-products-ux.md)
- [A-242: ÁFA Bevallás Változásvédelem és Kriptográfiai Pillanatkép](./A-242-vat-return-snapshots-and-self-revision-penalty-architecture.md)
- [A-193: Hibrid Aszinkron NAV Számlaszinkronizáció](./A-193-nav-hybrid-async-sync-and-atomic-item-idempotency.md)
