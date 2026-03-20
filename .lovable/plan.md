

# Bérek oldal - Dinamikus periódus-megjelenítés

## Mi változik

Az adatszűrés már most is a DateRangeContext alapján történik (`useSalaryData` hook), tehát az összesítés és a dolgozói bontás automatikusan a kiválasztott időszakra vonatkozik. A fő változás a **fejlécek dinamikus szövege** és a **periódus-kontextus megjelenítése**.

## Érintett fájlok

### 1. `src/pages/SalariesPage.tsx`
- Importálni `useDateRange`-et a DateRangeContext-ből
- Kiszámítani, hogy a kiválasztott dátumtartomány egyetlen hónapra esik-e (`isSingleMonth`)
- Formázott periódus-stringet előállítani (pl. "2026. jan." vs "2026. jan. 1. – 2026. feb. 28.")
- Átadni `isSingleMonth` és `periodLabel` propokat a `NavSummaryTable` és `EmployeeAccordion` komponenseknek

### 2. `src/components/salaries/NavSummaryTable.tsx`
- Új propok: `isSingleMonth: boolean`, `periodLabel: string`
- Fejléc logika:
  - Ha `isSingleMonth` → "Havi bérösszesítő (NAV utalások)"
  - Ha nem → "Bérösszesítő (NAV utalások) a következő periódusra: {periodLabel}"

### 3. `src/components/salaries/EmployeeAccordion.tsx`
- Új propok: `isSingleMonth: boolean`, `periodLabel: string`
- Fejléc logika:
  - Ha `isSingleMonth` → "Dolgozói bontás (X fő)"
  - Ha nem → "Dolgozói bontás (X fő) — {periodLabel}"

### 4. `src/components/salaries/SalaryKpiCards.tsx`
- Nincs változtatás szükséges — a KPI-k már a szűrt `salaryItems` alapján számolódnak a `useSalaryData` hook-ban, tehát automatikusan a kiválasztott periódusra vonatkoznak.

## Technikai részletek

```text
Periódus-detekció logika (SalariesPage-ben):
  const { dateFrom, dateTo } = useDateRange();
  const isSingleMonth = dateFrom.getFullYear() === dateTo.getFullYear() 
                      && dateFrom.getMonth() === dateTo.getMonth();
  
  const periodLabel = isSingleMonth
    ? format(dateFrom, 'yyyy. MMM', { locale: hu })
    : `${format(dateFrom, 'yyyy. MMM d.', { locale: hu })} – ${format(dateTo, 'yyyy. MMM d.', { locale: hu })}`;
```

A dolgozói összesítés (employee grouping by `munkavallalo_neve`) már most is cross-month összesítést csinál — ha Jan-ban A,B,C van és Feb-ban A,B,C,D, a hook egyetlen csoportba gyűjti A, B, C tételeit mindkét hónapból, és D-t külön. Ez nem igényel változtatást.

