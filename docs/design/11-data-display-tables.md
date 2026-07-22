# 11 — Adatmegjelenítés & Táblázatok

> Táblázat stílusok, pagination, chart-ok, pénzügyi számok formázása.

---

## Compact Table Stílus

**Fájl:** `index.css`

```css
.compact-table {
  font-size: 0.875rem;  /* text-sm */
  table-layout: auto;   /* tartalom szerinti oszlopszélesség */
}

.compact-table th {
  padding: 0.5rem;
  font-size: 0.75rem;   /* text-xs */
  height: 45px;
  max-height: 45px;
}

.compact-table td {
  padding-top: 0.25rem;
  padding-bottom: 0.25rem;
  padding-left: 0.5rem;
  padding-right: 0.5rem;
  height: 45px;
  max-height: 45px;
  /* NE legyen overflow: hidden — a horizontális scroll kezeli */
}

.compact-table tr {
  height: 45px;
  max-height: 45px;
}
```

> **Fix 45px sor magasság:** Biztosítja a layout stabilitást — a sorok sosem nőnek a tartalom szerint, ami megakadályozza a layout shift-eket scrollozás közben.

---

## Standard Tábla Layout Szabályok

> **Döntés (2026-06-08):** A táblák soha nem vághatják le a tartalmat. Keskenyebb felbontáson horizontálisan scrollozhatónak kell lenniük.

### 1. `table-layout: auto` (nem `fixed`)

A `table-layout: fixed` kényszeríti a táblát a konténer szélességébe, ami levágja a tartalmat. Az `auto` mód a tartalom szerint méretezi az oszlopokat.

**Kivétel (Operator / Dashboard táblázatok):**
Ha a táblázat paginált (pl. a Management Dashboard hibalistái vagy naplói), és meg kell akadályozni, hogy a különböző hosszúságú szövegek (pl. fájlnevek, cégnevek) miatt az oszlopok elugráljanak (column shifting) lapozás közben:
- Használj `table-fixed` (Tailwind) elrendezést.
- Határozz meg fix szélességet a `<th>` fejléceken (pl. `w-[100px]`, `w-[160px]`).
- **Szimmetrikus oszlopközök (Badge-ek és fix szövegek):** Amennyiben egymás mellett fix szélességű szövegek (pl. dátum) és fix szélességű komponensek (pl. `w-[75px]` méretű pipeline badge) helyezkednek el, adj meg azonos szélességet a fejléceken (pl. mindkettő `w-[110px]`), hogy a köztük lévő vizuális távolság (gap) tökéletesen kiegyensúlyozott és szimmetrikus legyen.
- Hagyj egy rugalmas oszlopot (pl. Fájlnév) fix szélesség nélkül, hogy dinamikusan kitöltse a fennmaradó helyet, és a benne lévő elemeken alkalmazz `truncate` csonkolást.

### 1b. Expandable Rows Pattern (Lenyitható részlet-sorok)

Ha a táblázat egyes soraihoz részletesebb háttéradat (pl. részletes hibaüzenet, JSON log) tartozik, az alábbi mintát kell követni:
- **Fragment csomagolás**: A `map` ciklusban a fő `<tr>`-t és a lenyíló részlet `<tr>`-t egy `<React.Fragment key={item.id}>` blokkba kell csomagolni.
- **Kattintható sor**: A fő `<tr>` kapjon `cursor-pointer hover:bg-muted/30` osztályokat és egy `onClick` kezelőt, ami váltja a lenyitott sor ID-ját.
- **Esemény-terjedés gátlása**: Minden olyan belső interaktív elemen (pl. fájl előnézet link, újraküldés ikon), ami nem a sor lenyitását szolgálja, kötelező az `e.stopPropagation()` hívása.
- **Részlet sor kialakítása**: A lenyíló részlet sor (`<tr>`) kapjon finom státusz-háttérszínt (pl. hiba esetén `bg-red-500/5`) és egy `colSpan={TOTAL_COLS}` cellát, amelyben bal oldali színes szegély (`border-l-2`) és `whitespace-pre-wrap` segítségével tisztán olvasható a részletes log/üzenet.

### 2. Horizontális scroll wrapper

```tsx
<div className="rounded-lg border border-border/50 overflow-x-auto">
  <Table className="compact-table min-w-max">
    {/* ... */}
  </Table>
</div>
```

- `overflow-x-auto` a wrapper `<div>`-en → scrollbar megjelenik ha szükséges (tooltip-ek és egyéb lebegő elemek nem vágódnak le vertikálisan)
- `min-w-max` (számláknál) vagy `min-w-[1000px]` (tranzakcióknál fixed col layout esetén) a `<table>`-ön → a tábla soha nem nyomódik kisebbre a tartalomnál, elkerülve a cellák és feliratok egymásra csúszását kis felbontásnál

