# Visibill — Information Architecture & Navigation

> **Verzió:** 1.6 | **Dátum:** 2026-09-13  
> **Forrás:** [AppSidebar.tsx](../../src/components/AppSidebar.tsx) · [App.tsx](../../src/App.tsx) · [AppModeSwitcher.tsx](../../src/components/AppModeSwitcher.tsx)  
> **Kapcsolódó döntés:** [P-006 Sidebar Structure](./decisions/P-006-sidebar-structure.md) · [A-109 Horvát Lokalizáció & Route Architektúra](../architecture/decisions/A-109-eaisybill-i18n-croatia-localization-and-route-architecture.md) · [P-081 Horvát Demó UX](./decisions/P-081-eaisybill-croatia-localization-and-demo-ux.md) · [A-114 eaisyBooks Shell Collapse](../architecture/decisions/A-114-collapse-dual-mode-navigation-shell.md) · [A-115 Cold/Warm Hibrid Navigáció](../architecture/decisions/A-115-eaisybooks-eaisybill-cold-warm-hybrid-transition-and-route-resolution.md) · [P-083 AppModeSwitcher UX](./decisions/P-083-eaisybooks-eaisybill-app-mode-switcher-and-cold-warm-transition-ux.md)

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

**Kereszt-alkalmazás Útvonalváltás (`eaisyBill` ↔ `eaisyBooks`):**
Az `AppModeSwitcher` közvetlen célzott útvonalakat képez az aktív cég megőrzésével:
- **eaisyBill-ből eaisyBooks-ba:** `/eaisybooks/:companyId/:dateRange/overview` (ha a cég jogosult az eaisyBooks modulra) vagy `/eaisybooks` (ha portfólió szinten lép be).
- **eaisyBooks-ból eaisyBill-be:** `/:companyId/:dateRange/` (a könyvelő felületen aktív céget kiemelve).
- A navigációt memória-alapú életciklus kapuk vezérlik: hidegindításkor (F5) `LoadingSpinner` védi a felületet, meleg váltáskor 0ms-os azonnali SPA átmenet történik (ADR A-115, PRD P-083).

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
| `cont` | Folyamatos szolgáltatás | `all` |
| `kpi` | KPI szűrő (párosított/javasolt/nincs) | `all` |
| `sf` / `sd` | Rendezés mező/irány | `invoice_issue_date` / `desc` |
| `p` / `ps` | Oldal / Oldalméret | `1` / `50` |
| `invoice` | Kijelölt / kinyitott számla ID | `""` |
| `action` | Deep-linkelt dialógus akció (`items`, `view`, `edit`, `files`) | `""` |

**Publikus route-ok** (auth nélkül):

| Route | Oldal |
|-------|-------|
| `/auth` | Bejelentkezés / Regisztráció (Magyar) |
| `/auth/callback` | OAuth callback (Magyar) |
| `/hr/auth` | Bejelentkezés / Regisztráció (Horvát lokalizált demó) |
| `/hr/auth/callback` | OAuth callback (Horvát) |
| `/reset-password` | Jelszó visszaállítás |
| `/register/:token` | Employee regisztráció (token alapú) |

**Többnyelvű útvonalak (`/hr/*`):**
A horvát demonstrációs környezet tiszta route-vezérelt működést kapott:
- Publikus felület: `/hr/auth`, `/hr/auth/callback`
- Védett eaisybill felület: `/hr/:companyId/:dateRange/<page>/:tab?`
- **Zero LocalStorage Persistence:** A nyelv állapotát a `LanguageRouteSync` határozza meg a pillanatnyi URL alapján. A `/hr/` eltávolításakor az alkalmazás azonnal visszavált a magyar felületre.

**Legacy redirect-ek:** A régi `/invoices`, `/settings` stb. URL-ek automatikusan a scoped URL-re redirectálnak.

---

## 2. Oldal Térkép (Sitemap)

