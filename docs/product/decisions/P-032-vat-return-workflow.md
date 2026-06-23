# P-032: [eaisyBooks] ÁFA Bevallás Workflow

**Status:** Decided  
**Category:** eaisyBooks  
**BRD Reference:** Decision 033 (ÁFA bevallás modul)

**Question:** Hogyan néz ki az ÁFA bevallás elkészítésének UI workflow-ja?

**Decision:** Tab-alapú workflow a `VatReturnPage`-en belül.

**Current Implementation:**
- `VatReturnPage.tsx` — route: `/:companyId/:dateRange/vat-return/:tab?`
- Tab-ok:
  1. **Összesítő** — Fizetendő/Levonható/Nettó ÁFA pozíció, kulcsonkénti bontás
  2. **Bejövő** — Bejövő számlák ÁFA összesítése (NAV + manuális)
  3. **Kimenő** — Kimenő számlák ÁFA összesítése
  4. **Bevallás** — Draft generálás és NAV XML export gomb
- ÁFA kulcsok: 27%, 18%, 5%, TAM, AAM, mentes
- Időszak szűrés: GlobalDatePicker-rel (havi/negyedéves/éves)
- Export: NAV XML formátum (2065A típus)

**Rationale:** A tab-alapú megközelítés lehetővé teszi a könyvelőnek, hogy lépésről lépésre ellenőrizze az ÁFA számításokat mielőtt a bevallást véglegesíti. Az összesítő tab gyors áttekintést ad, a részletező tab-ok a tételes ellenőrzést szolgálják.
