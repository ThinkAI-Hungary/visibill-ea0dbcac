# 05 — Layout & Navigáció

> App shell architektúra, sidebar collapsible csoportok, scoped routing, elrendezési patternek.

---

## App Shell & Moduláris Router Architektúra (ADR A-060)

```
┌────────────────────────────────────────────────────────────────────────┐
│ App.tsx (Root Orchestrator <70 sor)                                    │
│  ├── bootstrap.ts (Pre-render URL hash handler & error deszerializáló) │
│  ├── queryClient.ts (React Query kliens & globális error listenerek)   │
│  │                                                                     │
│  └── BrowserRouter                                                     │
│       ├── LanguageRouteSync         → Valós idejű /hr route ↔ i18n sync│
│       ├── renderAuthRoutes()        → /auth, /hr/auth, /reset-password │
│       ├── renderAccountyRoutes()    → /eaisybooks/* (portfólió & client)│
│       │                                                                │
│       └── ProtectedLayout ◄── Auth gate (eaisybill)                   │
│            ├── ScopedLayout (/:companyId/:dateRange & /hr/...)         │
│            │    ├── renderEaisybillScopedRoutes()                      │
│            │    └── renderShipmentScopedRoutes()                       │
│            └── Legacy & Fallback Redirects                             │
│                 ├── renderEaisybillLegacyAndFallbackRoutes()           │
│                 └── renderShipmentLegacyRoutes()                       │
└────────────────────────────────────────────────────────────────────────┘
```

### Komponens & Modul Felelősségek

| Modul / Komponens | Felelősség |
|-------------------|-----------|
| **`src/app/bootstrap.ts`** | Pre-render platform inicializáció, Supabase URL hash elkapás, hiba-parser |
| **`src/app/queryClient.ts`** | Globális React Query kliens, hibariportolás |
| **`src/routes/authRoutes.tsx`** | Standalone auth, recovery, portál és management útvonalak |
| **`src/routes/eaisybillRoutes.tsx`** | Scoped eaisybill útvonalak (`/:companyId/:dateRange/*`) és legacy flat redirectek |
| **`src/routes/accountyRoutes.tsx`** | eaisybooks (Accounty) portfólió, bérszámfejtés, EV, TAO és admin útvonalak |
| **`src/routes/shipmentRoutes.tsx`** | HRTSPED fuvarozási és eszkalációs útvonalak |
| **`src/routes/redirects.tsx`** | `RootRedirect`, `AccountyRootRedirect`, `LegacyRedirect` egységes motor |
| **`src/routes/shellComponents.tsx`** | `ProtectedPage`, `RemoveInitialLoader`, `ScrollToTop` segédkomponensek |
| **`ProtectedLayout`** | Auth & Lifecycle gate — hidegindításkor LoadingSpinner, meleg váltáskor instant SPA (ADR A-115) |
| **`AppLayout`** | Shell layout — Sidebar + TopBar + Content. Stabil, nem mount-ol újra |
| **`ScopedLayout`** | URL ↔ Context szinkronizáció layer |
| **`LanguageRouteSync`** | Reaktív i18n szinkronizáció: URL útvonal alapján azonnal vált `hu` és `hr` között (ADR A-109) |
| **`LanguageRouteWrapper`** | Dedikált nyelvi környezetet biztosító route wrapper komponens |
| **`AccountyShellProvider`** | Központi 0-prop provider az eaisyBooks moduláris héjához (`useAccountyShell()`, ADR A-114) |
| **`AppModeSwitcher`** | Szimmetrikus alkalmazásváltó eaisyBill és eaisyBooks között (PRD P-083, ADR A-115) |

---

## eaisyBooks Kettős Működési Módú Héj (ADR A-114)

Az eaisyBooks felületének navigációja a `AccountyShellContext` központi állapotkezelő köré épül, felszámolva a korábbi 26-prop drilling láncolatot és monolitikus szerkezetet.

### Moduláris Dekompozíció (Vercel Composition Patterns)

