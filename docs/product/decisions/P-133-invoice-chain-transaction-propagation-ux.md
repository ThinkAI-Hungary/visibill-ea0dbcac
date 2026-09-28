# P-133: Számlalánc és Díjbekérő Tranzakció-örökítés és Zöld Státusz UX

**Status:** Decided  
**Date:** 2026-09-28  
**Utoljára frissítve:** 2026-09-29  
**Category:** UI / Workflow / Matching  
**Question:** Hogyan jelenjen meg a számlák táblázatában és a tranzakció-keresőben, ha egy díjbekérőre érkezett banki utalás a NAV-ból később beérkező végszámlát is kiegyenlíti?  
**Decision:**
1. A NAV számla sora nem maradhat piros ("Nyitott"), hanem automatikusan megkapja a zöld ("Párosítva") státuszt (`match_status = 'matched'`), és a fizetett összeg a teljes bruttó összegre áll be (`paid_amount = invoice_gross_amount`).
2. A kibontott sorban a felhasználó számára egyértelműen látható a láncolt bizonylat (pl. a kapcsolt díjbekérő sorszáma: `D-THINK-144`), és a kapcsolt tranzakciók listájában közvetlenül megjelenik az átörökített banki tranzakció.
3. A kézi tranzakció-párosító modálban a már láncolt tranzakció nem tűnik el a választható tételek közül, így a könyvelő szükség esetén ellenőrizheti vagy módosíthatja a hozzárendelést.
4. **Irányfüggő Partner-izoláció (2026-09-29):** A bejövő (szállítói) számláknál a rendszer szigorúan a szállító partner adószámát és nevét ellenőrzi az összeg és időablak mellett. Ezzel kizárható, hogy azonos összegű (pl. 160 000 Ft) eltérő szállítói számlák véletlenül egymás banki tranzakcióját örökölve váltsanak zöldre és tűnjenek el a kifizetendő tételek közül.  
**Current Implementation:**
- `src/features/invoices/utils/invoiceRelations.ts`: Kétirányú proforma és tranzakciós híd relációk (`buildNavToSubmittedMap`, `buildSubmittedToNavMap`).
- `src/features/invoices/components/table/NavInvoiceRow.tsx` & `SubmittedInvoiceRow.tsx`: A lenyíló sor kibővített `allTxMap` leképezése, amely a láncolt bizonylat tranzakcióit is megjeleníti.
- `src/hooks/useTransactionMatcher.ts`: Kézi párosító szűrő, amely engedélyezi a számlához és láncolathoz kapcsolt tranzakciók megjelenítését.  
**Rationale:**
A könyvelők és vállalkozók számára félrevezető és zavaró volt, hogy míg a banki utalás a díjbekérőre megtörtént, a NAV-ból érkező számla "Nyitott" / piros státusszal szerepelt a számlalistában. Ez téves fizetési felszólításokhoz és felesleges kézi egyeztetésekhez vezetett. A tranzakció automatikus továbbörökítésével a felület hűen tükrözi a valós pénzügyi helyzetet: a számla kiegyenlített.

## Kapcsolódó
- [A-173: Számlalánc Tranzakció-örökítés és PostgreSQL Propagáció](../../architecture/decisions/A-173-invoice-chain-transaction-propagation.md)
- [P-018: Manuális Párosítás Felülírás és ML Tanulás](./P-018-manual-matching.md)
- [P-111: Számlaláncolatok Megjelenítése és Dokumentum Lapozó](./P-111-invoice-chain-and-multi-document-preview-ux.md)
