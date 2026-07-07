# 04 — Komponens Könyvtár

> Teljes lista a shadcn/ui és egyedi komponensekről, variánsaikról és használati mintáikról.

---

## shadcn/ui Komponensek (60 fájl)

### Primitív UI Elemek

| Komponens | Fájl | Radix Primitív | Megjegyzés |
|-----------|------|----------------|------------|
| **Button** | `button.tsx` | `@radix-ui/react-slot` | CVA variánsok |
| **Badge** | `badge.tsx` | – | Státusz jelzők |
| **Input** | `input.tsx` | – | Form input |
| **Textarea** | `textarea.tsx` | – | Többsoros input |
| **Label** | `label.tsx` | `@radix-ui/react-label` | Form label |
| **Checkbox** | `checkbox.tsx` | `@radix-ui/react-checkbox` | Jelölőnégyzet |
| **Radio Group** | `radio-group.tsx` | `@radix-ui/react-radio-group` | Rádiógombok |
| **Switch** | `switch.tsx` | `@radix-ui/react-switch` | Kapcsoló |
| **Slider** | `slider.tsx` | `@radix-ui/react-slider` | Csúszka |
| **Select** | `select.tsx` | `@radix-ui/react-select` | Legördülő |
| **Separator** | `separator.tsx` | `@radix-ui/react-separator` | Elválasztó |
| **Progress** | `progress.tsx` | `@radix-ui/react-progress` | Folyamatjelző |
| **Avatar** | `avatar.tsx` | `@radix-ui/react-avatar` | User avatar |
| **Skeleton** | `skeleton.tsx` | – | Loading placeholder |

### Overlay & Dialog

| Komponens | Fájl | Radix Primitív |
|-----------|------|----------------|
| **Dialog** | `dialog.tsx` | `@radix-ui/react-dialog` |
| **Alert Dialog** | `alert-dialog.tsx` | `@radix-ui/react-alert-dialog` |
| **Sheet** | `sheet.tsx` | `@radix-ui/react-dialog` |
| **Drawer** | `drawer.tsx` | `vaul` |
| **Popover** | `popover.tsx` | `@radix-ui/react-popover` |
| **Hover Card** | `hover-card.tsx` | `@radix-ui/react-hover-card` |
| **Tooltip** | `tooltip.tsx` | `@radix-ui/react-tooltip` | Portal-wrapped |
| **Toast** | `toast.tsx` | `@radix-ui/react-toast` |
| **Toaster** | `toaster.tsx` | – |

### Navigáció & Menü

| Komponens | Fájl | Radix Primitív |
|-----------|------|----------------|
| **Sidebar** | `sidebar.tsx` (24KB) | – |
| **Tabs** | `tabs.tsx` | `@radix-ui/react-tabs` |
| **Accordion** | `accordion.tsx` | `@radix-ui/react-accordion` |
| **Collapsible** | `collapsible.tsx` | `@radix-ui/react-collapsible` |
| **Navigation Menu** | `navigation-menu.tsx` | `@radix-ui/react-navigation-menu` |
| **Menubar** | `menubar.tsx` | `@radix-ui/react-menubar` |
| **Context Menu** | `context-menu.tsx` | `@radix-ui/react-context-menu` |
| **Dropdown Menu** | `dropdown-menu.tsx` | `@radix-ui/react-dropdown-menu` |
| **Command** | `command.tsx` | `cmdk` |
| **Breadcrumb** | `breadcrumb.tsx` | – |
| **Pagination** | `pagination.tsx` | – |

### Adat & Layout

| Komponens | Fájl |
|-----------|------|
| **Card** | `card.tsx` |
| **Table** | `table.tsx` |
| **Scroll Area** | `scroll-area.tsx` |
| **Aspect Ratio** | `aspect-ratio.tsx` |
| **Resizable** | `resizable.tsx` |
| **Carousel** | `carousel.tsx` |
| **Calendar** | `calendar.tsx` |
| **Chart** | `chart.tsx` (10KB) |

