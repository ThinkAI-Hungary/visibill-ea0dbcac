# P-013: Feltöltés UX

**Status:** Decided  
**Category:** Számla Kezelés  
**Utoljára frissítve:** 2026-09-01

**Question:** Hogyan működik a dokumentum feltöltés és az utólagos fájlkezelés?

**Decision:** Multi-file batch upload drag & drop-pal; feltöltés utáni fájlkezelés dedikált modalban, kétlépéses törlési workflow-val (A/B). Értesítések 3 rétegű, skálázható architektúrával globálisan, bármely oldalon.

**Current Implementation:**
- `src/features/upload` (ManualUploadFeature) — drag & drop + fájlválasztó, 5 tab: Számlák (`invoices`), Pénztárbizonylat (`vouchers`), Tranzakciók (`transactions`), Bérek & Járulékok (`salaries`), Riportok (`reports`)
- `document_category` perzisztencia az `invoice_uploads` táblában: `'invoice'` (számlák), `'penztarbizonylat'` (pénztárbizonylatok), `'payroll'` (bérek és járulékok)
- Specifikus szelektorok: `bank_hint` (11 banki formátum a tranzakciókhoz) és `courier` (GLS, MPL, Mixpack a riportokhoz)
- Támogatott formátumok: PDF, JPG, PNG, WebP (számlák, pénztárbizonylatok); PDF, CSV, XLS/XLSX (tranzakciók, bérek); XLS, XLSX, CSV, PDF, DOC, DOCX (riportok)
- `UploadHistory` komponens: korábbi feltöltések státusza, dátumszűrés, előnézet és újrafuttatás
- `UploadedFilesModal` — feltöltött fájlok kezelése a tab-ra szűrve, dinamikus tábla-illeszkedéssel (`selectFields`) és batch törléssel (A/B)

**Fájl előnézet (File Preview) — 2026-07-11:**
- Az előzmények táblázatban az előnézet ikonra kattintva megnyitható a fájl részletes előnézete egy felugró modalban.
- **Támogatott előnézeti formátumok:**
  - **PDF:** Kényelmes, beágyazott `iframe`-en keresztül.
  - **Képfájlok:** EXIF-helyreállított `img` elemként.
  - **CSV (és TSV):** Egyedi `CsvPreviewComponent` letölti és táblázatosan ábrázolja a fájl első 100 sorát (a mezőelválasztókat automatikusan igazítva).
  - **Excel (XLS, XLSX, XLSM):** Beágyazott Microsoft Office Live online dokumentumolvasó iframe segítségével jeleníti meg a táblázatot.

**UploadHistory státusz badge leképezés (2026-07-04):**

| `processing_status` | Badge label | Variant | Szín | Megjegyzés |
|---|---|---|---|---|
| `pending`, `uploaded` | „Feldolgozás alatt" | `outline` | Outline | Várakozik feldolgozásra (azonnali visszajelzés a felhasználónak) |
| `processing`, `webhook_sent` | „Feldolgozás alatt" | `outline` | Outline | Worker dolgozik rajta |
| `processed`, `completed` | „Feldolgozva" | `default` | Zöld | Sikeresen kész |
| `error`, `webhook_failed` | **„Feldolgozási hiba"** | `destructive` | Piros | A feltöltés sikerült, de a feldolgozás hibára futott |
| `failed` | „A feltöltés sikertelen" | `destructive` | Piros | A fájl nem jutott el a storage-ba |
| `ignored` | „Nem beazonosítható" | `secondary` | Szürke | A dokumentum nem felismerhető számlaként |
| `dismissed` | „Elutasítva" | `secondary` | Szürke | Manuálisan elutasítva (management dashboard) |
| `cmr_attached` | „Dokumentum párosítva" | `default` | Zöld | Szállítólevél sikeresen párosítva |
| `cmr_orphaned` | „Vár a számlára" | `secondary` | Szürke | Szállítólevél, számla még nem érkezett |
| `cmr_escalated` | „⚠️ Eszkaláció" | `outline` | Outline | Kattintható → eszkalációs dialog |

