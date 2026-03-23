

# Számla-Tranzakció & Számla-Számla Láncolat Audit Report

## Build Error Fix (Azonnali)

A `jsr:@supabase/supabase-js@2` import 5 edge function-ben nem tud feloldani egy tranzitív függőséget (`@supabase/realtime-js@2.100.0`). Megoldás: cserélni `https://esm.sh/@supabase/supabase-js@2.57.4` importra (amit a többi edge function már használ).

**Érintett fájlok:**
- `supabase/functions/nav-token/index.ts`
- `supabase/functions/save-credentials/index.ts`
- `supabase/functions/query-nav-invoices/index.ts`
- `supabase/functions/nav-sync/index.ts`
- `supabase/functions/join-company/index.ts`

---

## 1. Számla-Tranzakció Dinamika — AUDIT EREDMÉNY

### Relációs térkép

```text
transactions.id ──────────────────────────────────────────┐
  │                                                        │
  ├─ transactions.matched_invoice_id ──► invoices.id       │
  │                                    nav_invoices.id     │
  │                                    salary.id           │
  │                                                        │
  ├─ invoices.transaction_id ──────────► transactions.id   │ ON DELETE SET NULL ✓
  ├─ nav_invoices.transaction_id ──────► transactions.id   │ ON DELETE SET NULL ✓
  └─ salary.transaction_id ───────────► transactions.id    │ ON DELETE SET NULL ✓
```

### Forward Integrity (Tranzakció → Számla) — OK
- `ON DELETE SET NULL` minden FK-n (`invoices`, `nav_invoices`, `salary` → `transactions.id`)
- Trigger `reset_paid_on_transaction_delete`: ha tranzakció törlődik, a kapcsolt `nav_invoices.paid = false`, `nav_invoices.transaction_id = NULL`, `invoices.transaction_id = NULL`, `salary.transaction_id = NULL`
- Trigger `reset_paid_on_transaction_unmatch`: ha `matched_invoice_id` NULL-ra áll, ugyanez

### Backward Integrity (Számla → Tranzakció) — OK
- Trigger `clear_transaction_match_on_invoice_delete`: ha beküldött számla törlődik, a kapcsolt `transactions.matched_invoice_id = NULL`, `is_verified = false`
- Trigger `mark_nav_invoice_paid_on_transaction_match`: ha tranzakció `matched_invoice_id` beáll, automatikusan beállítja a `transaction_id`-t a számlákon

### Computed Status a Frontenden — HELYES
- `useComputedStatus.ts` → `computePaymentStatus(transactionId)` — kizárólag `transaction_id IS NOT NULL` alapján
- `getPaymentStatusBadge()` → zöld "Fizetve" / sárga "Nyitott"
- A frontend **sehol sem használja** a `fizetve` boolean mezőt (0 találat)
- A `paid` mező csak szűrőparaméterként használatos, és az RPC (`get_filtered_nav_invoices`) is `transaction_id IS NOT NULL`-ot vizsgál

### Maradék `paid` boolean — TISZTÍTANDÓ (alacsony prioritás)
A `nav_invoices.paid` boolean mező továbbra is létezik és a triggerek (`mark_nav_invoice_paid_on_transaction_match`, `reset_paid_on_transaction_delete`) még írják. Ez redundáns — a `transaction_id` az igazság forrása. A `paid` mező eltávolítása lehetséges, de nem kritikus, mert a frontend nem használja döntésre.

---

## 2. Számla-Számla Láncolat — AUDIT EREDMÉNY

### Láncolási mechanizmus

```text
invoices.reference_number ──► invoices.bizonylatsorszam
          (gyerek)                    (szülő)

Példa lánc:
  Díjbekérő (E-THINK-2025-85)
    └─ reference_number: null
  Előlegszámla (E-THINK-2025-86)
    └─ reference_number: "E-THINK-2025-85"  ──► szülő
  Végszámla (E-THINK-2025-87)
    └─ reference_number: "E-THINK-2025-86"  ──► szülő
```

