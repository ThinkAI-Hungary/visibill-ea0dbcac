

# Audit: Fennmaradó inkonzisztenciák — Adatbázis ↔ Frontend szinkron

## Talált problémák

### 1. KintlevoPage — `invoices` tábla `fizetve` boolean szűrés (MAGAS)
**Fájl:** `src/pages/KintlevoPage.tsx` (170-173. sor)

A manuális számlák lekérdezése továbbra is a `fizetve` boolean-ra szűr:
```
.select('...fizetve,melleklet_url')
.or('fizetve.is.null,fizetve.eq.false')
```
Ez az előző auditban is szerepelt, de **nem lett javítva** az `invoices` táblánál — csak a `nav_invoices` query lett átírva `transaction_id.is.null`-ra. Ha egy tranzakciót törölnek, a trigger reseteli a `transaction_id`-t NULL-ra, DE a `fizetve` boolean resetelését semmi sem garantálja az `invoices` táblán (a `reset_paid_on_transaction_delete` trigger nem módosítja a `fizetve` mezőt).

**Javítás:** A query-t átírni `transaction_id`-re:
- select: `fizetve` helyett `transaction_id`
- szűrő: `.is('transaction_id', null)`

---

### 2. Analytics oldal — Nem szűri a kifizetett/kifizetetlen státuszt és nem használ realtime-ot (KÖZEPES)
**Fájl:** `src/pages/Analytics.tsx` (118-140. sor)

- A `fetchRawData` a `salary` táblából mindent lekérdez (`select("*")`), nem szűri a `transaction_id` alapján — tehát a bérek grafikonon kifizetetlen bérek is megjelennek.
- A Dashboard (`Index.tsx`) ezzel szemben helyesen szűri: `.filter((s: any) => !!s.transaction_id)` (290. sor).
- Az Analytics oldal **nem használja a `useRealtimeInvalidation` hookot**, és nem is TanStack Query-t, hanem `useEffect`-et + `useState`-et. Ha a háttérben változik egy tranzakció, az Analytics oldal NEM frissül.

**Javítás:**
- A salary query-t szűrni `transaction_id IS NOT NULL` alapján, VAGY a feldolgozásnál szűrni mint az Index.tsx-ben
- Opcionálisan: `useRealtimeInvalidation` hozzáadása (bár ha useEffect-alapú, manuális refetch kell)

---

### 3. InvoiceStatusTables (Dashboard) — Nem használ TanStack Query-t, nem frissül realtime-ban (MAGAS)
**Fájl:** `src/components/dashboard/InvoiceStatusTables.tsx`

Ez a komponens **`useEffect` + `useState`**-et használ a `fetchData`-val, nem TanStack Query-t. A `useRealtimeInvalidation` hook a szülő `Index.tsx`-ben fut, és invalidálja a `['dashboardData']` query key-t — de ez NEM érinti az `InvoiceStatusTables` lokális state-jét, mert az nem query.

Következmény: Ha egy tranzakciót párosítanak vagy törölnek, a "Fizetendő" és "Hiányzó" listák **NEM frissülnek** amíg a felhasználó nem navigál el és vissza.

**Javítás:** Az `InvoiceStatusTables`-t átírni TanStack Query-ra (pl. `useQuery` + saját query key), vagy a realtime channel változáskor `fetchData()`-t meghívni.

---

### 4. Realtime hook hiányzó query key-ek (KÖZEPES)
**Fájl:** `src/hooks/useRealtimeInvalidation.ts`

A hook a `transactions` tábla változásakor invalidálja:
- `['transactions', companyId]`
- `['salaries', companyId]`
- `['submittedInvoices', companyId]`
- `['dashboardData', companyId]`

**Hiányzik:**
- `['kintlevo-nav', companyId]` — a KintlevoPage NAV query-je
- `['kintlevo-manual', companyId]` — a KintlevoPage manual invoice query-je
- `['dashboardAnalytics', companyId]` — a transactions változáskor (jelenleg csak a salary handler invalidálja)

Következmény: Ha a Kintlévőségek oldalon van a user és a háttérben egy tranzakció párosítás történik (pl. egy másik felhasználó által), a kintlévőség lista NEM frissül.

**Javítás:** A `transactions` handler-hez hozzáadni a hiányzó query key invalidációkat.

---

### 5. Dashboard `fetchDashboardData` — `useEffect`/`useState` minta (ALACSONY)
**Fájl:** `src/pages/Index.tsx` (140-160. sor)

Az `Index.tsx` egy hibrid mintát használ: TanStack Query wrapper van (`dashboardData` key), de a tényleges adat `useState`-ekben van (profile, categories, invoices, metrics, navVatData, stb.). A realtime invalidáció ugyan újrafuttatja a query-t, de a pattern törékeny — ha a `fetchDashboardData` hibát dob, a state-ek részben frissülhetnek.

Ez nem kritikus hiba, de **inkonzisztens** a Salaries és Transactions oldalak tiszta TanStack Query mintájával.

**Javítás:** Hosszú távon a dashboard adatokat is tiszta `useQuery`-kre migrálni. Rövid távon elfogadható.

---

### 6. Analytics oldal — Béreknél nincs `transaction_id` szűrés (KÖZEPES)
**Fájl:** `src/pages/Analytics.tsx` (131-139. sor)

A `salary` lekérdezés minden bér tételt lekérdez a grafikonhoz. A Dashboard (`Index.tsx`, 290. sor) **szűri** a béreket `!!s.transaction_id` alapján (csak a kifizetett béreket jeleníti meg a grafikonon). Az Analytics oldal ezt NEM teszi — minden bért megjelenít függetlenül attól, hogy ki van-e fizetve.

Ha ez szándékos (teljes bérkiadás megjelenítése), ez rendben van. De ha a cél a tényleges cash flow (amit a Dashboard mutat), akkor inkonzisztens.

**Javítás:** Egyeztetni az üzleti logikát a Dashboard és Analytics között — ha cash flow, szűrni `transaction_id`-re.

---

## Összefoglalás

| # | Fájl | Probléma | Súlyosság |
|---|------|----------|-----------|
| 1 | `KintlevoPage.tsx` | `invoices` tábla `fizetve` boolean szűrés `transaction_id` helyett | MAGAS |
| 2 | `Analytics.tsx` | Bérek nem szűrtek `transaction_id`-re + nincs realtime | KÖZEPES |
| 3 | `InvoiceStatusTables.tsx` | useState/useEffect, nem frissül realtime-ban | MAGAS |
| 4 | `useRealtimeInvalidation.ts` | Hiányzó query key-ek (kintlevo, dashboardAnalytics) | KÖZEPES |
| 5 | `Index.tsx` | Hibrid useState + useQuery minta | ALACSONY |
| 6 | `Analytics.tsx` | Bérek cash flow inkonzisztencia a Dashboard-dal | KÖZEPES |

### Javasolt implementációs sorrend
1. **KintlevoPage** — `fizetve` → `transaction_id` szűrő csere (gyors, kritikus)
2. **useRealtimeInvalidation** — hiányzó query key-ek hozzáadása
3. **InvoiceStatusTables** — átírás TanStack Query-ra a realtime frissítés érdekében
4. **Analytics** — salary `transaction_id` szűrés + konzisztencia a Dashboard-dal

