# P-134: Bérszámfejtési Ciklus Lezárási Választó Modál, Lezárt Ciklus Védelem és Újranyitás UX

**Status:** Decided  
**Category:** eaisyBooks / Bérszámfejtés  
**Ticket Reference:** Surányi Pál (TS Consult Kft. — 2026. szept. 28.)  
**Question:** Hogyan kerülhető el a lezárt bérszámfejtési ciklusok véletlen státuszvesztése és a bérfeladás duplikált könyvelése megtekintéskor?

## Context
A könyvelők részéről felmerült igény, hogy a bérszámfejtési ciklus 8. lépésének (Összesítés & Lezárás) elérésekor ne történjen meg azonnal és kötelezően a főkönyvi vegyes naplóba történő könyvelés, hanem legyen lehetőség választani a cikluszárás (könyvelés nélkül) és a teljes főkönyvi feladás között.
Továbbá korábban komoly ergonómiai és adatbiztonsági kockázat állt fenn:
- Amikor a könyvelő utólag visszalépett egy már lezárt (`status = 'closed'`) ciklusba bármilyen adatot megtekinteni, a stepper navigáció (`handleStepChange`) felülírta a ciklus státuszát korábbi fázisra (`data_collection`, `review`, `calculating`), megszüntetve a lezárt állapotot.
- A 8. lépésre ismét rákattintva a rendszer újra lekönyvelte a havi bérfeladást, duplikált tételt generálva a vegyes naplóban (`acc_journal_headers`), amit utólag manuális sztornóval kellett korrigálni.

## Decision
1. **Explicit Cikluszárási Választó Modál (Closing Options Dialog):**
   - A 8. lépésben a „Ciklus lezárása...” gombra kattintva egy dialógusablak jelenik meg, amely két egyértelmű műveletet kínál fel:
     - **„Csak lezárás (könyvelés nélkül)”**: A ciklus `status = 'closed'` állapotba kerül, a béradatok rögzülnek, de nem jön létre főkönyvi tétel a Vegyes naplóban. A feladás később bármikor pótolható.
     - **„Lezárás & Könyvelés”**: A ciklus lezárul és a rendszer azonnal legenerálja a vegyes naplóbeli könyvelést (541 bérköltség, 471 nettó bér, 462 SZJA, 463 TB, 464 SZOCHO).
2. **Lezárt Ciklus Védelem (Closed Cycle Immutability):**
   - Amíg a ciklus állapota `closed`, a lépések közötti navigáció (1–8. lépés megtekintése) nem módosítja az adatbázisban a ciklus státuszát.
   - A fejlécben zöld `Lezárt ciklus` badge jelenik meg `CheckCircle2` ikonnal.
   - A 8. lépés alsó akciógombja lezárt állapotban zöld `Vissza a bérszámfejtéshez` gombra vált, megakadályozva a véletlen újrakönyvelést.
3. **Ciklus Újranyitása Megerősítő Dialógus (Explicit Reopen Dialog):**
   - Ha a könyvelő szándékosan módosítani szeretné a lezárt számfejtést, a fejlécben található diszkrét borostyánsárga `Ciklus újranyitása` gombra kattinthat.
   - A felugró megerősítő ablak tájékoztatja, hogy a korábban lekönyvelt bérfeladás változatlan marad, de a számfejtési adatok ismét szerkeszthetővé válnak.

## Current Implementation
- `src/pages/Accounty/PayrollCyclePage.tsx`:
  - `closingModalOpen` és `reopenConfirmOpen` állapotok, Shadcn `Dialog` és `AlertDialog`.
  - `handleStepChange` védelem: `if (cycle.status === 'closed') { ... }` megtartja a lezárt státuszt.
  - Fejléc lezártság-jelző és újranyitó gomb.
  - `handleConfirmClose(postToLedger: boolean)` kettős lezárási logika.
- `src/lib/payroll/payrollAutoPoster.ts`:
  - Idempotencia-védelem: könyvelés előtt ellenőrzi az `acc_journal_headers`-t `document_id = BER-YYYY-MM` és `status != 'SZTORNOZOTT'` feltétellel. Ha létezik, kihagyja az új beszúrást és a meglévő bizonylatot adja vissza.

## Rationale
A könyvelők számára a transzparencia, a döntési szabadság és a duplikációmentesség alapvető fontosságú. A választási lehetőség és a véletlen státuszvesztés elleni védelem megszünteti a téves duplakönyveléseket és az utólagos manuális korrekciós kényszert.

## Kapcsolódó
- [A-174: Bérfeladás Idempotencia-védelem és Lezárt Ciklus Adatbiztonság](../../architecture/decisions/A-174-payroll-auto-poster-idempotency-and-closed-cycle-immutability.md)
- [P-033: Bérszámfejtési Ciklus Workflow](./P-033-payroll-cycle.md)
- [P-082: Bérszámfejtési Főkönyvi Feladás Kontírozás UX](./P-082-payroll-gl-mapping-combobox-and-step8-ux.md)
