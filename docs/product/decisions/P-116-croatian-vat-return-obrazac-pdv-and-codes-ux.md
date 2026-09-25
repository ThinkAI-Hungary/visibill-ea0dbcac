# P-116: Horvát ÁFA Bevallás (Obrazac PDV), Hivatalos Nyomtatvány Replika és HR Áfakód Kezelés UX

**Státusz:** Elfogadva (Decided)  
**Dátum:** 2026-09-25  
**Kapcsolódó ADR:** [A-156: Horvát ÁFA Bevallás (Obrazac PDV) és Adókód Architektúra](../../architecture/decisions/A-156-croatian-vat-return-obrazac-pdv-and-tax-codes.md), [A-140: Multi-Jurisdiction Cégkezelés és Horvát Számlatükör](../../architecture/decisions/A-140-multi-jurisdiction-and-croatian-chart-of-accounts.md), [A-109: Horvát Lokalizáció](../../architecture/decisions/A-109-eaisybill-i18n-croatia-localization-and-route-architecture.md)  
**Kapcsolódó PRD:** [P-097: NAV 2665 Nyomtatvány Replika és 6/B Acélipari Analitika UX](./P-097-nav-2665-replica-steel-analytics-and-anyk-validation-ux.md), [P-106: Horvát Főkönyvi Kivonat és Nézetek Teljes Lokalizációja UX](./P-106-croatian-general-ledger-and-multicurrency-views.md), [P-032: ÁFA bevallás workflow](./P-032-vat-return-workflow.md)  
**Érintett modulok:** [VatObrazacPdvReplica.tsx](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/features/vat/components/VatObrazacPdvReplica.tsx), [VatReturnViewTab.tsx](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/features/vat/components/VatReturnViewTab.tsx), [VatCalculatorView.tsx](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/features/vat/components/VatCalculatorView.tsx), [InvoiceVatCodeSelector.tsx](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/vat/InvoiceVatCodeSelector.tsx), [VatCodeConfigTab.tsx](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/vat/VatCodeConfigTab.tsx), [useVatReturnData.ts](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/features/vat/hooks/useVatReturnData.ts), [types.ts](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/features/vat/types.ts)

---

## 1. Kontextus és Felhasználói Problémafelvetés

Az eaisyBooks ÁFA moduljában (`/vat-return`) korábban kizárólag a magyar joghatóság szerinti NAV 2665 nyomtatvány és adókód-rendszer működött. Horvátországi leányvállalat vagy helyi gazdasági társaság (`country_code = 'HR'`, pl. `D-INVOICE D.O.O`) kiválasztásakor:
1. **NAV 2665 megjelenítése és Ft kerekítés:**
   A felület a magyar 2665-ös nyomtatvány replikáját jelenítette meg magyar nyelvű jogszabályi mezőkkel, és az összegeket ezer forintra (eFt) kerekítve számolta, holott Horvátországban az adóbevallás euróban és centben (`EUR`, 2 tizedesjegy) történik.
2. **Relevanciátlan alfülek:**
   A magyar jogszabályok szerinti fordított adózású 6/B acélipari nyilatkozat megjelent a horvát cégeknél is, ami zavaró volt a könyvelők számára.
3. **Hiányzó hivatalos nyomtatvány forma:**
   A könyvelők nem látták a hivatalos horvát **Obrazac PDV** (*Prijava poreza na dodanu vrijednost*) nyomtatvány formátumát a jogszabályban előírt szekciókkal (`I. Neoporezivo`, `II. Obračunani porez`, `III. Pretporez`, `IV. Obveza/Povrat`, `VI. Ostali podaci`).
4. **Magyar ÁFA kódok a számlákon:**
   A számlatételek ÁFA kód választójában a magyar NAV kódok jelentek meg, miközben a horvát cégeknek a horvát ÁFA törvény szerinti kódokra van szükségük (`HR_IZL_25`, `HR_IZL_13`, `HR_IZL_5`, `HR_IZL_TUZ_PRIJ`, `HR_UL_25_ODB`, `HR_UL_EU_USL`, stb.).

---

## 2. Termékdöntés és Megvalósítás

### 2.1 Hivatalos Horvát Obrazac PDV Nyomtatvány Replika (`VatObrazacPdvReplica.tsx`)
A hivatalos horvát *Obrazac PDV* (Pravilnik o porezu na dodanu vrijednost, NN 1/26) nyomtatvány hű replikáját alakítottuk ki:
- **Hivatalos fejléc:** Tartalmazza a horvát adóhivatal megnevezését (*MINISTARSTVO FINANCIJA - POREZNA UPRAVA*), a formanyomtatvány kódját (*OBRAZAC PDV*), a cég nevét, az adószámot/OIB-t (11 számjegy), valamint az elszámolási időszakot (év, hónap/negyedév).
- **KPI Vezérlő Kártyák:**
  - `I. Neoporezivo / Oslobođeno`: Adómentes és területi hatályon kívüli forgalom.
  - `II. Obračunani PDV`: Fizetendő ÁFA összege és adóalapja.
  - `III. Pretporez`: Levonható előzetesen felszámított ÁFA és adóalapja.
  - `IV. Obveza / Povrat`: Végső adóegyenleg kiemelt kék/zöld badge-dzsel (pozitív esetén `Obveza za uplatu`, negatív esetén `Za povrat`).
