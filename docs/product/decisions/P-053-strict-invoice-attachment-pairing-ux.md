# P-053: Szigorított Számlakép Előnézet és Párosítás UX (Strict Invoice Attachment Pairing)

**Status:** Decided  
**Category:** UI / Workflow / Matching  
**Question:** Hogyan jelenjen meg a felületen a feltöltött számlakép előnézete és a "Párosított" státusz, ha a feltöltött bizonylat sorszáma egyezik, de a partner adószáma, neve vagy összege eltér a NAV rekordtól?  
**Decision:** A felület **kizárólag akkor köti össze** a feltöltött számlát a NAV sorral, és csak akkor jeleníti meg a számlakép ikont és a "Párosított" jelölést, ha a számla bizonylatsorszáma mellett a partner adószáma (vagy normalizált neve + összege) is igazolja az összetartozást.  
**Current Implementation:** Az [InvoicesPage.tsx](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/pages/InvoicesPage.tsx) a [invoiceMatchingUtils.ts](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/lib/invoiceMatchingUtils.ts) modulon keresztül szűri a `navToSubmittedMap`, `submittedToNavMap` és `exportableInvoices` összerendeléseit.  
**Rationale:** Ha a párosítás kizárólag sorszámra támaszkodna, az azonos sorszámot használó különböző cégek vagy rövid sorszámok (`1`, `10`) esetén idegen bizonylatok számlaképe nyílna meg a felhasználó előtt, megtévesztő könyvelési adatokat mutatva.  

## UX Viselkedés a Felületen

1. **Egyező sorszám + Egyező Partner/Összeg (pl. METAL ZONE Kft. `1975/26`):**
   - A NAV táblázat sorában megjelenik a PDF csatolmány ikon.
   - A lenyitható sormodálban a "Párosított NAV számla" szekció aktív, zöld "Párosított" badge-dzsel.
   - Rákattintva a dokumentum előnézetben a valós, hozzá tartozó számlakép nyílik meg.

2. **Egyező sorszám + Eltérő Partner/Összeg (pl. Durasnaz vs. AD-LAK `0057/26` ütközés):**
   - A NAV táblázat sorában **NEM jelenik meg** a téves csatolmány ikon.
   - A számla nem kap téves "Párosított" jelölést.
   - A feltöltött számla a "Feltöltött számlák" (Submitted) fülön különálló bizonylatként marad meg.

## Kapcsolódó
- [A-054: Szigorított NAV ↔ Beküldött Számla Összerendelés](../../architecture/decisions/A-054-strict-nav-submitted-pairing.md)
- [P-010: Számla lista nézet & szűrők](./P-010-invoice-list.md)