```
Visibill
├── Publikus
│   ├── /auth                      Bejelentkezés / Regisztráció (HU)
│   ├── /auth/callback             OAuth callback (HU)
│   ├── /hr/auth                   Bejelentkezés / Regisztráció (HR demó)
│   ├── /hr/auth/callback          OAuth callback (HR)
│   ├── /reset-password            Jelszó visszaállítás
│   └── /register/:token           Employee regisztráció
│
├── Védett (/:companyId/:dateRange/ és /hr/:companyId/:dateRange/)
│   ├── /                          Irányítópult (Dashboard)
│   ├── /categories                Kategóriák (GL számok kezelése)
│   ├── /projects                  Projektek
│   ├── /partners                  Partnertörzs
│   ├── /invoices/:tab?            Számlák
│   ├── /kintlevo/:tab?            Kintlévőség
│   ├── /transactions/:tab?        Tranzakciók (+ Futár riportok tab)
│   ├── /transfers                 Szállítói utalások (GIRO / SEPA)
│   ├── /general-ledger/:tab?      Főkönyv
│   ├── /profit-and-loss/:tab?     Eredménykimutatás
│   ├── /balance-sheet/:tab?       Mérleg
│   ├── /annual-report             Beszámoló
│   ├── /upload/:tab?              Feltöltés
│   ├── /salaries/:tab?            Bérek / Járulékok
│   ├── /working-time/:tab?        Munkaidő
│   ├── /petty-cash/:tab?          Házipénztár
│   ├── /teny/:tab?                Tárgyi eszközök (TENY)
│   ├── /shipments/:tab?           Fuvarok és Szállítmányozás (CMR, import, eszkaláció)
│   ├── /integrations              Integrációk (NAV, bank)
│   ├── /exchange-rates            Árfolyamok (MNB)
│   ├── /notes                     Jegyzetek (osztott kétpaneles)
│   ├── /knowledge-base/:articleId? Tudástár és Funkciókalauz (10 kategória, 40 cikk)
│   ├── /settings/:tab?            Beállítások
│   ├── /analytics/:tab?           Analitika
│   └── /vat-return/:tab?          ÁFA bevallás
│
├── eaisyBooks (/accounty/)                ← korábban: Accounty
│   ├── /                          Portfólió (Grid/Lista/Kanban nézet)
│   ├── /client/:id/overview       Ügyfél főoldal / részletes nézet (Áttekintés és Zárás)
│   ├── /client/:id/invoices       Ügyfél számlái
│   ├── /client/:id/missing-invoices Ügyfél hiányzó számlái (bekérési és feltöltési felület)
│   ├── /client/:id/accounting     Könyvelési modul választó (átirányít az EV vagy TAO felületre)
│   ├── /client/:id/reports        Ügyfél riportjai
│   ├── /client/:id/reports/missing-invoices  Hiányzó számlák riport
│   ├── /client/:id/prompts        Könyvelési szabályok (Prompt Library — AI kontírozási szabályok)
│   ├── /missing-invoices          Összes hiányzó számla (globális nézet)
│   ├── /tax-calendar              Adó naptár
│   ├── /reports                   Iroda szintű riportok
│   ├── /reports/missing-invoices  Hiányzó számlák összesítő riport
│   ├── /approval-queue            Jóváhagyási sor (e-mail kiküldések előtt)
│   ├── /client/:id/payroll        Bérszámfejtés dashboard (per ügyfél)
│   │   ├── /employees             Alkalmazottak
│   │   ├── /employees/new         Új alkalmazott wizard
│   │   ├── /employees/:empId      Alkalmazott részletek
│   │   ├── /import                Dolgozók és jogviszonyok tömeges importja (Excel / CSV sablon + NAV 08 ÁNYK XML)
│   │   ├── [Dialog] /reconstruct  Többhavi 08-as ÁNYK XML kötegelt bérszámfejtési ciklus és kalkuláció rekonstrukció
│   │   ├── /cycle/new             Új bérciklus
│   │   ├── /cycle/:cycleId        Bérciklus szerkesztés (kettős nézet: 8-lépéses stepper VAGY Dolgozói munkalap / Employee Worksheet élő bérszalvétával)
│   │   ├── /filings               Bevallások
│   │   ├── /reports               Bérszámfejtési riportok
│   │   ├── /portal                Ügyfélportál preview
│   │   └── /tax-params            Adóparaméterek
│   ├── /client/:id/ev             EV Főoldal (pénztárkönyv egyenleg, küszöbérték-figyelő)
│   │   ├── /cashbook              Pénztárkönyv (egyszeres könyvvitel)
│   │   ├── /records               Nyilvántartások áttekintés
│   │   ├── /records/:type         Nyilvántartás részletes (14 típus)
│   │   ├── /compare               Adóforma-összehasonlítás (átalány/VSZJA/KATA + járulékok)
│   │   ├── /flat-rate             Átalányadó kalkulátor
│   │   ├── /entrepreneurial       Vállalkozói SZJA kalkulátor
│   │   ├── /kata                  KATA kalkulátor
│   │   ├── /contributions         TB-járulék & szocho negyedéves
│   │   ├── /vat                   ÁFA nyilvántartás
│   │   ├── /hipa                  HIPA kalkulátor
│   │   ├── /depreciation          Értékcsökkenés
│   │   ├── /thresholds            Küszöbérték-figyelő
│   │   ├── /returns               Bevallások (SZJA, ÁFA, járulék, HIPA, KATA, cégautóadó)
│   │   ├── /lifecycle             Életút (alapítás, forma-váltás, szüneteltetés)
│   │   ├── /calendar              Adónaptár
│   │   ├── /optimization          Optimalizáció (tervezett)
│   │   ├── /master-data           Törzsadatok (EV beállítások)
│   │   └── /setup                 EV beállító wizard
│   ├── /client/:id/tao            TAO Főoldal (társasági adó zárás és kalkuláció)
│   ├── /client/:id/settings       Cégkapu / KÜNY-tárhely és integrációs beállítások
│   ├── /tickets/:ticketId?        Hibajegyek
│   ├── /settings                  Globális eaisyBooks iroda beállítások
│   ├── /help                      Segítség
│   └── /new-client                Új ügyfél wizard (meghívó kód + manuális létrehozás)
│
├── Ügyfélportál (publikus)
│   └── /portal/:token             Magic link-es ügyfélportál
│
└── Admin (management / thinkai role only — egyébként 404 NotFound)
    └── /management                Admin management panel
        ├── Áttekintés tab          Cégek, felhasználók, LLM költségek, Hibajegyek, Applikáció hibák (legtöbb hibás cég és felhasználó összegzéssel), Utolsó fájlok
        ├── Hibák tab               Error log tábla (filter, bulk delete/retry)
        └── Cég részletek           Cég-szintű adatok, LLM költség részletezés
```

