# Visibill — Information Architecture & Navigation

> **Verzió:** 2.2 | **Dátum:** 2026-10-05  
> **Forrás:** [AppSidebar.tsx](../../src/components/AppSidebar.tsx) · [App.tsx](../../src/App.tsx) · [AppModeSwitcher.tsx](../../src/components/AppModeSwitcher.tsx)  
> **Kapcsolódó döntések:** [P-006 Sidebar Structure](./decisions/P-006-sidebar-structure.md) · [A-109 Horvát Lokalizáció & Route Architektúra](../architecture/decisions/A-109-eaisybill-i18n-croatia-localization-and-route-architecture.md) · [P-081 Horvát Demó UX](./decisions/P-081-eaisybill-croatia-localization-and-demo-ux.md) · [A-114 eaisyBooks Shell Collapse](../architecture/decisions/A-114-collapse-dual-mode-navigation-shell.md) · [A-115 Cold/Warm Hibrid Navigáció](../architecture/decisions/A-115-eaisybooks-eaisybill-cold-warm-hybrid-transition-and-route-resolution.md) · [P-083 AppModeSwitcher UX](./decisions/P-083-eaisybooks-eaisybill-app-mode-switcher-and-cold-warm-transition-ux.md) · [P-095 NAV OSA Tabok & Render UX](./decisions/P-095-nav-osa-tabs-performance-and-immediate-row-expansion-ux.md) · [A-158 Mezőgazdasági Felvásárlási Jegyek](../architecture/decisions/A-158-agricultural-purchase-vouchers-module.md) · [A-159 Hivatalos ÁFA Analitika Upgrade](../architecture/decisions/A-159-statutory-vat-views-upgrade-and-osa-reconciliation.md) · [P-118 Felvásárlási Jegyek UX](./decisions/P-118-agricultural-purchase-vouchers-ux.md) · [P-119 Törvényi ÁFA Nézetek & FAD UX](./decisions/P-119-statutory-vat-views-upgrade-and-reverse-charge-ux.md) · [A-163 Főkönyv UI/UX Modularizáció](../architecture/decisions/A-163-general-ledger-ui-ux-restructuring-and-clutter-reduction.md) · [P-122 Főkönyv Ergonómia UX](./decisions/P-122-general-ledger-ui-ux-restructuring-and-clutter-reduction.md) · [A-164 Fejlesztési Tartalék Tárgyi Eszköz Kapcsolat](../architecture/decisions/A-164-development-reserve-fixed-assets-db-and-depreciation.md) · [P-123 Fejlesztési Tartalék & TÉNY UX](./decisions/P-123-development-reserve-teny-ux.md) · [A-165 Kapcsolt Vállalkozások Adatmodell & Könyvelés](../architecture/decisions/A-165-related-parties-schema-and-accounting-integration.md) · [P-124 Kapcsolt Vállalkozások & Forgalom UX](./decisions/P-124-related-parties-management-and-turnover-ux.md) · [A-167 NAV 2665 Digitális Replika](../architecture/decisions/A-167-nav-2665-official-tax-form-digital-replica.md) · [P-126 NAV 2665 Replika UX](./decisions/P-126-nav-2665-official-tax-form-digital-replica-ux.md) · [A-168 Számla Export Fizetési Dátumok](../architecture/decisions/A-168-invoice-export-transaction-resolution-and-skonto-dates.md) · [P-127 Számla Export Fizetési Dátumok UX](./decisions/P-127-invoices-multitab-export-payment-dates-and-routing-ux.md) · [A-175 Folyószámla és Analitika Architektúra](../architecture/decisions/A-175-subledger-and-open-items-architecture.md) · [P-136 Folyószámla és Analitika Kezelőfelület](./decisions/P-136-subledger-and-open-items-ux.md) · [A-181 A60 Közösségi ÁFA Architektúra](../architecture/decisions/A-181-a60-community-vat-and-vies-crosscheck.md) · [P-143 3-Oszlopos Bérszámfejtés és EFO UX](./decisions/P-143-payroll-3column-dashboard-and-efo-separation-ux.md) · [P-144 A60 Közösségi Összesítő UX](./decisions/P-144-vat-a60-community-summary-and-vies-crosscheck-ux.md) · [P-145 Cégválasztó ABC Rendezés UX](./decisions/P-145-company-selector-alphabetical-sorting-ux.md) · [A-182 Részfizetés és Deduplikáció](../architecture/decisions/A-182-partial-payment-matching-and-transaction-deduplication.md) · [P-146 Részfizetés és Jutaléklevonás UX](./decisions/P-146-partial-payment-and-fee-deduction-match-ux.md) · [P-155 NAV 26A60 Digitális Replika UX](./decisions/P-155-nav-26a60-official-tax-form-digital-replica-ux.md) · [A-197 NAV 26A60 Digitális Replika](../architecture/decisions/A-197-nav-26a60-official-tax-form-digital-replica.md) · [P-156 Könyvelési Szabályok ÁFA & Napló UX](./decisions/P-156-accounting-rules-integration-in-vat-and-journals.md) · [A-196 Könyvelési Szabályok Modális Integráció](../architecture/decisions/A-196-accounting-rules-dialog-and-cross-module-integration.md) · [P-157 Manuális Számlarögzítés & Párosítás UX](./decisions/P-157-manual-submitted-invoice-creation-dialog-and-pairings-ux.md) · [A-198 Manuális Beküldött Számlarögzítés Architektúra](../architecture/decisions/A-198-manual-submitted-invoice-creation-and-multi-pairing.md) · [P-158 NAV 65M Korrekciós & Sztornó UX](./decisions/P-158-nav-65m-02-k-correction-and-storno-invoices-ux.md) · [A-199 NAV 65M Korrekciós & Sztornó Architektúra](../architecture/decisions/A-199-nav-65m-02-k-correction-and-storno-invoices-architecture.md) · [P-159 Tárgyi Eszközök Tömeges Import UX](./decisions/P-159-fixed-assets-bulk-excel-csv-import-and-opening-balances-ux.md) · [A-200 Tárgyi Eszközök Tömeges Import Architektúra](../architecture/decisions/A-200-fixed-assets-bulk-excel-csv-import-and-opening-balances.md) · [P-160 NAV 2665 43. és 45. Sorok Adóösszeg UX](./decisions/P-160-nav-2665-vat-return-row43-and-row45-tax-amount-ux.md) · [A-201 NAV 2665 43. és 45. Sorok Adóösszeg Architektúra](../architecture/decisions/A-201-nav-2665-vat-return-row43-and-row45-tax-amount.md) · [P-161 Bérszámfejtési Haladó Riportok & Nyilatkozatok UX](./decisions/P-161-payroll-advanced-reports-and-declarations-workflow-ux.md) · [A-202 Bérszámfejtési Haladó Riportok & Nyilatkozatok Architektúra](../architecture/decisions/A-202-payroll-advanced-reports-and-declarations-navigation-architecture.md)

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
- **eaisyBooks Nyelvi Függetlensége & Útvonalvédelem:** Az eaisyBooks modul kizárólag a prefix nélküli `/eaisybooks/*` gyökérútvonal alatt érhető el. Horvát (`/hr/...`) felületről történő váltáskor az `AppModeSwitcher` közvetlenül prefixmentes `/eaisybooks/...` célútvonalat képez. Az `accountyRoutes.tsx` pedig automatikus fallback átirányítással (`<Route path="/hr/eaisybooks/*" element={<Navigate to="/eaisybooks" replace />} />`) védi a könyvjelzőzött vagy kézzel beírt URL-eket a 404-es hibáktól.
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
| `/api-docs`, `/docs/api` | Hivatalos Ügyfél REST API v2.2 Fejlesztői Portál (önálló, keretmentes, interaktív tesztelővel) |

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
│   ├── /register/:token           Employee regisztráció
│   └── /api-docs, /docs/api       Hivatalos Ügyfél REST API v2.2 Fejlesztői Portál
│
├── Védett (/:companyId/:dateRange/ és /hr/:companyId/:dateRange/)
│   ├── /                          Irányítópult (Dashboard)
│   ├── /categories                Kategóriák (GL számok kezelése)
│   ├── /projects                  Projektek
│   ├── /partners                  Partnertörzs (felső tabok: /partners [Partnertörzs & Kapcsolt profil], ?tab=related [Kapcsolt vállalkozások forgalma & Art. 114. § / Tao 18. § küszöbök])
│   ├── /invoices/:tab?            Számlák (Bejövő/Kimenő/NAV OSA listák, KPI-ok, [ ➕ Új beküldött számla ] manuális rögzítő modál, P-157, A-198)
│   ├── /kintlevo/:tab?            Kintlévőség
│   ├── /transactions/:tab?        Tranzakciók (+ Futár riportok tab)
│   ├── /transfers                 Szállítói utalások (GIRO / SEPA + Felvásárlási jegy / Őstermelő bizonylat-összevonás)
│   ├── /general-ledger/:tab?      Főkönyv
│   ├── /subledger                 Folyószámla és Analitika (vevő/szállító nyitott tételek, automatikus és kézi párosítás, kerekítés leírás, P-136, A-175)
│   ├── /journals                  Napló (Könyvelési naplók, időszaki sorszámvédelem, kézi vegyes rögzítés, Könyvelési szabályok modal gomb, P-055, P-156, A-196)
│   ├── /accounting-rules/:tab?    Könyvelési szabályok (Dedikált kétlapfüles nézet: Számlatétel szabályok és Céges AI Prompt könyvtár, P-156, A-196)
│   ├── /profit-and-loss/:tab?     Eredménykimutatás
│   ├── /balance-sheet/:tab?       Mérleg
│   ├── /annual-report             Beszámoló
│   ├── /upload/:tab?              Feltöltés
│   ├── /salaries/:tab?            Bérek / Járulékok (tabok: /salaries [Alkalmazottak & NAV], /purchase_vouchers [Mezőgazdasági felvásárlási jegyek])
│   ├── /working-time/:tab?        Munkaidő
│   ├── /petty-cash/:tab?          Házipénztár
│   ├── /teny/:tab?                Tárgyi eszközök (TENY felső tabok: /teny [Eszközök], /teny?tab=development_reserves [Fejlesztési tartalékok nyilvántartása]; [ 🧮 ÉCS elszámolás ] Vegyes napló feladási varázsló: havi/negyedéves/éves zárás, P-141, A-180)
│   ├── /shipments/:tab?           Fuvarok és Szállítmányozás (CMR, import, eszkaláció)
│   ├── /integrations              Integrációk (NAV, bank)
│   ├── /exchange-rates            Árfolyamok (MNB)
│   ├── /notes                     Jegyzetek (osztott kétpaneles)
│   ├── /knowledge-base/:articleId? Tudástár és Funkciókalauz (10 kategória, 40 cikk)
│   ├── /changelog                 Fejlesztői napló (in-app patchnotes idővonal, P-112, A-149)
│   ├── /tickets/:ticketId?        Hibajegyek és ügyfélszolgálat (P-035, A-018)
│   ├── /settings/:tab?            Beállítások
│   ├── /analytics/:tab?           Analitika
│   └── /vat-return/:tab?          ÁFA bevallás (9 moduláris fül: 65-ös bevallás és replika [43/45 sorok adóösszeg kalkulációval és magyarázó sávval, P-160, A-201], Éves mátrix, Tételes M-lap, Fordított ÁFA, A60 közösségi nyilatkozat és hivatalos 26A60 replika [P-155, A-197], ÁFA tétellista, Gyűjtőkódok, 26TFEJLH, Beállítások + NAV OSA ellenőrzés modal + Könyvelési szabályok modal gomb [P-156, A-196])

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
│   │   ├── /reports               Bérszámfejtési riportok (Haladó riportok 8 típussal, KPI-kártyákkal, XLSX/CSV/PDF exporttal, P-161, A-202)
│   │   ├── /declarations          Adóelőleg-nyilatkozatok (8 típus: tax-advance, family, personal, first-marriage, under-25, mother-4-plus, mother-30-under, netak determinisztikus visszalépéssel és scoped routing megőrzéssel, P-161, A-202)
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
- **Számlák** (`/invoices`) – NAV OSA Kimenő / NAV OSA Bejövő és beküldött számlák, lusta táblázat-vezérlők és azonnali expanzió ([P-095](./decisions/P-095-nav-osa-tabs-performance-and-immediate-row-expansion-ux.md)), többlapos Excel export fizetési határidő és fizetés dátuma oszlopokkal skontó ellenőrzéshez ([P-127](./decisions/P-127-invoices-multitab-export-payment-dates-and-routing-ux.md), [A-168](../architecture/decisions/A-168-invoice-export-transaction-resolution-and-skonto-dates.md))
- **Kintlévőség** (`/kintlevo`) – Vevői követelések és fizetési felszólítások
- **Tranzakciók** (`/transactions`) – Banki tranzakciók és futár elszámolások
- **Házipénztár** (`/petty-cash`) – Készpénz bevételek és kiadások
- **Utalások** (`/transfers`) – Szállítói számlák banki utalási csomagba (GIRO/SEPA) gyűjtése

