# Area vs Spec Map — Visibill Drift Check

> Ezt a fájlt olvassa be a drift check agent az érintett területből a releváns spec(ek) meghatározásához.
> Ha egy területnek nincs spec-je, explicit jelöld: "(nincs spec — kód az egyetlen forrás)"

---

## eaisybill-prod területek

| Érintett terület (kulcsszavak) | Elsődleges spec | Másodlagos spec | Kód területek |
|-------------------------------|-----------------|-----------------|---------------|
| számla, invoice, bejövő számla | P-010 | A-003 (RLS) | src/pages/InvoicesPage.tsx, src/hooks/useInvoices.ts |
| számla szerkesztés, invoice edit | P-012 | P-010 | src/components/invoice/, supabase/functions/ |
| kimenő számla, outbound | P-012 | — | src/pages/OutboundPage.tsx (ha létezik) |
| bulk action, tömeges művelet | P-015 | P-010 | src/components/BulkActions*.tsx |
| tranzakció, transaction, banki | P-016 | A-003 | src/pages/TransactionsPage.tsx, src/hooks/useTransactions.ts |
| párosítás, matching, manual match | P-017, P-018 | A-004 (PGMQ) | src/pages/MatchingPage.tsx, supabase/functions/matching* |
| dashboard, irányítópult | P-005, P-009 | — | src/pages/DashboardPage.tsx |
| sidebar, menü, navigáció | P-006 | A-013 (routing) | src/components/Sidebar.tsx, src/App.tsx |
| auth, bejelentkezés, login | A-009 | A-021 | src/pages/Login.tsx, supabase/functions/verify-email/ |
| email megerősítés, verify | A-021 | A-009 | supabase/functions/verify-email/, src/pages/ResetPassword.tsx |
| regisztráció, registration | P-001 | A-009 | src/pages/Register.tsx, supabase/functions/ |
| feltöltés, upload, OCR | P-013 | A-008, A-011 | src/components/Upload*.tsx, supabase/functions/process-invoice/ |
| email feldolgozás, mailgun | A-011 | A-005 | supabase/functions/process-email/ |
| cég tagság, company member, team | P-027 | A-009 | src/pages/Settings*.tsx, supabase/migrations/ |
| beállítások, settings, profil | P-025, P-026 | — | src/pages/Settings*.tsx |
| könyvelés, GL, főkönyv, ledger | P-019, P-020 | A-016 | src/pages/Ledger*.tsx, supabase/functions/ |
| riport, export, CSV | P-020, P-021 | — | src/pages/Reports*.tsx, supabase/functions/export* |
| ÁFA bevallás, VAT | P-032 | A-012 (NAV) | src/pages/VAT*.tsx |
| bér, payroll, járulék | P-033 | — | src/pages/Payroll*.tsx |
| jóváhagyás, approval | P-034 | A-004 (PGMQ) | supabase/functions/approval*, src/pages/Approval*.tsx |
| pricing, árazás, előfizetés | P-028, P-029, P-030 | — | src/pages/Pricing*.tsx |
| értesítés, notification | P-022, P-023, P-024 | A-011 | src/components/Notification*.tsx |
| edge function, EF | A-005 | A-016 | supabase/functions/*/index.ts |
| RPC, SQL function | A-016 | A-003 | supabase/functions/*.sql, src/hooks/ |
| NAV, online számla API | A-012 | A-005 | supabase/functions/nav* |
| titkosítás, encryption, credential | A-010 | A-017 | supabase/functions/credential*, worker/ |
| ticket, support | P-035 | A-018 | src/pages/Ticket*.tsx |
| management, admin dashboard | P-036 | A-019 | src/pages/Management*.tsx |
| keresés, search | P-039 | — | src/components/Search*.tsx |
| accounty, könyvelői portál | P-031 | A-013 | src/pages/accounty/ |

---

## HRTSPED projekt területek

| Érintett terület | Elsődleges spec | Másodlagos |
|-----------------|-----------------|-----------|
| fuvar, shipment, CMR | HRTSPED/docs/BRD.md | HRTSPED/docs/PRD.md |
| Selexped API, REST | HRTSPED/docs/API_SPEC.md | HRTSPED/docs/API_KERDESEK.md |
| matching (fuvar vs számla) | HRTSPED/docs/BRD.md (FR-4) | HRTSPED/docs/PRD.md |
| implementáció állapot | HRTSPED/docs/IMPLEMENTATION_STATUS.md | — |
| döntések | HRTSPED/docs/DECISIONS.md | — |

---

## Közös elemek (mindkét projektben)

| Elem | Spec | Megjegyzés |
|------|------|-----------|
| Multi-tenancy, RLS alap | A-003 | Minden DB tábla érintett |
| Auth, RBAC | A-009 | Minden jogosultság-ellenőrzés |
| Queue, PGMQ | A-004 | Worker + EF kommunikáció |
| Supabase BaaS architektúra | A-002 | Infrastruktúra döntések |
| Security architecture | A-017 | Biztonsági kontrollok |

---

## Ha nincs spec az adott területre

```
Jelöld a drift check riportban:
"[Terület] — nincs spec. A kód az egyetlen igazság. 
 Javasolt: írjunk ADR/PRD-t ha ez visszatérő terület."
```