```
┌─────────────────────────────────────────────────────────────┐
│ AccountyLayout (AccountyShellProvider)                      │
│  ├── AccountySidebar (Karcsú keret ~280 sor)               │
│  │    ├── AppModeSwitcher (eaisyBill ↔ eaisyBooks)          │
│  │    ├── mode === 'portfolio'  ──► <PortfolioNav />        │
│  │    │                             (Portfólió, Naptár,     │
│  │    │                              Riportok, Bérszámfejtés)│
│  │    └── mode === 'client'     ──► <ClientNav />           │
│  │                                  (← Vissza gomb, Profil, │
│  │                                   Számlák, EV, TAO, Bér) │
│  ├── AccountyHeader (0-prop, parancspaletta & súgó trigger) │
│  └── AccountyErrorBoundary + <Outlet />                    │
└─────────────────────────────────────────────────────────────┘
```

---

## Alkalmazásváltó (AppModeSwitcher) és Hideg/Meleg Hibrid Átmenet (ADR A-115, PRD P-083)

Az `eaisyBill` és `eaisyBooks` közötti zökkenőmentes és azonnali átjárást hibrid lifecycle modell biztosítja:

### 1. Hidegindítás (Cold Start – F5 újratöltés vagy munkamenetbeli első belépés)
- A modul-szintű session flag-ek (`hasEaisybillInitialized`, `hasAccountyInitialized`) kezdetben `false` értékűek.
- A gyökér layout (`ProtectedLayout` vagy `AccountyLayout`) teljes képernyős `LoadingSpinner`-t renderel (`"eaisyBill betöltése..."` vagy `"eaisyBooks betöltése..."`), amely elfedi a lazy chunk betöltéseket, a cégek aszinkron feloldását és az RBAC jogosultság-ellenőrzést.
- 400ms-os grace buffer védi a felületet a mikro-villanásoktól, míg egy 4 másodperces biztonsági timeout kizárja a beragadást.

### 2. Meleg Váltás (Warm Switch – további navigációk az appok között)
- Az inicializálási flagek értéke `true`.
- A váltás **0ms késleltetésű, azonnali SPA navigáció** teljes képernyős spinner nélkül. Az esetleges belső adatkérések idején a kártyák és táblázatok belső lokális skeletonjai jelennek meg.

### 3. Cégválasztó & Útvonal Szinkronizáció
- A `CompanySelector` az `effectiveCompany` származtatott állapot segítségével szinkron módon kiolvassa a pillanatnyi URL route paramétert (`:companyId`). Így az átmenet első renderelési fázisában sem jelenik meg üres mező vagy placeholder (Zero Blank Frame).
- Az `AppModeSwitcher` a cél útvonalakat közvetlenül generálja (`/:companyId/:dateRange/` és `/eaisybooks/:companyId/:dateRange/overview`), megszüntetve a redundáns gyökér átirányításokat és a perzisztens `localStorage` jelzőket.

## Sidebar

### Struktúra — Collapsible Csoportok

```
┌──────────────────────┐
│  eaisybill           │  ← Brand logó (e/ai/sy/bill segmented)
├──────────────────────┤
│  [Cég kiválasztás ▾] │  ← CompanySelector (employee-nél rejtett)
├──────────────────────┤
│  ▾ ÁTTEKINTÉS        │  ← Collapsible csoport fejléc
│    ▸ Irányítópult    │
│    ▸ Kategóriák      │
│    ▸ Projektek       │
│    ▸ Partnertörzs    │
│                      │  ← pb-1.5 gap
│  ▸ PÉNZÜGYEK         │  ← Zárt csoport (active indicator line alul)
│                      │
│  ▾ KÖNYVELÉS         │
│    ▸ Főkönyv         │  ← active state kiemelés
│    ▸ Eredménykimutatás│
│    ▸ Mérleg          │
│    ▸ Beszámoló       │
│    ▸ ÁFA Bevallás    │
│                      │
│  ▸ HR & ESZKÖZÖK     │
│  ▸ RENDSZER          │
├──────────────────────┤
│  👤 User avatar      │
│  Név / email         │
│  [☀️] [⚙️] [🚪]     │  ← Téma, beállítások, kilépés
├──────────────────────┤
│  [◀ Sidebar toggle]  │
└──────────────────────┘
```

### 6 Navigációs Csoport

