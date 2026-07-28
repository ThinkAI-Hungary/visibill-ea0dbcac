# ⚡ Event-Driven Architecture (Eseményvezérelt Architektúra)

> **Utoljára frissítve:** 2026-07-25  
> **Kapcsolódó doksi:** [A-004: PGMQ Queue Architecture](../../architecture/decisions/A-004-pgmq-queue.md) | [GLOSSARY Index](../index.md)

---

## 📖 Fogalom Meghatározása

A **Event-Driven Architecture (EDA / Eseményvezérelt Architektúra)** egy olyan szoftvertervezési paradigma, amelyben a komponensek közötti kommunikáció **események (Events)** előállításán (Publish / Producer), továbbításán (Queue / Broker) és reagálásán (Subscribe / Consumer) alapul.

A hagyományos szinkron kérés-válasz (Request-Response) kapcsolattal ellentétben az eseményvezérelt komponensek **laza csatolásúak (loosely coupled)**: a küldő nem várja meg szinkronban a feldolgozás végét, így a rendszer sokkal jobban skálázható és hibatűrőbb.

---

## 🏗️ Az Esemény-Adatáramlás Láncolata a Visibillben

```
 ┌────────────────┐         ┌────────────────┐         ┌────────────────┐
 │ 1. Esemény     │         │ 2. Enqueue     │         │ 3. Aszinkron   │
 │ Kivetítés      │         │ (Üzenetsor)    │         │ Feldolgozás    │
 │                │         │                │         │                │
 │ Mailgun / UI   ├────────►│ PostgreSQL     ├────────►│ Python Worker  │
 │ PDF feltöltés  │         │ PGMQ Trigger   │         │ (OCR & AI)     │
 └────────────────┘         └────────────────┘         └───────┬────────┘
                                                               │
 ┌────────────────┐         ┌────────────────┐                 │
 │ 5. Élő UI      │         │ 4. Adatbázis   │                 │
 │ Frissítés      │         │ Rekord Változás│                 │
 │                │         │                │                 │
 │ React Client   │◄────────┤ Supabase       │◄────────────────┘
 │ (WebSocket)    │         │ Realtime WAL   │
 └────────────────┘         └────────────────┘
```

1. **Esemény Keletkezése (Event Occurrence):** Egy új számla érkezik e-mailben (Mailgun webhook) vagy a UI-on keresztül az `invoice_uploads` táblába.
2. **Esemény Közzététele (Enqueue Event):** A PostgreSQL adatbázis trigger automatikusan egy `invoice_jobs` üzenetet hoz létre a PGMQ sorban.
3. **Aszinkron Feldolgozás (Async Consumer):** A Dockerben futó Python worker kiolvassa az üzenetet, elvégzi az OCR kinyerést és a GPT-4o klasszifikációt.
4. **Adatbázis Változás (Database Event):** A worker frissíti az `invoices` táblát (`processing_status = 'processed'`).
5. **Élő Visszajelzés (Realtime Event):** A Supabase Realtime WebSocket csatornán keresztül a böngésző értesül a sikeres feldolgozásról, és frissíti a számlalistát felfrissítés nélkül.

---

## 💡 Fő Előnyök a Visibillben

- **Rugalmas Skálázhatóság:** Ha egyszerre 10,000 számla érkezik e-mailben, a webszerver nem omlik össze, hanem az üzenetek PGMQ sorba kerülnek, ahonnan a worker saját tempójában dolgozza fel őket.
- **Hibatűrés:** Ha a Python worker leáll frissítés miatt, az események biztonságban megmaradnak az adatbázis üzenetsorában (PGMQ).
