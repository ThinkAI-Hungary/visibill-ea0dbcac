# Visibill — Information Architecture & Navigation

> **Verzió:** 1.4 | **Dátum:** 2026-06-27  
> **Forrás:** [AppSidebar.tsx](../../src/components/AppSidebar.tsx) · [App.tsx](../../src/App.tsx)  
> **Kapcsolódó döntés:** [P-006 Sidebar Structure](./decisions/P-006-sidebar-structure.md)

---

## 1. URL Struktúra

Az alkalmazás scoped URL pattern-t használ:

```
/:companyId/:dateRange/<page>/:tab?
```

| Szegmens | Leírás | Példa |
|----------|--------|-------|
| `companyId` | UUID — kiválasztott cég | `a1b2c3d4-...` |
| `dateRange` | Dátum szűrő | `2026-01-01_2026-12-31` |
| `page` | Oldal neve | `invoices` |
| `tab?` | Opcionális tab | `all`, `incoming` |

**Query paraméterek (Számlák oldal):**

A számlák oldal (`/invoices/:tab`) az összes szűrőt és nézet-állapotot URL query params-ként szinkronizálja,
lehetővé téve linkek megosztását azonos nézettel:

```
/:companyId/:dateRange/invoices/outbound_nav?cur=HUF&kpi=unmatched&p=2
```

| Param | Szűrő | Default (nem jelenik meg) |
|-------|-------|--------------------------|
| `q` | Keresés | `""` |
| `idf` / `idt` | Kibocsátási dátum-tól/-ig | `""` |
| `amin` / `amax` | Összeg tartomány | `""` |
| `cur` | Pénznem | `all` |
| `paid` | Kifizetve | `all` |
| `sub` | Beküldve | `all` |
| `proj` | Projekt | `all` |
| `cat` | Kategória | `all` |
| `pm` | Fizetési mód | `all` |
| `kpi` | KPI szűrő (párosított/javasolt/nincs) | `all` |
| `sf` / `sd` | Rendezés mező/irány | `invoice_issue_date` / `desc` |
| `p` / `ps` | Oldal / Oldalméret | `1` / `50` |

**Publikus route-ok** (auth nélkül):

| Route | Oldal |
|-------|-------|
| `/auth` | Bejelentkezés / Regisztráció |
| `/auth/callback` | OAuth callback |
| `/reset-password` | Jelszó visszaállítás |
| `/register/:token` | Employee regisztráció (token alapú) |

**Legacy redirect-ek:** A régi `/invoices`, `/settings` stb. URL-ek automatikusan a scoped URL-re redirectálnak.

---

## 2. Oldal Térkép (Sitemap)

