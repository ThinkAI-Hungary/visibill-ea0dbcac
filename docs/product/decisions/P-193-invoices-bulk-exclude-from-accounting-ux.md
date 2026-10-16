# P-193: Számlák Csoportos Könyvelési Kizárása és Visszaállítása UX

**Status:** Decided  
**Category:** UI / Workflow  
**Date:** 2026-10-15  
**Utoljára frissítve:** 2026-10-15  

---

## 📱 Context & Question
Amikor a felhasználó vagy könyvelő a Számlák nézetben (`/invoices`) kijelöl több számlát (pipálgatással vagy az „Összes kijelölése” funkcióval), a képernyő alján megjelenő lebegő akciósávban (`InvoiceBulkActionsBar`) szükség van arra, hogy csoportosan is megjelölhesse őket könyvelésből kizártként („Nem könyvelem”), illetve visszavehesse őket a könyvelésbe.

Hogyan jelenjen meg ez az opció a lebegő sávban, milyen opciókat kínáljon, és milyen megerősítési lépések szükségesek a zökkenőmentes használathoz?

---

## 💡 Decision

### 1. Lebegő Akciósáv Dropdown Menü (`Nem könyvelem ▾` / `Kizárva ▾`)
Az `InvoiceBulkActionsBar` jobb oldali műveletcsoportjában egy lebegő Radix DropdownMenu gomb jelenik meg `Ban` (tiltás) ikonnal:
- **Dinamikus Címke és Állapot:**
  - Ha az összes kijelölt számla már ki van zárva: a gomb címkéje `Kizárva ▾`, és narancssárga/borostyán kiemelést kap.
  - Egyéb esetben a címke `Nem könyvelem ▾`.
- **Drop-down Menüpontok:**
  1. **Végleges kizárás (Nem könyvelem):** Azonnali, optimista kizárás (`exclusion_type = 'PERMANENT'`), dialógus nélkül lefut.
  2. **Kérdéses számla (Halasztott ÁFA)...:** Megnyitja a `BulkExclusionDialog` ablakot, amely lehetővé teszi indoklás megadását.
  3. **Könyvelésbe visszaállítás:** Amennyiben a kijelöltek között van legalább egy már kizárt számla, megjelenik a menüben egy zöld/menta színű visszaállító opció, amely azonnal törli a kizárást.

### 2. Kérdéses Számla Dialógus (`BulkExclusionDialog`)
A halasztott ÁFA szerinti kizáráshoz egy letisztult modális ablak tartozik:
- **Fejléc & Jelvény:** „Csoportos számla kizárás” cím és „X számla kijelölve” számláló badge.
- **Törvényi Figyelmeztető Sáv:** Információ az Áfa tv. szerinti 2 éves jogvesztő határidőről és a kérdéses számlák listájába való bekerülésről.
- **Indoklás Mező:** Többsoros szövegmező az elhalasztás okának rögzítésére (pl. „Teljesítésigazolás hiányzik”).
- **Akciógombok:** „Mégse” és „Mentés (Kérdéses státuszba)”.

### 3. Rétegzettségi Szabályozás és Modális Ablak Ütközésvédelem (Modal Collision Evasion)
- **Konzisztens Z-Index Hierarchia:** A lebegő műveleti sáv (`FloatingBulkBar`) a ragadós táblázatfejlécek (`z-10`..`z-30`) fölött, de a modális ablakok, sheet-ek és dialógus overlayek (`z-50`) alatt helyezkedik el (`z-40`). A sávhoz tartozó legördülő menük és popoverek `z-50` szinten jelennek meg.
- **Modális Ütközésvédelem (`isAnyModalOpen`):** Amennyiben bármilyen modális ablak vagy dialógus nyitva van a felületen (pl. `BulkExclusionDialog`, `InvoiceItemsDialog`, vagy bármely `[role="dialog"]` elem), az `InvoiceBulkActionsBar` azonnal leiratkozik a DOM-ból (`return null`), megelőzve, hogy a képernyő alján lebegő sáv elfedje a felugró ablak tartalmait, mentési gombjait, vagy zavarja a kurzorfókuszt.
- **Fókuszkeret-mentesség:** A lebegő sáv gombjai követik a `[outline:none!important] [box-shadow:none!important]` szabványt, így kattintás után sem ragad be fekete/kék fókuszkeret.

---

## ⚡ Consequences

### Rationale
- **Kompakt kialakítás:** A dropdown menü gomb megakadályozza, hogy a lebegő akciósáv túlzsúfolttá váljon vagy kilógjon kisebb kijelzőkön.
- **Gyors és pontos:** A végleges kizárás 1 kattintás, a halasztott ÁFA indoklással ellátott, az elévülés pedig automatikusan követhető a Dashboardon és az ÁFA analitikában.

---

## 🔗 Kapcsolódó
- **ADR:** [A-261: Csoportos Számla Könyvelési Kizárás Atomi RPC és Reaktivitás](../../architecture/decisions/A-261-bulk-invoice-accounting-exclusion-rpc-and-cache-invalidation.md)
- **PRD:** [P-015: Tömeges műveletek lebegő műveleti sáv](./P-015-bulk-actions.md)
- **PRD:** [P-172: ÁFA Levonásba Helyezés Halasztása és Kérdéses Számlák UX](./P-172-deferred-vat-deduction-and-questionable-invoices-ux.md)
- **Komponensek:** `src/features/invoices/components/actions/InvoiceBulkActionsBar.tsx`, `src/features/invoices/components/dialogs/BulkExclusionDialog.tsx`
