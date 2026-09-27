# P-127: Számlák Többfüles Excel Exportja, Skontó- és Fizetési Dátum Feloldás és Banki Fül Routing UX

**Status:** Decided  
**Category:** UI / Export / Invoices  
**Date:** 2026-09-27  
**Utoljára frissítve:** 2026-09-27  

---

## 1. Question

A számlák havi zárásakor a könyvelők és a pénzügyi vezetők Excel formátumban exportálják az adott időszak számláit. A felhasználók két kritikus igényt fogalmaztak meg:
1. **Fizetési határidő és tényleges utalási dátum:** A korábbi „Fizetve: Igen/Nem” oszlop nem volt elegendő a skontó kedvezmények (korai utalási engedmények) ellenőrzéséhez, mivel nem derült ki belőle, hogy mikor történt meg a banki átutalás és mi volt az eredeti határidő.
2. **Közüzemi számlák fül-besorolása:** A 3-füles (Fizetési mód szerint bontott) exportban az MVM és egyéb közüzemi számlák a számlán lévő technikai NAV fizetési mód kód („Egyéb”) miatt az „Egyéb bizonylatok” fülre kerültek, holott a cég valójában banki átutalással egyenlítette ki őket.

---

## 2. Decision

### 1. Dátumoszlopok az Excel Exportban
Mind az összesítő, mind a tételes kontírozó export táblázatban bevezetésre került a két egyértelmű dátumoszlop:
- **„Fizetési határidő”:** A számla kibocsátója által meghatározott esedékességi nap.
- **„Fizetés dátuma”:** A számla valós kiegyenlítésének dátuma (a bankszámlakivonaton szereplő terhelési/utalási nap, vagy készpénzes bizonylat kelte; nem fizetett tétel esetén „—”).

### 2. Intelligens Banki Fül-Besorolás
A „Fizetési mód szerint bontva (3 fül)” export generálásakor a rendszer:
- Nemcsak a számla szöveges fejlécét vizsgálja, hanem azt is, hogy kapcsolódik-e hozzá banki tranzakció.
- Amennyiben a számlához bankkivonat / átutalási tranzakció van párosítva, az automatikusan az **„Utalás és bankkártya”** fülre kerül.
- Támogatja a csoportos beszedés, SEPA direkt debit és egyéb banki kifejezések felismerését is.

---

## 3. Current Implementation

- Dialógus: `InvoiceDataExportDialog.tsx` → `ExportSheetLayout` választó („Egyetlen munkalap” vagy „Fizetési mód szerint bontva (3 fül)”).
- Motor: `InvoiceContext.tsx` → `handleDataExportConfirm` funkcióban aszinkron `txDateMap` feloldás és dinamikus sorképzés.
- Fejlécek: `Számlaszám | Irány | Partner neve | Adószám | Kibocsátás kelte | Teljesítés kelte | Fizetési határidő | Fizetés dátuma | Pénznem | ...`.

---

## 4. Rationale

- **Skontó megfelelés:** A könyvelő azonnal látja a két dátum közötti eltérést (pl. 2026-09-30 esedékesség vs 2026-09-21 banki utalás = 9 nappal korábbi teljesítés), igazolva a skontó kedvezmény jogosultságát.
- **Adatharmónia:** A banki kivonatokkal összeegyeztetett számlák pontosan a banki fülön jelennek meg, csökkentve az adminisztrációt és az ügyfélszolgálati hibajegyeket.

---

## 5. Kapcsolódó
- [A-168: Számla Export Banki Tranzakció Feloldás, Skontó-Dátum Architektúra és Intelligens Fül-Válogatás](../../architecture/decisions/A-168-invoice-export-transaction-resolution-and-skonto-dates.md)
- [P-058: Egységes Export & Dokumentumgeneráló Motor (DocumentEngine) UX](./P-058-unified-document-engine-ux.md)
- [P-104: Tranzakció jutalék és számlaszám exportálása](./P-104-transaction-fee-and-invoice-number-export-ux.md)
