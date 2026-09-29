# A-132: NAV Online Számla v3.0 queryTaxpayer Integráció és Think AI Kft. Kulcs Fallback

> **Státusz:** Decided  
> **Dátum:** 2026-09-20  
> **Szerző:** ThinkAI / Morfi  
> **Érintett komponensek:** `_shared/nav` (NavClient, xml-builder, xml-parser), `nav-query-taxpayer` (Edge Function), `navTaxpayerService` (Frontend), `CompanySelector`, `EmptyStateDashboard`, `ClientDetailsStep`, `PartnersPage`, `nav-ingestion-service.ts`  
> **Kapcsolódó:** [PRD P-098](../../product/decisions/P-098-company-taxpayer-lookup-ux.md), [PRD P-040](../../product/decisions/P-040-partners-invoice-panel.md), [ADR A-130](./A-130-nav-auto-sync-dawn-load-staggering.md), [ADR A-024](./A-024-partner-upsert-strategy.md), [ADR A-054](./A-054-strict-nav-submitted-pairing.md)  

---

## Context (Kontextus)

Az eaisybill-prod rendszerben új cég létrehozásakor (CompanySelector modal, Onboarding Dashboard Step 1, illetve az Accounty új ügyfél felviteli felület) a felhasználóknak korábban manuálisan kellett begépelniük a cég nevét, székhelyét és kiválasztani az ÁFA-rendszert.
Ez több problémát okozott:
1. **Adatbeviteli hibák:** Eltérő vagy hibás cégnév (pl. elírások, rövidítések hiánya vagy rossz formája).
2. **Rossz címformátum:** Nem egységes címstruktúra, hiányzó irányítószám vagy házszám.
3. **Felesleges adminisztrációs teher:** Az adatok a Nemzeti Adó- és Vámhivatal hivatalos adatbázisában nyilvánosan elérhetők.
4. **Technikai kihívás:** Az új felhasználónak vagy a rendszerben még nem konfigurált cégnek még nincsenek saját NAV technikai felhasználói hitelesítő adatai (user, password, tax number, sign key, exchange key), miközben a NAV `/queryTaxpayer` végpontjának hívásához érvényes technikai felhasználói aláírás szükséges.

---

## Decision (Döntés)

A NAV Online Számla v3.0 `/queryTaxpayer` szolgáltatásának teljes körű integrációját valósítottuk meg backend és frontend oldalon, automatikus cégadat-kitöltéssel.

### 1. NAV v3.0 XML Builder és Parser Bővítés (`_shared/nav`)
- **`xml-builder.ts` -> `buildQueryTaxpayerXml`:**
  - A NAV v3.0 API specifikáció szerint a `/queryTaxpayer` kérés `<taxNumber>` tagje kizárólag a **8 számjegyű törzsszámot** fogadja el (`TaxpayerIdType`).
  - Az XML builder a beérkező adószámból kiszűri a nem-numerikus karaktereket és az első 8 számjegyet építi be az XML borítékba.
  - Generálja a SHA3-512 kérésaláírást (`<common:user>`), exchange token lekérése nem szükséges (szemben a számlalekérdezéssel).
- **`xml-parser.ts` -> `parseTaxpayerXml` & `extractTaxpayerAddress`:**
  - Kinyeri a `taxpayerValidity` logikai értéket.
  - Értelmezi mind a `detailedAddress` (irányítószám, település, közterület neve, jellege, házszám, épület, lépcsőház, emelet, ajtó), mind a `simpleAddress` szerkezetet és szabványos `formattedAddress` szöveggé fűzi össze.
  - Kinyeri az adószám részleteket (`taxNumberDetail`: `taxpayerId`, `vatCode`, `countyCode`), cégformát (`incorporation`: `ORGANIZATION`, `SELF_EMPLOYED`, `TAXABLE_PERSON`), csoportos ÁFA tagságot (`vatGroupMembership`) és kezeli a NAV API hibaüzeneteket (`funcCode: ERROR`).
- **`nav-client.ts` -> `queryTaxpayer(taxNumber: string)`:**
  - Standardizált metódus a `NavClient` osztályon.

