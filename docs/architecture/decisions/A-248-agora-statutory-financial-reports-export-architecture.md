# A-248: Agora / Novitax Formátumhű Pénzügyi Kimutatások (Főkönyvi Kivonat és Eredménykimutatás) Export Architektúra

**Status:** Decided  
**Date:** 2026-10-11  
**Author:** AI Pair Programming (Morfi Subagent Swarm)  
**Scope:** `src/lib/agoraGl*.ts`, `src/lib/agoraPnl*.ts`, `src/pages/ProfitAndLoss.tsx`, `src/pages/GeneralLedgerPage.tsx`

---

## 1. Context

A magyar könyvelői praxisban (különösen Novitax és Agora rendszereket használó irodáknál) elengedhetetlen, hogy a szoftverből kinyert kimutatások (Főkönyvi kivonat, Eredménykimutatás) 1:1 arányban, vizuálisan és számszakilag megegyezzenek a hatóságok és könyvvizsgálók által megszokott formátummal.

A korábbi általános webes nézetek és nyomtatási stílusok nem biztosították a szigorú 2 oldalas törvényi tagolást, a 48 tételsoros alábontást, valamint a formátumhű fejléceket (Cégadatok, Statisztikai számjel, Cégjegyzékszám, Mérlegfordulónap, Listaazonosító, Ezer HUF kerekítés, keltezés/vezetői aláírásblokk).

---

## 2. Decision

Kliensoldali, azonnali (<100ms) futású export motort implementáltunk jsPDF és ExcelJS technológiákra alapozva mind a Főkönyvi kivonat, mind az Eredménykimutatás számára:

### 2.1 Eredménykimutatás összköltség eljárással („A” változat)
1. **Adatmodell és Számítási Motor (`agoraPnlData.ts`):**
   - A magyar számviteli törvény szerinti pontos 48 tételsor leképezése.
   - A `get_pnl_report` RPC által visszaadott főkönyvi számlaszámok előtagjai (`gl_number` prefixek: 91/92, 93/94, 51, 52, 53, 814, 815, 54, 55, 56, 57, 86, 97, 87, 89) alapján végzi el a tételes aggregációt.
   - Kiszámítja az összesítő formulákat (I., II., IV., V., A., VIII., IX., B., C., D.).
   - Kezeli az "Ezer HUF" kerekítést és a formázást (`98,007`, `-580`, `41,840`).
2. **Formátumhű 2 Oldalas PDF Generáló (`agoraPnlPdf.ts`):**
   - Szigorúan 2 oldalas A4 Portrait elrendezés (1. oldal: 01-22. sorok, zárva az Üzemi eredménnyel; 2. oldal: 23-48. sorok, zárva az Adózott eredménnyel).
   - Hivatalos cégadatok (Cég, Cím, Adószám, Statisztikai számjel, Cégjegyzékszám, Mérlegfordulónap).
   - Aláírási blokk (`keltezés` és `a vállalkozás vezetője (képviselője)`).
   - "EaisyBill" branding lábléc vonal.
3. **Formátumhű Excel Exportáló (`agoraPnlExcel.ts`):**
   - Excel munkafüzet hivatalos fejléccel, kiemelt főkategóriákkal, formázott cellákkal és fagyasztott táblázatfejléccel.

---

## 3. Consequences

### Pozitív:
- **100% Benchmark Megfelelőség:** Az Agora Plusz Kft. mintaadataival a számítások penny-pontosan egyeznek a benchmark PDF-fel (Üzemi eredmény: 42,420, Pénzügyi eredmény: -580, Adózott eredmény: 41,840).
- **Zéró Szerver Terhelés:** A PDF és Excel közvetlenül a böngésző memóriájában generálódik, elkerülve a szerveroldali renderelő worker-t és a hálózati késleltetést.
- **Debounce Védelem:** Az `isExporting` állapot megakadályozza a többszörös párhuzamos kattintásokat.

### Kapcsolódó:
- [P-182: Agora és Novitax Formátumhű Pénzügyi Kimutatások UX](../../product/decisions/P-182-agora-financial-reports-and-income-statement-export-ux.md)
- [A-239: Procont General Ledger Export Architektúra](./A-239-procont-general-ledger-export-and-reconciliation-architecture.md)
- [A-028: PDF Export Workflow & Lifecycle](./A-028-pdf-export-lifecycle.md)
- `tests/docs/eb0148/Eredménykimutatás_export.pdf`
