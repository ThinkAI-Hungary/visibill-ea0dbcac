# 🏗️ Aszinkron Rendszer-minták (DLQ, Outbox, BFF, Bulkhead)

> **Utoljára frissítve:** 2026-07-25  
> **Kapcsolódó doksi:** [Event-Driven Architecture](../04-communication-and-messaging/event-driven-architecture.md) | [GLOSSARY Index](../index.md)

---

## 📖 Fogalom Meghatározása

Az aszinkron elosztott rendszerek építése során olyan tervezési mintákra (Architecture Patterns) van szükség, amelyek szavatolják az adatok hibátlan áramlását, az alkatrészek szeparációját és a hibák biztonságos kezelését.

---

## 🔑 Főbb Aszinkron Minták Katalógusa

### 1. Dead Letter Queue (DLQ — Hibás Üzenetek Sora)
- **Probléma:** Ha egy üzenet (pl. egy korrupt, feldolgozhatatlan PDF) újra és újra hibára fut a workerben, végtelen ciklusban elakasztja a queue-t ("Poison Message").
- **Megoldás:** Megadott számú sikertelen próbálkozás (pl. 3 retry) után a rendszer kiviszi az üzenetet a fő sorból, és átrakja egy **Dead Letter Queue (DLQ)** sorba vagy "error" státuszba, ahol a fejlesztő/admin felülvizsgálhatja.
- **Használat a Visibillben:** A hibás számlák `processing_status='error'` státuszt kapnak az upload táblákban, és eltűnnek az aktív PGMQ várakozási sorból.

### 2. Transactional Outbox Pattern (Tranzakciós Outbox Minta)
- **Probléma:** Egy HTTP kérés során menteni kell a számlát az adatbázisba ÉS üznetet kell küldeni az üzenetsorba. Ha a DB mentés sikerül, de a hálózat megszakad a queue küldés előtt, az adatbázis és a queue inkonzisztenssé válik.
- **Megoldás:** Az üzenetet egy adatbázis-tranzakción belül mentjük el egy `outbox` táblába (vagy DB Trigger segítségével közvetlenül a PGMQ-ba). Az adatbázis motor garantálja, hogy az üzenet csak akkor keletkezik meg, ha a számla mentése is sikeres volt.

### 3. BFF (Backends for Frontends) & API Gateway
- **Probléma:** A mobilalkalmazások, a webes admin dashboard-ok és a külső harmadik felek teljesen eltérő adatformátumot és aggregációt igényelnek.
- **Megoldás:** Egyetlen központi API helyett a frontend igényeire szabott **BFF réteget** (vagy API Gateway-t) hozunk létre.
- **Használat a Visibillben:** A `management-stats` Edge Function kifejezetten BFF-ként működik a Management Dashboard felület számára.

### 4. Bulkhead Pattern (Rekesz / Izolációs Minta)
- **Probléma:** A hajók vízzáró rekeszei megakadályozzák, hogy egy lékrés miatt az egész hajó elsüllyedjen. A szoftverben egyetlen modul (pl. az AI feldolgozó) túlterhelődése bedöntheti a teljes webappot.
- **Megoldás:** Erőforrások (thread pool-ok, adatbázis kapcsolatok, worker konténerek) elszeparálása. A Visibillben a 3 projekt (`PROD`, `VSWEB`, `THINKERMAN`) külön worker konténerekben fut, így az egyik projekt hibája nem érinti a másikat.