### 3. 📖 Könyvelés (`accounting`)
- **Főkönyv** (`/general-ledger`) – Főkönyvi karton és számlalapok
- **Folyószámla** (`/subledger`) – Vevő, szállító és egyéb analitikus számlák nyitott tételei, lebegő mérlegsáv (∑T, ∑K), 1-kattintásos automatikus párosítás és kerekítés leírás (P-136, A-175)
- **Eredménykimutatás** (`/profit-and-loss`) – PnL riport
- **Mérleg** (`/balance-sheet`) – Mérlegkimutatás
- **Beszámoló** (`/annual-report`) – Éves számviteli beszámoló
- **ÁFA Bevallás** (`/vat-return`) – Havi/negyedéves ÁFA analitika és 2665 bevallás, beépített számlakép hatókör-választó rádiógombbal (Minden számla vs Csak számlaképpel, P-121, A-161), valamint pixelpontos hivatalos NAV 2665 ÁNYK digitális nyomtatvány replikával (Főlap, 01-01, 01-02, 01-03, 01-05, 07, 08, élő DB újraszámítás és laponkénti A4 nyomtatás, P-126, A-167)
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
- Fejlesztői napló (`/changelog`) – In-app patchnotes idővonal és kiadási jegyzék (P-112, A-149)
- Hibajegyek gomb (`/tickets`, olvasatlan badge számlálóval)

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
│  │   │ ⚡ TEENDŐK               │ • Cég Áttekintés                 │   │
│  │   │ • Hiányzó számlák [491]  │ • Cégprofil                      │   │
│  │   │ • Jóváhagyási sor        │ • Számlák & Bizonylatok          │   │
│  │   │ • Riasztások             │ • Hiányzó Bizonylatok            │   │
│  │   │ • Adónaptár & Határidők  │ • Egyéni Vállalkozás (EV - 8 tab)│   │
│  │   │ 💼 PORTFÓLIÓ             │ • Társasági Adó (TAO/KIVA - 7 tab│   │
│  │   │ • Portfólió (Főoldal)    │ • Bérszámfejtés (5 tab)          │   │
│  │   │ • Bérszámfejtés Ciklusok │ • NAV Bevallások                 │   │
│  │   │ • Irodai Riportok        │ • Könyvelési Szabályok (Prompts) │   │
│  │   │ • Onboarding             │ • Beállítások (Tabs)             │   │
│  │   │ • ▾ Szakmai Törzsadatok  │ • Cégkapu / KÜNY Tárhely        │   │
│  │   │ ✨ SEGÍTSÉG              │ • EGYKE Meghatalmazások          │   │
│  │   │ • AI Asszisztens (kiemelt│ • Adatmegőrzési Szabályzat       │   │
│  │   │ • Hibajegyek [számláló]  │ • Cégstruktúra (Telephelyek)     │   │
│  │   │ • Segítség               │ • Cégstruktúra (Telephelyek)     │   │
│  │   │ ⚙️ BEÁLLÍTÁSOK (lenyíló) │                                  │   │
│  │   │   ▸ Iroda & Beállítások  │                                  │   │
│  │   │   ▸ Biztonság & GDPR     │                                  │   │
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

#### 1. Portfólió Mód (`/eaisybooks/*`, PRD P-085)
Irodai szintű áttekintés 4 munkafolyamat-alapú kategóriában:

| Kategória | Menüpont | Útvonal | Ikon | Leírás & Funkció |
|---|---|---|---|---|
| **⚡ Teendők** | **Hiányzó számlák** | `/eaisybooks/missing-invoices` | `FileWarning` | Irodai szintű konszolidált lista hiányzó bizonylatokról; kiemelt piros badge (`491`) |
| | **Jóváhagyási sor** | `/eaisybooks/approval-queue` | `MailCheck` | Jóváhagyandó számlák és bizonylatok kötegelt (batch) ellenőrzése és elfogadása |
| | **Riasztások** | `/eaisybooks/alerts` | `AlertTriangle` | Kritikus események (lejárt határidő, anomáliák) |
| | **Adónaptár & Határidők** | `/eaisybooks/tax-calendar` | `Calendar` | Aggregált NAV és önkormányzati határidők az összes ügyfélre kiterjedően |
| **💼 Portfólió** | **Portfólió** | `/eaisybooks` | `Briefcase` | Grid / Lista / Kanban nézet az összes cégről; szűrés státuszra, könyvelőre; KPI mutatók |
| | **Bérszámfejtés Ciklusok** | `/eaisybooks?tab=payroll` | `Calculator` | Bérszámfejtési folyamatok havi zárási státusza az összes ügyfélnél |
| | **Irodai Riportok** | `/eaisybooks/reports` | `BarChart2` | Irodai szintű kimutatások és aggregációk |
| | **Onboarding** | `/eaisybooks/onboarding` | `Rocket` | Új ügyfelek felvétele és bevezetési folyamata |
| | **Szakmai Törzsadatok** | `/eaisybooks/admin/*` | `BookOpen` | Lenyíló almenü közvetlenül a Portfólió alatt: Sablonok, Jogviszonykódok, Adómértékek, Jogszabály-frissítések |
| **✨ Segítség** | **AI Asszisztens** | `/eaisybooks/ai-assistant` | `Bot` | Könyvelési jogszabály-értelmező, kontírozási tanácsadó; pulzáló vizuális AI pont |
| | **Hibajegyek** | `/eaisybooks/tickets` | `TicketCheck` | Hibajegykezelés és belső support; olvasatlan jegy számlálóval |
| | **Segítség** | `/eaisybooks/help` | `HelpCircle` | Rendszer súgó és interaktív útmutatók |
| **⚙️ Beállítások** | **Iroda & Beállítások** | `/eaisybooks/settings` | `Settings` | Beállítások, Profilbeállítások, Jogosultságkezelő, Könyvelők kezelése |
| | **Biztonság & GDPR** | `/eaisybooks/admin/*` | `ShieldCheck` | Audit napló, GDPR megfelelőség |

#### Hierarchikus Útvonalkövető (Breadcrumbs, PRD P-084)
Az eaisyBooks felületeken a `PageHeader` komponens és a `useAccountyBreadcrumbs` tiszta útvonalfeloldó biztosítja az azonnali, kattintható tájékozódást:
* `Portfólió / [Ügyfél neve] / [Aloldal] / [Ciklus]`
* Visszamenőlegesen 100%-ban kompatibilis a korábbi string-alapú fejlécekkel, determinisztikusan generálja a navigációs szinteket.

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

**Kapcsolt Vállalkozási Beállítások és Forgalmi Kimutatás (2026-09-27):**
- **Felső Tab Pill Navigáció:**
  - `Partnerek`: Master–Detail partnertörzs lista.
  - `Kapcsolt vállalkozások`: Dedikált forgalmi és egyenlegkimutatási nézet (`RelatedPartyTurnoverTab`).
- **Partner Űrlap Kapcsoltsági Panel:**
  - `related_party` (Switch): Kapcsolt vállalkozás jelölés.
  - `relation_type` (Select): Anyavállalat (`parent`), Leányvállalat (`subsidiary`), Közös vezetésű / Testvér (`sister`), Tulajdonos egyéb érdekeltsége (`owner_interest`), Egyéb (`other`).
  - `ownership_percent`: Tulajdoni részesedés százaléka (0-100%).
  - `valid_from` & `valid_to`: Kapcsoltság időbeli érvényessége.
  - `parent_partner_id`: Cégcsoport / Anyacég kiválasztása a meglévő partnertörzsből.
  - `custom_gl_account_id`: Egyedi felülírt kapcsolt főkönyvi számla (automatikus 3121 / 4551 helyett).
- **Forgalmi Kimutatás (`RelatedPartyTurnoverTab`):**
  - **KPI Kártyák:** Összes forgalom, Kimenő értékesítés, Bejövő beszerzés, Nyitott szaldó.
  - **Havi Készpénzforgalom Figyelő (Art. 114. §):** Automatikusan jelzi a készpénzes kifizetéseket kapcsolt felek között, piros figyelmeztetéssel az 1,5 millió Ft-os havi törvényi korlát átlépésekor.
  - **Transzferár Indikátor (Tao. tv. 18. §):** Éves 100M Ft-os dokumentációs határérték követése partnerenként.
  - **Export:** Excel (.xlsx) és CSV export lehetőség.
- **Automatikus Könyvelési Kontírozás (`invoiceGlSides.ts`):**
  - Vevői követelés kapcsolt partnernél: `312` / `3121` (Követelések kapcsolt vállalkozással szemben).
  - Árbevétel kapcsolt partnernél: `912` (Belföldi értékesítés árbevétele kapcsolt vállalkozással szemben).
  - Szállítói kötelezettség kapcsolt partnernél: `455` / `4551` (Kötelezettségek kapcsolt vállalkozással szemben).

**PartnerInvoiceDetailDialog:**
- Fejléc: számlaszám, ellenpartner, dátumok, bruttó összeg, fizetési mód, irány badge, forrás badge
- Tételek táblázat: Megnevezés, Mennyiség, Egység, Nettó, ÁFA, Bruttó, **Főkönyvi szám**
- Adatforrás: `nav_invoice_items` (NAV) vagy `invoice_items` (Beküldött)

> **Kapcsolódó döntések:** [P-124](./decisions/P-124-related-parties-management-and-turnover-ux.md) · [A-165](../architecture/decisions/A-165-related-parties-schema-and-accounting-integration.md) · [P-040](./decisions/P-040-partners-invoice-panel.md) · [P-044](./decisions/P-044-foreign-partner-display.md)

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
- **Kétoldalas T/K Kontírozás Szerkesztő Modál (2026-09-26):** A tétel főkönyvi mezőjére vagy a szerkesztésre kattintva megnyíló párbeszédablak kibővített asztali méretet (`w-[95vw] sm:max-w-3xl md:max-w-4xl`), explicit vízszintes túlcsordulás-védelmet (`overflow-x-hidden`) és `min-w-0` flex-guardokat kapott, biztosítva, hogy a Tartozik és Követel kártyák, a szintetikus számlamegnevezések és a lábléc akciógombjai (`Mégse` / `Mentés`) asztali felbontáson is levágás nélkül, rendezetten jelenjenek meg.

**GL Twin Sync (2026-06-27):**
- Ha a szerkesztett számla párosítva van (NAV `invoice_number` ↔ Beküldött `bizonylatsorszam` normalizálva)
- A rendszer automatikusan megkeresi a **"testvér" tételt** a másik táblában azonos `line_number`-rel
- **Egyetlen batch RPC** (`override_gl_classifications_batch`) frissíti mindkét oldalt
- Toast visszajelzés: *„Főkönyvi besorolás frissítve. (párosított számla is frissítve)"*
- Graceful degradation: ha nincs twin, csak az elsődleges tétel frissül

> **Kapcsolódó döntés:** [P-043](./decisions/P-043-gl-twin-sync.md) · [P-019](./decisions/P-019-gl-suggestion.md)

---

### Főkönyvi Kivonat (`/general-ledger`)

**Layout:** Moduláris ergonómiai architektúra: Elsődleges Műveleti Sáv (GlToolbar), Összecsukható KPI Sáv (GlKpiBar) és Szegmentált Szűrősáv (GlFilterBar) + Hierarchikus számlatükör fastruktúra és tételes táblázat

**URL Paraméterek & Állapotkezelés:**
- `?granularity=kontirok|teteles` – Nézet granularitás: `kontirok` (alapértelmezett számlaszintű összegzés) vs. `teteles` (összes aktív számlaosztály és kontír kinyitása)
- `?item_grouping=by_invoice|itemized` – Tétel-összevonás kapcsoló: `by_invoice` (alapértelmezett számlánkénti összevonás kontíronként) vs. `itemized` (részletes soronkénti tétellista); `localStorage`-ban is perzisztált
- `?date_basis=accounting|delivery` – Dátum alap (számviteli vs. teljesítési dátum)
- `?posting_status=all|posted_only` – Könyvelési státusz szűrő

**Fő Funkciók:**
- **Számlánkénti Tétel-összevonás:** Azonos kontíron az egy számlán szereplő tételek 1 sorba vonódnak össze kék jelvénnyel (`{count} tétel`), az összegek szummázásával. A különböző számlák külön sorok maradnak.
- **Részletező Tooltip:** Az összevont számlasor megnevezése fölé húzva az egeret egy áttekintő buborék mutatja meg az eredeti tételsorokat és összegeket.
- **Tömeges Kijelölés és Átkontírozás:** Az összevont sor kijelölése a háttérben az összes egyedi mögöttes tételt (`groupedItemIds`) automatikusan átadja a műveletsávnak.
- **4-Oszlopos Statisztikai és Analitikus Export:** Excel (.xlsx) és CSV export 2 szintes fejléccel és 4 diszkrét pénzügyi oszloppal (Forgalom Tartozik, Forgalom Követel, Egyenleg Tartozik, Egyenleg Követel) és automatikus összegző záróképletekkel.
- **Közvetlen Számlakép és NAV OSA Tételes Nézet Megnyitás:** A főkönyvi tételsorokban elhelyezett diszkrét nagyítós dokumentum ikon (`FileSearch`) segítségével közvetlenül a sorból előugrik a számlakép (`InvoiceImageDialog`), vagy ha a bizonylat még csak Online Számlából érkezett feltöltött kép nélkül, a strukturált NAV OSA tételes nézet (`InvoiceItemsDialog`). Működik mind a számlánként összevont (`by_invoice`), mind a részletes tételes (`itemized`) nézetben.

> **Kapcsolódó döntések:** [P-122](./decisions/P-122-general-ledger-ui-ux-restructuring-and-clutter-reduction.md) · [A-163](../architecture/decisions/A-163-general-ledger-ui-ux-restructuring-and-clutter-reduction.md) · [P-120](./decisions/P-120-general-ledger-invoice-document-preview-and-osa-fallback-ux.md) · [A-160](../architecture/decisions/A-160-general-ledger-invoice-document-preview-and-osa-fallback.md) · [P-117](./decisions/P-117-general-ledger-invoice-grouping-and-4col-export-ux.md) · [P-113](./decisions/P-113-general-ledger-granularity-kontirok-teteles-view.md) · [P-105](./decisions/P-105-general-ledger-toolbar-and-expand-collapse-ux.md) · [A-157](../architecture/decisions/A-157-general-ledger-invoice-grouping-and-4col-export.md) · [A-153](../architecture/decisions/A-153-general-ledger-batch-itemized-view-architecture.md)

---

### Tárgyi Eszközök és Fejlesztési Tartalék (`/teny`)

**Layout:** Kétlapfüles felső Pill váltó (`assets` vs. `development_reserves`) + Master–Detail eszköznyilvántartó felület

**1. Eszközök Lapfül (`/teny?tab=assets`):**
- **Bal oldali lista (60%):** Leltári szám, megnevezés, aktiválás dátuma, bruttó bekerülési érték, könyv szerinti nettó érték, státusz badge (`Aktív`, `Kivezetve`), Fejlesztési tartalék badge.
- **Jobb oldali panel (40% - `AssetDetailPanel`):**
  - Eszköz alapadatok és számlakapcsolat (eredeti számla száma, szállító neve).
  - Csatolt dokumentumok és generált Aktiválási Jegyzőkönyv (PDF letöltés és megtekintés).
  - **Kettős Értékcsökkenés Kártyák (`DepreciationCards`):**
    - Számviteli ÉCS: bekerülési érték és maradványérték alapján havonta elszámolt összeg.
    - Tao ÉCS: ha az eszköz fejlesztési tartalékból valósult meg, a Tao ÉCS alap a tartalék összegével csökken. 100%-os tartalékfedezet esetén a havi és halmozott Tao ÉCS pontosan 0 Ft (Tao. tv. 7. § (15) bek.).
  - **Fejlesztési Tartalék Műveletek:** Már aktivált eszköz esetén közvetlen dialógus (`DevelopmentReserveAssignDialog`) a tartalék utólagos hozzárendelésére vagy leválasztására.

**2. Fejlesztési Tartalékok Lapfül (`/teny?tab=development_reserves` - `DevelopmentReservesTab`):**
- **Összesítő Statisztikai Kártyák:**
  - Összes képzett fejlesztési tartalék (Ft).
  - Tárgyi eszközökre felhasznált összeg (Ft).
  - Szabad beruházási keret (Ft).
  - Következő lejáró keret összege és határideje (képzés éve + 4 év).
- **Keretek Részletes Táblázata:**
  - Képzés éve, Eredeti keretösszeg, Felhasznált keret (allokált eszközök összege), Szabad egyenleg, Felhasználási határidő, Státusz (`Aktív`, `Kimerült`, `Lejárt`).
- **„+ Új fejlesztési tartalék” Gomb és Dialógus:** Évszám, összeg és megjegyzés/határozatszám megadásával új keret rögzítése.

**3. Tárgyi Eszköz Aktiválási Varázsló (`AssetActivationDialog`):**
- Opcionális `Fejlesztési tartalék felhasználásával valósult meg` kapcsoló.
- Szabad tartalékkeret kiválasztása legördülő menüből (év és szabad egyenleg kijelzéssel).
- Felhasznált összeg rögzítése és automatikus Tao ÉCS tiltás/csökkentés.

**4. Automatikus Vegyes Napló Könyvelés (`developmentReserveAutoPoster`):**
- Tartalék aktiválásakor vagy utólagos hozzárendelésekor automatikusan létrejön a Vegyes napló tétel: **T 414 (Lekötött tartalék) — K 413 (Eredménytartalék)**, `FT-FELOLD-[Leltári szám]` bizonylatszámmal.
- Tartalék leválasztásakor a tétel visszavonásra/törlésre kerül.

**5. Tao Éves Zárás Varázsló Integráció (`TaoYearEndWizardPage`):**
- **1. lépés (Beszámoló):** TENY számviteli ÉCS automatikus átvétele gombnyomásra.
- **3. lépés (7. § Csökkentő tételek):** Tárgyévben képzett fejlesztési tartalék (7. § (1) f)) és Tao ÉCS (7. § (1) d)) automatikus betöltése.
- **4. lépés (8. § Növelő tételek):** Számviteli vs. Tao ÉCS különbözet (8. § (1) b)) automatikus betöltése.

