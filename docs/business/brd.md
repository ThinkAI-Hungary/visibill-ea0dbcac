# Visibill — Business Requirements Document (BRD)

> **Verzió:** 1.0 | **Dátum:** 2026-05-16 | **Státusz:** Draft  
> **Kapcsolódó dokumentumok:** [decisions/](./decisions/index.md) · [user-journeys.md](./user-journeys.md) · [use-cases.md](./use-cases.md)

---

## 1. Összefoglaló

A Visibill egy AI-alapú pénzügyi adminisztrációs platform magyar KKV-k számára. A rendszer automatizálja a számla-feldolgozást, NAV Online Számla szinkronizációt, banki tranzakció-párosítást, főkönyvi osztályozást és éves beszámoló készítést.

**Hivatkozás:** [001-primary-audience](./decisions/001-primary-audience.md) · [002-supported-business-types](./decisions/002-supported-business-types.md)

---

## 2. Termék Scope & Célcsoport

### REQ-2.1: Elsődleges célcsoport
A rendszer elsődlegesen **magyar KKV cégvezetőket** szolgálja ki, akik kettős könyvvitelt vezetnek (Kft, Bt, Zrt).  
**Státusz:** 🟡 Partially Decided  
**Hivatkozás:** [001](./decisions/001-primary-audience.md) · [002](./decisions/002-supported-business-types.md)

### REQ-2.2: Nyelv & lokalizáció
A felhasználói felület **kizárólag magyar nyelvű**. A pénznem alapértelmezetten HUF, de többvalutás támogatás elérhető.  
**Státusz:** 🟡 Partially Decided  
**Hivatkozás:** [003](./decisions/003-localization-strategy.md)

---

## 3. Technikai Architektúra

### REQ-3.1: Tech stack
| Réteg | Technológia |
|-------|-------------|
| Frontend | React + Vite + TypeScript + shadcn/ui |
| Backend | Supabase (PostgreSQL) + Edge Functions (Deno) |
| Worker | Python (Docker, PGMQ queue) |
| OCR/AI | AWS Textract + OpenAI GPT |
| Email | Mailgun |
| Fizetés | Stripe |
| NAV | NAV Online Számla API v3 |

**Státusz:** ✅ Decided  
**Hivatkozás:** [006](./decisions/006-tech-stack.md)

### REQ-3.2: Multi-instance stratégia
Jelenleg két Supabase instance fut (visibill + visibill-vsweb). A két instance célja és jövője nyitott kérdés — a kódbázisok között feature drift figyelhető meg.  
**Státusz:** 🔴 Open  
**Hivatkozás:** [007](./decisions/007-multi-instance-strategy.md)

### REQ-3.3: Dokumentum feldolgozási pipeline
PGMQ-alapú aszinkron feldolgozás: Upload → Storage → Edge Function trigger → PGMQ → Python Worker → OCR → LLM → DB mentés. Öt pipeline: számla, tranzakció, bérjegyzék, futár riport, GL osztályozás.  
**Státusz:** ✅ Decided  
**Hivatkozás:** [008](./decisions/008-document-pipeline.md) · UC-002, UC-003

---

## 4. Cégstruktúra & Hozzáférés-kezelés

### REQ-4.1: Multi-company modell
Egy felhasználó több céget kezelhet. Minden adat company_id-hoz kötött. CompanySelector a UI-ban. Csatlakozás share_token alapján.  
**Státusz:** ✅ Decided  
**Hivatkozás:** [009](./decisions/009-multi-company-model.md) · Journey 1

### REQ-4.2: Szerepkör-alapú hozzáférés (RBAC)
Négy cég-szintű szerep: owner, admin, member, employee. Az admin jogosultsága jelenleg azonos az owner-rel. A member-nek a prod-ban nincs korlátozása. Az employee csak a /working-time oldalt éri el.  
**Státusz:** 🟡 Partially Decided  
**Hivatkozás:** [010](./decisions/010-user-roles.md)

### REQ-4.3: Member jogosultsági határok
A prod kódbázisban a member role-nak **nincs korlátozása** — ez nyitott döntés.  
**Státusz:** 🔴 Open  
**Hivatkozás:** [011](./decisions/011-member-permissions.md)

### REQ-4.4: Platform-szintű szerepek
profiles.role: `user` (alapértelmezett) / `management` (platform admin). A management role hozzáférést biztosít a management-stats Edge Function-höz.  
**Hivatkozás:** [010](./decisions/010-user-roles.md)

---

## 5. Számla Kezelés

