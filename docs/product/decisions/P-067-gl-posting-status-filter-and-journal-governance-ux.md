# P-067: Főkönyvi Könyvelési Státusz Szűrés, Naplózási Kormányzás és ÁFA Audit Jelző UX

**Status:** Decided  
**Category:** UI / Workflow / General Ledger / Accounting Journals / VAT Return  
**Date:** 2026-09-04  
**Releváns ügyfél megkeresés:** Kiss-Százi Emese (Ván Iroda Kft., 2026. szept. 3. 14:54)  

---

## Question

Hogyan jelenítse meg a felület a jóváhagyatlan gépi kontírozási javaslatok és a hivatalosan lekönyvelt naplótételek közötti különbséget a Főkönyvben, a Könyvelési Naplókban és az ÁFA bevallásban, biztosítva az egyszerű tömeges jóváhagyást és a félreértésmentes időszakzárást?

---

## Decision

1. **Főkönyvi Státusz Kapcsoló (Segmented Toggle) és URL-Mélylinkelés:**
   - A [GeneralLedgerPage.tsx](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/pages/GeneralLedgerPage.tsx) fejlécében mindhárom nézetben (Főkönyvi kivonat, Naplófőkönyv, Többéves összehasonlítás) megjelenik az egységes szegmentált kapcsoló:
     - `[Összes tétel]` (`all`): Layers ikonnal jelzi az operatív előnézetet.
     - `[Csak lekönyvelt]` (`posted_only`): Zöld ShieldCheck ikonnal jelzi a hivatalosan lezárt tételeket.
   - Az állapot kétirányúan szinkronizálva van az URL paraméterrel (`?posting_status=posted_only`), támogatva a közvetlen könyvvizsgálói linkelést és a böngésző előre/vissza navigációját.
   - A [GeneralLedgerComparisonTable.tsx](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/general-ledger/GeneralLedgerComparisonTable.tsx) a tárgyévi és bázis évi oszlopokban is szinkronban szűri az egyenlegeket a kiválasztott mód szerint.

2. **Naplók Guidance Banner és 1-Kattintásos Kijelölés:**
   - Ha a könyvelési naplókban lezáratlan rendszerjavaslatok (`GEPI_JAVASLAT`, `KEZI_PISZKOZAT`, `JOVAHAGYASRA_VAR`) vannak, a táblázat felett borostyánsárga útmutató kártya jelenik meg:
     - Tájékoztatást ad a rendszerjavaslatok szerepéről (ellenőrzés után kapnak naplósorszámot és válnak zárt tétellé).
     - Gombot biztosít: **"Összes javaslat kijelölése (X db)"**, amely azonnal kijelöli az összes érintett tételt a lebegő akciósáv számára.

3. **Hibatűrő Tömeges Könyvelés és Törlési Megerősítő Modál (AlertDialog UX):**
   - A [JournalsPage.tsx](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/pages/JournalsPage.tsx) `bulkPostMutation` folyamata hibatűrő: ha több száz tétel közül egy tételnél könyvelési hiba lép fel (pl. egyensúlyi hiba vagy zárt hónap), nem szakad meg a teljes folyamat.
   - A sikeres tételek azonnal lekönyvelődnek a szerveren, a cache frissül (`onSettled`), és a felületen kizárólag a javításra szoruló hibás tételek maradnak kijelölve, pontos hibaüzenettel ellátva.
   - A művelet lefutásakor a kanonikus `invalidateGlAndJournalQueries` az összes kapcsolódó főkönyvi, naplófőkönyvi, összehasonlító és ÁFA kulcsot invalidálja.
   - **Törlési Megerősítő Modál (AlertDialog):** A korábbi natív böngésző `window.confirm()` helyett prémium, sötét mód kompatibilis shadcn/ui `AlertDialog` jelenik meg mind a tömeges piszkozat-törlés (`[Kijelöltek törlése]`), mind az egyedi sor törlése esetén. A modál pontos darabszámmal, tájékoztató leírással, romboló műveletet jelző stílussal és aszinkron betöltés-jelzővel (`Loader2`) garantálja a biztonságos jóváhagyást.

4. **Naptári Időszakzárás Fogalmi Elhatárolása:**
   - A Naplók fejlécében található "Időszakzárás" gomb informatív tooltipet kapott, tisztázva, hogy az a naptári időszakok (év/hónap) zárolására szolgál az új tételek rögzítése ellen, míg az egyedi bizonylatok véglegesítése a lekönyveléssel történik.

5. **ÁFA Bevallási Audit Indikátor Banner:**
   - A [VatReturnViewTab.tsx](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/features/vat/components/VatReturnViewTab.tsx) lapon a bevallási összefoglaló felett megjelenik az állapotkártya:
     - **Zöld (100% Lekönyvelve):** *"Könyvelési állapot: Zárt & Ellenőrzött. Az időszak összes bizonylata le van könyvelve a naplókban."*
     - **Borostyánsárga (Folyamatban):** *"Könyvelési állapot: Folyamatban. Az időszakban X / Y bizonylat van lekönyvelve (Z db függő rendszerjavaslat van a naplókban)."*
     - **Borostyánsárga (Nincsenek naplótételek):** *"Könyvelési állapot: Nincsenek naplótételek. Az időszakra még nem találhatók lekönyvelt tételek a naplókban. (0% Lekönyvelve)"*

---

## Rationale

- **Zéró bizonytalanság:** A könyvelő a felület bármely pontján azonnal látja, hogy mit lát (tervezetet vagy véglegesített könyvviteli adatot).
- **Megszakításmentes munkafolyamat:** A tömeges lekönyvelés nem hiúsulhat meg egyetlen bizonylat hibája miatt.

---

## Kapcsolódó
- **ADR:** [A-086: Főkönyvi Könyvelési Státusz Szűrő és Naplózási Irányelvek](../../architecture/decisions/A-086-gl-posting-status-filter-and-journal-governance.md)
- **ADR:** [A-057: Könyvelési Napló Rendszer Architektúra](../../architecture/decisions/A-057-accounting-journals-architecture.md)
- **PRD:** [P-055: Könyvelési Napló (Accounting Journals) UX](./P-055-accounting-journals-ux.md)
- **PRD:** [P-066: Főkönyvi Dátum Alap Kapcsoló és Beállítások UX](./P-066-gl-date-basis-toggle-and-settings-ux.md)
- **BRD:** [050: Főkönyvi Könyvelési Státusz és Naplózási Kormányzás](../../business/decisions/050-gl-posting-status-and-journal-governance.md)