### Form

| Komponens | Fájl |
|-----------|------|
| **Form** | `form.tsx` |
| **Input OTP** | `input-otp.tsx` |
| **Toggle** | `toggle.tsx` |
| **Toggle Group** | `toggle-group.tsx` |
| **Alert** | `alert.tsx` |

---

## Egyedi Komponensek (Nem shadcn/ui)

### Page Header
**Fájl:** `ui/page-header.tsx`

Egységes oldalcím komponens breadcrumb-bal:

```tsx
<PageHeader
  companyName="Teszt Kft."
  breadcrumb="ÁFA Bevallás (2665)"
  title="ÁFA Bevallás"
  description="Negyedéves ÁFA bevallás generálás"
  actions={<Button>Generálás</Button>}
/>
```

**Struktúra:**
- Breadcrumb strip: cég név + oldal label (`text-xs text-muted-foreground`)
- Title row: h1 (`text-3xl font-bold`) + actions slot
- `print:hidden` — nyomtatáskor elrejtve

### Loading Spinner
**Fájl:** `ui/loading-spinner.tsx`

Full-page loading indikátor:

```tsx
<LoadingSpinner
  size="lg"          // sm | md | lg
  fullPage={true}    // false = inline
  message="Betöltés..."
/>
```

**Viselkedés:**
- Automatikusan eltávolítja az `#initial-loader` HTML elemet mount-kor
- Full-page: `fixed inset-0 z-[9999]` pozíció
- Border-based spinner: `animate-spin rounded-full border-primary border-r-transparent`

### Content Skeleton
**Fájl:** `ui/content-skeleton.tsx`

Tartalom placeholder a sidebar shell-en belül:

```
┌─ Page header skeleton ─┐
│  ███████ (h-8 w-48)     │
│  ████████████ (h-4 w-64)│
├─ KPI cards ─────────────┤
│ ┌────┐ ┌────┐ ┌────┐ ┌────┐ │
│ │ ██ │ │ ██ │ │ ██ │ │ ██ │ │
│ └────┘ └────┘ └────┘ └────┘ │
├─ Table skeleton ────────┤
│  ████ ████████ ████     │
│  ████ ████████ ████     │
│  ████ ████████ ████     │
└─────────────────────────┘
```

### Unified Pagination
**Fájl:** `ui/unified-pagination.tsx`

Egységes lapozó komponens az összes táblázathoz:

```tsx
<UnifiedPagination
  currentPage={1}
  totalPages={10}
  totalItems={500}
  pageSize={50}
  onPageChange={setPage}
  onPageSizeChange={setPageSize}
  pageSizeOptions={[50, 100]}
/>
```

**Layout:** `Találatok (500) | ⟨⟨ ⟨ 1 2 3 4 5 ⟩ ⟩⟩ | Oldalméret [50▾]`

**KPI-aware paginálás:** A számlák oldalon a `totalPages` dinamikusan számolt:
- KPI szűrő inaktív → szerver-oldali `navTotalPages` (Supabase `.range()`)
- KPI szűrő aktív → `Math.ceil(kpiFilteredTotalItems / pageSize)` — kliens-oldali

### Copyable Cell
**Fájl:** `ui/copyable-cell.tsx`

Kattintásra másolható cella tooltip-pal:

```tsx
<CopyableCell
  value="INV-2024-001"
  displayValue="INV-2024-001"
  truncate={true}
  maxWidth="150px"
/>
```

**Viselkedés:**
- Hover: Copy ikon megjelenik (`opacity-0 → group-hover:opacity-100`)
- Click: vágólapra másolás + toast értesítés „Másolva"
- Tooltip: teljes érték megjelenítése

