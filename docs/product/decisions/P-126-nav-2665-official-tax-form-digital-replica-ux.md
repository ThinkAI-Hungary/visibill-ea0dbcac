# P-126: NAV 2665 Hivatalos Nyomtatvány Digitális Replika UX

**Status:** Decided  
**Category:** eaisyBooks / ÁFA / Törvényi Riportok  
**Updated:** 2026-09-27  

---

## Question
Hogyan alakítható ki a könyvelők számára a legbiztonságosabb, leginkább kézre álló és legmegszokottabb ellenőrzési felület az ÁFA bevallás (2665) véglegesítése és NAV beküldése előtt?

---

## Decision

### 1. „Semmit a kéznek, mindent a szemnek” Elv
Az ÁFA bevallás hivatalos nyomtatvány replikája (`VatNav65Replica` / `Nav2665ReplicaContainer`) szigorúan **csak olvasható (read-only)** ellenőrző felület.
- A felületen nincsenek beviteli mezők, űrlap-vezérlők vagy szerkeszthető dobozok.
- A könyvelő a könyvelési programban és a számlatörzsben dolgozik; az ÁNYK nyomtatvány replikája kizárólag a könyvelésből származtatott végeredményt tükrözi.
- Ezzel teljesen kizárható az a kritikus könyvelői hiba, hogy a beküldött ÁNYK XML és a mögöttes könyvelési adatbázis eltér egymástól.

### 2. Hivatalos ÁNYK 2665 Vizuális Formátum és Lapszerkezet
A felület az állami ÁNYK 2665A nyomtatványt modellezi pixelpontosan:
- **Magyar Címer és Hivatalos Fejléc:** Eredeti vektoros grafika az állami szimbólumokkal és a NAV megnevezésével.
- **Karakterdobozos Mezők (Segmented Character Boxes):** Az adószámok (8-1-2 formátum), 3x8-as GIRO bankszámlaszámok, dátumok (ÉÉÉÉHHNN) és jelölőkódok a megszokott rácsos dobozokban jelennek meg.
- **Sraffozott mezők:** Az ÁNYK szabványos ferde vonalkázású mintázata jelzi a törvény szerint nem kitölthető cellákat.
- **Lapstruktúra:**
  - **Főlap:** Adózó azonosítása, adószám, képviselet, bevallási időszak (C rovat), kitöltött lapok mátrixa, bankszámla, székhely és F rovat szerinti nyilatkozat.
  - **01-01 Lap:** Fizetendő adó (01–36. sorok), 27%, 18%, 5% bontások, fordított adózás (29. sor) és a 36. összesítő sor.
  - **01-02 Lap:** Tájékoztató adatok (37–62. sorok) és levonható adó kezdete (63–71. sorok, 66. sor részletező doboz).
  - **01-03 Lap:** Levonható adó folytatása (72–79. sorok), elszámolás (82. áthozott, 83. különbözet, 84. fizetendő, 85. visszaigényelhető) és részletező rovatok (88–95. sorok).
  - **01-05 Lap:** 6/A és 6/B melléklet (100–103. sorok) és a 2665M belföldi összesítő jelentés összesített sorai (105–109. sorok: számlaszám, partnerek száma, levont és fizetendő adó).
  - **07 és 08 Lapok:** Fordított adózású acéltermék értékesítési és beszerzési részletező ívek, ha az időszakban szerepel 6/B tétel.

### 3. Eszköztár és Ergonómiai Vezérlők
A nyomtatvány felső fejlécében egy lebegő, mégis integrált eszközsáv segíti az áttekintést:
- **Lapválasztó gombok (Pills):** Azonnali váltás a nyomtatvány különálló lapjai között.
- **„📑 Összes lap egyben” nézet:** Egyetlen kattintással összefüggő, lapozás nélküli többoldalas dokumentummá alakítja a nézetet, lehetővé téve a teljes bevallás egyidejű átgörgetését.
- **Nagyítás / Kicsinyítés (Zoom Controls):** 80%, 90%, 100%, 110% és 125% nézetek a monitor méretéhez és a könyvelő kényelméhez igazítva.
- **Élő KPI mutatók:** A fejrészben azonnal látható a fizetendő adó, a levonható adó és a nettó egyenleg (fizetendő / visszaigényelhető).
- **„Adatok frissítése DB-ből” gomb:** Folyamatjelző animációval hívja meg a szerveroldali kalkulációs motort, biztosítva a legfrissebb könyvelési tételek megjelenítését.
- **Hivatalos Nyomtatás:** Közvetlen nyomtatási lehetőség (`@media print`), amely laponkénti tördeléssel (`break-after: page`) A4 formátumban állítja elő a nyomtatványt papírra vagy PDF-be.

---

## Rationale
A könyvelők a NAV ÁNYK felületén szocializálódtak. Amikor egy modern számviteli szoftver új, absztrakt kártyákon vagy modern táblázatokban jeleníti meg az adatokat, a szakemberek kénytelenek kézzel átmásolni vagy fejben ellenőrizni, hogy melyik szám hova fog kerülni a tényleges adóbevallásban.
A digitális ÁNYK 2665 replika megszünteti ezt a kognitív terhet: a könyvelő pontosan ugyanazt a lapot látja a képernyőn, mint amit a hatóság fog látni a beküldés után, 100%-os biztonságot és megnyugvást nyújtva.

---

## Kapcsolódó
- [A-167: NAV 2665 Hivatalos Nyomtatvány Digitális Replika Architektúra](../../architecture/decisions/A-167-nav-2665-official-tax-form-digital-replica.md)
- [P-097: NAV 2665 Nyomtatvány Replika és 6/B Acélipari Analitika UX](./P-097-nav-2665-replica-steel-analytics-and-anyk-validation-ux.md)
- [P-060: Modular UX for Statutory Reporting & VAT Return](./P-060-statutory-reporting-and-vat-return-modular-ux.md)
- [P-116: Horvát ÁFA Bevallás (Obrazac PDV) Replika UX](./P-116-croatian-vat-return-obrazac-pdv-and-codes-ux.md)
