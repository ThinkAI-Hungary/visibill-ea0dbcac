# P-119: Törvényi ÁFA Nézetek, NAV OSA Rekonsziliáció és Fordított Adózás (FAD) UX

**Status:** Decided  
**Category:** UI / Statutory Reporting / Reconciliation  
**Date:** 2026-09-26  
**Kapcsolódó architektúra döntés:** [A-159: Hivatalos ÁFA Analitika Upgrade, M-lap Master–Detail és NAV OSA Keresztellenőrzés](../../architecture/decisions/A-159-statutory-vat-views-upgrade-and-osa-reconciliation.md)  
**Érintett felületek:** ÁFA bevallás és analitika (`/vat-return`)

---

## 1. Termékkérdés és Célkitűzés

A magyar könyvelési gyakorlatban az ÁFA bevallási időszak kritikus és intenzív munkafolyamat. A felhasználók korábban nehézkesnek találták az ÁFA fül elrendezését (túlzsúfolt tabok, felesleges kapcsolók, levágódó grafikonok és táblázatok), valamint a NAV Online Számla (OSA) és a belső könyvelés összevetésének hiányát.

Külön problémát jelentett a **Fordított Adózás (FAD - Áfa tv. 142. §)**:
A NAV XML-ben a kiállító nem hárít át adót (az adó összege 0 Ft), így a rendszer korábban adómentes tételként kezelte azokat ÁFA nélkül. Szükség volt egy olyan felületi megoldásra, amely mind az 5 érintett ÁFA nézetben transzparensen és jogszabályhelyesen megjeleníti mind az **adóalapot (nettó)**, mind a **levezetett önadózási ÁFÁ-t**.

---

## 2. Termékdöntés

### A. Racionalizált 9 Fülből Álló Moduláris Rendszer (`VatReturnContainer.tsx`)
A korábbi fragmentált nézetváltók helyett egy átlátható, közvetlenül elérhető navigáció jött létre:
`[ 65-ös Bevallás ]  [ Éves Mátrix ]  [ Tételes M-lap ]  [ Fordított ÁFA (07/08) ]  [ A60 Közösségi ]  [ ÁFA Tétellista ]  [ Gyűjtőkódok ]  [ 26TFEJLH ]  [ Beállítások ]`

- URL mélylinkelés támogatása (`?tab=...`).
- Hibabiztos felületi elhatárolás (`VatReturnErrorBoundary`).

### B. NAV OSA Automata Keresztellenőrzés (`VatOsaCheckDialog.tsx`)
- Közvetlen gomb a felület tetején és a tételes M-lap fejlécében: `[ ÁFA ellenőrzés OSA alapján ]`.
- Automatikus számlaszám és partner adószám alapú egyeztetés.
- Státuszjelvények és szűrők:
  - `Egyezik` (zöld pipa): Teljesítés dátuma, nettó és ÁFA pontosan egyezik.
  - `Eltérés` (narancs/piros): Dátumcsúszás vagy összegeltérés (filléres különbség).
  - `Hiányzik a könyvelésből` (sárga): NAV-ban létező, de könyvelésben nem rögzített számla.
- **M-lap és Rekonsziliáció Szigorú Kizárási Szabályai (AAM, Díjbekérő, Biztosítás):**
  Az Áfa tv. 10. számú melléklete (Belföldi Összesítő Jelentés - 65M) kizárólag olyan belföldi adóalanyoktól történő beszerzéseket tartalmazhat, amelyek után a beszerző adólevonási jogot gyakorol. Ennek megfelelően mind az adatbázis RPC (`calculate_hungarian_vat_return`), mind a kliensoldali nézetek (`VatMLineMasterDetail`, `useVatReturnData`, `vatReturnXml` ÁNYK generátor) garantálják a következő tételek szigorú kizárását:
  1. **Díjbekérők / Proforma bizonylatok:** Nem minősülnek számviteli számlának, nincs adólevonási jogosultság (`isProformaInvoice`).
  2. **Alanyi Adómentes (AAM) partnerek és számlák:** A magyar adószám 9. karaktere `'1'` (pl. `XXXXXXXX-1-YY`), a partner nem hárít át adót, a számlán nincs levonható áfa (`isAamPartnerOrTaxNumber`).
  3. **Biztosítók és Biztosítási tételek:** Az Áfa tv. 86. § (1) bek. a) pontja alapján tárgyi adómentesek, biztosítási adó hatálya alá esnek, áfalevonásra nem jogosítanak (`isInsurancePartnerOrInvoice`).
  4. **Nulla forintos nem-fordított belföldi tételek:** Semmilyen 0 Ft adótartalmú belföldi tétel nem kerülhet az M-lapba, kivéve a fordított adózást (FAD).

