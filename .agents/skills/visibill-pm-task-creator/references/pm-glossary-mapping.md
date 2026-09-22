# 📖 Visibill PM Fogalom- és Komponens Térkép (Glossary Mapping)

Ez a segédlet a projektmenedzserek (PM-ek) által a mindennapokban használt hétköznapi, vázlatos kifejezéseket képezi le a **Visibill / eaisyBill / eaisyBooks** hivatalos dokumentációjára (`docs/`), adatmodelljére és kódkomponenseire.

---

## 1. Dátumok & Időszaki Szűrések

| PM Kifejezés | Hivatalos Domain Fogalom | Adatbázis / Kód Mező | Releváns Docs & Döntések | Kódkomponens / Elhelyezkedés |
|---|---|---|---|---|
| *"keltezés"*, *"kiállítás"*, *"számla kelte"* | Kibocsátás kelte / Kiállítás dátuma | `issue_date` | [P-066](file:///d:/ThinkAI/Visibill/eaisybill-prod/docs/product/decisions/P-066-gl-date-basis-toggle-and-settings-ux.md), [BRD 049](file:///d:/ThinkAI/Visibill/eaisybill-prod/docs/business/decisions/049-gl-date-basis-fulfillment-vs-issue.md) | Számla sor, `DateRangeFilter.tsx`, `GlobalDateRangeFilter` |
| *"teljesítés"*, *"teljesítés dátuma"* | Teljesítés kelte / Adózási teljesítés | `fulfillment_date` / `delivery_date` | [P-066](file:///d:/ThinkAI/Visibill/eaisybill-prod/docs/product/decisions/P-066-gl-date-basis-toggle-and-settings-ux.md), [BRD 049](file:///d:/ThinkAI/Visibill/eaisybill-prod/docs/business/decisions/049-gl-date-basis-fulfillment-vs-issue.md), [BRD 057](file:///d:/ThinkAI/Visibill/eaisybill-prod/docs/business/decisions/057-cross-year-delivery-accounting-rules.md) | Számla tétel, `DateRangeFilter.tsx` |
| *"esedékesség"*, *"fizetési határidő"* | Fizetési határidő | `payment_deadline` / `due_date` | [P-010](file:///d:/ThinkAI/Visibill/eaisybill-prod/docs/product/decisions/P-010-invoice-list.md) | Számla táblázat, fizetési státusz jelzők |
| *"legfelül a dátumválasztó"*, *"időszak"* | Globális időszakszűrő | `dateRange` state / URL query param | [design/05-layout-navigation.md](file:///d:/ThinkAI/Visibill/eaisybill-prod/docs/design/05-layout-navigation.md) | `src/components/Header.tsx`, `DateRangeFilter.tsx` |

---

## 2. Navigáció & Layout

| PM Kifejezés | Hivatalos Domain Fogalom | Technikai Megvalósítás | Releváns Docs |
|---|---|---|---|
| *"bal oldali menü"*, *"oldalsáv"* | Alkalmazás oldalsáv (Sidebar) | `Sidebar.tsx`, `navItems` | [P-006](file:///d:/ThinkAI/Visibill/eaisybill-prod/docs/product/decisions/P-006-sidebar-structure.md), [design/05](file:///d:/ThinkAI/Visibill/eaisybill-prod/docs/design/05-layout-navigation.md) |
| *"legfelül a fejléc"* | Globális fejléc (Header) | `Header.tsx`, `GlobalSearch`, `CompanySwitcher` | [P-005](file:///d:/ThinkAI/Visibill/eaisybill-prod/docs/product/decisions/P-005-dashboard-layout.md), [design/05](file:///d:/ThinkAI/Visibill/eaisybill-prod/docs/design/05-layout-navigation.md) |
| *"cégváltó"*, *"cég választó fentről"* | Aktív Cégválasztó (Company Switcher) | `CompanySwitcher.tsx`, `useCompany` context | [P-076](file:///d:/ThinkAI/Visibill/eaisybill-prod/docs/product/decisions/P-076-eaisybooks-dual-mode-navigation-and-company-switcher-ux.md), [A-003](file:///d:/ThinkAI/Visibill/eaisybill-prod/docs/architecture/decisions/A-003-multi-company-rls.md) |
| *"módváltó"*, *"Visibill vs Könyvelő váltás"* | App Módválasztó (App Mode Switcher) | `AppModeSwitcher.tsx` (`visibill` vs `accounty`) | [P-083](file:///d:/ThinkAI/Visibill/eaisybill-prod/docs/product/decisions/P-083-eaisybooks-eaisybill-app-mode-switcher-and-cold-warm-transition-ux.md) |
| *"kenyérmorzsa"*, *"útvonal felette"* | Hierarchikus kenyérmorzsa (Breadcrumbs) | `Breadcrumb.tsx`, `useBreadcrumbs` | [P-084](file:///d:/ThinkAI/Visibill/eaisybill-prod/docs/product/decisions/P-084-hierarchical-breadcrumbs-navigation-ux.md) |

---

## 3. Számlák & Bizonylatok

| PM Kifejezés | Hivatalos Domain Fogalom | Adatbázis / Kód | Releváns Docs |
|---|---|---|---|
| *"számlák"*, *"bizonylatok"* | Számla entitás (`incoming` / `outgoing`) | `invoices`, `nav_invoices` | [P-010](file:///d:/ThinkAI/Visibill/eaisybill-prod/docs/product/decisions/P-010-invoice-list.md), [P-057](file:///d:/ThinkAI/Visibill/eaisybill-prod/docs/product/decisions/P-057-invoices-feature-slice-ux.md), [012](file:///d:/ThinkAI/Visibill/eaisybill-prod/docs/business/decisions/012-invoice-types.md) |
| *"költségszámla"*, *"bejövő számla"* | Bejövő számla | `direction = 'incoming'` | [P-010](file:///d:/ThinkAI/Visibill/eaisybill-prod/docs/product/decisions/P-010-invoice-list.md) |
| *"vevői számla"*, *"kimenő számla"* | Kimenő / Értékesítési számla | `direction = 'outgoing'` | [P-010](file:///d:/ThinkAI/Visibill/eaisybill-prod/docs/product/decisions/P-010-invoice-list.md) |
| *"számla feltöltés"*, *"fájl behúzás"* | Dokumentum feltöltés & OCR pipeline | `upload-document`, `MarkItDown`, PGMQ | [P-013](file:///d:/ThinkAI/Visibill/eaisybill-prod/docs/product/decisions/P-013-upload-ux.md), [A-041](file:///d:/ThinkAI/Visibill/eaisybill-prod/docs/architecture/decisions/A-041-three-tier-upload-deduplication.md) |
| *"tömeges kijelölés / módosítás"* | Tömeges műveletek (Bulk Actions) | `BulkActionsBar.tsx`, `useSelection` | [P-015](file:///d:/ThinkAI/Visibill/eaisybill-prod/docs/product/decisions/P-015-bulk-actions.md) |
| *"sztornó"*, *"jóváírás"* | Sztornózás & helyesbítő kapcsolatok | `invoice_relations`, `is_storno` | [BRD 042](file:///d:/ThinkAI/Visibill/eaisybill-prod/docs/business/decisions/042-storno-invoice-business-rule.md), [P-048](file:///d:/ThinkAI/Visibill/eaisybill-prod/docs/product/decisions/P-048-storno-settle-ux.md) |
| *"kizárás könyvelésből"* | Könyvelésből kizárás flag | `is_excluded_from_accounting` | [P-089](file:///d:/ThinkAI/Visibill/eaisybill-prod/docs/product/decisions/P-089-invoice-exclude-from-accounting-optimistic-toggle-ux.md) |
| *"NAV szinkron"*, *"számlák letöltése"* | NAV Online Számla szinkronizáció | `nav-auto-sync`, `NavSyncDialog.tsx` | [P-049](file:///d:/ThinkAI/Visibill/eaisybill-prod/docs/product/decisions/P-049-nav-sync-dialog-ux.md), [BRD 016](file:///d:/ThinkAI/Visibill/eaisybill-prod/docs/business/decisions/016-nav-sync-strategy.md), [A-012](file:///d:/ThinkAI/Visibill/eaisybill-prod/docs/architecture/decisions/A-012-nav-integration.md) |

---

## 4. Bank, Tranzakciók & Párosítás

| PM Kifejezés | Hivatalos Domain Fogalom | Kód / Tábla | Releváns Docs |
|---|---|---|---|
| *"banki tételek"*, *"tranzakciók"* | Banki tranzakciók | `bank_transactions`, `TransactionsPage` | [P-016](file:///d:/ThinkAI/Visibill/eaisybill-prod/docs/product/decisions/P-016-transaction-list.md), [BRD 026](file:///d:/ThinkAI/Visibill/eaisybill-prod/docs/business/decisions/026-banking-integration.md) |
| *"párosítás"*, *"összekapcsolás"* | Számla-tranzakció egyeztetés (Matching) | `match_confidence`, in-memory hash matcher | [P-017](file:///d:/ThinkAI/Visibill/eaisybill-prod/docs/product/decisions/P-017-matching-display.md), [P-018](file:///d:/ThinkAI/Visibill/eaisybill-prod/docs/product/decisions/P-018-manual-matching.md), [A-039](file:///d:/ThinkAI/Visibill/eaisybill-prod/docs/architecture/decisions/A-039-transaction-matching-engine-v2.md) |
| *"részfizetés"* | Részben kifizetett számla státusz | `partially_paid`, hátralévő egyenleg | [P-064](file:///d:/ThinkAI/Visibill/eaisybill-prod/docs/product/decisions/P-064-partially-paid-invoice-status-ux.md), [BRD 041](file:///d:/ThinkAI/Visibill/eaisybill-prod/docs/business/decisions/041-manual-payment-recording.md) |
| *"kézi fizetés"*, *"készpénzes kiegyenlítés"* | Kézi kiegyenlítés / Pénztárbizonylat | `petty_cash_vouchers`, fizetés rögzítés | [P-046](file:///d:/ThinkAI/Visibill/eaisybill-prod/docs/product/decisions/P-046-penztarbizonylat-upload-ux.md), [P-092](file:///d:/ThinkAI/Visibill/eaisybill-prod/docs/product/decisions/P-092-petty-cash-manual-entry-validation-and-settlement-ux.md) |

---

## 5. eaisyBooks (Accounty) & Könyvelői Modulok

| PM Kifejezés | Hivatalos Domain Fogalom | Kód / Route | Releváns Docs |
|---|---|---|---|
| *"könyvelői oldal"*, *"accounty"* | eaisyBooks könyvelőirodai modul | `/accounty/*` | [P-031](file:///d:/ThinkAI/Visibill/eaisybill-prod/docs/product/decisions/P-031-accounty-layout.md), [BRD 031](file:///d:/ThinkAI/Visibill/eaisybill-prod/docs/business/decisions/031-accounty-module.md) |
| *"főkönyv"*, *"kivonat"*, *"naplófőkönyv"* | Főkönyvi kimutatások | `/accounty/gl`, `general_ledger_entries` | [P-066](file:///d:/ThinkAI/Visibill/eaisybill-prod/docs/product/decisions/P-066-gl-date-basis-toggle-and-settings-ux.md), [P-067](file:///d:/ThinkAI/Visibill/eaisybill-prod/docs/product/decisions/P-067-gl-posting-status-filter-and-journal-governance-ux.md), [BRD 043](file:///d:/ThinkAI/Visibill/eaisybill-prod/docs/business/decisions/043-accounting-journals.md) |
| *"EV könyvelés"*, *"pénztárkönyv"* | Egyéni vállalkozói modul (Átalány/VSZJA) | `/accounty/ev`, `accounty_ev_client_settings` | [P-073](file:///d:/ThinkAI/Visibill/eaisybill-prod/docs/product/decisions/P-073-ev-bookkeeping-and-cashbook-ux.md), [BRD 051](file:///d:/ThinkAI/Visibill/eaisybill-prod/docs/business/decisions/051-ev-and-org-bookkeeping.md) |
| *"bérszámfejtés"*, *"jelenléti ív"* | Bérszámfejtési ciklus & jelenlét | `/accounty/payroll`, `payroll_cycles` | [P-033](file:///d:/ThinkAI/Visibill/eaisybill-prod/docs/product/decisions/P-033-payroll-cycle.md), [P-072](file:///d:/ThinkAI/Visibill/eaisybill-prod/docs/product/decisions/P-072-payroll-cycle-attendance-manual-entry-and-cafeteria-ux.md), [BRD 032](file:///d:/ThinkAI/Visibill/eaisybill-prod/docs/business/decisions/032-payroll-module.md) |
| *"ÁFA bevallás"*, *"ÁFA analitika"* | ÁFA kimutatások & M-lapok | `/accounty/vat`, `P-032`, `P-060`, `P-097` | [P-060](file:///d:/ThinkAI/Visibill/eaisybill-prod/docs/product/decisions/P-060-statutory-reporting-and-vat-return-modular-ux.md), [P-097](file:///d:/ThinkAI/Visibill/eaisybill-prod/docs/product/decisions/P-097-nav-2665-replica-steel-analytics-and-anyk-validation-ux.md) |
| *"tárgyi eszközök"*, *"értékcsökkenés"* | Tárgyi eszköz nyilvántartás & ÉCS | `/accounty/fixed-assets`, `fixed_assets` | [P-052](file:///d:/ThinkAI/Visibill/eaisybill-prod/docs/product/decisions/P-052-fixed-assets-project-assignment-ux.md), [BRD 023](file:///d:/ThinkAI/Visibill/eaisybill-prod/docs/business/decisions/023-fixed-assets.md) |
