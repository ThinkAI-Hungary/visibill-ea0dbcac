# P-189: Pénztárak Egyetlen Devizaneme, Szallas.hu Virtuális Bank, Főkönyvi Default Nézet (0-szűrés és Dinamikus Osztálybontás), ÁFA Sablon Kiszélesítés és Nyitó Sablon Parser UX

**Status:** Decided  
**Date:** 2026-10-15  
**Category:** UI / Workflow / Accounting UX  
**Author:** Áron / Antigravity AI  
**Kapcsolódó döntések:** [A-258](../../architecture/decisions/A-258-gl-opening-balances-rollforward-and-transfers-dedup-integrity.md), [073](../../business/decisions/073-gl-opening-continuity-virtual-banks-and-single-currency-cash-policy.md), [P-188](./P-188-petty-cash-custom-name-voucher-number-and-vat-entry-ux.md), [P-093](./P-093-vat-analytics-net-revenue-and-column-layout-ux.md)

---

## Question
1. **Pénztárak Devizaneme:** A korábbi felületen több devizanem is bejelölhető volt pénztárnyitáskor (multiselect). Hogyan biztosítható, hogy egy házipénztár szigorúan egyetlen dedikált devizanemmel (pl. HUF vagy EUR vagy USD) rendelkezzen?
2. **Szallas.hu Virtuális Bank:** Hogyan illeszthető be a Szallas.hu felülete a banki beállításokba, feltöltési tippekbe és tranzakciós szűrőkbe úgy, hogy ne akadjon fenn a belföldi 3x8 számlaszám és GIRO checksum validáción?
3. **Főkönyvi Nézet Alapértelmezések:** Hogyan érhető el, hogy a Főkönyvi kivonat megnyitásakor ne jelenjenek meg a zavaró 0-egyenlegű sorok, és kizárólag azok a számlaosztályok nyíljanak ki automatikusan (3 és 4 számjegy mélységig), amelyekben van forgalom?
4. **ÁFA Tételes Sablon Szerkesztő:** Miért torlódtak össze a testreszabható oszlopok a modálban, és hogyan tehető kényelmessé 12 oszlop kezelése?
5. **Nyitó Sablon Betöltés:** Miért kerültek a nyitó tételek mind a Tartozik (`T`) oldalra CSV importáláskor, és hogyan érhető el a teljesen ékezet- és elválasztó-független beolvasás?

---

## Decision

### 1. Pénztárak Egyetlen Devizaneme (`RegisterDialog.tsx`)
- A checkboxos multiselect listát felváltotta egy **rádiógomb-szerű egyszelekciós (`selectedCurrency`) vezérlő**.
- Egy pénztárnál egyszerre **pontosan egy devizanem** választható ki (HUF, EUR, USD, GBP, CHF).
- A backend felé küldött payload (`currencies: [selectedCurrency]`) megőrizte a tömbszerkezetet a meglévő adatbázis sémával való 100%-os visszafelé kompatibilitás érdekében.
- Letisztult kék kiemelés jelzi az aktívan kiválasztott devizát.

### 2. Szallas.hu Virtuális Bankszámla Kezelés
- **Beállítások (`BankAccountsTab.tsx`):** A standard bankok listájába bekerült a `Szallas.hu (Virtuális)` bank narancssárga-borostyán gradienssel (`from-amber-500 to-orange-600`), és megkapta az `isVirtualBank: true` flaget.
- **Checksum Bypass:** Virtuális bankok esetén a felület feloldja a kötelező belföldi GIRO 3x8 számlaszám algoritmus ellenőrzést, így a Szallas.hu egyedi virtuális azonosítói azonnal elmenthetők.
- **Feltöltési és Szűrő Rendszer:** A `channelConfigs.ts` `BANK_HINT_OPTIONS` regisztrálja a `szallas` kulcsot, a `TransactionsPage.tsx` `BANK_CONFIG` pedig natív szűrőként és badge-ként jeleníti meg a felületen.

### 3. Főkönyvi Kivonat Alapértelmezések (`GeneralLedgerPage.tsx`, `GeneralLedgerTable.tsx`)
- **Default 0-Szűrés:** A `hideZeroBalances` alapértelmezett értéke `true`-ra váltott. A 0-ás számlák a megnyitáskor automatikusan rejtve maradnak, tisztán tartva a könyvelői fókuszt.
- **Dinamikus Osztálykibontás (`computeDefaultExpandedClasses`):**
  - A rendszer végigpásztázza a betöltött főkönyvi tételeket és egyenlegeket.
  - Kizárólag azokat a hierarchikus szülő számlaosztályokat nyitja ki alapértelmezetten (1, 2, 3 és 4 számjegy mélységig), amelyekhez tartozik nem-nulla forgalmú vagy egyenlegű tétel.
  - Az üres osztályok csukva maradnak.
