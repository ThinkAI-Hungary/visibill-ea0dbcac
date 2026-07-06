# P-034: [eaisyBooks] Jóváhagyási Sor (Approval Queue)

**Status:** Decided  
**Category:** eaisyBooks  
**BRD Reference:** Decision 031 (eaisyBooks modul scope)

**Question:** Hogyan néz ki a jóváhagyásra váró tételek kezelésének felülete?

**Decision:** Lista nézet batch műveletekkel és szűrőkkel.

**Current Implementation:**
- `ApprovalQueuePage.tsx` — route: `/accounty/approval-queue`
- Funkciók:
  - Jóváhagyásra váró tételek listája (számlák, tranzakciók, bérszámfejtési ciklusok)
  - Batch approve/reject: több tétel egyszerre jóváhagyható vagy elutasítható
  - Szűrők: típus, ügyfél, prioritás, dátum
  - Ügyfél-szintű csoportosítás lehetőség
  - Iroda-szintű nézet (admin: minden könyvelő tételeit látja)
  - Könyvelő-szintű nézet (saját ügyfelek tételei)
- Interakció: kártya-alapú tételek, swipe/click approve/reject

**Rationale:** A batch jóváhagyás drastikusan csökkenti az irodavezető idejét. A szűrők és csoportosítás lehetővé teszi, hogy először a kritikus tételekkel foglalkozzon, majd a többit gyorsan batch-ben kezelje.