| Kulcs | Csoport név | Ikon | Menüelemek |
|-------|------------|------|------------|
| `overview` | Áttekintés | `LayoutDashboard` | Irányítópult, Kategóriák, Projektek, Partnertörzs |
| `finance` | Pénzügyek | `Landmark` | Számlák, Kintlévőség, Tranzakciók, Házipénztár, Utalások |
| `accounting` | Könyvelés | `BookOpen` | Főkönyv, Eredménykimutatás, Mérleg, Beszámoló, ÁFA Bevallás, Napló |
| `hr` | HR & Eszközök | `Users` | Bérek/járulékok, Munkaidő, TENY |
| `shipment` | Szállítmányozás | `Truck` | Fuvarok, Excel Import, Eszkaláció |
| `system` | Rendszer | `Wrench` | Integrációk, Árfolyamok, Jegyzetek |

### Csoport Fejléc Stílus

```tsx
<CollapsibleTrigger className="relative flex items-center gap-2 w-full px-2 py-1.5 
  rounded-md text-sm font-medium text-sidebar-foreground/70 
  hover:bg-primary/10 hover:text-primary transition-colors">
  <group.icon className="h-4 w-4 shrink-0 text-muted-foreground" />
  <span className="text-xs font-medium uppercase tracking-wider">{label}</span>
  <ChevronRight className={`h-3.5 w-3.5 transition-transform duration-200 
    ${isOpen ? 'rotate-90' : ''}`} />
</CollapsibleTrigger>
```

### Csoport Nyitott/Zárt Állapot

| Tulajdonság | Érték |
|-------------|-------|
| **Perzisztencia** | `localStorage` → `eaisybill:sidebar-groups` kulcs |
| **Formátum** | JSON tömb: `["overview","accounting"]` |
| **Auto-open** | Navigáláskor az aktív oldal csoportja automatikusan kinyílik |
| **Active indicator** | Zárt csoportnál 2px teal vonal a fejléc alatt (`bg-primary/60`) |
| **Animáció** | CSS `grid-template-rows: 0fr/1fr` + `opacity` transition (200ms ease-out) |
| **forceMount** | `CollapsibleContent forceMount` — tartalom DOM-ban marad bezárva is, hogy a CSS transition le tudjon futni |
| **Csoportok közötti gap** | `gap-1` (4px) + `pb-1.5` (6px) a nyitott tartalom alján |
| **Sub-menü elem behúzás** | `pl-9` (2.25rem) — vizuálisan elkülöníti az elemeket a csoport fejléctől |

### Collapsed (Icon-only) Mód

Összezárt sidebar-nál a csoportok eltűnnek, és egy **flat ikon lista** jelenik meg az összes menüelem ikonjával, tooltip-ekkel.

### Sidebar Viselkedés

| Tulajdonság | Érték |
|-------------|-------|
| **Collapsible** | `"icon"` — összecsukva csak ikonok |
| **Brand (expanded)** | „eaisybill" — segmented tipográfia |
| **Brand (collapsed)** | „eai" — font-medium + bold primary |
| **Active state** | `SidebarMenuButton isActive` |
| **Disabled state** | Ha nincs company: `grayscale opacity-50 cursor-not-allowed` |
| **Print** | `print:hidden` |
| **Memoizáció** | `React.memo(AppSidebar)` |
| **Prefetch** | Hover/focus-ra lazy chunk prefetch (`prefetchMap`) |
| **eaisyBooks átmenet** | Portfólió szintre váltáskor 250ms `<AccountyNavSkeleton />` shimmer + `fade-in` |

### Employee vs Owner Nézet

| Funkció | Owner | Employee |
|---------|-------|----------|
| CompanySelector | ✅ Látható | ❌ Rejtett |
| Összes menüpont | ✅ Látható | ❌ Rejtett |
| Munkaidő menüpont | ✅ Látható | ✅ Látható |
| Beállítások gomb | ✅ Látható | ❌ Rejtett |
| TopBar (GlobalDatePicker) | ✅ Látható | ❌ Rejtett |

---

## eaisyBooks Dual-Mode Sidebar & Layout (`AccountySidebar.tsx`)

Az eaisyBooks a könyvelőirodák speciális igényeire tervezett **kétállapotú (dual-mode)** oldalsávval és dedikált `AccountyLayout`-tal rendelkezik:

