# P-191: Bankkártyás POS és AMEX Göngyölegek Virtuális Banki Feldolgozása, Tételes Tranzakció Generálás és Kereskedői Elszámolási UX

**Status:** Decided  
**Date:** 2026-10-15  
**Category:** POS Settlement / Virtual Banking / Ingestion / Transactions UX  
**Author:** Áron / Antigravity AI  
**Kapcsolódó döntések:** [075](../../business/decisions/075-pos-and-amex-card-settlement-virtual-banking-and-gl-clearing.md), [P-189](./P-189-eaisybooks-gl-defaults-petty-cash-currency-and-virtual-bank-ux.md), [073](../../business/decisions/073-gl-opening-continuity-virtual-banks-and-single-currency-cash-policy.md), [A-258](../../architecture/decisions/A-258-gl-opening-balances-rollforward-and-transfers-dedup-integrity.md)

---

## Question
Hogyan jelenjen meg és működjön az OTP Bankkártya (Visa/Mastercard) és American Express elfogadói tételes elszámoló listák feltöltése, automatikus felismerése, és tranzakciós feldolgozása a Visibill / eaisyBooks felületén?

1. Milyen feltöltési csatornán (`transactions` vs `reports`) keresztül érkezzenek a göngyöleg PDF-ek?
2. Milyen adatstruktúrával és vizuális jelöléssel jelenjenek meg a Virtuális Bank számlái és tranzakciói a Tranzakciók oldalon és a Banki beállításokban?
3. Hogyan történik a korábban hibára futott elszámolási fájlok helyreállítása?

---

## Decision

### 1. Feltöltési Csatorna és Automatikus Formátumfelismerés
- A bankkártyás göngyölegek a standard **Bankkivonatok (`transactions`)** feltöltési csatornán keresztül tölthetők fel (kézi drag-and-drop és email alias útján egyaránt).
- A `channelConfigs.ts` `BANK_HINT_OPTIONS` regisztrálja az új opciókat:
  - `otp_pos`: *OTP POS / Kártyaelfogadó (virtuális bank / elszámolás)*
  - `amex_pos`: *OTP AMEX Elfogadó (virtuális bank / elszámolás)*
- A feldolgozó motor automatikusan detektálja az `OTP Bank Nyrt.` és `ELFOGADÓI TÉTELES ELSZÁMOLÓ LISTA` / `AMEX ELFOGADÓI TÉTELES ELSZÁMOLÓ LISTA` fejléceket.

### 2. Tételes Tranzakciók és Önelszámoló 3-Lábú Modell
A göngyöleg feldolgozása során nem egyetlen összevont tétel, hanem tételes sorok jönnek létre:
- **Bruttó kártyás fizetések (+összeg):**
  - Tranzakció dátuma: a kártyás lehúzás tényleges napja (pl. `2026-07-17`).
  - Leírás: `POS kártyás fizetés - Eng: <auth_code> (<card_masked>) | OTP: <otp_id>`.
  - Típus: `vevői tranzakció`.
  - Díj mező (`fee_amount`): az adott tranzakcióra eső banki jutalék.
- **Kártyaelfogadói jutalék (-összeg):**
  - Dátum: a banki elszámolás napja.
  - Leírás: `Kártyaelfogadói jutalék - OTP POS (<merchant_code>) [<period_from> - <period_to>]`.
  - Típus: `banki költség` (GL 532).
- **Nettó kiutalás átvezetése (-összeg):**
  - Dátum: a banki elszámolás napja.
  - Leírás: `Átvezetés bankszámlára (<account_number>) - OTP POS [<period_from> - <period_to>]`.
  - Típus: `átvezetés` (GL 389).

### 3. Dinamikus Virtuális Bank Regisztráció és GIRO Checksum Bypass
- A terminál vagy kereskedői kód alapján a rendszer automatikusan megnyitja a virtuális bankszámlát a `company_bank_accounts` táblában (pl. `POS-00037219`).
- A `BankAccountsTab.tsx` felületén a virtuális bankok (`POS-` előtag, `is_virtual_bank`) mentesülnek a belföldi 3x8 GIRO számlaszám és ellenőrzőösszeg algoritmus alól.
- A `TransactionsPage.tsx` `BANK_CONFIG` dedikált színekkel és címkékkel jeleníti meg az új forrásokat:
  - `otp_pos`: Smaragdzöld badge (`OTP POS Kártyaelfogadó`)
  - `amex_pos`: Kék badge (`OTP AMEX Elfogadó`)

---

## Verifikált Éles Eredmények (Mandala Fogadó Kft.)
- **Cég ID:** `418b3264-1169-46bb-9a2a-4f58a186bf1e`
- **Feldolgozott göngyölegek:** 140 darab korábbi sikertelen feltöltés sikeresen beolvasva és `completed` státuszba állítva.
- **Létrejött tranzakciók:** 1 905 új, tételes POS tranzakció a `transactions` táblában (a cég összes tranzakciója 1 689-ről 3 594-re emelkedett).
- **Létrejött naplók:** `B-POS` és `B-AMEX` (mindkettő `3851` kapcsolattal).

---

## Kapcsolódó
- **BDR:** [075: Bankkártyás és AMEX Elfogadói Göngyölegek Feldolgozása Virtuális Bankként](../../business/decisions/075-pos-and-amex-card-settlement-virtual-banking-and-gl-clearing.md)
- **PRD:** [P-189: Pénztárak Egyetlen Devizaneme, Szallas.hu Virtuális Bank](./P-189-eaisybooks-gl-defaults-petty-cash-currency-and-virtual-bank-ux.md)
- **Parser Kód:** [`posSettlementParser.ts`](file:///c:/Users/adetw/.antigravity/visibill/visibill-709fffdf/src/features/transactions/services/posSettlementParser.ts)
- **Processor Kód:** [`posSettlementProcessor.ts`](file:///c:/Users/adetw/.antigravity/visibill/visibill-709fffdf/src/features/transactions/services/posSettlementProcessor.ts)
