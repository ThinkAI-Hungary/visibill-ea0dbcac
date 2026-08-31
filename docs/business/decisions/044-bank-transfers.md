# Decision 044: Banki Utalási Csomagok és Kifizetési Generálás

**Status:** Decided  
**Date:** 2026-07-23  
**Category:** Business Rule / Payments / Banking  

---

## Question

Hogyan támogassa a Visibill a kifizetésre váró szállítói számlák banki utalási csomagba gyűjtését, az export formátumok kezelését és a banki tranzakciókhoz való automatikus visszapárosítást?

## Context

A vállalkozásoknak rendszeresen több szállítói számlát kell kifizetniük a banki felületen. A kézi utalás egyenként időigényes és hibalehetőségeket rejt (elgépelt számlaszám, hibás összeg, téves közlemény). Szükség van egy központi felületre, ahol a lejárt vagy esedékes szállítói számlákból banki utalási állományok (GIRO, OTP, SEPA XML) generálhatók, érvényesítve a magyar CDV és nemzetközi IBAN ellenőrző kódokat.

## Decision

1. **Számlák Kiválasztása & Csoportosítása:**
   - A felhasználó kiválaszthatja a kifizetendő bejövő számlákat (mind manuálisan rögzített, mind NAV-ból érkezett számlák esetén).
   - Lehetőség van partnerenkénti összevonásra (ugyanannak a szállítónak több számlája egyetlen összesített utalási tétellé vonható össze).

2. **Banki Számlaszám Validáció:**
   - Szigorú magyar GIRO formátum ellenőrzés (16 vagy 24 számjegy, súlyozott CDV algoritmus: [9, 7, 3, 1] blokkonkénti ellenőrzéssel).
   - Nemzetközi IBAN számlaszámok esetén Modulo 97 ellenőrző összeg validáció.
   - Hiányzó vagy hibás bankszámlaszám esetén a tétel nem engedhető exportba mindaddig, amíg a felhasználó nem korrigálja.

3. **Csomag Export & Státusz Követés:**
   - Támogatott export formátumok: OTP Electra / GIRO TXT, SEPA ISO 20022 XML, CSV.
   - Az exportált csomagok `payment_transfers` entitásként mentésre kerülnek (`pending` → `sent` → `matched` életciklus).
   - Amikor a tényleges bankkivonat beérkezik, a banki tranzakció automatikusan összerendelődik a generált utalási tétellel.

## Rationale

- **Időmegtakarítás:** Több tucat számla egyetlen fájlban feladható a vállalati banki portálon.
- **Hiba megelőzés:** A CDV és IBAN előzetes validálása megvédi a vállalkozást a banki visszautasításoktól és a téves utalásoktól.

## Kapcsolódó
- **PRD:** [P-056: Banki Utalások Export UX](../../product/decisions/P-056-bank-transfers-export-ux.md)
- **ADR:** [A-058: Banki Utalások Rendszer Architektúra](../../architecture/decisions/A-058-bank-transfers-architecture.md)
- **DB Schema:** [06-transactions-bank.md](../../architecture/database/06-transactions-bank.md)
- **Kapcsolódó Üzleti Döntések:** [017: Tranzakció kezelés & párosítás](./017-transaction-matching.md), [041: Manuális kifizetés rögzítése](./041-manual-payment-recording.md)
