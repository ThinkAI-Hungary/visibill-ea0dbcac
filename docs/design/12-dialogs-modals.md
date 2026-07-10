# 12 — Dialógusok & Felugró Ablakok

> Dialog, Sheet, Popover, Drawer patternek és használati konvenciók.

---

## Overlay Komponensek Összefoglaló

| Típus | Komponens | Felhasználás | Méret |
|-------|-----------|-------------|-------|
| **Dialog** | `dialog.tsx` | CRUD műveletek, részletek, megerősítés | `sm:max-w-*` |
| **Alert Dialog** | `alert-dialog.tsx` | Törlés megerősítés, destructive műveletek | Kisebb |
| **Sheet** | `sheet.tsx` | Oldalsó panel (activity log) | `side="right"` |
| **Drawer** | `drawer.tsx` | Mobil-barát alsó panel | `vaul` |
| **Popover** | `popover.tsx` | Calendar, kis form-ok | `w-auto` |

---

## Dialog Pattern

### Alap Dialog Felépítés

```tsx
<Dialog open={open} onOpenChange={setOpen}>
  <DialogContent className="sm:max-w-md">
    <DialogHeader>
      <DialogTitle>Cím</DialogTitle>
      <DialogDescription>Leírás</DialogDescription>
    </DialogHeader>

    {/* Tartalom */}

    <DialogFooter>
      <Button variant="outline" onClick={handleCancel}>Mégse</Button>
      <Button onClick={handleSubmit}>Mentés</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

### Dialog Stílus Konvenciók

| Tulajdonság | Érték |
|-------------|-------|
| **Overlay** | `bg-black/80` (alapértelmezett) |
| **Max width** | `sm:max-w-md` — `sm:max-w-4xl` |
| **Border** | `border-border/60` |
| **Shadow** | `shadow-2xl` (kivételes dialógoknál) |
| **Z-index** | Alapértelmezett Radix layering |

### Nem Escapable Dialog (Idle Warning)

```tsx
<DialogContent
  className="sm:max-w-md border-border/60 shadow-2xl z-[9999]"
  overlayClassName="backdrop-blur-md bg-black/60 z-[9999]"
  onPointerDownOutside={(e) => e.preventDefault()}
  onEscapeKeyDown={(e) => e.preventDefault()}
  onInteractOutside={(e) => e.preventDefault()}
  hideCloseButton
>
```

---

## Dialógus Típusok az Alkalmazásban

### Számla Dialógusok

| Dialog | Fájl | Méret | Felhasználás |
|--------|------|-------|-------------|
| `InvoiceDetailPopup` | 12KB | Nagy | Számla részletek |
| `InvoiceEditDialog` | 5KB | Közepes | Gyors szerkesztés |
| `InvoiceFullEditDialog` | 9KB | Nagy | Teljes szerkesztés |
| `InvoiceImageDialog` | 5KB | Nagy | Számla kép nagyítás |
| `InvoiceItemsDialog` | 15KB | Nagy | Számla tételek |
| `InvoiceFilesDialog` | 28KB | Nagy | Csatolt fájlok — batch delete, A/B mód (2026-06-24) |
| `UploadedFilesModal` | 22KB | Nagy | Feltöltött fájlok (upload oldalon) — batch delete, A/B mód (2026-06-24) |

### Tranzakció Dialog

| Dialog | Fájl | Méret |
|--------|------|-------|
| `TransactionDetailsDialog` | 46KB | XL — legnagyobb dialog! |

### Egyéb Dialógusok

| Dialog | Fájl | Felhasználás |
|--------|------|-------------|
| `AssetActivationDialog` | 15KB | TENY aktiválás |
| `ChangePasswordDialog` | 8KB | Jelszó módosítás |
| `FeedbackDialog` | 11KB | Visszajelzés küldés |
| `IdleWarningModal` | 3KB | Inaktivitás figyelmeztetés |
| `UnsavedChangesDialog` | 1KB | Mentetlen változások |
| `SupplierInvoiceAssignment` | 14KB | Szállító-számla összerendelés |
| `ExpandedInvoiceRow` (belső) | – | Tranzakció kereső/hozzárendelés (Dialog-ba migrálva 2026-06-18) |

---

## Sheet (Oldalsó Panel)

### Activity Log Sheet

**Fájl:** `components/dashboard/ActivityLogSheet.tsx` (65KB — a legnagyobb komponens!)

```tsx
<Sheet open={open} onOpenChange={setOpen}>
  <SheetContent side="right" className="w-[400px] sm:w-[540px]">
    <SheetHeader>
      <SheetTitle>Tevékenység napló</SheetTitle>
    </SheetHeader>
    {/* Aktivitás lista */}
  </SheetContent>
