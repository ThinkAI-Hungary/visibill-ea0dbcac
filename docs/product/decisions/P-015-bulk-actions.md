# P-015: Tömeges Műveletek (Bulk Actions)

**Status:** Decided  
**Category:** Számla Kezelés  
**Utoljára frissítve:** 2026-07-19

**Question:** Lehet-e több számlát/tranzakciót/feltöltést egyszerre kezelni?

**Decision:** Checkbox-alapú bulk actions confirm dialóggal. Törlési műveleteknél kötelező A/B mód (fájl only vs. fájl + adatok).

---

## Implementált Bulk Delete Pattern (A/B mód)

A feltöltési és számlamodálokban egységes kétlépéses törlési workflow van bevezetve:

### UX Flow

```
1. Checkbox(ok) pipálása a sorokban
2. "X törlése" gomb megjelenik (destructive, piros)
3. AlertDialog nyílik → A/B választás:
   ┌─────────────────────────────────────────────────────┐
   │  A  Csak a fájl törlése                              │
   │     Fájl eltávolításra kerül, adatok megmaradnak.   │
   ├─────────────────────────────────────────────────────┤
   │  B  Fájl és kapcsolódó adatok törlése (piros keret) │
   │     Számlák, tranzakciók, dokumentumok is törlődnek. │
   └─────────────────────────────────────────────────────┘
4. Törlés → toast visszajelzés (hány sikeres / hány hibás)
```

### Technikai Implementáció

| Elem | Leírás |
|------|--------|
| **Select-all checkbox** | A keresősáv bal oldalán; az aktuális oldalon lévő elemekre vonatkozik |
| **Sor checkbox** | Minden sorban bal szélen |
| **Batch gomb** | Csak ha `selectedIds.size > 0`; `selectedCount törlése` felirattal |
| **Option A** | `storage.remove([path])` + `from(table).delete().eq('id', id)` — adatok megmaradnak |
| **Option B** | `rpc('delete_upload_with_data', { p_upload_id, p_upload_type })` + storage törlés |
| **Párhuzamos törlés** | `Promise.allSettled(selectedUploads.map(fn))` — részleges siker kezelve |
| **Cache invalidálás** | `queryClient.invalidateQueries` a releváns query key-ekre |

### RPC: delete_upload_with_data

```sql
-- p_upload_type: 'invoice' | 'transaction' | 'report'
-- Cascade: invoices, transactions, transport_docs, shipment_matches, costs
SELECT delete_upload_with_data(p_upload_id := '...', p_upload_type := 'invoice');
```

Returns: `{ deleted_invoices, deleted_transactions, deleted_transport_docs }`

### Komponensek ahol implementálva van

| Komponens | Fájl | Törlési scope |
|-----------|------|---------------|
| `InvoiceFilesDialog` | `src/components/invoices/InvoiceFilesDialog.tsx` | invoice_uploads tábla, invoice adatok |
| `UploadedFilesModal` | `src/components/UploadedFilesModal.tsx` | invoice/transaction/report uploads, összes kapcsolódó adat |

---

## AlertDialog Portal Flash — Ismert Bug Fix (2026-06-24)

**Probléma:** Főmenü Dialog bezáráskor az AlertDialog (törlés confirm) rövid ideig felvillan (Radix portal animation race condition).

**Fix:**
```tsx
// 1. State reset a Dialog onOpenChange-ben
<Dialog onOpenChange={(open) => {
  setIsOpen(open);
  if (!open) {
    setDeleteTarget(null);
    setBatchDeleteOpen(false);
    setSelectedIds(new Set());
  }
}}>

// 2. AlertDialog guard: csak akkor nyílik, ha a főDialog is nyitva van
<AlertDialog open={isOpen && !!deleteTarget} ...>
<AlertDialog open={isOpen && batchDeleteOpen} ...>
```

---

## Számlatétel Könyvelési Státusz Tömeges Kezelése (2026-07-18)

A számlarészletező (tételek) dialógusban a felhasználók tömegesen be- és kivehetik a tételeket a könyvelésből.

