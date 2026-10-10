# A-242: ÁFA Bevallás Változásvédelem, Kriptográfiai Pillanatkép és Art. 211. § Önellenőrzési Pótlék Számítási Architektúra

**Status:** Decided  
**Date:** 2026-10-10  
**Utoljára frissítve:** 2026-10-10  

---

## 🏛️ Context
Az ÁFA bevallások (különösen a 2665A és 2665M lapok) benyújtása után a számviteli gyakorlatban kritikus kockázatot jelent, ha a lezárt időszak könyveléséhez utólag hozzányúlnak:
1. **Utólagos bizonylat-érkezés:** A könyvelő a beküldés után kap meg és rögzít korábbi teljesítésű szállítói számlát (Late Entry).
2. **Utólagos számlamódosítás:** Egy korábban bevallott számla adóalapja, áfakulcsa vagy levonhatósága megváltozik (Modified).
3. **Utólagos stornózás vagy törlés:** Egy számlát utólag stornóznak vagy kivesznek az analitikából (Deleted / Storno).

Korábban nem létezett rögzített pillanatkép (snapshot) mechanizmus: a rendszer minden megnyitáskor az élő bizonylatállományból számolta újra az ÁFA bevallást, így az utólagos bizonylat-mozgások észrevétlenül felülírták a beadott számokat. Emellett a könyvelőkre hárult az adókülönbözet kézi kigyűjtése és az Art. 211. § szerinti önellenőrzési pótlék Excelben történő számítása.

Szükség volt egy auditbiztos, kriptográfiai pecséttel ellátott snapshot és változásvédelmi architektúrára, amely:
- Zárolja a benyújtott ÁFA bevallást (v1.0 Eredeti beadás, v1.1+ Önellenőrzések).
- A zárolás pillanatában automatikusan lefagyasztja a mögöttes számlaállományt (`invoicesMap`).
- Egyetlen kattintásra, valós időben összehasonlítja a lezárt állapotot a jelenlegi adatbázissal (Diff engine).
- Naptári napra pontosan kiszámítja az Art. 211. § szerinti önellenőrzési pótlékot az MNB alapkamat és a törvényes határidők alapján.

---

## 💡 Decision

### 1. Adatbázis Séma és Táblák (`accounty_vat_snapshots`, `accounty_vat_revision_pool`)
A `20261010220000_vat_snapshots_and_steel_schema.sql` migráció két dedikált táblát vezetett be Row-Level Security (RLS) védelemmel:

1. **`accounty_vat_snapshots`**:
   - `company_id`: céghez kötött idegen kulcs.
   - `period_year`, `period_month`, `frequency`: adómegállapítási időszak (H, N, E).
   - `version_number`: 1 (eredeti), 2+ (önellenőrzések).
   - `version_type`: `'ORIGINAL'` vagy `'SELF_REVISION'`.
   - `tax_base_payable`, `tax_payable`, `tax_base_deductible`, `tax_deductible`, `net_vat_position`: numerikus fixált adópozíció.
   - `snapshot_hash_sha256`: a teljes payload 64 karakteres SHA-256 lenyomata.
   - `snapshot_data`: JSONB struktúra, amely tartalmazza a bevallás főlapjait, M-lapjait és a lefagyasztott számlatérképet (`invoicesMap`).
   - `submitted_at`, `submitted_by`: audit időbélyeg és felhasználói azonosító.

2. **`accounty_vat_revision_pool`**:
   - Tételes revíziós napló a zárolt bizonylatok módosulásainak tartós tárolására (`snapshot_id`, `invoice_id`, `change_type`, `tax_base_diff`, `tax_amount_diff`, `cleared_in_snapshot_id`).

### 2. Kriptográfiai Pecsétképzés és Számlaállomány Fagyasztás (`vatSnapshotService.ts`)
A pillanatkép készítésekor a Web Crypto API (`crypto.subtle.digest('SHA-256')`) segítségével előállítunk egy digitális ujjlenyomatot:
- **Automatikus Számlatérkép Képzés (`invoicesMap`):** Amennyiben a hívó nem adja át expliciten a számlalistát, a szerviz a zárolás pillanatában automatikusan lekérdezi a `nav_invoices` táblából az időszak összes érvényes számláját (`invoice_number`, partner, nettó, áfa, irány), és normalizált kulccsal (`invoice_number.trim().toLowerCase()`) beágyazza a `snapshot_data.invoicesMap` objektumba.
- **Integritásvédelem:** A hash magában foglalja a cégazonosítót, időszakot, verziót, adóösszegeket és az `invoicesMap`-et. Bármely utólagos kézi DB-módosítás érvényteleníti a lenyomatot.

