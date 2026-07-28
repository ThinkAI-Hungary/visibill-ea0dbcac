# 🐘 PostgreSQL — A Relációs Adatbázismotor

> **Utoljára frissítve:** 2026-07-25  
> **Kapcsolódó doksi:** [Supabase Platform](../06-infrastructure-and-devops/supabase-platform.md) | [database-schema.md](../../architecture/database-schema.md) | [GLOSSARY Index](../index.md)

---

## 📖 Mozaikszavak Kibontása & Definíciók

| Mozaikszó | Teljes Angol Név | Magyar Jelentés & Tanítói Magyarázat |
|---|---|---|
| **RDBMS** | **Relational Database Management System** | **Relációs Adatbázis-kezelő Rendszer:** Olyan adatbázis, amely az adatokat egymással kapcsolatban álló táblákba (sorok és oszlopok) szervezi. |
| **SQL** | **Structured Query Language** | **Strukturált Lekérdező Nyelv:** A relációs adatbázisok lekérdezésére és módosítására használt szabványos nyelv. |
| **ACID** | **Atomicity, Consistency, Isolation, Durability** | **Atomicitás, Konzisztencia, Izoláció, Tartósság:** Az adatbázis-tranzakciók megbízhatóságát garantáló 4 alapvető tulajdonság. |
| **WAL** | **Write-Ahead Logging** | **Előreírt Naplózás:** Olyan lemezes naplózási eljárás, amely garantálja, hogy áramszünet esetén sem vesznek el a már visszaigazolt adatok. |
| **MVCC** | **Multi-Version Concurrency Control** | **Többverziós Párhuzamosság Kezelés:** Olyan zárásmentes architektúra, amely lehetővé teszi, hogy az olvasások soha ne blokkolják az írásokat. |
| **JSONB** | **Binary JSON** | **Bináris JSON Adattípus:** Strukturálatlan adatok hatékony, indexelhető formában történő tárolása a PostgreSQL-ben. |

---

## 🏛️ 1. Mi a PostgreSQL (Postgres)?

A **PostgreSQL** a világ legfejlettebb, nyílt forráskódú objektum-relációs adatbázis-rendszere. Több mint 35 éves aktív fejlesztési múlttal rendelkezik, és híres a kiemelkedő megbízhatóságáról, adat-integritásáról és bővíthetőségéről.

A Visibill backendjének magját a PostgreSQL képezi (a Supabase platformon keresztül).

---

## 🔒 2. Az ACID Garanciák (A Tranzakciók 4 Pillére)

A PostgreSQL 100%-ban megfelel az **ACID** követelményeknek. Egy tranzakció (`BEGIN ... COMMIT`) során az alábbi garanciákat nyújtja:

```
           ┌─────────────────────────────────────────┐
           │         ACID Tranzakciós Garancia      │
           └────────────────────┬────────────────────┘
                                │
   ┌────────────────┬───────────┴───────────┬────────────────┐
   ▼                ▼                       ▼                ▼
Atomicitás     Konzisztencia            Izoláció        Tartósság
(Atomicity)    (Consistency)           (Isolation)     (Durability)
 Minden vagy    Séma & FK               Párhuzamos      WAL napló
   semmi        szabályok                zárásmentes     lemezen
```

1. **Atomicitás (Atomicity — "Minden vagy semmi"):**  
   Ha egy tranzakció 5 SQL utasításból áll, és a 4. hibára fut, az egész tranzakció visszagördül (**ROLLBACK**). Nem fordulhat elő olyan félig-kész állapot, hogy a számla bekerül a DB-be, de az áfa összege elmarad!

2. **Konzisztencia (Consistency):**  
   Az adatbázis csak olyan állapotba kerülhet, amely megfelel az összes deklarált szabálynak (Foreign Key megszorítások, `NOT NULL`, `CHECK` feltételek).

3. **Izoláció (Isolation — MVCC):**  
   A párhuzamosan futó tranzakciók nem zavarják egymást. A PostgreSQL **MVCC (Multi-Version Concurrency Control)** architektúrát használ: módosításkor nem zárja le az egész táblát, hanem új sormásolatot hoz létre, így az olvasások (SELECT) soha nem blokkolják az írásokat!

4. **Tartósság (Durability — WAL):**  
   Amint a PostgreSQL visszaigazol egy tranzakciót (`COMMIT`), az adat garantáltan lementődik a **WAL (Write-Ahead Logging)** lemezes naplóba. Ha a szerverből abban a pillanatban kihúzzák a tápkábelt, az adatok az újraindulás után hiánytalanul helyreállnak.

---

## ⚡ 3. Hibrid Relációs + NoSQL képességek (JSONB)

A PostgreSQL nem csak relációs táblákat, hanem **NoSQL dokumentum-tárolást (JSONB)** is támogat. 

- **Sima JSON vs. JSONB:** A sima JSON szövegként tárolódik (lassú parszolás), míg a **JSONB** kódolt bináris formában.
- **GIN Indexing:** A JSONB mezők belső kulcsaira **GIN (Generalized Inverted Index)** index hozható létre, így a dokumentumon belüli mély kerestetés is $O(\log N)$ sebességű!

---

## 🔌 4. Extensions (Bővítmények)

A PostgreSQL legfőbb ereje a bővíthetőségében rejlik. A Visibillben használt legfontosabb bővítmények:

| Bővítmény | Funkció a Visibillben |
|---|---|
| **`pgmq`** | Adatbázis-natív aszinkron üzenetsor a Python worker számára. |
| **`pgcrypto`** | Kriptográfiai titkosító függvények (AES-256 jelszótitkosítás a Vault-ban). |
| **`pg_trgm`** | Trigram alapú fuzzy keresés (fuzzy partner és számlaszám kereséshez). |
| **`vector` (pgvector)** | Vektormásolási és embedding keresési funkciók AI alapú dokumentum-hasonlósághoz. |

---

## 💡 Használat & Szerep a Visibillben

1. **Magas Táblaszám:** ~155 relációs tábla, 79+ tárolt eljárás (RPC) és komplex DB triggerek.
2. **Multi-Project Hálózat:** 3 elkülönített PostgreSQL adatbázis (`PROD`, `VSWEB`, `THINKERMAN`).
3. **Realtime WAL Streaming:** A Supabase Realtime szolgáltatása a PostgreSQL **WAL (Write-Ahead Log)** módosításait olvassa be, és közvetíti a böngésző felé WebSocket csatornán.