> **Kapcsolódó döntések:** [P-123](./decisions/P-123-development-reserve-teny-ux.md) · [A-164](../architecture/decisions/A-164-development-reserve-fixed-assets-db-and-depreciation.md) · [P-052](./decisions/P-052-fixed-assets-project-assignment-ux.md)

---

### Magyar Társadalombiztosítási (TB) és Bérszámfejtési Modul (`/payroll`, 2026-09-27)

**Layout:** 5 lapfüles bérszámfejtési felület (`Ciklus`, `Foglalkoztatottak`, `NAV bevallások`, `Ügyfélportál`, `Beállítások`) + Kilépő dokumentumok és AI anomália riportok

**Fő Funkciók és Munkafolyamatok:**
- **Tbj. 27. § (2) szerinti Minimális Járulékalap Számítás:**
  - Havonta a minimálbér vagy garantált bérminimum 30%-ának elérése munkaviszony esetén.
  - A tényleges bruttó munkabér és a minimális alap közötti különbözet után keletkező 18,5% TB-járulék és 13% SZOCHO automatikus munkáltatói kötelezettségként kerül elszámolásra.
  - Mentesülési jogcímek (GYES, GYED, CSED, tanulói jogviszony, igazolt betegség) kezelése a jogviszony adatlapon (`tb_min_base_exempt`, `tb_min_base_exempt_reason`).