> **Döntés (2026-06-18 & 2026-06-19):** `overflow-auto` → `overflow-x-auto`. Az `overflow-auto` vertikálisan is vágja a kiugró elemeket (tooltip-ek, popover-ek). A tranzakciós tábla szintén megkapta az `overflow-x-auto` csomagolót és a `min-w-[1000px]` szélességet a torzulások megakadályozására.

### 3. Partner név truncálás (13 karakter)

A partner nevek 13 karakter felett `…`-tal levágódnak. A teljes név másolásra és tooltip-ként elérhető marad.

```tsx
<CopyableCell
  value={partnerName}
  displayValue={partnerName.length > 13 ? partnerName.slice(0, 13) + '…' : partnerName}
  truncate
  maxWidth="100%"
  className="font-medium text-xs"
  ariaLabel={`${partnerName} másolása`}
/>
```

> **Döntés (2026-06-18):** A másolható tooltip és másolás ikon (`CopyableCell`) kizárólag a Partner név és Biz.szám felett jelenik meg. A pénznem / összeg oszlopokról eltávolítottuk, így azok közvetlenül formázott szövegként (`formatCurrency`) jelennek meg, növelve a táblázat tisztaságát és az összegek olvashatóságát.

### 4. Oszlop szélességek

| Oszlop | Szabály | Megjegyzés |
|--------|---------|------------|
| Partner | 13 kar. truncate | `displayValue` JS truncálással |
| Kiáll. / Telj. (beküldött) | `w-[100px]` | Fix szélesség a `yyyy. MM. dd.` formátumnak |
| Kiáll. / Telj. (NAV) | `whitespace-nowrap` | Természetes szélesség, nem törik |
| Biz.szám | `min-w-[200px]` + `whitespace-nowrap` | Fejléc + cella egyaránt |
| Összeg oszlopok | `whitespace-nowrap` + `tabular-nums` | Számok nem törhetnek |

### 5. NE legyen `overflow: hidden` a cellákon

A `td` elemeken **tilos** az `overflow: hidden` — a horizontális scroll wrapper kezeli a túlcsordulást.


## Sor Elválasztók

> **Döntés (2026-06-18):** Border-alapú sor elválasztók eltávolítva. A sorok közötti vizuális elválasztás a különböző státusz háttérszínekből ered. A `border-b` konzisztencia-problémákat okozott `border-separate` módban (egyes celláknál megjelent, másoknál nem).

**Korábbi (archivált) megoldás:**
```css
/* NEM HASZNÁLJUK — csak referencia */
table tbody tr {
  box-shadow: inset 0 -1px 0 0 hsl(var(--foreground) / 0.08);
}
```

**Jelenlegi megoldás:** Nincs explicit sor elválasztó. A `border-collapse` biztosítja, hogy ne legyen rés a sorok között, a háttérszínek adják a vizuális struktúrát.

---

## Táblázat Komponensek

### Alap Table Primitívek (`ui/table.tsx`)

| Komponens | CSS | Felhasználás |
|-----------|-----|-------------|
| `<Table>` | `w-full caption-bottom text-sm border-collapse` | Tábla wrapper |
| `<TableHeader>` | – | Fejléc |
| `<TableBody>` | – | Tartalom |
| `<TableRow>` | `transition-colors` | Sor (border nélkül) |
| `<TableHead>` | `h-12 px-4 text-left font-medium text-muted-foreground` | Fejléc cella |
| `<TableCell>` | `p-4 align-middle` | Tartalom cella |

> **Döntés (2026-06-18):** `border-collapse` hozzáadva a `<table>` elemre, hogy ne legyen rés a cellák/sorok között. Az összes `border-b` eltávolítva a `<tr>` elemekről — a háttérszínek biztosítják a vizuális sorelválasztást.

### Table Empty State (`ui/table-empty-state.tsx`)

Üres táblázat placeholder. Lásd: [09-error-handling-feedback.md](./09-error-handling-feedback.md)

### Table Skeleton (`ui/table-skeleton.tsx`)

Betöltés alatti tábla placeholder skeleton animációval.

### Table Placeholder Rows (`ui/table-placeholder-rows.tsx`)

Üres placeholder sorok a tábla magasságának fenntartásához.

---

## Unified Pagination

**Fájl:** `ui/unified-pagination.tsx`

### Layout Shift Megelőzés (Placeholder Sorok)

Paginált táblázatok esetén, ha az utolsó lapra navigálva nincs elegendő elem a lapméret kitöltéséhez (pl. 10 helyett csak 6 elem van), a tábla magasságának összeesését és a pagination vezérlők elugrását **placeholder sorokkal** kell megelőzni.

