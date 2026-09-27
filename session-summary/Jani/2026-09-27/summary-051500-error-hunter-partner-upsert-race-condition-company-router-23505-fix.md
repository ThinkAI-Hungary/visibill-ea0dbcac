# Session Summary — 2026-09-27 05:15

```text
fix(worker, db, docs): PostgREST 23505 unique constraint hibák felszámolása, partner upsert idempotens versenyhelyzet védelem és company router előzetes duplikátum-szűrés (ADR-074, A-024, A-025)

- Rendszerszintű Log & Hibatábla Audit (/visibill-error-hunter):
  * Cél: A Supabase PostgreSQL adatbázis hibanaplójában (03:00–04:00 CEST időablak) látható 23505 unique_violation és egyéb kivételek felderítése és megszüntetése.
  * Auditált források: app_error_logs (0 hiba), nav_sync_logs (111x 403 Forbidden 3 inaktív/téves technikai felhasználós cégnél), api_request_logs, feltöltési naplók (nem-számla fájlok OCR elutasításai), pg_cron naplók (0 hiba) és ClickHouse query_logs.
  * Azonosított valós hibaforrások:
    1. partners_company_id_tax_number_key 23505 hiba párhuzamos számlafeltöltések / NAV sync idején.
    2. invoices_company_id_bizonylatsorszam_key 23505 hiba cégcsoportos átirányításkor a már létező bizonylatok célcéges UPDATE kísérleténél.
    3. 42703 column "paid" does not exist kizárva: manuális fejlesztői SQL lekérdezés volt, az alkalmazáskód helyesen a payment_status mezőt használja.

- Worker Partner Upsert Idempotens Versenyhelyzet Védelem (partner_upsert.py):
  * Gyökérok: Kötegelt számlafeltöltéskor több szál párhuzamosan futott, a kezdeti SELECT ellenőrzésnél egyik szál sem találta még a partnert, majd mindegyik szál közvetlen .insert() hívást indított. Az első beszúrás után a párhuzamos szál a (company_id, tax_number) egyedi indexen 23505 hibával elbukott.
  * Megoldás: Közvetlen .insert() helyett PostgREST .upsert(data, on_conflict="company_id,tax_number", ignore_duplicates=True) alkalmazása, ami PostgreSQL szinten INSERT ... ON CONFLICT (company_id, tax_number) DO NOTHING záradékká fordul. Ez megelőzi a PostgreSQL szervernapló ERROR szintű bejegyzését és a tranzakció abortálását.
  * Kétlépcsős Recovery Blokk: Ha az ignore_duplicates miatt 0 sor került beszúrásra (res.data üres), vagy kivételes hálózati szinten 23505 érkezik, a kód azonnal re-fetcheli a párhuzamosan létrejött partnert (select id, partner_type, address).
  * Típus és cím felminősítés: Ha a talált partner címe hiányos, pótolja. Ha a partner típusa eltér a most feldolgozott számla irányától (pl. supplier volt, de az új számlán vevőként szerepel), automatikusan felminősíti 'both'-ra.

- Worker Company Router Előzetes Duplikátum-szűrés (company_router.py):
  * Gyökérok: Cégátirányítás során, ha a számla már létezett a célcégnél (azonos bizonylatsorszám), a kód megkísérelte az UPDATE invoices SET company_id = ... parancsot. Bár a Python kód try...except ágban elkapta a 23505 hibát és hívta a _handle_duplicate_merge rutint, a PostgreSQL motor azonnal ERROR szintű bejegyzést írt a szervernaplóba a hiba elkapása előtt (fail-and-catch logzaj).
  * Megoldás: Az UPDATE előtt egy gyors, indexelt SELECT id FROM invoices WHERE company_id = target_company_id AND bizonylatsorszam = ... LIMIT 1 ellenőrzés fut le.
  * Megelőző Merge: Ha a bizonylat már létezik a célcégnél, a rendszer közvetlenül és azonnal a _handle_duplicate_merge()-t hívja, kihagyva az elbukó UPDATE kísérletet.
  * Versenyhelyzeti retesz: A meglévő try...except blokk megmaradt fallback védelemként arra az esetre, ha egy célcéges számla a két hívás mikromásodpercében jönne létre párhuzamosan.

- Dokumentáció Szinkronizáció (visibill-doc-sync):
  * Worker ADR-074 rögzítve: worker/docs/DECISIONS.md (Idempotens Partner Upsert Versenyhelyzet Védelem és Company Router Előzetes Duplikátum-szűrés).
  * Worker ARCHITECTURE.md frissítve: Auto partner upsert és Invoice Routing szekciók kiegészítve az ADR-074 mechanizmusaival.
  * Worker GOTCHAS.md bővítve: Új 11. fejezet a PostgreSQL szervernaplózás és az alkalmazásszintű catch közötti eltérésről, valamint a fail-and-catch antiminta felszámolásáról.
  * Eaisybill ADR-ek frissítve:
    - docs/architecture/decisions/A-024-partner-upsert-strategy.md: D8 pont hozzáadva a PostgREST on_conflict és re-fetch recovery részleteivel.
    - docs/architecture/decisions/A-025-cross-company-routing.md: 7. routing lépés kiegészítve az előzetes SELECT ellenőrzéssel.
    - docs/business/decisions/034-worker-pipeline.md: Frissítve az új védelmi rétegekkel és keresztreferenciákkal.
  * Kódbázis Tudásgráf: lefutott a graphify update . (2381 fájl szinkronizálva, 21759 csomópont, 37378 él naprakész).

- Minőségbiztosítás (QA Gates & Tests):
  * Prove-It Red-Green Unit tesztek hozzáadva:
    - test_partner_upsert.py: TestRaceConditionRecovery osztály 3 tesztesettel (PostgREST ütközési ág, üres ignore_duplicates válasz és automatikus 'both' upgrade).
    - test_company_router.py: TestApplyRouting tesztek kibővítve előzetes létezés ellenőrzésre.
  * Python teszteredmények:
    - test_partner_upsert.py: 27/27 teszt sikeres (100% zöld).
    - test_company_router.py: 69/69 teszt sikeres (100% zöld).
  * Frontend TypeScript ellenőrzés: npx tsc --noEmit hibamentes (exit code 0).
```