- **Időarányosítás és Távollét Szűrés:**
  - Ciklus-pontos lekérdezés és pontos nap-átfedés számítás hóközi belépés/kilépés és fizetés nélküli távollétek esetén.
- **Saját Jogú Nyugdíjasok Kezelése:**
  - Teljes járulék- és szocho-mentesség; hóközi nyugdíjazás esetén a nyugdíj kezdő napja (`pension_start_date`) alapján időarányos megosztás.
- **NAV ÁNYK 2608 M-lap Integráció és Többes Jogviszony (`Filing2608Page`):**
  - Többes jogviszonnyal rendelkező munkavállalóknál önálló sorok megjelenítése `(Jogviszony #X)` megjelöléssel.
  - XML generálásnál diszkrét `<Jogviszonysorszam>` sorszámozás az ÁNYK specifikáció szerint.
- **Pre-Flight Ellenőrző Dialógus (`FilingPreFlightDialog`):**
  - Automatikus előzetes ellenőrzés bevallás letöltése előtt (figyelmeztetés 0 Ft-os bruttó bér melletti minimális alap teherre, TAJ/FEOR adatok ellenőrzése).
- **Kilépő TB Dokumentáció (`ExitDocumentsPage`):**
  - Hivatalos formátumú PDF generálás: Egészségbiztosítási Igazolvány kivonat és kilépő TB igazolás biztosítási időről, táppénz napokról és levont járulékokról.
