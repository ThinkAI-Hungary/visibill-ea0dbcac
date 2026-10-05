# Session Summary — 2026-10-05 20:10

```text
feat(nav-m2m, vat, petty-cash): NAV ÜPO M2M multi-cég könyvelői kulcs-öröklés és portfólió kiterjesztés, 2665 ÁFA 77. sor adóalap motor & replika, és házipénztár tervezet-duplikáció javítás

- NAV Ügyfélportál (ÜPO) M2M Multi-cég Könyvelői Képviseleti Architektúra & Kulcs-öröklés (A-154, P-114)
  - Problémafeltárás: Új kulcs generálása után a Taxology Kft.-nél az aktiválás meghiúsult ("Edge Function returned a non-2xx status code"), míg az EURODIFFERENT Kft.-nél működött.
  - Gyökérok: A NAV 40 karakteres aktiváló kulcsának utolsó 10 karaktere egyszer használatos Nonce kód. Amikor az EURODIFFERENT-nél aktiválták, a Nonce beváltásra került és a NAV elégette azt. A Taxology-nál történő ismételt megadásakor a NAV elutasította a hívást (`INVALID_NONCE: Nonce not found`).
  - Architektúrális felismerés: A NAV ÜPO-ban az M2M technikai felhasználó a könyvelő KAÜ profiljához kötődik, nem a megbízó cégekhez. Egy könyvelőnek nem kell és nem is lehet 200 külön M2M felhasználót létrehoznia; a lekérdezésekkor a NAV a könyvelő meghatalmazását (EGYKE) ellenőrzi az adott adószámra.
  - Új PostgreSQL RPC funkciók (`supabase/migrations/20261005180000_adopt_accountant_upo_credentials.sql`):
    - `get_user_accountant_upo_status(p_env)`: Automatikusan érzékeli a bejelentkezett felhasználó meglévő aktív könyvelői hitelesítését és kimutatja a portfólió lefedettséget.
    - `adopt_upo_credentials(p_target_company_id, p_env, p_apply_to_all)`: SECURITY DEFINER eljárás a meglévő hitelesítő adatok egykattintásos átvételére vagy kötegelt kiterjesztésére a könyvelő összes cégére (akár 200+ cég), teljes körű 90 napos audit naplózással (`nav_m2m_audit_logs`). Zero Credential Exposure megőrizve.
  - Frontend UX implementáció (`NavUpoM2mCard.tsx`):
    - Ha még nincs kapcsolat: Kiemelt értesítő sáv („Elérhető aktív könyvelői NAV M2M kapcsolat”) két gyorsműveleti gombbal („Kulcs átvétele ehhez a céghez” és „Kiterjesztés mind a(z) X cégemre” megerősítő párbeszédablakkal).
    - Ha kapcsolódva van: Portfólió-lefedettségi státusz és egykattintásos kulcs-újraszinkronizáló akció.
    - Robusztus Edge Function hibakezelés: az `invokeNavM2mProxy` mostantól kinyeri a hibaválasz valódi JSON tartalmát, és a technikai 4xx/5xx helyett a NAV pontos válaszát jeleníti meg.
  - Éles validáció és tesztek:
    - Taxology Kft. KOMA ellenőrzés: HTTP 200 `SIKERES` (Köztartozásmentes: IGEN).
    - Taxology Kft. EFO szinkronizáció: HTTP 200 `SIKERES` (4 fő alkalmi munkavállaló sikeresen letöltve).
    - Kötegelt örököltetés tesztelve: EURODIFFERENT, Taxology, WR Home és CSOBI cégek mind aktívak.

- NAV 2665 ÁFA Bevallás: 77. Sor (Közösségi adómentes termékértékesítés) Adóalap Implementáció (EB-0117)
  - Ügyféli hibabejelentés (Kiss-Százi Emese): a 77. sorba nem hozta az adóalap összeget.
  - Hivatalos NAV 2665A-01-03 nyomtatvány és útmutató átvizsgálása: a 77. sor kizárólag adóalap rovattal bír (ÁNYK `0C0001C0077BA`), adó rovata nincs.
  - Adatbázis migráció (`supabase/migrations/20261005160000_add_base_amount_to_row77_vat_return.sql`): `has_base = true` a `vat_form_rows` táblában a 77-es sorra, és a `calculate_hungarian_vat_return` motorban a 77. sor adóalapjának aggregálása és rögzítése a `vat_return_lines` táblába.
  - Frontend replika: `Nav2665Sheet0103.tsx` létrehozása a 2665A-01-03 lap vizuális megjelenítésére (77-94. sorok), és integrálása a `Nav2665FormReplica.tsx`-be.

- Házipénztár és Főkönyv Egyezőség / Duplikáció Megelőzés (`acc_generate_drafts_from_ledger`)
  - Ügyféli hibabejelentés (Kiss-Százi Emese): a pénztár és főkönyv egyenlege nem egyezett, januári tételek duplázódtak.
  - Gyökérok: a főkönyvi tervezetgenerálóban a házipénztári bizonylat ellenőrzés nem kezelte a sztornózott tételeket, így a meglévő tételekre újabb tervezetek keletkeztek.
  - Adatbázis migráció (`supabase/migrations/20261005170000_fix_acc_generate_drafts_petty_cash_status_check.sql`): a duplikáció-szűrésből kizárásra kerültek a sztornózott és érvénytelenített pénztárbizonylatok.

- Rendszerdokumentáció Szinkronizáció (Doc-Sync)
  - `A-154-nav-upo-m2m-integration-and-credential-security.md`: 6. szekció hozzáadva a multi-cég könyvelői kulcs-örökléshez és az új RPC-khez.
  - `P-114-nav-upo-m2m-integration-ui-ux.md`: 6. szekció hozzáadva a portfólió-szintű gyorsátvétel és kiterjesztés UX-éhez.
  - `05-nav.md`: Adatbázis dokumentáció kiegészítve a `get_user_accountant_upo_status` és `adopt_upo_credentials` RPC-k leírásával.

- Minőségbiztosítás és Validáció
  - TypeScript fordítási ellenőrzés és Production Build: `npm run build` hibátlanul lefutott (29.78s, code 0).
  - Éles adatbázis migráció: Supabase Management API-n keresztül végrehajtva és lekérdezésekkel verifikálva.
```
