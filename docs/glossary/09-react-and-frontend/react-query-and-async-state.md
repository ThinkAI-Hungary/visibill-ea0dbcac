# 🔄 Szerver Állapot & TanStack React Query (`useQuery`, `useMutation`)

> **Utoljára frissítve:** 2026-07-25  
> **Kapcsolódó doksi:** [A-014: React Query Cache Architecture](../../architecture/decisions/A-014-react-query-cache.md) | [GLOSSARY Index](../index.md)

---

## 📖 Mozaikszavak Kibontása & Definíciók

| Mozaikszó | Teljes Angol Név | Magyar Jelentés & Tanítói Magyarázat |
|---|---|---|
| **API** | **Application Programming Interface** | **Alkalmazásprogramozási Interfész:** Szoftverek közötti kommunikációs kapu (pl. a React frontend és a Supabase Edge Function közötti HTTP kapcsolat). |
| **HTTP** | **Hypertext Transfer Protocol** | **Ultraszöveg Áviteli Protokoll:** Az internetes kérések és válaszok (`GET`, `POST`, `PUT`, `DELETE`) alapvető hálózati kommunikációs szabályzata. |
| **JSON** | **JavaScript Object Notation** | **JavaScript Objektum Jelölés:** Szöveges adatformátum, amelyet az adatok kliens és szerver közötti cseréjére használunk. |

---

## 💡 Kliens Állapot vs. Szerver Állapot (Server State)

A React alkalmazásokban két teljesen eltérő állapot-típust kell megkülönböztetnünk:

1. **Kliens Állapot (Client State):** A felhasználói felület belső állapotai (pl. nyitva van-e a sidebar, milyen tab van kiválasztva, mit gépelt be az inputba). Ezt a sima `useState` kezeli.
2. **Szerver Állapot (Server State):** Az adatbázisban tárolt adatok (pl. számlák, partnerek listája, hiba-logok). A szerver adat **aszinkron**, a távolban él, más felhasználók is módosíthatják, és könnyen elavulhat (stale data).

### Miért nem való a Szerver Állapot sima `useState` + `useEffect`-be?
A sima `useEffect` + `fetch` megközelítéssel kézzel kellene kezelni a töltési állapotot (`isLoading`), a hibakezelést (`isError`), az újrabumpolást, a deduping-ot és a memóriából való törlést. Ezt a feladatot a **TanStack React Query** könyvtár automatizálja!

---

## 🔑 Az 2 Fő React Query Hook

---

### 1. `useQuery` — Adatlekérdezés & Cache-elés

A `useQuery` felelős az adatok lekéréséért, automatikus memóriában tartásáért (caching) és frissítéséért.

```tsx
// Példa a Visibill Management Dashboard-ról:
const { data, isLoading, isFetching, refetch } = useQuery({
  queryKey: ['management-overview'], // 1. Egyedi Cache Kulcs
  queryFn: () => fetchManagementStats('overview'), // 2. Lekérdező Async Függvény
  staleTime: 30_000, // 3. 30 másodpercig az adat frissnek számít (nincs felesleges háttér-refetch)
  refetchInterval: 60_000, // 4. Auto-refresh 60 másodpercenként
});
```

#### 💡 `staleTime` vs. `gcTime` (korábban `cacheTime`):
- **`staleTime` (Elévülési idő):** Milyen hosszan számít az adat frissnek. Amíg a staleTime nem telt le, a React Query **nem indít háttér-lekérdezést** az komponens újbóli megnyitásakor.
- **`gcTime` (Garbage Collection Time — Szemétgyűjtési idő):** Milyen hosszan őrzi meg a React Query a memóriában az adatot a komponens bezárása (unmount) után, mielőtt végleg törölné.

---

### 2. `useMutation` — Adatmódosítás & Cache Invalidation

A `useMutation` felelős az adatbázis módosításokért (`CREATE`, `UPDATE`, `DELETE`).

Módosítás után az adatbázis megváltozott, ezért a kliens oldali cache-t **érvényteleníteni kell (Cache Invalidation)**, hogy a felület automatikusan letöltse a friss számlákat!

```tsx
// Példa Visibill Mutation-re (Hibatörlés):
const queryClient = useQueryClient();

const deleteErrorMutation = useMutation({
  mutationFn: (errorIds: string[]) => deleteAppErrors(errorIds),
  onSuccess: () => {
    // 💡 CACHE INVALIDATION: Jelzi a React Query-nek, hogy a 'management-errors' cache elavult!
    // Ez azonnal kiváltja a felület automatikus újra-lekérdezését (Refetch)!
    queryClient.invalidateQueries({ queryKey: ['management-errors'] });
    toast.success("Hibák sikeresen törölve!");
  },
});
```

---

## ⚡ Optimista Frissítés (Optimistic Updates)

Az **Optimista Frissítés (Optimistic Update)** során a felhasználói felület **azonnal úgy viselkedik, mintha a szerver-oldali módosítás már sikeresen lefutott volna** (pl. a törölt számla azonnal eltűnik a képernyőről gombnyomáskor), anélkül, hogy megvárná a hálózati választ. Ha a szerver mégis hibát dobna, a React Query automatikusan visszagörgeti (rollback) az eredeti állapotot.
