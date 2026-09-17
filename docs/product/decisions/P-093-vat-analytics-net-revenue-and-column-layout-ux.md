# P-093: ÁFA Analitika Oszlopelrendezés és Valós Nettó Megjelenítés UX (VAT Analytics Net Revenue & Column Layout UX)

**Status:** Decided  
**Category:** Dashboard & Navigáció / UI / Reporting  
**BRD Reference:** REQ-3.1, REQ-3.2  
**Question:** Hogyan jelenítse meg az ÁFA kimutatás analitikai táblázata a kimenő és bejövő számlák ÁFA kulcsonkénti bontását, elkerülve a bruttó összegek téves címkézését és biztosítva az átlátható oszlopsorrendet?  
**Decision:** Az analitikai táblázatokban az árbevétel és költség oszlopok átkerülnek a bal/középső pozícióba, egyértelmű `NETTÓ Árbevétel:` és `NETTÓ Költségek:` címkét kapnak, és szigorúan a valós nettó összegeket (`cat.netAmount`, `totalNet`) jelenítik meg a korábbi téves bruttó (`net + vat`) helyett. Az ÁFA összegek a jobb szélső oszlopba kerülnek.  
**Current Implementation:** [`VatSection.tsx`](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/dashboard/VatSection.tsx), [`Analytics.tsx`](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/pages/Analytics.tsx), [`dashboard.json`](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/locales/hu/dashboard.json).  
**Rationale:** A könyvelési és pénzügyi gyakorlatban az árbevétel és költség alapértelmezetten a nettó értéket jelenti. A korábbi megjelenítés a bruttó összeget mutatta "Árbevétel" felirat alatt, ami megtévesztő volt, valamint a harmadik oszlopban szerepelt az ÁFA mögött. Az új elrendezés (Kategória → Nettó Alap → ÁFA) a magyar adózási és számlázási logikát tükrözi.

---

## Részletes UI/UX Működés

### 1. Bevételek ÁFA tartalma (Kimenő számlák)
* **Oszlopstruktúra:**
  1. `ÁFA kategóriák:` (balra zárt)
  2. `NETTÓ Árbevétel:` (jobbra zárt)
  3. `Összes ÁFA:` (jobbra zárt)
* **Számítási logika:**
  * Kategória sorok: `cat.netAmount` kerül kiírásra devizakonverzióval a kiválasztott pénznemben.
  * Összesen sor: `outboundTotalNet` (a kategóriák nettó összege, nem pedig a bruttó).
  * ÁFA oszlop: `cat.vatAmount` és `outboundTotalVat`.

### 2. Kiadások ÁFA tartalma (Bejövő számlák)
* **Oszlopstruktúra:**
  1. `ÁFA kategóriák:` (balra zárt)
  2. `NETTÓ Költségek:` (jobbra zárt)
  3. `Levonható ÁFA:` (jobbra zárt)
* **Számítási logika:**
  * Kategória sorok: `cat.netAmount` kerül kiírásra devizakonverzióval.
  * Összesen sor: `inboundTotalNet` valós nettó költségösszeg.
  * ÁFA oszlop: `cat.vatAmount` és `inboundTotalVat`.

### 3. Párhuzamos megjelenítés és lokalizáció
* A [`VatSection.tsx`](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/dashboard/VatSection.tsx) (főoldali Irányítópult) és az [`Analytics.tsx`](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/pages/Analytics.tsx) (Elemzések nézet) 100%-ban azonos struktúrát és számítási szabályt alkalmaz.
* **Lokalizációs kulcsok:**
  * Magyar: `vat.net_revenue` (*NETTÓ Árbevétel:*), `vat.net_costs` (*NETTÓ Költségek:*)
  * Horvát: `vat.net_revenue` (*NETO Prihodi:*), `vat.net_costs` (*NETO Troškovi:*)

---

## Kapcsolódó
- [P-005: Dashboard Widgetek & Elrendezés](./P-005-dashboard-layout.md)
- [P-060: Modular UX for Statutory Reporting, VAT 2665 Calculator](./P-060-statutory-reporting-and-vat-return-modular-ux.md)
- [P-081: Eaisybill Horvát Lokalizáció és Demó UX](./P-081-eaisybill-croatia-localization-and-demo-ux.md)