### UX Flow
1. A tételek táblázatában a sorok kijelölése a checkboxok segítségével.
2. A táblázat láblécében megjelenik a `Könyvelés Ki/Be (x tétel)` akciógomb.
3. A gombra kattintva egy DropdownMenu nyílik meg két opcióval:
   * **Beemelés a könyvelésbe:** a kijelölt tételek `exclude_from_accounting` értékét `false`-ra állítja.
   * **Kizárás a könyvelésből:** a kijelölt tételek `exclude_from_accounting` értékét `true`-ra állítja.
4. Mentéskor egyetlen batch Supabase frissítés fut le (`.in('id', selectedIds)`), majd a táblázat adatai és a kijelölések frissülnek.

### Komponensek ahol implementálva van
* `InvoiceItemsDialog` (`src/components/InvoiceItemsDialog.tsx`)

---

## Számlák Főlistája — Lebegő Csoportos Műveleti Sáv (2026-09-06)

A bejövő és kimenő beküldött számlák (`SUBMITTED_INBOUND`, `SUBMITTED_OUTBOUND`) és NAV számlák felületén lebegő csoportos műveleti sáv (`InvoiceBulkActionsBar`) segíti a tömeges adatkezelést:

### Funkciók és UX Kialakítás
1. **Lebegő sáv megjelenése:** Amint legalább 1 számla ki van jelölve, a képernyő alsó részén megjelenik a `z-[9999]` lebegő panel, amely mutatja a kijelölt számlák számát.
2. **Kategória és Projekt hozzárendelés:**
   - DropdownMenu a kijelölt számlák egyidejű kategóriába vagy projektbe sorolásához.
   - A dropdown panelek `z-[10001]` és `sideOffset={8}` beállítással nyílnak a lebegő panel fölé, megelőzve az elemek eltűnését.
3. **Mégse gomb:** Az `X` ikonnal ellátott Mégse gomb azonnal meghívja a `clearSelection` funkciót, megszünteti a kijelöléseket és elrejti a lebegő panelt.
4. **Tömeges Törlés (Dual Choice Deletion):**
   - A piros "Törlés" gombra kattintva megnyílik a `BulkDeleteDialog`.
   - A felhasználó választ:
     - **1. Csak a számlasorok törlése:** a rekordok törlődnek, a feltöltött eredeti fájlok az adatbázisban és a storage-ban maradnak.
     - **2. Számlasorok és feltöltött fájlok törlése:** a rekordok mellett a kapcsolódó egyedi `invoice_uploads` bejegyzések és a felhőbeli fájlok is véglegesen megsemmisülnek.
5. **Lapozási Határeset Auto-Recovery (Pagination Boundary Auto-Recovery):**
   - Ha a felhasználó a számlalista utolsó oldalán tartózkodik (pl. oldal 2/2), és a törlés következtében az adott oldalon lévő összes számla törlődik, az állapot nem ragad az üres 2. oldalon ("Nincs megjeleníthető számla").
   - A rendszer automatikusan észleli a kiürült oldalt (`currentPage > 1 && result.length === 0`), és a szerveroldali KPI fallback alapján azonnal visszalépteti a felhasználót a megelőző érvényes utolsó oldalra (pl. oldal 1-re).
   - A lapozó vezérlő (`UnifiedPagination`) és az URL paraméterezés (`?p=...`) automatikusan és szinkronban frissül.

---

## Tervezett (még nem implementált)

- Bulk GL kategorizálás (több tranzakció egyszerre a tranzakciók táblában)
- Bulk export (kijelölt számlák szelektív CSV/XLSX exportálása)

**Rationale:** Standard UX pattern, hatékony nagy adathalmazoknál. Az A/B törlési mód explicit döntést kényszerít a userre: csak tárhelyet takarít meg (A), vagy valóban törli az adatokat (B). A confirm dialógus megvédi a véletlen tömeges módosítástól.

**Cross-referenciák:**
- `P-012` — Invoice Editing (Számlakép törlése egyedi dialógus)
- `P-013` — Upload UX (UploadedFilesModal)
- `A-099` — Számlakép Törlés Kettős Döntési Modell és Lapozási Határeset Auto-Recovery
