# A-159: Hivatalos ÁFA Analitika Upgrade, M-lap Master–Detail és NAV OSA Keresztellenőrzés

**Dátum:** 2026-09-26  
**Státusz:** Elfogadva  
**Kapcsolódó területek:** ÁFA modul (`/vat-return`), NAV Online Számla (OSA) integráció, 65M belföldi tételes nyilatkozat, 26TFEJLH Turizmusfejlesztési hozzájárulás, Éves ÁFA mátrix, Számlatükör

---

## 1. Kontextus és Könyvelői Követelmények

A hagyományos magyar könyvelőprogramokban (pl. Ten-Soft, RLB, Novitax, Microfox) az ÁFA bevallási időszakban a könyvelők 8-9 dedikált nézetet használnak a számlák ellenőrzésére, a bevallások összeállítására és az adóhatósági egyeztetésekre. 

A Visibill ÁFA moduljának felülvizsgálata és a bemutatott képernyők alapján az alábbi kulcsfontosságú fejlesztések váltak szükségessé:
1. **NAV Online Számla (OSA) keresztellenőrzés (`Áfa ellenőrzés OSA alapján`):**
   - A könyvelt szállítói számlák és a NAV-tól letöltött számlák tétel- és adatszintű összevetése (teljesítés dátuma, nettó, ÁFA).
   - Eltérések vizuális kiemelése (dátum- vagy filléres különbség), hiányzó bizonylatok felderítése.
2. **Kétrétegű Master–Detail belföldi M-lap (NAV 65M):**
   - Felső tábla: Belföldi partnerek adószámmal, számlaszámmal, adóalappal, ÁFA-val és adókulcs-bontással (5%, 18%, 27%).
   - Alsó tábla: A kiválasztott partner számláinak tételes felbontása kelttel, teljesítéssel, adóalappal és ÁNYK 02 lapkóddal.
   - Közvetlen [NAV OSA Ellenőrzés] gomb az M-lap fejlécében.
3. **12 havi Éves ÁFA mátrix táblázat:**
   - Januártól Decemberig tartó gördülő mátrix Fizetendő, Levonható és Egyenleg sorokkal, kulcsonkénti bontásban, alap & áfa kapcsolókkal.
4. **Kulcsonkénti ÁFA összesítés kártyák (27%, 18%, 5%, Mentes, FAD):**
   - Az időszaki fizetendő, levonható és egyenleg adatok azonnali áttekintése kiemelt különbözeti oszloppal.
5. **Analitikus ÁFA naplótétellista (ÁFA lista):**
   - Színes naplócímkékkel (`szállító`, `vevő`, `pénztár`, `vegyes`), könyvelt főkönyvi számlaszámokkal (Nettó fsz, ÁFA fsz, Bruttó fsz), 65-ös bevallási sorszámmal (`Bev.sor`) és negatív előjel kapcsolóval a kiadásokhoz.
6. **26TFEJLH Turizmusfejlesztési hozzájárulás modul:**
   - 4 törvényi kategória (étkezőhelyi étel/ital, étterem/cukrászda, szálláshely-szolgáltatás, menetrend szerinti buszos városnézés) forgalmának főkönyvi számlákhoz rendelése, 4%-os adókalkulációja és ÁNYK XML exportja.

---

## 2. Megvalósított Architektúra és Komponensek

### A. Új Komponensek (`src/features/vat/components/`)

1. **`VatOsaCheckDialog.tsx`:**
   - Párhuzamosan lekéri az `invoices` és `nav_invoices` táblák adatait az adott időszakra.
   - Normalizált számlaszám és partner adószám (első 8 jegy) alapján párosítja a számlákat.
   - Szigorúan ellenőrzi: `deliveryDate`, `netAmount`, `vatAmount` eltéréseket.
   - Kategóriák: `Egyezik` (zöld), `Nem egyeznek az adatok!` (piros/narancs), `Hiányzik a könyvelésből` (sárga), `Csak könyvelt`.
   - CSV / Excel exportálás és szűrés.
2. **`VatMLineMasterDetail.tsx`:**
   - Master–Detail kétpaneles felépítés a 65M belföldi partnerösszesítőhöz.
   - 5%, 18%, 27% oszlopok és pro-rata adatok megjelenítése.
   - Fejlécében a közvetlen `[ÁFA ellenőrzés OSA alapján]` gomb.
3. **`VatAnnualMatrixView.tsx`:**
   - 12 havi dinamikus gördülő mátrix `MONTHS` (Jan–Dec) szerint, kategóriánkénti összegekkel.
   - Reagál a `showBase`, `showTax`, `showEmptyRows` kapcsolókra.
   - Excel / CSV export funkció.
4. **`VatRateSummaryCards.tsx`:**
   - Integrálva a `65-ös Bevallás` fülbe, közvetlenül a főlap és kalkulátor fölé.
   - Kiemeli az egyes adókulcsok fizetendő, levonható és egyenleg értékeit.
5. **`VatItemizedJournalView.tsx`:**
   - Tételes könyvelési napló lista a `szállító`, `vevő`, `pénztár`, `vegyes` naplótípusokkal.
   - Főkönyvi számlák (pl. 911K, 529T, 466T, 467K, 4541K, 311T) és bevallási sorok (`Bev.sor`).
   - Negatív előjel kapcsoló a kiadásokhoz.
6. **`VatTourismTaxSection.tsx`:**
   - A 26TFEJLH nyomtatvány szerinti 4 kategória felülete.
   - 1-kattintásos feltöltés a forgalomból, 4%-os adókalkuláció és ÁNYK-kompatibilis XML generálás.

### B. Konténer Integráció (`VatReturnContainer.tsx`)

- A korábbi 3 fül helyett egy gazdag, mégis tiszta és gyors 9 fülből álló rendszert alakítottunk ki:
  `[ 65-ös Bevallás ]  [ Éves Mátrix ]  [ Tételes M-lap ]  [ Fordított ÁFA (07/08) ]  [ A60 Közösségi ]  [ ÁFA Tétellista ]  [ Gyűjtőkódok ]  [ 26TFEJLH ]  [ Beállítások ]`
- URL paraméter szinkronizáció (`?tab=...`), hiba-elhatároló keret (`VatReturnErrorBoundary`), és joghatósági szűrés (Horvátország esetén csak a releváns nézetek jelennek meg).

---

## 3. Verifikáció és Minőségbiztosítás

- **Egységtesztek:**
  - `src/test/vatUpgradeViews.test.tsx`: 5 új egységteszt (OSA egyeztetés, TFEJLH 4%, Rate summary számítások).
  - `src/test/vat/`: 43 meglévő ÁFA egységteszt hibátlanul lefutott (`43 passed`).
- **Típusellenőrzés:**
  - `npx tsc --noEmit` 0 hibával lefutott.
