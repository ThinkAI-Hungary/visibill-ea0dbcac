# Visibill — Information Architecture & Navigation

> **Verzió:** 1.3 | **Dátum:** 2026-06-22  
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
├── Accounty (/accounty/)
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
│   ├── /tickets/:ticketId?        Hibajegyek
│   ├── /settings                  Accounty beállítások
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

## 8. [Accounty] Layout Struktúra

Az Accounty modul **teljesen önálló layout-ot** használ (`AccountyLayout`), amely független a fő app `ProtectedLayout`-jától.

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
| Tulajdonság | Fő app (ProtectedLayout) | Accounty (AccountyLayout) |
|---|---|---|
| Sidebar | AppSidebar (19 menüpont) | Saját Accounty sidebar (9 menüpont + payroll submenus) |
| URL pattern | `/:companyId/:dateRange/page` | `/accounty/page` |
| Company context | GlobalDatePicker + CompanySelector | Nem használ CompanySelector (multi-client) |
| Branding | eaisybill | eaisybill \| Accounty (piros gradiens) |
| Role | Owner/Admin/Member/Employee | admin/könyvelő |
| Command palette | Nincs | Ctrl+K — oldalak + ügyfelek keresése |