```
┌────────────────────────────────────────────────────────┐
│ 1. Portfólió Mód (/eaisybooks/*)                       │
│    ▸ Portfólió (Kanban / Grid / List)                 │
│    ▸ Jóváhagyási sor (Approval Queue)                  │
│    ▸ Hiányzó számlák & Felszólítások                  │
│    ▸ Adónaptár & Riasztások                            │
│    ▸ Riportok & AI Asszisztens                         │
│    ▾ Adminisztráció (Mátrix, Könyvelők, Audit)         │
├────────────────────────────────────────────────────────┤
│ 2. Ügyfél Mód (/eaisybooks/:companyId/:dateRange/*)    │
│    [← Vissza a portfólióhoz]                           │
│    [CompanySwitcher: Cégnév ▾] (subpage-megőrző)       │
│    ▸ Áttekintés & Cégprofil                            │
│    ▸ Számlák & Tranzakciók                             │
│    ▸ Bérszámfejtés (4 fázis, NAV 08 import)           │
│    ▸ EV Könyvvitel (Pénztárkönyv zárási varázsló)      │
│    ▸ TAO & KIVA modul                                  │
│    ▸ Cégkapu & EGYKE Képviselet                        │
│    ▸ Céges Szabálytár (company_prompt_rules)           │
└────────────────────────────────────────────────────────┘
```

### Dual-Mode Viselkedési Tulajdonságok

| Tulajdonság | Portfólió Mód | Ügyfél Mód |
|-------------|---------------|------------|
| **URL Minta** | `/eaisybooks/*` (pl. `/eaisybooks/portfolio`) | `/eaisybooks/:companyId/:dateRange/*` |
| **Header Cégváltó** | Rejtett | **Subpage-megőrző `CompanySwitcher`**: Cégváltáskor az aktuális aloldalon marad (pl. `/payroll`) |
| **Visszalépés** | N/A | Kiemelt "← Vissza a portfólióhoz" gomb az oldalsáv tetején |
| **Hibaszigetelés** | Route-level `AccountyErrorBoundary` automatikus reset-tel URL váltáskor (A-079) |
| **Szerepkörök** | 4 szint (`iroda_admin`, `senior_könyvelő`, `könyvelő`, `asszisztens`) + DB felülbírálat |

---

## Scoped Routing

### URL Struktúra

```
/:companyId/:dateRange/page/:tab?
```

| Szegmens | Formátum | Példa |
|----------|----------|-------|
| `companyId` | UUID | `abc-123-def` |
| `dateRange` | `YYYY-MM-DD_YYYY-MM-DD` | `2026-01-01_2026-12-31` |
| `page` | Route szegmens | `invoices` |
| `tab` | Opcionális tab | `outbound_nav` |

### Navigációs Utilityk

```tsx
// Scoped path generálás
generateScopedPath('abc-123', '2026-01-01', '2026-12-31', 'invoices')
// → '/abc-123/2026-01-01_2026-12-31/invoices'

// Scoped navigáció hook
const navigate = useScopedNavigate();
navigate('invoices', { replace: true });

// Base path hook (sidebar linkekhez)
const basePath = useScopedBasePath();
// → '/abc-123/2026-01-01_2026-12-31'

// URL-alapú tab kezelés
const [tab, setTab] = useUrlTab('invoices', 'outbound_nav', VALID_TABS);
```

---

## Global Date Picker (TopBar)

```
┌─────────────────────────────────────────────────────────┐
│ Időszak: [Ez a hónap] [Előző hónap] [Ez az év] | 📅 2026. jan. 01. – 📅 2026. dec. 31. │
└─────────────────────────────────────────────────────────┘
```

| Tulajdonság | Érték |
|-------------|-------|
| **Pozíció** | Fejléc alatti sáv, `border-b` |
| **Háttér** | `bg-background/95 backdrop-blur` |
| **Preset gombok** | „Ez a hónap", „Előző hónap", „Ez az év" |
| **Custom dátum** | Két `Calendar` popover (from/to) |
| **Max tartomány** | 365 nap |
| **Locale** | `hu` — magyar dátumformátum: `2026. jan. 01.` |

---

## Elrendezési Patternek

### Full Height Layout

```css
html, body { height: 100%; overflow: hidden; }
#root { height: 100%; overflow: hidden; }
```

A content area görgetése a `<main>` elemen belül történik:

```tsx
<main className="flex-1 overflow-y-auto bg-background p-6">
```

