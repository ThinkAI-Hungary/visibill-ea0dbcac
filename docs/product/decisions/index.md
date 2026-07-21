# Visibill — Product Requirements: Döntések

> **Utoljára frissítve:** 2026-07-21  
> **Összesen:** 43 döntés | ✅ Decided: 40 | ⛔ Superseded: 2 | 🔴 Open: 1

---

## Hogyan használd

Minden döntés egy külön `.md` fájl. A **Decided** státuszúaknál a döntés és indoklás dokumentálva. Az **Open** státuszúak még döntésre várnak.

---

## 📱 Onboarding & Első Élmény

| # | Döntés | Státusz | Fájl |
|---|--------|---------|------|
| P-001 | Regisztrációs flow | ✅ Decided | [P-001](./P-001-registration-flow.md) |
| P-002 | Product Tour + onboarding checklist | ✅ Decided | [P-002](./P-002-product-tour.md) |
| P-003 | Empty state dashboard & onboarding wizard | ✅ Decided | [P-003](./P-003-empty-state.md) |
| P-004 | Welcome email & értesítések | ✅ Decided | [P-004](./P-004-welcome-flow.md) |

## 📊 Dashboard & Navigáció

| # | Döntés | Státusz | Fájl |
|---|--------|---------|------|
| P-005 | Dashboard widgetek & elrendezés | ✅ Decided | [P-005](./P-005-dashboard-layout.md) |
| P-006 | Sidebar menüstruktúra (csoportosított) | ✅ Decided | [P-006](./P-006-sidebar-structure.md) |
| P-009 | Dashboard testreszabhatóság | ✅ Decided | [P-009](./P-009-dashboard-customization.md) |

## 📄 Számla Kezelés

| # | Döntés | Státusz | Fájl |
|---|--------|---------|------|
| P-010 | Számla lista nézet & szűrők | ✅ Decided | [P-010](./P-010-invoice-list.md) |
| P-012 | Számla szerkesztés (3 szintű dialógus) | ✅ Decided | [P-012](./P-012-invoice-editing.md) |
| P-013 | Feltöltés UX (multi-file batch upload) | ✅ Decided | [P-013](./P-013-upload-ux.md) |
| P-015 | Tömeges műveletek (checkbox bulk actions) | ✅ Decided | [P-015](./P-015-bulk-actions.md) |
| P-045 | PDF Export UX & Banner viselkedés (auto-download, fallback, toast) | ✅ Decided | [P-045](./P-045-pdf-export-ux.md) |
| P-046 | Pénztárbizonylatok feltöltési fül (vouchers tab + elkülönített upload) | ✅ Decided | [P-046](./P-046-penztarbizonylat-upload-ux.md) |

## 🔄 Tranzakció & Párosítás

| # | Döntés | Státusz | Fájl |
|---|--------|---------|------|
| P-016 | Tranzakció lista + futár tab | ✅ Decided | [P-016](./P-016-transaction-list.md) |
| P-017 | AI párosítás megjelenítés (confidence + reason) | ✅ Decided | [P-017](./P-017-matching-display.md) |
| P-018 | Manuális párosítás felülírás + ML tanulás + deviza-tudatos | ✅ Decided | [P-018](./P-018-manual-matching.md) |

## 📒 Főkönyv & Riportok

| # | Döntés | Státusz | Fájl |
|---|--------|---------|------|
| P-019 | GL kategorizálás javaslat (manuális elfogadás) | ✅ Decided | [P-019](./P-019-gl-suggestion.md) |
| P-020 | Beszámoló workflow (3 oldal, lineáris) | ✅ Decided | [P-020](./P-020-report-workflow.md) |
| P-021 | Export formátumok (CSV + PDF) | ✅ Decided | [P-021](./P-021-export-formats.md) |
| P-043 | GL besorolás NAV ↔ Beküldött dual-table szinkronizáció (twin sync) | ✅ Decided | [P-043](./P-043-gl-twin-sync.md) |

## 🔔 Értesítések & Kommunikáció