### 3. Polimorf és Védett Diff-Összehasonlító Motor (`compareCurrentInvoicesWithSnapshot`)
A diff motor tiszta in-memory kalkulációra (`computeSnapshotDiff`) és aszinkron adatbázis lekérdezésre tagolódik:
- **Háromféle eltérés észlelése:**
  1. `late_entry`: a jelenlegi számla nem szerepelt a snapshot `invoicesMap`-jében (késedelmes felvitel).
  2. `modified`: a bizonylat szerepelt, de a nettó összeg vagy az áfa legalább 1 Ft-tal eltér.
  3. `deleted`: a bizonylat szerepelt a snapshotban, de a jelenlegi aktív számlák között nem található (törölt/storno).
- **Normalizált és redundáns tulajdonságok:** Az objektum egyszerre biztosítja a `diffs` és `items`, a `hasDifferences` és `hasRevisions`, valamint a `snapshotTaxBase` / `originalNet` eléréseket, így a frontend soha nem ütközik undefined vagy típus-inkompatibilitási hibába.

### 4. Art. 211. § Önellenőrzési Pótlék Kalkulátor (`penaltyCalculator.ts`)
A számítás maradéktalanul implementálja a 2017. évi CLI. törvény (Art.) 211. §-át:
1. **Törvényes esedékesség:** Tárgyidőszakot követő hó 20-a (havi: M+1 hó 20., negyedéves: Q-zárást követő hó 20., éves: köv. év febr. 25.).
2. **Munkaszüneti nap csúsztatás:** Ha 20-a szombatra (dayOfWeek = 6) vagy vasárnapra (dayOfWeek = 0) esik, a határidő automatikusan a következő hétfőre tolódik.
3. **Késedelmi napok száma:** Az esedékességet követő naptól az önellenőrzés benyújtási napjáig eltelt naptári napok száma.
4. **Pótlékkulcs szorzó:**
   - Első önellenőrzés (`revisionOrder = 1`): a jegybanki alapkamat 50%-a (szorzó: 0.5).
   - Ismételt önellenőrzés (`revisionOrder >= 2`): a jegybanki alapkamat 100%-a (szorzó: 1.0).
5. **Képlet:**
   $$\text{Pótlék} = \text{Adókülönbözet} \times \left( \frac{\text{Késedelmi napok}}{365} \right) \times (\text{Alapkamat} \times \text{Szorzó})$$
6. **Defenzív hibakezelés:** Ha az eltérés az adózó javára mutat ($\le 0$ Ft), a pótlék kötelezően 0 Ft. `toSafeDate` és `formatDateString` garantálja, hogy érvénytelen dátumparaméterek esetén se dobjon futásidejű kivételt.

---

## ⚡ Consequences

### Pozitív:
- **Auditbiztonság és változásvédelem:** A lezárt ÁFA időszakok bizonylatai megváltoztathatatlanul rögzülnek, az utólagos módosítások azonnal, automatikusan láthatóvá válnak.
- **Azonnali önellenőrzési levezetés:** Nincs szükség manuális pótlékszámításra, a rendszer tizedes pontossággal kiszámítja az esedékes összeget.
- **1-kattintásos 65H export:** A diffek alapján azonnal elkészíthető az ÁNYK helyesbítő XML.

### Negatív / Kötöttségek:
- A snapshot tábla mérete növekszik a JSONB `invoicesMap` mező miatt (egy 500 tételes időszak ~150 KB snapshot méretet jelent, ami Postgres szinten elhanyagolható).

---

## 🔗 Kapcsolódó
- [P-179: ÁFA Bevallás Változásvédelem & Önellenőrzési Munkaterület UX](../../product/decisions/P-179-vat-return-snapshots-and-amendments-workspace-ux.md)
- [A-240: ÁFA Számítási Regresszióvédelmi Kapu](./A-240-vat-regression-taxology-golden-master-and-snapshot-guard-architecture.md)
- [A-243: NAV Online Számla Háromirányú Keresztellenőrzés Architektúra](./A-243-nav-osa-three-way-reconciliation-and-steel-products-architecture.md)
- [A-244: Külföldi és Devizás Bejövő Számlák Integrálása az ÁFA Bevallásba](./A-244-foreign-inbound-invoices-vat-return-integration.md)
