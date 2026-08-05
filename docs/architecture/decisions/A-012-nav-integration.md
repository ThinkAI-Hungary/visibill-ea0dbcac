# A-012: NAV Online Számla API v3 Integráció

**Status:** Decided  
**Date:** 2025-10
**Utoljára frissítve:** 2026-07-29

## Context

A magyar adórendszer megköveteli a NAV Online Számla rendszer használatát. A Visibill-nek kétirányú integrációra van szüksége: bejövő + kimenő számlák lekérdezése.

## Decision

**NAV Online Számla API v3** — közvetlen REST API integráció Edge Function-ökön keresztül.

**Edge Functions:**
| Function | Feladat |
|----------|---------|
| `nav-token` | Token csere (XML → AES-128-ECB aláírás) |
| `nav-sync` | Bejövő számlák lekérdezése (manuális trigger) |
| `nav-auto-sync` | Automatikus napi szinkronizáció (cron) |
| `nav-query-outbound-invoices` | Kimenő számlák lekérdezése |
| `query-nav-invoices` | NAV számlák keresése szűrőkkel |
| `nav-tax-profile-sync` | Adóalany profil szinkronizálás |
| `delete-nav-credentials` | NAV kapcsolat bontása |

**Auth flow:**
1. Felhasználó megadja: technikai felhasználó login + jelszó + aláírókulcs + cserekulcs
2. Credentials titkosítva tárolva (lásd A-010)
3. API híváskor: token generálás → AES-128-ECB aláírás → NAV REST API

**Adatfolyam:**
- NAV-ból kapott számlák → `nav_invoices` tábla (+ `nav_invoice_items`)
- **Egyszerűsített számlák kezelése (2026-07-18):** Az egyszerűsített számláknál (`SIMPLIFIED`) a NAV XML-ben hiányzó tételszintű nettó és ÁFA összegeket, valamint a fő bizonylatszintű nettó/ÁFA összegeket az Edge Function automatikusan kiszámítja a bruttó összegekből (`lineGrossAmountSimplified`) és a hozzájuk tartozó adókulcs-tartalomból (`vatContent`). A `vatContent` értéke (pl. `0.2126`, `0.1525`, `0.0476`) leképezésre kerül a standard ÁFA kulcsoknak megfelelően (pl. `0.27`, `0.18`, `0.05`).
- **Negatív és helyesbítő számlák támogatása:** A negatív és storno számlák (pl. jóváírások, sztornók) kezelése érdekében a főösszegek vizsgálata a korábbi `totalGross > 0` helyett `totalGross !== 0` alapon történik, így a negatív összegek is helyesen mentésre kerülnek.
- **Bruttó összeg fallback számítása:** Ha a számlázó szoftver a NAV XML-ben nem adta meg a felső szintű `<invoiceGrossAmount>` (vagy `<invoiceGrossAmountHUF>`) elemet, az Edge Function automatikusan visszalép a `<invoiceNetAmount>` és `<invoiceVatAmount>` összeadására a bruttó összeg kiszámításához.
- **Többfelhasználós cégek szinkronizációja:** A NAV számlák részleteinek lekérdezésekor a lekérdezés kizárólag a `company_id`-re szűr, a `user_id` szűrése elhagyásra került. Ezzel biztosított, hogy ha a cégen belül egy másik felhasználó kezdeményezte a számlák beolvasását, a részletek lekérése és mentése akkor is sikeres legyen a cég érvényes NAV hitelesítő adataival.
- **Automatikus `validation_status` előléptetés (2026-07-28):** Minden sikeres NAV API szinkronizáció (`nav-query-outbound-invoices`, `nav-sync`) automatikusan `valid` státuszra lépteti elő a cég `user_nav_credentials` rekordját (`validation_status = 'valid'`, `last_validated_at = NOW()`), megelőzve az esetleges beragadt `pending` állapotot és biztosítva az éjszakai automatikus cron szinkronizáció folyamatosságát. Emellett a `save_nav_credentials` eljárás a sikeres felületi teszt után közvetlenül `valid` státusszal hozza létre/frissíti a rekordot.
- **`save_nav_credentials` regresszió javítás (2026-07-29):** A 07-28-as migráció regressziót okozott: a `software_id` formátuma `VISIBILL_XXXXXXXX`-re változott (helyes: `HU` + 8 jegyű adószám + 8 hex karakter = 18 karakter), a Vault secret nevek inkonzisztenssé váltak, és az idempotens törlés (DELETE before CREATE) kimaradt. Javítva: `software_id` helyes formátum, `nav_*_company_` + company_id Vault nevek, idempotens secret kezelés, `company_id IS NULL` validáció visszaállítva.
- A számlák automatikusan GL kategorizálást kapnak (PGMQ → Worker)

**Partner caching (2026-06-29):**

A `nav-auto-sync` és `nav-query-outbound-invoices` EF-ek a NAV számlákból automatikusan partner rekordokat hoznak létre/frissítenek a `partners` táblában. A logika:

1. **Prefix-based dedup:** Az adószám első 8 számjegye (törzsszám) alapján keres meglévő partnert — így `11223344-2-41` és `11223344-1-03` nem hoz létre duplikátumot
2. **Szelektív frissítés:** Meglévő partner esetén csak `address` (ha NULL) és `partner_type → 'both'` (ha eltérő irány) frissül — soha nem ír felül meglévő adatot
3. **Batch insert:** Csak tényleg új partnerek kerülnek INSERT-be

> Részletek: [A-024: Partner Upsert Strategy](./A-024-partner-upsert-strategy.md)

## Consequences

**Pozitív:**
- Kétirányú szinkronizáció — a felhasználó nem kell manuálisan bevinnie a NAV számlákat
- Automatikus napi szinkron — mindig naprakész adatok
- XML ↔ JSON konverzió az Edge Function-ben — a frontend JSON-t kap
- Partner caching — partnerek automatikusan megjelennek a partnertörzsben

**Negatív:**
- A NAV API instabil (időnként 500-as hibákat dob, lassú válaszidő)
- Az XML aláírás komplex (AES-128-ECB, SHA-512 hash, RequestSignature)
- A NAV API rate limit-eket alkalmaz (nem dokumentált)

## Kapcsolódó
- [A-024: Partner Upsert Strategy](./A-024-partner-upsert-strategy.md) — partner dedup, foreign, both upgrade
- [A-010: Credential titkosítás](./A-010-credential-encryption.md) — NAV credentials