- **AI Anomália Elemző (`AiAnomalyReportPage`):**
  - Automatikus ellenőrző szabályok: minimális alap eltérések, nyugdíjkorhatár vs. státusz inkonzisztenciák, többes jogviszony heti munkaidő maximum túllépések felderítése.
- **3-Oszlopos Bérszámfejtési Dashboard & EFO Különválasztás (`PayrollDashboardPage`):**
  - 3-oszlopos strukturált grid: 1. Havi ciklusok (lezárt/nyitott státuszok, progress), 2. Foglalkoztatottak (állandó munkaviszonyos és megbízásos törzsállomány), 3. EFO alkalmi munka (éves 120 napos keretszámláló, színkódolt státuszjelvények: zöld 0-90 nap, sárga 91-119 nap, piros 120+ nap).
- **Foglalkoztatotti Típus-szűrés és Kétirányú URL Szinkronizáció (`EmployeesPage`):**
  - Mind / Állandó / EFO lapfülek közvetlen URL állapottal (`?type=regular`, `?type=efo`) és kontextusfüggő új dolgozó rögzítő gombokkal.

> **Kapcsolódó döntések:** [P-125](./decisions/P-125-tb-social-security-payroll-and-filing-ux.md) · [A-166](../architecture/decisions/A-166-tb-social-security-minimum-base-and-pensioner-payroll-engine.md) · [P-143](./decisions/P-143-payroll-3column-dashboard-and-efo-separation-ux.md)

