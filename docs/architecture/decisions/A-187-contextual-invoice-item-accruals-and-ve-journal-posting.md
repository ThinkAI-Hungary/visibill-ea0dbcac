# A-187: Számlatétel-szintű Kontextuális Időbeli Elhatárolások és Vegyes Napló Feladás

**Status:** Decided  
**Date:** 2026-10-01  
**Utoljára frissítve:** 2026-10-01  
**Category:** Accounting Engine / Frontend / Időbeli Elhatárolások (Accruals)  
**Ticket Reference:** EB-0206  

---

## 1. Context

Az `EB-0206` ticketben a könyvelő ügyfél (Surányi Pál, TS Consult Kft.) aziránt érdeklődött, hogy a több évre átnyúló számlatételeket (pl. 2026.09.01.–2027.08.31. közötti felelősségbiztosítás, szoftverlicenc) hogyan tudja megbontani és elhatárolni a felületen az adott évet terhelő költséghányad pontos kimutatásához.

A felmérés megállapításai:
1. **NAV Integritási Szabály:** A NAV Online Számla rendszerből érkező számlák és tételsorok XML szinten oszthatatlanok és hitelesek, közvetlenül a szállítóval szemben (T 5/8 – K 454) kell őket teljes összegükben rögzíteni. A tételek manipulálása helyett a magyar számviteli törvény (Sztv.) szerint vegyes könyvelési bizonylattal kell képezni az aktív (AIE) vagy passzív (PIE) időbeli elhatárolást.
2. **Hiányzó UI Belépési Pont:** Bár a háttérben létezett az `accrual_entries` tábla és az `acc_journals` / `acc_journal_headers` / `acc_journal_lines` könyvelési struktúra, a számlatételek felületén nem volt olyan kontextuális varázsló, amely felismerte volna a számlán szereplő dátumokat, kiszámolta volna a tört évi elhatárolást, és egykattintásos feladást biztosított volna a vegyes naplóba.

---

## 2. Decision

### 2.1. Független Matematikai és Időszak-detektáló Motor (`src/lib/accrualMath.ts`)
Létrehoztunk egy robusztus, keretrendszer-független modult, amely:
- Képes felismerni a magyar számlákon előforduló tipikus dátumformátumokat (`YYYY.MM.DD`, `YYYY-MM-DD`, `YYYY/MM/DD`, pontokkal vagy kötőjelekkel elválasztva, opcionális szóközökkel) a számlatétel megnevezéséből (`extractDateRangeFromText`).
- Támogatja a naparányos (`pro_rata_days`) és teljes hónapos (`full_months`) elhatárolás-számítást (`calculateAccrualSplit`), kezelve az AIE (költség / bevétel átnyúlás) és PIE irányokat.
- 9 önálló unit teszttel van levédve (`src/lib/__tests__/accrualMath.test.ts`), garantálva a kerekítési hibamentességet (`currentYearAmount + deferredAmount === totalAmount`).

### 2.2. Automatikus Vegyes Napló Feladó Szolgáltatás (`accrualPostingService.ts`)
A `src/features/journals/services/accrualPostingService.ts` modul felelős a tranzakcióért:
- Automatikusan megkeresi a céghez tartozó aktív Vegyes (`VE` / `MIXED`) könyvelési naplót (`findActiveMixedJournal`).
- Létrehozza a vegyes napló fejlécet (`acc_journal_headers`), generálva a hivatalos bizonylatszámot (`VE-YYYY-NNNN`).
- Legenerálja a kettős könyvelési tételeket (`acc_journal_lines`):
  - **AIE:** T 392 (vagy kiválasztott AIE számla) – K 5359 (vagy kiválasztott költségszámla) az elhatárolt összeggel.
- Szinkronizálja és bejegyzi a rekordot az `accrual_entries` táblába, összekapcsolva az `invoice_id`-vel és a `booked_journal_entry_id`-vel.
- Támogatja az elhatárolás és a kapcsolódó naplóbizonylat azonnali, biztonságos visszavonását / törlését (`deleteAccrualEntry`).

### 2.3. Kontextuális Felületi Varázsló (`InvoiceItemAccrualModal.tsx` & `InvoiceItemsDialog.tsx`)
- Az `InvoiceItemsDialog.tsx` táblázatában a tételsorok alatt intelligens akciógomb jelenik meg:
  - Ha a rendszer felismerte a dátumtartományt: figyelemfelkeltő **„Elhatárolás (YYYY-MM – YYYY-MM)”** gomb.
  - Ha már létezik aktív elhatárolás: zöld **„Elhatárolva: X Ft”** státuszbadge, amelyre kattintva a bizonylat megtekinthető vagy visszavonható.
  - Általános esetben: diszkrét **„Elhatárolás”** gomb kézi időszak-megadáshoz.
- Az `InvoiceItemAccrualModal` átlátható, modern felületen mutatja be az elhatárolás naparányos bontását, a tárgyévi és következő évi terhelést, a fordulónapot (YYYY.12.31.) és a nyitás utáni feloldás dátumát (YYYY.01.01.), valamint a számlatükörből választott főkönyvi számlákat.

---

## 3. Consequences

### Pozitív:
- **Könyvelőbarát Automatizáció:** A könyvelőnek nem kell manuális kalkulátorral napokat számolnia és kézzel vegyes tételeket gépelnie; a számla tételéből egyetlen kattintással előáll a törvényes könyvelési tétel.
- **Auditálható és Visszavonható:** Az elhatárolás mind a számlánál (zöld badge formájában), mind a Naplók felületen a Vegyes naplóban közvetlenül megjelenik és ellenőrizhető.
- **Típusbiztos és Tesztelt:** A matematikai mag Vitest tesztekkel verifikált, a TypeScript típusellenőrzés (`npx tsc --noEmit`) hibátlanul lefut.

### Kockázatok és Kezelésük:
- *Számlatükör eltérés:* Ha egy egyedi ügyfélnél nem létezik a 392-es vagy 5359-es számla, a modul intelligens fallback keresővel a 39* / 48* tartományokból választ alternatívát, illetve a könyvelő a lenyíló keresőben bármelyik számlát felülbírálhatja.

---

## 4. Kapcsolódó

- [P-150: Számlatétel-szintű Kontextuális Időbeli Elhatárolások (AIE/PIE) Varázsló és Feladási UX](../../product/decisions/P-150-contextual-invoice-item-accruals-and-ve-journal-posting-ux.md)
- [A-003: Multi-tenancy és RLS Architektúra](./A-003-multi-tenancy-rls.md)
- [P-055: Könyvelési Napló UX, Időrendi Sorszámvédelem, Nyitó Varázsló és Kézi Rögzítés](../../product/decisions/P-055-accounting-journals-ux.md)
