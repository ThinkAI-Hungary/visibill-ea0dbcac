# A-135: Kettős Áfa Kódrendszer (NAV 2665 vs Konvencionális Könyvelői Kódok) és F.AFA Fordított Adózási Felismerés

**Státusz:** Elfogadva  
**Dátum:** 2026-09-21  
**Érintett komponensek:** `public.vat_codes`, `public.company_settings`, `VatCodeConfigTab.tsx`, `InvoiceItemsDialog.tsx`, `vatCodeMatching.ts`, `utils.ts`

---

## 1. Kontextus és Problémafelvetés

1. **F.AFA Fordított Adózási Felismerési Hiba:**  
   A számlázó/NAV felől érkező `F.AFA` (belföldi fordított adózás, pl. acél- és vastermékeknél, Áfa tv. 6/B melléklet) szöveges áfakulcsot a korábbi reguláris/szöveges felismerés nem kezelte reverz adózásként. Emiatt a számlatételek nézetében (`InvoiceItemsDialog`) a tétel 25-ös áfakódként és 27%-os alapértelmezett kódként jelent meg 0 Ft-os ÁFA ellenére.
2. **Kettős Kódrendszer Hiánya:**  
   A magyar könyvelői gyakorlatban bevett technikai gyűjtőkódok (pl. `25` a 27%-os tételekre, `FAD` a fordított adózásra, `TAM` a mentesre, `05` az 5%-ra) és a hivatalos NAV 2665-ös bevallási kódok (pl. `KIM_27`, `BE_27_LEV`, `KIM_FORD`, `BE_FORD_ACEL`) nem éltek egymás mellett strukturáltan.
3. **Félrevezető Tooltip:**  
   A számlatételek áfakód badge-ének tooltipje korábban mereven beégetve azt tartalmazta: `(Alapértelmezett kód 27%-os tételekre: 25)`, függetlenül attól, hogy a tétel 27%-os, 5%-os, vagy fordított adózású volt.
4. **Hiányzó Beállítások Oszlopfők:**  
   A beállítások képernyőn (`VatCodeConfigTab`) hiányoztak a dedikált oszlopfejlécek és nem volt lehetőség a megjelenítési mód kiválasztására sem.

---

## 2. Döntések

### 2.1 Adatbázis Séma és Migráció (`20260921150000_add_vat_code_legacy_code_and_display_mode.sql`)
- `public.vat_codes.legacy_code` (TEXT): A konvencionális könyvelői kód tárolása (pl. `25`, `FAD`, `TAM`, `05`, `18`, `EXP`).
- `public.company_settings.vat_code_display_mode` (TEXT DEFAULT `'legacy'` CHECK (`vat_code_display_mode IN ('legacy', 'nav')`)): Cég szintű beállítás, amely szabályozza a számlákon megjelenő kódrendszert.
- A seed függvények (`seed_default_vat_codes`, `seed_fad_vat_codes`) kiegészítésre kerültek a `legacy_code` mezők feltöltésével.
- A meglévő adatbázis rekordok determinisztikusan visszamenőleg kitöltésre kerültek (`KIM_27`/`BE_27_LEV` $\rightarrow$ `'25'`, `KIM_FORD`/`BE_FORD_%` $\rightarrow$ `'FAD'`, stb.).

### 2.2 F.AFA és Fordított Adózás Felismerése (`src/lib/utils.ts` & `src/utils/vatCodeMatching.ts`)
- `isReverseChargeVatRate(rate)`: Robusztus segédfüggvény, amely detektálja az `F.AFA`, `F_AFA`, `F-AFA`, `FAFA`, `F. ÁFA`, `FAD`, `FORDÍTOTT`, `REVERSE_CHARGE` és `DOMESTIC_REVERSE_CHARGE` jelöléseket.
- `formatVatRate(rate)` és `normalizeVatRatePercent(rate)`: Az `F.AFA` formázása automatikusan `'mentes'` / 0%.

### 2.3 Megjelenítési Mód és Vizuális Kiemelés (`VatCodeConfigTab.tsx`)
- Radio Group választó a beállítások fül tetején:
  - 🔘 Konvencionális könyvelői kódok (pl. 25, FAD, TAM) — alapértelmezett
  - 🔘 NAV 2665 hivatalos kódok (pl. KIM_27, BE_27_LEV)
- Mentés: `useCompanySettings().saveMutation.mutate({ vat_code_display_mode })`.
- Strukturált oszlopfejlécek (1-7):
  1. NAV 2665 Áfakód
  2. Könyvelői Kód
  3. Megnevezés / Leírás (Tooltip)
  4. Kulcs
  5. 2665-ös Bevallási Sorok
  6. Jelleg (Ford., EU, Lev.)
  7. Műveletek
- Az aktív oszlop fejléce és kódjai vizuálisan kiemeltek ("Aktív" badge a fejlécben, kiemelt szín).

### 2.4 Számlanézet és Tooltip Egységesítés (`InvoiceItemsDialog.tsx`)
- `matchItemToVatCode()` és `getVatCodeBadgeData()` segítségével a számlatételek áfakód badge-e a cég `vat_code_display_mode` beállítása alapján jelenik meg:
  - Legacy mód: `25 (27%)`, `FAD (mentes)`
  - NAV mód: `BE_27_LEV (27%)`, `BE_FORD_ACEL (mentes)`
- A tooltip kizárólag a 3. oszlopban megadott hivatalos leírást (`matchedCode.label`) jeleníti meg. A félrevezető hardcoded szöveg törölve lett.

---

## 3. Konzekvenciák és Előnyök

- **Megszűnt a fordított adózási félreértés:** A vas- és acéláru számlákon és építőipari számlákon a tétel többé nem kap 25-ös áfakódot.
- **Könyvelőbarát felület:** A könyvelő a saját megszokott kódjait látja a számlákon (`25`, `FAD`), miközben a háttérben a 2665-ös NAV bevallási struktúra teljes pontossággal megmarad.
- **Rugalmas átkapcsolhatóság:** Bármikor egyetlen kattintással átállítható a megjelenítés hivatalos NAV 2665 kódokra a beállításokban.