---

### ÁFA Bevallás és A60 Közösségi Összesítő (`/vat-return`, 2026-09-30)

**Layout:** 9 lapfüles ÁFA bevallási és analitikai modul (`65-ös bevallás`, `Éves mátrix`, `Tételes M-lap`, `Fordított ÁFA`, `A60 Közösségi`, `ÁFA tétellista`, `Gyűjtőkódok`, `26TFEJLH`, `Beállítások`)

**Fő Funkciók és Munkafolyamatok:**
- **A60 Közösségi Összesítő és 65-ös Bevallás Törvényi Összefüggés-vizsgálata:**
  - 4-kártyás felső összefoglaló sáv: 02. sor (Közösségi termékértékesítés), 11–16. sor (Közösségi termékbeszerzés), 91–92. sor (Közösségi szolgáltatásnyújtás), 18. sor (Közösségi szolgáltatás igénybevétele).
  - Vizuális rekonsziliáció: Zöld pipa („Teljes egyezés”) vagy sárga figyelmeztető badge eltérés esetén numerikus különbséggel és tooltippel.
- **4-Lapfüles Belső Szerkezet (`VatA60Table`):**
  - 01-es lap: Közösségi termékértékesítés (`goods_out`)
  - 02-es lap: Közösségi termékbeszerzés (`goods_in`)
  - 03-as lap: Közösségi szolgáltatásnyújtás (`services_out`)
  - 04-es lap: Közösségi szolgáltatás igénybevétele (`services_in`)
