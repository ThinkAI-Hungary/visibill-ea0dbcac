# P-181: PRC Főkönyvi Kivonat Export Elnevezési Konvenció és Letisztult Megjelenítés UX

**Status:** Decided  
**Category:** UI / Export  
**Question:** Hogyan jelenjen meg a felhasználói felületen a PROCONT-kompatibilis főkönyvi kivonat exportfunkció, hogy elkerüljük az explicit védjegybeli elnevezéseket, miközben a könyvelők azonnal felismerik a formátumot?  
**Decision:** A felületi menüpontokban és a letöltött fájlnevekben a korábbi „PROCONT” megnevezést a tömör és neutrális „PRC” elnevezésre cseréljük: `PRC kivonat (PDF)` és `PRC kivonat (Excel)`.  
**Current Implementation:** `src/components/general-ledger/GlToolbar.tsx`, `src/lib/procontGlPdf.ts`, `src/lib/procontGlExcel.ts`.  
**Rationale:** Felhasználói kérés alapján a felületen és az exportált fájlnevekben nem kívánatos az explicit külső szoftvernév használata, míg a „PRC” rövidítés a szakmai felhasználók számára egyértelműen azonosítja a megszokott struktúrát és egyezőség-számítást.  

---

## 🖥️ Felületi Változások

### 1. Főkönyvi Eszköztár Lenyíló Export Menü (`GlToolbar.tsx`)
A Főkönyv (`/general-ledger`) képernyő jobb felső **„Export”** gombjára kattintva a lenyíló listában:
- Korábbi megjelenés:
  - *PROCONT kivonat (PDF)*
  - *PROCONT kivonat (Excel)*
- Új, letisztult megjelenés:
  - **PRC kivonat (PDF)** (kék dokumentum ikonnal, almenü: *Teljes kivonat* / *0-ás sorok nélkül*)
  - **PRC kivonat (Excel)** (zöld táblázat ikonnal, almenü: *Teljes kivonat* / *0-ás sorok nélkül*)

### 2. Generált Fájlnevek (`procontGlPdf.ts`, `procontGlExcel.ts`)
A letöltött fájlok elnevezése követi a neutrális konvenciót:
- PDF: `PRC_Fokonyvi_Kivonat_<Cégnév>_<Időszak><_0_nelkul>.pdf`
- Excel: `PRC_Fokonyvi_Kivonat_<Cégnév>_<Időszak><_0_nelkul>.xlsx`

### 3. Tartalmi és Layout Integritás
A dokumentumok belső tartalma (számlaosztály-sorrend, szintetikus/analitikus hierarchia, 4 monetáris oszlop, nyitó tételek és a lap alján található kétoldalas Mérleg vs. Eredménykimutatás egyezőség-számítás) változatlanul 100%-os egyezést nyújt az etalonnal. A dokumentum címsorában kizárólag a hivatalos „FŐKÖNYVI KIVONAT” felirat és az adott cég neve szerepel.

---

## 🔗 Kapcsolódó
- [P-177: PROCONT Főkönyvi Kivonat Export és Egyezőség-számítás UX](./P-177-procont-general-ledger-export-and-reconciliation-ux.md)
- [A-239: PROCONT Főkönyvi Kivonat Export Architektúra](../../architecture/decisions/A-239-procont-general-ledger-export-and-reconciliation-architecture.md)