A táblázat `<tbody>` végén ki kell egészíteni a sorokat a kívánt lapméretig (`emptyRowsCount = PAGE_SIZE - currentItems.length`):

```tsx
{(() => {
  const emptyRowsCount = PAGE_SIZE - currentItems.length;
  if (emptyRowsCount <= 0) return null;
  return Array.from({ length: emptyRowsCount }).map((_, index) => (
    <tr key={`placeholder-${index}`} className="border-b border-transparent">
      <td colSpan={COL_SPAN} className="px-3 py-1.5 select-none pointer-events-none">&nbsp;</td>
    </tr>
  ));
})()
```

Ezek a sorok transzparensek (nem kapnak látható keretet) és a bennük lévő `&nbsp;` karakter miatt pixel-pontosan megegyeznek egy átlagos sor magasságával, így a pagination szekció fixen a kártya alján marad.

### Layout

```
┌─────────────────────────────────────────────────────────┐
│ Találatok (500)  │  ⟨⟨ ⟨ 1 2 [3] 4 5 ⟩ ⟩⟩  │  Oldalméret [50▾] │
└─────────────────────────────────────────────────────────┘
```

| Szekció | Pozíció | Tartalom |
|---------|---------|----------|
| Bal | `justify-start` | Összesítés: „Találatok (500)" |
| Közép | `center` | Oldalszámok (max 5 látható) |
| Jobb | `justify-end` | Oldalméret választó |

### Oldalszám Megjelenítés

- Max 5 oldalszám egyszerre
- Aktív oldal: `variant="default"` (teal)
- Inaktív: `variant="ghost"`
- First/Last: `ChevronsLeft`/`ChevronsRight`
- Prev/Next: `ChevronLeft`/`ChevronRight`

### Oldalméret Opciók

Alapértelmezett: `[50, 100]`

### Összesítés Formázás

```tsx
totalItems > 10000 ? '10000+' : totalItems.toLocaleString('hu-HU')
```

---

## Pénzügyi Számok Formázás

### CSS

```css
.financial-number {
  font-family: monospace;
  font-variant-numeric: tabular-nums;
  font-feature-settings: "tnum" 1, "lnum" 1;
}
```

### Tailwind Pattern

```tsx
className="font-mono tabular-nums"
```

### Szám Formázás

```tsx
// Magyar formátum
value.toLocaleString('hu-HU')
// → "1 234 567"

// Pénznem
`${amount.toLocaleString('hu-HU')} Ft`
// → "1 234 567 Ft"
```

---

## Chart-ok (Recharts)

### Chart Színpaletta

A `chart.tsx` (10KB) komponens és a CSS tokenek biztosítják a konzisztens színezést:

| Index | Szín | Token |
|-------|------|-------|
| 1 | Teal | `--chart-1` |
| 2 | Kék | `--chart-2` |
| 3 | Narancs | `--chart-3` |
| 4 | Zöld | `--chart-4` |
| 5 | Rózsaszín | `--chart-5` |

### Revenue/Expenses Chart

**Fájl:** `components/dashboard/RevenueExpensesChart.tsx` (12KB)

Bevétel vs kiadás vonaldiagram a dashboard-on. A `eaisybill_dashboard_chart_lines` localStorage kulcsban tárolja, mely vonalak láthatók.

### Waterfall Chart (Tape Slide)

CSS animáció hover-re:

```css
.tape-slide:hover .tape-slide-inner {
  transform: scale(1.05);
}
```

---

## Tranzakció Típus Színkódolás

Táblázat sorok/badge-ek színezése tranzakció típus szerint. A logíkát a `getTypeBgClass()` függvény képviseli a `TransactionTable.tsx`-ben:

```tsx
// TransactionTable.tsx — getTypeBgClass()
const getTypeBgClass = (type: string | null): string => {
  const t = type?.toLowerCase().trim();
  if (t === 'szállítói tranzakció')
    return 'bg-[hsl(var(--tr-supplier-bg)/0.6)] text-[hsl(var(--tr-supplier-text))]';
  if (t === 'vevői tranzakció')
    return 'bg-[hsl(var(--tr-customer-bg)/0.6)] text-[hsl(var(--tr-customer-text))]';
  // ...többi típus ugyanezt a mintát követi
  return '';
};
```

**Minta:** `bg-[hsl(var(--tr-xxx-bg)/0.6)] text-[hsl(var(--tr-xxx-text))]`
- Háttér: 60%-os opacity a CSS változón
- Szöveg: `--tr-xxx-text` változó — light mode-ban sötét (25% lightness), dark mode-ban fehér/világos (85–100%)