```
Visibill
├── Publikus
│   ├── /auth                      Bejelentkezés / Regisztráció
│   ├── /auth/callback             OAuth callback
│   ├── /reset-password            Jelszó visszaállítás
│   └── /register/:token           Employee regisztráció
│
├── Védett (/:companyId/:dateRange/)
│   ├── /                          Irányítópult (Dashboard)
│   ├── /categories                Kategóriák (GL számok kezelése)
│   ├── /projects                  Projektek
│   ├── /partners                  Partnertörzs
│   ├── /invoices/:tab?            Számlák
│   ├── /kintlevo/:tab?            Kintlévőség
│   ├── /transactions/:tab?        Tranzakciók (+ Futár riportok tab)
│   ├── /general-ledger/:tab?      Főkönyv
│   ├── /profit-and-loss/:tab?     Eredménykimutatás
│   ├── /balance-sheet/:tab?       Mérleg
│   ├── /annual-report             Beszámoló
│   ├── /upload/:tab?              Feltöltés
│   ├── /salaries/:tab?            Bérek / Járulékok
│   ├── /working-time/:tab?        Munkaidő
│   ├── /petty-cash/:tab?          Házipénztár
│   ├── /teny/:tab?                Tárgyi eszközök (TENY)
│   ├── /integrations              Integrációk (NAV, bank)
│   ├── /exchange-rates            Árfolyamok (MNB)

│   ├── /settings/:tab?            Beállítások
│   ├── /analytics/:tab?           Analitika
│   └── /vat-return/:tab?          ÁFA bevallás
│
├── eaisyBooks (/accounty/)                ← korábban: Accounty
│   ├── /                          Portfólió (Grid/Lista/Kanban nézet)
│   ├── /client/:id                Ügyfél részletes nézet
│   ├── /client/:id/invoices       Ügyfél számlái
│   ├── /client/:id/reports        Ügyfél riportjai
│   ├── /client/:id/reports/missing-invoices  Hiányzó számlák riport
│   ├── /missing-invoices          Összes hiányzó számla
│   ├── /missing-invoices/:id      Ügyfél hiányzó számlái
│   ├── /tax-calendar              Adó naptár
│   ├── /reports                   Iroda szintű riportok
│   ├── /reports/missing-invoices  Hiányzó számlák összesítő riport
│   ├── /approval-queue            Jóváhagyási sor
│   ├── /payroll/:id               Bérszámfejtés dashboard (per ügyfél)
│   ├── /payroll/:id/employees     Alkalmazottak
│   ├── /payroll/:id/employees/new Új alkalmazott wizard
│   ├── /payroll/:id/employees/:empId  Alkalmazott részletek
│   ├── /payroll/:id/cycle/new     Új bérciklus
│   ├── /payroll/:id/cycle/:cycleId  Bérciklus szerkesztés
│   ├── /payroll/:id/filings       Bevallások
│   ├── /payroll/:id/reports       Bérszámfejtési riportok
│   ├── /payroll/:id/portal        Ügyfélportál preview
│   ├── /payroll/:id/tax-params    Adóparaméterek
│   ├── /client/:id/ev             EV Főoldal (pénztárkönyv egyenleg, küszöbérték-figyelő)
│   ├── /client/:id/ev/cashbook    Pénztárkönyv (egyszeres könyvvitel)
│   ├── /client/:id/ev/records     Nyilvántartások áttekintés
│   ├── /client/:id/ev/records/:type  Nyilvántartás részletes (14 típus)
│   ├── /client/:id/ev/compare     Adóforma-összehasonlítás (átalány/VSZJA/KATA + járulékok)
│   ├── /client/:id/ev/flat-rate   Átalányadó kalkulátor
│   ├── /client/:id/ev/entrepreneurial  Vállalkozói SZJA kalkulátor
│   ├── /client/:id/ev/kata        KATA kalkulátor
│   ├── /client/:id/ev/contributions  TB-járulék & szocho negyedéves
│   ├── /client/:id/ev/vat         ÁFA nyilvántartás
│   ├── /client/:id/ev/hipa        HIPA kalkulátor
│   ├── /client/:id/ev/depreciation  Értékcsökkenés
│   ├── /client/:id/ev/thresholds  Küszöbérték-figyelő
│   ├── /client/:id/ev/returns     Bevallások (SZJA, ÁFA, járulék, HIPA, KATA, cégautóadó)
│   ├── /client/:id/ev/lifecycle   Életút (alapítás, forma-váltás, szüneteltetés)
│   ├── /client/:id/ev/calendar    Adónaptár
│   ├── /client/:id/ev/optimization  Optimalizáció (tervezett)
│   ├── /client/:id/ev/master-data Törzsadatok (EV beállítások)
│   ├── /client/:id/ev/setup       EV beállító wizard
│   ├── /tickets/:ticketId?        Hibajegyek
│   ├── /settings                  eaisyBooks beállítások
│   ├── /help                      Segítség
│   └── /new-client                Új ügyfél wizard (meghívó kód + manuális létrehozás)
│
├── Ügyfélportál (publikus)
│   └── /portal/:token             Magic link-es ügyfélportál
│
└── Admin
    └── /management                Admin management panel
        ├── Áttekintés tab          Cégek, felhasználók, LLM költségek
        ├── Hibák tab               Error log tábla (filter, bulk delete/retry)
        └── Cég részletek           Cég-szintű adatok, LLM költség részletezés
```

---

## 3. Jelenlegi Sidebar Navigáció (Flat)

19 menüpont, egyetlen szinten:

| # | Menüpont | Route | Ikon | Employee látja? |
|---|----------|-------|------|----------------|
| 1 | Irányítópult | `/` | LayoutDashboard | ❌ |
| 2 | Kategóriák | `/categories` | Tags | ❌ |
| 3 | Projektek | `/projects` | FolderKanban | ❌ |
| 4 | Partnertörzs | `/partners` | Users | ❌ |
| 5 | Számlák | `/invoices` | FileText | ❌ |
| 6 | Kintlévőség | `/kintlevo` | ReceiptText | ❌ |
| 7 | Tranzakciók | `/transactions` | Landmark | ❌ |
| 8 | Főkönyv | `/general-ledger` | BookOpen | ❌ |
| 9 | Eredménykimutatás | `/profit-and-loss` | BarChart3 | ❌ |
| 10 | Mérleg | `/balance-sheet` | Scale | ❌ |
| 11 | Beszámoló | `/annual-report` | ClipboardCheck | ❌ |
| 12 | Feltöltés | `/upload` | Upload | ❌ |
| 13 | Bérek/járulékok | `/salaries` | Wallet | ❌ |
| 14 | Munkaidő | `/working-time` | Clock | ✅ |
| 15 | Házipénztár | `/petty-cash` | Banknote | ❌ |
| 16 | TENY | `/teny` | Package2 | ❌ |
| 17 | Integrációk | `/integrations` | Plug | ❌ |
| 18 | Árfolyamok | `/exchange-rates` | TrendingUp | ❌ |


