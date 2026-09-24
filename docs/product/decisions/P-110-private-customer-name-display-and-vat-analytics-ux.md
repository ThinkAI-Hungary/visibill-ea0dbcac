# P-110: Magánszemély Vevőnevek Megjelenítése és ÁFA Analitika UX

**Status:** Decided  
**Date:** 2026-09-24  
**Kategória:** ÁFA Bevallás / Analitika / Számlakezelés  
**Kapcsolódó ADR:** A-146  

---

## 1. Kérdés
Hogyan jelenjenek meg a magánszemély vásárlók (B2C) az ÁFA bevallás fúrási nézetében és az ÁFA gyűjtőkód analitikában, tekintettel arra, hogy a NAV Online Számla (OSA) adatszolgáltatásból a vevő neve hiányzik, de a cég által beküldött saját számlán szerepel?

---

## 2. Döntés

1. **Megjelenítés az ÁFA Kalkulátor Fúrási Nézetében (`VatRowDrillDown`):**
   - A fizetendő ÁFA sorok (07, 06, 05, 08, 01, 02) kibontásakor a számlák Partner oszlopában az anonim `—` helyett a feltöltött bizonylat `vevo_nev` értéke jelenik meg (pl. *Blechsmidt Tibai Réka*, *Kretzschmar Éva*, *Csapó István*).
   - A név mellett egy diszkrét `Számláról` badge és tooltip tájékoztatja a könyvelőt az adat eredetéről.

2. **ÁFA Gyűjtőkód Analitika (`VatCollectorAnalyticsView`):**
   - Kimenő bizonylatoknál a Partner oszlop a valós vásárlót mutatja (nem a kiállító saját cégének nevét).
   - A bizonylatok deduplikálva jelennek meg: a NAV számla és a feltöltött számlakép nem hoz létre dupla sort.
   - Az analitika és a bevallás fizetendő ÁFA összege 100%-ban megegyezik.

3. **Számlalista integráció (`NavInvoiceRow`):**
   - A kimenő számlák táblázatában a magánszemélyek neve szintén megjelenik és a `Számláról` jelvény látható.

4. **ÁNYK 65M Szabályozás:**
   - A 65M belföldi összesítő jelentés kizárólag a törvény által előírt, adószámmal rendelkező partnereket tartalmazza, megelőzve az ÁNYK validációs hibákat.

---

## 3. Kapcsolódó
- [A-146: Magánszemély Vevőnevek Gazdagítása és ÁFA Analitikai Deduplikáció](../../architecture/decisions/A-146-private-customer-name-enrichment-and-vat-analytics.md)
- [P-032: ÁFA Bevallás Workflow](./P-032-vat-return-workflow.md)
- [P-093: ÁFA Analitika Oszlopelrendezés](./P-093-vat-analytics-net-revenue-and-column-layout-ux.md)
