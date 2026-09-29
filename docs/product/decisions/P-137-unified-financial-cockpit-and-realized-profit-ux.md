# P-137: Unified Financial Cockpit, Realizált Eredmény KPI és Számlakép Lapfül UX

**Status:** Decided  
**Date:** 2026-09-29  
**Category:** Dashboard / Financial Cockpit / UX  
**Question:** Hogyan vonható össze a hiányzó bizonylatok, kifizetetlen szállítók, párosítatlan banki mozgások és kintlévőségek kezelése egyetlen interaktív teendőközponttá a vezérlőpulton, hogyan garantálható az 50 tételes optimális adatletöltés akadásmentes infinite scrollal, és hogyan biztosítható a cégvezetői operatív és realizált eredmény (cash realization) átláthatósága?  

---

## 1. Döntési Kontextus és Célok

A vezérlőpult (Dashboard) korábban különálló, szétszórt widgetekben kezelte a hiányzó bizonylatokat és a párosítatlan banki tranzakciókat, míg a kifizetetlen számlák és kintlévőségek áttekintéséhez a felhasználónak át kellett navigálnia a Számlák modulba.

Emellett a korábbi adatletöltési mechanizmus nagyméretű cégeknél (ahol 500+ banki tranzakció és több száz számla van a periódusban) egyszerre, korlátlan `while (true)` ciklusban töltötte le az összes rekordot, felesleges hálózati terhelést és DOM-terhelést okozva.

A pénzügyi döntéshozatal szempontjából pedig a bruttó/nettó nézetváltás torzította a számviteli eredményt (a profit nem lehet bruttó, mivel az ÁFA a költségvetést illeti), illetve hiányzott a cégvezetői valós készpénzes eredmény (realizált profit: könyvelt eredmény mínusz be nem folyt kintlévőség).

---

## 2. A Döntés és Felületi Specifikáció

### 2.1 Unified Financial Cockpit (Egyesített Teendőközpont)
A nyitólapon, közvetlenül a havi ÁFA kimutatás alatt létrehoztuk a konszolidált **Unified Financial Cockpit** komponenst (`UnifiedFinancialCockpit.tsx`), amely 4 integrált kategóriát fog össze:

1. **Hiányzó bizonylatok (NAV-ban van, de nem található számlakép)**:
   - Piros sürgősségi jelvény (`Sürgős`), bizonylatszám, partnernév, fizetési határidő.
   - Elsődleges művelet: `Bizonylatfeltöltés` (navigáció az upload oldalra).
2. **Kifizetetlen szállítók (Likviditás)**:
   - Sárga jelvény, kifizetetlen bejövő NAV számlák összegzése és listája.
   - Elsődleges művelet: egységes `Párosítás` gomb.
3. **Párosítatlan banki mozgások (Egyeztetés)**:
   - Kék jelvény, kivonaton szereplő, számlapár nélküli banki tranzakciók (pl. 531 tétel).
   - Elsődleges művelet: egységes `Párosítás` gomb.
4. **Kintlévőség (Vevők - Követelés)**:
   - Zöld jelvény, kifizetésre váró kimenő vevői számlák bruttó összege és listája.
   - Elsődleges művelet: egységes `Párosítás` gomb.

### 2.2 Tételes Adatlap Megnyitása Sorra Kattintáskor
- A korábbi sorvégi gombok és felesleges badge-ek eltávolításra kerültek a letisztult, sűrű táblázatos elrendezés érdekében.
- A sor bármely pontjára kattintva azonnal felugrik az adott tétel modális ablaka:
  - Számlák esetén: `InvoiceItemsDialog` (tételes NAV/bizonylati sorok, ÁFA kulcsok, kontírozás).
  - Tranzakciók esetén: `TransactionDetailsDialog` (banki leírás, AI párosítási javaslat, manuális összerendelés).

### 2.3 50 Tételes Kezdeti Letöltés & Optimisztikus Infinite Scroll
- **`PAGE_SIZE = 50`**: Az összes kategóriában megszüntettük a teljes letöltést. Első betöltéskor kizárólag a legfrissebb 50 elem érkezik a hálózaton.
- **Valós Összesítők Megőrzése**:
  - A Supabase `{ count: 'exact' }` fejlécek és a `total_count` window function révén a felső KPI switcher csempék és a tab badge-ek a teljes, valós darabszámot (pl. `531 db`, `531 tétel`) mutatják.
  - A bruttó összegek a `get_nav_invoice_aggregates` alapján a teljes állományt fedik le.
