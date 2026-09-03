# A-012: NAV Online Számla API v3 Integráció

**Status:** Decided  
**Date:** 2025-10  
**Utoljára frissítve:** 2026-08-31

## Context

A magyar adórendszer megköveteli a NAV Online Számla rendszer használatát. A Visibill-nek kétirányú integrációra van szüksége: bejövő + kimenő számlák és tételsorok lekérdezése, partner törzsadatok automatikus szinkronizálása és GL kategorizálás.

## Decision

**NAV Online Számla API v3** — közvetlen REST API integráció konszolidált központi klienssel és Edge Function-ökön keresztül.

### 🏛️ Központi Modulcsomag (`supabase/functions/_shared/nav/`)

Az 5 különböző Edge Function közötti korábbi kódduplikáció (3700+ sor) helyett egy központi, mély modulcsomag felel a NAV kommunikációért és adatbázis-mentésért:

| Modul | Felelősség |
|-------|------------|
| [`types.ts`](file:///d:/ThinkAI/Visibill/eaisybill-prod/supabase/functions/_shared/nav/types.ts) | Erősen típusos interfészek (`NavCredentials`, `NavSyncOptions`, `NavInvoiceDigest`, `InvoiceDetails`, `InvoiceLineItem`, `NavValidationResult`, `NavSyncResult`). |
| [`crypto.ts`](file:///d:/ThinkAI/Visibill/eaisybill-prod/supabase/functions/_shared/nav/crypto.ts) | NAV v3 kriptográfia: `generateRequestId()` (RID + 13 alfanumerikus karakter), `formatCompactTimestamp()`, `hashPassword()` (SHA-512) és `createSignature()` (SHA3-512 a `@noble/hashes` segítségével). |
| [`xml-builder.ts`](file:///d:/ThinkAI/Visibill/eaisybill-prod/supabase/functions/_shared/nav/xml-builder.ts) | `TokenExchangeRequest`, `QueryInvoiceDigestRequest`, és `QueryInvoiceDataRequest` XML borítéképítők. |
| [`xml-parser.ts`](file:///d:/ThinkAI/Visibill/eaisybill-prod/supabase/functions/_shared/nav/xml-parser.ts) | `parseNavError()`, `parseTokenResponse()`, `parseInvoiceDigestXml()`, `parseInvoiceDataXml()` (egyszerűsített számla ÁFA kalkulációval, bruttó fallbackkel és önzáró/üres tag regex kezeléssel). |
| [`nav-client.ts`](file:///d:/ThinkAI/Visibill/eaisybill-prod/supabase/functions/_shared/nav/nav-client.ts) | Tiszta protokoll kliens (`validateCredentials`, `requestToken`, `queryInvoiceDigest`, `queryInvoiceData`, `fetchAllInvoices`). |
| [`nav-ingestion-service.ts`](file:///d:/ThinkAI/Visibill/eaisybill-prod/supabase/functions/_shared/nav/nav-ingestion-service.ts) | Tranzakciós adatbázis szinkronizáció, `nav_invoices` dedup batch upsert, szülő számla attribútum frissítés, `nav_invoice_items` idempotens delete-before-insert mentés, `partners` cache-elés (ADR A-024), és `nav_sync_logs` állapotkezelés. |
| [`index.ts`](file:///d:/ThinkAI/Visibill/eaisybill-prod/supabase/functions/_shared/nav/index.ts) | Barrel export. |

---

### ⚡ Edge Functions Katalógus

| Function | JWT | Feladat |
|----------|-----|---------|
| `nav-token` | ✅ | Hitelesítő adatok validálása és token csere (`NavClient`) |
| `nav-sync` | ✅ | Manuális felhasználói számla szinkronizáció (`NavIngestionService`) |
| `nav-auto-sync` | ❌ (`CRON_SECRET`) | Automatikus napi szinkronizáció és webhook triggerelés (`NavIngestionService`) |
| `nav-query-outbound-invoices` | ✅ | Kimenő számlák és tételsorok lekérdezése (`NavIngestionService`) |
| `query-nav-invoices` | ✅ | NAV számlák keresése és szűrése (`NavIngestionService`) |
| `nav-tax-profile-sync` | ❌ | Adóalany profil szinkronizálás |
| `delete-nav-credentials` | ✅ | NAV kapcsolat bontása és Vault secret törlés |

---

### 🔄 Adatfolyam és Szabályok

1. **Egyszerűsített számlák kezelése:** Az egyszerűsített számláknál (`SIMPLIFIED`) a NAV XML-ben hiányzó tételszintű nettó és ÁFA összegeket az Edge Function automatikusan kiszámítja a bruttó összegekből (`lineGrossAmountSimplified`) és a hozzájuk tartozó adókulcs-tartalomból (`vatContent`). A `vatContent` értéke (pl. `0.2126`, `0.1525`, `0.0476`) leképezésre kerül a standard ÁFA kulcsoknak megfelelően (`0.27`, `0.18`, `0.05`).
2. **Negatív és helyesbítő számlák támogatása:** A negatív és storno számlák kezelése érdekében a főösszegek vizsgálata `totalGross !== 0` alapon történik, így a negatív összegek is helyesen mentésre kerülnek.
3. **Bruttó összeg fallback számítása:** Ha a NAV XML-ben nincs felső szintű `<invoiceGrossAmount>` elem, az összeadás automatikusan visszalép a `<invoiceNetAmount> + <invoiceVatAmount>` összegre.
4. **Idempotens tételsor mentés (`nav_invoice_items`):** Mivel a `nav_invoice_items` táblán nincs összetett `UNIQUE (nav_invoice_id, line_number)` index, a tételek mentése idempotens **delete-before-insert** mintával történik a szülő `nav_invoice_id` alapján.
5. **Szülő számla attribútum frissítés:** A részletek (`queryInvoiceData`) letöltésekor a szülő `nav_invoices` rekord automatikusan frissül a partner címével (`supplier_address`, `customer_address`), pénzforgalmi jelzővel (`is_cash_accounting`), storno hivatkozással (`original_invoice_number`) és a `details_fetched = true` jelzővel.
6. **Automatikus `validation_status` előléptetés:** Minden sikeres NAV API szinkronizáció automatikusan `valid` státuszra lépteti elő a cég `user_nav_credentials` rekordját.
7. **Partner caching (ADR A-024):** 8-jegyű adószám prefix dedup, új partnerek batch insertje és meglévő partner automatikus upgrade-elése `both` típusra.
8. **Automatikus 30 napos dátumszeletelés (`splitDateRange`):** A NAV Online Számla v3 API maximum 35 napos intervallumot engedélyez. A `NavClient.fetchAllInvoices` motor 30 napnál hosszabb intervallum esetén (pl. a `nav-auto-sync` 90 napos intervalluma vagy egyedi szűrések) automatikusan szeletekre bontja a kéréseket, és összefűzi a lapozott eredményeket, megakadályozva a `DATE_INTERVAL_PARAM_EXCEEDED` hibákat.
9. **Egységes Frontend Válasz-szerződés:** Minden számla lekérdező és szinkronizáló Edge Function egységes formátumban szolgáltatja a válaszát: `{ success: true, totalInvoices: number, count: number, detailsFetched: number, invoices: NavInvoiceDigest[], logId?: string }`.
10. **Többfelhasználós Hitelesítés Validálás (`nav-token`):** A `validate_credentials` művelet közvetlenül `company_id` alapon frissíti a `user_nav_credentials` validációs státuszát, így a céghez hozzárendelt könyvelők vagy munkatársak is sikeresen ellenőrizhetik és aktiválhatják a cég NAV kapcsolatát anélkül, hogy a `user_id` eltérése blokkolná a folyamatot.
11. **XML Namespace Előtagok Kezelése (`xml-parser.ts`):** A NAV Online Számla v3 éles válaszai XML namespace prefixeket (`ns2:`, `common:`, `ns3:`) tartalmaznak (pl. `<ns2:invoiceDigest>`, `<ns2:invoiceNumber>`). Az összes reguláris kifejezés és tag-kinyerő függvény (`extractTag`, `extractTaxNumber`, `digestRegex`, `lineRegex`, `parseInvoiceDigestXml`, `parseInvoiceDataXml`) prefix-agnosztikus (`/(?:<\w+:)?tag/`), garantálva a számlák és tételsorok hibátlan feldolgozását minden környezetben.
12. **Számla Részletlekérés (`queryInvoiceData` & `xml-builder.ts`):** A `QueryInvoiceDataRequest` XML-ben nem szabad `<batchIndex>` elemet megadni egyedi számlák esetén, mivel az a NAV 3.0 API-ban kizárólag kötegelt (`manageInvoice`) műveletekre érvényes. Ennek hiányában a NAV üres választ küldene vissza. A címek kinyerése a NAV 3.0 szerinti `<detailedAddress>` és `<simpleAddress>` struktúrákból történik. A `details_fetched = true` jelzőt pedig csak akkor állítja be a `NavIngestionService`, ha érdemi tételsor vagy partnercím érkezett vissza a hatóságtól.

---

## Consequences

**Pozitív:**
- Tiszta, moduláris architektúra: 3700+ sor duplikált XML/kripto kód helyett 5 db karcsú adapter függvény (~50-100 sor).
- Könnyű tesztelhetőség és karbantarthatóság: 100%-ban lefedett Vitest unit tesztek és élesben ellenőrzött TokenExchange.
- Kétirányú szinkronizáció és automatikus partner törzs feltöltés.

**Negatív / Kockázatok:**
- A NAV API időnként lassú vagy 500-as hibát adhat — ezt a `NavIngestionService` strukturált hibanaplózással és `nav_sync_logs` státuszkezeléssel tompítja.

## Kapcsolódó
- [A-024: Partner Upsert Strategy](./A-024-partner-upsert-strategy.md) — partner dedup, foreign, both upgrade
- [A-010: Credential titkosítás](./A-010-credential-encryption.md) — NAV credentials titkosítása
- [A-005: Edge Functions](./A-005-edge-functions.md) — Edge Function katalógus
