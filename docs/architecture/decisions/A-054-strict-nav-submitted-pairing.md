# A-054: Szigorított NAV ↔ Beküldött Számla Összerendelés (Strict Invoice Pairing)

**Status:** Decided  
**Date:** 2026-08-29  
**Utoljára frissítve:** 2026-08-29  

## Context
A Visibill felületén a számlák táblázatban a NAV Online Számla adatokból származó rekordok (`nav_invoices`) és a manuálisan vagy kötegelve feltöltött bizonylatok (`invoices` / `invoice_uploads`) összerendelésre kerülnek a számlakép előnézet (`InvoiceImagePreview`), a "Párosított" státuszjelzések és az exportok céljából (`navToSubmittedMap`, `submittedToNavMap`, `exportableInvoices`).

Korábban ez az összerendelés kizárólag a számlasorszám normalizált szöveges egyezése alapján (`normalizeInvNum(invoice_number) === normalizeInvNum(bizonylatsorszam)`) történt.

Ha egy felhasználó több cég számláit kezelte, és egy idegen számla (pl. téves feltöltés vagy rövid generikus sorszám miatt) bekerült a cég mappájába, az azonos sorszám miatt a felület tévesen kapcsolta össze a NAV számlát egy teljesen másik céghez vagy partnerhez tartozó számlaképpel (pl. a Ván Iroda Kft. *Durasnaz Family Group Kft.* felé kiállított 61 595 Ft-os `0057/26` kimenő számlájához hozzákapcsolódott Dr. Ván Lajos *AD-LAK Holding Kft.* felé kiállított 26 135 Ft-os `0057/26` számlaképe).

## Decision
Bevezetésre került a **többszintű validációs párosítási algoritmus** ([invoiceMatchingUtils.ts](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/lib/invoiceMatchingUtils.ts)), amely a sorszám egyezés mellett kötelező másodlagos ellenőrzéseket végez:

1. **Sorszám normalizáció:** Szóközök és írásjelek tisztítása, nagybetűsítés.
2. **Explicit ForeignKey:** Ha `submittedInvoice.nav_invoice_id === navInvoice.id`, a manuális összerendelés azonnal elfogadásra kerül.
3. **Tier 1 — Partner Adószám Egyezés (Legerősebb determinisztikus jel):**
   - Kinyeri az eladó vagy vevő 8 jegyű törzsszámát (`extractBaseTax`).
   - Ha mindkét oldalon rendelkezésre áll a partner 8 jegyű adószáma:
     - Ha az adószám megegyezik ➔ **MATCH (Elfogadva)**.
     - Ha az adószám különbözik ➔ **REJECT (Elutasítva)**, ha a név vagy összeg sem egyezik.
4. **Tier 2 — Normalizált Cégnév + Bruttó Összeg Tolerancia:**
   - Ha az adószám hiányzik (pl. külföldi partner, magánszemély vagy egyszerűsített bizonylat):
     - Partnernév tisztítás (`normalizePartnerName`: jogi formák levágása, ékezetmentesítés, írásjelek tisztítása).
     - Biztonságos containment vizsgálat (`GENERIC_WORDS` halmazzal).
     - Bruttó összeg ellenőrzés 5 Ft abszolút vagy 0.5% relatív kerekítési toleranciával (`isGrossAmountMatch`).
     - Ha a név ÉS az összeg is egyezik ➔ **MATCH**.
     - Ha mind a név, mind az összeg teljesen eltér ➔ **REJECT**.

## Consequences
**Pozitív:**
- Megszűnnek a téves csatolmány-megjelenítések azonos sorszámú, de eltérő partnerű számláknál.
- A rövid sorszámok (`1`, `10`, `INV-1`) esetén sem fordulhat elő véletlen sorszám-ütközés.
- A tiszta és tesztelt kódmodul ([invoiceMatchingUtils.test.ts](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/lib/invoiceMatchingUtils.test.ts)) 100%-os unit teszt lefedettséggel bír.

**Negatív / Trade-off:**
- Ha egy feltöltött bizonylaton mind az adószám, mind a partnernév, mind az összeg hiányzik vagy hibásan lett kinyerve az OCR által, a számla nem párosul automatikusan a NAV sorral, amíg az adatok manuálisan nincsenek pótolva.

## Kapcsolódó
- [A-025: Cross-company Invoice Routing](./A-025-cross-company-routing.md)
- [A-048: Számla Irány Felülbírálás](./A-048-invoice-direction-programmatic-override.md)
- [P-053: Szigorított Számlakép Előnézet és Párosítás UX](../../product/decisions/P-053-strict-invoice-attachment-pairing-ux.md)
