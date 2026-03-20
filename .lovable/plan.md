

# Teljes menüátfogó audit — Fennmaradó inkonzisztenciák

Az alábbi audit minden oldalt és komponenst átvizsgálva tárja fel azokat a helyeket, ahol a frontend nem tükrözi megbízhatóan az adatbázis állapotát, vagy ahol a kód pattern megakadályozza a valós idejű frissülést.

---

## 1. InvoicesPage — useEffect/useState, nincs TanStack Query (MAGAS)
**Fájl:** `src/pages/InvoicesPage.tsx`

A Számlák oldal a teljes adatlekérést (`fetchInvoiceData`) `useEffect` + `useState` mintával végzi (307-670. sor). Bár van egy saját realtime channel (317-343), az csupán `fetchInvoiceData()`-t hívja újra, ami a teljes adathalmazt újratölti minden egyes változáskor — és NEM TanStack Query-n keresztül. Következmények:
- A `useRealtimeInvalidation` hook hiába invalidálja a `submittedInvoices` és `navInvoices` query key-eket, azok nem léteznek TanStack Query-ként ezen az oldalon
- A teljes újratöltés lassú és nem inkrementális
- A `setInvoices`, `setSubmittedInvoices` state-ek nem szinkronizálódnak más oldalakkal

**Javítás:** A `fetchInvoiceData`-t szétbontani `useQuery` hívásokra (navInvoices, submittedInvoices, partners, categories, projects, transactions), és a realtime subscription-t lecserélni a már meglévő `useRealtimeInvalidation` hookra.

---

## 2. Analytics oldal — useEffect/useState, nincs realtime (KÖZEPES)
**Fájl:** `src/pages/Analytics.tsx`

Az Analytics oldal `useEffect` + `useState` mintát használ (98-102. sor), NEM használ `useRealtimeInvalidation`-t és NEM TanStack Query-t. Ha a háttérben tranzakció változik, az oldal NEM frissül.

**Javítás:** `useRealtimeInvalidation` hookot hozzáadni, és a `fetchAnalyticsData`-t `useQuery`-re migrálni (vagy legalább a realtime hook segítségével manuálisan újratölteni).

---

## 3. Projects oldal — useEffect/useState, nincs realtime (KÖZEPES)
**Fájl:** `src/pages/Projects.tsx`

A projektek oldal `useEffect` + `useState` mintát használ (65-134. sor). Nincs `useRealtimeInvalidation`, nincs TanStack Query. Ha egy másik felhasználó számlát rendel egy projekthez, a pénzügyi összesítők NEM frissülnek.

**Javítás:** A `loadProjects`-et `useQuery`-re migrálni, a `projectFinancials`-t külön query-ként, és `useRealtimeInvalidation` hozzáadni.

---

## 4. PettyCashPage — Nincs realtime invalidáció (KÖZEPES)
**Fájl:** `src/pages/PettyCashPage.tsx`

A Házipénztár oldal TanStack Query-t használ (helyes!), de NEM használja a `useRealtimeInvalidation` hookot. A `pettyCashEntries` query key nincs a realtime hook invalidáció listáján sem. Ha új ATM tranzakció érkezik a háttérben, a házipénztár egyenleg NEM frissül.

**Javítás:** `useRealtimeInvalidation` hookot hozzáadni, és a `transactions` tábla változáskor a `pettyCashEntries` és `pettyCashSettings` query key-eket is invalidálni.

---

## 5. Settings — CompanyMembersCard useEffect/useState (ALACSONY)
**Fájl:** `src/pages/Settings.tsx` (202-233. sor)

A `CompanyMembersCard` komponens `useEffect` + `useState` mintát használ. Nincs realtime frissítés — ha egy új tag csatlakozik a céghez, a lista nem frissül.

**Javítás:** `useQuery`-re migrálni.

---

## 6. InvoiceDetailPopup — `fizetve` boolean az interfészben (ALACSONY)
**Fájl:** `src/components/InvoiceDetailPopup.tsx` (26. sor)

A `FullInvoice` interfészben még szerepel `fizetve: boolean | null`. Bár a badge már `!!invoice.transaction_id`-t használ (155. sor), a `fizetve` mező feleslegesen van az interfészben — zavaró lehet fejlesztőknek.

