# A-146: Magánszemély Vevőnevek Gazdagítása és ÁFA Analitikai Deduplikáció

**Status:** Decided  
**Date:** 2026-09-24  
**Kategória:** Adatmodell / ÁFA / Számlakezelés  
**Kapcsolódó:** ADR A-054 (Strict Pairing), P-032 (ÁFA Workflow), P-093 (ÁFA Analitika), P-110 (Magánszemély vevők UX)

---

## 1. Context

A NAV Online Számla (OSA API 3.0) adatszolgáltatási protokoll és a GDPR adatvédelmi irányelvek szerint magánszemély vevők felé kiállított (B2C) számlák esetén a vevő adatai anonimizáltak: a letöltött rekordokban (`nav_invoices` tábla) a `customer_name` mező értéke `NULL` vagy üres, és a `customer_tax_number` sem szerepel.

Ugyanakkor a vállalkozások saját számlázóikból beküldik / feltöltik kimenő bizonylataikat a Visibill rendszerébe (`invoices` tábla), ahol a `vevo_nev` mezőben a valós magánszemély vásárló neve (pl. *Blechsmidt Tibai Réka*, *Kretzschmar Éva*, *Csapó István*, *Somogyi József*) rendelkezésre áll.

A korábbi működés hiányosságai:
1. Az ÁFA bevallás fúrási nézetében (`VatRowDrillDown.tsx`) a fizetendő ÁFA soroknál (07-es 27%, 06-os 18%, 05-ös 5%, 08-as TAM) a partner oszlop `—` jelet mutatott a magánszemélyeknél.
2. Az ÁFA gyűjtőkód analitikában (`VatCollectorAnalyticsView.tsx`) kimenő számláknál hibásan a kiállító saját cég neve (`supplier_name`) jelent meg vevő helyett.
3. Az analitikában duplázódás történt: mind a NAV Online Számla (`nav_invoices`), mind a beküldött számla (`invoices`) bekerült a listába, megduplázva az összegeket.

---

## 2. Decision

1. **Hibrid Adatgazdagítási Architektúra (DB Backfill + Runtime Fallback):**
   - Visszamenőleges migrációs szkripttel (`scripts/backfill_customer_names.mjs`) 87 hiányzó magánszemély vásárló nevét kitöltöttük a `nav_invoices.customer_name` mezőben a normalizált sorszám (`bizonylatsorszam = invoice_number`) és azonos `company_id` alapján.
   - Elkészült a `20260924114500_sync_outbound_customer_name_from_submitted_invoices.sql` trigger specifikáció a jövőbeli számlafeltöltések automatikus szinkronizálására.
   - Frontend oldalon a `VatRowDrillDown.tsx`, a `VatCollectorAnalyticsView.tsx` és a `NavInvoiceRow.tsx` közvetlen fallback összerendelést alkalmaz a beküldött számlákkal (`vevo_nev`).

2. **Irány-érzékeny Partnerfeloldás:**
   - Kimenő bizonylatoknál (`OUTBOUND`) szigorúan a vevő (`customer_name` / `vevo_nev`), bejövő bizonylatoknál (`INBOUND`) a szállító (`supplier_name` / `elado_nev`) kerül megjelenítésre.

3. **ÁFA Analitikai Bizonylat-Deduplikáció (`VatCollectorAnalyticsView`):**
   - A `nav_invoices` adatai képezik a bizonylatok alapját. A beküldött bizonylatok közül kizárólag azok kerülnek önálló sorként beemelésre (`standaloneSubInvs`), amelyek NEM szerepelnek a `nav_invoices` táblában (pl. kézi nyugták, NAV-on kívüli bizonylatok).
   - Ezzel megszűnt a kettős számlázás az analitikában, és a gyűjtőkód összesítő fillérre megegyezik a hivatalos 2665-ös ÁFA bevallás kalkulációjával.

4. **Vizuális Transzparencia Badge (`Számláról`):**
   - Ha egy magánszemély vevő neve beküldött bizonylatból származik, a név mellett egy diszkrét `<FileText /> Számláról` jelvény jelenik meg informatív tooltip-pel: *"A vevő neve a beküldött saját számláról származik"*.

5. **ÁNYK 65M Megfelelőség:**
   - Az ÁNYK 65M belföldi partneri összesítő lapra a hatályos magyar jogszabályok (Áfa tv.) szerint magánszemélyek továbbra sem kerülnek fel (mert az ÁNYK kötelező 8 jegyű adószámot követel meg, hiányában validációs hibát ad).

---

## 3. Consequences

### Pozitív
- A könyvelő a fizetendő ÁFA sorok lenyitásakor és a gyűjtőkód analitikában azonnal látja a valós magánszemély vevők nevét.
- Megszűnt az analitika duplázási hibája; az analitikai és a bevallási összegek 100%-ban fedik egymást.
- A rendszer skálázható és gyors marad: a DB-szintű kitöltés miatt nincsenek lassú N+1 lekérdezések.

### Kapcsolódó
- [P-110: Magánszemély Vevőnevek Megjelenítése és ÁFA Analitika UX](../../product/decisions/P-110-private-customer-name-display-and-vat-analytics-ux.md)
- [A-054: Szigorított NAV ↔ Beküldött Számla Összerendelés](./A-054-strict-nav-submitted-pairing.md)
- [P-093: ÁFA Analitika Oszlopelrendezés](../../product/decisions/P-093-vat-analytics-net-revenue-and-column-layout-ux.md)
