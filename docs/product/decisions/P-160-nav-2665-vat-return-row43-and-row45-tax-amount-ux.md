# P-160: NAV 2665 43. és 45. Sorok Adóösszeg Felhasználói Élménye és Tételes Megjelenítése (UX)

**Status:** Decided  
**Category:** UI / Statutory VAT Reporting  
**Question:** Hogyan jelenjen meg a NAV 2665 ÁFA bevallásban a 43. (Tárgyi eszköz értékesítés) és 45. (Előleg a 05–07. sorokból) tájékoztató sorok adóalapja és adóösszege a felületen és az analitikában?  
**Decision:** A 43. és 45. soroknál mind az adóalap, mind az ÁFA oszlop aktív és kitöltött állapotban jelenik meg a kalkulátorban, a hivatalos űrlap replikában és az analitikai fúrásban, összhangban a hivatalos NAV nyomtatvánnyal.  
**Current Implementation:** `VatCalculatorView.tsx` (fő táblázat), `Nav2665Sheet0102.tsx` (digitális replika), `VatCollectorAnalyticsView.tsx` (tételes analitika).  
**Rationale:** A könyvelők számára elengedhetetlen, hogy a Visibill felületén látható adatok 1:1-ben megegyezzenek az ÁNYK-ban és az ONYA-ban szereplő rovatokkal. A korábbi üres cellák bizonytalanságot szültek az ügyfelekben (EB-0117).  

---

## 1. Felhasználói Igény és Probléma

A könyvelő (Kiss-Százi Emese, VBV Vision Kft.) a 2665-ös ÁFA bevallás ellenőrzésekor azt tapasztalta, hogy:
- A 2026. augusztusi bevallásban a 43. sorban (tárgyi eszköz értékesítés az Audi A6 eladásából) csak a 13 780 eFt nettó alap látszódott, az ÁFA oszlop üres maradt.
- A 2026. februári bevallásban a 45. sorban (előleg a Ván Iroda Kft. felé) csak a 15 000 eFt alap látszódott, az ÁFA oszlop üres maradt.

A felhasználó elvárása az volt, hogy mivel a NAV nyomtatvány mindkét oszlopot kéri ezeknél a soroknál, az ÁFA összeget (3 720 eFt és 4 050 eFt) is jelenítse meg a rendszer.

---

## 2. Megoldás és UI Működés

1. **ÁFA Kalkulátor Nézet (`VatCalculatorView.tsx`):**
   - A `vat_form_rows` táblában beállított `has_tax = true` révén a 43. és 45. soroknál nem jelenik meg üres cella, hanem a `tax_amount_rounded` mező értéke kerekített ezer forintban látható.
   - Sorlenyitáskor (drilldown) a bizonylatok listájában a partner, teljesítés dátuma, nettó összeg és ÁFA összeg oszlopok is pontosan tükrözik a tételek adatait.

2. **Hivatalos Nyomtatvány Digitális Replika (`Nav2665Sheet0102.tsx`):**
   - A 2665A-01-02 lapon a 43. sor ("Tárgyieszköz-értékesítés a 36. sor összegéből") és a 45. sor ("Előleg címén kapott összeg a 05-07. és a 110. sorok összegéből") mindkét cellája (`(b) Az adó alapja`, `(c) Az adó összege`) aktívvá válik (`hasTax={true}`).

3. **Analitikai Gyűjtő Nézet (`VatCollectorAnalyticsView.tsx`):**
   - A tételek automatikus vagy felülbírált hozzárendelésekor az analitika mind a nettó alapot, mind az ÁFA-t rögzíti a 43-as és 45-ös sorok alá, biztosítva a fúrási egyezést.

---

## Kapcsolódó
- [A-201: NAV 2665 ÁFA Bevallás: 43. és 45. Sorok Adóösszeg Implementációja](../../architecture/decisions/A-201-nav-2665-vat-return-row43-and-row45-tax-amount.md)
- [P-126: NAV 2665 Hivatalos Nyomtatvány Digitális Replika UX](./P-126-nav-2665-official-tax-form-digital-replica-ux.md)
- [P-060: Statutory Reporting and VAT Return Modular UX](./P-060-statutory-reporting-and-vat-return-modular-ux.md)