</Sheet>
```

---

## Popover Pattern

### Calendar Popover (GlobalDatePicker)

```tsx
<Popover open={dateFromOpen} onOpenChange={setDateFromOpen}>
  <PopoverTrigger asChild>
    <Button variant="outline" size="sm" className="h-7 text-xs">
      <CalendarIcon className="mr-1.5 h-3 w-3" />
      {format(dateFrom, "yyyy. MMM dd.", { locale: hu })}
    </Button>
  </PopoverTrigger>
  <PopoverContent className="w-auto p-0" align="start">
    <Calendar
      mode="single"
      selected={dateFrom}
      onSelect={(date) => { setDateFrom(date); setOpen(false); }}
      disabled={{ after: dateTo }}
      initialFocus
      className="p-3 pointer-events-auto"
    />
  </PopoverContent>
</Popover>
```

### Company Selector Popover

**Fájl:** `components/CompanySelector.tsx` (17KB)

Cégválasztó dropdown a sidebar-ban, keresési funkcióval.

---

## Dialog Footer Konvenciók

### Standard Form Dialog

```tsx
<DialogFooter>
  <Button variant="outline" onClick={onCancel}>Mégse</Button>
  <Button onClick={onSubmit}>Mentés</Button>
</DialogFooter>
```

### Destructive Action Dialog

```tsx
<DialogFooter>
  <Button variant="outline" onClick={onCancel}>Mégse</Button>
  <Button variant="destructive" onClick={onDelete}>Törlés</Button>
</DialogFooter>
```

### Confirmation Dialog (Idle Warning)

```tsx
<DialogFooter className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-center">
  <Button variant="outline" onClick={onLogout}>Kijelentkezés</Button>
  <Button onClick={onStay} autoFocus>Igen, maradok</Button>
</DialogFooter>
```

> **Konvenció:** Az elsődleges akció gomb mindig jobbra van (LTR layout). Mobil nézeten `flex-col-reverse` → elsődleges gomb felül.

---

## Z-Index Rétegek

| Réteg | Z-Index | Elem |
|-------|---------|------|
| Tartalom | `auto` | Normal flow |
| Popover / Dropdown | Radix default | Menük, tooltipek |
| Dialog overlay | Radix default | Sötétítő háttér |
| Dialog content | Radix default | Dialog tartalom |
| FAB | `z-50` | Feedback gomb |
| Loading spinner | `z-[9999]` | Full-page spinner |
| Idle Warning | `z-[9999]` | Kiemelt modal |
| Sign-out overlay | `z-[9999]` | Kijelentkezés overlay |

---

## Tooltip Portal Pattern

> **Döntés (2026-06-18):** A `TooltipContent` komponens `TooltipPrimitive.Portal`-ba csomagolva, hogy a tooltip a `<body>` szintjén renderelődjön. Ez megakadályozza, hogy szülő konténerek `overflow` beállítása levágja a tooltip szövegét.

```tsx
// tooltip.tsx — Portal wrapper
<TooltipPrimitive.Portal>
  <TooltipPrimitive.Content
    className="z-50 rounded-md border bg-popover px-3 py-1.5 text-sm ..."
    {...props}
  />
