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
   - Szigorúan kizárja a díjbekérőket (`isProformaInvoice`: `dijbekero_proforma`, `dijbekero`, `proforma`, `garanciajegy`), megelőzve a hamis "Csak könyvelt" eltéréseket.
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

## 3. Fordított Adózás (FAD - Áfa tv. 142. §) Önadózási Adóalap és ÁFA Levezetés

### Probléma és Gyökérok:
A NAV Online Számla (OSA) rendszeréből beérkező XML-ekben a belföldi fordított adózású (FAD) számláknál az `invoice_vat_amount` technikai okokból **0 Ft**, mivel a számlakibocsátó (eladó) nem hárít át adót. 
Korábban emiatt a rendszer a bejövő FAD tételeket automatikusan adómentes nettóként (`mentesBase`) kezelte 0 Ft ÁFA-val. Ez könyvelési és adózási szempontból hibás: az Áfa tv. 142. § értelmében a vevőnek önadózással fel kell számítania a 27%-os fizetendő ÁFÁ-t (29. sor), és levonási jog esetén ugyanezt az összeget le is vonhatja (66. sor alá tartozó FAD alsornál).

### Megvalósított Törvényi Kezelés 5 ÁFA Nézetben:

1. **Éves ÁFA Mátrix (`VatAnnualMatrixView.tsx`):**
   - Hozzáadva a `Fordított (FAD) alap` és `Fordított (FAD) ÁFA` dedikált sor mind a Fizetendő, mind a Levonható szekcióhoz.
   - Bejövő FAD esetén az adóalap mellé a 27%-os számított önadózási adó kerül felszámításra (`net * 0.27`). Kimenő FAD esetén (04. sor) az adóalap megjelenik, míg a felszámított adó 0 Ft (vevő adózik).
   - CSV export szinkronizálva a FAD sorokkal.

2. **ÁFA Kalkulátor Nézet (`VatCalculatorView.tsx`):**
   - A 66. sor alatti alsornál (*"ebből: fordított adózás (FAD)"*) a korábbi egyetlen adóoszlop helyett két szinkronizált oszlop jelenik meg: **Adóalap (Nettó)** és **Levont adó (ÁFA)**.

3. **Áfakulcsos Összesítő Kártyák (`VatRateSummaryCards.tsx`):**
   - A kimenő FAD (04. sor) leválasztva a mentes (TAM/AAM) alapról.
   - A FAD kártya egyszerre mutatja a nettó adóalapot és a törvényi ÁFA összeget.

4. **Tételes ÁFA Analitika (`VatItemizedJournalView.tsx`):**
   - Bejövő FAD tételeknél megjelenik a 27%-os számított ÁFA (`4666T / 4676K`), a `29 / 66` bevallási sorkód és a `FAD (27%)` kulcs.
   - A partner felé fennálló bruttó kötelezettség a nettóval egyezik meg (az ÁFA elszámolása a NAV-val történik).

5. **Gyűjtőkódos Analitika (`VatCollectorAnalyticsView.tsx`):**
   - A `FAD` gyűjtőkód alatti bejövő tételeknél csoport- és tételszinten is kiszámításra kerül a 27%-os ÁFA.

---

## 4. M-lap Szigorú Kizárási Szabályok (AAM, Díjbekérő, Biztosítás)

Az Áfa tv. 10. számú melléklete (Belföldi Összesítő Jelentés - 65M) a belföldi adóalanyoktól történő termékbeszerzés, szolgáltatás igénybevételének **áthárított levonható adójáról** nyújt adatszolgáltatást.
Annak érdekében, hogy a NAV ÁNYK ellenőrzője ne jelezzen hibát és a könyvelő ne küldjön be jogtalanul tételeket a 65M lapon, az alábbi három tételcsoport szigorúan kizárásra került mind a backend adatbázis kalkuláció, mind a frontend komponensek és az XML generátor szintjén:

1. **Díjbekérők és Proforma bizonylatok:**
   - Kizárás alapja: `invoice_type IN ('dijbekero_proforma', 'dijbekero', 'proforma', 'garanciajegy')` és számlaszám prefixes szűrés (`DÍJ%`, `DIJ%`, `PROFORMA%`, `PRO-%`, `PRO_%`, `PREDRACUN%`).
   - Kliens guard: `isProformaInvoice()`.
2. **Alanyi Adómentes (AAM) partnerek és számlák:**
   - Kizárás alapja: A magyar adószámok 9. számjegye az áfa-kód. Ha az áfa-kód `'1'` (pl. `XXXXXXXX-1-YY`), a partner alanyi adómentes, nem hárít át adót, a számláján nincs levonható áfa.
   - Kliens guard: `isAamPartnerOrTaxNumber()`.
3. **Biztosítótársaságok és Biztosítási díjak:**
   - Kizárás alapja: Áfa tv. 86. § (1) bekezdés a) pontja szerint a biztosítás tárgyi adómentes tevékenység, a díjak biztosítási adó hatálya alá tartoznak, áfalevonás nem gyakorolható utánuk. Kizárva minden biztosító társaság (`Generali`, `Allianz`, `Groupama`, `UNIQA`, `Aegon`, `K&H Biztosító`, `Posta Biztosító`, stb.) és biztosítási megnevezés (`készülékbiztosítás`, `vagyonbiztosítás`, `felelősségbiztosítás`, `kgfb`, `casco`, `biztosítási díj`).
   - Kliens guard: `isInsurancePartnerOrInvoice()`.
4. **Adatbázis migráció és RPC:**
   - `supabase/migrations/20260929200000_exclude_aam_proforma_insurance_from_m_lines.sql`
   - Frissítve a `calculate_hungarian_vat_return` és a `calculate_vat_return` eljárás: az `all_inbounds` CTE-ből kiszűrve a fenti 3 kategória, és az INSERT-nél `HAVING SUM(vat_amount) > 0 OR SUM(tax_27) > 0 OR SUM(tax_18) > 0 OR SUM(tax_5) > 0`.

---

## 5. Verifikáció és Minőségbiztosítás

- **Egységtesztek:**
  - `src/features/vat/__tests__/vatProformaFilter.test.ts` (8 teszt): Proforma, AAM adószám 9. jegy ellenőrzés, biztosító név és leírás szűrés, `shouldExcludeFromMLine` guard tesztek.
  - `src/features/vat/__tests__/vatCodeOverride.test.ts` (7 teszt): FAD és felülbírálási tesztek.
  - `src/features/vat/__tests__/vatEngine.test.ts` (13 teszt): ÁFA kalkuláció és sorkódok.
  - Összesen: 28/28 teszt sikeresen lefutott.
- **Típusellenőrzés és Build:**
  - `npm run build` hiba nélkül, sikeresen lefordult (0 hiba).
- **Kapcsolódó döntések:**
  - [A-158: Mezőgazdasági Felvásárlási Jegyek Modul](./A-158-agricultural-purchase-vouchers-module.md)
  - [P-119: Törvényi ÁFA Nézetek és Fordított Adózás (FAD) UX](../../product/decisions/P-119-statutory-vat-views-upgrade-and-reverse-charge-ux.md)