---

## 3. Sidebar Navigáció (6 Csoport)

A sidebar 6 logikai, összecsukható (collapsible) csoportba rendezi a modulokat, moduláris jogosultságkezeléssel (`useEaisybillPermissions`) és hover/focus alapú lazy prefetch támogatással:

### 1. 📊 Áttekintés (`overview`)
- **Irányítópult** (`/`) – Fő KPI mutatók, bevételek, költségek, cash-flow
- **Kategóriák** (`/categories`) – Főkönyvi számlák és kategóriák összerendelése
- **Projektek** (`/projects`) – Projekttörzs és költségkeretek
- **Partnertörzs** (`/partners`) – Vevők és szállítók nyilvántartása

### 2. 🏦 Pénzügyek (`finance`)
- **Számlák** (`/invoices`) – Bejövő/kimenő kézi és NAV számlák
- **Kintlévőség** (`/kintlevo`) – Vevői követelések és fizetési felszólítások
- **Tranzakciók** (`/transactions`) – Banki tranzakciók és futár elszámolások
- **Házipénztár** (`/petty-cash`) – Készpénz bevételek és kiadások
- **Utalások** (`/transfers`) – Szállítói számlák banki utalási csomagba (GIRO/SEPA) gyűjtése

### 3. 📖 Könyvelés (`accounting`)
- **Főkönyv** (`/general-ledger`) – Főkönyvi karton és számlalapok
- **Eredménykimutatás** (`/profit-and-loss`) – PnL riport
- **Mérleg** (`/balance-sheet`) – Mérlegkimutatás
- **Beszámoló** (`/annual-report`) – Éves számviteli beszámoló
- **ÁFA Bevallás** (`/vat-return`) – Havi/negyedéves ÁFA analitika és bevallás
- **Napló** (`/journals`) – Kettős könyvviteli zárt naplók (Vevő, Szállító, Bank, Pénztár, Vegyes, Bérfeladás)

