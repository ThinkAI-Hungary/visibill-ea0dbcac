# Decision 070: Házipénztári Kézi Tételek és Számlák Utólagos Összerendelésének és Leválasztásának Számviteli Szabályzata

**Status:** Decided  
**Category:** Accounting Policy / Petty Cash / Cash Invoicing  
**Date:** 2026-10-12  

---

## Question
Milyen számviteli és folyószámla-integritási szabályok érvényesüljenek, amikor egy vállalkozás korábban rögzített házipénztári bizonylatához (bevétel vagy kiadás) utólagosan rendelnek hozzá egy nyitott szállítói vagy vevői számlát, illetve mik a követelmények a kapcsolat felbontása (leválasztás) esetén?

---

## Decision

### 1. Készpénzes Kiegyenlítés Elismerése (Settlement Rule)
* Amikor egy házipénztári bizonylatot (`petty_cash_entries`) utólagosan összerendelnek egy számlával:
  * A számla azonnal **rendezett** státuszba lép mind az analitikus számlanyilvántartásban (`fizetve = true`), mind a NAV számlaszinkronban (`paid = true`).
  * A fizetési mód `cash` megjelölést kap, a fizetési dátum pedig megegyezik a pénztári bizonylat könyvelési dátumával (`entry_date`).
  * Megjegyzésként rögzítésre kerül a pénztárbizonylat azonosítója (vagy leírása).
  * A szállítói vagy vevői folyószámla analitikában a tétel zártnak tekintendő.

### 2. Kapcsolat Felbontása és Visszanyitás (Unlinking & Re-opening Policy)
* Amennyiben a felhasználó a számlát leválasztja a pénztárbizonylatról (pl. téves partner vagy rossz számlaszám kiválasztása miatt):
  * A rendszer **köteles a számlát azonnal visszanyitni** nyitott, kifizetetlen követelésként vagy kötelezettségként (`fizetve = false`, `paid = false`, kézi fizetési jelzők törlése).
  * Tilos a számlát függőben vagy kifizetett státuszban hagyni leválasztás után.
  * A pénztári bizonylat nem törlődik, hanem önálló manuális pénztári tételként marad meg, fenntartva a fizikai kassza egyenlegének pontosságát.

### 3. Folyószámla Konzultáció és Duplikáció Megelőzés
* Készpénzes számla utólagos hozzárendelésekor a rendszer ellenőrzi, hogy a számla ne szerepeljen más kifizetett banki tranzakcióban.
* Ha a számla bankon keresztül már kiegyenlítésre került, az utólagos készpénzes hozzárendelés tiltott a duplikált kivezetések és a könyvelési egyenlegtorzulások megelőzése érdekében.

---

## Rationale
A magyar számviteli törvény (Sztv.) és a pénzkezelési szabályzat megköveteli, hogy a pénztári bizonylatok és a számlák közötti kapcsolatok auditálhatóak legyenek. Az utólagos összerendelés és az újranyitási lehetőség biztosítja a folyószámla analitika és a pénztárkönyv maradéktalan egyezőségét.

---

## Kapcsolódó
* **ADR:** [A-249: Házipénztári Utólagos Számla-hozzárendelés és Leválasztás Atomi RPC Architektúra](../../architecture/decisions/A-249-petty-cash-invoice-linking-and-unlinking-atomic-rpcs.md)
* **PRD:** [P-183: Házipénztári Utólagos Számla-hozzárendelés és Leválasztás UX](../../product/decisions/P-183-petty-cash-invoice-attachment-and-unlink-ux.md)
