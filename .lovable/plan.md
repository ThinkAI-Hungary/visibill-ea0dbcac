

## Kapcsolt bizonylatok kezelése - `reference_number` oszlop

### Koncepció

Egyetértek az megközelítéssel. A `reference_number` mező egyszerű, hatékony megoldás a kapcsolt bizonylatok láncolására. Az n8n AI feldolgozás kitölti, a frontend pedig megjeleníti a kapcsolódó számlákat.

### Kapcsolati lánc példa

```text
D-THINK-84 (díjbekérő)          ← reference_number: NULL
  └─ E-THINK-2025-85 (előleg)   ← reference_number: "D-THINK-84"
      └─ E-THINK-2026-11 (végsz) ← reference_number: "E-THINK-2025-85"

STOR-001 (stornó)                ← reference_number: "ORIG-001"
ORIG-001 (eredeti)               ← reference_number: NULL

MOD-001 (helyesbítő)            ← reference_number: "ORIG-002"
```

### 1. Adatbázis migráció

Új oszlop az `invoices` táblán:

```sql
ALTER TABLE invoices ADD COLUMN reference_number TEXT;
CREATE INDEX idx_invoices_reference_number ON invoices(reference_number);
CREATE INDEX idx_invoices_bizonylatsorszam_company 
  ON invoices(bizonylatsorszam, company_id);
```

- `reference_number`: annak a számlának a `bizonylatsorszam`-a, amire hivatkozik
- Indexek a gyors kereső lekérdezésekhez

### 2. Frontend - Kapcsolt számlák lekérdezése

Az `InvoicesPage.tsx`-ben, amikor egy sort lenyitunk, kétirányú keresés:

```sql
-- Akiket ÉN hivatkozok (pl. a díjbekérő, amire az előlegszámla hivatkozik)
SELECT * FROM invoices 
WHERE bizonylatsorszam = current_invoice.reference_number 
  AND company_id = ?

-- Akik ENGEM hivatkoznak (pl. az előlegszámla, ami rám hivatkozik)
SELECT * FROM invoices 
WHERE reference_number = current_invoice.bizonylatsorszam 
  AND company_id = ?
```

### 3. Frontend - Megjelenítés

Az `ExpandedInvoiceRow` komponensben új szekció: **"Kapcsolt bizonylatok"**, amely megjeleníti:
- A hivatkozott számlát (ha van `reference_number`)
- Az erre hivatkozó számlákat (akik erre a számlára mutatnak)
- Típus badge-ek: Díjbekérő → Előlegszámla → Végszámla / Stornó / Helyesbítő

### 4. N8N oldal (nem Lovable változás)

Az n8n invoice processing workflow-ban az AI-nak ki kell nyernie a hivatkozott számlaszámot és a `reference_number` mezőbe írnia. Ez nem igényel kódváltozást a Lovable oldalon, csak az n8n flow frissítését.

### Érintett fájlok

| Fájl | Változás |
|------|----------|
| SQL migráció | `reference_number` oszlop + indexek |
| `src/pages/InvoicesPage.tsx` | Kapcsolt számlák lekérdezése lenyitáskor |
| `src/components/ExpandedInvoiceRow.tsx` | Új "Kapcsolt bizonylatok" szekció |
| `src/types/invoices.ts` | `reference_number` mező hozzáadása a típusokhoz |

### Megjegyzés

A meglévő `elolegszamla_hivatkozas` mező az `invoices` táblában már létezik, de szabadszöveges és nem strukturált. Az új `reference_number` mező tisztán a bizonylatsorszámot tartalmazza, ami lehetővé teszi az automatikus összekulcsolást.