</TooltipPrimitive.Portal>
```

> **Korábbi probléma:** Az `overflow-x-auto` tábla wrapper levágta a tooltip-eket, amelyek a konténer szélén túl nyúltak. A Portal megoldja ezt, mert a tooltip a DOM gyökérben renderelődik.

---

## AlertDialog Portal Flash Fix (2026-06-24)

> **Probléma:** Amikor egy `Dialog` bezár és `AlertDialog`-ok vannak a komponens fában (testvérként renderelve), a Radix close animation (~150ms) alatt az `AlertDialog` pillanatnyilag láthatóvá válhat.

**Fix pattern — kötelező minden olyan dialógnál ahol belső `AlertDialog` is van:**

```tsx
// 1. Dialog onOpenChange-ben reseteld az összes ephemeral state-et
<Dialog open={isOpen} onOpenChange={(open) => {
  setIsOpen(open);
  if (!open) {
    setDeleteTarget(null);
    setBatchDeleteOpen(false);
    setSelectedIds(new Set());
  }
}}>

// 2. AlertDialog open prop tartalmaz isOpen guard-ot
<AlertDialog open={isOpen && !!deleteTarget} ...>
<AlertDialog open={isOpen && batchDeleteOpen} ...>
```

**Miért:** A Radix `Portal` az AlertDialogot a `<body>` szintjén rendereli. Ha a szülő Dialog close animation fut, és a belső state még `true`, az AlertDialog portal rövid ideig visible állapotba kerülhet. Az `isOpen &&` guard ezt megakadályozza.

**Implementálva:** `InvoiceFilesDialog`, `UploadedFilesModal`

---

## Overlay Stílus Konvenciók

| Kontextus | Overlay | Blur |
|-----------|---------|------|
| Standard Dialog | `bg-black/80` | – |
| Idle Warning | `bg-black/60` | `backdrop-blur-md` |
| Sign-out | `bg-background/95` | `backdrop-blur-sm` |
| Error Boundary | – | `backdrop-blur-md` (card-on) |

---

## ⭐ Async Confirm Dialog Pattern (DB műveletek)

> **Kötelező minta** minden olyan dialógushoz, amely megerősítés után DB műveletet (API call-t) hajt végre.

### Szabály

A dialog **nyitva marad** az API hívás teljes ideje alatt loading állapottal. Bezáródni és toast-ot mutatni **csak a válasz megérkezése után** szabad.

### Flow

```
User kattint "Megerősítés" →
  1. setLoading(true)
  2. Gombok: disabled, Loader2 animate-spin, szöveg csere
  3. API call (await)
  4. Toast (siker / hiba)
  5. finally { setLoading(false); setModalOpen(false); cleanup(); }
```

### ❌ Anti-pattern (TILOS)

```tsx
// NE csináld ezt — a dialog bezárul az API hívás ELŐTT
setModalOpen(false);      // ← Modal eltűnik
setLoading(true);
await apiCall();          // ← User nem lát semmit
```

### ✅ Helyes implementáció

**Handler:**

```tsx
const handleConfirm = async () => {
  setLoading(true);
  try {
    const result = await postManagementData('action', payload);
    toast({ title: 'Sikeres', description: '...' });
    // ... invalidate queries, clear selection
  } catch (e) {
    toast({ title: 'Sikertelen', description: '...', variant: 'destructive' });
  } finally {
    setLoading(false);
    setModalOpen(false);   // ← Modal CSAK itt záródik be
    setTargets([]);
  }
};
```

**UI gombok:**

```tsx
{/* Cancel — disabled loading közben */}
<Button variant="ghost" size="sm" onClick={() => setModalOpen(false)} disabled={loading}>
  Mégse
</Button>

