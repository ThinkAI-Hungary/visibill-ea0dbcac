# Session Summary — 2026-10-14 12:45

```text
fix(rbac, accounting): member_read jogosultsági szint bevezetése assert_company_role_tier guardban (Prod 42501 hiba elhárítása), számlatétel szabálymotor időszakszűrés és statement timeout optimalizálás, develop-main DB szinkronizációs és config.toml izolációs szabályzat rögzítése

- Prod PostgreSQL 42501 Hiba Elhárítása és RBAC member_read Szint Bevezetése (assert_company_role_tier)
  - Hiba feltárása (éles képernyőmentés & app_error_logs:db_query hibanapló): [pending-posting-summary/query_error] Ismeretlen jogosultsági szint: member_read (hibakód: 42501).
  - Érintett környezet és felhasználó: Think AI Kft (ecf31039-b539-4e04-bbea-70ea48c701bb), Schwarczinger János (d8dd607d-5a51-44a2-8526-592c6a578921), Főkönyv / Könyvelési jóváhagyási pool és varázsló modul (/general-ledger, PendingPostingPoolWidget.tsx).
  - Gyökérok: A get_pending_posting_summary és get_pending_posting_items RPC függvények a public.assert_company_role_tier(p_company_id, 'member_read') biztonsági guardot hívták meg. A központi jogosultságkezelő assert_company_role_tier függvényben azonban korábban csak 3 szint (member_write, ledger_write, senior) volt lekezelve, így a member_read paraméter a fallback RAISE EXCEPTION ágba futott.
  - Megoldás & RBAC Architektúra: Az assert_company_role_tier kibővítése a Tier 0: member_read szinttel. Ez megtekintési jogosultságot garantál minden aktív céges tagnak (owner, admin, member, assistant, viewer), a kijelölt könyvelőknek (iroda_admin, senior_könyvelő, könyvelő, asszisztens), valamint a gyorsítótárazott fiókjogosultságoknak (has_company_access_via_cache(..., 'accounty')). A tisztán olvasó lekérdezéseknek így nem kell feleslegesen szerkesztési jogot igényelniük.
  - Adatbázis migráció: supabase/migrations/20261014124000_add_member_read_tier_to_rbac.sql
  - Automatizált pgTAP tesztek: supabase/tests/database/legacy_gl_rpc_authz.test.sql kiegészítve 27 tesztesetre (outsider tiltva, viewer megkapja az olvasást, de írást nem, asszisztens és cégvezető megkapja az olvasást és írást).

- Számlatétel Szabálymotor Időszakszűrés és Statement Timeout Megszüntetése (A-144)
  - Követelmény és jóváhagyás: Az apply_invoice_item_rules determinisztikus számlatétel szabálymotor mindig a kiválasztott dátumtartományra szűkítve fusson le (egyedi dátumtartomány vagy teljes év).
  - SQL RPC optimalizálás: 20261014100000_optimize_apply_invoice_item_rules_and_triggers.sql, p_date_from és p_date_to paraméterezés, indexált szűrés, statement timeout megszüntetése nagy adatmennyiség esetén is.
  - Frontend TypeScript típusjavítás: InvoiceItemsDialog.tsx-ben a TS2590 összetett unió típus feloldása explicit if (isOutgoing) táblakezelő ágakkal.
  - Döntési nyilvántartás: docs/architecture/decisions/A-144-deterministic-invoice-item-rules-engine.md.

- Fejlesztési és Élesítési Szabályzat Hardenálás (AGENTS.md, docs/DEV/)
  - Teljes Develop Merge Szabályzat: Rögzítésre került, hogy amennyiben nem célzott hotfix történik, hanem a teljes develop ágat összefésüljük a main-nel, szigorúan kötelező a termelési adatbázist (Prod DB) is teljeskörűen szinkronizálni a fejlesztői adatbázissal (minden sémamódosítás, új tábla, mező, index, RPC és RLS lefutatása az éles DB-n).
  - Config.toml Izolációs Szabály: A supabase/config.toml-ben lévő project_id merge során történő felülírásának szigorú tiltása (main ágon: vxxgvdlqvvchtlmqnrqf, develop ágon: qhvcdqkqpgpdxogqqvyr).

- Élő Adatbázis Verifikáció (Dev DB és Prod DB)
  - Dev DB (qhvcdqkqpgpdxogqqvyr): Migráció lefuttatva, legacy_gl_rpc_authz pgTAP tesztek lefutottak, get_pending_posting_summary szimuláció sikeres.
  - Prod DB (vxxgvdlqvvchtlmqnrqf): Migráció élesítve apply_migration-nel, séma-cache újratöltve (NOTIFY pgrst, 'reload schema').
  - Éles funkcionális teszt: Think AI Kft azonosítóival lefuttatva a get_pending_posting_summary azonnal és hibamentesen visszatért a valós összesítéssel (976 függő tétel, 588 számla, ~659 123 483 Ft).

- Minőségbiztosítás, Build és Git Szinkronizáció
  - TypeScript fordítási ellenőrzés: npm run typecheck (tsc --project tsconfig.app.json --noEmit) hibátlan (0 hiba).
  - Vitest tesztek: src/test/postingWizard.test.ts (4/4 passed).
  - Ágkezelés: develop és main ágak szinkronban az origin-nel, config.toml project_id izoláció mindkét ágon igazolva.
```
