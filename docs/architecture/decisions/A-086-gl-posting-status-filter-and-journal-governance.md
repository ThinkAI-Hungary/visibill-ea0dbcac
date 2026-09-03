# A-086: Főkönyvi Könyvelési Státusz Szűrő (POSTED_ONLY) és Naplózási Irányelvek

**Status:** Decided  
**Date:** 2026-09-04  
**Utoljára frissítve:** 2026-09-04  
**Category:** Database / RPC / General Ledger / Accounting Journals / Tax Compliance  
**Releváns ügyfél megkeresés:** Kiss-Százi Emese (Ván Iroda Kft., 2026. szept. 3. 14:54)  

---

## Context

A felhasználói megkeresés (Kiss-Százi Emese, Ván Iroda Kft.) alapvető számviteli és felületi követelményt fogalmazott meg a Visibill rendszerében:
1. **Számlák és Naplók viszonya:** A könyvelő számára zavaró volt, hogy a Főkönyvi kivonatban a számlák azonnal megjelentek bevételként/költségként (a számlatükör besorolás alapján), miközben a Naplókban még sorszám nélküli `GEPI_JAVASLAT` (rendszerjavaslat) státuszban álltak.
2. **Kettős könyvviteli zártság és sorszámozás:** A számviteli törvény (Sztv.) szerint hivatalos könyvelési tétel csak az a bizonylat, amely bekerült az idősoros naplókba és megkapta a folyamatos, megismételhetetlen naplósorszámot.
3. **Időszakzárás és egyedi jóváhagyás megkülönböztetése:** A naplók tetején lévő "Időszakzárás" funkció félreértést okozott: a felhasználó az egyedi/csoportos bizonylat-lezárást kereste ebben a gombban, miközben az időszakzárás a teljes naptári hónapok zárolására szolgál.
4. **Adatszolgáltatások és bevallások tisztasága:** A könyvelő igénye, hogy a bevallások (pl. ÁFA 65-ös bevallás) készítésekor egyértelmű legyen, hogy az időszak összes bizonylata hivatalosan le van-e könyvelve.

---

## Decision

### 1. Adatbázis RPC Kiterjesztés (`p_posting_status`)
A PostgreSQL `get_gl_balances` és `get_gl_categorized_items` tárolt eljárásai kibővültek a `p_posting_status text DEFAULT 'ALL'::text` paraméterrel (Migráció: `20260904100000_gl_posting_status_filter.sql`):
- **`ALL` (alapértelmezett, visszafelé kompatibilis):** Megjeleníti mind a még csak operatív szinten besorolt számlákat, banki tételeket, mind pedig a már hivatalosan lekönyvelt naplótételeket.
- **`POSTED_ONLY` (szigorú számviteli mód):** Kizárja az operatív számlákat (`invoice_items`, `nav_invoice_items`), a banki tételeket (`transactions`) és az automatikus FX tételeket, kizárólag a hivatalosan lekönyvelt (`acc_journal_headers.status = 'KONYVELT'`) naplótételeket és az importált audit XML naplóbejegyzéseket (`gl_journal_entries`) aggregálja.

### 2. Főkönyvi Szegmentált Kapcsoló, Összehasonlítás és URL Szinkronizáció
- A [GeneralLedgerPage.tsx](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/pages/GeneralLedgerPage.tsx) fejlécében a Dátum alap kapcsoló mellett megjelent a Státusz szűrő mindhárom fülön:
  - `[Összes tétel]` (`all`, Layers ikon): Operatív vezetői előnézet.
  - `[Csak lekönyvelt]` (`posted_only`, ShieldCheck ikon): Zárt, hivatalos számviteli főkönyv.
- Az állapot URL paraméterhez kötött (`?posting_status=posted_only`), reaktív `useEffect` szinkronizálja a böngésző előzményeivel, így közvetlenül linkelhető.
- A [GeneralLedgerComparisonTable.tsx](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/general-ledger/GeneralLedgerComparisonTable.tsx) megkapta a `postingStatus` propot, és mind a tárgyévi (`glBalancesCurr`), mind az előző évi (`glBalancesPrev`) egyenlegeket szinkronban szűri.

