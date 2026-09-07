# P-034: [eaisyBooks] Jóváhagyási Sor (Approval Queue)

**Status:** Decided  
**Category:** eaisyBooks  
**BRD Reference:** Decision 031 (eaisyBooks modul scope)

**Question:** Hogyan néz ki a jóváhagyásra váró tételek kezelésének felülete az eaisyBooks-ban?

**Decision:** Két szintű kezelés (Portfólió és Ügyfél szint) lista és kártya nézettel, batch műveletekkel, szűrőkkel és audit trail-lel.

**Current Implementation:**
- **Portfólió szintű nézet:** `ApprovalQueuePage.tsx` — route: `/eaisybooks/approval-queue`
- **Ügyfél-specifikus nézet:** `ClientApprovalQueuePage.tsx` — route: `/eaisybooks/:companyId/:dateRange/approval-queue`
- Funkciók:
  - Jóváhagyásra váró tételek listája (számlák, NAV párosítások, tranzakciók, bérszámfejtési ciklusok)
  - Batch approve/reject: több tétel egyszerre jóváhagyható (`approve_all`) vagy elutasítható
  - Szűrők: típus (számla, tranzakció, bér), ügyfélcég, prioritás, összeg, dátumtartomány
  - Ügyfél-szintű csoportosítási és rendezési lehetőségek
  - Iroda-szintű nézet (admin és senior könyvelő: minden munkatárs jóváhagyandó tételeit látja)
  - Könyvelő-szintű nézet (a bejelentkezett könyvelőhöz rendelt ügyfelek tételei)
- Interakció: kártya- és táblázatalapú tételek, inline kontír-szerkesztés, 1-kattintásos kötegelt jóváhagyás

**Rationale:** A kötegelt jóváhagyási sor drasztikusan csökkenti a könyvelők és az irodavezetők napi adminisztrációs idejét. A kettős szintű struktúra révén az iroda reggel portfólió szinten auditálhatja a pending feladatokat, miközben az ügyfél mélyfúrás során csak a releváns cég tételei láthatóak.
