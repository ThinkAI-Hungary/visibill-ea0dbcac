# P-142: Tranzakció Többes Számlapárosítás és Jutalék-levonás UX

**Status:** Decided  
**Category:** Tranzakció & Párosítás  
**Updated:** 2026-09-29  

**Question:** Hogyan párosíthatja a felhasználó a gyűjtő banki kifizetéseket (pl. Booking.com, Stripe, OTP SimplePay, futárszolgálatok) több kiállított vagy befogadott számlával közvetlenül a tranzakció részletező dialógusban?  

**Decision:** Megvalósítottuk a többes számlakijelölést (Multi-select) és a dinamikus összesítő sávot (Running Total & Fee Difference) a manuális párosítási felületen (`ManualMatchSearchSection.tsx`). A felhasználó checkboxok segítségével egyetlen lépésben tetszőleges számú számlát kijelölhet, valós időben látja az összesített bruttó összeget, a banki jóváírás összegét és a levont közvetítői jutalékot / különbözetet, a megerősítés pedig atomi kötegben elvégzi az elsődleges és kiegészítő párosításokat.  

**Current Implementation:**
- `src/components/transaction-details/ManualMatchSearchSection.tsx`
- `src/hooks/useTransactionMatching.ts`
- `src/lib/matching/matchingService.ts` (`batchApplyMatches`, `batchAddExtraMatches`)
- `src/locales/hu/transactions.json` & `src/locales/hr/transactions.json`
- `src/components/TransactionDetailsDialog.tsx`

---

## 1. Üzleti Háttér és Probléma

A szálláshely-szolgáltatóknál és e-kereskedelmi vállalkozásoknál (pl. Booking.com, Airbnb, Stripe) a platformok rendszeresen összevont, gyűjtő utalásokban fizetik ki a vendégek vagy vásárlók számláit. A kifizetett összeg ráadásul szinte mindig kevesebb a számlák bruttó összegénél, mivel a közvetítő levonja a saját jutalékát (commission fee).

**Korábbi viselkedés:**
- A manuális számlakeresőben egy tranzakcióhoz csak 1 db számlát lehetett kijelölni rádiógomb-szerűen.
- A mentés gombra kattintva a dialógus azonnal bezáródott, így a felhasználó nem érzékelte, hogy létezik a tranzakció kártyáján egy második lépésben megjelenő „További számla hozzáadása” lehetőség.
- A felhasználók (pl. EB-0217 hibajegy és Dr. Paróczai Csaba esete) úgy tapasztalták, hogy nem lehet 1 tranzakcióhoz több számlát kötni.

---

## 2. Megoldás és Felületi Működés

### 2.1 Checkbox-alapú Többes Kijelölés
- A jelöltek listájában minden számla sora mellett egy dedikált `Checkbox` jelenik meg.
- A teljes sorra vagy a checkboxra kattintva a tétel kijelölése be- és kikapcsolható.
- Egyszerre 1, 2 vagy tetszőleges számú számla kijelölhető az elsődleges keresési listából és a kiegészítő számlák keresésekor is.

### 2.2 Dinamikus Összesítő és Jutalék Sáv
Amikor a felhasználó 1-nél több számlát jelöl ki, közvetlenül a lista alatt megjelenik egy kiemelt összesítő panel (`bg-primary/5 border-primary/25`):
1. **Kijelölt számlák darabszáma és összesített bruttó összege:** (pl. `2 db számla kijelölve: 130 646 Ft`).
2. **Kijelölés törlése gomb:** Egy kattintással visszaállítható az üres kijelölés.
3. **Tranzakció jóváírási összege:** (pl. `Tranzakció összege: 115 282 Ft`).
4. **Különbözet / Levont jutalék:**
   - Ha a számlák összege meghaladja a banki utalást, a rendszer azonnal kiírja a levont jutalékot: `Levont jutalék / díj: -15 364 Ft`.
   - Ha a számlák összege pontosan megegyezik a banki tétellel, zöld badge jelzi: `✓ Pontos összeg egyezés`.

### 2.3 Intelligens és Beszédes Mentés Gomb
- **0 kijelölt számla:** A gomb inaktív (disabled).
- **1 kijelölt számla:** `[ ✓ Párosítás mentése ]` (normál egyedi párosítás).
- **2+ kijelölt számla:** `[ ✓ {{count}} db számla párosítása ]` (pl. `2 db számla párosítása`).
- **Kiegészítő mód (Extra matches):** `[ + {{count}} db számla hozzáadása ]`.

---

## 3. Adatbázis és Szerviz Réteg Architektúra

A háttérben a `batchApplyMatches` függvény atomi módon fut le:
1. **Elsődleges tétel:** Az első kiválasztott számla azonosítója kerül a `transactions.matched_invoice_id` mezőbe `match_type = 'multi_manual'` értékkel, és a számla `fizetve = true` / `paid = true` jelölést kap.
2. **További tételek:** A második, harmadik stb. számlák rekordként bekerülnek a `public.transaction_invoice_matches` join táblába.
3. **Trigger szinkronizáció:** A meglévő `trg_mark_invoice_paid_on_multi_match` adatbázis-trigger automatikusan beállítja a kapcsolódó számlákon a `paid = true` és `transaction_id = transaction.id` mezőket.
4. **Koordinált Cache Invalidation:** A művelet befejezése után egyetlen központi `invalidateMatchingQueries` hívás frissíti az összes érintett nézetet és KPI-t.