### Page Animation

Minden oldal root container-e `.page-animate` class-t kap:

```css
.page-animate {
  animation: pageFadeIn 0.4s ease-out both;
}

@keyframes pageFadeIn {
  from { opacity: 0; transform: translateY(16px); }
  to { opacity: 1; transform: translateY(0); }
}
```

### Print Layout

```css
@media print {
  html, body, #root { height: auto; overflow: visible; }
  @page { size: landscape; margin: 15mm; }
}
```

A sidebar, TopBar és FAB `print:hidden` class-szal el van rejtve nyomtatáskor.

### Content Padding

| Kontextus | Padding |
|-----------|---------|
| Main content area | `p-6` (24px) |
| Sidebar expanded | `p-4` (16px) |
| Sidebar sub-menu items | `pl-6` (24px) — vizuálisan elkülönítve a csoport fejlécektől |
| Sidebar csoport fejléc | `px-2 py-1.5` |
| TopBar | `px-6 py-2` |

> **Döntés (2026-06-08):** Sub menü elemek behúzása `pl-2` → `pl-6`-ra növelve, hogy vizuálisan egyértelműen elkülönüljenek a csoport fejlécektől. A `CollapsibleContent`-re `forceMount` attribútum került, hogy a nyitás/csukás CSS animáció simán lefusson.

---

## Management Dashboard Tab Stílus (2026-07-07)

A Management Dashboard navigációja **két szintű**, és a két szint **szándékosan fordított** vizuális hierarchiát követ:

| Szint | Komponens | Aktív stílus | Inaktív stílus |
|-------|-----------|-------------|----------------|
| **Főmenü** | Áttekintés / Control Center / Superadmin / Hibajegyek | Solid: `bg-primary text-primary-foreground shadow-sm` | `text-muted-foreground border-transparent` |
| **Submenü** | Hibák / Jogosultságok / Fájlok / Jegyek Listája / ... | Soft: `bg-primary/10 text-primary border-primary/20` | `text-muted-foreground border-transparent` |

### Anti-CLS szabály alkalmazása

