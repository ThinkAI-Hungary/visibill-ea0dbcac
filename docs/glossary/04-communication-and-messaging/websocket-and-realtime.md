# 🌐 WebSocket & Supabase Realtime Connection

> **Utoljára frissítve:** 2026-07-25  
> **Kapcsolódó doksi:** [A-018: Ticket System Realtime](../../architecture/decisions/A-018-ticket-system.md) | [GLOSSARY Index](../index.md)

---

## 📖 Fogalom Meghatározása

A **WebSocket** egy hálózati protokoll, amely kétirányú (full-duplex), folyamatosan nyitott kommunikációs csatornát biztosít egyetlen TCP kapcsolaton keresztül a kliens (böngésző) és a szerver között.

A hagyományos HTTP kérés-válasz (polling) modellel szemben a WebSocket segítségével a szerver **azonnal (valós időben, milliszekundumok alatt) tud adatot küldeni a kliensnek** anélkül, hogy a kliensnek külön le kellene kérdeznie azt.

---

## 🔑 Főbb Realtime Fogalmak

| Kifejezés | Jelentése & Működése |
|---|---|
| **Supabase Realtime** | Elosztott szerver-infrastruktúra (Elixir/Phoenix alapú), amely a PostgreSQL adatbázis változásait (WAL logokat) figyelni és továbbítani tudja a klienseknek. |
| **Channel (Csatorna)** | Logikai témakör (pub/sub), amelyre a kliensek feliratkozhatnak (pl. `room:ticket_123` vagy `db-changes`). |
| **`postgres_changes`** | A Supabase Realtime szolgáltatása, amely konkrét adatbázis-táblák `INSERT`, `UPDATE`, `DELETE` eseményeit közvetíti a böngészőnek. |
| **Heartbeat & Reconnect** | Automatikus ping/pong csomagok, amelyek fenntartják a kapcsolatot. Ha a hálózat megszakad, a csatorna automatikusan újrapróbálja a feliratkozást. |

---

## 💡 Használat a Visibillben

1. **Élő Hibajegy Chat (`A-018`):**  
   A hibajegy felületen az ügyfél és a support munkatárs üzenetei Realtime WebSocket csatornán keresztül azonnal megjelennek.

2. **Élő Értesítések & Worker Status (`LiveNotificationProvider`):**  
   Amikor egy számla feldolgozása befejeződik a Python workerben, a tábla frissüléséről a frontend azonnal WebSocket értesítést kap.

---

## 🛡️ Severity & Zajkezelési Szabály a Visibillben

A hálózati ingadozások miatt a WebSocket csatorna néha átmenetileg bontódhat (`CLOSED`, `TIMED_OUT`).

- **Zajkiszűrés:** A `LiveNotificationProvider`-ben a csatorna átmeneti bontása **nem kerül bejegyzésre az `app_error_logs` táblába**, mivel a kliens automatikusan újracsatlakozik.
- **Konzol Logolás:** A kapcsolat állapotváltozásai kizárólag a böngésző konzolján (`console.warn`) jelennek meg, megkímélve az adminisztrátort a hamis riasztásoktól.
