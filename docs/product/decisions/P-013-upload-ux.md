# P-013: Feltöltés UX

**Status:** Decided  
**Category:** Számla Kezelés  
**Utoljára frissítve:** 2026-06-24

**Question:** Hogyan működik a dokumentum feltöltés és az utólagos fájlkezelés?

**Decision:** Multi-file batch upload drag & drop-pal; feltöltés utáni fájlkezelés dedikált modalban, kétlépéses törlési workflow-val (A/B). Értesítések 3 rétegű, skálázható architektúrával globálisan, bármely oldalon.

**Current Implementation:**
- `ManualUpload.tsx` — drag & drop + fájlválasztó, 4 tab: Számlák / Tranzakciók / Bérek / Riportok
- `document_category` választás: invoice / payroll (invoice_uploads táblában)
- Támogatott formátumok: PDF, JPG, PNG, WebP (számlák); PDF, CSV, XLS/XLSX (tranzakciók, riportok)
- `UploadHistory` komponens: korábbi feltöltések státusza, 90 másodperces polling
- `UploadedFilesModal` — feltöltött fájlok kezelése a tab-ra szűrve

**Fájlkezelő Modal (UploadedFilesModal) — 2026-06-24:**
- Keresés fájlnév alapján (debounced filter)
- Lapozás: 15 elem/oldal
- **Batch törlés:** checkbox minden soron + "összes kijelölése" checkbox a keresősáv mellett
- Ha 1+ elem kijelölt → piros "X törlése" batch gomb jelenik meg
- **A/B törlési mód** (egyedi és batch delete is):
  - **A — Csak fájl törlése:** storage fájl + upload rekord törlődik, a feldolgozott számla/tranzakció adatok megmaradnak
  - **B — Fájl + adatok törlése:** `delete_upload_with_data` RPC cascade (invoices, transactions, transport_docs, matches, costs mind törlődik)
- Fájl megnyitás: `ExternalLink` ikon → új tab

**Értesítési architektúra (2026-06-24) — 3 rétegű, skálázható:**

A feldolgozási toast értesítések **globálisan jelennek meg**, függetlenül attól, hogy a user a Feltöltések menüben van-e.

| Réteg | Mechanizmus | Triggerelte | Skálázás |
|---|---|---|---|
| **1. Realtime (elsődleges)** | Supabase WS push | `LiveNotificationProvider` — mindig aktív, minden oldalon | O(1) WS connection/user |
| **2. Session polling (fallback)** | 5s interval, csak aktív feltöltés közben | `registerPendingUpload(id)` hívás feltöltés után | O(aktív feltöltők) ≪ O(összes user) |
| **3. Tab focus catch-up** | Egyszer fut, tab visszaváltáskor (2+ perc után) | `visibilitychange` → `catchUpToasts()` | Ritka esemény, ~15 perces ablak |

**Session polling részletei:**
- `registerPendingUpload(uploadId)` — exportált függvény a `LiveNotificationProvider`-ből
- Hívás helye: `ManualUpload.tsx` — minden egyes `invoice_uploads.insert()` sikeres sor után
- A polling automatikusan leáll, ha minden ID terminális státuszba kerül (`processed`, `cmr_attached`, `cmr_orphaned`, `cmr_escalated`, `ignored`, `error`)
- Csak az `invoice_uploads` táblát pollozza (tranzakciókat a Realtime kezeli `transaction_uploads` listener-rel)

**Toast státusz leképezés (`notifyUploadStatus`):**
| `processing_status` | Toast | Cache invalidálás |
|---|---|---|
| `processed` / `completed` | "Számla feldolgozva! ✓" | `submittedInvoices`, `recentInvoices`, `dashboardData` |
| `cmr_attached` | "🚚 Dokumentum párosítva!" | `shipments-matching` |
| `cmr_orphaned` | "📄 Dokumentum rögzítve" | — |
| `cmr_escalated` | "⚠️ Eszkaláció szükséges" (destructive) | `shipments-matching` |

**Dedup mechanizmus:** `notifiedUploads` in-memory Set a `LiveNotificationProvider`-ben — minden notification key egyszer kerül bele (`session_{status}_{id}`, `catchup_{status}_{id}`, `cmr_attached_{id}`, stb.). Cég váltáskor törlődik.

**Technikai részletek:**
- `extractStoragePath(url, bucket)` — storage path kinyerés URL-ből
- `Promise.allSettled()` — batch törlés párhuzamosan, részleges siker kezelve
- Dialog bezáráskor state reset (`deleteTarget`, `batchDeleteOpen`, `selectedIds`) → AlertDialog portal flash megelőzése
- `queryClient.invalidateQueries` — cache invalidálás törlés után: `uploaded-files`, `uploadHistory`, `submittedInvoices`, `transactions`

**TODO (még nem implementált):**
- Per-file upload progress bar (nagy fájloknál)
- Per-file hiba visszajelzés (melyik fájl bukott a batch feltöltésben)

**Rationale:** A feltöltött fájlok kezelése (törlés, újrafeltöltés) visszatérő adminisztrációs igény. Az A/B törlési mód explicit választást ad a usernek: csak a fájlt törli, vagy a teljes feldolgozott adatot is. A 3 rétegű notification architektúra Supabase Realtime megbízhatatlan delivery-jének kompenzálására lett bevezetve (WS reconnect-nél az events nem replay-elődnek), miközben skálázható marad: a session polling csak aktív feltöltők számával arányos, nem az összes userrel.

**Cross-referenciák:**
- `P-015` — Bulk actions pattern (checkbox, batch toolbar)
- `P-023` — In-app notification architektúra (toast rétegek)
- `design/12` — Dialog / AlertDialog portal flash fix
- `A-008` — OCR pipeline (feltöltés után indul)
- `A-011` — Mailgun webhook (email-ből érkező feltöltés)
- `A-016` — `delete_upload_with_data` RPC (cascade törlés)
