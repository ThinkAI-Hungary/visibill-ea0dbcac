# Session Summary — 2026-09-30 16:28

```text
fix(gl, matching, vat, invoices): főkönyvi AI valós idejű telemetria és 500-as timeout megszüntetése, query invalidáció, beragadás-védelem és idempotens tranzakció-párosítás

* Főkönyv & AI Besorolás Eseményvezérelt Realtime Telemetria (A-184, P-147):
  - Teljesen megszüntetve a 3 másodperces agresszív frontend polling (`refetchInterval: false`), amely a nehéz `get_gl_balances` RPC-vel korábban kimerítette a connection pool-t és 500-as `canceling statement due to statement timeout` hibákat idézett elő.
  - Helyette a Python worker (`worker.py` / `db.py`) a besorolási ciklus során fojtott (throttled) telemetriát küld a `gl_upload_notifications` táblába (`items_processed`, `items_total`), minden 3. feldolgozott tétel után, vagy ha legalább 1.5 másodperc eltelt az előző frissítés óta, illetve az utolsó tételnél.
  - A frontend (`GeneralLedgerPage.tsx`) egy Supabase Realtime csatornán (`ai_notifications`) hallgatja az `UPDATE` eseményeket, és azonnal frissíti a folyamatjelző komponenst anélkül, hogy akár egyetlen pénzügyi lekérdezést is indítana a háttérben.
  - Lebegő / átmeneti folyamatjelző sáv (Transient Live Progress Banner) bevezetése a táblázat felett: pulzáló Sparkles ikon, százalékos badge, folyamatjelző csík, dinamikus darabszám (`X / Y tétel besorolva (Z%)`).
  - Az eszköztár (`GlToolbar.tsx`) AI Besorolás gombja futás közben letiltott állapotba kerül, és felveszi a valós idejű előrehaladást (`AI Fut... (X/Y)`).
  - Tisztázva a vizuális különbség: a felső dinamikus sáv az aktív job állapotát mutatja (a munka végén automatikusan eltűnik), míg az alsó KPI kártya a cég teljes éves könyvelési lefedettségét jelzi.

* Query Invalidáció és Stale Task Védelem (GeneralLedgerPage.tsx):
  - Teljeskörű TanStack Query invalidáció az AI befejezésekor (`completed` és `error` ág): a korábban hiányzó `queryClient.invalidateQueries({ queryKey: ['glCategorizedItems'] })` hozzáadásával a Tételes nézetben is azonnal megjelennek a friss besorolások újratöltés nélkül, a `glBalances`, `glItems`, és `glJournalItems` mellett.
  - 15 perces időkorlátos érvényesség vizsgálat (Stale Job Guard): a betöltéskori és cégváltási állapotlekérdezés kizárólag a `created_at >= fifteenMinutesAgo` feladatokat veszi figyelembe (`gte('created_at', fifteenMinutesAgo)`). Így ha a worker szerver újraindul vagy váratlanul leáll, a felület nem ragad be az "AI Fut..." állapotban.

* Tranzakció-Számla Párosítás Idempotencia Védelem (matchingService.ts):
  - A `saveMatch` függvényben a direkt `insert` helyett PostgreSQL-szintű idempotens `upsert` bevezetése: `.upsert(matchData, { onConflict: 'transaction_id,invoice_id', ignoreDuplicates: true })`.
  - Megszünteti a hálózati retry-okból és felhasználói duplakattintásokból eredő `23505 duplicate key value violates unique constraint "uq_transaction_invoice_match"` hibákat.

* TDZ és Null-Safety Javítások:
  - `src/features/vat/components/VatAnnualMatrixView.tsx`: Temporal Dead Zone (TDZ) hiba javítása a `normalizeInvNum` segédfüggvény idő előtti meghívásának kiküszöbölésével (`const` deklaráció a használat elé mozgatva).
  - `src/pages/Accounty/ClientInvoicesPage.tsx`: Null-safety guard hozzáadása `(szamlazzStatus?.pendingCount ?? 0) > 0`, megelőzve az `undefined.length` vagy falsy crash-eket.
  - `src/components/InvoiceItemsDialog.tsx`: Twin NAV számlakeresés szigorítása `company_id` szűrővel.
  - `src/lib/vatReturnPdf.ts`: Típus- és függvényexport javítás.

* Minőségbiztosítás & Verifikáció (QA):
  - Új dedikált regressziós tesztcsomag: `src/test/errorHunterRegression.test.ts` (15/15 teszt sikeres, 100%-os lefedettség a feltárt 5 hibakategóriára).
  - Tranzakció-párosítási tesztek: `candidateFinder.test.ts` és `matchingService.test.ts` (18/18 teszt sikeres).
  - Szigorú TypeScript típusellenőrzés: `npx tsc -p tsconfig.app.json --noEmit` hibamentes (code 0).
  - Production Vite build: `npm run build` sikeres (17.43s).
  - Migráció integritás ellenőrzés: `npm run verify:migrations` (499 migráció ellenőrizve, 0 duplikáció, helyes elnevezések).

* Dokumentáció & Tudásbázis Szinkronizáció (visibill-doc-sync):
  - Új ADR: `docs/architecture/decisions/A-184-realtime-ai-progress-streaming-and-matching-idempotency.md`.
  - Új PRD: `docs/product/decisions/P-147-gl-ai-categorization-realtime-progress-banner-ux.md`.
  - ADR Index (`docs/architecture/decisions/index.md`) frissítve (A-182, A-183, A-184 regisztrálva, 187 egyedi döntési fájl).
  - PRD Index (`docs/product/decisions/index.md`) frissítve (P-140-től P-147-ig regisztrálva, 159 döntés).
  - Worker dokumentáció frissítve: `worker/docs/ARCHITECTURE.md` (15. fejezet hozzáadva a GL pipeline és realtime telemetria működéséről).
  - Kódbázis tudásgráf (`graphify-out/`) újragenerálva: 23 352 node, 39 057 edge, 1 730 közösség.
  - Minden módosítás commitolva és pusholva mindkét repóba (`eaisybill-prod` és `visibill-worker`).
```
