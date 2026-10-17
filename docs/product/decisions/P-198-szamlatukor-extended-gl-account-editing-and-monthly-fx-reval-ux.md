# P-198: Főkönyvi Számla Szerkesztés, Csoportszámla Beállítás-öröklődés és Hóközi Devizás Átértékelés Varázsló UX

**Status:** Decided  
**Category:** Főkönyv & Riportok / UI & Workflow  
**Question:** Hogyan biztosíthatjuk a meglévő főkönyvi számlák ergonomikus módosítását, a beállítások csoportszintű öröklődését, valamint a törvényi deviza-átértékelés zökkenőmentes felületi élményét?  
**Decision:**
1. **Főkönyvi Számla Szerkesztő Gomb és Modál (`EditGlAccountModal`):**
   - A Főkönyvi kivonaton (`GeneralLedgerTable`) és a Számlakartonon (`GlAccountCardView`) minden számlasor mellett megjelenik egy diszkrét ✏️ Szerkesztés ikon.
   - Kattintásra megnyílik az `EditGlAccountModal`, ahol a könyvelő módosíthatja:
     - Rövid megnevezés (`short_name`),
     - Bővebb leírás / számviteli cél (`description`),
     - Deviza beállítások (`currency`, `is_multicurrency`),
     - Kötelező partner kényszer (`requires_partner`),
     - Kötelező projekt kényszer (`requires_project`),
     - Kötelező költséghely kényszer (`requires_cost_center`),
     - Folyószámla párosítási kötelezettség (`is_reconcilable`),
     - Hóközi devizás átértékelésbe bevonandó-e (`is_monthly_fx_reval`).
2. **Csoportszámla Beállítás-öröklődés Megerősítő Dialógus:**
   - Amennyiben a szerkesztett számla szülő/szintetikus számla (vannak alatta analitikus számlák a számlatükörben), a felület mentéskor egy informatív megerősítő kérdést tesz fel:
     > *„Ez egy csoportszámla (%d db alszámlával). Szeretné a partner-, projekt- és folyószámla-beállításokat az összes alá tartozó analitikus alszámlára is érvényesíteni?”*
   - Jóváhagyás esetén a felület meghívja az `acc_cascade_gl_account_settings` tárolt eljárást, amely azonnal végigvezeti a módosításokat a teljes alszámlafán, zéró manuális kattintással.
3. **Hóközi és Év Végi Devizás Átértékelés Varázsló (`MonthlyFxRevaluationModal`):**
   - A Főkönyvi kivonat felső vezérlősávján (`GlToolbar`) elérhető a **[ 💱 Havi devizás átértékelés ]** akciógomb.
   - A varázsló lépései:
     - **1. Fordulónap kiválasztása:** Alapértelmezetten a tárgyhó vagy tárgyév utolsó napja.
     - **2. MNB Árfolyam Lekérdezés & Kalkuláció:** A rendszer automatikusan kiolvassa a fordulónapi hivatalos MNB devizaárfolyamokat a devizás vevőkre (316), devizás szállítókra (4542), devizaszámlákra (386) és devizapénztárakra (382).
     - **3. Tételes Átértékelési Mátrix:** Megjeleníti az érintett nyitott bizonylatokat és egyenlegeket: devizanem, devizaösszeg, könyv szerinti forintérték, MNB fordulónapi forintérték, valamint a kalkulált árfolyamkülönbözet (nyereség zöld badge, veszteség piros badge).
     - **4. Egy-kattintásos Vegyes Napló Feladás:** A jóváhagyott tételekre a gomb azonnal generálja és lekönyveli az összevont vegyes bizonylatot a cég `ARF` (vagy `VE`) naplójába a 976 / 876 ellenszámlákra.
4. **Natív RLB-60 FOKTORZS (.RFT / .DBF) Import Élmény:**
   - Az `UploadChartOfAccountsModal` dialógusban a könyvelő közvetlenül behúzhatja a DOS-os RLB-ből származó `FOKTORZS.RFT` fájlt.
   - A felület azonnal felolvassa, dekódolja a magyar ékezeteket (CP852), felépíti a fa-struktúrát, pótolja a 491/492 technikai számlákat, és előnézeti táblázatban prezentálja a betöltendő számlákat.

**Current Implementation:**
- Komponensek: `src/components/general-ledger/EditGlAccountModal.tsx`, `src/components/general-ledger/GlAccountFormFields.tsx`, `src/components/general-ledger/MonthlyFxRevaluationModal.tsx`, `src/components/general-ledger/UploadChartOfAccountsModal.tsx`, `src/lib/rlb/rlbRftParser.ts`.
- Automatizált tesztek: `src/components/general-ledger/__tests__/GlToolbar.test.tsx`, `UploadChartOfAccountsModal.test.tsx`.

**Rationale:**
A számlatükör beállításainak gyors módosítása és a csoportszintű öröklődés nélkül a könyvelők órákat töltöttek volna repetitív űrlapkitöltéssel. A devizás átértékelés automatizálása pedig felszámolja a hóközi és évzárási exceles számolgatást.

## Kapcsolódó
- [A-265: Számlatükör Extended Architektúra](../../architecture/decisions/A-265-szamlatukor-extended-gl-account-mutation-cascading-settings-rlb-dbf-parser-and-fx-reval.md)
- [BDR 076: RLB-60 FOKTORZS (.RFT / .DBF) Számlatükör Formátum](../../business/decisions/076-rlb-foktorzs-rft-dbf-chart-of-accounts-parsing-and-import.md)
- [BDR 078: Főkönyvi Számlamódosítás és Devizás Értékelés Szabályzata](../../business/decisions/078-gl-account-mutation-cascading-constraints-and-monthly-fx-revaluation-policy.md)
