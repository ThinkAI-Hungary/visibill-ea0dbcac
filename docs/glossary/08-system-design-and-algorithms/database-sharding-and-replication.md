# 🗄️ Database Sharding, Partitioning & Replication

> **Utoljára frissítve:** 2026-07-25  
> **Kapcsolódó doksi:** [Supabase Platform](../06-infrastructure-and-devops/supabase-platform.md) | [GLOSSARY Index](../index.md)

---

## 📖 Fogalom Meghatározása

Ahogy egy alkalmazás adatai elérik a több száz gigabájtot vagy terabájtot, egyetlen adatbázis-szerver már nem képes kiszolgálni a terhelést. Az adatbázis-skálázás három fő pillére:
1. **Vertical Scaling (Függőleges Skálázás):** Erősebb szerver vásárlása (több CPU/RAM). Korlátozott és drága.
2. **Replication (Replikáció):** Az adatok másolása több szerverre olvasási terheléselosztáshoz (Master-Slave / Primary-Replica).
3. **Sharding / Partitioning (Particionálás):** Az adatok szétdarabolása több független adatbázis-csomópont (Shard) között.

---

## 🔑 A 3 Adatbázis Skálázási Stratégia

### 1. Read Replicas (Olvasási Másolatok)
Az írási műveletek (`INSERT`, `UPDATE`, `DELETE`) kizárólag az elsődleges **Primary (Master)** adatbázisba mennek. Az olvasási műveletek (`SELECT`) eloszlanak egy vagy több **Read Replica (Slave)** szerver között.

```
                  ┌──► Read Replica 1 (SELECT)
                  ├──► Read Replica 2 (SELECT)
[ React Client ] ─┼──► Read Replica 3 (SELECT)
                  │
                  └──► Primary DB (INSERT / UPDATE)
```

### 2. Sharding (Horizontal Partitioning — Vízszintes Partícionálás)
A táblák sorait egy **Shard Key (Particionálási Kulcs)** alapján osztjuk fel különböző fizikailag elkülönülő adatbázisokba.
- Például a Visibillben a Shard Key lehet a `company_id`. Az A-K kezdőbetűs cégek adatai a Shard 1-re, L-Z cégek a Shard 2-re kerülnek.

### 3. Consistent Hashing (Konzisztens Hashelés)
Elosztott hálózatokban (pl. queue-k vagy adatbázis node-ok között) használt hashing algoritmus. Biztosítja, hogy ha egy új szervert adunk a rendszerhez, a meglévő kulcsoknak csak a töredékét ($1/N$) kell újra-osztani a teljes adatbázis átrendezése nélkül.

---

## 💡 Alkalmazás a Visibill Architektúrában

- **Multi-Project Architektúra:** A Visibill jelenleg 3 dedikált Supabase projekttel (`PROD`, `VSWEB`, `THINKERMAN`) működik — ez az adatbázis-particionálás (Sharding) egy formája.
- **Szerver oldali RPC-k:** A `management-stats` Edge Function a Read Replicák és a 3 projekt párhuzamos lekérdezésével ad teljes platformáttekintést.
