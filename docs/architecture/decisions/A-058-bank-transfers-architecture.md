# A-058: Banki Utalások és Csomagkészítés Architektúra (Bank Transfers)

**Status:** Decided  
**Date:** 2026-07-23  
**Utoljára frissítve:** 2026-07-23  

---

## Context

A kifizetendő szállítói számlák tömeges kiegyenlítése banki exportfájlokkal (GIRO / SEPA) hatékony, de robusztus adatmodellt igényel:
1. A cég saját bankszámláinak nyilvántartása devizánként.
2. A generált utalási tételek és csomagok perzisztálása az auditálhatóság és a későbbi bankkivonat-összepárosítás érdekében.
3. Kliens-oldali és adatbázis-szintű védelem az érvénytelen számlaszámok és duplikált kifizetések ellen.

## Decision

### 1. Adatbázis Séma (`20260723144000_bank_transfers_feature.sql`)
- `public.company_bank_accounts`: Cég saját bankszámlái (`bank_name`, `account_number`, `currency`, `company_id`).
- `public.payment_transfers`: Generált utalási tételek:
  - `invoice_ids UUID[]`: Hivatkozott számlák azonosítói tömbként.
  - `invoice_sources TEXT[]`: Számla források (`'nav'`, `'manual'`).
  - `status TEXT`: `'pending'`, `'sent'`, `'matched'`.
  - `matched_transaction_id`: FK → `transactions.id` (ha a banki kivonat beérkezik).

### 2. Algoritmikus Validáció
- **Magyar GIRO CDV Validáció:** 16 vagy 24 számjegyű számlaszámok esetén a magyar bankszövetségi súlyozott modulus ellenőrzés fut le:
  - Súlyok: `[9, 7, 3, 1, 9, 7, 3, 1]` blokkonként.
  - Az összegnek 10-zel oszthatónak kell lennie az 1., 2. és (ha 24 jegyű) 3. blokkban.
- **IBAN Modulo 97 Validáció:** Nemzetközi számlaszámok esetén az ISO 7064 Modulo 97-10 ellenőrzés hajtódik végre.

### 3. Fájl Generálás & Export Formátumok
- **OTP Electra:** Fix mezőszélességű, kódolt szöveges állomány.
- **GIRO Standard TXT:** Általános banki csoportos átutalási formátum.
- **SEPA Pain.001 XML:** Nemzetközi és eurós átutalási szabvány (ISO 20022).
- **CSV:** Univerzális táblázatos formátum.

## Consequences

**Pozitív:**
- Biztonságos és ellenőrzött kifizetési folyamat.
- Teljes nyomonkövethetőség a számlától a generált csomagon át a beérkező banki tranzakcióig.

## Kapcsolódó
- **BRD:** [044: Banki Utalások](../../business/decisions/044-bank-transfers.md)
- **PRD:** [P-056: Banki Utalások Export UX](../../product/decisions/P-056-bank-transfers-export-ux.md)
- **DB Schema:** [06-transactions-bank.md](../database/06-transactions-bank.md)
