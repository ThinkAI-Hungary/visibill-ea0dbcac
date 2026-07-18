# A-040: Multi-Tab Auth Flow Isolation (2026-07-18)

**Status:** Decided  
**Date:** 2026-07-18  
**Utoljára frissítve:** 2026-07-18

## Context

A felhasználók gyakran több böngészőlapon (multi-tab) nyitják meg az alkalmazást. A jelszó-helyreállítási (password recovery) és bejelentkezési folyamatok során ez az alábbi problémákhoz vezetett:

1. **Nem kívánt háttérbeli bejelentkeztetés**: Ha a felhasználó a **Tab A**-n kezdeményezte a helyreállítást, majd a **Tab B**-n (az emailben kapott linken keresztül) megváltoztatta a jelszavát és belépett, a Supabase automatikus localStorage-alapú session szinkronizációja miatt a **Tab A** háttérfül is automatikusan bejelentkezett és átirányított a dashboardra.
2. **Biztonsági határvonalak megsértése**: Iparági standardok szerint jelszóváltoztatás után a háttérben lévő füleknek nem szabadna hozzáférést kapniuk a munkamenethez explicit felhasználói interakció (pl. manuális bejelentkezés vagy lapfrissítés) nélkül.
3. **Háttérfül Throttling & Versenyhelyzet**: A modern böngészők a háttérben lévő fülek JavaScript végrehajtását és React újrarendereléseit erősen lassítják (throttling). Emiatt a sima localStorage flagek és időzítők (timeoutok) a háttérben nem futnak le időben, ami versenyhelyzetekhez és hibás átirányításokhoz vezetett.
4. **Többszörös renderelés (React Query, Carousel)**: A bejelentkező oldalon lévő háttér-lekérdezések (pl. profil adatok betöltése a `hasEaisybillAccess` frissülésével) és az automatikusan forgó carousel miatt az `Auth.tsx` auto-navigate useEffect-je többször is újrarenderelődött, korán felemésztve az egyszer használatos tiltó flageket.

---

## Döntések

### 1. Böngésző-szintű szinkron szinkronizáció-detektálás
A Supabase kliens automatikus session szinkronizációját a böngésző szinkron `storage` eseményével csípjük el. Ez a háttérfül throttlingtól függetlenül, azonnal végrehajtódik.

Ha a `storage` eseményben azt látjuk, hogy a Supabase auth token kulcsa (`-auth-token`) megváltozott (új session került beírásra a másik fülen), akkor a háttérfül a saját fül-specifikus `sessionStorage` tárolójába felír egy tiltást:
```typescript
sessionStorage.setItem('visibill_session_synced_from_elsewhere', 'true')
```

### 2. A tiltás elszigetelése (sessionStorage)
Mivel a `sessionStorage` szigorúan fül-specifikus, a tiltó flag garantáltan csak a háttérfüleken jön létre, az aktív munkavégző fülön (ahol a felhasználó a jelszót ténylegesen átírta) nem. Így a kezdeményező fül zökkenőmentesen beléphet a dashboardra, miközben a többi fül blokkolva marad.

### 3. Időzítők helyett Életciklus-alapú flag-kezelés
Az `Auth.tsx` oldalon lévő auto-navigate useEffect lekérdezi ezt a flaget:
* Ha a flag `true`, a háttérfül **blokkolja az auto-redirectet**, és stabilan az `/auth` oldalon marad.
* A flag **nem törlődik** a useEffect lefutása közben, így a carousel pörgések és profil lekérdezések (React Query) miatti többszörös újrarenderelések sem tudják idő előtt felemészteni a tiltást.

### 4. Lapfrissítés (F5) támogatása
A tiltó flaget az alkalmazás mountolásakor (inicializálásakor), a `AuthContext` mount useEffect-jének a legelején töröljük:
```typescript
try {
  sessionStorage.removeItem('visibill_session_synced_from_elsewhere');
} catch {}
```
* **Eredmény**: Ha a felhasználó explicit módon frissíti a háttérfület (F5), az alkalmazás újraindul, a flag törlődik, és a meglévő, érvényes session-nel a Tab A is sikeresen belép a dashboardra.
* Ha nem frissít, a Tab A stabilan a bejelentkező oldalon várakozik.

---

## Érintett Fájlok

| Fájl | Változás |
|------|---------|
| `src/contexts/AuthContext.tsx` | sessionSynced flag törlése mountkor; `handleStorageChange` frissítése az auth-token változások detektálására. |
| `src/pages/Auth.tsx` | Auto-navigate useEffect frissítése a `visibill_session_synced_from_elsewhere` flag ellenőrzésére. |

---

## Kapcsolódó

- [A-021: Email Auth Flow Redesign](./A-021-email-auth-flow-redesign.md)
- [A-035: Three-Way Fallback Redirection](./A-035-three-way-fallback-redirection.md)