### REQ-5.1: Támogatott számla típusok
Öt típus: sima_szla, egyszerusitett_szla, dijbekero_proforma, dijbekero, vegszamla. Minden típusnál: eladó/vevő adatok, ÁFA bontás, fizetési mód és határidő.  
**Státusz:** ✅ Decided  
**Hivatkozás:** [012](./decisions/012-invoice-types.md)

### REQ-5.2: Számla beviteli csatornák
Három csatorna: (1) Manuális feltöltés — PDF/kép, (2) Email alias — Mailgun webhook, (3) NAV szinkronizáció — API lekérdezés.  
**Státusz:** ✅ Decided  
**Hivatkozás:** [013](./decisions/013-invoice-channels.md) · UC-002, UC-003, UC-004

### REQ-5.3: Számla kiállítás
Jelenleg nem támogatott — a rendszer csak nyilvántartó/feldolgozó funkciót lát el.  
**Státusz:** 🔴 Open  
**Hivatkozás:** [014](./decisions/014-invoice-creation.md)

### REQ-5.4: Számla feldolgozási workflow
Státuszok: feldolgozas_alatt → feldolgozott → kifizetve / keses / torolt. AI-alapú adatkinyerés (OCR + LLM), automatikus GL osztályozás.  
**Hivatkozás:** [008](./decisions/008-document-pipeline.md) · UC-002

---

## 6. NAV Integráció

### REQ-6.1: NAV Online Számla API v3
Teljes integráció: bejövő + kimenő számlák lekérdezése. Credentials Supabase Vault-ban. Test/Production környezet támogatás. Kétfázisú lekérdezés (lista → részletek).  
**Státusz:** ✅ Decided  
**Hivatkozás:** [015](./decisions/015-nav-integration.md) · UC-004

### REQ-6.2: Szinkronizáció stratégia
Manuális sync (felhasználó által) + automatikus sync (cron). Részletes logolás (nav_sync_logs). Automatikus partner felismerés adószám alapján.  
**Státusz:** ✅ Decided  
**Hivatkozás:** [016](./decisions/016-nav-sync-strategy.md) · Journey 4

---

## 7. Pénzügyi Modulok

### REQ-7.1: Tranzakció kezelés
Banki CSV import → AI-alapú számla-tranzakció párosítás (confidence score, match type). Manuális felülbírálás (is_verified). GL hozzárendelés.  
**Státusz:** ✅ Decided  
**Hivatkozás:** [017](./decisions/017-transaction-matching.md) · UC-005

### REQ-7.2: Futárszolgálat riportok
Támogatott: GLS, MPL, DPD, FoxPost, Mixpack, Sprinter. CSV → parsing → NAV/tranzakció párosítás. Státuszok: unmatched → partial_trx → partial_nav → full → total.  
**Státusz:** ✅ Decided  
**Hivatkozás:** [018](./decisions/018-courier-reports.md) · UC-010, Journey 6

### REQ-7.3: Bér & járulék modul
Bérjegyzék LLM pipeline. Típusok: bér, adó, járulék, ÁFA. Employee rates nyilvántartás. Tranzakció-bér párosítás.  
**Státusz:** ✅ Decided  
**Hivatkozás:** [019](./decisions/019-salary-module.md)

### REQ-7.4: Adó modul
Tax tábla létezik de 0 rekordos. Scope (ÁFA bevallás, TAO, SZJA) eldöntendő.  
**Státusz:** 🔴 Open  
**Hivatkozás:** [020](./decisions/020-tax-module.md)

### REQ-7.5: Főkönyvi rendszer (GL)
Hierarchikus számlatükör. AI-alapú GL osztályozás minden entitáson. Manuális override + log. Confidence score + reasoning.  
**Státusz:** ✅ Decided  
**Hivatkozás:** [021](./decisions/021-general-ledger.md)

### REQ-7.6: Éves beszámoló
Három önálló oldal: Eredménykimutatás, Mérleg, Beszámoló. Draft → validated → finalized → submitted workflow. Frozen data snapshot. 19 kiegészítő melléklet sablon. Osztalék kezelés.  
**Státusz:** ✅ Decided  
**Hivatkozás:** [022](./decisions/022-annual-reporting.md) · UC-006, Journey 5

### REQ-7.7: Tárgyi eszközök
Teljes életciklus: active → disposed/sold/missing. Lineáris értékcsökkenés, 11 TAO sablon. Számla-alapú eszköz létrehozás. Aktiválási workflow (asset_events). Dokumentum csatolás, telephelyhez rendelés.  
**Státusz:** ✅ Decided  
**Hivatkozás:** [023](./decisions/023-fixed-assets.md) · UC-008, Journey 8

