# Decision 043: Könyvelési Naplók és Kettős Könyvviteli Folyószámlák

**Status:** Decided  
**Date:** 2026-08-27  
**Category:** Business Rule / General Ledger / Compliance  

---

## Question

Hogyan támogassa a Visibill a magyar számviteli törvénynek (Sztv.) megfelelő zárt kettős könyvviteli naplózást (Accounting Journals), a naplók típus szerinti szétválasztását és a lekönyvelt tételek szigorú megváltoztathatatlanságát?

## Context

A kettős könyvvitelt vezető magyar cégek számára a számlák és tranzakciók automatikus AI kategorizálásán túl kötelező a könyvelési naplók (pénztár, bank, vevő, szállító, vegyes, nyitó, záró, bérfeladás) elkülönített vezetése, az év/hó szerinti időszaki zárás, a szigorú folyósorszámozás és a könyvelt tételek törölhetetlensége (immutabilitás, audit trail, sztornó bizonylat kényszer).

## Decision

1. **Dedikált Napló Rendszer (`acc_journals`):**
   - A céghez inicializáláskor 9 alapértelmezett napló jön létre:
     - `NY` – Nyitó tételek (Főkönyv: 491)
     - `B1` – K&H bank HUF (Főkönyv: 3841)
     - `B2` – K&H bank EUR (Főkönyv: 3861)
     - `P1` – Házipénztár HUF (Főkönyv: 3811)
     - `V` – Vevő számlák (Főkönyv: 311)
     - `SZ` – Szállító számlák (Főkönyv: 454)
     - `VE` – Vegyes tételek
     - `BÉR` – Bérfeladás
     - `Z` – Záró tételek (Főkönyv: 492)

2. **Folyósorszámozás & Zárt Időszak:**
   - Minden naplóhoz évenként elkülönített, ugrásmentes folyósorszámláló tartozik (`acc_journal_counters`).
   - A lekönyvelt tételek csak nyitott könyvelési időszakba (`acc_accounting_periods.is_closed = FALSE`) könyvelhetők le.

3. **Könyvelési Szabályok & Immutabilitás:**
   - Egy könyvelési tétel (`acc_journal_headers`) csak akkor könyvelhető le (`status = 'KONYVELT'`), ha a tartozik (T) és követel (K) tételek összege egyensúlyban van (`Debit - Credit = 0`).
   - A lekönyvelt tétel nem módosítható és nem törölhető. Módosítás kizárólag sztornó tétel (`entry_type = 'SZTORNO'`, ellentétes T/K előjel) generálásával és opcionális javító piszkozat (`KEZI_PISZKOZAT`) létrehozásával történhet.
   - Minden státuszváltást és módosítást az `acc_journal_audit_logs` naplóz.

## Rationale

- **Számviteli megfelelőség:** A magyar jogszabályok megkövetelik a szigorú bizonylati fegyelmet és a naplók szerinti elszámolást.
- **Auditálhatóság:** A könyvelőirodák és könyvvizsgálók számára nélkülözhetetlen a zárható időszak és a hibák sztornózással történő javítása.

## Kapcsolódó
- **PRD:** [P-055: Könyvelési Napló UX](../../product/decisions/P-055-accounting-journals-ux.md)
- **ADR:** [A-057: Könyvelési Napló Architektúra](../../architecture/decisions/A-057-accounting-journals-architecture.md)
- **DB Schema:** [22-accounting-journals.md](../../architecture/database/22-accounting-journals.md)
- **Kapcsolódó Üzleti Döntések:** [021: Főkönyvi rendszer](./021-general-ledger.md), [042: Sztornó számla kezelés](./042-storno-invoice-business-rule.md)
