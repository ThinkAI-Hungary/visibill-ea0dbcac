# P-089: Számla Könyvelési Kizárás ("Nem könyvelt") Optimista Kapcsoló és Zökkenőmentes UX

**Status:** Decided  
**Date:** 2026-09-16  
**Category:** UI / UX / Invoices / Table Interaction / Performance  
**Érintett komponensek:** `InvoiceTableContainer.tsx`, `NavInvoiceRow.tsx`, `SubmittedInvoiceRow.tsx`, `ExpandedInvoiceRow.tsx`  
**Kapcsolódó döntések:** [P-010: Számlalista UX](./P-010-invoice-list.md), [P-057: Számla Feature Szelet UX](./P-057-invoices-feature-slice-ux.md), [A-122: Nem Könyvelt Szinkron és Optimista UI](../../architecture/decisions/A-122-exclude-from-accounting-sync-and-optimistic-ui.md), [BRD 045: Számla Feature Szelet](../../business/decisions/045-invoices-feature-slice.md)

---

## Question

Hogyan tehetjük lehetővé a felhasználó számára a számlák „Nem könyvelt” (`exclude_from_accounting`) státuszának soronkénti vagy kibontott sori átkapcsolását anélkül, hogy a táblázat villogna, újratöltene, elveszítené a görgetési pozíciót és ugrálna a képernyőn?

---

## Decision

1. **Optimista Állapotkezelés (Optimistic Local UI State):**
   - Amikor a felhasználó a sorban vagy a kártyán a „Nem kerül könyvelésre” kapcsolóra kattint, a komponens lokális állapota azonnal átfordul (zöld/szürke pipa és felirat átváltása 0ms késleltetéssel).
2. **Nem-destruktív Háttérszinkronizáció:**
   - Ahelyett, hogy a kapcsoló meghívná a `refetch()` függvényt (ami a teljes táblázatot újra lekérte a szerverről és újrarajzolta a DOM-ot), a mutáció csendben lefut a háttérben.
   - Megmarad az aktuális lapozási oldal (pl. 3. oldal), a megnyitott/lenyitott sorok állapota és a precíz függőleges görgetési pozíció.
3. **Rollback Hiba Kezelés:**
   - Amennyiben a hálózati kérés sikertelen, a rendszer toast üzenetben értesíti a felhasználót, és finoman visszafordítja a kapcsoló helyi állapotát az eredetire.

---

## Current Implementation

- `InvoiceTableContainer.tsx` kezeli az optimista számla állapotokat.
- `NavInvoiceRow.tsx` és `SubmittedInvoiceRow.tsx` gombjai a helyi átadott callback-et hívják, megakadályozva az oldalugrást.

---

## Rationale

A felhasználók gyakran tömegesen, egymás után több magánjellegű számlát jelölnek meg a táblázatban. Ha minden egyes kattintáskor újratölt az oldal és visszaugrik a tetejére, az tönkreteszi a felhasználói élményt és frusztrációt okoz. Az optimista UI folyékony és megbízható élményt biztosít.
