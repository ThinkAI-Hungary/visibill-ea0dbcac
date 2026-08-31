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

    <DialogFooter className="flex-row items-center justify-between">
      <div className="flex flex-col text-left min-w-[200px]">
        <span className="text-xs font-semibold tabular-nums">Összegzés</span>
      </div>
      <div className="flex items-center gap-2">
        <Button variant="outline" onClick={handleCancel}>Mégse</Button>
        <Button onClick={handleSubmit} className="min-w-[140px] justify-center tabular-nums">Mentés</Button>
      </div>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

> **⚠️ DialogFooter Gomb és Összegző Stabilitás (2026-07-22):**
> A megerősítő gomb feliratában kerüljük a dinamikusan hosszabbodó számlálókat (preferáljuk az `Exportálás` feliratot az `Exportálás (X db)` helyett), és adjunk a gombnak fix minimális szélességet (pl. `min-w-[140px]`) `tabular-nums` beállítással. Így a számlálók és összegek változása nem növeli meg a gomb méretét, és nem tolja el a mellette lévő „Mégse" gombot.

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

| Dialog | Fájl | Méret | Leírás |
|--------|------|-------|--------|
| `TransactionDetailsDialog` | `src/components/TransactionDetailsDialog.tsx` | ~10KB (218 sor) | **Moduláris Dialog Orchestrator (A-059)**: Tranzakció fejléc, kártya, párosított bizonylatok, többszörös párosítások, manuális kereső, főkönyvi számlaválasztó és jegyzetek sub-komponensekből (`src/components/transaction-details/`). |

### Egyéb Dialógusok & Részlet Panelek

| Komponens | Fájl | Méret | Felhasználás |
|-----------|------|-------|-------------|
| `AssetActivationDialog` | `src/components/AssetActivationDialog.tsx` | 21KB | TENY tárgyi eszköz aktiválási varázsló |
| `ChangePasswordDialog` | `src/components/ChangePasswordDialog.tsx` | 8KB | Jelszó módosítás és megerősítés |
| `ChangeEmailDialog` | `src/components/ChangeEmailDialog.tsx` | 9KB | Email cím módosítási folyamat |
| `CMREscalationDialog` | `src/components/CMREscalationDialog.tsx` | 15KB | Szállítmányozási fuvar-számla eltérés eszkaláció |
| `FeedbackDialog` | `src/components/FeedbackDialog.tsx` | 22KB | Visszajelzés küldés instant DOM canvas screenshot csatolással (`sm:max-w-[720px]`, 2-oszlopos grid) |
| `IdleWarningModal` | `src/components/IdleWarningModal.tsx` | 3KB | Inaktivitás visszaszámláló és session hosszabbítás (z-[9999]) |
| `UnsavedChangesDialog` | `src/components/UnsavedChangesDialog.tsx` | 1.3KB | React Router `useBlocker` elnavigálás védelem |
| `SupplierInvoiceAssignment` | `src/components/SupplierInvoiceAssignment.tsx` | 15KB | Szállító-számla tömeges projekt összerendelés |
| `ExpandedInvoiceRow` | `src/components/ExpandedInvoiceRow.tsx` | 80KB | Kétoszlopos lenyitható számlarészlet: balra képelőnézet és ÁFA bontás, jobbra banki tranzakció és tételes GL osztályozás |

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

---

## Kiválasztási és Kereső Dialógusok (Selection & Search Modals) Irányelvei (2026-07-14)

Ha új modalt vagy dialógust hozunk létre keresési, szűrési és kijelölési funkciókkal (pl. számla csatolás jegyzethez), az alábbi UX/UI szabályokat **kötelező** betartani:

### 1. Layout Shift Védelem (Fix Listamagasság)
* A dinamikusan betöltődő elemek listáját (eredmények konténerét) **mindig fix magasságú** flex boxként kell definiálni (pl. `h-[320px] flex flex-col overflow-y-auto`).
* A töltőállapot (spinner) és az üres lista üzenet (empty state) a konténeren belül függőlegesen középre igazítandó (`my-auto flex flex-col items-center justify-center`).
* **Miért:** Így a dialógus magassága teljesen stabil marad, nem ugrál a betöltés közben vagy üres keresési eredményeknél.

### 2. Akció Gombok Pozíció-Stabilitása
* A kijelölést megerősítő főgombnak a footerben **fix szélességet** kell adni (pl. `w-[220px] shrink-0 justify-center`).
* **Miért:** A gomb szövegében szereplő darabszám változásakor (pl. `(1 db)` -> `(12 db)`) a gomb szélessége nem nyúlhat meg, különben eltolja a mellette lévő gombokat (pl. a *"Mégse"* gombot), ami rontja a felhasználói élményt és layout shiftet okoz a footerben.

