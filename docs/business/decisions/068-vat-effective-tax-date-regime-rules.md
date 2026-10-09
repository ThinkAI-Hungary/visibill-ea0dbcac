# Decision 068: ÁFA tv. Szerinti Adófizetési Kötelezettség és Levonási Jog Keletkezése Normál vs. Pénzforgalmi Adózási Módban

**Status:** Decided  
**Category:** Business Rule / Tax & Statutory Compliance  
**Date:** 2026-10-09  

---

## Question

Hogyan kell a rendszernek meghatároznia a fizetendő és levonható ÁFA elszámolási időszakát (keletkezési dátumát) az Áfa tv. szabályai szerint, különös tekintettel a normál (nem pénzforgalmi) és a pénzforgalmi elszámolású (`cash_accounting`) adóalanyok közötti alapvető eltérésekre?

---

## Decision

A magyar általános forgalmi adóról szóló törvény (2007. évi CXXVII. törvény – Áfa tv.) alapján a rendszer az alábbi szigorú üzleti és számítási szabályokat érvényesíti a `calculate_hungarian_vat_return` eljárásban és a kapcsolódó ÁFA analitikákban:

### 1. Normál Adózó Fizetendő (Kimenő) ÁFA Kötelezettsége (Áfa tv. 55–58. §)
- **Alapszabály:** Normál (nem pénzforgalmi elszámolású) társaság esetében a fizetendő ÁFA kötelezettség a **gazdasági teljesítés időpontjában** (`delivery_date` vagy folyamatos szolgáltatásnál a számított `calculated_ti`) keletkezik.
- **Banki Kiegyenlítés Kizárása:** A kimenő számla fizetendő adójának bevallási időszakát **soha nem módosíthatja** a banki kifizetés vagy kiegyenlítés dátuma. 
- **Tilos a Görgetés:** Ha egy vevő a 2026. januári teljesítésű számláját csak 2026. márciusban fizeti ki a bankban, az ÁFA kötelezettség változatlanul a 2026. januári bevallást terheli, és tilos azt a banki tranzakció miatt márciusra átgörgetni.

### 2. Normál Adózó Levonható (Bejövő) ÁFA Joga (Áfa tv. 119–120. §)
- **Alapszabály:** Normál adózó esetén az előzetesen felszámított ÁFA levonási joga a teljesítés napján keletkezik, feltéve, hogy a számla a rendelkezésére áll.
- **Kivétel – Pénzforgalmi Szállító:** Ha a szállító pénzforgalmi elszámolást választott (`is_cash_accounting = true`), az Áfa tv. 196/B. § (2) bekezdése alapján a levonási jog **kizárólag a számla ellenértékének megfizetésekor** nyílik meg. Ebben az esetben az ÁFA beemelésének határnapja a banki vagy pénztári kifizetés dátuma.

### 3. Pénzforgalmi Elszámolású Adóalany (`v_is_penzforgalmi = true`, Áfa tv. XIII/A. fejezet)
- **Fizetendő ÁFA:** Kizárólag az ellenérték tényleges jóváírásakor (kifizetéskor) válik esedékessé.
- **Levonható ÁFA:** Kizárólag a számla ellenértékének pénzügyi rendezésekor (kifizetésekor) helyezhető levonásba.
- Pénzforgalmi adózó esetén mind a kimenő, mind a bejövő oldalon a pénzügyi teljesítés dátuma (`payment_date` vagy tranzakció dátum) vezérli a bevallás időszaki besorolását.

---

## Rationale

A korábbi aggregációs lekérdezésekben a banki tranzakciókhoz kötött kifizetési dátum felülírta a normál adózású cégek kimenő számláinak adófizetési időpontját. Ez súlyos adójogi kockázatot jelentett, mivel a NAV ellenőrzés adóbírságot és késedelmi pótlékot szab ki, ha a teljesítés hónapja helyett egy későbbi kifizetési hónapban kerül bevallásra a fizetendő adó. A fenti szabályzat jogszabályi védelmet és automatikus adóhatósági konformitást garantál.

---

## Kapcsolódó
- [A-237: NAV Online Számla v3 GZIP Kitömörítés](../../architecture/decisions/A-237-nav-osa-gzip-decompression-and-utility-line-items.md)
- [033: ÁFA Bevallás Modul](./033-vat-return-module.md)
- [065: ÁFA Levonásba Helyezés Halasztása és Kérdéses Számlák](./065-deferred-vat-deduction-and-questionable-invoices.md)
