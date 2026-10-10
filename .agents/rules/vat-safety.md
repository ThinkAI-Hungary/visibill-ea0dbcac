# Kötelező ÁFA Regresszióvédelmi és Stabilitási Kapu (VAT Safety Gate)

## 🛑 1. Mikor Érvényes Ez a Szabályzat?
Ez a minőségbiztosítási kapu **szigorúan kötelező** minden olyan feladatnál, amely érinti:
* A frontend ÁFA réteget: `src/features/vat/`, `src/pages/VatReturnPage.tsx`, `src/lib/vatReturnXml.ts`, `src/hooks/useVat*.ts`
* Az adatbázis ÁFA tárolt eljárásait: `calculate_vat_return`, `calculate_hungarian_vat_return`
* Az ÁFA adatbázis táblákat vagy migrációkat: `vat_returns`, `vat_return_lines`, `vat_return_m_lines`, `vat_return_a60_lines`, `vat_codes`, `nav_invoice_items.deductible_percentage`
* A számlák áfa-kategorizálását, teljesítési dátum szűrését vagy sztornó/jóváhagyási kezelését.

---

## 🔍 2. Kötelező Verifikációs Kapuk (Verification Gates)
Mielőtt bármilyen ÁFA logikát érintő kódmódosítást befejezettnek nyilvánítasz a felhasználónak, a terminálban **fizikailag le kell futtatni és zöldnek kell lenniük** az alábbi ellenőrzéseknek:

### Kapu 1: Vitest Golden Master Regressziós Teszt (<150ms)
A determinisztikus matematikai és NAV 2665 invariánsok ellenőrzése a Taxology Kft. 2026-07 hivatalos baseline-ja alapján:
```powershell
npx vitest run src/test/vat/vatRegressionTaxology.test.ts
```
* **Követelmény:** 100% PASS. Ha akár egyetlen forint vagy eFt kerekítés elcsúszik a 07, 36, 66, 76, 83, 86 sorokban, tilos a feladatot késznek tekinteni.

### Kapu 2: Élő Adatbázis Snapshot Guard (<10s)
Az élő adatbázisban tárolt valós számlákon lefutó kalkuláció összevetése a hitelesített baseline-nal:
```powershell
npm run vat:guard
```
* **Követelmény:** A parancsnak `✅ [VAT GUARD] ÁFA BEVALLÁS ÉP ÉS SÉRÜLÉSMENTES (100% EGYEZÉS)` kimenettel és 0-s hibakóddal kell leállnia.
* **Ha regresszió van:** A script kilistázza a pontos eltéréseket (melyik sorban, melyik partner M-lapján keletkezett hiba). A módosításodat azonnal javítanod kell!

### Kapu 3: Oxlint & Típusellenőrzés
```powershell
npx oxlint src/features/vat/
```

---

## ⚠️ 3. Szándékos Kalkuláció Módosítás / Bugfix Esetén
Ha a fejlesztési feladat kifejezetten egy korábbi ÁFA hibát javított (pl. egy új törvényi kerekítési szabályt vagy hiányzó adókódot vezetett be), és emiatt a számok **szándékosan és indokoltan megváltoznak**:
1. A felületi és kódváltoztatást követően **transzparensen be kell mutatni a felhasználónak a számbeli eltérést**.
2. A felhasználó jóváhagyása után a baseline-t expliciten frissíteni kell a parancs futtatásával:
   ```powershell
   npm run vat:snapshot
   ```
3. A frissített baseline-hoz hozzá kell igazítani a `src/test/vat/vatRegressionTaxology.test.ts` teszt elvárt értékeit.

---

## 🚫 4. Zéró Fantom Verifikáció
Szigorúan tilos a felhasználónak azt állítani, hogy *"az ÁFA kalkuláció nem sérült"*, ha a fenti két parancs (`npx vitest run src/test/vat/vatRegressionTaxology.test.ts` és `npm run vat:guard`) fizikailag nem futott le és nem igazolta a hibamentességet!
