# Session Summary — 2026-10-15 09:55

```text
fix(nav): NAV számlák torzított ÁFA kulcsainak megszüntetése és 16k tételsor ÁFA kulcsának helyreállítása

Összefoglaló:
A bejövő NAV számlák részletező felületén (pl. 33657198 számú számla) tapasztalt téves 18%-os ÁFA kulcs gyökéroki
feltárása, az XML feldolgozó motor kiegészítése a hiányzó NAV jogcímekkel, kettős adatbázis-migráció és teljes körű
adatjavítás mind a fejlesztői (Dev), mind az éles (Prod) adatbázisban, valamint élő NAV v3.0 API tesztelés és élesítés.

Részletes megvalósítás:
1. Gyökérok feltárása & Diagnosztika:
   - A 33657198 sz. számlán 4 db 0 Ft ÁFA-tartalmú hatósági díj (forgalmi engedély, rendszám, törzskönyv, vagyonszerzési illeték:
     összesen 48 850 Ft) és 1 db 27%-os szolgáltatás (100 000 Ft nettó, 27 000 Ft ÁFA) szerepel.
   - A korábbi 20260920200000_backfill_nav_invoices_vat_summary.sql eljárás a hiányzó tételszintű ÁFA kulcsokat a számla
     fejlécének súlyozott átlagából (27 000 / 148 850 = 0.18139... ~ 18%) próbálta kitalálni, ezzel a 0 Ft-os tételekre tévesen
     18%-os kulcsot generált.
   - Az audit kimutatta, hogy az éles adatbázisban több ezer számla érintett hasonló torzításban, és 17 428 db tételsorban NULL
     volt a vat_rate értéke a régi XML parser korlátai miatt.

2. XML Feldolgozó Bővítése (supabase/functions/_shared/nav/xml-parser.ts):
   - A <line> feldolgozásánál beépítettük a hiányzó NAV Online Számla v3.0 elemek kinyerését:
     * <vatOutOfScope> (<case>ATK</case>, <case>HO</case>, stb.)
     * <vatExemption> (<case>AAM</case>, <case>TAM</case>, <case>KBAET</case>, stb.)
     * <vatDomesticReverseCharge> (FAD)
     * <marginSchemeIndicator> (különbözeti adózás)
   - Adómentes, hatályon kívüli és fordított adózású tételeknél garantáltuk a 0 Ft ÁFA összeget, megszüntetve a NULL értékeket.

3. Frontend Védelmi Fallback (src/components/nav/NavInvoiceVatSummaryCard.tsx):
   - getVatBadgeVariant() védelmi ággal bővítve: ha egy tételnél vatAmount = 0 és netAmount > 0, de a történeti aggregáció
     miatt korábban pozitív százalék (18%, 27%) társult hozzá, a komponens nem ír ki téves százalékot, hanem szürke
     "Hatályon kívüli / Mentes (0%)" badge-dzsel jeleníti meg.

4. Adatbázis Migrációk & Teljes Körű Adatjavítás (Dev és Prod DB):
   - 1. Migráció (20261015100000_fix_nav_invoices_vat_summary_blended_rate_bug.sql):
     * Újraírta a public.backfill_nav_invoices_vat_summary() eljárást: 0 Ft ÁFA esetén szigorúan tiltva lett a fejléc arányából történő adókulcs-számítás.
     * Megtisztított 3 226 db korábban torzított számlát (remaining_mismatched_summaries = 0).
   - 2. Migráció (20261015110000_cleanup_zero_vat_summary_and_backfill_item_rates.sql):
     * A tisztítás kiterjesztése: 1 147 db számlán a kerekítési (pl. -0.35 Ft) és 0 Ft-os visszaváltási díjas sorokról is eltávolította a fals 18%/27%/5% sorokat (any_remaining_corrupted_summaries = 0).
     * Tételszintű ÁFA kulcsok automatikus pótlása a nav_invoice_items táblában:
       - 1 918 db kerekítési sor -> '0%'
       - 1 728 db visszaváltási díj / DRS sor -> 'ATK'
       - 12 491 db tétel feltöltve a szülő számla egyértelmű ÁFA összesítőjéből ('ATK', 'AAM', 'TAM', 'HO', 'FAD', '0%')
       - Összesen 16 137 db tételsor kapta meg a pontos törvényi ÁFA kulcsát.

5. Élő NAV v3.0 API Tesztelés & Validáció:
   - A Taxology Kft. hitelesítő adataival a scratch/test_live_nav_query_33657198.ts scripten keresztül meghívtuk a NAV
     Online Számla éles queryInvoiceData végpontját a 33657198 számlára.
   - A NAV 200 OK válasszal visszaküldte a 20 970 bájtos nyers XML-t (scratch/raw_nav_invoice_33657198.xml).
   - Az új parser a valós NAV válaszon igazolta: a 4 db hatósági díj pontosan 'ATK' kulccsal és 0 Ft áfával, az 5. tétel
     27%-kal olvasható ki, a 18% véglegesen megszűnt.

6. Minőségbiztosítás (QA & Tesztek):
   - Új teszt: src/test/invoices/navInvoiceVatSummaryCard.test.tsx (2/2 passed)
   - Új teszt: src/lib/nav/__tests__/invoiceSummaryParser.test.ts (9/9 passed, beleértve az élő 33657198 XML struktúrát)
   - Regressziós kapu: src/test/vat/vatRegressionTaxology.test.ts (16/16 passed)
   - Típusellenőrzés: npx tsc --project tsconfig.app.json --noEmit hibátlan (code 0)
   - Linter: Oxlint hiba- és figyelmeztetésmentes (0 warnings, 0 errors)
   - Építés: npm run build sikeres (26.19s)

7. Release & Deployment:
   - Commitok develop ágon: 09c34bc1, d8adb059, ee5a6938, a6601454
   - Merge a main ágba és push origin/main-re (d0518e4a, 786b31c3)
   - Szigorú supabase/config.toml izoláció érvényesítve:
     * main ág: project_id = "vxxgvdlqvvchtlmqnrqf" (Prod)
     * develop ág: project_id = "qhvcdqkqpgpdxogqqvyr" (Dev)
```
