# Decision 075: Bankkártyás és AMEX Elfogadói Göngyölegek Feldolgozása Virtuális Bankként és Zéró-Egyenlegű Főkönyvi Elszámolása

**Status:** Decided  
**Category:** Accounting Policy / POS Merchant Settlements / Virtual Banking / General Ledger  
**Date:** 2026-10-15  

---

## Question
Hogyan kell számvitelileg és rendszerarchitektúrában kezelni a vendéglátásban és szállodaiparban (pl. Mandala Fogadó Vendéglátóipari Kft., Jankovich Hotel) keletkező bankkártya-elfogadói elszámoló listákat („bankkártyás göngyölegek” – OTP Bank POS, American Express, Visa/Mastercard)?

1. Miért nem könyvelhető a fizikai bankszámlára (384) érkező nettó jóváírás közvetlenül a vevői vendégszámlák ellenében?
2. Hogyan biztosítja a Virtuális Bank (385 Kártyaelfogadói elszámolási számla) a bruttó bevételek tételes párosíthatóságát, a jutalékok (532 Bankköltség) pontos könyvelését és az önelszámoló zéró záróegyenleget?
3. Hogyan valósul meg az átvezetés a virtuális bank és a fizikai bankszámla között a 389 Pénzforgalmi elszámolási számlán keresztül?

---

## Decision

### 1. A Számviteli Probléma és Kényszer
A kereskedelmi és szállodai vendégek a szállodai számlákat vagy pénztárgépi nyugtákat **bruttó összegben** (pl. 273 650 Ft) egyenlítik ki bankkártyával. A kártyaelfogadó bank (pl. OTP Bank Nyrt.) azonban:
- Időszakonként (napi vagy heti bontásban) göngyölve utalja át a pénzt,
- Levonja a kereskedői jutalékot / banki tranzakciós díjat (pl. 4 926 Ft),
- És a fizikai bankszámlára (384) csupán a **nettó kifizetendő összeget** (pl. 268 724 Ft) írja jóvá egyetlen tételként.

Ha a könyvelő a bankkivonat 268 724 Ft-os jóváírását közvetlenül a 273 650 Ft-os vendégszámlához rendelné:
1. A vendégszámlán 4 926 Ft kifizetetlen nyitott maradvány keletkezne (fals részkiegyenlítés).
2. A 4 926 Ft kártyaelfogadói jutalék nem jelenne meg a költségek (532 Bankköltség) között.
3. A könyvelés elveszítené az egyedi kártyalehúzások és bizonylatok visszakereshetőségét.

### 2. A Virtuális Bank Modell (385 Kártyaelfogadói Elszámolás)
A bankkártya-elfogadói rendszert (OTP POS, AMEX) a rendszerben **Virtuális Bankként** (`company_bank_accounts`, `is_virtual_bank = true`, számlaszám pl. `POS-00037219`) kezeljük, amelyhez dedikált banknapló (`B-POS` vagy `B-AMEX`, kapcsolt főkönyv: `3851`) tartozik.

Minden egyes elszámoló lista feldolgozásakor egy zárt, **3-lábú pénzforgalmi tranzakciócsoport** keletkezik a virtuális bankban:
1. **1. Láb – Bruttó kártyás bevételek (+Bruttó összeg):**
   - Minden egyedi kártyalehúzás tételesen létrejön jóváírásként a tranzakció napjával (`T 3851 / K 311 Vevők` vagy `911 Árbevétel`).
   - Lehetővé teszi az egyes vendégszámlák 100%-os egyenértékű, forintra pontos automatikus vagy manuális párosítását.
2. **2. Láb – Kártyaelfogadói jutalék (-Jutalék összeg):**
   - Az elszámolási időszak lezárásakor terhelésként könyvelődik bankköltségként (`T 532 Bankköltség / K 3851`).
3. **3. Láb – Nettó kiutalás átvezetése (-Nettó összeg):**
   - A bank által átutalt nettó összeg terhelésként távozik a virtuális bankból az elszámolási számlára (`T 389 Pénzforgalmi elszámolások / K 3851`).

### 3. Önelszámoló Zéró Egyenleg és Fizikai Bank Kapcsolat
```
VIRTUÁLIS BANK (3851)                      FIZIKAI BANK (3841)
+273 650 Ft  (Vevő követelés jóváírás)     +268 724 Ft  (OTP Bank kivonat jóváírás)
  -4 926 Ft  (532 Jutalék terhelés)                     │
-268 724 Ft  (389 Átvezetés kiutalás)                   │
───────────                                            │
    0 Ft     (Egyenleg lezárva!)                        │
     │                                                  │
     └─────────────► T 3841 / K 389 ◄───────────────────┘
```
- A virtuális bank záróegyenlege a göngyöleg elszámolásával **pontosan 0 Ft-ra fut ki**.
- A fizikai bankszámlán (3841) megjelenő banki tétel a 389-es átvezetési számlát egyenlíti ki, így a 389-es számla egyenlege is azonnal 0 Ft lesz.

---

## Rationale
- **Számviteli tisztaság:** A vendégszámlák bruttó értéken záródnak le, a bankköltség valós időben elszámolódik, a mérleg pénzeszköz állománya pedig forintra egyezik a fizikai bankszámlakivonattal.
- **Tételes auditálhatóság:** Az engedélyszámok (auth code), maszkolt kártyaszámok és OTP tranzakcióazonosítók alapján minden egyes szállodai tétel auditálhatóvá válik a NAV és könyvvizsgáló felé.
- **Zéró manuális munka:** A PDF elszámoló listák feltöltésekor a rendszer automatikusan megalkotja a 3 lábat, létrehozza a virtuális bankszámlát és elvégzi a naplózást.

---

## Kapcsolódó
- **PRD:** [P-191: Bankkártyás POS Göngyölegek Virtuális Banki Feldolgozása és Tranzakciós UX](../../product/decisions/P-191-bankcard-pos-settlement-virtual-bank-and-accounting-ux.md)
- **BDR:** [073: Főkönyvi Nyitó Egyenlegek Folytonossága és Virtuális Bankszámlák Szabályzat](./073-gl-opening-continuity-virtual-banks-and-single-currency-cash-policy.md)
- **ADR:** [A-258: Főkönyvi Nyitó Átgörgetés és Virtuális Bankszámlák](../../architecture/decisions/A-258-gl-opening-balances-rollforward-and-transfers-dedup-integrity.md)