### Struktúra
- **Nincs külön kapcsolótábla** — a `reference_number` mező tartalmazza a szülő `bizonylatsorszam` értékét
- **1:N** reláció: egy számlának egy szülője (`reference_number`) és tetszőleges számú gyereke lehet
- **Rekurzív CTE** a DB-ben: `get_linked_invoices()` RPC — max 20 szint mélységig, mindkét irányba keres
- **Frontend traversal**: `getLinkedInvoices()` az `InvoicesPage.tsx`-ben (~230-258. sor) — iteratív BFS szülők és gyerekek felé

### Törlés hatása a láncra — RÉSZBEN KEZELT
- Ha a lánc közepén lévő bizonylatot töröljük, a szomszédos bizonylatok **nem tudják**, hogy a lánc megszakadt
- **Viszont**: a frontend `ExpandedInvoiceRow.tsx` tartalmaz "Megszakadt láncolat" (`hasBrokenChain`) figyelmeztetést — ha a `reference_number` létezik, de nincs hozzá tartozó bizonylat, sárga warning jelenik meg
- A `get_linked_invoices` RPC egyszerűen nem találja meg a hiányzó elemet — a lánc a törött pontnál végződik, de nincs hiba

### Nincs kaszkád törlési trigger a láncolatra — ELFOGADHATÓ
A láncolat nem FK-alapú (soft reference: szöveg egyezés), tehát nincs `ON DELETE CASCADE` lehetőség. A jelenlegi "broken chain warning" megoldás megfelelő.

---

## 3. Vizuális Renderelés & Reaktivitás

### Frissülés mechanizmusa
- **Nem Realtime**: a kapcsolt bizonylatok frissülése query invalidation-nel történik (`invalidateInvoiceData`), nem Supabase Realtime-mal
- Ha egy hivatkozott bizonylat kifizetetté válik, a szülő nézete **nem frissül automatikusan** — csak oldalújratöltéssel vagy manuális szinkronizálással
- A `LiveNotificationProvider` létezik, de a számlák láncolatát nem figyeli

### Performance — ELFOGADHATÓ
- `linkedInvoicesMap` (useMemo) + `getLinkedInvoices()` (BFS) minden lenyitásnál fut
- A `linkedInvoicesPool` query egyszer fut a dátumtartományra, és a `getLinkedInvoices` ebből a pool-ból dolgozik — nem indít új query-t
- `ExpandedInvoiceRow` nincs `React.memo`-val burkolva, de az accordion pattern (csak lenyitott sorok renderelődnek) limitálja a hatást

---

## 4. Kritikus Hiba Keresés — EREDMÉNY

### Manuális státusz-állítás maradványai
A `nav_invoices.paid` boolean mező még triggerekkel íródik, de a **frontend kizárólag `transaction_id`-t használ**. Ez nem hiba, csak redundancia.

### Tényleges hiba: NINCS
A rendszer teljes egészében Computed Status alapú. Nincs olyan hely a frontenden, ahol manuálisan kellene átírni a státuszt.

---

## Összefoglaló & Javítási Terv

| # | Feladat | Prioritás | Fájlok |
|---|---------|-----------|--------|
| 1 | **Build error fix**: `jsr:` → `esm.sh` import 5 edge function-ben | KRITIKUS | 5 edge function |
| 2 | `nav_invoices.paid` boolean mező deprecálása (triggerekből eltávolítás, mező törlés) | ALACSONY | DB migráció |
| 3 | `ExpandedInvoiceRow` React.memo burkolás | ALACSONY | 1 fájl |

### Nem szükséges javítani
- Számla-tranzakció forward/backward integrity — teljesen működik triggerekkel
- Számla-láncolat logika — helyes, broken chain warning megvan
- Computed Status — konzisztens, nincs manuális státusz a frontenden
- Kaszkád törlés a láncolatra — a soft reference + broken chain warning elegendő

