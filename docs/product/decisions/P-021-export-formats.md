# P-021: Export Formátumok

**Status:** Decided  
**Category:** Főkönyv & Riportok

**Question:** Milyen formátumokban exportálhatóak az adatok?

**Decision:** CSV + PDF export. Excel (xlsx) nem prioritás.

**TODO:**
- CSV export: számlák, tranzakciók, főkönyv, beszámoló adatok
- PDF export: formázott, brandelt dokumentumok (számla lista, beszámoló, P&L, mérleg)
- PDF generálás Edge Function-ben (headless browser vagy template engine)

**Rationale:** CSV lefedi a gépi feldolgozás igényt (könyvelők, import más rendszerbe). PDF lefedi a nyomtatás és megosztás igényt (ügyfelek, hatóságok). Excel natív export alacsony prioritás — a CSV Excelben megnyitható.
