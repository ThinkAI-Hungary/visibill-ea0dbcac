# Visibill — Business Requirement Decisions

> **Utoljára frissítve:** 2026-05-16  
> **Összesen:** 30 döntés | ✅ Decided: 16 | 🟡 Partially Decided: 5 | 🔴 Open: 9

---

## Hogyan használd

Minden döntés egy külön `.md` fájl. Menj végig rajtuk sorban, és töltsd ki a **Decision** és **Rationale** mezőket. Ha egy döntés végleges, állítsd a státuszt `Decided`-re.

**Státuszok:**
- `Open` — Még nem hoztunk döntést
- `Partially Decided` — Van jelenlegi implementáció, de felülvizsgálat szükséges
- `Decided` — Végleges döntés, implementálva

---

## 🎯 Célpiac & Üzleti Modell

| # | Döntés | Státusz | Fájl |
|---|--------|---------|------|
| 001 | Elsődleges célcsoport | 🟡 Partially Decided | [001-primary-audience.md](./001-primary-audience.md) |
| 002 | Támogatott vállalkozási formák | 🔴 Open | [002-supported-business-types.md](./002-supported-business-types.md) |
| 003 | Lokalizáció & nyelv | 🟡 Partially Decided | [003-localization-strategy.md](./003-localization-strategy.md) |
| 004 | Árazási modell & tier nevek | 🔴 Open | [004-pricing-model.md](./004-pricing-model.md) |
| 005 | Előfizetés scope (user vs. cég) | 🔴 Open | [005-subscription-scope.md](./005-subscription-scope.md) |

## 🏗️ Architektúra & Infrastruktúra

| # | Döntés | Státusz | Fájl |
|---|--------|---------|------|
| 006 | Tech stack | ✅ Decided | [006-tech-stack.md](./006-tech-stack.md) |
| 007 | Multi-instance stratégia | 🔴 Open | [007-multi-instance-strategy.md](./007-multi-instance-strategy.md) |
| 008 | Dokumentum feldolgozási pipeline | ✅ Decided | [008-document-pipeline.md](./008-document-pipeline.md) |

## 👥 Cégstruktúra & Jogosultságok

| # | Döntés | Státusz | Fájl |
|---|--------|---------|------|
| 009 | Multi-company modell | ✅ Decided | [009-multi-company-model.md](./009-multi-company-model.md) |
| 010 | Felhasználói szerepek (RBAC) | 🟡 Partially Decided | [010-user-roles.md](./010-user-roles.md) |
| 011 | Member jogosultsági határok | 🔴 Open | [011-member-permissions.md](./011-member-permissions.md) |

## 📄 Számla Kezelés

| # | Döntés | Státusz | Fájl |
|---|--------|---------|------|
| 012 | Számla típusok | ✅ Decided | [012-invoice-types.md](./012-invoice-types.md) |
| 013 | Számla beviteli csatornák | ✅ Decided | [013-invoice-channels.md](./013-invoice-channels.md) |
| 014 | Számla kiállítás képesség | 🔴 Open | [014-invoice-creation.md](./014-invoice-creation.md) |

## 🏛️ NAV Integráció

| # | Döntés | Státusz | Fájl |
|---|--------|---------|------|
| 015 | NAV integráció scope | ✅ Decided | [015-nav-integration.md](./015-nav-integration.md) |
| 016 | NAV szinkronizáció stratégia | ✅ Decided | [016-nav-sync-strategy.md](./016-nav-sync-strategy.md) |

## 💰 Pénzügyi Modulok

| # | Döntés | Státusz | Fájl |
|---|--------|---------|------|
| 017 | Tranzakció kezelés & párosítás | ✅ Decided | [017-transaction-matching.md](./017-transaction-matching.md) |
| 018 | Futárszolgálat riportok | ✅ Decided | [018-courier-reports.md](./018-courier-reports.md) |
| 019 | Bér & járulék modul | ✅ Decided | [019-salary-module.md](./019-salary-module.md) |
| 020 | Adó modul scope | 🔴 Open | [020-tax-module.md](./020-tax-module.md) |
| 021 | Főkönyvi rendszer (GL) | ✅ Decided | [021-general-ledger.md](./021-general-ledger.md) |
| 022 | Éves beszámoló | ✅ Decided | [022-annual-reporting.md](./022-annual-reporting.md) |
| 023 | Tárgyi eszközök | ✅ Decided | [023-fixed-assets.md](./023-fixed-assets.md) |
| 024 | Kintlévőség & fizetési felszólítás | ✅ Decided | [024-dunning.md](./024-dunning.md) |

## 🕐 HR & Munkaidő

| # | Döntés | Státusz | Fájl |
|---|--------|---------|------|
| 025 | Munkaidő & szabadság modul scope | 🟡 Partially Decided | [025-working-time-scope.md](./025-working-time-scope.md) |

## 🏦 Integrációk & Jövő

| # | Döntés | Státusz | Fájl |
|---|--------|---------|------|
| 026 | Banki integráció jövője | 🔴 Open | [026-banking-integration.md](./026-banking-integration.md) |
| 027 | LLM költség kezelés | 🟡 Partially Decided | [027-llm-cost-management.md](./027-llm-cost-management.md) |

## 🔒 Biztonság & Compliance

| # | Döntés | Státusz | Fájl |
|---|--------|---------|------|
| 028 | GDPR & adatvédelem | 🔴 Open | [028-gdpr-compliance.md](./028-gdpr-compliance.md) |

## 📱 Platform & Terjeszkedés

| # | Döntés | Státusz | Fájl |
|---|--------|---------|------|
| 029 | Mobil stratégia | 🔴 Open | [029-mobile-strategy.md](./029-mobile-strategy.md) |
| 030 | API & third-party hozzáférés | 🔴 Open | [030-api-access.md](./030-api-access.md) |
