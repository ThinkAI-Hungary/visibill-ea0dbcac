# Handoff: ConfirmDialog Async Pattern — Globális UX Fix

**Session dátuma:** 2026-07-07  
**Átadó session:** 802a358f-0a4e-4cbb-9c29-a28ba6ede6c7  
**Prioritás:** Közepes — UX javítás, nem kritikus bug  
**Becsült idő:** 1-2 óra (12 fájl migrálás)

---

## Kontextus — Mi történt eddig

### Megfigyelt probléma (2026-07-07)
A Management Dashboard → Fájlok panel törlés dialógjában a user kattint a "Végleges törlés" gombra → a dialog **azonnal eltűnik** → ~1 másodperccel később jelenik meg a toast. Ez rossz UX, mert a user elveszti a kontextust és nem látja a töltési állapotot.

### Már elvégzett javítás
A `ManagementDashboard.tsx` FilesPanel törlés dialógban **kézzel javítva**:
- `AlertDialogAction` → `Button` (nincs Radix auto-close)
- `onOpenChange={(open) => { if (!bulkDeleting) setDeleteConfirmOpen(open) }}`
- Dialog csak a `finally` blokkban zárul: `setDeleteConfirmOpen(false)`

### Globális megoldás terve
Új `ConfirmDialog` wrapper komponens (`src/components/ui/confirm-dialog.tsx`) létrehozása, majd az összes async DB confirm dialog migrálása erre.

**Részletes terv:** [`implementation-plans/confirm-dialog-async-pattern.md`](./confirm-dialog-async-pattern.md)

---

## Amit a következő sessionnek TUDNIA KELL

### 1. Radix UI auto-close mechanizmus
```
AlertDialogPrimitive.Action → kattintásra AZONNAL zárja a Root-ot
→ Ez nem override-olható az onClick-ben, mert a zárás a click event bubblingja előtt fut
→ Megoldás: AlertDialogAction helyett sima Button + onOpenChange gating
```

### 2. Jelenlegi `alert-dialog.tsx` állapota
- **NEM módosítjuk** az `src/components/ui/alert-dialog.tsx`-t
- Az `AlertDialogAction` export marad — az `UnsavedChangesDialog` és szinkron dialógok használják
- Az új `ConfirmDialog` **belül** `AlertDialog` + `Button`-t használ (nem `AlertDialogAction`-t)

### 3. `UnsavedChangesDialog.tsx` — NE MIGRÁLJUK
```
src/components/UnsavedChangesDialog.tsx
→ Szinkron navigáció elvetés, nincs DB hívás
→ Az azonnali zárás itt HELYES viselkedés
→ Maradjon AlertDialogAction-nel
```

### 4. `ManagementDashboard.tsx` FilesPanel
```
→ Már kézzel javítva (2026-07-07)
→ Opcionálisan migrálható ConfirmDialog-ra, de NEM prioritás
→ Ha migrálod: a deleteConfirmCounts info a children slot-ba kerül
```

### 5. `mutate()` vs `mutateAsync()` probléma
Egyes helyeken TanStack Query `mutation.mutate()` van — ez **nem awaitable** (void return). A `ConfirmDialog` `onConfirm`-ja async, tehát ahol `mutate()` van, váltani kell `mutateAsync()`-ra:

```tsx
// ELŐTTE
onConfirm={() => mutation.mutate(payload)}

// UTÁNA
onConfirm={() => mutation.mutateAsync(payload)}
// → a mutateAsync() reject-el hiba esetén, a ConfirmDialog dialog nyitva marad
```

---

## Teendők a következő sessionben

### Step 0: Baseline
```bash
npm run build  # ← ellenőrizd hogy clean a baseline
```

### Step 1: Komponens létrehozása
```
src/components/ui/confirm-dialog.tsx  [ÚJ]
```
Lásd a teljes kódot a `confirm-dialog-async-pattern.md`-ben.

### Step 2: Legegyszerűbb migrálások (warmup)
```
src/components/CompanySelector.tsx        → isDeleting state megvan
src/components/salaries/SalaryFilesTable.tsx → deleting state megvan
```

### Step 3: Pages migrálás
```
src/pages/Settings.tsx (2 hely)
src/pages/ManualUpload.tsx
src/pages/EscalationListPage.tsx (2 hely)
src/pages/VatReturnPage.tsx
src/pages/Accounty/ProfileSettingsPage.tsx
src/pages/ShipmentMatchingDashboard.tsx (2 hely)
src/pages/ShipmentImportPage.tsx
```

### Step 4: Components migrálás
```
src/components/tickets/TicketDetailView.tsx
src/components/invoices/InvoiceFilesDialog.tsx  ← nézd meg a tényleges kódot először
```

### Step 5: Build + smoke test
```bash
npm run build
# Browser test: minden dialog → confirm → spinner látszik → toast → dialog zárul
```

### Step 6: Docs frissítés
```
docs/design/12-dialogs-modals.md → ConfirmDialog pattern hozzáadása
```

---

## Gyors referencia: a kész pattern

```tsx
// Import
import { ConfirmDialog } from '@/components/ui/confirm-dialog';

// Használat
<ConfirmDialog
  open={isOpen}
  onOpenChange={setIsOpen}
  title="Törlés megerősítése"
  description="Ez a művelet nem visszavonható."
  confirmLabel="Törlés"
  variant="destructive"
  confirmIcon={<Trash2 className="h-4 w-4" />}
  onConfirm={async () => {
    await someAsyncOperation();  // ← a dialog nyitva marad amíg ez fut
    // toast a caller felelőssége
  }}
/>
```

---

## Fájlok, amikbe bele kell nézni az audit során

Az `InvoiceFilesDialog.tsx` AlertDialogAction-jét még nem vizsgáltuk — a session elején nézd meg:
```bash
grep -n "AlertDialogAction" src/components/invoices/InvoiceFilesDialog.tsx
```

---

## Kapcsolódó dokumentumok
- **Implementációs terv:** `implementation-plans/confirm-dialog-async-pattern.md`
- **Design docs:** `docs/design/12-dialogs-modals.md`
- **Már javított példa:** `src/pages/ManagementDashboard.tsx` → `FilesPanel` → `handleBulkDelete`