- **Élő Európai Bizottsági VIES REST API Ellenőrzés:**
  - A táblázat eszköztárában elhelyezett „VIES ellenőrzés” gomb közvetlenül az Európai Bizottság szerverét kérdezi le böngészőből.
  - Valós idejű státusz badge-ek: `Érvényes VIES` (zöld), `Érvénytelen` (piros), `Nincs ellenőrizve` (szürke), `VIES hiba` (sárga).
- **Tételes Számlafúrás (Drill-Down) és Előnézet:**
  - Lenyitható partnersorok az érintett számlák felsorolásával, bizonylatszámra kattintva azonnali számlakép előnézet.

> **Kapcsolódó döntések:** [BDR 064](../business/decisions/064-a60-community-vat-and-vies-crosscheck.md) · [A-181](../architecture/decisions/A-181-a60-community-vat-and-vies-crosscheck.md) · [P-144](./decisions/P-144-vat-a60-community-summary-and-vies-crosscheck-ux.md) · [A-159](../architecture/decisions/A-159-statutory-vat-views-upgrade-and-osa-reconciliation.md)

---

### Globális Cégválasztó és Ügyféllista Rendezés (2026-09-30)

**Érintett Komponensek:** `CompanySelector.tsx`, `CompanySwitcher.tsx`, `AccountyCompanySelector.tsx`, `CompanyContext.tsx`

