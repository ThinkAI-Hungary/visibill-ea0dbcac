# ⚡ Caching Stratégiák, Eviction & Cache Stampede

> **Utoljára frissítve:** 2026-07-25  
> **Kapcsolódó doksi:** [A-014: React Query Cache Architecture](../../architecture/decisions/A-014-react-query-cache.md) | [GLOSSARY Index](../index.md)

---

## 📖 Fogalom Meghatározása

A **Caching (Adatgyorsítótárazás)** az a teljesítmény-optimalizálási folyamat, amellyel a gyakran olvasott adatokat egy nagy sebességű, de korlátozott kapacitású tárhelyre (RAM / In-Memory Cache) mentjük el, kiváltva a lassabb lemezes vagy hálózati lekérdezéseket (Adatbázis / Külső API).

---

## 🔄 Caching Minta-Típusok (Caching Patterns)

| Minta | Működési Elv | Előnyök & Hátrányok | Használata a Visibillben |
|---|---|---|---|
| **Cache-Aside (Lazy Loading)** | Az alkalmazás először a cache-t kérdezi le. Ha van adat (Cache Hit), visszaadja. Ha nincs (Cache Miss), kiolvassa az DB-ből, elmenti a cache-be, majd válaszol. | **Rugalmas, csak a használt adat mentődik.** Cache miss esetén az első lekérdezés lassabb. | **React Query** a frontend oldalon, `management-stats` adatok. |
| **Write-Through** | A rendszer az adatot egyszerre írja be a cache-be ÉS a fő adatbázisba. | A cache mindig 100%-ban friss adatot tartalmaz. Az írási idő kicsit lassabb. | Profil és cégbeállítások frissítésekor. |
| **Write-Back (Write-Behind)** | Az adat beíródik a gyors cache-be, és az alkalmazás azonnal válaszol. A cache aszinkron módon, később szinkronizál a lemezes DB-be. | **Ultragyors írási sebesség.** Kockázat: szerverleálláskor a nem szinkronizált adatok elveszhetnek. | Nagy sebességű számlálóknál és log-aggregációknál. |

---

## 🗑️ Cache Kiürítési Politikák (Eviction Policies)

Amikor a gyorsítótár eléri a memórialimitét, fel kell szabadítani helyet az új adatoknak:

1. **LRU (Least Recently Used):** A legrégebben használt (legritkábban elért) elemet törli a memóriából. (Legnépszerűbb általános politika).
2. **LFU (Least Frequently Used):** Az összesen legkevesebb alkalommal meghívott elemet törli.
3. **TTL (Time-To-Live):** Minden elemhez fix lejárati idő tartozik (pl. `staleTime: 60_000` — 60 másodperc után az adat elévül).

---

## 💥 A "Cache Stampede" (Thundering Herd) Probléma & Megoldása

### A Jelenség:
Amikor egy kiemelten népszerű, drága adatbázis-lekérdezés cache kulcsa **pontosan ugyanabban a milliszekundumban jár le**, és 10,000 egyidejű felhasználó mind megpróbálja újra-generálni az adatot a DB-ből. Ez az adatbázis azonnali összeomlásához (CPU 100%) és timeout-okhoz vezet.

```
                  ┌──► Kérés 1 (Cache Miss) ──┐
                  ├──► Kérés 2 (Cache Miss) ──┼──► [ 10,000 Párhuzamos DB Query ] ──► 💥 Adatbázis Összeomlás
10,000 Kérés ────►├──► Kérés 3 (Cache Miss) ──┤
                  └──► Kérés N (Cache Miss) ──┘
```

### Megoldások:
1. **Mutex / Distributed Lock:** Az első kliens elhelyez egy zárat (Lock-ot); a többiek megvárják, amíg az első kliens újra-generálja a cache-t.
2. **Probabilistic Early Expiration (XFetch):** A lejárati idő előtt a rendszer valószínűségi alapon már a háttérben elindítja a cache frissítését, megelőzve az üres járatot.
