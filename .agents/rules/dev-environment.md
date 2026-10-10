# Fejlesztői Környezet (DEV) és Ágkezelési Védelmi Szabályzat

Ez a szabályzat garantálja a termelési (Prod) és a fejlesztői (Dev) környezet szigorú elválasztását, a dokumentációk kötelező ismeretét és a környezeti tévedések megelőzését.

---

## 🎯 1. Kötelező Frissítés és Dokumentáció-olvasás (Git Pull & Context Check)
Amikor a fejlesztő vagy az AI agent bármilyen okból a **`develop` ágra vált** (`git checkout develop`), vagy a feladat bármilyen tekintetben az **eaisybill-dev** környezetet (`dev.visibill.hu`, Supabase projekt: `qhvcdqkqpgpdxogqqvyr`) érinti:
* **KÖTELEZŐEN `git pull`-lal KELL KEZDENI (`git checkout develop ; git pull origin develop`):** Mielőtt bármilyen fájl vizsgálatába, kódolásba vagy hibakeresésbe kezdene, az agent köteles azonnal lehúzni a távoli ág legfrissebb állapotát. Ezzel elkerülhetők a párhuzamos módosításokból adódó merge konfliktusok, és garantálható, hogy a legfrissebb élesített állapotból indul a munka.
* **Köteles áttekinteni a [`docs/DEV/`](file:///d:/ThinkAI/Visibill/eaisybill-prod/docs/DEV/) mappa dokumentációit:**
  * [`docs/DEV/README.md`](file:///d:/ThinkAI/Visibill/eaisybill-prod/docs/DEV/README.md) - Alapvető áttekintés, elérési utak, környezeti változók és invariánsok.
  * [`docs/DEV/ARCHITECTURE.md`](file:///d:/ThinkAI/Visibill/eaisybill-prod/docs/DEV/ARCHITECTURE.md) - Caddy webszerver, Droplet webroot (`/home/jani/dev-visibill/dist`), Dev Supabase projekt, IPv4 session pooler és 71 Edge Function.
  * [`docs/DEV/DATA_MIGRATION_AND_SYNC.md`](file:///d:/ThinkAI/Visibill/eaisybill-prod/docs/DEV/DATA_MIGRATION_AND_SYNC.md) - A 3 kezelt cég (`Think Ai Kft`, `Teszt Kft`, `Taxology Kft.`), a reggeli 06:00-s automatikus cron szinkron és az inaktív A8/NAV háttérműveletek.
  * [`docs/DEV/DEVELOPMENT_WORKFLOW.md`](file:///d:/ThinkAI/Visibill/eaisybill-prod/docs/DEV/DEVELOPMENT_WORKFLOW.md) - Fejlesztői életciklus, helyi futtatás (`.env.local`), Supabase CLI és GitHub Actions CI/CD.

---

## 🗄️ 2. Szigorú Adatbázis-határvonal (Dev DB Only)
* Ha a munkavégzés a `develop` ágon zajlik:
  * Minden SQL lekérdezést, migrációt, tárolt eljárás (RPC) módosítást, sémaváltoztatást és tesztadat-kezelést **KIZÁRÓLAG a Dev Supabase adatbázison** (`qhvcdqkqpgpdxogqqvyr`, MCP szerver: `supabase-visibill-dev`) szabad végrehajtani!
  * **Szigorúan tilos** a termelési (Prod) adatbázisra (`vxxgvdlqvvchtlmqnrqf`, MCP szerver: `supabase-visibill`) SQL-t vagy migrációt futtatni a `develop` ágon végzett feladatok során.

---

## 🚨 3. Környezeti Figyelmeztetési Protokoll (Branch vs DB Mismatch Alert)
* **KÖTELEZŐ MEGSZAKÍTÁS ÉS FIGYELMEZTETÉS:**
  * Amennyiben a felhasználó vagy az agent a **`develop` ágon áll**, de olyan utasítás merül fel, amely a termelési adatbázis (`Prod DB`) vagy a `main` ág módosítására irányul (pl. *"futtasd az élesen"*, *"módosítsd az éles táblát"*, *"lökd fel a mainre"*):
    * **AZ AGENT KÖTELES AZONNAL MEGÁLLNI!**
    * Tilos önhatalmúan végrehajtani a műveletet.
    * Köteles explicit, kiemelt figyelmeztetést adni a felhasználónak:
      > ⚠️ **FIGYELEM – Környezeti Eltérés:** Jelenleg a `develop` ágon vagyunk, amely a fejlesztői adatbázishoz (`qhvcdqkqpgpdxogqqvyr`) és a `dev.visibill.hu` környezethez van kapcsolva! Biztosan az ÉLES (Production) környezetet szeretnéd módosítani, vagy a DEV adatbázisban végezzük el a változtatást?
    * Kizárólag akkor folytatható a termelési művelet, ha a felhasználó erre kifejezett, megerősítő választ ad.
  * **Fordított védelem a `main` ágon:** Ha az agent a `main` ágon áll, de a kérés dev-specifikus változót vagy a dev adatbázist célozza, szintén kötelező az azonnali figyelmeztetés.

---

## 🛡️ 4. Konfigurációs Integritás, Merge Védelem és Kötelező Éles Migrációk
* A `develop` ág-specifikus beállítások (mint a [`supabase/config.toml`](file:///d:/ThinkAI/Visibill/eaisybill-prod/supabase/config.toml) `project_id = "qhvcdqkqpgpdxogqqvyr"`, vagy a lokális [`.env.local`](file:///d:/ThinkAI/Visibill/eaisybill-prod/.env.local) kulcsok) soha nem kerülhetnek át akaratlanul a `main` ágra.
* Pull Request vagy `main` ágba történő merge előtt kötelező ellenőrizni a konfigurációk éles állapotának megőrzését (`project_id = "vxxgvdlqvvchtlmqnrqf"` a `main` ágon).
* **Kötelező Éles Adatbázis Migráció Main Merge Során:**
  * Amennyiben a `develop` ágon új vagy módosított adatbázis-migrációk (`supabase/migrations/`) keletkeztek, a `main` ágra történő merge-eléskor **SZIGORÚAN KÖTELEZŐ érvényesíteni az adatbázis-migrációkat a termelési (Prod) Supabase adatbázison (`vxxgvdlqvvchtlmqnrqf`, MCP: `supabase-visibill`) is**!
  * Szigorúan tilos úgy befejezettnek nyilvánítani a merge-et, hogy a `main` ági forráskód már az új sémát, mezőt, RPC-t vagy táblát igényli, miközben az éles adatbázisban a migráció még nem futott le.
  * A merge után kötelező ellenőrizni a Prod `supabase_migrations.schema_migrations` bejegyzést, és szükség esetén kiadni a `NOTIFY pgrst, 'reload schema';` parancsot.

---

## 🎫 5. Hibajegyek (Tickets) és Error Hunter Szabályzat: Develop-First Protokoll

Amikor ügyfél hibajegy megoldása (`/ticket-support`, `/visibill-ticket-support`), vagy rendszerhiba elhárítása (`/visibill-error-hunter`) zajlik:

1. **Diagnózis és Adatgyűjtés (Strict Read-Only):**
   * A bejelentett hiba feltárásához a termelési adatbázis naplóit és adatait (`app_error_logs`, `nav_sync_logs`, `feedback`, `ticket_comments`, érintett cég rekordjai) szabad és szükséges lekérdezni (`supabase-visibill`), de **KIZÁRÓLAG olvasási műveletekkel (`SELECT`)**.
   * Szigorúan tilos a feltárás során bármilyen módosító műveletet végezni az éles rendszeren.
2. **Javítás Elsődleges Helyszíne (Develop Branch & Dev DB First):**
   * Bármilyen forráskód módosítás (frontend komponens, router, Edge Function), tárolt eljárás (RPC), migrációs szkript vagy sémaváltoztatás esetén **KÖTELEZŐ a `develop` ágra váltani és azonnal `git pull`-t futtatni (`git checkout develop ; git pull origin develop`)**!
   * A javítást a `develop` ágon kell kidolgozni a legfrissebb távoli állapot alapján.
   * Minden SQL tesztet, migráció-próbát és backend ellenőrzést **KIZÁRÓLAG a Dev Supabase adatbázisban (`qhvcdqkqpgpdxogqqvyr`, MCP: `supabase-visibill-dev`)** szabad végrehajtani.
3. **Kötelező Helyi és Dev Tesztelés (Verification Gate):**
   * A javítás működését a `develop` ágon, a helyi fejlesztői környezetben (`npm run dev`) vagy a dev droplet felületén (`dev.visibill.hu`) kell igazolni.
   * Kötelező ellenőrzési lépések:
     * `npm run lint:fast` (Oxlint ellenőrzés)
     * `npx tsc --noEmit` vagy `npm run build` (Típushelyesség)
     * Releváns Vitest tesztek futtatása (`npx vitest run ...`)
4. **Élesítés / Prod Promóció (Merge & Hotfix Kapu):**
   * Az éles `main` ágra való merge és deploy **CSAK AZUTÁN** történhet meg, hogy a `develop` ágon és a Dev DB-ben a javítás bizonyítottan sikeres volt, és a felhasználó explicit jóváhagyta azt.
   * Ha a hiba elhárítása egyetlen konkrét éles ügyfél rekordjának korrekcióját (pl. beragadt státusz átállítása `UPDATE`-tel) igényli az éles DB-ben, azt a felhasználónak előre be kell mutatni, és csak kifejezett jóváhagyás után szabad lefuttatni az éles adatbázison.
5. **Ügyfélválasz Időzítése (Fix First, Response Last):**
   * Ügyfélválasz tervezet (`ticket_comments`) rögzítése vagy kiküldése szigorúan tilos mindaddig, amíg a javítás fizikailag el nem készült és a tesztek nem igazolták a működését.

