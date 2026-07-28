# ⚡ Supabase — Backend-as-a-Service (BaaS) Platform

> **Utoljára frissítve:** 2026-07-25  
> **Kapcsolódó doksi:** [A-002: Supabase BaaS Architecture](../../architecture/decisions/A-002-supabase-baas.md) | [GLOSSARY Index](../index.md)

---

## 📖 Fogalom Meghatározása

A **Supabase** egy nyílt forráskódú **Backend-as-a-Service (BaaS)** platform, amelyet a Firebase nyílt alternatívájaként hoztak létre. A Supabase magját a **PostgreSQL adatbázis** képezi, amely köré a platform automatikusan biztosít autentikációt, adatbázis-szintű biztonságot (RLS), REST és Realtime API-kat, fájltárolást (Storage), szervermentes funkciókat (Edge Functions) és üzenetsorokat (PGMQ).

A Visibill teljes backend infrastruktúrája a Supabase platformra épül.

---

## 🔑 Főbb Supabase Szolgáltatások a Visibillben

| Szolgáltatás | Mire használjuk a Visibillben? | Részletes Doksi |
|---|---|---|
| **PostgreSQL Database** | Relációs adatbázis ~155 táblával, SQL RPC tárolt eljárásokkal és triggerekkel. | [database-schema.md](../../architecture/database-schema.md) |
| **Supabase Auth** | Felhasználói regisztráció, belépés, JWT token kezelés és 7-szintű RBAC szerepkörök (`profiles.role`). | [A-009: Auth RBAC](../../architecture/decisions/A-009-auth-rbac.md) |
| **Row Level Security (RLS)** | Multi-tenancy cégizoláció az adatbázis szintjén. | [RLS Glossary](../02-security-and-compliance/rls-row-level-security.md) |
| **Edge Functions (Deno)** | Szervermentes backend funkciók (`management-stats`, `send-email`, `nav-sync`). | [EF Glossary](../07-frameworks-and-runtimes/ef-edge-functions.md) |
| **Supabase Storage** | Számlák, bankkivonatok, jelentések és csatolmányok biztonságos tárolása (S3 kompatibilis). | [AWS S3 Glossary](./aws-s3-object-storage.md) |
| **PGMQ Extension** | Adatbázis-natív aszinkron üzenetsorok a Python worker számára. | [PGMQ Glossary](../04-communication-and-messaging/pgmq-message-queues.md) |
| **PostgREST API** | Automatikus, biztonságos REST API generálás a PostgreSQL sémából a frontend felé. | [RPC Glossary](../03-database-and-backend/rpc-remote-procedure-call.md) |
| **Supabase CLI** | Parancssori eszköz migrációk kezelésére (`supabase migration`), edge function deploy-ra és típusgenerálásra (`generate_typescript_types`). | — |

---

## 🌐 Multi-Project Struktúra a Visibillben

A Visibill nem egyetlen Supabase projekttel működik, hanem **3 elkülönített Supabase projektet** kezel:

1. **`PROD` (`vxxgvdlqvvchtlmqnrqf`):** A fő éles környezet az eaisyBill és eaisyBooks ügyfelek adataival.
2. **`VSWEB`:** Dedikált projekt a VS Web integrációs adatok számára.
3. **`THINKERMAN`:** Dedikált projekt a Thinkerman integráció számára.

A Management Dashboard és a Python worker konténerek mindhárom Supabase projektet párhuzamosan tudják monitorozni és kezelni.