**Error message megjelenítés:** Extraction error-nál rövidített szöveg: „Extraction hiba" (a teljes hibaüzenet tooltip-ben látható). Egyéb hibáknál az eredeti `error_message` szövege jelenik meg, `max-w-[150px] truncate`-tel.

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
- A polling automatikusan leáll, ha minden ID terminális státuszba kerül (`processed`, `completed`, `cmr_attached`, `cmr_orphaned`, `cmr_escalated`, `ignored`, `error`, `failed`, `webhook_failed`)
- Csak az `invoice_uploads` táblát pollozza (tranzakciókat a Realtime kezeli `transaction_uploads` listener-rel)

**Toast státusz leképezés (`notifyUploadStatus`):**
| `processing_status` | Toast (Lucide ikon) | Cache invalidálás |
|---|---|---|
| `processed` / `completed` | CheckCircle — "Számla feldolgozva!" | `submittedInvoices`, `recentInvoices`, `dashboardData`, **`uploadHistory`**, **`uploaded-files`** |
| `cmr_attached` | Truck — "Dokumentum párosítva!" | `shipments-matching`, `uploadHistory`, `uploaded-files` |
| `cmr_orphaned` | FileText — "Dokumentum rögzítve" | `uploadHistory`, `uploaded-files` |
| `cmr_escalated` | AlertTriangle — "Eszkaláció szükséges" (destructive) | `shipments-matching`, `uploadHistory`, `uploaded-files` |

**Dedup mechanizmus (2026-06-24):** Háromszintű, egységes dedup:
1. **`notifiedUploads` ref** (`LiveNotificationProvider`-ben) — key: `upload_notif_{id}` — session polling, Realtime és catch-up mind ugyanezt ellenőrzi → egy upload-hoz csak egy toast kerülhet ki bármely mechanizmustól
2. **`_notifiedUploadIds` module-level Set** — exportált `isUploadNotified(uploadId)` függvénnyel elérhető más komponensekből
3. **`UploadHistory.tsx`** — `isUploadNotified(rec.id)` check a saját fallback toast előtt → nem küld dupla toastot, ha a LiveNotificationProvider már értesített; a cache invalidálást viszont mindig elvégzi

Cég váltáskor a `notifiedUploads` ref törlődik (`notifiedUploads.current.clear()`); a `_notifiedUploadIds` session-szintű (tab újratöltésnél resetelődik).

**Technikai részletek:**
- `extractStoragePath(url, bucket)` — storage path kinyerés URL-ből
- `Promise.allSettled()` — batch törlés párhuzamosan, részleges siker kezelve
- Dialog bezáráskor state reset (`deleteTarget`, `batchDeleteOpen`, `selectedIds`) → AlertDialog portal flash megelőzése
- `queryClient.invalidateQueries` — cache invalidálás törlés után: `uploaded-files`, `uploadHistory`, `submittedInvoices`, `transactions`

**TODO (még nem implementált):**
- Per-file upload progress bar (nagy fájloknál)
- Per-file hiba visszajelzés (melyik fájl bukott a batch feltöltésben)
- **Multi-company routing badge** — ha a számla átirányítva lett, "Átirányítva → [Cég neve]" badge az UploadHistory-ban
- **Info banner** a ManualUpload-ban multi-company user-eknél: "Bármelyik cég alá feltöltheted, a rendszer automatikusan szétválogatja"

**Rationale:** A feltöltött fájlok kezelése (törlés, újrafeltöltés) visszatérő adminisztrációs igény. Az A/B törlési mód explicit választást ad a usernek: csak a fájlt törli, vagy a teljes feldolgozott adatot is. A 3 rétegű notification architektúra Supabase Realtime megbízhatatlan delivery-jének kompenzálására lett bevezetve (WS reconnect-nél az events nem replay-elődnek), miközben skálázható marad: a session polling csak aktív feltöltők számával arányos, nem az összes userrel.

**Cross-referenciák:**
- `P-015` — Bulk actions pattern (checkbox, batch toolbar)
- `P-023` — In-app notification architektúra (toast rétegek)
- `design/12` — Dialog / AlertDialog portal flash fix
- `A-008` — OCR pipeline (feltöltés után indul)
- `A-011` — Mailgun webhook (email-ből érkező feltöltés)
- `A-016` — `delete_upload_with_data` RPC (cascade törlés)
- `A-025` — Cross-company invoice routing (multi-company adószám-alapú átirányítás)