### REQ-7.8: Kintlévőség & fizetési felszólítás
Lejárt számlák nyomon követése. Fizetési felszólító email küldés (Mailgun). dunning_sends nyilvántartás.  
**Státusz:** ✅ Decided  
**Hivatkozás:** [024](./decisions/024-dunning.md) · UC-007

### REQ-7.9: Házipénztár
Készpénzes tranzakciók nyilvántartása. Nyitóegyenleg beállítás (hp_settings).  
**Hivatkozás:** [006](./decisions/006-tech-stack.md)

---

## 8. HR & Munkaidő

### REQ-8.1: Munkaidő nyilvántartás
Napi órák rögzítése, projekt hozzárendelés. Draft → submitted → approved workflow. Hiányzás típusok: vacation, sick, personal, other.  
**Státusz:** 🟡 Partially Decided (bér integráció nyitott)  
**Hivatkozás:** [025](./decisions/025-working-time-scope.md) · UC-009, Journey 7

### REQ-8.2: Szabadság kezelés
Szabadságkérelem workflow: pending → approved / rejected. Admin megjegyzés, felülvizsgáló azonosítás.  
**Hivatkozás:** [025](./decisions/025-working-time-scope.md)

---

## 9. Előfizetés & Árazás

### REQ-9.1: Subscription tierek
Jelenlegi nevek: salmon, tuna, shark, orca, teszt. Számla-limit alapú korlátozás. Stripe integráció (checkout, customer portal).  
**Státusz:** 🔴 Open (nevek, árak, limitek)  
**Hivatkozás:** [004](./decisions/004-pricing-model.md) · UC-012

### REQ-9.2: Előfizetés scope
Jelenleg user-szintű (user_subscriptions.user_id). Cég-szintű vs user-szintű kérdés nyitott.  
**Státusz:** 🔴 Open  
**Hivatkozás:** [005](./decisions/005-subscription-scope.md)

---

## 10. Értesítések & Kommunikáció

### REQ-10.1: Email értesítések
Konfigurálható értesítési típusok (user_email_preferences): számla feldolgozás, hibák, NAV sync, tranzakció párosítás, heti/havi összefoglaló, stb.  
**Hivatkozás:** [006](./decisions/006-tech-stack.md)

### REQ-10.2: Real-time értesítések
LiveNotificationProvider — Supabase realtime subscription-ök. GL upload notifications.  
**Hivatkozás:** [006](./decisions/006-tech-stack.md)

### REQ-10.3: Ütemezett feladatok
Edge Function cron jobok: check-payment-deadlines, check-missing-invoices, send-weekly-summary, send-monthly-summary, nav-auto-sync.  
**Hivatkozás:** [016](./decisions/016-nav-sync-strategy.md)

---

## 11. Support & Onboarding

### REQ-11.1: Visszajelzési rendszer
FeedbackDialog (FAB gomb) — egyszerű form: cég, típus (bug/feature/feedback/question), üzenet. Slack integráció.  
**Hivatkozás:** UC-011

### REQ-11.2: Onboarding
Product Tour (ProductTour.tsx). Email verifikáció. Welcome email (send-welcome-email).  
**Hivatkozás:** Journey 1 · UC-001

---

## 12. Biztonság & Compliance

### REQ-12.1: Row Level Security
Minden tábla RLS-engedélyezett mindkét Supabase instance-ban.  
**Hivatkozás:** [006](./decisions/006-tech-stack.md)

### REQ-12.2: Audit napló
audit_logs tábla: teljes audit trail (létrehozás, módosítás, törlés, feltöltés, párosítás, aktiválás).  
**Hivatkozás:** [028](./decisions/028-gdpr-compliance.md)

### REQ-12.3: Session kezelés
IdleWarningModal — inaktivitási figyelmeztetés és automatikus kijelentkeztetés.  
**Hivatkozás:** [028](./decisions/028-gdpr-compliance.md)

### REQ-12.4: GDPR & adatvédelem
Adatexport funkció (export-user-data). Adatmegőrzési policy és törlési workflow még nyitott.  
**Státusz:** 🔴 Open  
**Hivatkozás:** [028](./decisions/028-gdpr-compliance.md)

### REQ-12.5: Érzékeny adatok védelme
NAV credentials Supabase Vault-ban (secret_id-k). Jelszavak Supabase Auth-ban.  
**Hivatkozás:** [015](./decisions/015-nav-integration.md)

---