> **Használati irányelv (2026-06-18):** A `CopyableCell` kizárólag szöveges és azonosító mezőknél (pl. Partner név, Bizonylatszám) használandó. Pénzügyi összegek / devizák esetén nem használjuk, a vizuális zaj csökkentése érdekében.

### iOS Toggle
**Fájl:** `ui/ios-toggle.tsx`

iOS stílusú toggle kapcsoló szöveges label-lel:

```tsx
<IosToggle
  checked={isPaid}
  onCheckedChange={setIsPaid}
  onLabel="Fizetve"     // Zöld (success) háttér
  offLabel="Nyitott"    // Narancs (warning) háttér
/>
```

**Vizuális:**
- `h-[22px] w-[66px]` — kompakt méret
- Zöld (`bg-success`) amikor ON, narancs (`bg-warning`) amikor OFF
- Fehér csúszó knob: `h-[16px] w-[16px]`
- `text-[8px]` belső felirat

### Table Empty State
**Fájl:** `ui/table-empty-state.tsx`

Üres táblázat placeholder:

```tsx
<TableEmptyState
  colSpan={8}
  icon={SearchX}
  title="Nincs megjeleníthető adat"
  description="Próbáld módosítani a szűrőket."
  onClearFilters={handleClearFilters}
  clearLabel="Szűrők törlése"
/>
```

**Struktúra:**
- Centered layout a táblázat teljes szélességében
- Ikon: `rounded-xl bg-muted/50 p-4`
- Opcionális „Szűrők törlése" gomb

### Table Skeleton / Placeholder Rows
- `ui/table-skeleton.tsx` — teljes tábla skeleton
- `ui/table-placeholder-rows.tsx` — üres placeholder sorok

### Financial Skeleton
**Fájl:** `ui/financial-skeleton.tsx` — Pénzügyi oldal specifikus skeleton layout

### Rich Text Editor
**Fájl:** `ui/rich-text-editor.tsx` — TipTap alapú rich text szerkesztő

### Partner Type Filter
**Fájl:** `ui/partner-type-filter.tsx` — Partner típus szűrő (vevő/szállító)

---

## Button Variánsok

```tsx
const buttonVariants = cva("...", {
  variants: {
    variant: {
      default:     "bg-primary text-primary-foreground hover:bg-primary/90
                    dark:bg-primary/10 dark:text-primary dark:hover:bg-primary/20
                    dark:border dark:border-primary/20",
      destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-soft",
      outline:     "border border-border bg-background
                    hover:bg-primary/10 hover:text-primary hover:border-primary/30",
      secondary:   "bg-secondary text-secondary-foreground hover:bg-secondary/80 shadow-soft",
      ghost:       "hover:bg-accent/50 hover:text-accent-foreground",
      link:        "text-primary underline-offset-4 hover:underline",
      premium:     "bg-gradient-to-r from-primary to-accent text-primary-foreground shadow-soft",
    },
    size: {
      default: "h-11 px-6 py-2.5",
      sm:      "h-9 rounded-lg px-4 text-xs",
      lg:      "h-12 rounded-lg px-8 text-base",
      icon:    "h-11 w-11",
    },
  },
});
```

> **Dark mode pattern:** A `default` variant sötét módban átlátszó hátteret + teal szöveget + border-t kap, nem tömör teal hátteret. Ez a pattern konzisztens az egész alkalmazásban.

---

## Badge Variánsok

```tsx
const badgeVariants = cva("rounded-full px-2.5 py-0.5 text-xs font-semibold", {
  variants: {
    variant: {
      default:     "bg-primary text-primary-foreground",
      secondary:   "bg-secondary text-secondary-foreground",
      destructive: "bg-destructive text-destructive-foreground",
      outline:     "text-foreground",
      success:     "bg-success text-success-foreground",
      warning:     "bg-warning text-warning-foreground",
    },
  },
});
```

### Soft Badge Pattern (Management Dashboard, 2026-07-07)