### 2. Edge Function és Platform Fallback Hitelesítés (`nav-query-taxpayer`)
- **JWT és Service Role Hitelesítés:** Védett végpont, amely bejelentkezett felhasználói session tokennel és belső `service_role` fejléccel (cron/worker/ingestion hívások) egyaránt meghívható.
- **Automation Shield:** Védelem a túlzott lekérdezési terhelés ellen (`checkAutomationShield`).
- **Zero Console Logging:** Szigorú naplózási fegyelem a szerveroldalon (nincs felesleges `console.log`).
- **Think AI Kft. Platform Fallback:**
  - Ha a hívó még nem rendelkezik érvényes NAV technikai felhasználóval (új regisztráció / cég létrehozás), a backend a **Think AI Kft.** (`company_id: 'ecf31039-b539-4e04-bbea-70ea48c701bb'`) biztonságosan Vaultban tárolt technikai kulcsaival írja alá a NAV felé irányuló adózói lekérdezést.
  - Mivel a NAV `/queryTaxpayer` végpontja kizárólag nyilvános cég- és adószámadatokat szolgáltat bármely érvényes adószámra, ez biztonságos és azonnali hozzáférést biztosít az adatokhoz az onboarding első pillanatától.

### 3. Kliensoldali Szolgáltatás (`navTaxpayerService.ts`)
- `queryTaxpayerFromNav(taxNumber: string, companyId?: string)`:
  - 8 jegyű előzetes validáció (regex szűrés a hálózati forgalom minimalizálására).
  - Hívja az Edge Functiont, transzparensen kezeli az autentikációt és az esetleges NAV hibákat.

### 4. UI Űrlap Integrációk
- **`CompanySelector.tsx` (Új cég hozzáadása dialógus):**
  - Adószám bevitele után a "NAV lekérdezés" gombra kattintva kitölti a cégnevet, székhelyet, és a `vatCode` alapján automatikusan beállítja az ÁFA-rendszert (`1` -> `alanyi_mentes`, egyébként `normal`).
- **`EmptyStateDashboard.tsx` (Onboarding Varázsló Step 1):**
  - "NAV lekérdezés" gombbal kitölti a cégnevet és székhelyet, megkönnyítve a regisztrációt.
- **`ClientDetailsStep.tsx` (Accounty / eaisyBooks új ügyfél):**
  - Könyvelők számára ügyfél manuális felvételekor az adószám mellől indítható lekérdezés azonnal beemeli a hivatalos cégnevet.
- **`PartnersPage.tsx` (Partnertörzs - Létrehozás & Szerkesztés dialógus):**
  - Adószám bevitele után a "NAV lekérdezés" gombra kattintva automatikusan kitölti a partner nevét, címét, és az adószámot standard 8-1-2 formátumra (`XXXXXXXX-Y-ZZ`) konvertálja.
- **`PartnersPage.tsx` (Partnertörzs - Jobb oldali részletező panel):**
  - "✨ NAV 8-1-2" gyorsdúsító gomb a meglévő 8 számjegyű belföldi partnerekhez (`isDomestic8DigitTaxNumber`). Egyetlen kattintással lekérdezi a NAV-ot, dúsítja a partner rekordot a hivatalos 8-1-2 formátumú adószámmal, cégformával (`incorporation`), és címadatokkal (ha hiányoznak), miközben védi az egyediséget és megelőzi a duplikációkat.

### 5. Automatikus Dúsítás NAV Szinkronizáció Közben (`nav-ingestion-service.ts`)
- Amikor a `nav-sync` új partnert fedez fel (pl. digest számlák feldolgozásakor), meghívja a `nav-query-taxpayer` szolgáltatást a háttérben.
- A partnertáblába így már eleve a teljes hivatalos név, a szabványos 8-1-2 adószám és a strukturált címadat kerül mentésre, minimálisra csökkentve az utólagos tisztítási igényt.

---

## Consequences (Következmények)

### Pozitív
- **1-Kattintásos Cégfelvitel:** Nincs szükség manuális másolgatásra a cégjegyzékből vagy NAV adatbázisból.
- **100% Pontos Adatok:** A hivatalos bejegyzett cégnév és cím kerül a rendszerbe.
- **Azonnali ÁFA-regim felismerés:** Az adószám 9. karaktere (`vatCode === '1'`) alapján a rendszer automatikusan észleli az alanyi adómentességet.
- **Zero Configuration az új felhasználóknak:** A Think AI Kft. fallback kulcsának köszönhetően az első cégüket regisztráló ügyfelek is azonnal élvezhetik a kényelmi funkciót.

### Negatív / Kockázatok
- **NAV API Elérhetőség:** NAV karbantartás vagy kimaradás esetén a lekérdezés hibát dobhat; a manuális adatbevitel ezért továbbra is teljes mértékben elérhető marad tartalékként.
