# 🔍 Keresés, Rendezés & PostgreSQL B-Tree Indexek

> **Utoljára frissítve:** 2026-07-25  
> **Kapcsolódó doksi:** [A-016: PostgreSQL Query Strategy](../../architecture/decisions/A-016-postgresql-query-strategy.md) | [GLOSSARY Index](../index.md)

---

## 📖 Fogalom Meghatározása

A szoftverfejlesztésben a **Keresés (Searching)** és **Rendezés (Sorting)** a leggyakrabban végrehajtott műveletek. Az adatok rendezettsége alapvetően meghatározza, hogy milyen gyorsan találunk meg egy elemet (pl. lineáris $O(N)$ keresés vs bináris $O(\log N)$ keresés).

Az adatbázisok (pl. PostgreSQL) speciális fa adatszerkezeteket — úgynevezett **B-Tree és B+ Tree indexeket** — használnak az adatok villámgyors keresésére és rendezett elérésére.

---

## 📊 Keresési & Rendezési Algoritmusok Összehasonlítása

| Algoritmus | Típus | Időkomplexitás (Idő) | Leírás & Működés |
|---|---|---|---|
| **Linear Search** | Keresés | $O(N)$ | Végignézi az elemeket az elsőtől az utolsóig. Lassú nagy adathalmaznál. |
| **Binary Search** | Keresés | **$O(\log N)$** | **Kizárólag rendezett adaton működik!** Mindig felezi a keresési tartományt (pl. 1,000,000 elemből max 20 lépésben megtalálja az elemet). |
| **Quick Sort / Merge Sort** | Rendezés | **$O(N \log N)$** | "Oszd meg és uralkodj" alapon működő hatékony rendező algoritmusok. |
| **PostgreSQL B-Tree Index** | DB Keresés | **$O(\log N)$** | Kiegyensúlyozott fa adatszerkezet. A levelek tartalmazzák az adatsorok mutatóit. |

---

## 🌳 Hogyan Működik a PostgreSQL B-Tree Index?

Amikor egy táblán indexet hozunk létre (`CREATE INDEX idx_invoices_company_created ON invoices (company_id, created_at)`):

```
                   [ Root Node ]
                   /           \
         [ Internal Node ]   [ Internal Node ]
          /           \       /           \
     [ Leaf ]      [ Leaf ] [ Leaf ]      [ Leaf ] ──► (Mutatók a DB lemez-blokkokra)
```

1. **Seq Scan (Sequential Scan — $O(N)$):** Ha nincs index az oszlopon, a PostgreSQL leolvassa a teljes táblát a lemezről (lassú).
2. **Index Scan ($O(\log N)$):** A PostgreSQL a B-Tree fán leszállva $O(\log N)$ lépésből megtalálja a kért elemet, és csak a pontos sorokat olvassa ki a lemezről.

---

## 💡 Best Practice Szabályok a Visibillben

1. **Összetett Indexek Sorrendje:** Index létrehozásakor a legszűkebb (legnagyobb szelektivitású) oszlop kerüljön előre (`company_id`, majd `created_at`).
2. **Adatbázis Lapozás Indexszel:** A `ORDER BY created_at DESC LIMIT 50 OFFSET 0` lekérdezés csak akkor lesz gyors, ha létezik B-Tree index a `created_at` oszlopon.
