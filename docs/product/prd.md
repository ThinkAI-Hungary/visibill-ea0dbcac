# Visibill — Product Requirements Document (PRD)

> **Verzió:** 1.1 | **Dátum:** 2026-05-16  
> **Kapcsolódó:** [Information Architecture](./information-architecture.md) · [Product Decisions](./decisions/index.md)

---

## 1. Termék Összefoglaló

A Visibill egy webes pénzügyi asszisztens magyar KKV cégvezetőknek. A termék 7 fő modulból áll, amelyek lefedik a napi pénzügyi adminisztrációt a számla beérkezéstől az éves beszámoló benyújtásáig.

**Felhasználói szerepek:**

| Szerep | Hozzáférés |
|--------|-----------|
| Owner | Teljes hozzáférés minden modulhoz és beállításhoz |
| Admin | Teljes hozzáférés (owner alias) |
| Member | Teljes hozzáférés minden modulhoz és beállításhoz |
| Employee | Csak Munkaidő modul |

---

## 2. Modulok & Funkciók

### 2.1 Onboarding

A felhasználó első élménye a regisztrációtól a produktív használatig.

| Funkció | Leírás | Ref |
|---------|--------|-----|
| Regisztráció | Email + jelszó, email verifikáció, social login nélkül | [P-001](./decisions/P-001-registration-flow.md) |
| Onboarding Wizard | 4-lépéses modal alapú kezdeti beállító (cég regisztráció/csatlakozás, projektek, kategóriák, NAV integráció + háttér sync) | [P-003](./decisions/P-003-empty-state.md) |
| Product Tour | 13 lépéses interaktív tour a fő funkciók és oldalak bemutatásához | [P-002](./decisions/P-002-product-tour.md) |
| Onboarding Checklist | Opcionális feladatlista: "Tölts fel 1 számlát", "Kösd össze a NAV-ot", "Importálj bank kivonatot" | [P-002](./decisions/P-002-product-tour.md) |
| Welcome Email | Regisztráció utáni üdvözlő email, drip campaign nélkül | [P-004](./decisions/P-004-welcome-flow.md) |
| Employee Regisztráció | Token-alapú meghívás (EmployeeRegister.tsx), korlátozott munkaidős hozzáféréssel | [P-001](./decisions/P-001-registration-flow.md) |

**Fejlesztendő:** Onboarding checklist implementálás.

---

### 2.2 Dashboard & Navigáció

A központi áttekintő és az alkalmazás navigációs struktúrája.

| Funkció | Leírás | Ref |
|---------|--------|-----|
| Dashboard | Fix elrendezésű widgetek: metrikák, ÁFA, párosítatlan tételek, számla státuszok, bevétel/kiadás chart, legutóbbi számlák, előfizetés | [P-005](./decisions/P-005-dashboard-layout.md) |
| Dashboard Preferences | Valuta váltó (HUF/EUR/USD), bruttó/nettó toggle, collapsible szekciók | [P-005](./decisions/P-005-dashboard-layout.md) |
| Testreszabhatóság | Nincs widget drag & drop vagy hide/show — a preferences elegendőek | [P-009](./decisions/P-009-dashboard-customization.md) |
| Sidebar Navigáció | 19 menüpont → collapsible kategóriákba csoportosítva (7 csoport) | [P-006](./decisions/P-006-sidebar-structure.md) |
| Globális Dátumszűrő | Minden oldal azonos dátum kontextusban működik (GlobalDatePicker) | [IA](./information-architecture.md) |
| Keresés | Nincs globális keresés — oldalankénti szűrők | [P-039](./decisions/P-039-global-search.md) |

**Fejlesztendő:** Sidebar csoportosítás (flat → 7 collapsible kategória).

A részletes navigáció struktúrát lásd: [Information Architecture](./information-architecture.md)

---

### 2.3 Számla Kezelés

Számlák bevitele, feldolgozása, ellenőrzése és javítása.

| Funkció | Leírás | Ref |
|---------|--------|-----|
| Számla Lista | Táblázatos nézet szűrőkkel: státusz, típus, dátum, partner, összeg. Szűrők megőrződnek. | [P-010](./decisions/P-010-invoice-list.md) |
| Számla Szerkesztés | 2 dialógus: egyedi mező javítás (InvoiceEditDialog) + teljes szerkesztés tételekkel (InvoiceFullEditDialog). | [P-012](./decisions/P-012-invoice-editing.md) |
| Feltöltés | Multi-file batch upload (drag & drop), per-file progress bar. PDF/JPG/PNG támogatás. | [P-013](./decisions/P-013-upload-ux.md) |
| Email Bevitel | Automatikus email alias (cegnev@inbox.visibill.hu) → csatolt számlák feldolgozása | — |
| NAV Szinkron | NAV Online Számla API v3 → bejövő/kimenő számlák automatikus letöltése | — |
| Bulk Actions | Checkbox select → törlés, GL kategorizálás, export. "Select all" confirm dialógussal. | [P-015](./decisions/P-015-bulk-actions.md) |

