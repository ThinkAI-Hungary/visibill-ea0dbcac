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
| `cont` | Folyamatos szolgáltatás | `all` |
| `kpi` | KPI szűrő (párosított/javasolt/nincs) | `all` |
| `sf` / `sd` | Rendezés mező/irány | `invoice_issue_date` / `desc` |
| `p` / `ps` | Oldal / Oldalméret | `1` / `50` |
| `invoice` | Kijelölt / kinyitott számla ID | `""` |
| `action` | Deep-linkelt dialógus akció (`items`, `view`, `edit`, `files`) | `""` |

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
│   ├── /notes                     Jegyzetek (osztott kétpaneles)
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
│   │   ├── /cycle/:cycleId        Bérciklus szerkesztés
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

