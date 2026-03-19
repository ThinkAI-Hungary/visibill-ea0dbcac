
# Audit: Dinamikus Computed Status konzisztencia

## Talált problémák

### 1. Dashboard (`Index.tsx`) — `paid` boolean használata `transaction_id` helyett
**Súlyosság: MAGAS**

Az `Index.tsx` (dashboard) a havi grafikon adatait az elavult `nav_invoices.paid` boolean alapján számítja:
- **275. sor**: `select("... paid, currency")` — a `paid` booleanra épít, `transaction_id`-t nem kérdezi le
- **333-343. sorok**: `if (inv.paid === true)` — ezen alapul a fizetett/nem fizetett bevétel/kiadás bontás

Ez azt jelenti, hogy a dashboard grafikon **nem követi dinamikusan** a tranzakció-törléseket. Ha egy tranzakciót törölnek, a trigger reseteli a `paid` flaget, DE a dashboard cache-elt adatokat használ és a `paid` boolean alapján számol — holott a `transaction_id` az igazság forrása.

**Javítás**: A select-ben `paid` helyett `transaction_id`-t lekérdezni, és `!!inv.transaction_id` alapján szétválasztani a fizetett/nem fizetett tételeket.

### 2. Kintlévőségek oldal (`KintlevoPage.tsx`) — `paid` boolean szűrés
**Súlyosság: MAGAS**

A `KintlevoPage.tsx` a kintlévőségeket a `paid` boolean szűrővel kérdezi le:
- **154. sor**: `.select('...paid')`
- **157. sor**: `.or('paid.is.null,paid.eq.false')`

Ez nem a `transaction_id` relációra épít, tehát ha a trigger reseteli a `paid`-et, az adatok helytelenek lehetnek, illetve a logika nem konzisztens a többi oldallal.

**Javítás**: A szűrést `transaction_id.is.null`-ra cserélni, összhangban az InvoiceStatusTables-szel.

### 3. TransactionsPage — saját `getMatchStatus` a shared hook helyett
**Súlyosság: ALACSONY**

A `TransactionsPage.tsx` saját lokális `getMatchStatus` függvényt definiál (83-95. sor), ami logikailag **azonos** a `useComputedStatus.ts`-ben lévő `computeMatchStatus`-szal, de nem használja azt. Ez duplikáció — ha az üzleti logika változik, két helyen kell módosítani.

**Javítás**: A lokális `getMatchStatus`-t lecserélni a shared `computeMatchStatus` importra.

### 4. InvoiceStatusTables (`dashboard`) — `paid` boolean az interfészben
**Súlyosság: ALACSONY**

Az `InvoiceStatusTables.tsx` interfészében még szerepel a `paid: boolean | null` mező, bár a "payable" szűrés már `transaction_id.is.null`-ra épít. A `paid` mező feleslegesen van lekérdezve a selectben.

**Javítás**: Takarítás — `paid`-et eltávolítani az interfészből és a selectből, `transaction_id`-t felvenni.

---

## Összefoglalás: Teendők

| # | Fájl | Probléma | Változás |
|---|------|----------|----------|
| 1 | `Index.tsx` | `paid` boolean a grafikonban | `transaction_id` lekérdezés + `!!transaction_id` logika |
| 2 | `KintlevoPage.tsx` | `paid` boolean szűrés | `transaction_id.is.null` szűrő |
| 3 | `TransactionsPage.tsx` | Duplikált `getMatchStatus` | Shared `computeMatchStatus` import |
| 4 | `InvoiceStatusTables.tsx` | `paid` maradék az interfészben | Takarítás: `transaction_id` az interfészbe |

Ezekkel a javításokkal az alkalmazás minden oldalán a `transaction_id` reláció lesz az igazság egyetlen forrása, és a `paid` boolean sehol sem befolyásolja a megjelenítést.
