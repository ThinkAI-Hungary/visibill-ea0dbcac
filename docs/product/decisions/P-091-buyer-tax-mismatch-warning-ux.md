# P-091: Téves Vevőre Szóló Számlák Figyelmeztető Jelzése és Jóváhagyási Dialógus UX (Buyer Tax Mismatch Warning UX)

**Status:** Decided  
**Category:** UI / Workflow / Validation  
**Question:** Hogyan figyelmeztesse a rendszer a könyvelőt és a felhasználót, ha egy feltöltött számlán szereplő vevő adószáma eltér a kiválasztott aktív cégétől?  
**Decision:** Kétlépcsős, nem-blokkoló vizuális védőhálót alkalmazunk: táblázatszintű figyelmeztető jelzés és kiemelt amber figyelmeztető panel a jóváhagyási dialógusban.  
**Current Implementation:** `InvoiceApprovalDialog.tsx`, `SubmittedInvoiceRow.tsx`, `invoiceMatchingUtils.ts`.  
**Rationale:** Az azonnali blokkolás ellehetetlenítené a jogos kivételeket (pl. kapcsolt vállalkozások közötti költségtovábbhárítás, telephelyek közötti adminisztráció), ugyanakkor az észrevétlen bekönyvelés adókockázatot és könyvelési hibát okoz.

---

## Részletes UI/UX Működés

### 1. Figyelmeztető Panel a Jóváhagyási Dialógusban (`InvoiceApprovalDialog.tsx`)
* Amikor a felhasználó megnyit egy jóváhagyásra váró számlát, a rendszer ellenőrzi a vevő adószámát az aktív cég 8 jegyű törzsszámával összevetve.
* Ha eltérés van, egy sárga/borostyán kiemelésű doboz jelenik meg az ablak tetején:
  * **Ikon:** ⚠️ `AlertTriangle`
  * **Cím:** *„Figyelem: A számlán szereplő vevő adószáma eltér az aktív cégétől!”*
  * **Részletek:**
    * Számlán szereplő vevő neve és adószáma (pl. `12345678-1-42`)
    * Aktív cég neve és adószáma (pl. `87654321-2-41`)
  * **Megerősítés:** A gomb felirata felhívja a figyelmet a felelősségre (*„Tudomásul vettem, jóváhagyom a számlát”*).

### 2. Számlatáblázat Vizuális Jelzés (`SubmittedInvoiceRow.tsx`)
* A beérkező számlák listájában a vevő mező mellett vagy a státuszoszlopban egy diszkrét figyelmeztető ikon / tooltip jelzi az eltérést, így a könyvelő egyetlen pillantással kiszűrheti az idegen névre szóló bizonylatokat még a dialógus megnyitása előtt.

---

## Kapcsolódó
- [A-123: Buyer Tax Number Mismatch Guard](../../architecture/decisions/A-123-buyer-tax-mismatch-detection-and-approval-guard.md)
- [058: Buyer Tax Validation & Misdirected Invoices Policy](../../business/decisions/058-buyer-tax-mismatch-accounting-guard.md)
- [P-065: NAV Cross-Check Approval Gate UX](./P-065-nav-crosscheck-approval-gate-ux.md)
