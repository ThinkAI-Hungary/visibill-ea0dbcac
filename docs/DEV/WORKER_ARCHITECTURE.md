# Worker Architektúra és Dedikált Dev Worker Replica

Ez a dokumentum a VisiBill aszinkron feldolgozó (Worker) infrastruktúráját, a dedikált fejlesztői replikát (`worker-dev`) és a többprojektes Worker Monitor integrációját írja le.

---

## 🏗️ 1. Rendszer- és Worker Áttekintés

A háttérfeldolgozásokat (PDF OCR, számlaextrakció, tranzakció-feldolgozás, főkönyvi AI osztályozás, riportgenerálás) Python worker konténerek végzik a központi DigitalOcean dropleten (`64.226.83.137`), a `/home/jani/visibill-worker/` útvonalon.

### Aktív Worker Konténerek (7/7 Healthy)

| Szolgáltatás / Konténer | Replikaszám | Projekt Célpont | Adatbázis | PGMQ Sorok | Heartbeat Cél |
| :--- | :---: | :---: | :---: | :--- | :--- |
| **`worker-prod`** | 4 db | PROD | `vxxgvdlqvvchtlmqnrqf` | Éles PGMQ sorok | PROD `worker_heartbeats` |
| **`worker-dev`** | 1 db | **DEV** | `qhvcdqkqpgpdxogqqvyr` | **Dev PGMQ sorok (7 db)** | PROD `worker_heartbeats` |
| **`worker-vsweb`** | 1 db | VSWEB | `ykyvowfrqfowovhyckuv` | VSWEB PGMQ sorok | PROD `worker_heartbeats` |
| **`worker-thinkerman`** | 1 db | THINKERMAN | `aebgcvdsvkfgpwhsdtqj` | Thinkerman PGMQ sorok | PROD `worker_heartbeats` |

---

## ⚙️ 2. A Dedikált Fejlesztői Worker (`worker-dev`)

A `worker-dev` célja, hogy a fejlesztői környezetben (`dev.visibill.hu` és helyi fejlesztés) feltöltött számlákat, bankkivonatokat és egyéb feladatokat izoláltan, a tesztadatbázisban dolgozza fel, anélkül hogy az éles forgalmat érintené.

### Konfiguráció és Futtatás
* **Docker Compose szolgáltatás:** `worker-dev` a `/home/jani/visibill-worker/docker-compose.yml` állományban
* **Környezeti fájl:** `/home/jani/visibill-worker/.env.dev`
  * `SUPABASE_URL`: `https://qhvcdqkqpgpdxogqqvyr.supabase.co`
  * `SUPABASE_SERVICE_ROLE_KEY`: Dev DB service role kulcsa
  * `SUPABASE_PROJECT`: `DEV`
  * `MONITORING_SUPABASE_URL`: `https://vxxgvdlqvvchtlmqnrqf.supabase.co` (Prod DB a központi heartbeat-hez)
  * `MONITORING_SERVICE_ROLE_KEY`: Prod DB service role kulcsa
* **Healthcheck:**
  ```yaml
  test: ["CMD-SHELL", "grep -qa python /proc/1/cmdline || exit 1"]
  interval: 30s
  timeout: 5s
  retries: 3
  start_period: 20s
  ```
* **Kezelés a szerveren:**
  ```bash
  cd /home/jani/visibill-worker
  docker compose -f docker-compose.yml --env-file .env up -d worker-dev
  docker compose logs -f worker-dev
  ```

---

## 📊 3. Többprojektes Worker Monitor Architektúra

A Management Dashboard (`/management?view=control-center` → **Worker** fül) a Dev és Prod környezetben is egységesen képes áttekinteni a teljes gépparkot.

### Adatfolyam és Működés
1. **Központi Heartbeat Olvasás:**
   * Minden worker (a `worker-dev` is) a Prod `worker_heartbeats` táblájába küldi az állapotjelentését (CPU, RAM, aktív queue-k, verzió).
   * A Dev Supabase-en futó `management-stats` Edge Function a `PROD_SUPABASE_URL` és `PROD_SERVICE_ROLE_KEY` secret-ek segítségével ebből a központi táblából olvassa a konténerlistát.
2. **Kereszt-projekt Queue és LLM Lekérdezések:**
   * A `management-stats` funkció párhuzamosan lekérdezi az összes konfigurált projekt (`PROD`, `DEV`, `VSWEB`, `THINKERMAN`) PGMQ sorait (`pgmq_metrics_all`) és LLM feldolgozási statisztikáit (`worker_pipeline_stats`, `worker_daily_counts`).
3. **Elvárt Konténerek Ellenőrzése:**
   * Ha egy konténer nem küld életjelet 120 másodpercen belül, a rendszer offline/unhealthy jelölést ad.
   * A `worker-dev` 1 elvárt replikával szerepel, így 4 Prod + 1 Dev + 1 VSWeb + 1 Thinkerman = **7/7 aktív konténer** jelenik meg hiba nélkül.
4. **Felületi Támogatás (Frontend):**
   * A konténerlistában és a metrika-kártyán megjelenik a projektjelölő címke (`DEV`, `PROD`, `VSWEB`, `THINKERMAN`).
   * A sorok neveinél a regex automatikusan normalizálja a `DEV:` előtagot, így a felület letisztult marad.
