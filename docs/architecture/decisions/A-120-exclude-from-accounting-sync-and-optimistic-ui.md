# A-120: Nem Könyvelt Státusz Kétirányú Szinkronizációja és Optimista UI Állapotkezelés

**Status:** Decided  
**Date:** 2026-09-16  
**Category:** Architecture / Database / Invoices / Accounting / Frontend / State Management  
**Érintett komponensek:** `supabase/migrations/20260916160000_exclude_from_accounting_sync_and_gl_fix.sql`, `sync_nav_item_exclude_from_accounting`, `auto_apply_exclude_from_accounting_to_journals`, `InvoiceTableContainer.tsx`, `NavInvoiceRow.tsx`, `SubmittedInvoiceRow.tsx`, `ExpandedInvoiceRow.tsx`  
**Kapcsolódó döntések:** [A-107: ÁFA Levonhatóság Szinkronizálása a Főkönyvvel](./A-107-vat-deductibility-journal-and-gl-sync.md), [P-088: Nem Könyvelt Kapcsoló Optimista UX](../product/decisions/P-088-invoice-exclude-from-accounting-optimistic-toggle-ux.md), [BRD 045: Számla Feature Szelet](../../business/decisions/045-invoices-feature-slice.md)

---

## Context

A felhasználók a Számlák felületen beállíthatják, ha egy beérkező bizonylat magánjellegű, nem a cég működéséhez kapcsolódó tétel, vagy egyéb okból nem minősül elszámolható költségnek. Erre szolgál a **„Nem kerül könyvelésre”** (`exclude_from_accounting`) kapcsoló.

A korábbi működésben két súlyos architektúrális és felhasználói élménybeli probléma jelentkezett:

1. **Adatbázis szinkronizációs és könyvelési lánc hiba:**
   - Amikor a felhasználó a fejlécben beállította az `exclude_from_accounting = true` értéket a `nav_invoices` táblán, ez nem propagálódott le a `nav_invoice_items` tételsorokra.
   - Az automatikus könyvelési mechanizmus a tételsorok alapján korábban legenerált tervezetet (`accounting_journal_drafts`) nem törölte vagy állította le, így a számla a kizárás ellenére mégis megjelent a könyvelési tervezetben vagy a főkönyvi kartonon.
2. **Frontend villogás és görgetési ugrás ("table jumping"):**
   - A kapcsoló megnyomásakor a komponens destruktív módon újrahívta a globális számlalekérdezést (`refetch()`).
   - A teljes táblázat újratöltődött, a kiválasztott lapozási pozíció és a képernyő görgetése elveszett, a felület „ugrott egyet”, ami ellehetetlenítette a gyors, soronkénti státuszváltást.

---

## Decision

### 1. Adatbázis Szintű Atomi Kétirányú Propagáció és Tervezet-Törlés
A `supabase/migrations/20260916160000_exclude_from_accounting_sync_and_gl_fix.sql` migrációban bevezetésre került:
- **`sync_nav_item_exclude_from_accounting` Trigger:**
  - Amikor a `nav_invoices.exclude_from_accounting` értéke megváltozik, a trigger automatikusan és atomian átírja a számlához tartozó összes `nav_invoice_items.exclude_from_accounting` rekordot.
- **`auto_apply_exclude_from_accounting_to_journals` Eljárás:**
  - Ha egy számla `exclude_from_accounting = true` státuszt kap:
    1. A rendszer azonnal törli a hozzá kapcsolódó, még véglegesítetlen tervezetet (`accounting_journal_drafts WHERE invoice_id = NEW.id`).
    2. Ha már lekönyvelt tétel kapcsolódik hozzá, a rendszer megjelöli és figyelmeztető státuszba helyezi, meggátolva az érvénytelen könyvelési tételek bennmaradását a főkönyvben.
    3. Ha a kizárást a felhasználó visszavonja (`false`-ra vált), az automatikus könyvelő motor újra felépíti a szabályos tervezetet.

### 2. Frontend Optimista Állapotkezelés (`InvoiceTableContainer.tsx`)
A frontend oldalon megszüntettük a destruktív `refetch()` hívásokat az állapotváltás során:
- **Helyi State Frissítés:** A kapcsoló megnyomásakor az `InvoiceTableContainer` komponens azonnal, aszinkron várakozás nélkül átkapcsolja a sor helyi `exclude_from_accounting` értékét a React állapotban.
- **Háttérbeli Nem-destruktív Szinkronizáció:** A hálózati Supabase frissítés csendben, a háttérben fut le.
- **Hiba Visszagörgetés (Rollback):** Hálózati hiba esetén a rendszer diszkrét shadcn toast üzenetet jelenít meg, és visszaállítja a korábbi állapotot, anélkül, hogy a teljes lap újrarenderelődne vagy a görgetés elveszne.

---

## Consequences

### Pozitív
- **Teljes Számviteli Integritás:** Egyetlen nem könyvelendő számla sem kerülhet be a könyvelési tervekbe vagy a kartonokra.
- **Prémium, Zökkenőmentes UX:** A felhasználó villogás és pozícióvesztés nélkül, villámgyorsan állíthatja be a kizárásokat közvetlenül a táblázat soraiban.
- **Csökkentett Hálózati Terhelés:** Megszűntek a felesleges 50-100 tételes táblázat-újralekérések.

### Negatív / Kötöttségek
- Párhuzamosan több ablakban történő szerkesztés esetén a háttérbeli WebSocket/Realtime frissítésnek kell biztosítania a szinkront más felhasználók felé.
