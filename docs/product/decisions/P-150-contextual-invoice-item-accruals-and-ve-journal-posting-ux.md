# P-150: Számlatétel-szintű Kontextuális Időbeli Elhatárolások (AIE/PIE) Varázsló és Feladási UX

**Status:** Decided  
**Date:** 2026-10-01  
**Category:** Invoices / Accounting / eaisyBooks  
**Ticket Reference:** EB-0206  

---

## 1. Question

Hogyan oldható meg a több évre átnyúló számlák és számlatételek (pl. 2026.09.01. – 2027.08.31. közötti felelősségbiztosítások, szoftverlicencek) időbeli elhatárolása a Visibill felületén közvetlenül a számlatételek nézetéből úgy, hogy a könyvelőnek ne kelljen manuálisan napokat/hónapokat számolnia, és a számviteli törvény szerinti vegyes napló tétel egyetlen kattintással legenerálódjon?

---

## 2. Decision

### 2.1. Automatikus Szöveges Dátumdetektálás a Tételsorokban
A rendszer a számlatétel megnevezéséből automatikusan felismeri a dátumintervallumokat (`extractDateRangeFromText`, támogatva a magyar számlázókban leggyakoribb formátumokat, pl. `2026.09.01.-2027.08.31.`).

### 2.2. Kontextuális Akciógombok a Tételek Táblázatában (`InvoiceItemsDialog.tsx`)
A tétel megnevezése alatt kontextusfüggő gomb jelenik meg:
1. **Észlelt időszak esetén:** Kiemelt narancssárga/borostyán színű gomb az időszak feltüntetésével: **`Elhatárolás (2026-09 – 2027-08)`**.
2. **Már elhatárolt tétel esetén:** Zöld státuszgomb: **`Elhatárolva: 5 133 Ft`**, amelyre kattintva a feladott elhatárolás megtekinthető vagy egy kattintással stornózható/törölhető.
3. **Általános esetben:** Diszkrét szürke **`Elhatárolás`** gomb, amellyel tetszőleges számlatételhez manuálisan is megadható az időszak.

### 2.3. Időbeli Elhatárolás Rögzítése Varázsló (`InvoiceItemAccrualModal.tsx`)
A modális ablak azonnal kiszámolja és szemléletesen bemutatja az elhatárolás részleteit:
- **Élő időarányos kalkuláció:**
  - *Hónaparányos (hó):* Teljes naptári hónapok szerinti megosztás.
  - *Exakt naparányos (nap):* Törtévi naptári napok szerinti exakt felosztás, szökőév- és egyenlegvédelemmel.
- **Tárgyévi költség vs. Következő évi elhatárolás:** Szétbontva és kiemelve mutatja a fordulónapig (YYYY.12.31.) elszámolandó és a következő évre átvitt összeget.
- **Automatikus Főkönyvi Számlapár Felajánlás:**
  - Bejövő számla (költség) esetén: **AIE** (`T: 392 – K: költségszámla`).
  - Kimenő számla (bevétel) esetén: **PIE** (`T: árbevétel – K: 481`).
  - A főkönyvi választó teljes szélességű, túlcsordulás-védett (`w-full truncate`) legördülő menüben azonnal módosítható.
- **Dátumok:** Fordulónap (YYYY.12.31.) és a nyitás utáni feloldás dátuma (YYYY.01.01.) előre beállítva.
- **Egykattintásos Feladás:** Az *„Elhatárolás könyvelése”* gomb legenerálja a Vegyes napló tételt és szinkronizálja az `accrual_entries` nyilvántartást.

---

## 3. Current Implementation

- **UI Modális Varázsló:** [`src/components/invoices/InvoiceItemAccrualModal.tsx`](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/invoices/InvoiceItemAccrualModal.tsx)
- **Tételek Dialógus Integráció:** [`src/components/InvoiceItemsDialog.tsx`](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/InvoiceItemsDialog.tsx)
- **Vegyes Napló Feladási Szolgáltatás:** [`src/features/journals/services/accrualPostingService.ts`](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/features/journals/services/accrualPostingService.ts)
- **Matematikai Motor:** [`src/lib/accrualMath.ts`](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/lib/accrualMath.ts)
- **Vitest Tesztek:**
  - [`src/lib/__tests__/accrualMath.test.ts`](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/lib/__tests__/accrualMath.test.ts) (9 teszt)
  - [`src/features/journals/services/__tests__/accrualPostingService.test.ts`](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/features/journals/services/__tests__/accrualPostingService.test.ts) (7 teszt)
  - [`src/components/invoices/__tests__/InvoiceItemAccrualModal.test.tsx`](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/invoices/__tests__/InvoiceItemAccrualModal.test.tsx) (7 teszt)

---

## 4. Rationale

- Az `EB-0206` ticketben a könyvelő (Surányi Pál) kifejezetten a több évre átnyúló biztosítási tételek számlafeldolgozáskori elhatárolásának menetét kereste.
- A számlatétel közvetlen kontextusában elérhető varázsló radikálisan csökkenti a könyvelői adminisztrációt: nincs szükség zsebszámológépre, naptárnézegetésre vagy kézi vegyes naplózásra.
- A funkció mind a NAV OSA számlákon, mind a beküldött számlaképeken egységesen működik.

---

## 5. Kapcsolódó

- [A-187: Számlatétel-szintű Kontextuális Időbeli Elhatárolások és Vegyes Napló Feladás](../../architecture/decisions/A-187-contextual-invoice-item-accruals-and-ve-journal-posting.md)
- [P-055: Könyvelési Napló UX, Időrendi Sorszámvédelem, Nyitó Varázsló és Kézi Rögzítés](./P-055-accounting-journals-ux.md)
- [P-128: Könyvelési Naplók Tömeges Kontírozása és Vizuális T/K Kontíroszlop UX](./P-128-journals-bulk-gl-reassignment-and-tk-column-ux.md)
