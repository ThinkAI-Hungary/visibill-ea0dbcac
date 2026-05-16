# P-013: Feltöltés UX

**Status:** Decided  
**Category:** Számla Kezelés

**Question:** Hogyan működik a dokumentum feltöltés?

**Decision:** Multi-file batch upload progress bar-ral.

**Current Implementation:**
- ManualUpload.tsx — drag & drop + fájlválasztó
- document_category választás: invoice / payroll
- Támogatott formátumok: PDF, JPG, PNG
- UploadHistory komponens: korábbi feltöltések státusza

**TODO:**
- Multi-file batch upload implementálás (10-20 fájl egyszerre)
- Per-file progress bar
- Per-file hiba kezelés (melyik fájl bukott, melyik sikeres)

**Rationale:** A cégvezetők gyakran több számlát kapnak egyszerre (havi szállítói csoport). Batch upload jelentősen csökkenti a manuális munkát. A per-file progress és hiba kezelés átláthatóvá teszi a folyamatot.