- **Manuális Felhasználói Állapot Védelme:** `userHasManuallyToggledRef` biztosítja, hogy ha a felhasználó kézzel csuk be vagy nyit ki egy osztályt, a reaktív adathálózati frissülések ne bírálják felül a döntését.

### 4. ÁFA Tételes Sablon Szerkesztő Modál Kiszélesítése (`VatViewSelectorModal.tsx`)
- A korábbi szűk `sm:max-w-5xl` korlátot eltávolítottuk.
- Helyette a modál `w-[96vw] max-w-[1700px] h-[90vh]` reszponzív, tágas méretet kapott.
- A mindkét oldali (elérhető vs. kiválasztott) lista 12-12 oszlopa teljesen kényelmesen, vízszintes sortörés vagy csonkolás nélkül, akadálytalan drag-and-drop és kattintásos rendezéssel kezelhető.

### 5. Nyitó Sablon Parser Ékezet- és Elválasztó Függetlenítése (`openingImportParser.ts`)
- **Diakritikus Normalizálás:** A fejlécazonosítást a `normalizeKey` végzi: Unicode Normalization Form KD (`NFD`) és ékezetlefejtés segítségével az `irány` $\to$ `irany`, az `összeg` $\to$ `osszeg`, a `főkönyvi szám` $\to$ `fokonyvi szam` kulcsokra konvertálódik.
- **T/K Érzékelés:** Beépítésre került az `isCreditIndicator` és `isDebitIndicator` heurisztika, amely automatikusan felismeri a `K`, `Követel`, `Credit`, `Kovetel`, illetve `T`, `Tartozik`, `Debit` jelöléseket.
- **Univerzális CSV Parser (`parseCsvContent`):** Automatikusan detektálja az elválasztó karaktert (pontosvessző `;`, vessző `,`, tab `\t`), kezeli az idézőjelekbe zárt mezőket, és lecsupaszítja az UTF-8 BOM (`\uFEFF`) bájtokat.

---

## Current Implementation
- [`RegisterDialog.tsx`](file:///c:/Users/adetw/.antigravity/visibill/visibill-709fffdf/src/components/petty-cash/RegisterDialog.tsx): Single-select rádiócsoport.
- [`BankAccountsTab.tsx`](file:///c:/Users/adetw/.antigravity/visibill/visibill-709fffdf/src/components/settings/BankAccountsTab.tsx): Szallas.hu virtuális bank integráció.
- [`GeneralLedgerPage.tsx`](file:///c:/Users/adetw/.antigravity/visibill/visibill-709fffdf/src/pages/GeneralLedgerPage.tsx): `hideZeroBalances: true` default.
- [`GeneralLedgerTable.tsx`](file:///c:/Users/adetw/.antigravity/visibill/visibill-709fffdf/src/components/general-ledger/GeneralLedgerTable.tsx): `computeDefaultExpandedClasses` algoritmus.
- [`VatViewSelectorModal.tsx`](file:///c:/Users/adetw/.antigravity/visibill/visibill-709fffdf/src/features/vat/components/templates/VatViewSelectorModal.tsx): Reszponzív 1700px széles nézet.
- [`openingImportParser.ts`](file:///c:/Users/adetw/.antigravity/visibill/visibill-709fffdf/src/features/journals/services/openingImportParser.ts): Normalizált CSV/XLSX feldolgozó.

---

## Rationale
- **Ergonómia & Időmegtakarítás:** A könyvelőnek nem kell minden cég megnyitásakor manuálisan kattintgatnia a 0-ás sorok elrejtéséhez vagy a releváns számlák kikereséséhez.
- **Adathiba Megelőzés:** A pénztárak deviza-izolációja megakadályozza a vegyes devizás téves egyenlegképzést. A robusztus nyitó sablon beolvasás kiküszöböli a hibás könyvelési tételek tömeges létrejöttét.

---

## Kapcsolódó
- [A-258: Főkönyvi Nyitó Mérlegtételek Évközi Átgörgetése](../../architecture/decisions/A-258-gl-opening-balances-rollforward-and-transfers-dedup-integrity.md)
- [073: Nyitó Mérlegegyenlegek és Virtuális Bankok Szabályzata](../../business/decisions/073-gl-opening-continuity-virtual-banks-and-single-currency-cash-policy.md)
