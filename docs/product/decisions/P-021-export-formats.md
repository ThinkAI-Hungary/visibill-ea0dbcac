# P-021: Export Formátumok & Számlák Adat-exportáló Dialógus

**Status:** Decided  
**Category:** Számlák, Főkönyv & Riportok  
**Utoljára frissítve:** 2026-07-28

**Decision:**
1. **Adat-exportáló Dialógus (`InvoiceDataExportDialog`):** A Számlák menüben az Export gombokra (CSV, XLSX, PDF) kattintva interaktív dialógus jelenik meg.
2. **Előzetes kijelölés átvétele:** Ha a felhasználó a főtáblázatban már kijelölt számlákat (checkbox selection), a modal automatikusan azokkal megnyílik (`initialSelectedIds`), és jelzi az előzetes kijelölés darabszámát.
3. **Időszakos és egyéni szűrés:** A modalban választható dátumtartomány preset (Aktuális hónap, Előző hónap, Aktuális negyedév, Előző negyedév, Egyéni dátumtartomány).
4. **Exportálási Adatszintek (`ExportLevel`):**
   - **Fejléces Összesítő (`summary`):** Számlánként 1 sor (Fejléc adatok, bruttó/nettó/ÁFA összegek CSV/XLSX esetén) vagy számlaképek kötege (PDF esetén).
   - **Tételes Kontírozott NAV Audit (`itemized_posting`):**
     - **CSV / XLSX:** Tételenkénti kontírozási adatsorok a `invoice_items` / `nav_invoice_items` táblákból, tartalmazva a tételek megnevezését, mennyiségét, egységárát, nettó/ÁFA/bruttó értékeit, valamint a Tartozik (T - pl. 5110/3110) és Követel (K - pl. 4540/9110) főkönyvi számlaszámokat.
     - **PDF:** Minden számlakép (PDF/kép) mögé a worker automatikusan legyártja és hozzáfűzi annak 1 oldalas A4-es **Kontírozó Lapját** (bizonylat részletező, főkönyvi adatok és tételes bontás).
5. **Modálon belüli keresés és ki- / kijelölés:** Keresőmezővel és tömeges "Mindet kijelöl" / "Kijelölés törlése" gombokkal tetszőlegesen módosítható a kijelölés az exportálás előtt.
6. **Támogatott formátumok:**
   - **CSV (`.csv`):** UTF-8 BOM, pontosvesszővel elválasztott gépi feldolgozású adatfájl.
   - **Excel (`.xlsx`):** SheetJS dinamikus importtal generált, autó-méretezett oszlopokkal ellátott munkafüzet.
   - **PDF (`.pdf`):** PGMQ Worker pipeline által generált kötegelt PDF export, opcionális Kontírozó lap hozzáfűzéssel (lásd [A-028](../../architecture/decisions/A-028-pdf-export-lifecycle.md) és [P-045](./P-045-pdf-export-ux.md)).

---

## Kapcsolódó Fájlok

- `src/components/invoices/InvoiceDataExportDialog.tsx` — Interaktív exportáló modal
- `src/pages/InvoicesPage.tsx` — Számlák oldal integráció
- `src/lib/exportUtils.ts` & `src/lib/exportCsv.ts` — CSV & XLSX exportáló segédmodulok
- `src/hooks/usePdfExport.ts` — PDF exportáló hook
- `worker/pdf_export_processor.py` — Python worker PDF & Kontírozó lap generáló pipeline

