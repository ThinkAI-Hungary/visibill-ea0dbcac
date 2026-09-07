# P-074: [eaisyBooks] TAO és KIVA Tervező, Zárási Ellenőrzőlista és Adókalkulátor UX

**Status:** Decided  
**Category:** eaisyBooks  
**BRD Reference:** REQ-8b.15, Decision 052 (TAO és KIVA modul)

**Question:** Hogyan támogatja az eaisyBooks a társasági adó (TAO) és a kisvállalati adó (KIVA) alanyok évközi és év végi folyamatait?

**Decision:** Dedikált `TaoKivaPage` felület (`/eaisybooks/:companyId/:dateRange/tao`) moduláris tabokkal:
1. **Évközi Követés:** Valós idejű adóalap és előlegkötelezettség aggregáció a főkönyvi adatokból.
2. **Adónaptár & Előleg Ütemezés:** Negyedéves és havi TAO/KIVA előlegek, határidők és fizetendő összegek táblázata.
3. **Év Végi Zárási Varázsló (Checklist):** Adóalap-növelő (pl. számviteli értékcsökkenés, bírságok, nem a vállalkozás érdekében felmerült költségek) és csökkentő tételek (pl. törvényes ÉCS, K+F kedvezmény, kisvállalkozói kedvezmény) interaktív ellenőrzőlistája.
4. **Adótervező & Kalkulátor:** TAO vs KIVA szimulációs összehasonlító motor, amely javaslatot tesz a kedvezőbb adózási mód választására.

**Current Implementation:**
- Útvonal: `/eaisybooks/:companyId/:dateRange/tao`
- Komponensek: `TaoKivaModulePage.tsx`, `TaxOptimizationTab.tsx`, `YearEndClosingChecklist.tsx`

**Rationale:** A TAO és KIVA szabályozás komplex korrekciós tételeket tartalmaz. Az automatizált ellenőrzőlista és az évközi szimulátor elkerülhetővé teszi az év végi kapkodást és a hibás bevallásokat.
