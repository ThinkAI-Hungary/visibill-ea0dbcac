

# Query key invalidáció javítása a LiveNotificationProvider-ben

## Probléma
A `showNotification` függvényben (52. sor) a cache invalidáció `queryKey: [key]` formátumot használ, ami nem egyezik az alkalmazás többi részével (`useRealtimeInvalidation`, `queryKeys.ts`), ahol a kulcsok `[key, companyId]` formátumúak. Emiatt az invalidáció nem találja meg a tényleges cache bejegyzéseket.

## Javítás
`src/components/LiveNotificationProvider.tsx` — egyetlen módosítás:

- 51–53. sor: `queryClient.invalidateQueries({ queryKey: [key] })` → `queryClient.invalidateQueries({ queryKey: [key, companyId] })`
- A `showNotification` callback dependency listájába és paraméterei közé fel kell venni a `companyId`-t, vagy a closure-ből kell olvasnia (jelenleg a `companyId` elérhető a komponens scope-ból, de a `useCallback` deps-ből hiányzik — ezt is pótolni kell)

Összesen ~3 sor változás.

