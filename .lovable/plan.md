

## Probléma: Cégváltás nem működik

### Okok azonosítása

A korábbi audit során bevezettem egy atomi tartalom-újrarenderelést az `AppLayout.tsx`-ben:

```tsx
<div key={selectedCompany?.id ?? 'no-company'} className="h-full">
  <Suspense fallback={<ContentSkeleton />}>
    {children || <Outlet />}
  </Suspense>
</div>
```

Ez azonban ütközik a `ScopedLayout.tsx` URL ↔ Context szinkronizációval. Mi történik most cégváltáskor:

1. Felhasználó a `CompanySelector`-ban másik céget választ → `setSelectedCompany(B)` fut
2. `AppLayout` újrarendereli a tartalmat új `key`-vel → **a teljes Outlet subtree unmount**
3. A `ScopedLayout` is unmountol (mert az Outlet alatt van)
4. Az `useEffect` Context → URL szinkron a `ScopedLayout`-ban **soha nem fut le**, mert mire elindulna, már unmountolt
5. Az új `ScopedLayout` mountol, de az URL még a régi cég ID-jét tartalmazza
6. URL → Context szinkron látja, hogy `urlCompanyId !== selectedCompany.id`, és mivel a régi ID még a `companies` tömbben van → **visszaállítja a régi céget!**
7. Eredmény: a kiválasztott cég vissza-vált az eredetire, vagy az UI lefagy egy "köztes" állapotban

### Másik kapcsolódó probléma

A `ScopedLayout` URL → Context syncje a `companies.find(c => c.id === urlCompanyId)`-t használja. Ha a felhasználó egy új céget választ, ami nincs az URL-ben, a `setSelectedCompany` lefut, de a `ScopedLayout` `useEffect`-je (Context → URL) az unmount miatt nem tudja átírni az URL-t → race condition.

### Javítási terv (1 fájl)

**`src/components/AppLayout.tsx`** — a `key` legyen az URL `companyId`, ne a Context `selectedCompany.id`

A `key` jelenleg a Context-ből származik, ami azonnal változik (sync), de az URL csak a `useEffect` után. Két megoldás közül választok:

**A megoldás (preferált):** Vegyük le a `key`-t az Outlet-ről. Az atomic remount eredetileg a "fél-régi/fél-új render" elkerülésére szolgált, de:
- A TanStack Query `multi-tenancy-reactivity` invalidáció már garantálja, hogy minden query újrafut új `companyId`-vel
- A `keepPreviousData` mintát szándékosan használjuk a flicker elkerülésére
- Az atomic remount **megakadályozza** a `ScopedLayout` URL frissítését

**B megoldás (ha az atomic remount mégis kell):** A `key` legyen az URL companyId paraméter, és a `ScopedLayout` Context → URL szinkronja menjen át egy magasabb szintű komponensbe (pl. `ProtectedLayout`), ami nem unmountol cégváltáskor.

### Javasolt megoldás: A változat

Eltávolítom a `key={selectedCompany?.id}` wrapper div-et az `AppLayout`-ból. A multi-tenancy reactivity (query invalidáció + `companyId` minden query keyben) már atomic módon kezeli a cégváltást, atomic remount nélkül is.

```tsx
// AppLayout.tsx — csak Suspense, nincs key
<main className="...">
  <Suspense fallback={<ContentSkeleton />}>
    {children || <Outlet />}
  </Suspense>
</main>
```

### Eredmény

- Cégváltáskor a `ScopedLayout` mountolva marad → a Context → URL `useEffect` lefut → URL frissül → `[/${newCompanyId}/${dateRange}/...]`
- A query invalidáció továbbra is biztosítja, hogy minden adat az új céghez tartozzon
- `keepPreviousData` adja a flicker-mentes átmenetet
- Sidebar továbbra sem mountol újra (változatlan)

### Hatókör

- Csak `src/components/AppLayout.tsx` (1 sor)
- Nincs DB / RLS / Edge Function változás
- Nincs context-, route- vagy hook-módosítás