### C. 12 Hónapos Éves ÁFA Mátrix (`VatAnnualMatrixView.tsx`)
- A teljes adóév hónapjait (Januártól Decemberig) összefoglaló gördülő táblázat.
- Három fő szekció: Fizetendő ÁFA, Levonható ÁFA, Nettó elszámolandó egyenleg.
- Adóalap és ÁFA összeg megjelenítési kapcsolók, üres sorok elrejtése.
- Azonnali CSV export funkció éves záráshoz és könyvvizsgálathoz.

### D. Fordított Adózás (FAD) Transzparens Kettős Oszlopos Megjelenítése
Az Áfa tv. 142. § szerinti szabályozásnak megfelelően mind az 5 nézetben biztosított az adóalap és az ÁFA párhuzamos megjelenítése:
1. **Éves Mátrix:** Külön `Fordított (FAD) alap` és `Fordított (FAD) ÁFA` sorok mindkét szekcióban. Bejövő FAD esetén 27% önadózott adóval számolva.
2. **Bevallás Kalkulátor:** A 66. sor alá beágyazott alsornál (*"ebből: fordított adózás (FAD)"*) külön **Adóalap (Nettó)** és **Levont adó (ÁFA)** oszlop jelenik meg.
3. **Áfakulcsos Kártyák:** A FAD kártyán a nettó adóalap és a törvényes ÁFA együtt látható.
4. **Tételes Analitika:** Bejövő FAD esetén kiszámított 27% önadózási ÁFA, `4666T / 4676K` kontírozás, `29 / 66` sorkód és `FAD (27%)` kulcsjelölés.
5. **Gyűjtőkódos Analitika:** FAD csoport- és tételszinten feltüntetett 27%-os ÁFA.

### E. Ergonómiai és UI Javítások
- **Számok formázása:** `ReturnHistoryTable.tsx` táblázatban a tördelések megszüntetése, egy soros elrendezés `whitespace-nowrap tabular-nums font-mono` osztályokkal.
- **Trend grafikon:** `VatTrendChart.tsx` grafikonon az Y tengely felső értékeinek (pl. 24 000) kettétörése és felső levágása orvosolva dinamikus SVG margókkal.
- **Görgetésvédelem:** A merev viewport magasságok helyett rugalmas `min-h-full pb-12` konténer biztosítja a kényelmes görgetést laptopokon is.

---

## 3. Racionálé és Számviteli Integráció

- **Könyvelői hatékonyság:** A könyvelőnek nem kell manuálisan ellenőriznie a NAV Online Számla felületét és az analitikát; a rendszer automatikusan felderíti az eltéréseket.
- **Törvényi helyesség:** A FAD tételek önadózási ÁFA tartalma nélkül az ÁFA bevallás hiányos lenne. A 27%-os számított adó megjelenítésével a fizetendő és levonható adó mérlege pontos.

---

## 4. Kapcsolódó Dokumentumok
- [A-159: Hivatalos ÁFA Analitika Upgrade, M-lap Master–Detail és NAV OSA Keresztellenőrzés](../../architecture/decisions/A-159-statutory-vat-views-upgrade-and-osa-reconciliation.md)
- [P-118: Mezőgazdasági Felvásárlási Jegyek UX](./P-118-agricultural-purchase-vouchers-ux.md)