| # | Döntés | Státusz | Fájl |
|---|--------|---------|------|
| P-022 | Email értesítés típusok (granular toggle) | ✅ Decided | [P-022](./P-022-email-notifications.md) |
| P-023 | In-app értesítési center (3 rétegű toast: Realtime + session poll + catch-up) | ✅ Decided | [P-023](./P-023-notification-center.md) |
| P-024 | Heti/havi összefoglaló (minimál számok) | ✅ Decided | [P-024](./P-024-summary-emails.md) |

## ⚙️ Beállítások & Profil

| # | Döntés | Státusz | Fájl |
|---|--------|---------|------|
| P-025 | Settings oldal struktúra (5 szekció + FX beállítások) | ✅ Decided | [P-025](./P-025-settings-structure.md) |
| P-026 | Cégprofil adatok (alap + alias + telephely) | ✅ Decided | [P-026](./P-026-company-profile.md) |
| P-027 | Csapattagok kezelés (share token) | ✅ Decided | [P-027](./P-027-team-management.md) |
| P-048 | IMAP/SMTP Levelező Beállítások és Tabs UX | ✅ Decided | [P-048](./P-048-imap-smtp-settings-tabs-ux.md) |

## 💳 Előfizetés & Pricing

| # | Döntés | Státusz | Fájl |
|---|--------|---------|------|
| P-028 | Pricing oldal | ⛔ Superseded | [P-028](./P-028-pricing-page.md) |
| P-029 | Limit kezelés | ⛔ Superseded | [P-029](./P-029-limit-handling.md) |
| P-030 | Trial → fizetős konverzió flow | 🔴 Open | [P-030](./P-030-trial-conversion.md) |

## 💼 eaisyBooks

| # | Döntés | Státusz | Fájl |
|---|--------|---------|------|
| P-031 | eaisyBooks layout & navigáció | ✅ Decided | [P-031](./P-031-accounty-layout.md) |
| P-032 | ÁFA bevallás workflow | ✅ Decided | [P-032](./P-032-vat-return-workflow.md) |
| P-033 | Bérszámfejtési ciklus workflow | ✅ Decided | [P-033](./P-033-payroll-cycle.md) |
| P-034 | Jóváhagyási sor (Approval Queue) | ✅ Decided | [P-034](./P-034-approval-queue.md) |

## 🔍 Keresés

| # | Döntés | Státusz | Fájl |
|---|--------|---------|------|
| P-039 | Globális keresés (nincs, szűrők elegendőek) | ✅ Decided | [P-039](./P-039-global-search.md) |

## 🎫 Ügyfélszolgálat & Support

| # | Döntés | Státusz | Fájl |
|---|--------|---------|------|
| P-035 | Hibajegy UI és workflow | ✅ Decided | [P-035](./P-035-ticket-system.md) |

## 🛠️ Platform Üzemeltetés

| # | Döntés | Státusz | Fájl |
|---|--------|---------|------|
| P-036 | Management Dashboard UI és navigáció | ✅ Decided | [P-036](./P-036-management-dashboard.md) |

## 👥 Partnertörzs

| # | Döntés | Státusz | Fájl |
|---|--------|---------|------|
| P-040 | Partnertörzs dual-table számlák + interaktív detail panel | ✅ Decided | [P-040](./P-040-partners-invoice-panel.md) |
| P-044 | Külföldi partner megjelenítés (FOREIGN: elrejtése, badge) | ✅ Decided | [P-044](./P-044-foreign-partner-display.md) |

## 🏷️ Kategóriák

| # | Döntés | Státusz | Fájl |
|---|--------|---------|------|
| P-041 | Kategóriák multi-currency összeg + arány konzisztencia + összeg kimutatás | ✅ Decided | [P-041](./P-041-categories-multicurrency-search.md) |
| P-042 | Kategóriák és projektek dual-table szinkronizációja | ✅ Decided | [P-042](./P-042-categories-projects-sync.md) |

## 📋 Jegyzetek

| # | Döntés | Státusz | Fájl |
|---|--------|---------|------|
| P-047 | Jegyzetek Kezelése (Notes Management) UX | ✅ Decided | [P-047](./P-047-notes-management-ux.md) |

## 🗒️ Számlák

| # | Döntés | Státusz | Fájl |
|---|--------|---------|------|
| P-048 | Sztornó Számla Kézi Lezárás UX — toggle gomb, confirm dialog, visszavonható | ✅ Decided | [P-048](./P-048-storno-settle-ux.md) |
