# Decision 050: Főkönyvi Könyvelési Státusz (Csak Lekönyvelt) és Naplózási Kormányzás

**Status:** Decided  
**Date:** 2026-09-04  
**Category:** Accounting Governance / General Ledger / Tax Compliance  
**Releváns ügyfél megkeresés:** Kiss-Százi Emese (Ván Iroda Kft., Kiskunhalas, 2026. szept. 3. 14:54)  

---

## Question

Hogyan garantálja a Visibill a számviteli törvény (Sztv.) szerinti zárt könyvviteli elszámolást, a számlák, a könyvelési naplók és a főkönyv közötti átlátható összefüggést, valamint azt, hogy a hivatalos zárásokba és adóbevallásokba kizárólag a könyvelő által ellenőrzött és lezárt bizonylatok kerüljenek be?

---

## Decision

1. **Kétfokozatú Főkönyvi Megjelenítés (Operatív Előnézet vs. Zárt Könyvvitel):**
   - **Összes tétel (`ALL`):** Valós idejű vezetői tájékozódást és cash-flow előrejelzést biztosít; tartalmazza a még csak mesterséges intelligencia által besorolt, de naplókban még nem lekönyvelt számlákat és banki tranzakciókat is.
   - **Csak lekönyvelt (`POSTED_ONLY`):** Szigorú, Sztv. szerinti zárt számviteli állapot. Kizárólag azokat a bizonylatokat mutatja, amelyek bekerültek az idősoros könyvelési naplókba, megkapták a hiánytalan folyósorszámot, és `KONYVELT` státuszba kerültek.

2. **Bizonylat-szintű Véglegesítés vs. Naptári Időszakzárás:**
   - Az **egyedi / csoportos lekönyvelés** az egyes bizonylatok könyvviteli véglegesítését jelenti (naplósorszám kiadása, immutabilitási trigger aktiválása, módosíthatatlanság rögzítése).
   - Az **időszakzárás** ezzel szemben a teljes naptári hónapok/évek lezárását jelenti, ami megakadályozza új bizonylatok rögzítését a zárt időszakba. A felületen a két funkció fogalmilag és vizuálisan egyértelműen elkülönül.

3. **Állapot-immutabilitás (Módosításvédelem):**
   - Ha egy bizonylat lekönyvelésre került (`KONYVELT`), a rendszer semmilyen automatikus újra-szinkronizációval vagy háttérfolyamattal nem módosíthatja és nem törölheti. Javítás kizárólag a számviteli szabályoknak megfelelő kétlépcsős sztornózással és helyesbítő bizonylat rögzítésével történhet.

4. **Adóbevallási Audit Megfelelőség:**
   - A hivatalos adóbevallások (különösen a havi/negyedéves ÁFA 65-ös bevallás) készítésekor a rendszer valós idejű audit indikátorral jelzi a bizonylatok könyvelési lefedettségét a teljesítési időszak (`posting_date`) alapján. Ha vannak lezáratlan rendszerjavaslatok, a bevallás beadása előtt a könyvelő figyelmeztetést kap.

---

## Rationale

- **Könyvelői elvárások:** A tapasztalt könyvelők nem fogadják el a kevert státuszú főkönyvet, ahol a jóváhagyatlan gépi javaslatok egybeolvadnak a felelősen lekönyvelt tételekkel.
- **Jogszabályi megfelelőség (Sztv. 165–169. §):** A könyvelésnek zártnak, idősorosnak és visszakereshetőnek kell lennie. A bizonylatok sorszámozásának megszakításmentesnek kell lennie.
- **Auditálhatóság:** A NAV ellenőrzések és az éves beszámoló készítése során a könyvvizsgáló kizárólag a lezárt naplótételekből előállított főkönyvi kivonatot fogadja el.

---

## Kapcsolódó
- **ADR:** [A-086: Főkönyvi Könyvelési Státusz Szűrő és Naplózási Irányelvek](../../architecture/decisions/A-086-gl-posting-status-filter-and-journal-governance.md)
- **ADR:** [A-057: Könyvelési Napló Rendszer Architektúra](../../architecture/decisions/A-057-accounting-journals-architecture.md)
- **PRD:** [P-067: Főkönyvi Könyvelési Státusz Szűrés, Naplózási Kormányzás és ÁFA Audit Jelző UX](../../product/decisions/P-067-gl-posting-status-filter-and-journal-governance-ux.md)
- **BRD:** [043: Könyvelési Naplók és Kettős Könyvviteli Folyószámlák](./043-accounting-journals.md)
- **BRD:** [021: Főkönyvi rendszer (GL)](./021-general-ledger.md)