**Footer elemek** (nem menüpont):
- Beállítások (`/settings`) — ikon gomb
- Kijelentkezés — ikon gomb
- Téma váltó (dark/light) — ikon gomb
- Sidebar collapse toggle

---

## 4. Tervezett Sidebar Csoportosítás (P-006)

> A P-006 döntés alapján a sidebar collapsible kategóriákba rendezendő.

```
Sidebar
├── 📊 Áttekintés
│   ├── Irányítópult
│   └── Analitika
│
├── 📄 Számlázás
│   ├── Számlák
│   ├── Feltöltés
│   ├── Kintlévőség
│   └── Partnertörzs
│
├── 🏦 Pénzügyek
│   ├── Tranzakciók
│   ├── Főkönyv
│   ├── Házipénztár
│   └── Árfolyamok
│
├── 📒 Riportok
│   ├── Eredménykimutatás
│   ├── Mérleg
│   └── Beszámoló
│
├── 🏷️ Törzsadatok
│   ├── Kategóriák
│   ├── Projektek
│   └── TENY
│
├── 👥 HR
│   ├── Bérek/járulékok
│   └── Munkaidő
│
└── ⚙️ Rendszer
    ├── Integrációk
    └── Beállítások
```

---

## 5. Layout Struktúra

```
┌─────────────────────────────────────────────┐
│                    App                       │
│  ┌──────┬──────────────────────────────────┐ │
│  │      │          GlobalDatePicker        │ │
│  │      ├──────────────────────────────────┤ │
│  │  S   │                                  │ │
│  │  I   │                                  │ │
│  │  D   │        Page Content              │ │
│  │  E   │                                  │ │
│  │  B   │                                  │ │
│  │  A   │                                  │ │
│  │  R   │                                  │ │
│  │      │                                  │ │
│  │      ├──────────────────────────────────┤ │
│  │      │          Footer (user)           │ │
│  └──────┴──────────────────────────────────┘ │
└─────────────────────────────────────────────┘
```

**Komponens hierachia:**
```
<App>
  <AuthProvider>
    <CompanyProvider>
      <ProtectedLayout>           ← useAppReady() gate
        <SidebarProvider>
          <AppSidebar />          ← navigáció
          <ScopedLayout>          ← /:companyId/:dateRange context
            <GlobalDatePicker />  ← dátum szűrő
            <Page />              ← lazy loaded page
          </ScopedLayout>
        </SidebarProvider>
      </ProtectedLayout>
    </CompanyProvider>
  </AuthProvider>
</App>
```

---

## 6. Navigáció Viselkedés

| Viselkedés | Implementáció |
|------------|---------------|
| **Lazy loading** | Minden oldal `React.lazy()` + `Suspense` |
| **Hover prefetch** | `prefetchMap` — hover/focus → chunk preload |
| **Sidebar collapse** | `collapsible="icon"` — ikon módra összecsukható |
| **Active state** | `pageSegment` alapú kiemelés |
| **No-company state** | Minden menüpont disabled (grayscale + cursor-not-allowed) |
| **Employee filter** | `isEmployee` → csak `employeeVisible: true` elemek (Munkaidő) |
| **Print hidden** | Sidebar `print:hidden` class |

---

## 7. Role-alapú Navigáció

| Szerep | Látható menüpontok | Beállítások | Company Selector |
|--------|-------------------|-------------|-----------------|
| **Owner** | Mind a 19 | ✅ | ✅ |
| **Admin** | Mind a 19 (owner alias) | ✅ | ✅ |
| **Member** | Mind a 19 | ✅ | ✅ |
| **Employee** | Csak Munkaidő (1) | ❌ | ❌ |

---

## 8. [eaisyBooks] Layout Struktúra (kódban: AccountyLayout)

Az eaisyBooks modul **teljesen önálló layout-ot** használ (`AccountyLayout`), amely független a fő app `ProtectedLayout`-jától.

```
┌─────────────────────────────────────────────┐
│                  AccountyLayout              │
│  ┌──────┬──────────────────────────────────┐ │
│  │      │   Header (search, theme, user)  │ │
│  │      ├──────────────────────────────────┤ │
│  │  A   │                                  │ │
│  │  C   │                                  │ │
│  │  C   │        <Outlet />                │ │
│  │  O   │     (page content)               │ │
│  │  U   │                                  │ │
│  │  N   │                                  │ │
│  │  T   │                                  │ │
│  │  Y   │                                  │ │
│  │      │                                  │ │
│  │  S   ├──────────────────────────────────┤ │
│  │  I   │       FeedbackFab               │ │
│  │  D   │                                  │ │
│  │  E   │                                  │ │
│  │  B   │                                  │ │
│  │  A   │                                  │ │
│  │  R   │                                  │ │
│  └──────┴──────────────────────────────────┘ │
└─────────────────────────────────────────────┘
```

