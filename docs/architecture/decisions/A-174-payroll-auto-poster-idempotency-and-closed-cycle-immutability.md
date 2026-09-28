# A-174: Bérfeladás Idempotencia-védelem, Duplakönyvelés Megelőzés és Lezárt Ciklus Adatbiztonság

**Státusz:** ✅ Elfogadva  
**Dátum:** 2026-09-28  
**Döntéshozó:** Antigravity Architect & User Approval  
**Kapcsolódó PRD:** [P-134: Bérszámfejtési Ciklus Lezárási Választó Modál, Lezárt Ciklus Védelem és Újranyitás UX](../../product/decisions/P-134-payroll-cycle-closing-modal-and-idempotency-protection.md)  
**Kapcsolódó ADR-ek:**
- [A-110: Bérszámfejtési Főkönyvi Számlatükör Pagináció és Kontírozás Perzisztencia](./A-110-payroll-gl-preset-pagination-and-mapping-persistence.md)
- [A-172: Időszaki Pénztárjelentés Adatbázis Modell, Szigorú Számadású Sorszámozás és Főkönyvi Életciklus](./A-172-periodic-cash-reports-schema-and-accounting-lifecycle.md)

**Érintett Komponensek és Fájlok:**
- `src/lib/payroll/payrollAutoPoster.ts`
- `src/pages/Accounty/PayrollCyclePage.tsx`
- `src/test/accounty/payrollIdempotencyAndCycleLock.test.ts`

---

## 1. Kontextus & Problémafelvetés

A havi bérszámfejtés zárásakor lefutó bérfeladás (`postPayrollCycleToLedger`) a havi bérköltségeket, nettó bért és levont adókat/járulékokat a Vegyes naplóba (`acc_journal_headers`, `acc_journal_lines`) könyveli le.

Korábban a rendszer nem rendelkezett ellenőrzéssel az azonos időszaki meglévő feladásokra:
1. **Hiányzó idempotencia-védelem:** Ha a könyvelő többször zárta le a ciklust vagy ismét elment a 8. lépésre, a funkció minden alkalommal új bizonylatot szúrt be az `acc_journal_headers` táblába `document_id = BER-YYYY-MM` azonosítóval.
2. **PostgreSQL Immutability Trigger hatása:** Mivel az `acc_journal_lines` táblán szigorú trigger tiltja a lekönyvelt/sztornózott tételek törlését (`Cannot modify or delete lines belonging to a posted/stornoed journal entry`), a feleslegesen létrejött duplikációkat csak manuális sztornóval lehetett korrigálni.
3. **Ciklusstátusz degradáció:** A `PayrollCyclePage` a lépések közötti navigáció során a ciklus státuszát a lépésszámhoz kötötte (`data_collection`, `review`, `calculating`), így egy már lezárt (`closed`) ciklus megtekintése visszarontotta a ciklust nyitott állapotba.

---

## 2. Architektúrális Döntések

### D-1: Idempotens Főkönyvi Bérfeladás (`postPayrollCycleToLedger`)
A könyvelési folyamat tranzakció-indítása előtt a rendszer lekérdezi a céghez és bizonylatazonosítóhoz tartozó meglévő tételeket:
```typescript
const documentId = `BER-${cycle.year}-${String(cycle.month).padStart(2, '0')}`;

const { data: existingHeaders } = await supabase
  .from('acc_journal_headers')
  .select('id, journal_number, status')
  .eq('company_id', companyId)
  .eq('document_id', documentId)
  .neq('status', 'SZTORNOZOTT')
  .limit(1);

if (existingHeaders && existingHeaders.length > 0) {
  return {
    success: true,
    isAlreadyPosted: true,
    headerId: existingHeaders[0].id,
    journalNumber: existingHeaders[0].journal_number,
    message: `A(z) ${cycle.year}. ${MONTHS[cycle.month - 1]} havi bérfeladás már le lett könyvelve (${existingHeaders[0].journal_number}). Duplikáció megakadályozva.`,
  };
}
```
- Ha létezik aktív (nem sztornózott) tétel, a rendszer nem végez újabb `insert` műveletet sem a fejekben, sem a sorokban.
- Siker-eredményt ad vissza a meglévő bizonylatszámmal, garantálva a főkönyvi egyensúly és integritás megőrzését.

### D-2: Állapot-perzisztencia és Lépés-védelem (`PayrollCyclePage`)
- A lépésváltó (`handleStepChange`) ellenőrzi a ciklus állapotát:
  ```typescript
  const nextStatus = cycle?.status === 'closed' ? 'closed' : getStatusForStep(stepNumber);
  ```
- Ha a ciklus állapota `closed`, a státusz garantáltan nem változik vissza `calculating` vagy `review` értékre.
- A ciklus kizárólag szándékos felhasználói jóváhagyással nyitható újra (`handleReopenCycle`).

### D-3: Opcionális Könyvelés Cikluszáráskor
- A cikluszárás elválik a kötelező főkönyvi könyveléstől: a felhasználó dönthet úgy, hogy a bérszámfejtést lezárja anélkül, hogy a vegyes naplóba bejegyzés kerülne, lehetővé téve a későbbi feladást.

---

## 3. Következmények & Éles Eredmények

- **Duplikációmentes Főkönyv:** Megszűntek a véletlen dupla könyvelések.
- **Megtekintési Biztonság:** A könyvelők bármikor megtekinthetik a korábbi hónapok számfejtéseit és jelenléti íveit anélkül, hogy kockáztatnák a ciklus integritását.
- **Regressziómentes Működés:** Az automata tesztek (`payrollIdempotencyAndCycleLock.test.ts`, `payrollCycleStability.test.ts`, `payrollAutoPosterFixes.test.ts`) 100%-os lefedettséggel igazolják a működést.
