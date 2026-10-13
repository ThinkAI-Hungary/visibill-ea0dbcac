# P-183: Házipénztári Utólagos Számla-hozzárendelés és Leválasztás UX

**Status:** Decided  
**Category:** UI / Workflow / Petty Cash  
**Date:** 2026-10-12  

---

## Question
Hogyan tegyük lehetővé a könyvelők és pénztárosok számára a Házipénztár tétellistájában, hogy a korábban önállóan rögzített készpénzes kiadásokhoz vagy bevételekhez utólag, minimális kattintással hozzá tudjanak rendelni egy nyitott számlát, illetve meglévő kapcsolat esetén azt biztonságosan le tudják választani?

---

## Decision

### 1. „Számla hozzárendelése” gomb a lenyitott sorban (`ExpandedEntryRow`)
* Ha a pénztári tételhez még nem tartozik bizonylat (`!sourceTable || !sourceId`), a sor lenyitásakor egy informatív, világos kártya jelenik meg:
  * Bal oldalon egy diszkrét dőlt tájékoztató szöveg: *„Kézzel rögzített önálló pénztári tétel (nem kapcsolódik számlához)”*.
  * Jobb oldalon egy szaggatott keretes, kék akciógomb: **„Számla hozzárendelése”** (`FileText` ikonnal).
* A gombra kattintva azonnal megnyílik az `AttachInvoiceDialog` modális ablak.

### 2. Intelligens Kereső és Számlaválasztó Modál (`AttachInvoiceDialog`)
* **Irány szerinti szűrők (Tabs / Badges):**
  * Összes számla
  * Bejövő számlák (Szállítók) — számláló badge-dzsel
  * Kimenő számlák (Vevők) — számláló badge-dzsel
* **Intelligens Auto-Match kiemelés:**
  * Ha a listában található olyan nyitott számla, amelynek bruttó végösszege pontosan megegyezik a pénztári tétel összegével, a rendszer ezt automatikusan a lista legelejére rendezi, kék kiemeléssel és *„Javasolt egyezőség”* jelzéssel látja el, valamint alapértelmezetten kijelöli.
* **Gyorskereső:** Bizonylatszám, partnernév vagy összeg alapján valós idejű gépelés közbeni szűrés.
* **Státusz jelzések:** Késedelmes fizetés esetén piros dátum és *„Lejárt”* figyelmeztetés jelenik meg.

### 3. „Leválasztás” Akció és Megerősítő Dialógus
* Ha a lenyitott tétel számlához kapcsolódik, a kártya fejlécében megjelenik egy szolid, piros hover-effektussal ellátott **„Leválasztás”** gomb (`Unlink` ikonnal).
* A gomb megnyomásakor egy `AlertDialog` figyelmezteti a felhasználót:
  * *„Biztosan leválasztod ezt a számlát a pénztári tételről? A számla újra kifizetetlen nyitott státuszba kerül.”*
* Jóváhagyás után a számla azonnal visszanyílik, a pénztári tétel pedig visszaáll önálló státuszba.

---

## Current Implementation
* **Komponens:** [AttachInvoiceDialog.tsx](file:///c:/Users/adetw/.antigravity/visibill/visibill-709fffdf/src/components/petty-cash/AttachInvoiceDialog.tsx)
* **Integrációs felület:** [EntriesTab.tsx](file:///c:/Users/adetw/.antigravity/visibill/visibill-709fffdf/src/components/petty-cash/EntriesTab.tsx#L1310-L1565)
* **Lokalizáció:** `src/locales/hu/pettyCash.json` és `src/locales/hr/pettyCash.json` (`details.attach_invoice`, `details.unlink_invoice`, `toasts.attach_success_title`, stb.)
* **Egységtesztek:** [attachInvoice.test.ts](file:///c:/Users/adetw/.antigravity/visibill/visibill-709fffdf/src/test/petty-cash/attachInvoice.test.ts)

---

## Rationale
A könyvelési gyakorlatban a készpénzes számlák rögzítése és a tényleges pénztárbizonylat felvitele gyakran időben elválik egymástól. Az utólagos hozzárendelés és visszavonhatóság megszünteti a tévesen duplikált vagy beragadt kifizetetlen tételeket, anélkül, hogy a felhasználónak törölnie és újra kellene rögzítenie a pénztári bizonylatot.

---

## Kapcsolódó
* [A-249: Házipénztári Utólagos Számla-hozzárendelés és Leválasztás Atomi RPC Architektúra](../../architecture/decisions/A-249-petty-cash-invoice-linking-and-unlinking-atomic-rpcs.md)
* [070: Házipénztári Kézi Tételek és Számlák Összerendelésének Számviteli Szabályzata](../../business/decisions/070-petty-cash-invoice-settlement-and-unlink-policy.md)
* [P-092: Házipénztár Bizonylat Validáció és Számlakiegyenlítés UX](./P-092-petty-cash-manual-entry-validation-and-settlement-ux.md)
* [P-115: Házipénztár Szállítói Számlák Kiegyenlítése és Időszaki Zárás UX](./P-115-petty-cash-inbound-settlement-and-period-closing-ux.md)
