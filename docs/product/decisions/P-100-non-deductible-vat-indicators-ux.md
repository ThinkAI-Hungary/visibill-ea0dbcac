# P-100: Nem Levonható ÁFA Megjelenítése és Felületi Átláthatósága (1. + 2. + 3. Opció) UX

> **Státusz:** Decided  
> **Dátum:** 2026-09-20  
> **Kategória:** UI / Workflow / Accounting Transparency  
> **Érintett komponensek:** `InvoiceItemsDialog.tsx`, `NavInvoiceRow.tsx`, `SubmittedInvoiceRow.tsx`, `ExpandedInvoiceRow.tsx`, `usePageDeductibilityMap.ts`  
> **Kapcsolódó:** [ADR A-134](../../architecture/decisions/A-134-non-deductible-vat-lifecycle-and-partial-indexes.md), [PRD P-099](./P-099-official-vat-summary-ui.md), [ADR A-078](../../architecture/decisions/A-078-telecom-vat-deductibility-rules.md)  

---

## Question (Kérdés)

Hogyan biztosítsuk a nem levonható ÁFA (pl. telefonszámlák 70/30-as szabálya, szgk. lízing 50/50, reprezentáció/üzemanyag 0%) maximális átláthatóságát a bejövő számlák kezelése során anélkül, hogy a felület túlzsúfolttá válna vagy lassú N+1 lekérdezések terhelnék a rendszert?

---

## Decision (Döntés)

A felhasználói visszajelzések és a könyvelői igények alapján egy **háromszintű integrált átláthatósági modellt (1. + 2. + 3. opció)** valósítottunk meg:

### 1. Opció: Számlatételek Modál Végösszesítő Kártya
- **Helyszín:** [`InvoiceItemsDialog.tsx`](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/InvoiceItemsDialog.tsx) jobb alsó végösszesítő szekciója.
- **Működés:**
  - Ha az adott bejövő számla bármely tételének levonhatósága kisebb 100%-nál és az ÁFA összeg nagyobb mint 0 Ft, az ÁFA összeg alatt megjelenik a dedikált vizuális bontás:
    - 🟢 **Levonható ÁFA:** zöld ponttal és formázott pénzösszeggel.
    - 🟠 **Nem levonható ÁFA:** borostyánsárga ponttal, pontos összeggel és jogszabályi tooltip-pel (*"Áfa tv. szerinti levonási tiltás / hányad (pl. 70/30 telefon, szgk., reprezentáció)"*).
  - A végösszesítő azonnal, reaktívan újraszámolódik tétel módosításakor vagy a 70/30-as gomb megnyomásakor.

### 2. Opció: Számlalista Sor (NAV & Beküldött számlák)
- **Helyszín:** [`NavInvoiceRow.tsx`](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/features/invoices/components/table/NavInvoiceRow.tsx) és [`SubmittedInvoiceRow.tsx`](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/features/invoices/components/table/SubmittedInvoiceRow.tsx) ÁFA cellája.
- **Működés:**
  - Az ÁFA összeg és az ÁFA kód választó között megjelenik egy diszkrét, kompakt badge:
    - `🟠 70/30 (-528 Ft)` vagy `🟠 0% lev. (-5 029 Ft)`.
  - **Interakció:** Az elemre lebegtetve (hover) részletes magyarázó tooltip jelenik meg, feltüntetve a levonható és nem levonható összegek pontos értékét.
  - **Védelem:** A badge kattintási eseménye `e.stopPropagation()`-nal védett, megakadályozva a számlasor akaratlan kinyílását.
  - **Nem zavaró:** Kimenő (vevői) számláknál és 0 Ft ÁFA összegű tételeknél nem jelenik meg.
  - **Zéró N+1 terhelés:** A táblázat egyetlen kötegelt, indexed lekérdezéssel (`usePageDeductibilityMap`) határozza meg az oldal számláinak adatait.

### 3. Opció: Kibontott Sor (Expanded Invoice Row)
- **Helyszín:** [`ExpandedInvoiceRow.tsx`](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/features/invoices/components/expanded-row/ExpandedInvoiceRow.tsx) könyvelési szekciója.
- **Működés:**
  - A Főkönyvi számok és az ÁFA kód kártya mellett helyet kapott egy önálló **ÁFA levonhatóság** kártya:
    - Fejléc: `✨ ÁFA LEVONHATÓSÁG` bal oldalon, jobb oldalon kulcs-jelvény (`70% hányad` vagy `0% levonható`).
    - Sor 1: 🟢 Levonható ÁFA pontos összege formázva.
    - Sor 2: 🟠 Nem levonható ÁFA pontos összege formázva.
  - Amennyiben a táblázatból nem érkezik előre betöltött adat (pl. izolált nézet), a komponens önálló fallback lekérdezéssel azonnal megjeleníti az adatokat.

---

## Rationale (Indoklás)

A könyvelők számára a nem levonható ÁFA az egyik leggyakoribb adókockázati forrás. Ha a levonási tiltás rejtve marad, a számla jóváhagyásakor a könyvelő nem veszi észre az arányosítás szükségességét. 
A három szint szinergiája:
1. **A táblázat lista (2. opció)** azonnali felületi pásztázást tesz lehetővé: a könyvelő egyetlen pillantással látja az összes korlátozott számlát.
2. **A kibontott sor (3. opció)** a számla részletezésekor azonnal a könyvelési és főkönyvi adatok mellé teszi a levonhatósági adatot.
3. **A modál (1. opció)** pedig a közvetlen ellenőrzést és tétel-szintű finomhangolást szolgálja.

---

## Consequences (Következmények)

### Pozitív
- **Maximális Átláthatóság:** A felhasználónak nem kell találgatnia; mindhárom releváns felületi rétegben következetes jelölést kap.
- **Nagy Teljesítmény:** Kötegelt lekérdezések és parciális B-tree indexelés garantálja a villámgyors betöltést.
- **Reaktív Frissülés:** Bármely tétel módosítása esetén a badge, a kibontott sor és a modal azonnal frissül.