**Komponens hierarchia:**
```
<App>
  <AuthProvider>
    <CompanyProvider>
      <ProtectedRoute>
        <AccountyLayout>             ← saját sidebar + header
          <AccountyRoleProvider>      ← admin/könyvelő role context
            <Outlet />               ← lazy loaded Accounty page
          </AccountyRoleProvider>
          <FeedbackFab />
        </AccountyLayout>
      </ProtectedRoute>
    </CompanyProvider>
  </AuthProvider>
</App>
```

**Különbségek a fő app-tól:**
| Tulajdonság | Fő app (ProtectedLayout) | eaisyBooks (AccountyLayout) |
|---|---|---|
| Sidebar | AppSidebar (19 menüpont) | Saját eaisyBooks sidebar (9 menüpont + payroll submenus) |
| URL pattern | `/:companyId/:dateRange/page` | `/accounty/page` |
| Company context | GlobalDatePicker + CompanySelector | Nem használ CompanySelector (multi-client) |
| Branding | eaisyBill | eaisyBill \| eaisyBooks (piros gradiens) |
| Role | Owner/Admin/Member/Employee | admin/könyvelő |
| Command palette | Nincs | Ctrl+K — oldalak + ügyfelek keresése |

---

## 9. Oldal-szintű Funkciók (2026-06-26)

### Partnertörzs (`/partners`)

**Layout:** Master–Detail splitscreen (bal: lista, jobb: detail panel)

**Master lista:**
- Szűrők: típus (Vevő / Szállító / Mindkettő) + szabad szöveges keresés
- Táblázat oszlopok: Név/Cím, Adószám, Típus, Számlák (db)
- Számlaszám aggregáció: **mindkét forrásból** (NAV + Beküldött), adószám-prefix alapján

**Detail panel (jobb oldal):**
- Cégadatok: Adószám, Székhely, Email-cím
- Könyvelési beállítás: „Bekerüljön a könyvelésbe?" toggle (partner + összes számlája)
- Számlák szekció:
  - **Keresőmező** — számlaszám alapú szűrés
  - **Tab switcher** — NAV | Beküldött (darabszámmal)
  - **Kattintható kártyák** → `PartnerInvoiceDetailDialog`

**PartnerInvoiceDetailDialog:**
- Fejléc: számlaszám, ellenpartner, dátumok, bruttó összeg, fizetési mód, irány badge, forrás badge
- Tételek táblázat: Megnevezés, Mennyiség, Egység, Nettó, ÁFA, Bruttó, **Főkönyvi szám**
- Adatforrás: `nav_invoice_items` (NAV) vagy `invoice_items` (Beküldött)

> **Kapcsolódó döntés:** [P-040](./decisions/P-040-partners-invoice-panel.md)

---

### Kategóriák (`/categories`)

**Layout:** Accordion lista — egy GL kategória / sor

**Funkciók:**
- Kategóriákhoz hozzárendelt számlák összegének megjelenítése
- **Multi-currency:** ha több deviza van, `886 778 Ft | 1 200 USD` formátumban jelenik meg
- **Hozzárendelési kereső:** mindkét forrásból (NAV + Beküldött) javasol számlákat

> **Kapcsolódó döntés:** [P-041](./decisions/P-041-categories-multicurrency-search.md)

---

### Számla Tételek (`InvoiceItemsDialog`)

**Layout:** Dialógus — számlatételek listája GL besorolás szerkesztéssel

**Megnyitás:**
- NAV számla sorból → "Tételek" gomb → `source='nav'`
- Beküldött számla sorból → "Tételek" gomb → `source='submitted'`

**Tételek táblázat:**
- Oszlopok: Sorszám, Megnevezés, Mennyiség, Egységár, Nettó, ÁFA, Bruttó, **Főkönyvi szám (GL)**
- GL szerkesztés: ceruza ikon → keresőmezős GL szám választó (`Command` komponens)
- Preset-alapú: a GL besorolás a cég aktív preset-jéhez (`useActivePreset`) kötődik

**GL Twin Sync (2026-06-27):**
- Ha a szerkesztett számla párosítva van (NAV `invoice_number` ↔ Beküldött `bizonylatsorszam` normalizálva)
- A rendszer automatikusan megkeresi a **"testvér" tételt** a másik táblában azonos `line_number`-rel
- **Egyetlen batch RPC** (`override_gl_classifications_batch`) frissíti mindkét oldalt
- Toast visszajelzés: *„Főkönyvi besorolás frissítve. (párosított számla is frissítve)"*
- Graceful degradation: ha nincs twin, csak az elsődleges tétel frissül

> **Kapcsolódó döntés:** [P-043](./decisions/P-043-gl-twin-sync.md) · [P-019](./decisions/P-019-gl-suggestion.md)

