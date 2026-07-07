# ConfirmDialog Async Pattern — Implementációs Terv

**Státusz:** TERVEZVE — következő dedikált sessionre  
**Keletkezés:** 2026-07-07  
**Kapcsolódó:** `docs/design/12-dialogs-modals.md`

---

## Probléma

A Radix UI `AlertDialogPrimitive.Action` komponens **automatikusan zárja a dialógot** kattintásra, még akkor is, ha az `onClick` handler async DB műveletet hajt végre. Ez azt jelenti:

1. User kattint → dialog **azonnal** eltűnik
2. ~1s múlva megjelenik a toast (DB művelet lefut)
3. **UX hiba:** A user elveszti a kontextust, nem látja a töltési állapotot

A jelenlegi `ManagementDashboard.tsx` FilesPanel delete dialógban már **javítva** van (2026-07-07):
- `AlertDialogAction` → `Button` (nincs auto-close)
- `onOpenChange` gated: `(open) => { if (!bulkDeleting) setDeleteConfirmOpen(open) }`

**A feladat:** Ezt a mintát általánossá tenni egy `ConfirmDialog` wrapper komponenssel.

---

## Megoldás: `ConfirmDialog` wrapper komponens (Opció B)

### Miért nem Opció A (alert-dialog.tsx forrás módosítás)?

Az `UnsavedChangesDialog` és néhány navigáció-elvetős dialog **szándékosan** azonnal záródik — ott nincs async DB hívás, az azonnali zárás helyes UX. Az Opció A megtörné ezeket.

### Az új `ConfirmDialog` API

```tsx
// src/components/ui/confirm-dialog.tsx
<ConfirmDialog
  open={open}
  onOpenChange={setOpen}
  title="Cég törlése"
  description="Ez a művelet nem visszavonható..."
  confirmLabel="Törlés"         // default: "Megerősítés"
  cancelLabel="Mégsem"          // default: "Mégsem"
  variant="destructive"         // "default" | "destructive"
  isPending={isDeleting}        // ha true: spinner + disabled gombok + dialog NEM zárható
  onConfirm={handleDelete}      // async fn — dialog bezárása csak onConfirm resolve/reject után
>
  {/* Opcionális: custom body content slot */}
  <div>extra tartalom...</div>
</ConfirmDialog>
```

### Prop interface

```typescript
interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: React.ReactNode;
  description?: React.ReactNode;   // string vagy JSX (pl. részletes lista)
  confirmLabel?: string;           // default: "Megerősítés"
  cancelLabel?: string;            // default: "Mégsem"
  variant?: 'default' | 'destructive';
  isPending?: boolean;             // extern loading state (opcionális)
  onConfirm: () => Promise<void> | void;
  children?: React.ReactNode;      // custom body slot
  confirmIcon?: React.ReactNode;   // pl. <Trash2 /> ikon a confirm gomb előtt
}
```

### Komponens belső logika

```tsx
export function ConfirmDialog({ open, onOpenChange, title, description,
  confirmLabel = 'Megerősítés', cancelLabel = 'Mégsem',
  variant = 'default', isPending: externalPending,
  onConfirm, children, confirmIcon }: ConfirmDialogProps) {
  const [internalPending, setInternalPending] = useState(false);
  const isPending = externalPending ?? internalPending;

  const handleConfirm = async () => {
    setInternalPending(true);
    try {
      await onConfirm();
      onOpenChange(false);   // csak sikeres befejezés után zárjuk
    } finally {
      setInternalPending(false);
    }
  };

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => { if (!isPending) onOpenChange(next); }}
    >
      ...
      <AlertDialogCancel disabled={isPending}>{cancelLabel}</AlertDialogCancel>
      <Button onClick={handleConfirm} disabled={isPending}>
        {isPending ? <Loader2 /> : confirmIcon}
        {isPending ? 'Folyamatban...' : confirmLabel}
      </Button>
    </AlertDialog>
  );
}
```

---

## Érintett fájlok és migrálási sorrendük

### [ÚJ] `src/components/ui/confirm-dialog.tsx`
Az alap wrapper komponens létrehozása — ez az **első lépés**.

### Migrálási lista (prioritás sorrendben)