## 13. Integrációk

### REQ-13.1: Megvalósított integrációk

| Integráció | Típus | Státusz |
|-----------|-------|---------|
| NAV Online Számla v3 | API | ✅ Aktív |
| Stripe | Fizetés | ✅ Aktív |
| Mailgun | Email (be+ki) | ✅ Aktív |
| AWS Textract | OCR | ✅ Aktív |
| OpenAI GPT | LLM | ✅ Aktív |
| Nylas | Email fiók | 🔧 Implementálva, 0 usage |

**Hivatkozás:** [015](./decisions/015-nav-integration.md) · [006](./decisions/006-tech-stack.md)

### REQ-13.2: Banki integráció
Jelenleg CSV import. Open Banking (PSD2) eldöntendő.  
**Státusz:** 🔴 Open  
**Hivatkozás:** [026](./decisions/026-banking-integration.md)

### REQ-13.3: LLM költség kezelés
Teljes naplózás (llm_koltsegek). Limitálás eldöntendő.  
**Státusz:** 🟡 Partially Decided  
**Hivatkozás:** [027](./decisions/027-llm-cost-management.md)

---

## 14. Jövőbeli Döntések

| # | Téma | Státusz | Hivatkozás |
|---|------|---------|-----------|
| 1 | Árazási modell véglegesítés | 🔴 Open | [004](./decisions/004-pricing-model.md) |
| 2 | Subscription scope (user vs cég) | 🔴 Open | [005](./decisions/005-subscription-scope.md) |
| 3 | Multi-instance stratégia | 🔴 Open | [007](./decisions/007-multi-instance-strategy.md) |
| 4 | Member jogosultsági határok | 🔴 Open | [011](./decisions/011-member-permissions.md) |
| 5 | Számla kiállítás | 🔴 Open | [014](./decisions/014-invoice-creation.md) |
| 6 | Adó modul scope | 🔴 Open | [020](./decisions/020-tax-module.md) |
| 7 | Banki integráció jövője | 🔴 Open | [026](./decisions/026-banking-integration.md) |
| 8 | GDPR compliance | 🔴 Open | [028](./decisions/028-gdpr-compliance.md) |
| 9 | Mobil stratégia | 🔴 Open | [029](./decisions/029-mobile-strategy.md) |
| 10 | API & third-party hozzáférés | 🔴 Open | [030](./decisions/030-api-access.md) |

Opciós elemzések: [decision_helper.md](./decisions/decision_helper.md)

---

## 15. Követelmények Mátrix

| REQ | Döntés | Use Case | Journey | Státusz |
|-----|--------|----------|---------|---------|
| REQ-2.1 | 001, 002 | — | — | 🟡 |
| REQ-2.2 | 003 | — | — | 🟡 |
| REQ-3.1 | 006 | — | — | ✅ |
| REQ-3.2 | 007 | — | — | 🔴 |
| REQ-3.3 | 008 | UC-002, UC-003 | J2 | ✅ |
| REQ-4.1 | 009 | UC-001 | J1 | ✅ |
| REQ-4.2 | 010 | UC-009 | J7 | 🟡 |
| REQ-4.3 | 011 | — | — | 🔴 |
| REQ-5.1 | 012 | UC-002 | J2 | ✅ |
| REQ-5.2 | 013 | UC-002, UC-003, UC-004 | J2 | ✅ |
| REQ-5.3 | 014 | — | — | 🔴 |
| REQ-6.1 | 015 | UC-004 | J4 | ✅ |
| REQ-6.2 | 016 | UC-004 | J4 | ✅ |
| REQ-7.1 | 017 | UC-005 | J3 | ✅ |
| REQ-7.2 | 018 | UC-010 | J6 | ✅ |
| REQ-7.3 | 019 | — | — | ✅ |
| REQ-7.4 | 020 | — | — | 🔴 |
| REQ-7.5 | 021 | — | J5 | ✅ |
| REQ-7.6 | 022 | UC-006 | J5 | ✅ |
| REQ-7.7 | 023 | UC-008 | J8 | ✅ |
| REQ-7.8 | 024 | UC-007 | J3 | ✅ |
| REQ-8.1 | 025 | UC-009 | J7 | 🟡 |
| REQ-9.1 | 004 | UC-012 | — | 🔴 |
| REQ-9.2 | 005 | UC-012 | — | 🔴 |
| REQ-12.4 | 028 | — | — | 🔴 |
| REQ-13.2 | 026 | UC-005 | J3 | 🔴 |
| REQ-13.3 | 027 | — | — | 🟡 |
