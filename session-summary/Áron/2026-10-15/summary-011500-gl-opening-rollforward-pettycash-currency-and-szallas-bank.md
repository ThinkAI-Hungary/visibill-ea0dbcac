# Session Summary — 2026-10-15 01:15

```text
feat(gl, accounting, petty-cash, vat, payroll): Napi összegzés — Főkönyvi nyitó tételek évközi átgörgetése (GL Rollforward), Pénztárak egyedi devizaneme, Szallas.hu virtuális bank, Főkönyv default 0-szűrés és dinamikus osztálybontás, ÁFA sablon szerkesztő kiszélesítés, Nyitó sablon ékezet- és elválasztó függetlenítés, valamint Bérszámfejtési utalási deduplikáció (RLS & Unique Constraint)

- 1. Főkönyvi Nyitó Mérlegtételek Évközi Átgörgetése (GL Opening Rollforward)
  - Üzleti cél: Biztosítani, hogy a könyvelt nyitó bizonylatok (1-4. mérlegszámlák nyitó egyenlegei) a teljes üzleti év során bármilyen időszaki szűrés (pl. október 1–31., Q2, havi bontás) esetén is hiánytalanul megjelenjenek és görgessenek a főkönyvi kivonatban
  - Hiba feltárása (Fakov Kft. — `8e841840-7e02-4ece-b596-5c08dca9881b`):
    - Judit által rögzített `NYITO-2026` bizonylat (32 tétel, 2026.01.01) éves lekérdezésben látszott, de októberre szűrve 0 db nyitó sor jelent meg, mert a lekérdezés szigorúan `posting_date >= 2026-10-01` alapján vágta le az adatokat
  - Adatbázis migráció (`20261014234500_gl_rollforward_opening_balances.sql`):
    - `get_gl_balances`, `get_gl_balances_json` és `get_gl_categorized_items` kibővítése az évközi átgörgetési logikával: `OR ((h.entry_type = 'OPENING' OR j.code = 'NY') AND (p_date_to IS NULL OR EXTRACT(YEAR FROM COALESCE(h.posting_date, h.document_date)) = EXTRACT(YEAR FROM p_date_to)) AND (p_date_to IS NULL OR COALESCE(h.posting_date, h.document_date) <= p_date_to))`
    - PL/pgSQL változó ütközés (ambiguous description) elhárítása table alias (`je.`) minősítéssel
    - PostgREST PGRST202 szignatúra-túlterhelés megszüntetése a régi 10-paraméteres függvény törlésével és az egységes 11-paraméteres (`p_gl_account_ids uuid[]`) STABLE SECURITY DEFINER függvény élesítésével
  - Verifikáció & Élesítés:
    - DEV (`qhvcdqkqpgpdxogqqvyr`) tesztelve és élesítve
    - PROD (`vxxgvdlqvvchtlmqnrqf`) élesítve és ellenőrizve: a Fakov Kft. októberi lekérdezésében azonnal megjelent mind a 32 db nyitó mérlegtétel

- 2. Bérszámfejtési Utalási Lista Triplázódás Elhárítása (Deduplication, RLS & Unique Constraint)
  - Üzleti cél: Az utalási listák többszöri újragenerálásakor fellépő sor-sokszorozódás (Kilner Gábor Ev. tripla utalási tétel) végleges és visszafordíthatatlan megszüntetése
  - Adatbázis migráció (`20261014230000_fix_accounty_transfers_delete_rls_and_unique.sql`):
    - Meglévő duplikációk szanálása `DISTINCT ON (company_id, coalesce(employee_id, ...), period)` alapján
    - Egyedi kényszer (`UNIQUE (company_id, employee_id, period)`) hozzáadása az `accounty_transfers` táblához
    - Hiányzó `tr_delete` DELETE RLS policy bevezetése, amely lehetővé teszi a könyvelő számára az újrageneráláskor a régi tételek tiszta törlését
  - Frontend szűrés: `TransferListPage.tsx` kliensoldali deduplikációs védelemmel kiegészítve
  - Tesztek: `src/test/accounty/transferListDeduplication.test.tsx`

- 3. Pénztárak Devizaneme: Egyetlen Választható Pénznem (Single-select Radio Group)
  - Üzleti cél: Pénztár létrehozásakor a korábbi multiselect működés megszüntetése, szigorúan 1 aktív devizanem (HUF, EUR, USD...) kiválasztásának kikényszerítése
  - Felületi megvalósítás (`RegisterDialog.tsx`):
    - A checkboxos multiselect leváltása rádiógomb-logikájú `selectedCurrency` vezérlésre
    - Visszafelé kompatibilis mentési payload (`currencies: [selectedCurrency]`)
    - Letisztult, akadálymentes vizuális állapotjelzés

- 4. Szallas.hu Virtuális Bank Modul (Giro Checksum Bypass & Tranzakció Integráció)
  - Üzleti cél: A Szallas.hu felvétele virtuális bankként a Szépkártyához és az Utánvét listákhoz hasonló működéssel
  - Felületi és konfigurációs módosítások:
    - `BankAccountsTab.tsx`: `Szallas.hu (Virtuális)` standard bankként felvéve narancssárga kártyagradienssel és `isVirtualBank` jelölővel
    - Checksum feloldás: virtuális bankoknál a belföldi 3x8 számlaszám checksum validáció automatikus átugrása
    - `channelConfigs.ts`: `szallas` azonosító beépítése a `BANK_HINT_OPTIONS` feltöltési banktippek közé
    - `TransactionsPage.tsx`: Szallas.hu integrálása a `BANK_CONFIG` szűrő- és felületi rendszerbe

- 5. Főkönyvi Nézet Alapértelmezések (Default 0-ás sorok rejtése & Dinamikus Osztálykibontás)
  - Üzleti cél: A Főkönyvi kivonat megnyitásakor azonnal áttekinthető, lényegre törő könyvelői nézet biztosítása
  - Felületi megvalósítás:
    - `GeneralLedgerPage.tsx`: A `hideZeroBalances` alapértelmezett kezdőértéke `true`-ra váltott (0-ás sorok automatikusan rejtve)
    - `GeneralLedgerTable.tsx`: Új `computeDefaultExpandedClasses` algoritmus: kizárólag azok a fő- és alszámlaosztályok nyílnak ki alapból (3 és 4 számjegy mélységig), amelyek ténylegesen tartalmaznak forgalmat vagy tételeket; az üres osztályok csukva maradnak
    - Felhasználói állapotvédelem: A kézi összecsukást/kinyitást `userHasManuallyToggledRef` védi az automatikus felülírástól
  - Tesztek: `src/test/generalLedgerDefaultExpansion.test.ts` (4/4 passed)

- 6. ÁFA Tételes Sablon Szerkesztő Modál Kiszélesítése
  - Üzleti cél: Az ÁFA tételes analitika nézetválasztó és oszloprendező felületén a túlzott szűkösség megszüntetése
  - Felületi megvalósítás (`VatViewSelectorModal.tsx`):
    - A szigorú `sm:max-w-5xl` osztály eltávolítása
    - Helyette `w-[96vw] max-w-[1700px] h-[90vh]` reszponzív, tágas layout, amelyben mind a 12 oszloposzlop kényelmesen, vízszintes torlódás nélkül áttekinthető és rendezhető

- 7. Nyitó Sablon Betöltő Parser Ékezet- és Elválasztó Függetlenítése
  - Üzleti cél: Megszüntetni a nyitó sablon CSV/XLSX importálásakor fellépő hibát, amely miatt minden tétel Tartozik (`T`) oldalra került
  - Logikai javítás (`openingImportParser.ts`):
    - Gyökérok: A diakritikus karakterek (`irány` vs `irany`, `összeg` vs `osszeg`) miatt a fejléc-felismerés meghiúsult, és a pozitív összegekre vonatkozó fallback minden sort tévesen Tartoziknak jelölt
    - Megoldás: `normalizeKey` beépítése (ékezetek és írásjelek lefejtése), `isCreditIndicator` / `isDebitIndicator` intelligens detekció (`K`, `Követel`, `Credit`, stb.)
    - Robusztus CSV feldolgozó (`parseCsvContent`): pontosvessző, vessző, tabulátor, idézőjelek és UTF-8 BOM (`\uFEFF`) automatikus kezelése
  - Tesztek: `src/test/openingImportParser.test.ts` (9/9 passed)

- 8. Global Date Picker Felület Tisztítás és Hónapválasztó Finomítás
  - Üzleti cél: A felhasználó kérésének megfelelően a dátumválasztó korábbi letisztult dizájnjának visszaállítása, a felesleges vizuális elemek szanálása és az egykattintásos hónapválasztó megtartása
  - Módosított fájlok: `GlobalDatePicker.tsx`, `calendar.tsx`, `date-picker.tsx`
  - Teszt: `src/test/navigation/globalDatePickerAccountySync.test.tsx`

- 9. Minőségbiztosítás, Adatbázis Élesítés (DEV & PROD) és Verifikáció
  - Egység- és regressziós tesztek:
    - `src/test/openingImportParser.test.ts` (9/9 passed)
    - `src/test/vat/vatRegressionTaxology.test.ts` (16/16 passed — ÁFA Safety Gate 100% egyezés)
    - `src/test/generalLedgerDefaultExpansion.test.ts` (4/4 passed)
    - Összesen: 29/29 sikeres Vitest teszt
  - Kódminőség & Linter: `oxlint` 0 hiba az összes módosított fájlban
  - Típusellenőrzés: `npm run typecheck` (`tsc --project tsconfig.app.json --noEmit`) hibamentes (exit code 0)
  - Adatbázis katalógus: `pg_proc` ellenőrzéssel igazolt `STABLE SECURITY DEFINER` állapot mindhárom RPC-re
  - Élesítés: DEV és PROD adatbázis migrációk fizikai lefutása igazolva
```