| # | Fájl | Hely | Migrálás nehézsége |
|---|------|------|-------------------|
| 1 | `components/CompanySelector.tsx` | Cég törlés | Egyszerű — van `isDeleting` state |
| 2 | `components/salaries/SalaryFilesTable.tsx` | Dokumentum törlés | Egyszerű — van `deleting` state |
| 3 | `pages/Settings.tsx` (tag remove) | Tag eltávolítása | Közepes — `removeMember` mutation |
| 4 | `pages/Settings.tsx` (role change) | Szerepkör változás | Közepes — `confirmChange` async |
| 5 | `pages/ManualUpload.tsx` | Fájl törlés | Közepes |
| 6 | `pages/EscalationListPage.tsx` (2x) | Eszkaláció műveletek | Közepes |
| 7 | `components/tickets/TicketDetailView.tsx` | Jegy törlés/lezárás | Közepes |
| 8 | `pages/VatReturnPage.tsx` | ÁFA bevallás véglegesítés | Közepes — `finalizeReturn.mutate()` |
| 9 | `pages/Accounty/ProfileSettingsPage.tsx` | Profil törlés | Közepes |
| 10 | `pages/ShipmentMatchingDashboard.tsx` (2x) | Szállítmány műveletek | Közepes |
| 11 | `pages/ShipmentImportPage.tsx` | Import megerősítés | Közepes |
| 12 | `components/invoices/InvoiceFilesDialog.tsx` | Fájl törlés | Ellenőrizni kell |

### NEM migrálni

- `UnsavedChangesDialog.tsx` — szinkron navigáció elvetés, azonnali zárás HELYES
- `ManagementDashboard.tsx` FilesPanel — **már kézzel javítva** 2026-07-07 (opcionálisan migrálható)

---

## Migrálási pattern (minden call-site-on)

**ELŐTTE:**
```tsx
<AlertDialog open={isOpen} onOpenChange={setIsOpen}>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>Cím</AlertDialogTitle>
      <AlertDialogDescription>Leírás</AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel disabled={loading}>Mégsem</AlertDialogCancel>
      <AlertDialogAction disabled={loading} onClick={handleAction}
        className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
        {loading ? <Loader2 /> : 'Törlés'}
      </AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

**UTÁNA:**
```tsx
<ConfirmDialog
  open={isOpen}
  onOpenChange={setIsOpen}
  title="Cím"
  description="Leírás"
  confirmLabel="Törlés"
  variant="destructive"
  confirmIcon={<Trash2 className="h-4 w-4" />}
  onConfirm={handleAction}
/>
```

Import cleanup minden fájlban: eltávolítani `AlertDialogAction` ahol már nem kell.

---

## Végrehajtás sorrendje a dedikált sessionben

```
1. npm run build → baseline verify
2. Létrehozni: src/components/ui/confirm-dialog.tsx
3. npm run build → komponens OK
4. Migrálni: CompanySelector.tsx + SalaryFilesTable.tsx (legegyszerűbbek)
5. npm run build → OK
6. Migrálni: Settings.tsx (2 hely), ManualUpload.tsx
7. npm run build → OK
8. Migrálni: EscalationListPage.tsx, TicketDetailView.tsx, VatReturnPage.tsx
9. npm run build → OK
10. Migrálni: ProfileSettingsPage.tsx, ShipmentMatchingDashboard.tsx,
              ShipmentImportPage.tsx, InvoiceFilesDialog.tsx
11. npm run build → FINAL OK
12. Browser smoke test: minden dialog confirm → spinner → toast → bezárul
13. docs/design/12-dialogs-modals.md frissítése
```

---

## Tesztelési kritériumok (Gate)

Minden migált dialog esetén:
- [ ] Confirm gombra kattintva **dialog nyitva marad**
- [ ] Gombon spinner látható töltés közben
- [ ] Mégsem gomb **disabled** töltés közben
- [ ] ESC / backdrop **nem zárja** töltés közben
- [ ] Toast megjelenik → **majd** dialog bezárul
- [ ] Sikertelen DB hívás esetén dialog nyitva marad (hibát caller kezeli toast-al)

---

## Kockázatok

| Kockázat | Mitigation |
|---------|-----------|
| `UnsavedChangesDialog` véletlenül migrálva | Explicit NOT MIGRATE jelzés a handoff-ban |
| `onConfirm` fire-and-forget `mutate()` (nem awaitable) | Ahol szükséges, `mutateAsync()` váltás |
| `externalPending` + belső `isPending` duplikáció | `externalPending ?? internalPending` logika kezeli |
| Custom body content szükséges (pl. részletes lista) | `children` prop slot + `description` ReactNode típus |
