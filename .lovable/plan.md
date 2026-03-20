

# Duplikált sorok összesítése többhónapos nézetben

## Probléma
Az adatbázisban minden hónapra külön sor létezik (pl. "Jámbor Viktor Ferenc" bér: jan 332 698 Ft + feb 332 698 Ft). Többhónapos nézetben ezek külön sorokként jelennek meg ahelyett, hogy összesítve lennének.

## Megoldás
Aggregációs logika bevezetése a `useSalaryData` hook-ban: az azonos `név` + `tipus` kombinációjú tételek összegeit összeadni dolgozónként és a NAV szekción belül.

## Érintett fájlok

### 1. `src/hooks/useSalaryData.ts` — Aggregációs logika
Az `employeeGroups` és `navItems` kiszámításánál (a meglévő `useMemo`-ban) az itemeket `név + tipus` kulcs alapján csoportosítani és összegezni:

- **Dolgozói bontás**: Egy dolgozón belül az azonos `név`+`tipus` sorok → 1 összesített sor (összegek összeadva)
- **NAV utalások**: Azonos `név` sorok → 1 összesített sor
- Az aggregált rekord megőrzi az első előfordulás `id`-ját, `statusz`-át, `kifizetes_ideje`-t (a legfrissebb), és a `transaction_id`-t (ha bármelyiknek van)
- A `fizetesi_mod` az első elemből öröklődik

### 2. `src/components/salaries/EmployeeAccordion.tsx` — Tétel szám korrekció
A fejlécben az `items.length` helyesen az aggregált tételek számát fogja mutatni (pl. 3 tétel 6 helyett).

### Nincs UI változás szükséges
A komponensek már `SalaryItem[]`-et fogadnak — az aggregált adatok ugyanolyan formátumúak lesznek, csak kevesebb sorral.

## Aggregáció logikája (pseudocode)
```text
items csoportosítás "név|tipus" kulcs alapján:
  - összeg: SUM(összeg)
  - statusz: ha bármelyik paid → paid, egyébként az első
  - kifizetes_ideje: a legkésőbbi dátum
  - transaction_id: az első nem-null
  - dátum: a legkésőbbi
```