A Management Dashboard Hibák panel **Forrás** és **Típus** badge-jei az ún. soft (fél-átlátszó) stilusút használják a teli kitöltés helyett:

```tsx
// ✅ Soft badge (Management Dashboard Forrás/Típus)
'bg-teal-500/15 text-teal-700 dark:text-teal-400 border-teal-500/30'   // Application
'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30' // Mailgun
'bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30'   // Worker

// ❌ Teli kitöltés — NE használd Forrás/Típus badge-eknél
'bg-teal-600 text-white'
```

**Szabályok:**
- Fix szélesség: `w-[100px] justify-center` mindktét oszlopnál
- Forrás badge színe **mindig megegyezik** a mellette lévő Típus badge színével (pl. Worker sornai = mindktét badge kék)
- Nincs hover effect (információs címke, nem interaktív)

---

## MetricCard (Dashboard KPI)

```tsx
<MetricCard
  title="Bevétel"
  value="1,234,567 Ft"
  description="+12% az előző hónaphoz"
  icon={TrendingUp}
  variant="success"    // default | success | warning | destructive | info
  trend={{ value: 12, isPositive: true }}
  onClick={handleClick}
/>
```

**Fix méret:** `h-[180px]` — konzisztens kártya magasság a dashboardon.

**Variant stílusok:**
- `default` → `border-border`
- `success` → `border-success/20 bg-success/5`
- `warning` → `border-warning/20 bg-warning/5`
- `destructive` → `border-destructive/20 bg-destructive/5`
- `info` → `border-info/20 bg-info/5`

---

## Kiegészítő Standalone Komponensek

A `components/` gyökérben található összetettebb komponensek:

### CompanySelector
**Fájl:** `CompanySelector.tsx` (17KB)

Cégválasztó dropdown a sidebar-ban, keresési funkcióval és Popover-alapú UI-val.

### LiveNotificationProvider
**Fájl:** `LiveNotificationProvider.tsx` (18KB)

Globális Supabase Realtime listener — 12 táblát figyel, és:
- Toast értesítést mutat új feldolgozott fájloknál (upload-onkénti debounce)
- TanStack Query cache-t automatikusan invalidálja INSERT/UPDATE/DELETE eseményeknél
- Client-side company_id szűrés (nem server-side Realtime filter)
- Tab visibility change-re automatikus reconnect + broad invalidation
- Debounced invalidation (500ms) — megelőzi a burst frissítéseket

### UploadHistory
**Fájl:** `UploadHistory.tsx` (19KB)

Feltöltési előzmények megjelenítése állapotjelző badge-ekkel.

### CategoryCard
**Fájl:** `CategoryCard.tsx` (7KB)

Kategória (számlatípus) kártya az onboarding wizard-hoz.

### PartnerCombobox
**Fájl:** `PartnerCombobox.tsx` (4KB)

Partner kereső combobox (cmdk alapú).

### EmailAliasManager
**Fájl:** `EmailAliasManager.tsx` (7KB)

Email alias-ok kezelése — CRUD a cég email beállításaihoz.

### EmailPreferences
**Fájl:** `EmailPreferences.tsx` (4KB)

Email értesítési preferenciák beállítása.

### SubscriptionUsage
**Fájl:** `SubscriptionUsage.tsx` (6KB)

Előfizetési használat megjelenítése progress bar-okkal.

### TransactionReasonCell
**Fájl:** `TransactionReasonCell.tsx` (1KB)

Tranzakció indoklás cella (rövidített szöveg tooltip-pal).

### NylasEmailConnect
**Fájl:** `NylasEmailConnect.tsx` (7KB)

Nylas email integráció csatlakoztatási felület.

### InvoiceImagePreview
**Fájl:** `InvoiceImagePreview.tsx` (3KB)

Számla kép előnézet a kibontott sorban.

---

## CSS Utility Class-ok

### glass-card

```css
.glass-card {
  @apply bg-card/50 backdrop-blur-sm border-border/50;
}
```

