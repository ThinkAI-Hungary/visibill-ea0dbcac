# P-023: In-app Értesítési Center

**Status:** Decided  
**Category:** Értesítések & Kommunikáció  
**Utoljára frissítve:** 2026-06-24

**Question:** Kell-e dedikált értesítési center az app-ban? Hogyan garantált a toast értesítések delivery-je bárhol az appban?

**Decision:** Nincs értesítési center. Toast értesítések 3 rétegű, skálázható architektúrával — globálisan, bármely oldalon megjelennek.

**Current Implementation:**

### Réteg 1 — Supabase Realtime (elsődleges, push alapú)
- `LiveNotificationProvider` — `ProtectedLayout`-ban mountolva, mindig aktív
- Supabase WS channel: figyelők az összes releváns táblára (`invoice_uploads`, `invoices`, `transport_documents`, `salary`, `transactions`, `shipment_matches`, stb.)
- Client-side `company_id` szűrés (nem server-side, mert Realtime `REPLICA IDENTITY FULL` nélkül `oldRow` üres)
- Deduplikáció: `notifiedUploads` in-memory Set — cég váltáskor törlődik
- **Korlát:** WS reconnect-nél a közben keletkező events **nem replay-elődnek** → réteg 2-3 kompenzálja

### Réteg 2 — Session-scoped polling (Realtime fallback)
- `registerPendingUpload(uploadId)` — exportált függvény, hívás helye: `ManualUpload.tsx` feltöltés után
- Module-level `_pendingSessionUploads: Set<string>` — React state-en kívül, re-render-safe
- 5 másodperces `setInterval` — de **csak akkor fut le**, ha `_pendingSessionUploads.size > 0`
- Automatikusan leáll, ha minden ID terminális státuszba kerül
- **Skálázás:** O(aktív feltöltő sessionök) nem O(összes user) — 1000 usernél várhatóan 1-20 egyidejű session

### Réteg 3 — Tab focus catch-up (ritka, egyszeri)
- `handleVisibility` — `visibilitychange` event-re figyel a `LiveNotificationProvider`-ben
- Ha a user 2+ percet töltött más tab-on vagy más ablakban → `catchUpToasts()` egyszer lefut
- Lekérdezi az elmúlt 15 perc `invoice_uploads` rekordjait terminális státusszal
- Megmutatja a `notifiedUploads`-ban még nem szereplő értesítéseket
- **Skálázás:** ritka esemény, nem folyamatos DB terhelés

### Toast típusok és cache invalidálás
| Esemény | Toast | Cache keys |
|---|---|---|
| `invoices INSERT` | "Gratulálunk! Fájl feldolgozva" (3s, generic) | `submittedInvoices`, `dashboardData`, ... |
| `invoice_uploads` → `processed`/`completed` | "Számla feldolgozva! ✓" (5s) | `submittedInvoices`, `recentInvoices`, `dashboardData` |
| `transport_documents INSERT` → `matched` | "🚚 [Típus] párosítva!" (5s) | `shipments-matching` |
| `transport_documents INSERT` → `orphaned` | "📄 [Típus] feldolgozva" (5s) | — |
| `transport_documents INSERT` → `escalated` | "⚠️ [Típus] eszkalálva" (8s, destructive) | `shipments-matching` |
| `transport_documents UPDATE` → `matched` | "🚚 [Típus] utólag párosítva!" (5s) | `shipments-matching` |
| `invoice_uploads` → `cmr_attached` | "🚚 Dokumentum párosítva!" (5s) | `shipments-matching` |
| `invoice_uploads` → `cmr_escalated` | "⚠️ Eszkaláció szükséges" (8s, destructive) | `shipments-matching` |
| `transaction_uploads` → `completed` | "Tranzakciók feldolgozva!" (5s) | `transactions` |
| `report_uploads` → `completed` | "Riport feldolgozva!" (5s) | `courier-reports` |

**Nincs értesítési center (harang ikon, lista):**
- Toast + email kombináció elegendő
- In-app history fejlesztési ráfordítása nem indokolt
- Ha user feedback alapján igény merül fel → harang ikon + lista bevezethető

**Rationale:** A 3 rétegű architektúra azért szükséges, mert a Supabase Realtime WS connection reconnect esetén nem replay-eli a közben keletkező events-eket. A session polling skálázható alternatívát jelent a globális polling helyett: csak aktív feltöltő sessionök polloznak. A tab focus catch-up fedezi azt az esetet, ha a user a tab-ot elhagyta, miközben a worker feldolgozta a fájljait.

**Cross-referenciák:**
- `P-013` — Feltöltés UX (`registerPendingUpload` hívás helye)
- `P-022` — Email értesítések (out-of-app channel)
- `LiveNotificationProvider.tsx` — implementáció (`src/components/`)