- **Progresszív Infinite Scroll**:
  - A lista alján elhelyezett `sentinelRef` és `IntersectionObserver` (`rootMargin: '250px'`) optimisztikusan és észrevétlenül kéri le a következő 50 elemet, amint a felhasználó lefelé görget.
- **Shimmer Loading Skeletons (`CockpitRowSkeleton`)**:
  - A lapfülek kezdeti betöltésekor 6 soros skeleton animáció jelenik meg ugrálásmentesen a korábbi pörgő loader helyett.
  - Görgetés közbeni adatbetöltéskor a lista alján 2 soros skeleton nyújt azonnali vizuális visszajelzést.

### 2.4 Operatív Eredmény Nettó Invarianciája & Realizált Eredmény
A `DashboardMetrics.tsx` és `MetricCard.tsx` komponensekben:
- **Nettó Invariancia**: A bruttó/nettó rádiógomb átkapcsolásakor az *Operatív eredmény* kártya szigorúan nettó marad, mert az ÁFA a NAV-ot illeti.
- **Realizált Eredmény Bontás**:
  $$\text{Realizált Eredmény} = \text{Könyvelt Nettó Operatív Eredmény} - \text{Kintlévőség (Nettó)}$$
  Ez a cégvezető számára azonnal mutatja, hogy a kiszámlázott nyereségből ténylegesen mennyi pénz folyt már be a bankszámlára.

### 2.5 Számlák Menü Lapfül Név Egységesítés
A Számlák menüben a korábbi "Beküldött" elnevezést a valós funkciót tükröző **Számlakép** kifejezésre cseréltük:
- `Beküldött (Kimenő)` $\rightarrow$ **Számlakép (Kimenő)**
- `Beküldött (Bejövő)` $\rightarrow$ **Számlakép (Bejövő)**

---

## 3. Megvalósítás és Érintett Fájlok

- **Cockpit komponens:** [`src/components/dashboard/UnifiedFinancialCockpit.tsx`](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/dashboard/UnifiedFinancialCockpit.tsx)
- **Dashboard metrikák:** [`src/components/dashboard/DashboardMetrics.tsx`](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/dashboard/DashboardMetrics.tsx), [`src/components/dashboard/MetricCard.tsx`](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/dashboard/MetricCard.tsx)
- **Főoldali elrendezés:** [`src/pages/Index.tsx`](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/pages/Index.tsx)
- **Számla lapfül-választó:** [`src/features/invoices/components/filters/InvoiceTabSelector.tsx`](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/features/invoices/components/filters/InvoiceTabSelector.tsx)
- **PDF Export és Export Context:** [`src/components/invoices/PdfExportDialog.tsx`](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/invoices/PdfExportDialog.tsx), [`src/features/invoices/context/InvoiceContext.tsx`](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/features/invoices/context/InvoiceContext.tsx)
- **Lokalizáció:** [`src/locales/hu/invoices.json`](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/locales/hu/invoices.json), [`src/locales/hu/dashboard.json`](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/locales/hu/dashboard.json)
- **Unit tesztek:** [`src/test/unifiedFinancialCockpit.test.tsx`](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/test/unifiedFinancialCockpit.test.tsx), [`src/test/dashboardMetricsProfit.test.tsx`](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/test/dashboardMetricsProfit.test.tsx)

---

## 4. Kapcsolódó Dokumentációk

- [A-152: Analitikai RPC Stabilitás és Cockpit Pagináció](../../architecture/decisions/A-152-rate-limiter-rpc-stability-and-realtime-leak-hardening.md)
- [P-005: Dashboard Widgetek & Elrendezés](./P-005-dashboard-layout.md)
- [P-095: NAV OSA Tabok Elnevezése és Teljesítmény](./P-095-nav-osa-tabs-performance-and-immediate-row-expansion-ux.md)
- [Design Mockup Specifikáció](../../design/unmatched-and-inbound-status-redesign.md)
