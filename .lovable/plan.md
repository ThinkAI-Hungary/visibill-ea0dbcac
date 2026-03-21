

# Bér fájlok lekérdezése csak kattintásra

## Probléma
A `SalaryFilesDialog` komponens a `useQuery`-t `enabled: !!companyId` feltétellel használja, ami az oldal betöltésekor azonnal lefut. A query-nek csak akkor kellene futnia, amikor a felhasználó megnyitja a dialogot.

## Megoldás
`src/components/salaries/SalaryFilesTable.tsx` módosítása:

1. A `Dialog` komponenst kontrolláltra alakítani (`open` + `onOpenChange` state)
2. Egy `isOpen` state bevezetése
3. Mindkét query `enabled` feltételébe bekötni: `enabled: !!companyId && isOpen`
4. A `DialogTrigger` helyett a gomb `onClick`-jével nyitni a dialogot

Ez biztosítja, hogy a salary_files és company_members_profiles query-k csak a dialog megnyitásakor indulnak el.
