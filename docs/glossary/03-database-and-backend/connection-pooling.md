# 🏊 Connection Pooling (Adatbázis Kapcsolati Pool)

> **Utoljára frissítve:** 2026-07-25  
> **Kapcsolódó doksi:** [RPC Glossary](./rpc-remote-procedure-call.md) | [Supabase Platform](../06-infrastructure-and-devops/supabase-platform.md) | [GLOSSARY Index](../index.md)

---

## 📖 Fogalom Meghatározása

A **Connection Pooling (Adatbázis Kapcsolati Pool)** egy olyan teljesítmény-optimalizálási technika, amely során az alkalmazás nem hoz létre minden egyes adatbázis-lekérdezéshez külön új TCP/SQL kapcsolatot, hanem **újrahasznosítja a már előre megnyitott adatbázis-kapcsolatok gyűjteményét (pool)**.

Új hálózati kapcsolat kiépítése és a TLS/Auth kézfogás lassú és memóriatartalmas. A Connection Pooler (pl. **Supavisor** vagy **PgBouncer**) kezeli a csatlakozásokat a kliensek és a PostgreSQL szerver között.

---

## ⚙️ Pooler Módok (Transaction vs Session Mode)

| Mód | Működési Elv | Használati Eset | Visibill Szempontból |
|---|---|---|---|
| **Transaction Mode (Ajánlott)** | A pooler csak a tranzakció idejére (pl. egyetlen `SELECT` vagy `RPC` hívás) rendel hozzá egy valódi DB kapcsolatot a klienshez. Amint a tranzakció véget ér, a kapcsolat visszakerül a pool-ba. | **Edge Function-ök, Szervermentes kódok.** | Támogatja a több ezer egyidejű serverless kérést kis memóriahasználat mellett (port `6543`). |
| **Session Mode** | A pooler a teljes kliens munkamenet idejére lefoglalja a DB kapcsolatot. | Hagyományos hosszú életű szerverek, direkt SQL migrálások. | Nem skálázódik jól szervermentes kódból (port `5432`). |

---

## 💡 Használat a Visibillben

1. **Edge Function-ök (Serverless Pooling):**  
   Az Edge Function-ök rövidek, és egyszerre százával futhatnak. A Supabase Supavisor Connection Poolerén keresztül csatlakoznak a PostgreSQL adatbázishoz, megakadályozva a PostgreSQL *"too many clients"* hibáját.

2. **Python Worker (Async Connection Pool):**  
   A Python worker a `supabase-py` és `postgrest-py` könyvtárakon keresztül tart fenn aszinkron HTTP/SQL kapcsolat-poolt, megelőzve az újrakiépítési késleltetést.