### 3. Tisztított Kijelölési Stílus (Dupla Ring Elkerülése)
* A kijelölt kártyás elemek vagy láthatósági választógombok aktív állapotánál **tilos** egyszerre használni a szegélyt és a focus ringet (pl. `border-primary ring-1 ring-primary`).
* A kijelölt állapotot **kizárólag** az elsődleges szegéllyel és egy finom háttérszínnel jelezzük (pl. `border-primary bg-primary/5 text-primary`), elhagyva a `ring-1 ring-primary` stílust.
* **Miért:** A dupla kerethatás szükségtelenül vastagítja és durvítja a kijelölési szegélyt, rontva a prémium design finomságát.

### 4. Tömeges Kijelölés (Bulk Selection) és Checkboxok
* Kereső dialógusoknál a gombra kattintásos azonnali bezáródás helyett **tömeges kijelölést** kell támogatni.
* Minden sor elejére egy jelölőnégyzetet (checkbox) kell tenni, amellyel az elemek állapota külön-külön kapcsolgatható.
* A lista fejlécében elhelyezendő egy *"Összes kijelölése"* / *"Kijelölések megszüntetése"* gyorsgomb a tömeges műveletek megkönnyítésére.
* A dialog footerében lévő confirm gomb mutatja a kijelölt elemek számát, és csak kattintásra menti el azokat a szülő formba.

---

## ⭐ Async Modal UX — Általános Kötelező Irányelv (2026-07-20)

> **Ez az irányelv KÖTELEZŐ minden olyan dialógusra, amely adatmódosítást hajt végre (mentés, törlés, újraküldés, státuszváltás, vagy bármilyen backend operation).**

### A probléma: "Early Close" antipattern

❌ **TILOS ez a sorrend:**
```
1. Felhasználó: kattint "Mentés"
2. API hívás elindul (aszinkron)
3. Modal bezárul → "Sikeres!" toast megjelenik
4. [1-3 másodperc múlva] A tábla frissül, sorok megváltoznak/eltűnnek
```

**Miért rossz:**
- A felhasználó azt látja: a modal bezárt, de a lista nem változott → "Megcsinálta? Nem csinálta?"
- Inkonzisztens állapot: a UI más adatot mutat mint a backend
- Darabos, "ugrálós" élmény — csökkenti a rendszerbe vetett bizalmat

### A helyes minta: "Confirmed Close" — modal csak DB-szinkron után záródhat

✅ **KÖTELEZŐ ez a sorrend:**
```
1. Felhasználó: kattint "Mentés"
2. Modal: loading state (spinner, gombok disabled)
3. API hívás lefut
4. Frontend refetch/invalidate — await-elve
5. [Sorok már frissültek/eltűntek]
6. Modal bezárul
7. Toast megjelenik
```

### Implementációs minta: operationPhase állapotgép

Minden async műveletet végző dialógusnál az alábbi pattern kötelező:

```typescript
// Típus — a konkrét névtől függően (retryPhase, savePhase, deletePhase stb.)
type OperationPhase = 'idle' | 'submitting' | 'syncing';
const [phase, setPhase] = useState<OperationPhase>('idle');

const handleConfirm = async () => {
  setPhase('submitting');          // 1. Gomb disabled, spinner megjelenik

  await performBackendOperation(); // 2. API hívás

  setPhase('syncing');             // 3. "Szinkronizálás..." fázis

  // 4. KÖTELEZŐ: await-elt refetch — ne fire-and-forget!
  await queryClient.invalidateQueries({ queryKey: ['relevant-key'] });
  // VAGY: await queryClient.refetchQueries(['relevant-key']);

  // 5. Csak MOST zárul be a modal — az adatok már frissültek
  setPhase('idle');
  setOpen(false);

  // 6. Toast az UTOLSÓ lépés
  toast.success('Sikeres mentés');
};
```

### Modal loading state UI szabályok

| Fázis | Gomb állapot | Gomb szöveg | X gomb |
|---|---|---|---|
| `idle` | Aktív | "Mentés" / "Küldés" stb. | Kattintható |
| `submitting` | `disabled` + spinner | _(spinner ikon)_ | `disabled` |
| `syncing` | `disabled` + spinner | _(spinner ikon)_ | `disabled` |

```tsx
// Helyes: csak spinner, semmiféle szöveges "Frissítés..." felirat
<Button disabled={phase !== 'idle'}>
  {phase !== 'idle'
    ? <Loader2 className="h-4 w-4 animate-spin" />
    : 'Mentés'}
</Button>
```

> ❌ **TILOS** a "Frissítés...", "Feldolgozás...", "Kérjük várjon..." szöveges felirat — helyette kizárólag a Loading spinner.

### Mikor NEM kell await-elt refetch?

Ha a backend operation **Realtime subscription-on keresztül** automatikusan frissíti a frontendet (pl. `supabase.channel(...).on('postgres_changes', ...)`), az await-elt refetch helyett elegendő megvárni a Realtime event érkezését. Ez azonban csak akkor alkalmazható, ha:
1. A Realtime feliratkozás biztosan aktív az adott nézetben
2. A subscription latency ismert és < 500ms

Kétség esetén az await-elt refetch a biztonságos választás.

### Referencia implementáció

- `ManagementDashboard.tsx` — Bulk Retry UX (`retryPhase` állapotgép, 2026-07-20)