**Javítás:** Eltávolítani `fizetve`-t a `FullInvoice` interfészből, mivel nem használt.

---

## 7. BaseInvoice type — `fizetve` boolean maradék (ALACSONY)
**Fájl:** `src/types/invoices.ts` (17. sor)

A `BaseInvoice` interfészben még mindig szerepel `fizetve?: boolean`. Ez az elavult mező, amit sehol sem kellene frontend logikában használni.

**Javítás:** Eltávolítani a `fizetve` mezőt a `BaseInvoice`-ból.

---

## 8. useRealtimeInvalidation — hiányzó query key-ek (KÖZEPES)
**Fájl:** `src/hooks/useRealtimeInvalidation.ts`

A `transactions` tábla változásakor NEM invalidálja:
- `['pettyCashEntries', companyId]` — házipénztár egyenleg
- `['invoiceStatusPartners', companyId]` — dashboard partner cache

Az `invoices` tábla változásakor NEM invalidálja:
- `['linkedInvoices', companyId]` — bizonylatlánc
- `['invoiceTransactions', companyId]` — tranzakció párosítások

**Javítás:** Hozzáadni a hiányzó query key-eket.

---

## 9. `nav_invoices` tábla nincs a realtime hookban (MAGAS)
**Fájl:** `src/hooks/useRealtimeInvalidation.ts`

A hook figyeli a `salary`, `invoices`, és `transactions` táblákat, de **NEM figyeli a `nav_invoices` táblát**. Ha egy NAV számla `transaction_id`-je változik (pl. triggerből), a frontend NEM kap értesítést. A Számlák oldal saját channel-t épít erre (InvoicesPage.tsx 317-343), de a Dashboard, KintlevoPage és Analytics oldalak NEM kapnak értesítést nav_invoices változásról.

**Javítás:** A `useRealtimeInvalidation` hookba felvenni a `nav_invoices` tábla figyelését, és az `navInvoices`, `kintlevo-nav`, `invoiceStatusPayable`, `invoiceStatusMissing`, `dashboardData` query key-ek invalidálását.

---

## Összefoglalás

| # | Fájl | Probléma | Súlyosság |
|---|------|----------|-----------|
| 1 | `InvoicesPage.tsx` | useEffect/useState minta, nem TanStack Query | MAGAS |
| 2 | `Analytics.tsx` | useEffect/useState, nincs realtime | KÖZEPES |
| 3 | `Projects.tsx` | useEffect/useState, nincs realtime | KÖZEPES |
| 4 | `PettyCashPage.tsx` | TanStack Query van, de nincs realtime hook | KÖZEPES |
| 5 | `Settings.tsx` | CompanyMembersCard useState | ALACSONY |
| 6 | `InvoiceDetailPopup.tsx` | `fizetve` maradék az interfészben | ALACSONY |
| 7 | `types/invoices.ts` | `fizetve` maradék a BaseInvoice-ban | ALACSONY |
| 8 | `useRealtimeInvalidation.ts` | Hiányzó query key-ek (pettyCash, partners) | KÖZEPES |
| 9 | `useRealtimeInvalidation.ts` | `nav_invoices` tábla nincs figyelve | MAGAS |

### Javasolt implementációs sorrend

**Fázis 1 — Azonnali hatás, alacsony kockázat:**
1. `useRealtimeInvalidation` — `nav_invoices` tábla figyelés hozzáadása + hiányzó query key-ek
2. `PettyCashPage` — `useRealtimeInvalidation` hook bekötése
3. `types/invoices.ts` + `InvoiceDetailPopup.tsx` — `fizetve` maradék takarítás

**Fázis 2 — Közepes refaktor:**
4. `Analytics.tsx` — `useRealtimeInvalidation` + TanStack Query migráció
5. `Projects.tsx` — TanStack Query migráció

**Fázis 3 — Nagy refaktor (kockázatos, sok kód érintett):**
6. `InvoicesPage.tsx` — Teljes átírás useQuery-re (2300+ soros fájl, gondos tesztelés szükséges)
7. `Settings.tsx` — CompanyMembersCard useQuery migráció

