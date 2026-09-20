# Decision 059: Partner-történeti Többségi Számlakategorizálási Szabályzat (Majority Vote Expense Categorization Policy)

**Status:** Decided  
**Date:** 2026-09-20  
**Category:** Expense Categorization / Automation / Cost Optimization  
**Question:** Hogyan biztosítható a bejövő költségszámlák következetes, azonnali és zéró AI költségű kategorizálása a visszatérő beszállítóknál, miközben az új vagy vegyes profilú partnereknél megmarad az intelligens AI-alapú tartalomelemzés?  
**Decision:** A rendszer adatbázis-szintű szigorú többségi szabályt (strict majority rule) alkalmaz a bejövő számlák mentésekor. Ha egy beszállító korábbi bizonylatain egy domináns kategória egyértelmű többségben van, az új számlák azonnal, AI token-felhasználás nélkül ebbe a kategóriába kerülnek. Döntetlen vagy új partner esetén a döntést a mesterséges intelligencia hozza meg.  
**Rationale:** A hazai kkv-k költségeinek 70-80%-a visszatérő partnerektől származik (távközlés, felhőszolgáltatások, irodabérlet, könyvelési díj, üzemanyag). Ezeknél az AI minden egyes számlánál történő meghívása felesleges token-költséget és késleltetést okoz, miközben az LLM ritkán, de téveszthet. A korábbi könyvelési előzményekre épülő többségi elv garantálja a 100%-os következetességet és az azonnali felületi megjelenést.

---

## Üzleti Szabályok

1. **Szigorú Többségi Elv (Strict Majority Vote):**
   * A cég korábbi `invoices` és `nav_invoices` bejövő (`INBOUND`) számláinak kategória-eloszlását vizsgálja a partner normalizált neve alapján (`lower(trim(supplier_name))`).
   * Nyertes kategóriának kizárólag az minősül, amelyből szigorúan több számla létezik, mint a második leggyakoribb kategóriából (`top_count > second_count`).
2. **Döntetlen és Új Partner Védelmi Záradék:**
   * Ha a partner még új a cég rendszerében (0 korábbi besorolt számla), vagy szavazategyenlőség áll fenn (pl. 3 db IT és 3 db Beruházás), a rendszer **nem tippel és nem véletlenszerűsít**, hanem `NULL` kategóriát hagy, amit az AI modellek kötegelt feldolgozása (Edge Function / Worker) elemez a számlatételek és a kontextus alapján.
3. **Csatorna-független Egységesség:**
   * A többségi szabály egyformán, zéró toleranciával érvényesül minden bejövő csatornán:
     - Manuális bizonylatfeltöltéskor (drag-and-drop PDF/kép).
     - E-mail csatolmányos beérkezéskor (Python worker feldolgozó).
     - Hajnali automatikus NAV szinkronkor (`nav-auto-sync`).
     - Manuálisan indított NAV szinkronkor (`nav-sync`).
     - Felületi kötegelt gomb megnyomásakor (`auto-categorize-invoices`).
4. **Alkalmazkodó Passzív Tanulás:**
   * Nincs szükség manuális "besorolási szabályok" konfigurálására. Ha a könyvelő a felületen átkategorizál egy számlát, az azonnal beleszámít a partner jövőbeli statisztikájába. Amint a módosított kategória átveszi a többséget, a jövőbeli számlák automatikusan az új kategóriát kapják.

---

## Kapcsolódó
- [A-129: Partner-történeti Többségi Szabályú Számlakategorizálás & DB Triggerek](../../architecture/decisions/A-129-partner-history-majority-categorization.md)
- [A-130: NAV Automatikus Szinkronizáció Hajnali Idő-ablakos Terheléselosztása](../../architecture/decisions/A-130-nav-auto-sync-dawn-load-staggering.md)
- [P-096: Számlák Kötegelt Automatikus Kategorizálása, Valós Idejű Progress és Toast UX](../../product/decisions/P-096-auto-categorize-invoices-batch-progress-and-toast-ux.md)
- [027: LLM Cost Management Policy](./027-llm-cost-management.md)