Átlátszó, blur-ös kártya stílus, amit az `ErrorBoundary` card-on használunk.

### interactive

```css
.interactive {
  @apply transition-colors duration-200 ease-out;
}
```

Flat hover transition — szín alapú, nincs shadow.

### financial-number

```css
.financial-number {
  @apply font-mono tabular-nums;
  font-feature-settings: "tnum" 1, "lnum" 1;
}
```

Fix szélességű számjegyek pénzügyi adatokhoz.

---

## ⚠️ Anti-CLS Design Szabályok (Kötelező)

> **CLS = Cumulative Layout Shift.** Minden dinamikus elem esetén meg kell akadályozni, hogy a tartalom méretváltozása eltoljon más elemeket.

### 1. Gomb border-space foglalás

**Probléma:** Ha egy gomb `hover`-re kap bordert (`border-1px`), a layout eltolódik 1px-t.

**Megoldás:** Minden gomb alapból kapjon `border border-transparent` osztályt — így helyet foglal a border-nek, de nem látszik.

```tsx
// ❌ ROSSZ — hover-re shift
<button className="hover:border hover:border-primary px-4">
  Gomb
</button>

// ✅ JÓ — border hely mindig foglalt
<button className="border border-transparent hover:border-primary px-4">
  Gomb
</button>
```

> **Megjegyzés:** A shadcn/ui `Button` komponens alapból `border border-transparent`-et használ a legtöbb variánsnál. Egyedi gombokhoz kötelező manuálisan felvenni.

---

### 2. Dinamikus counter anti-CLS

**Probléma:** Ha egy counter értéke 1 jegyűről 2 jegyűre nő (`9 → 10`), a szöveg szélesebb lesz és eltolódik a mellette lévő tartalom.

**Megoldás:** `tabular-nums` + `min-w-[Xch]` a counter spanra.

```tsx
// ❌ ROSSZ — shift 9→10-nél
<Button>Törlés ({selected.size})</Button>

// ✅ JÓ — 2 karakter hely mindig foglalt, monospace számok
<Button>
  Törlés (<span className="tabular-nums inline-block min-w-[2ch] text-center">
    {selected.size}
  </span>)
</Button>

// ✅ JÓ — "N fájl kijelölve" sor elejénél
<span className="text-sm font-medium">
  <span className="tabular-nums inline-block min-w-[2ch] text-center">
    {selectedFiles.size}
  </span> fájl kijelölve
</span>
```

**`min-w` irányelv:**

| Max várható szám | `min-w` érték |
|-----------------|---------------|
| 1–99 | `min-w-[2ch]` |
| 1–999 | `min-w-[3ch]` |
| 1–9999+ | `min-w-[4ch]` |

**Miért `ch` unit?** `1ch` = az adott font `0` karakterének szélessége. `tabular-nums`-szal ez egyenlő minden számjegynek, így `2ch` pontosan 2 számjegy szélességét jelenti.

**Hol alkalmazzuk kötelezően:**
- Bulk action sávok: `Törlés (N)`, `Újraküldés (N)`, `N fájl kijelölve`
- Pagination: `1 / 25 oldal`
- Feltöltés progress: `3 / 10 fájl`
- Bármilyen gomb label ahol szám dinamikusan változik

---

### 3. `scrollbar-gutter: stable` — scroll shift megelőzése

**Probléma:** Ha egy container scrollbar-t kap (tartalom túlnő), a scrollbar megjelenése 15-17px-t vesz el a tartalomtól, shifting-et okozva.

**Megoldás:** `style={{ scrollbarGutter: 'stable' }}` az overflow container-en.

```tsx
// ✅ Használat — ContentArea és scrollható listák
<main style={{ scrollbarGutter: 'stable' }} className="overflow-y-auto">
  {children}
</main>
```

> Már alkalmazva: `AppLayout` ContentArea `<main>` elemén.
