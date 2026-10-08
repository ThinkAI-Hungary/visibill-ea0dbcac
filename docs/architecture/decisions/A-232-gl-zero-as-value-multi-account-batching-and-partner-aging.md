# A-232: Főkönyvi Zero-as-Value Számviteli Elv, Multi-Account Kötegelt Lekérdezés, N+1 Throttling és Valós Esedékességi Partner Korosítás

**Status:** Decided  
**Date:** 2026-10-08  
**Author:** Jani  
**Kapcsolódó ADR-ek:** [A-016](./A-016-postgresql-query-strategy.md), [A-157](./A-157-general-ledger-invoice-grouping-and-4col-export.md), [A-175](./A-175-subledger-and-open-items-architecture.md), [A-189](./A-189-gl-rpc-performance-optimization-and-timeout-elimination.md), [A-226](./A-226-gl-subledger-concurrency-storm-and-analytic-reconciliation-schema-fix.md), [A-231](./A-231-company-accounting-settings-date-gl-view-fx-bank.md)  
**Érintett migrációk:** `20261008160000_optimize_get_gl_categorized_items_company_filter.sql`, `20261008170000_gl_zero_as_value_and_account_ids.sql`  

---

## 1. Context & Problémafelvetés

A Főkönyvi modul átfogó kód- és adatbázis-szintű auditja során négy kritikus architektúrális és számviteli szűk keresztmetszetet azonosítottunk:

1. **Számviteli Peremfeltétel (Zero-as-Value Sérülés):**
   * A `get_gl_balances` és `get_gl_categorized_items` tárolt eljárásokban a partnerkövetelés és partnerkötelezettség sorok generálásakor korábban `brutto_vegosszeg != 0` és `invoice_gross_amount != 0` feltételek szerepeltek.
   * Emiatt a 0 Ft végösszegű számlák (pl. 100% garanciális jóváírások, ingyenes minták vagy kompenzációs tételek) csendben eldobásra kerültek a főkönyvi kivonatból és a 311/454 partneri analitikából, megbontva a könyvviteli egyezőséget.
2. **N+1 Lekérdezési Vihar és Pool Telítettség:**
   * Amikor a felhasználó a főkönyvi fában több számlát nyitott ki, vagy kötegelt műveletet hajtott végre, az alkalmazás számlánként külön-külön RPC hívást indított (`fetchGlItemsForAccount`), ami többszörös hálózati oda-vissza utat és adatbázis kapcsolatkészlet (connection pool) terhelést okozott.
3. **Burst Query Throttling a Metaadat-gazdagításban:**
   * A tételes nézet és az analitikus Excel export során az `enrichGlItemsWithInvoiceMeta` korlátlan `Promise.all` hívással egyszerre akár 50–100 párhuzamos HTTP kérést zúdított a PostgREST-re 7 különböző táblára. Ez a böngészők domain-enkénti 6 TCP socket korlátja miatt sorban álláshoz, `ERR_INSUFFICIENT_RESOURCES` és PostgREST 504 Gateway Timeout hibákhoz vezetett.
4. **Partner Folyószámla (PartnerLedgerCardView) Csonkolás és Fiktív Korosítás:**
   * A PostgREST direkt lekérdezésből hiányzott a dátumszűrés (`dateFrom`, `dateTo`) és a státuszszűrés, így a cég teljes élettörténetét lekérte a piszkozatokkal együtt.
   * Hiányzott a lapozás, így a Supabase alapértelmezett 1000 soros limitje miatt 1000 tétel felett csendes adatvesztés történt.
   * A lejárati korosítás (aging) nem a valós esedékességekből, hanem fix hardkódolt százalékos szorzókkal (`* 0.4, * 0.3, * 0.2, * 0.1`) saccolta meg a kintlévőségeket.
5. **Fals Felületi Üres Állapotok:**
   * A lekérdezésekben lévő csendes `catch (e) { return []; }` elnyelte a hálózati és adatbázis hibákat, tévesen "Nincsenek adatok" üzenetet mutatva hiba helyett a főkönyvben és az összehasonlító táblázatban.