### 4. 👥 HR & Eszközök (`hr`)
- **Bérek/járulékok** (`/salaries`) – Bérszámfejtési bizonylatok és feladások
- **Munkaidő** (`/working-time`) – Munkaidő és jelenlét nyilvántartás (Employee szerepkörnek is)
- **TENY** (`/teny`) – Tárgyi eszközök nyilvántartása és értékcsökkenés

### 5. 🚚 Szállítmányozás (`shipment`)
- **Fuvarok** (`/shipments`) – Fuvarlevelek és CMR megbízások
- **Excel Import** (`/shipments/import`) – Tömeges fuvarlevél import
- **Eszkaláció** (`/shipments/escalated`) – Eltérő és problémás fuvarok kezelése

### 6. ⚙️ Rendszer (`system`)
- **Integrációk** (`/integrations`) – NAV Online Számla és egyéb API kapcsolatok
- **Árfolyamok** (`/exchange-rates`) – MNB napi hivatalos devizaárfolyamok
- **Jegyzetek** (`/notes`) – Kétpaneles belső és megosztott cégjegyzetek

**Footer elemek:**
- Beállítások (`/settings`)
- Kijelentkezés
- Téma váltó (dark/light)
- Tudástár (`/knowledge-base`) – 50 hierarchikus útmutató az eaisyBill és eaisyBooks teljes menürendszeréhez
- Hibajegyek gomb (olvasatlan badge számlálóval)

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

## 8. [eaisyBooks] Layout & Navigációs Architektúra (kódban: AccountyLayout)

Az eaisyBooks modul **teljesen önálló moduláris layout-ot** használ (`AccountyLayout`), amely el van különítve a fő app `ProtectedLayout`-jától. A felület modern URL-struktúrája a `/eaisybooks/*` útvonalon fut (a korábbi `/accounty/*` útvonalakat a `renderAccountyRoutes()` automatikusan átirányítja).

```
┌────────────────────────────────────────────────────────────────────────┐
│ AccountyLayout                                                         │
│  ├── Header: Brand (eaisyBooks) + AppModeSwitcher                      │
│  │   + [Client Módban: CompanySwitcher + "Vissza a portfólióhoz"]      │
│  │   + Command Palette (Ctrl+K) + Global Search + LiveNotifications    │
│  │   + Téma választó + User Profile Dropdown                           │
│  │                                                                     │
│  ├── Kétállapotú Navigáció (AccountySidebar):                          │
│  │   ┌──────────────────────────┬──────────────────────────────────┐   │
│  │   │ PORTFÓLIÓ MÓD            │ ÜGYFÉL KONTEXTUS MÓD             │   │
│  │   │ (/eaisybooks/*)          │ (/eaisybooks/:companyId/:range/*)│   │
│  │   ├──────────────────────────┼──────────────────────────────────┤   │
│  │   │ • Portfólió (Grid/List/  │ • Cég Áttekintés                 │   │
│  │   │   Kanban)                │ • Cégprofil                      │   │
│  │   │ • Jóváhagyási Sor        │ • Számlák & Bizonylatok          │   │
│  │   │ • Hiányzó Számlák        │ • Hiányzó Bizonylatok            │   │
│  │   │ • Adó Naptár             │ • Egyéni Vállalkozás (EV - 8 tab)│   │
│  │   │ • AI Asszisztens (Chat)  │ • Társasági Adó (TAO/KIVA - 7 tab│   │
│  │   │ • Riasztási Központ      │ • Bérszámfejtés (5 tab)          │   │
│  │   │ • Ügyfél Portál (Portal) │ • NAV Bevallások                 │   │
│  │   │                          │ • Könyvelési Szabályok (Prompts) │   │
│  │   │ ▾ ADMINISZTRÁCIÓ         │ • Beállítások (Tabs)             │   │
│  │   │   ▸ Iroda (Könyvelők, ..)│ • Cégkapu / KÜNY Tárhely        │   │
│  │   │   ▸ Szakmai (Sablonok,..)│ • EGYKE Meghatalmazások          │   │
│  │   │   ▸ Biztonság (Audit,..) │ • Adatmegőrzési Szabályzat       │   │
│  │   │   ▸ Támogatás (Ticketek) │ • Cégstruktúra (Telephelyek)     │   │
│  │   └──────────────────────────┴──────────────────────────────────┘   │
│  │                                                                     │
│  └── Tartalmi Terület (<Outlet /> + ErrorBoundary + DateRangeProvider) │
│       + Lebegő Visszajelzés Gomb (<FeedbackFab />)                     │
└────────────────────────────────────────────────────────────────────────┘
```