> **⚠️ Bug fix (2026-06-24):** A korábbi implementáció `text-white`-t használt. Light mode-ban a pasztell háttéren (92% lightness) ez WCAG-szinten olvashatatlan volt. Az állásfoglalás: **SOHA ne használj hardkódolt `text-white`-ot a tranzakció badge-eken** — minélta CSS változókat.

14 különböző tranzakció típus, mindkét módban. Șsszefüggő token lista: [02-design-tokens.md](./02-design-tokens.md#tranzakció-típus-színek).

---


## Sor Státusz Kiemelés

> **Döntés (2026-06-18 & 2026-07-22):** A sorok státuszát és kijelölését kizárólag háttérszín jelzi. A korábbi `border-l-2` bal oldali színjelzők eltávolítva — zavaró vizuális elemet és layout shift-et adtak.

> **⚠️ Kijelölési Stabilitási Szabályok (2026-07-22):**
> 1. **Dinamikus keretek tiltása:** Kijelöléskor a sor kizárólag háttérszínt vált (`bg-primary/10 hover:bg-primary/15`). Tilos `border-l-2`, `ring` vagy egyéb dinamikus keretet hozzáadni kijelöléskor, mert eltolja a cellák tartalmát (layout shift).
> 2. **NE használj `font-medium` / `font-bold` osztályt kijelölt soron:** A közepes/félkövér betűtípus karakterei vastagabbak és szélesebbek. Ha kijelöléskor `font-medium`-ot adunk a sorhoz, a nem-monospaced szövegek (Partner név, Dátum) vízszintesen szétnyúlnak. A kijelölt sorban a betűvastagság maradjon azonos az inaktív soréval (`font-normal`).

### TransactionTable — `getRowBackgroundClass()`

| Státusz | CSS osztály |
|---------|------------|
| `matched` | `bg-[var(--row-matched-bg)]` |
| `suggested` | `bg-[var(--row-suggested-bg)]` |
| `auto_settled` | `bg-[var(--row-settled-bg)]` |
| `no_invoice` | `bg-[var(--row-noinvoice-bg)]` |
| `invoice_missing` | `bg-[var(--row-missing-bg)]` |
| `unmatched` (default) | `bg-[var(--row-unmatched-bg)]` |

### InvoicesPage — sor osztályok

| Feltétel | CSS osztály |
|----------|------------|
| Kifizetve (`isPaid`) | `bg-[var(--row-matched-bg)]` |
| Javaslat (`suggestedOnly`) | `bg-[var(--row-suggested-bg)]` |
| Nincs párosítva | `bg-[var(--row-unmatched-bg)]` |
| Kijelölve | `bg-primary/10` (font-medium nélkül) |

> **Korábbi (archivált) megoldás:** `border-l-2 border-l-[var(--row-*-border)]` — a sor bal szélén 2px színes csík volt. Ez `border-separate` módban réseket okozott, `border-collapse`-nál pedig a háttérszínnel együtt feleslegessé vált.

---

## Copyable Cell Pattern

Táblázat cellák kattintásra másolhatók:

```
Normál állapot:     INV-2024-001
Hover:              INV-2024-001 📋    ← Copy ikon megjelenik
Click:              INV-2024-001 ✓     ← Check ikon + toast
```

Részletes leírás: [04-component-library.md](./04-component-library.md#copyable-cell)

---

## Expanded Row Pattern

**Fájl:** `components/ExpandedInvoiceRow.tsx` (24KB)

Számla táblázat sorok kibonthatók részletes nézetté, ami tartalmazza:
- Számla képe/PDF
- Tételek listája
- Párosítási információk (tranzakció, beküldött számla, NAV számla)
- **AI indoklás** megjelenítése a párosított tranzakción (ha van `reason` mező)
- Hivatkozott számlák láncolata (linked invoices)
- Futárszolgálat riportok (courier reports)
- Szerkesztési/leválasztási/jóváhagyási lehetőségek
- Tranzakció kézi hozzárendelés (inline search)

---

## Metric Card Grid

Dashboard KPI kártyák elrendezése:

```tsx
<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
  <MetricCard title="Bevétel" ... />
  <MetricCard title="Kiadás" ... />
  <MetricCard title="Eredmény" ... />
  <MetricCard title="Nyitott számlák" ... />
</div>
```

| Breakpoint | Oszlopok |
|-----------|---------|
| `< sm` | 1 |
| `sm` – `lg` | 2 |
| `lg+` | 4 |

---

## Export Formátumok

| Formátum | Könyvtár | Felhasználás |
|----------|----------|-------------|
| Excel (.xlsx) | `exceljs` / `xlsx` | Számla, tranzakció export |
| PDF | `jspdf` + `jspdf-autotable` | Éves beszámoló, ÁFA bevallás |
| CSV | `papaparse` | Adat import/export |
| XML | Custom | ÁFA bevallás XML |
