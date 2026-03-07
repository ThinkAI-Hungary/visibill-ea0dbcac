

## Globális dátumválasztó a headerben - egységes dátumszűrés minden oldalon

### Koncepció

Egy új React Context (`DateRangeContext`) tárolja a globálisan kiválasztott dátumtartományt (`dateFrom`, `dateTo`). Az `AppLayout` headerébe kerül egy kompakt dátumválasztó sáv (preset gombok + calendar picker), ami mindig látható. Minden oldal ebből a context-ből olvassa a dátumot, a saját lokális dátumszűrői megszűnnek.

### Érintett fájlok

**1. Új fájl: `src/contexts/DateRangeContext.tsx`**
- Context: `dateFrom` (default: aktuális hónap eleje), `dateTo` (default: aktuális hónap vége)
- Setter függvények + preset helper-ek (ez a hónap, előző hónap, ez az év)

**2. Új fájl: `src/components/GlobalDatePicker.tsx`**
- Kompakt header komponens: preset gombok ("Ez a hónap", "Előző hónap", "Ez az év") + két calendar popover (kezdő/záró dátum)
- A jelenlegi `Index.tsx` ~763-856 sorok logikáját emeli ki újrafelhasználható komponensbe
- Mindig mutatja a kiválasztott periódust

**3. `src/components/AppLayout.tsx`**
- A `<main>` tag elé egy fix header sáv: `<GlobalDatePicker />`
- A `DateRangeProvider`-t itt vagy az `App.tsx`-ben wrappeljük

**4. `src/App.tsx`**
- `DateRangeProvider` hozzáadása a provider fába

**5. `src/pages/Index.tsx`**
- Töröljük: `dateFrom/dateTo/dateFromOpen/dateToOpen` lokális state-eket és a hozzájuk tartozó UI-t (~763-856 sorok)
- Helyette: `const { dateFrom, dateTo } = useDateRange()` context-ből olvasás
- Minden lekérdezés és számítás változatlan marad, csak a forrás változik

**6. `src/pages/InvoicesPage.tsx`**
- A `navFilters.dateFrom/dateTo` és `submittedFilters.dateFrom/dateTo` mezők alapértéke a globális context-ből jön
- A tab-szintű lokális dátumszűrők megszűnnek, a globális dátum lesz az elsődleges

**7. `src/pages/TransactionsPage.tsx`**
- `filters.dateFrom/dateTo` helyett a globális context dátumait használja
- Lokális dátum picker UI eltávolítása a filter sávból

**8. `src/pages/Analytics.tsx`**
- `selectedYear` + hónap logika helyett a globális dátumtartomány
- A grafikonok a context dátumaihoz igazodnak

**9. `src/pages/SalariesPage.tsx`**
- `selectedMonth/selectedYear` helyett a globális context dátumtartománya szűri a béreket

**10. `src/pages/PettyCashPage.tsx`**
- A készpénz tranzakciók szűrése a globális dátumokkal

**11. Nem érintett oldalak** (nincs dátumfüggő adat):
- ExchangeRates, Projects, Partners, Settings, Integrations, Pricing, ManualUpload - ezeknél a header dátumválasztó megjelenik de nem szűr semmit

### Implementáció sorrendje

1. `DateRangeContext` + `GlobalDatePicker` komponens létrehozása
2. `AppLayout` header-be beépítés + `App.tsx` provider
3. `Index.tsx` lokális dátum UI eltávolítása, context használat
4. `InvoicesPage.tsx` átállítás
5. `TransactionsPage.tsx` átállítás
6. `Analytics.tsx` átállítás
7. `SalariesPage.tsx` átállítás
8. `PettyCashPage.tsx` átállítás

