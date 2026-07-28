# 📬 PGMQ — Message Queues (Adatbázis-Natív Üzenetsorok)

> **Utoljára frissítve:** 2026-07-25  
> **Kapcsolódó doksi:** [A-004: PGMQ Queue Architecture](../../architecture/decisions/A-004-pgmq-queue.md) | [GLOSSARY Index](../index.md)

---

## 📖 Fogalom Meghatározása

A **PGMQ (PostgreSQL Message Queue)** egy PostgreSQL bővítmény (extension), amely üzenetsor (message queue) funkciót biztosít közvetlenül a Supabase adatbázison belül. 

Kiváltja a külső message broker rendszereket (pl. RabbitMQ, Redis BullMQ, SQS), így az üzenetek, a tranzakciók és az üzleti adatok ugyanabban az adatbázisban élnek.

---

## 🏗️ Hogyan működik a Visibillben?

1. **Trigger / EF Enqueue:** Egy fájl feltöltésekor (pl. e-mailen vagy UI-on) egy DB trigger vagy Edge Function beszúr egy feladatot a megfelelő PGMQ queue-ba.
2. **Worker Reading:** A Python worker folyamatosan pollolja a queue-t `pgmq.read()` segítségével.
3. **Visibility Timeout (VT):** Olvasáskor az üzenet egy meghatározott időre (VT) láthatatlanná válik a többi worker számára.
4. **Archive / Delete:** Sikeres feldolgozás után a worker törli az üzenetet (`pgmq.delete()`). Hiba esetén a VT lejárta után az üzenet automatikusan újra láthatóvá válik és újrapróbálkozik.

---

## 📊 Queue Katalógus és Visibility Timeout-ok

| Queue Név | VT (sec) | Csatorna / Pipeline | Leírás & Feladat |
|---|---|---|---|
| **`invoice_jobs`** | 600 (10 perc) | Számlák & Bérjegyzékek | OCR olvasás, mezőkinyerés, AI klasszifikáció. |
| **`transaction_jobs`** | 300 (5 perc) | Banktranzakciók | Kivonat parszolás, tételkategorizálás. |
| **`gl_classification_jobs`** | 900 (15 perc) | Főkönyv | Tömeges főkönyvi számlaszám besorolás. |
| **`report_jobs`** | 300 (5 perc) | Futárjelentések | WizzAir, Wolt, Bolt elszámolás matching. |
| **`pdf_export_jobs`** | 300 (5 perc) | Export | Nyomtatható PDF / riport generálás. |

---

## 💡 Fő előnyök a Visibill architektúrában

- **Tranzakciós garancia:** Egy DB rekord mentése és a PGMQ üzenet feladása egyetlen atomi adatbázis-tranzakcióban lefuttatható.
- **Nulla infrastruktúra-költség:** Nem kell külön Redis/RabbitMQ szervert üzemeltetni és monitorozni.
- **Management Dashboard integráció:** A Management Dashboard közvetlenül az adatbázisból kérdezi le a várakozó queue hosszokat (`pgmq.metrics_all()`).