---

## 2. Döntés

### 2.1 Zero-as-Value Elv a PostgreSQL RPC-kben
* Mind a `get_gl_balances`, mind a `get_gl_categorized_items` eljárásban a szűréseket `IS NOT NULL`-ra cseréltük (`i.brutto_vegosszeg IS NOT NULL` / `ni.invoice_gross_amount IS NOT NULL`).
* A 0 Ft-os számlák legális könyvviteli sort képeznek, így a partneri folyószámla egyezőség fennmarad.
* A `get_gl_balances` paraméterezése szinkronizálásra került (`p_date_basis` 6., `p_posting_status` 7.).

### 2.2 Multi-Account Batching (`p_gl_account_ids uuid[]`)
* A `get_gl_categorized_items` RPC kibővült a `p_gl_account_ids uuid[] DEFAULT NULL::uuid[]` paraméterrel.
* Ha a kliens számlaazonosítók tömbjét adja át, az RPC egyetlen futtatással szűri ki a tételeket.
* A besorolatlan (unclassified) tételek támogatásához a csupa-nulla UUID (`00000000-0000-0000-0000-000000000000`) kezelése beépült az `ANY(p_gl_account_ids)` feltételbe.
* A kliens oldalon exportálásra került a `fetchGlItemsForAccounts` segédfüggvény.

### 2.3 Aszinkron Konkurencia-korlát (Concurrency Pool: 4)
* Az `enrichGlItemsWithInvoiceMeta` függvényben a feladatok nem indulnak el azonnal.
* Egy 4-es kapacitású aszinkron munkás-pool (`CONCURRENCY_LIMIT = 4`) dolgozza fel a kötegeket, elkerülve a böngésző TCP socket telítettségét és a gateway timeoutokat.

### 2.4 Partner Folyószámla Karton Stabilizálása
* **Dátumszűrés:** Pushdown szűrés az adatbázisban: `header.posting_date >= dateFrom AND <= dateTo`.
* **Státuszszűrés:** Kizárólag a lezárt tételek: `header.status IN ('KONYVELT', 'SZTORNOZOTT')`.
* **1000 soros limit feloldása:** 1000-es lapozó ciklus (`while (hasMore) ... range(from, to)`).
* **Valós FIFO Korosítás (Aging):** A nyitott követeléseket és tartozásokat a számlák valós `header.due_date` határideje és a referencia záródátum (`dateTo`) naptári nap-különbsége alapján soroljuk be a standard sávokba (Lejáraton belüli, 1–30 nap, 31–60 nap, 60+ nap).

### 2.5 Fals Üres Állapotok Felszámolása
* React Query `isError` állapotok bekötése és dedikált hibakártyák megjelenítése közvetlen „Újratöltés” gombokkal (`GeneralLedgerTable`, `GeneralLedgerComparisonTable`, `PartnerLedgerCardView`, `SubledgerPage`).
* `GeneralLedgerTable` fa-struktúrájában soron belüli `isErrorRow` hibaértesítő és `[Újrapróbálkozás]` gomb az érintett számlához.

---

## 3. Következmények & Számviteli Eredmények

* ✅ **100% Számviteli Egyezőség:** A 0 Ft-os bizonylatok nem tűnnek el, az analitika és a főkönyv egyező záróértéket ad.
* ✅ **Valós Pénzügyi Korosítás:** A könyvelőirodák valós esedékességi adatokat látnak a partneri folyószámla kartonokon és az egyenlegközlő levelekben.
* ✅ **Hálózati Stabilitás:** A főkönyvi tételes nézet és az analitikus Excel export nagy adathalmaznál sem fagyasztja le a böngészőt.
* ✅ **Transzparens Hibakezelés:** Hálózati vagy timeout probléma esetén nincs megtévesztő "Nincs adat" üzenet; a felhasználó azonnal újra tudja próbálni a betöltést.