### Komponens & Provider Hierarchia:
```tsx
<App>
  <AuthProvider>
    <CompanyProvider>
      <ProtectedRoute>
        <AccountyLayout>              {/* Fő keret, header, theme, notifikációk */}
          <AccountyRoleProvider>       {/* 4 irodai szerepkör + DB override jogok */}
            <DateRangeProvider>        {/* Dátumtartomány állapot kliens kontextusban */}
              <Outlet />               {/* Lazy-loaded modul oldal */}
            </DateRangeProvider>
          </AccountyRoleProvider>
          <FeedbackFab />
        </AccountyLayout>
      </ProtectedRoute>
    </CompanyProvider>
  </AuthProvider>
</App>
```

### Kétállapotú Sidebar Működés (`AccountySidebar.tsx`)

A navigációs sáv az URL mintázata alapján automatikusan vált a két nézet között (`sidebarMode === 'portfolio' | 'client'`):

#### 1. Portfólió Mód (`/eaisybooks/*`)
Irodai szintű áttekintés, ahol a könyvelő az összes hozzárendelt ügyfélcéget egyben látja és kezeli.

| Menüpont | Útvonal | Ikon | Leírás & Funkció |
|---|---|---|---|
| **Portfólió** | `/eaisybooks` vagy `/eaisybooks/portfolio` | `Briefcase` | Grid / Lista / Kanban nézet az összes cégről; szűrés státuszra, könyvelőre; KPI mutatók |
| **Jóváhagyási sor** | `/eaisybooks/approval-queue` | `MailCheck` | Jóváhagyandó számlák és bizonylatok kötegelt (batch) ellenőrzése és elfogadása |
| **Hiányzó számlák** | `/eaisybooks/missing-invoices` | `FileWarning` | Irodai szintű konszolidált lista a hiányzó bizonylatokról, felszólító email küldéssel |
| **Adó naptár** | `/eaisybooks/tax-calendar` | `Calendar` | Aggregált NAV és önkormányzati határidők az összes ügyfélre kiterjedően |
| **AI Asszisztens** | `/eaisybooks/ai-assistant` | `Sparkles` | Könyvelési jogszabály-értelmező, kontírozási tanácsadó chat felület (teljes oldal és lebegő Speed Dial Drawer, [P-077](decisions/P-077-eaisybooks-ai-assistant-chat-and-speed-dial-ux.md)) |
| **Riasztások** | `/eaisybooks/alerts` | `Bell` | Kritikus események (lejárt határidő, sikertelen NAV sync, elakadt bérszámfejtés) |
| **Ügyfélportál** | `/eaisybooks/client-portal` | `ExternalLink` | Az ügyfelek számára generált magic-linkes bizonylatpótló felület konfigurációja és előnézete |