**Fő Funkciók és Felületi Élmény:**
- **Magyar Ábécé Szerinti Determinisztikus Rendezés:**
  - A cégek és könyvelt ügyfelek listája minden cégválasztó felületen (fejléc, Accounty váltó, navigációs menük) szigorúan magyar ábécé szerint (`localeCompare('hu', { sensitivity: 'base' })`) jelenik meg.
  - A magyar ékezetes karakterek (Á, É, Í, Ó, Ö, Ő, Ú, Ü, Ű) pontos nyelvi besorolást kapnak.
  - A pinelt és aktív ügyfél kiemelése változatlanul prioritást élvez a lenyíló listák tetején.

> **Kapcsolódó döntések:** [P-145](./decisions/P-145-company-selector-alphabetical-sorting-ux.md) · [P-076](./decisions/P-076-eaisybooks-dual-mode-navigation-and-company-switcher-ux.md) · [P-085](./decisions/P-085-eaisybooks-portfolio-navigation-grouping-ux.md)

---

### Részfizetés, Jutaléklevonás és Tranzakció Deduplikáció (`/invoices`, `/transactions`, 2026-09-30)

**Érintett Komponensek & RPC-k:** `NavInvoiceRow.tsx`, `SubmittedInvoiceRow.tsx`, `ManualMatchSearchSection.tsx`, `candidateFinder.ts`, `matchingService.ts`, `get_filtered_nav_invoices`, `get_filtered_submitted_invoices`, `get_invoice_kpis`

**Fő Funkciók és Felületi Élmény:**
- **Deduplikált Tranzakciós Egyenleg-számítás:**
  - Az adatbázis RPC-k SQL `UNION` alapú `all_tx_distinct` CTE-vel akadályozzák meg, hogy a számlaláncolat miatt párhuzamosan tárolt tranzakciós rekordok kétszeresen adódjanak hozzá a kifizetett összeghez.
- **Részfizetési Státusz és Részletes Tooltip:**
  - Ha a számla csak részben lett kifizetve (`paid_amount < gross_amount - 0.5`), a számla státusza kötelezően `Részben fizetve` (`partially_paid`).
  - A státusz badge tooltipje pontosan feltünteti a kifizetett összeget (`paid_amount`) és a nyitott hátralékot (`remaining_amount`).
- **Jutalékkal Csökkentett Utalások és Sorszám-prioritás:**
  - Ha a banki tranzakció leírása/közleménye tartalmazza a számla sorszámát (pl. jutaléklevonásos utalás esetén), a számla automatikusan a legelső (#1) helyen kerül felajánlásra a manuális párosítási fiókban még ±30%-ot meghaladó összegeltérés esetén is.
  - A tranzakciónál rögzített jutalékösszeg (`fee_amount`) beszámít a számla fedezetébe.

> **Kapcsolódó döntések:** [A-182](../architecture/decisions/A-182-partial-payment-matching-and-transaction-deduplication.md) · [P-146](./decisions/P-146-partial-payment-and-fee-deduction-match-ux.md) · [A-082](../architecture/decisions/A-082-partially-paid-invoices-status.md) · [P-064](./decisions/P-064-partially-paid-invoice-status-ux.md) · [A-139](../architecture/decisions/A-139-transaction-fee-amount-and-batch-invoice-resolution.md)

---

---

## 7. Rendszer Tudásbázis és Funkciókalauz (Knowledge Base)

A rendszer teljes menü- és funkcióstruktúrájának részletes, fájlonkénti leírását az alábbi tudásbázis tartalmazza:
- **Master Index:** [docs/knowledge-base/README.md](../knowledge-base/README.md)
- **eaisyBill menük:** [docs/knowledge-base/eaisybill/](../knowledge-base/eaisybill/) (29 külön .md fájl)
- **eaisyBooks menük:** [docs/knowledge-base/eaisybooks/](../knowledge-base/eaisybooks/) (34 külön .md fájl)
- Minden dokumentum maradéktalanul tartalmazza az adott menü funkcióját, elhelyezkedését és a felhasználói cselekvéseket.