Minden tab gomb **mindig hordoz `border` class-t** — csak a szín változik aktív/inaktív között. Ez megelőzi a layout shift-et (→ lásd Anti-CLS #4 szabály):

```tsx
// ✅ Főmenü — solid aktív, border mindig ott van
className={`... border ${
  active
    ? 'bg-primary text-primary-foreground border-transparent shadow-sm'
    : 'text-muted-foreground hover:bg-muted/60 border-transparent'
}`}

// ✅ Submenü — soft aktív, border mindig ott van
className={`... border ${
  active
    ? 'bg-primary/10 text-primary border-primary/20'
    : 'text-muted-foreground hover:text-foreground border-transparent'
}`}
```

### Egységesítési szabály

A Control Center (`ControlCenter` component) és a Tickets Page (`TicketsPage` `renderTabsHeader`) **azonos** submenü stílust használ:
- Container: `flex bg-muted/20 rounded-lg p-1 w-fit gap-1`
- Gomb: `px-4 py-2 rounded-md text-xs font-semibold whitespace-nowrap border`

---

## Layout Shift Prevention (Anti-CLS szabályok)

> **Döntés (2026-07-05):** Több layout shift bugot dokumentáltunk a Management Dashboard hibajegy (tickets) modulban. Az alábbi szabályok KÖTELEZŐEK minden új view/panel/tab implementálásakor.

### 1. Scrollbar Gutter — `scrollbar-gutter: stable`

**Probléma:** Ha egy scroll container `overflow-y: auto`, a scrollbar megjelenik/eltűnik a tartalom magasságától függően → a content szélessége shift-el.

**Szabály:** Minden `overflow-y-auto` scroll container-re kötelező a `scrollbar-gutter: stable`:

```tsx
// ✅ HELYES — scrollbar mindig foglal helyet
<div className="flex-1 overflow-y-auto" style={{ scrollbarGutter: 'stable' }}>

// ❌ TILOS — scrollbar megjelenésekor shiftel
<div className="flex-1 overflow-y-auto">
```

**Érintett helyek:**
- `src/components/AppLayout.tsx` — `ContentArea` fő eaisybill tartalomterület
- `src/pages/Accounty/AccountyLayout.tsx` — `#accounty-main-scroll` eaisyBooks tartalomterület
- `ManagementDashboard.tsx` — tickets scroll container
- `ManagementDashboard.tsx` — többi view scroll container
- Bármely panel/sidebar ahol a tartalom változhat tab váltáskor vagy adatok aszinkron betöltődésekor

### 2. CSS Grid gyerekek — `min-h-0` kötelező

**Probléma:** CSS grid gyerekek alapértelmezett `min-height: auto` → a tartalom kitolhatja a grid containert a fix magasságán túl.

**Szabály:** Fix magasságú grid-ben MINDEN oszlop gyereknek kell `min-h-0`:

```tsx
// ✅ HELYES — grid container fix, gyerekek nem nőhetnek túl
<div className="grid grid-cols-4 h-[calc(100vh-200px)] overflow-hidden">
  <div className="col-span-1 min-h-0 overflow-hidden flex flex-col">
    <div className="flex-1 overflow-y-auto">...</div>
  </div>
  <div className="col-span-3 min-h-0 flex flex-col">
    <div className="flex-1 overflow-y-auto">...</div>
  </div>
</div>

// ❌ TILOS — jobb oszlop tartalom megnöveli a bal oszlopot is
<div className="grid grid-cols-4 h-[calc(100vh-200px)]">
  <div className="col-span-1">...</div>
  <div className="col-span-3">...</div>
</div>
```

### 3. `divide-y` és `border-l-*` NEM kombinálható

**Probléma:** A Tailwind `divide-y divide-border/40` shorthand `border-color`-t alkalmaz a 2.+ gyerekekre, ami felülírja a specifikus `border-l-primary` oldal-szín utilityt. Az első elem rendben működik, a többi nem.

**Szabály:** Ha az elemeknek saját border-szín logikájuk van (pl. aktív jelölés), NE használj `divide-y`-t a szülőn — helyette explicit `border-t` az elemeken:

```tsx
// ✅ HELYES — border-t az elemeken, border-l szabadon használható
<div className="flex-1 overflow-y-auto">
  {items.map(item => (
    <button className={`border-l-2 border-t border-border/40 first:border-t-0 ${
      active ? 'border-l-primary' : 'border-l-transparent'
    }`}>
  ))}
</div>

// ❌ TILOS — divide-y felülírja a border-l-primary-t a 2.+ elemeken
<div className="flex-1 overflow-y-auto divide-y divide-border/40">
  {items.map(item => (
    <button className={`border-l-2 ${active ? 'border-l-primary' : 'border-l-transparent'}`}>
  ))}
</div>
```

### 4. Aktív állapot border — mindig foglalj helyet

**Probléma:** Ha egy lista elem CSAK aktív állapotban kap `border-l-2`-t, a 2px megjelenésekor shiftel a tartalom.

**Szabály:** Mindig adj `border-l-2`-t MINDEN elemnek — az inaktív legyen `border-l-transparent`:

```tsx
// ✅ HELYES — 2px mindig lefoglalt, csak a szín változik
<button className={`border-l-2 ${active ? 'border-l-primary bg-primary/10' : 'border-l-transparent'}`}>

// ❌ TILOS — border csak aktívnál → shift
<button className={`${active ? 'border-l-2 border-l-primary bg-primary/10' : ''}`}>
```

### 5. Tab / Sub-tab gombok — fix méret

**Probléma:** `flex-1` gomboknál az aktív állapot (shadow, bg) más vizuális méretet ad → a szomszédos gombok is elmozdulnak.

**Szabály:** Tab-szerű gombok NE legyenek `flex-1`, hanem `w-fit` + `whitespace-nowrap`:

```tsx
// ✅ HELYES — fix méret, nem stretch-elődik
<div className="flex w-fit gap-1 p-1">
  <button className={`py-2 px-4 whitespace-nowrap ${active ? 'bg-primary shadow-sm' : ''}`}>
    Tab neve
  </button>
</div>

// ❌ TILOS — flex-1 stretch + aktív shadow → shift
<div className="flex max-w-2xl">
  <button className={`flex-1 ${active ? 'bg-primary shadow-sm' : ''}`}>
    Tab neve
  </button>
</div>
```

### Összefoglaló ellenőrzőlista (új view létrehozásakor)

| # | Ellenőrzés | Hol |
|---|---|---|
| 1 | Scroll container kap `scrollbar-gutter: stable`-t és `overflow-y-auto`-t? | Minden fő app shell (`AppLayout`, `AccountyLayout`) és görgethető panel |
| 2 | Grid gyerekek kapnak `min-h-0`-t? | Fix magasságú grid layout-ok |
| 3 | `divide-y` nincs kombinálva egyedi `border-l-*`-gal? | Lista elemek saját border logikával |
| 4 | Aktív border mindig foglal helyet (transparent)? | Kiválasztható lista elemek |
| 5 | Tab gombok fix szélességűek (`w-fit` + `whitespace-nowrap`)? | Tab / sub-tab switcher-ek |

---

## Kétoszlopos Mester-Részlet Elrendezés (Master-Detail Split Layout)

Ügyfélszolgálati hibajegyek (`TicketDetailView.tsx`), szállítmányozási fuvarok (`CourierReportTab.tsx`) és részletes beállítások esetén a rendszer kétoszlopos osztott panelt alkalmaz:

```
┌─────────────────────────────────────────────────────────────┐
│ Bal Oldal (380px fix)            │ Jobb Oldal (flex-1)      │
│ ┌──────────────────────────────┐ │ ┌──────────────────────┐ │
│ │ 🔍 Kereső + Státusz szűrő   │ │ │ Fejléc & Akció gombok│ │
│ ├──────────────────────────────┤ │ ├──────────────────────┤ │
│ │ Lista tétel 1 (aktív)        │ │ │ Idővonal / Üzenetek  │ │
│ │ Lista tétel 2                │ │ │                      │ │
│ │ Lista tétel 3                │ │ ├──────────────────────┤ │
│ │                              │ │ │ RichText válaszmező  │ │
│ └──────────────────────────────┘ │ └──────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

**Szabályok:**
- A bal oldali lista és a jobb oldali beszélgetésfolyam egymástól függetlenül görgethető (`overflow-y-auto min-h-0`).
- A felhasználói üzenetek jobbra igazítottak (`bg-primary/10 border-primary/20`), a support és rendszerüzenetek balra zártak (`bg-muted/50 border-border/50`).
- Az események (státuszváltás, lezárás, prioritás emelés) a beszélgetési tengelyen középre zárt, kerek ikonnal ellátott audit badge-ként jelennek meg.

### Kezelőkonzol (Support Console Layout) és Anti-Phantom Scroll Szabály

A Management Dashboard és Hibajegy kezelőkonzol felületén (`TicketsPage.tsx`, `TicketDetailView.tsx`):
1. **3-Zónás Szerkezet:**
   - **Bal hasáb (Queue):** 380px széles, függőben lévő és szűrt jegyek listája. Magassága felülről korlátozott (`max-h-[calc(100vh-16rem)] min-h-0 flex-1 overflow-y-auto`), így hosszú lista esetén önállóan görgethető.
   - **Középső tartalom (Üzenetfolyam):** 8 oszlopnyi szélesség a `TicketDetailView` gridjében.
   - **Jobb oldali sáv (Részletek & Történet):** 4 oszlopnyi szélesség. Felül a `Részletek` kártya (metaadatok, cég, státusz, prioritás), alatta közvetlenül a `TicketTimeline` (max 50vh belső scrollal).
2. **Anti-Phantom Scroll Szabály:**
   - **Hiba:** `h-[calc(100vh-200px)] min-h-[550px]` fix magasság beállítása egy flex/grid szülőre tabok alatt. Zoom-out (pl. 75%, 50%) esetén vagy rövidebb tartalomnál a szülő magassága mesterségesen nagyobb lesz mint a tényleges tartalom, és az oldal üres fekete térbe enged lefelé görgetni.
   - **Szabály:** Soha ne használj mesterséges fix `h-[calc(100vh-...)]` magasságot beágyazott tartalomra. Ehelyett az elrendezés `items-start` igazítású legyen, a bal oldali queue kapjon `max-h-[calc(100vh-...)]` korlátot `min-h-0`-val, a jobb oldali tartalom pedig természetesen skálázódjon. Az oldal csak és kizárólag akkor görgethető, ha a tartalom ténylegesen túlnő a viewport magasságán.

