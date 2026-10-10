# Fejlesztői Környezet (DEV) és Ágkezelési Védelmi Szabályzat

Ez a szabályzat garantálja a termelési (Prod) és a fejlesztői (Dev) környezet szigorú elválasztását, a dokumentációk kötelező ismeretét és a környezeti tévedések megelőzését.

---

## 🎯 1. Kötelező Dokumentáció-olvasás (Mandatory Context Check)
Amikor a fejlesztő vagy az AI agent a **`develop` ágon** dolgozik, vagy a feladat bármilyen tekintetben az **eaisybill-dev** környezetet (`dev.visibill.hu`, Supabase projekt: `qhvcdqkqpgpdxogqqvyr`) érinti:
* **Köteles először áttekinteni a [`docs/DEV/`](file:///d:/ThinkAI/Visibill/eaisybill-prod/docs/DEV/) mappa dokumentációit:**
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

## 🛡️ 4. Konfigurációs Integritás és Merge Védelem
* A `develop` ág-specifikus beállítások (mint a [`supabase/config.toml`](file:///d:/ThinkAI/Visibill/eaisybill-prod/supabase/config.toml) `project_id = "qhvcdqkqpgpdxogqqvyr"`, vagy a lokális [`.env.local`](file:///d:/ThinkAI/Visibill/eaisybill-prod/.env.local) kulcsok) soha nem kerülhetnek át akaratlanul a `main` ágra.
* Pull Request vagy `main` ágba történő merge előtt kötelező ellenőrizni a konfigurációk éles állapotának megőrzését.
