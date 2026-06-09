# Decision 033: [Accounty] ÁFA Bevallás Modul

**Status:** Decided

**Category:** Accounty & Integrált Modulok

**Question:** Hogyan támogatja a rendszer az ÁFA bevallás készítését?

**Decision:**
- ÁFA bevallás oldal a fő app-ban: `VatReturnPage` (`/:companyId/:dateRange/vat-return/:tab?`)
- Tab-ok: Összesítő, Bejövő, Kimenő, Bevallás
- Automatikus ÁFA kiszámítás a NAV számlaadatokból és manuálisan rögzített számlákból
- Bevallás draft generálás a kiszámított értékekből
- ÁFA kulcsok kezelése: 27%, 18%, 5%, TAM, AAM, mentes
- Összesítés: Fizetendő ÁFA − Levonható ÁFA = Nettó ÁFA pozíció
- NAV XML export (2065A típusú bevallás formátum)
- Az Accounty-ból ügyfélcég kontextusban is elérhető

**Rationale:** A könyvelők legfontosabb ismétlődő feladata az ÁFA bevallás. Az automatikus számítás a NAV adatokból és a rendszerbe rögzített számlákból drasztikusan csökkenti a manuális munkát. A bevallás draft az utolsó ellenőrzés lehetőségét biztosítja mielőtt benyújtásra kerülne.
