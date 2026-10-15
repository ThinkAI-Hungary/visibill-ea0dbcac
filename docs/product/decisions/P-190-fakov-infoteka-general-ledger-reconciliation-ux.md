# P-190: Fakov Kft. Infotéka (Kontír.NET) Főkönyvi Rekonciliáció és Összehasonlító Kivonat UX

**Status:** Decided  
**Date:** 2026-10-15  
**Category:** UI / Workflow / General Ledger / Reconciliation  
**Author:** Áron / Antigravity AI  
**Kapcsolódó döntések:** [074](../../business/decisions/074-fakov-infoteka-auditxml-reconciliation-and-gl-alignment.md), [073](../../business/decisions/073-gl-opening-continuity-virtual-banks-and-single-currency-cash-policy.md), [P-189](./P-189-eaisybooks-gl-defaults-petty-cash-currency-and-virtual-bank-ux.md), [P-177](./P-177-procont-general-ledger-export-and-reconciliation-ux.md)

---

## Question
Hogyan biztosítja az eaisybill a külső könyvelőprogramokból (jelen esetben az Infotéka Kontír.NET rendszeréből exportált AuditXML és nyitó PDF) származó adatok automatikus összevetését, a főkönyvi számlák tételes differencia-elemzését és az eltérések rendszerszintű feloldását?

---

## Decision

### 1. Infotéka AuditXML és Nyitó PDF Integráció
- **Bemeneti Adatok Feldolgozása:** A rendszer támogatja a Kontír.NET AuditXML (`AuditXML_FK_FAKOV KFT_202601_202612.xml`) és nyitó PDF (`Fakov 2026.01.01. NYITÓ FK.pdf`) beolvasását.
- **XML Séma Támogatás:** `<Biz>` (FkBizonylat) és `<Tet>` (FkTetel) struktúra feldolgozása, ahol a belső számlaszám kód (`Kod`) a törvényes magyar főkönyvi számlaszámra (`TKod`) van leképezve.
- **Nyitó Állomány Audit:** 16 érintett főkönyvi számla összevetése fillérre azonos egyezést igazolt az eaisybill nyitó tételeivel (`NYITO-2026`).

### 2. Side-by-Side (PROCONT-stílusú) Összehasonlító Elemzés
- **Automatizált Különbözet-kalkuláció:** A rendszer számlaszámonként összeveti az Infotéka egyenleget (`T_total - K_total`) az eaisybill aktuális egyenlegével (`total_balance`).
- **Státusz Kategorizálás:**
  - `EGYEZIK`: Nincs differencia (|diff| < 0.01 Ft).
  - `ELTÉRÉS`: Mindkét rendszerben van forgalom, de eltérő összegben.
  - `HIÁNYZIK EASYBŐL`: Csak az Infotékában van könyvelt tétel.
  - `HIÁNYZIK INFOBÓL`: Csak az eaisybillben van rögzített tétel.

### 3. Automatizált Vegyes és Évközi Átvezetések
- **VE-2026-001 (Adózott eredmény átvezetése):** `T 415 / K 413: 324,214.13 Ft` lekönyvelve a Vegyes (VE) naplóban.
  - Eredmény: a 413-as eredménytartalék (-7,798,208 Ft) és a 415-ös adózott eredmény (0 Ft) 100%-ban megegyezik az Infotékával.
- **VE-2026-002 (Tárgyi eszköz aktiválás):** `T 131: 3,150,000 / T 143: 68,504 / T 144: 224,252 / K 161: 3,442,756 Ft` lekönyvelve.
  - Eredmény: az 1. számlaosztály (131, 132, 139, 143, 144, 149) teljes egésze 100%-os egyezést mutat az Infotékával.

### 4. Banki Bizonylatok Lekönyvelése és NAV Adószámla Bontás (B1 Napló)
- **151 Banki Tranzakció:** Az eaisybillben tárolt 151 db banki tranzakció lekönyvelésre került a `B1` naplóba `KONYVELT` státusszal.
- **NAV Adók Analitikus Szétbontása:**
  - `468 ÁFA elszámolás`: 4 db utalás (`490,000 Ft`)
  - `4696 Gépjárműadó`: 1 db utalás (`27,209 Ft`) -> **100% egyezés**
  - `4611 TAO`: 1 db utalás (`8,000 Ft`) -> **100% egyezés**
  - `46219 SZJA`: 8 db utalás (`44,000 Ft`) -> 5,000 Ft-os eltérésre csökkent
  - `4442 Merkantil lízing`: 8 db havi törlesztés -> eltérése -56,711 Ft-ra (egy havi tételre) csökkent

### 5. Készpénzes Számlák Kettős Könyvviteli Rendezése (P1 Napló)
- **Folyószámla Tisztítás:** 159 db házipénztári kiegyenlítés került rögzítésre a `P1` naplóban (`T 4541 / K 3811` és `T 3811 / K 311`).
- **Eredmény:**
  - A `4541 Belföldi szállítók` nyitott kötelezettségállománya **-15.5 millió Ft-ról -606 ezer Ft-ra csökkent**.
  - A `311 Belföldi vevők` nyitott követelésállománya **+13.0 millió Ft-ról közel 0-ra rendeződött**.

---

## Current Implementation & Files
- [074-fakov-infoteka-auditxml-reconciliation-and-gl-alignment.md](../../business/decisions/074-fakov-infoteka-auditxml-reconciliation-and-gl-alignment.md): Üzleti és számviteli döntés.
- [draftFallbackGenerator.ts](file:///c:/Users/adetw/.antigravity/visibill/visibill-709fffdf/src/features/journals/services/draftFallbackGenerator.ts): Banki és házipénztári automatikus kontírozó motor.
- `scratch/compare_fakov_gl_detailed.py`: PROCONT-stílusú főkönyvi összehasonlító és kiértékelő script.
- `scratch/fakov_gl_diff_list.json`: Számlaszintű tételes differencialista.