**Adminisztrációs Csoportok (iroda_admin & senior_könyvelő jogosultság):**
- **Iroda:** Könyvelők kezelése (`/eaisybooks/admin/accountants`), Irodai beállítások (`/eaisybooks/settings`)
- **Szakmai:** Sablonok (`/eaisybooks/admin/templates`), Jogviszonykódok (`/eaisybooks/admin/job-codes`), Adómértékek (`/eaisybooks/admin/tax-parameters`), Jogszabály-frissítések (`/eaisybooks/admin/legal-updates`)
- **Biztonság & Kormányzás:** Audit napló (`/eaisybooks/admin/audit-log`), GDPR kérelmek (`/eaisybooks/admin/gdpr`), Adatmegőrzési szabályzatok (`/eaisybooks/admin/data-retention`), Jogosultságkezelő mátrix (`/eaisybooks/admin/permission-matrix`)
- **Támogatás:** Hibajegykezelés és belső support

#### 2. Ügyfél Kontextus Mód (`/eaisybooks/:companyId/:dateRange/*`)
Amikor a könyvelő kiválaszt egy ügyfelet a portfólióból, a sidebar átvált a cég-specifikus navigációs struktúrára. A fejlécben megjelenik a `CompanySwitcher` (amely UUID cserével a kiválasztott cégnél tartja az aktuális aloldalt) és a **"Vissza a portfólióhoz"** gomb.

| Menüpont | Relatív Útvonal | Ikon | Leírás & Lapfülek (Tabs) |
|---|---|---|---|
| **Áttekintés** | `/overview` | `LayoutDashboard` | Ügyfél KPI-k, havi zárási státusz, hiányzó tételek, gyorslinkek |
| **Cégprofil** | `/profile` | `Building2` | Cégadatok, adószámok, bankszámlák, képviseleti adatok |
| **Számlák** | `/invoices` | `FileText` | Számlák listája, NAV számlák, jóváhagyási státuszok, bizonylatcsatolmányok |
| **Hiányzó számlák** | `/missing-invoices` | `FileWarning` | Cégre szűrt hiányzó bizonylatok, interaktív email előnézeti modál küldés előtt |
| **Egyéni Vállalkozás (EV)** | `/ev` | `Coins` | **8 Tab:** Áttekintés, Kalkulátor (Átalány/VSZJA/KATA), Pénztárkönyv (zárási varázslóval), Járulékok (TB/szocho/min. alapok), Bevallások (XML), Nyilvántartások (14 féle), Adóoptimalizáció, Életút |
| **Társasági Adó (TAO / KIVA)** | `/tao` | `Landmark` | **7 Tab:** Áttekintés, Adózási mód, Adónaptár, Év végi zárás, Társasági adó kalkulátor, KIVA kalkulátor, TAO vs KIVA összehasonlító |
| **Bérszámfejtés** | `/payroll` | `Calculator` | **5 Tab:** Ciklus (4 fázisú workflow), Foglalkoztatottak (többes jogviszony, kiléptető varázsló), NAV bevallások (08 ÁNYK XML rekonstrukció), Ügyfélportál (e-bérjegyzék), Beállítások |
| **NAV Bevallások** | `/payroll/filings` | `FileCheck` | Havi 08-as, T1041, M30 és egyéb bérügyi bevallások állapota és XML exportja |
| **Könyvelési Szabályok** | `/prompts` | `Sparkles` | Egyedi céges AI kontírozási és számlaosztályozási szabálytár (`company_prompt_rules`) |
| **Beállítások** | `/settings` | `Settings` | Lapfüles cégbeállítások (Radix UI Tabs): Általános, Cégkapu, Bér paraméterek, Értesítések |
| **Cégkapu / KÜNY** | `/cegkapu` | `Inbox` | Hivatalos tárhely szinkronizáció, NAV és hatósági levelek letöltése |
| **Képviselet / EGYKE** | `/representation` | `ShieldCheck` | EGYKE meghatalmazások nyilvántartása, érvényességi idők, jogosultsági körök |
| **Adatmegőrzés** | `/data-retention` | `Archive` | Számviteli törvény (Sztv.) szerinti kötelező bizonylat-megőrzési szabályzatok és naplózás |
| **Cégstruktúra** | `/structure` | `Network` | Telephelyek, fióktelepek, költséghelyek és szervezeti egységek kezelése |