### 3. Naplók UX Tisztázás, Hibatűrő Tömeges Könyvelés és Cache Invalidation
A [JournalsPage.tsx](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/pages/JournalsPage.tsx) felületen:
- **Útmutató Banner (Guidance Callout):** Ha jóváhagyásra váró rendszerjavaslatok (`GEPI_JAVASLAT`) vannak, a táblázat felett megjelenik egy informatív figyelmeztetés, és az **"Összes javaslat kijelölése"** gombbal egyetlen kattintással kijelölhető a tömeges könyvelésre.
- **Hibatűrő Tömeges Könyvelés (`bulkPostMutation`):** Ha a kiválasztott tételek között egy hibás tétel akad (pl. $T \neq K$ egyensúlyhiány vagy zárt időszak), a feldolgozás nem szakad meg. A sikeres tételek azonnal lekönyvelődnek a szerveren, a cache frissül (`onSettled`), és a felületen kizárólag a hibás tételek maradnak kijelölve, pontos hibaüzenettel.
- **Kanonikus Cache Invalidation (`invalidateGlAndJournalQueries`):** A könyvelési, sztornózási és törlési mutációk szinkronban invalidálják a naplókat (`acc-journal-entries`), a főkönyvet (`glBalances`, `glItems`, `glJournalItems`), az összehasonlító táblát (`glBalancesCurr`, `glBalancesPrev`) és az ÁFA audit lekérdezést (`vat_period_posting_audit`).
- **Időszakzárás Tooltip:** A gomb mellé magyarázat került, tisztázva, hogy az a naptári hónapok átfogó zárolására szolgál, míg az egyes bizonylatok véglegesítése a lekönyveléssel történik.

### 4. ÁFA Bevallás Könyvelési Audit Indikátor
A [VatReturnViewTab.tsx](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/features/vat/components/VatReturnViewTab.tsx) és [useVatReturnData.ts](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/features/vat/hooks/useVatReturnData.ts) komponensekben:
- Valós idejű audit indikátor jelzi a könyvelési lefedettséget.
- A dátumszűrés a magyar Áfa tv. szabályainak megfelelően a számviteli teljesítés dátumához (`posting_date`) igazodik (`.gte('posting_date', dateFrom).lte('posting_date', dateTo)`).
- Üres időszak esetén (ha még nincsenek naplótételek generálva) borostyánsárga figyelmeztető kártyával tájékoztatja a felhasználót a bevallás beadása előtt szükséges könyvelési lépésekről.

---

## Consequences

### Pozitív
- **100%-os transzparencia:** A könyvelő egyetlen kattintással ellenőrizheti a zárt, hivatalos könyvelési egyenlegeket.
- **Hibamentes jóváhagyási folyamat:** A több száz rendszerjavaslat egyetlen lépésben kijelölhető és hibatűrően véglegesíthető a naplókban.
- **Adóbevallási biztonság:** Az ÁFA bevallás készítésekor a könyvelő azonnal látja a könyvelési lefedettséget.
- **Zárt immutabilitás:** A lekönyvelt tételeket az adatbázis triggerek védik a felülírástól és törléstől.

### Negatív / Kötöttségek
- A `POSTED_ONLY` szűrés csak akkor mutat adatot, ha a felhasználó a naplókban lekönyvelte a bizonylatokat; új cég indításakor az automatikus kontírozási javaslatok elfogadásáig ez a nézet üres maradhat.

---

## Kapcsolódó
- **BRD:** [050: Főkönyvi Könyvelési Státusz és Naplózási Kormányzás](../../business/decisions/050-gl-posting-status-and-journal-governance.md)
- **BRD:** [043: Könyvelési Naplók és Kettős Könyvviteli Folyószámlák](../../business/decisions/043-accounting-journals.md)
- **PRD:** [P-067: Főkönyvi Könyvelési Státusz Szűrés, Naplózási Kormányzás és ÁFA Audit Jelző UX](../../product/decisions/P-067-gl-posting-status-filter-and-journal-governance-ux.md)
- **PRD:** [P-055: Könyvelési Napló UX](../../product/decisions/P-055-accounting-journals-ux.md)
- **PRD:** [P-066: Főkönyvi Dátum Alap Kapcsoló és Beállítások UX](../../product/decisions/P-066-gl-date-basis-toggle-and-settings-ux.md)
- **ADR:** [A-057: Könyvelési Napló Rendszer Architektúra](./A-057-accounting-journals-architecture.md)
- **DB Migráció:** `supabase/migrations/20260904100000_gl_posting_status_filter.sql`
