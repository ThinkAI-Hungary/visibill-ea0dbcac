# A-098: Készpénzes és Manuális Kifizetésű Számlák Egységes Párosítási Státusza és KPI Integritása

**Status:** Decided  
**Date:** 2026-09-06  
**Utoljára frissítve:** 2026-09-06  

## Context

A számlázási felületen a beküldött és NAV-szinkronizált számlák párosítási állapota (`match_status`) és fizetettségi összege (`paid_amount`, `remaining_amount`) határozza meg a felhasználói élményt:
- Zöld kiemelés ("Párosítva" / "Kiegyenlítve"): A számla teljes összege pénzügyileg kiegyenlített.
- Narancssárga / Javaslat: Részben kiegyenlített vagy banki tranzakcióhoz ajánlott.
- Piros kiemelés ("Nem párosított"): Nincs kifizetés rögzítve, nyitott követelés / tartozás.

### A Felmerült Probléma és Gyökérok Elemzés

Egy valós gyártói/kereskedelmi környezetben rögzített számlánál (ShopExpert Hungary Kft., `SEK-2026/06971`) a számla fizetési módja készpénzes volt, és a hozzá tartozó NAV számla is beérkezett `verified` státusszal. Ennek ellenére a számla a felületen **piros kiemeléssel és "Nem párosított"** jelöléssel jelent meg, holott a készpénzes számlák a kiállítás pillanatában pénzügyileg teljesülnek (nincs hozzájuk banki bankszámlakivonat-tranzakció).

A vizsgálat feltárta a hiba okait:

1. **SQL Kis- és Nagybetű Érzékenység Csapda:**
   A `get_filtered_submitted_invoices` és `get_invoice_kpis` RPC-kben a készpénzes számlák kiegyenlítettnek minősítése merev egyenlőségvizsgálattal volt implementálva:
   ```sql
   WHEN bf.fizetesi_mod = 'Készpénz' THEN gross_abs
   ```
   Az éles adatbázisban a számlák importálásból, OCR-ből és külső integrációkból származnak. Az `invoices` táblában **961 db** számla szerepelt kisbetűs `'készpénz'` fizetési móddal, és **0 db** nagybetűs `'Készpénz'` értékkel. Mivel az SQL `=` operátor érzékeny a kis- és nagybetűkre, az összes kisbetűs készpénzes számlára a feltétel hamis értéket adott, a fizetett összeget a rendszer `0.00 Ft`-nak vette, így a számla `match_status = 'unmatched'` maradt.

2. **Hiányzó Manuális Kiegyenlítés (`is_manual_payment`) Kezelés:**
   A felhasználók a felületen megjelölhetnek számlákat kézi kiegyenlítéssel (`is_manual_payment = true`, kompenzáció, készpénzes házipénztár, engedmény). Ezt a flaget a beküldött számlák RPC-je és a KPI aggregátor nem vette figyelembe a fizetett összeg kiszámításakor.

3. **NAV Oldali Átvétel Hiánya (`get_filtered_nav_invoices`):**
   A NAV számlák listájában a `sub_matches` CTE nem emelte át a csatolt beküldött számláról a készpénzes vagy kézi kiegyenlítési státuszt, így a NAV nézetben sem tükröződött a pénzügyi lezártság.

4. **Fizetési Mód Szűrők Inkonzisztenciája:**
   A `p_payment_method` szerveroldali szűrő paraméter nem kezelte rugalmasan a különböző írásmódokat (`keszpenz`, `készpénz`, `CASH`, `atutalas`, `átutalás`, `bankkártya`).

---

## Decision

A `20260906153000_fix_cash_and_manual_payment_matching_status.sql` migrációban egységesítettük és robusztussá tettük a fizetettségi és párosítási logikát mindhárom érintett szerveroldali eljárásban:

1. **Robusztus, Kis- és Nagybetű Független Készpénz és Kézi Fizetés Detektálás:**
   A `get_filtered_submitted_invoices` és `get_invoice_kpis` eljárásokban a `computed_paid_raw` kiszámítását kiterjesztettük:
   ```sql
   WHEN (
     LOWER(bf.fizetesi_mod) IN ('készpénz', 'keszpenz', 'cash')
     OR bf.fizetesi_mod ILIKE '%készpénz%'
     OR bf.fizetesi_mod ILIKE '%keszpenz%'
     OR bf.fizetesi_mod ILIKE '%cash%'
     OR bf.is_manual_payment = true
   ) THEN gross_abs
   ```

2. **NAV Oldali Automatikus Státuszpropagáció (`get_filtered_nav_invoices`):**
   A NAV számlák listázásakor a `sub_matches` összekapcsolás mostantól automatikusan figyelembe veszi, ha a csatolt beküldött számla készpénzes vagy manuális fizetéssel rendelkezik, valamint a NAV oldali fizetési módot is (`LOWER(payment_method) IN ('cash', 'keszpenz', 'készpénz')` vagy `is_manual_payment = true`).

3. **Integritás a KPI Összesítőkben:**
   A `get_invoice_kpis` RPC-ben mind a `submitted` (beküldött), mind a `nav` irányban szinkronizáltuk a feltételeket. Így a fejlécben található számlálók (`matched`, `suggested`, `unmatched`) pontosan megegyeznek a táblázatban megjelenített sorok státuszaival.

4. **Többváltozós Szűrőnormalizáció:**
   A `p_payment_method` szűrő paramétert kis- és nagybetű függetlenné tettük (`LOWER(i.fizetesi_mod) = LOWER(p_payment_method)`), kiegészítve ékezetes és angol aliasokkal.

5. **Biztonság és Túlterhelés Védelem:**
   A `REVOKE EXECUTE` és `GRANT EXECUTE` parancsoknál a PostgreSQL 42725 (nem egyedi függvénynév) hiba megelőzése érdekében a teljes paraméterszignatúrát explicit megadtuk.

---

## Consequences

### Pozitív
- **Azonnali és Helyes Zöld Kiemelés:** Minden készpénzes (`készpénz`, `CASH`, stb.) és manuálisan kiegyenlített számla automatikusan `match_status = 'matched'`, `paid_amount = gross_abs`, `remaining_amount = 0` értékeket kap és zölden jelenik meg.
- **Nulla Adateltérés a KPI-k és Táblázatok Között:** A `get_invoice_kpis` által visszaadott párosított/nem párosított számlálók 100%-ban fedik a táblázat adatait.
- **Forrásfüggetlen Működés:** Akár NAV-ból szinkronizált, akár PDF-ből OCR-ezett, akár kézzel rögzített számláról van szó, a kisbetűs vagy ékezet nélküli írásmód nem töri el a pénzügyi kiegyenlítettséget.
- **Nagy Teljesítmény:** A számítás a meglévő indexelt oszlopokon és az egyetlen lekérdezési menetben futó CTE-kben történik, nem növeli a hálózati kérések számát (nincs N+1 lekérdezés).

### Negatív / Trade-offok
- **Többágú SQL mintaillesztés:** Az `ILIKE` és `LOWER` feltételek enyhe CPU többletterhelést jelentenek a szigorú egyenlőséghez képest, de a céges dátumtartomány-szűrés (`kibocsatas_datuma`) és az indexek miatt a lekérdezési idő változatlanul 1-5 ms alatt marad.

---

## Kapcsolódó Dokumentáció
- [04-invoices.md](../database/04-invoices.md) — Számlák adatbázis sémája és mezői
- [A-059-transaction-matching-core-and-modular-ui.md](./A-059-transaction-matching-core-and-modular-ui.md) — Tranzakció és számlapárosítás alaparchitektúrája
- [A-097-multi-tenant-nav-items-denormalization-and-gl-optimization.md](./A-097-multi-tenant-nav-items-denormalization-and-gl-optimization.md) — Multi-tenant NAV és GL optimalizáció