- **Szekció- és Szöveges Szűrősáv:**
  - Lapozható/szűrhető szekció gombok (`Sve`, `I. Oslobođeno`, `II. Obračunani`, `III. Pretporez`, `IV. Obveza/Povrat`, `VI. Ostali`).
  - Keresőmező: sorazonosító (`I.1`, `II.3`) vagy leírás alapján szűr azonnal.
  - *"Samo redovi s iznosom"* (Csak kitöltött sorok) gyorskapcsoló.
- **Részletes Sorstruktúra és Jogszabályi Hivatkozások:**
  - Minden sornál feltüntetésre kerül a sor száma (pozíciója), hivatalos megnevezése, az alkalmazott adókulcs (pl. `25%`, `13%`, `5%`, `Prijenos`), és a horvát ÁFA törvény hivatkozott paragrafusa (pl. *čl. 75. st. 2.*, *čl. 41. st. 1.*, *čl. 40.*).
  - Tiszta euró formázás (`2 123,69 €`), ahol a nullás sorok diszkrét kötőjellel (`-`) jelennek meg a vizuális zaj csökkentésére.

### 2.2 Intelligens Fül- és Nézetválasztó (`VatReturnViewTab.tsx`)
A cég joghatósága (`country_code`) alapján:
- **Horvát cég esetén:**
  - A korábbi *"NAV 65 nyomtatvány replika"* helyett automatikusan az **`Obrazac PDV replika`** fül jelenik meg.
  - A magyar-specifikus *"6/B Acélipari nyilatkozat"* fül elrejtésre kerül.
  - A fő fülön közvetlenül a horvát nyomtatvány töltődik be.
- **Magyar cég esetén:**
  - Változatlanul az eredeti NAV 2665-ös nyomtatvány replika és a 6/B fül jelenik meg forintban.

### 2.3 Horvát Számítási Összesítő Nézet (`VatCalculatorView.tsx`)
A dinamikus kalkulátor nézetben:
- A csoportosító szekciók horvát cégeknél az Obrazac PDV struktúrához igazodnak:
  - `exempt`: I. Neoporezive i oslobođene transakcije
  - `payable`: II. Obračunani porez (obveza)
  - `deductible`: III. Pretporez (odbitak)
  - `settlement`: IV. Obveza za uplatu / Za povrat
  - `other`: VI. Ostali podaci
- Az összegek euróban, 2 tizedesjegy pontossággal jelennek meg.
- A 66-os magyar FAD sorspecifikus lenyitási funkció horvát cégeknél inaktiválva van.

### 2.4 Számlaszintű Horvát ÁFA Kódválasztó (`InvoiceVatCodeSelector.tsx`)
A számlaszerkesztő és számlatétel komponensekben:
- Ha a cég horvát (`isCroatia = true`), a választó automatikusan a horvát kódkészletet ajánlja fel fallbackként (`HR_IZL_25`, `HR_IZL_13`, `HR_IZL_5`, `HR_IZL_TUZ_PRIJ`, `HR_UL_25_ODB`, `HR_UL_13_ODB`, `HR_UL_5_ODB`, `HR_UL_TUZ_PRIJ`, `HR_UL_EU_USL`, stb.).
- A lenyíló listában megjelenik a horvát bevallási sorszám hivatkozása is (pl. `II.3 (25%)`, `III.2 (25%)`, `I.1`).

---

## 3. UI/UX Minőségbiztosítás és Eredmények

1. **Zero Silent Decisions:**
   A tervezési és architektúrális döntések a jóváhagyott specifikáció alapján valósultak meg, a magyar és horvát logikák szétválasztásával.
2. **Kétnyelvű kulcsparitás:**
   A nemzetközi nyelvi fájlok (`src/locales/hu/` és `src/locales/hr/`) 100%-os kulcsparitással rendelkeznek (`i18n.test.ts` hibátlanul lefutott).
3. **Automatizált tesztek és Verifikáció:**
   - 8 dedikált horvát ÁFA teszt (`src/test/vat/croatianVatReturn.test.ts`) ellenőrzi a formázást, aggregációt, kód-leképzést és szekció-besorolást.
   - Összesen 70 vitest teszt és a teljes `npm run build` tiszta kilépési kóddal (exit code 0) lefutott.