**Fejlesztendő:** Multi-file batch upload, bulk actions.

---

### 2.4 Tranzakció & Párosítás

Banki tranzakciók importálása, AI-alapú párosítás számlákkal, manuális felülírás.

| Funkció | Leírás | Ref |
|---------|--------|-----|
| Tranzakció Lista | Táblázat + futár riport tab ugyanazon az oldalon. Szűrők: dátum, összeg, típus, párosítási státusz. | [P-016](./decisions/P-016-transaction-list.md) |
| AI Párosítás Megjelenítés | Confidence score + match type + gl_reasoning DB-ben tárolva. Részletek dialógusban (TransactionDetailsDialog). Lista nézetben vizuális confidence megjelenítés: TODO. | [P-017](./decisions/P-017-matching-display.md) |
| Manuális Felülírás | Dialógusban keresés + hozzárendelés, is_verified flag, minden felülírás audit logban. | [P-018](./decisions/P-018-manual-matching.md) |
| Futár Riportok | GLS, MPL, Mixpack CSV import + parsing (3 futár tab) | — |

---

### 2.5 Főkönyv & Riportok

Főkönyvi kategorizálás, pénzügyi kimutatások és éves beszámoló.

| Funkció | Leírás | Ref |
|---------|--------|-----|
| GL Javaslat | AI-alapú GL szám javaslat confidence-szel és indoklással. Manuális elfogadás szükséges — nincs auto-accept. | [P-019](./decisions/P-019-gl-suggestion.md) |
| Eredménykimutatás | P&L oldal — bevételek és kiadások kimutatása | — |
| Mérleg | Balance Sheet oldal — eszközök és források | — |
| Beszámoló | Workflow: draft → validated → finalized → submitted. 19 kiegészítő melléklet sablon. Frozen data snapshot véglegesítéskor. | [P-020](./decisions/P-020-report-workflow.md) |
| Export | CSV (gépi feldolgozás) + PDF (nyomtatás, megosztás). Excel nem prioritás. | [P-021](./decisions/P-021-export-formats.md) |

**Fejlesztendő:** CSV + PDF export implementálás.

---

### 2.6 Értesítések

Email és in-app értesítési rendszer.

| Funkció | Leírás | Ref |
|---------|--------|-----|
| Email Értesítések | Típusonkénti toggle: számla feldolgozás, hibák, NAV sync, tranzakció párosítás, heti/havi összefoglaló | [P-022](./decisions/P-022-email-notifications.md) |
| In-app Értesítés | Real-time toast értesítések. Nincs értesítési center (harang ikon). | [P-023](./decisions/P-023-notification-center.md) |
| Összefoglaló Email | Heti és havi: minimál számok + trendek. Backend-only (Edge Function + cron), nincs UI felület. | [P-024](./decisions/P-024-summary-emails.md) |

---

### 2.7 Beállítások

Cég és felhasználói beállítások, csapatkezelés.

| Funkció | Leírás | Ref |
|---------|--------|-----|
| Settings Struktúra | 4 szekció egy oldalon: Business, Profile, Security, System | [P-025](./decisions/P-025-settings-structure.md) |
| Cégprofil | Cégnév, adószám, cím, email alias kezelés, share token, telephely (HQ/branch) | [P-026](./decisions/P-026-company-profile.md) |
| Csapattagok | Share token alapú csatlakozás. Nincs email meghívás, nincs tag kezelés panel. | [P-027](./decisions/P-027-team-management.md) |

> **Megjegyzés:** A korábbi Stripe-alapú előfizetés rendszer (Pricing oldal, SubscriptionContext, limit kezelés) eltávolítva 2026-06-07-én. Az értékesítés egyszeri díjas modellre vált — lásd [004-pricing-model.md](../business/decisions/004-pricing-model.md).

---

## 3. Fejlesztendő Funkciók Összesítése

| Funkció | Modul | Döntés |
|---------|-------|--------|
| Onboarding checklist | 2.1 Onboarding | P-002 |
| Multi-file batch upload | 2.3 Számla | P-013 |
| Bulk actions (checkbox) | 2.3 Számla | P-015 |
| CSV + PDF export | 2.5 Riportok | P-021 |

---

## 4. Nyitott Döntés

| Döntés | Leírás | Opciók |
|--------|--------|--------|
| 004 | Egyszeri díj struktúra és összeg | Lásd [004-pricing-model.md](../business/decisions/004-pricing-model.md) |
