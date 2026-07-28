# P-021: Export Formátumok & Számlák Adat-exportáló Dialógus

**Status:** Decided  
**Category:** Számlák, Főkönyv & Riportok  
**Utoljára frissítve:** 2026-07-22

**Decision:**
1. **Adat-exportáló Dialógus (`InvoiceDataExportDialog`):** A Számlák menüben az Export CSV / XLSX gombokra kattintva interaktív dialógus jelenik meg.
2. **Előzetes kijelölés átvétele:** Ha a felhasználó a főtáblázatban már kijelölt számlákat (checkbox selection), a modal automatikusan azokkal megnyílik (`initialSelectedIds`), és jelzi az előzetes kijelölés darabszámát.
3. **Időszakos és egyéni szűrés:** A modalban választható dátumtartomány preset (Aktuális hónap, Előző hónap, Aktuális negyedév, Előző negyedév, Egyéni dátumtartomány).
4. **Modálon belüli keresés és ki- / kijelölés:** Keresőmezővel és tömeges "Mindet kijelöl" / "Kijelölés törlése" gombokkal tetszőlegesen módosítható a kijelölés az exportálás előtt.
5. **Támogatott formátumok:**
   - **CSV (`.csv`):** UTF-8 BOM, pontosvesszővel elválasztott gépi feldolgozású adatfájl.
   - **Excel (`.xlsx`):** SheetJS dinamikus importtal generált, autó-méretezett oszlopokkal ellátott munkafüzet.
   - **PDF (`.pdf`):** Kötegelt számlaképek összevonása (PGMQ Worker pipeline, lásd [A-028](../../architecture/decisions/A-028-pdf-export-lifecycle.md) és [P-045](./P-045-pdf-export-ux.md)).

---

## Kapcsolódó Fájlok

- `src/components/invoices/InvoiceDataExportDialog.tsx` — Interaktív exportáló modal
- `src/pages/InvoicesPage.tsx` — Számlák oldal integráció
- `src/lib/exportUtils.ts` — CSV & XLSX exportáló segédmodul
- `src/hooks/usePdfExport.ts` — PDF exportáló hook