---

### Szerepkör-alapú Jogosultsági Rendszer (eaisyBooks RBAC)

Az eaisyBooks négy hierarchikus irodai szerepkört alkalmaz az `accounty_assignments` táblából, amelyet az `accounty_module_permissions` tábla segítségével az adminisztrátor felhasználónként és modulonként egyedileg felülbírálhat:

| Szerepkör (`role`) | Megnevezés | Hatáskör & Menühozzáférés |
|---|---|---|
| `iroda_admin` | Irodavezető | Teljes körű hozzáférés minden modulhoz, adminisztrációs felülethez, könyvelők hozzárendeléséhez és a jogosultsági mátrixhoz. |
| `senior_könyvelő` | Senior Könyvelő | Portfólió, bérszámfejtés, TAO/KIVA, EV, riportok, jóváhagyási sor és szakmai beállítások. Nem szerkesztheti az irodai könyvelőket és a jogosultsági mátrixot. |
| `könyvelő` | Könyvelő | A hozzárendelt ügyfelek teljes körű operatív kezelése (számlák, bér, EV, TAO, hiányzó tételek, naptár). Nincs hozzáférése az irodai admin menühöz. |
| `asszisztens` | Asszisztens | Operatív adatrögzítés, hiányzó bizonylatok követése és számlafeltöltés. Zárási műveletek és jóváhagyások korlátozva. |

**Adatbázis-szintű Modul Felülbírálat (DB Overrides):**
A `useAccountyPermissions` hook ellenőrzi a modul-szintű jogokat. Ha az `accounty_module_permissions` táblában az adott felhasználóhoz létezik bejegyzés (`can_read`, `can_write`), a rendszer ezt veszi figyelembe a statikus szerepkör helyett.

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

**Layout:** Accordion lista — 10 standard vezetői rezsikategória (pl. Székhely és irodabérlet, Közművek, IT & Szoftverek, Posta & Kommunikáció stb.)

**Funkciók:**
- **Főkönyvi Számlaosztály-Alapú Rezsi-Kategorizálás:** A kategóriák a főkönyv speciális rezsi-összesítő nézetét képezik az 5-ös költségnemek alapján.
- **Főkönyvi Hozzárendelési Mátrix:** Kategória létrehozásakor/szerkesztésekor kiválaszthatóak a társított 3-jegyű főkönyvi számlák (pl. `521`, `522`, `527`).
- **G/L Badges:** Az accordion sorokban színes jelvények jelzik az adott kategóriához tartozó főkönyvi számokat.
- **Költség Összesítés:** A könyvelési naplósorokból (`acc_journal_lines`) és a besorolt számlákból gyűjti össze az időszaki költségeket.
- **Multi-currency:** ha több deviza van, `886 778 Ft | 1 200 USD` formátumban jelenik meg.

> **Kapcsolódó döntések:** [P-041](./decisions/P-041-categories-multicurrency-search.md) · [P-042](./decisions/P-042-categories-projects-sync.md) · [P-079](./decisions/P-079-overhead-categories-gl-mapping.md)

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

---

## 7. Rendszer Tudásbázis és Funkciókalauz (Knowledge Base)

A rendszer teljes menü- és funkcióstruktúrájának részletes, fájlonkénti leírását az alábbi tudásbázis tartalmazza:
- **Master Index:** [docs/knowledge-base/README.md](../knowledge-base/README.md)
- **eaisyBill menük:** [docs/knowledge-base/eaisybill/](../knowledge-base/eaisybill/) (29 külön .md fájl)
- **eaisyBooks menük:** [docs/knowledge-base/eaisybooks/](../knowledge-base/eaisybooks/) (34 külön .md fájl)
- Minden dokumentum maradéktalanul tartalmazza az adott menü funkcióját, elhelyezkedését és a felhasználói cselekvéseket.