{/* Action — Loader2 ikon + szöveg csere */}
<Button variant="destructive" size="sm" className="gap-1.5"
  onClick={handleConfirm} disabled={loading}>
  {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
  {loading ? 'Törlés…' : 'Végleges törlés'}
</Button>
```

### Checklist (minden async confirm dialog-ra)

| # | Szempont | Kötelező |
|---|---------|----------|
| 1 | `setLoading(true)` az API hívás **előtt** | ✅ |
| 2 | Modal **NEM** záródik be az API hívás előtt | ✅ |
| 3 | Cancel gomb `disabled={loading}` | ✅ |
| 4 | Action gomb `disabled={loading}` | ✅ |
| 5 | `Loader2 animate-spin` a loading ikonhoz | ✅ |
| 6 | Szöveg csere loading közben (pl. `'Törlés…'`) | ✅ |
| 7 | Toast success a try-ban | ✅ |
| 8 | Toast error a catch-ben | ✅ |
| 9 | `setModalOpen(false)` a `finally`-ban | ✅ |

### Implementálva

| Fájlok végleges törlés | `ManagementDashboard.tsx` (Fájlok tab) | `bulkDeleting` (A/B mód: Sor törlése vs Storage + sor) |
| Error retry | `ManagementDashboard.tsx` (Hibák tab) | `retrying` |
| Error delete | `ManagementDashboard.tsx` (Hibák tab) | `deleting` |
| Error delete ALL | `ManagementDashboard.tsx` (Hibák tab) | `deletingAll` |

---

## Globális Fájl Előnézet Pattern (FilePreviewContent)

> **Döntés (2026-07-09):** A fájlok előnézetéért felelős dialógusok egységesítve lettek. A CSV és Excel (.xls, .xlsx) formátumok globálisan támogatottak lettek minden előnézet panelben.

### Támogatott Formátumok & Megjelenítési Technológia

| Formátum | Kiterjesztés | Megjelenítési Mód | Megjegyzés |
|----------|--------------|-------------------|------------|
| **PDF** | `.pdf` | `<iframe>` PDF Viewer | Beépített böngésző PDF renderelő |
| **Kép** | `.png`, `.jpg`, `.jpeg`, `.webp`, `.gif`, `.svg`, `.bmp` | `<img>` tag flex centerben | Kép arányos igazítással |
| **Excel** | `.xls`, `.xlsx`, `.xlsm` | `<iframe>` MS Office Web Viewer | Microsoft felhő alapú beágyazott Excel renderelő |
| **CSV** | `.csv`, `.tsv` | Egyedi kliens-oldali táblázat | Automatikus `,` / `;` detektálás, első 100 sor limit |
| **Egyéb** | – | Letöltés kártya | Letöltési gombbal és megnyitás új lapon opcióval |

### CSV Előnézet Működése (CsvPreviewComponent)
A kliensoldali CSV renderelő a megadott tárolási URL-ről fetch-eli a fájlt mint nyers szöveget (`res.text()`).
1. **Elválasztó karakter automatikus detektálása**: Ha a sor tartalmaz pontosvesszőt (`;`), akkor pontosvesszővel szeli a cellákat, egyébként vesszővel (`,`).
2. **Idézőjelek tisztítása**: Eltávolítja a cella szélén maradó extra idézőjeleket (`row.map(cell => cell.replace(/^"|"$/g, ''))`).
3. **Fejléc kiemelés**: Az első sor (`rIdx === 0`) félkövér fejléc hátteret kap a könnyebb olvashatóságért.
4. **Biztonsági limit**: Csak az első 100 sor kerül renderelésre a memória és DOM teljesítmény védelméért.

### Reusable Komponensek
A két globális komponens a `ManagementDashboard.tsx` fájlban:
* `FilePreviewContent`: Kezeli az elágazásokat a kiterjesztés alapján.
* `CsvPreviewComponent`: Felelős a CSV-k aszinkron betöltéséért és táblázatos rendereléséért.

### Kattintható Fájlok és Linkek Design Irányelvei

* **Kattinthatóság & Színezés**: Ha egy fájlnév vagy dokumentum link kattintható (vagyis elérhető hozzá letöltési vagy előnézeti URL), a szövegszíne **MINDIG** a felület elsődleges színe kell legyen (`text-teal-600 dark:text-teal-400`). Ez a design token garantálja a vizuális konzisztenciát.
* **Hover állapot**: A link fölé víve a kurzort a színnek finoman változnia kell (`hover:text-teal-700 dark:hover:text-teal-300`), a konténernek pedig jeleznie kell az interaktivitást (pl. `hover:bg-zinc-200/85` / `dark:hover:bg-zinc-900/85` és `cursor-pointer`).
