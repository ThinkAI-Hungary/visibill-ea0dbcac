# Kiterjesztések, Sorok és Tesztkörnyezet Migráció (Extensions, Queues & Local replica)

**Létrehozva:** 2026-06-28  
**Állapot:** Tervezett — a Supabase Exit terv kiegészítése  

---

## 1. PGMQ (Postgres Message Queue) Migrációs Forgatókönyvek

A Python worker és az aszinkron feladatok (OCR, párosítások, bérjegyzékek) a `pgmq` kiterjesztésre támaszkodnak. Ha elhagyjuk a Supabase platformot, az alábbi három lehetőség áll rendelkezésre:

### A) Opció: Self-Hosted `pgmq` kiterjesztés (Ajánlott)
Ha saját virtuális gépre (VPS, pl. Hetzner, DigitalOcean) telepítünk PostgreSQL-t, a `pgmq` extension manuálisan is telepíthető.
* **Telepítés Ubuntu/Debian alatt:**
  ```bash
  sudo apt-get install postgresql-16-pgmq
  ```
  Vagy Docker alapú PostgreSQL esetén a `tembo-io/pgmq` Docker image használata.
* **Kockázat:** Managed PostgreSQL szolgáltatóknál (pl. AWS RDS, DigitalOcean Managed Databases) nem engedélyezett egyedi kiterjesztések telepítése, így ott ez nem opció.

### B) Opció: Redis + BullMQ (Node.js) és Celery (Python) Fallback
Ez a legstabilabb felhős managed alternatíva, ha nem tudunk egyedi Postgres kiterjesztést használni.
* **Frontend/API oldal (Node.js/Hono):** A PGMQ kliens helyett a `bullmq` könyvtárat használjuk feladatok feladására.
* **Worker oldal (Python):** A `celery` vagy `rq` (Redis Queue) könyvtár használata a Python workerben.
* **Adatmodell változás:** A queue feladatok kikerülnek a Postgres-ből a Redis memóriatárba.

### C) Opció: Tiszta SQL (Table-based) Queue Fallback
Ha meg akarjuk tartani az adatbázis-szintű sorokat (nincs szükség Redis-re), de nincs `pgmq` extension.
* **Megvalósítás:** Létrehozunk egy standard Postgres táblát (`queue_jobs`) és a `SKIP LOCKED` SQL záradékot használjuk a konkurens feldolgozáshoz:
  ```sql
  -- Üzenet olvasása és zárolása (megfelel a pgmq_read-nek)
  UPDATE queue_jobs
  SET status = 'processing', locked_at = now()
  WHERE id = (
    SELECT id FROM queue_jobs
    WHERE status = 'pending'
    ORDER BY created_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED
  )
  RETURNING *;
  ```

---

## 2. `pg_cron` (Időzített feladatok) Kiváltása

Jelenleg 4 darab cron feladat fut a Supabase-ben (`accounty-auto-sync`, `accounty-detect-missing`, `accounty-generate-deadlines`, `nav-auto-fetch`).

### Helyettesítő alternatívák:
1. **Node.js API szinten (Hono + node-cron):**
   Ha az Edge Function-ök helyett egy folyamatosan futó Hono Node.js backendünk lesz, a feladatokat az alkalmazáson belül ütemezhetjük:
   ```typescript
   import cron from 'node-cron';
   
   // Minden nap reggel 6-kor fut
   cron.schedule('0 6 * * *', async () => {
     await detectMissingInvoices();
   });
   ```
2. **OS szinten (Linux Cron / Systemd Timers):**
   A VPS operációs rendszerén beállított cron jobok, amelyek egy belső API végpontot (pl. `POST /api/cron/detect-missing`) hívnak meg titkosított tokennel.
3. **Python Worker szinten (APScheduler / Celery Beat):**
   A háttér-workerbe ágyazott scheduler futtatása.

---

## 3. Adatbázis Migrációs Stratégia (Downtime vs. Live Sync)

Az adatok zökkenőmentes átvitele a Supabase Postgres-ből az új cél-Postgres-be.

### Jelszavak migrációja (GoTrue Auth)
* A Supabase `auth.users` táblájában a jelszavak **bcrypt** hasheléssel vannak tárolva.
* Ha pl. **Keycloak**-ra váltunk, az adatbázis exportból ki kell nyerni a jelszó-hasheket, és a Keycloak felhasználó-importáló API-ján keresztül kell feltölteni őket, megadva, hogy a hash algoritmus `bcrypt`. Így a felhasználóknak nem kell új jelszót kérniük.

### Adatszinkronizáció (Downtime minimalizálása)
* **Kis adatméretnél (pár perc leállás):**
  1. Frontend karbantartási módba állítása (írási műveletek blokkolása).
  2. `pg_dump` futtatása a Supabase adatbázison.
  3. `pg_restore` futtatása az új adatbázison.
  4. DNS átirányítás az új API-ra és frontendre.
* **Nagy adatméretnél (leállás nélkül):**
  * **Logical Replication (Logikai replikáció):** A Supabase Postgres-t beállítjuk Publishernek, az új adatbázist Subscribernek. A Postgres a háttérben szinkronban tartja a táblákat. Amikor a replikációs lag 0-ra csökken, átkapcsoljuk a DNS-t, és leállítjuk a Supabase-t.

---

## 4. Helyi Tesztkörnyezet (Docker-Compose Local Replica)

A migráció sikerességének ellenőrzéséhez az alábbi `docker-compose.exit-test.yml` konfiguráció segítségével lokálisan is szimulálhatjuk a teljes Supabase-mentes stacket:

```yaml
version: '3.8'

services:
  # 1. Helyettesítő PostgreSQL adatbázis
  postgres:
    image: postgres:16-alpine
    container_name: exit-test-postgres
    environment:
      POSTGRES_DB: visibill_local
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: localpassword
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
      - ./supabase/migrations:/docker-entrypoint-initdb.d # Automatikus séma betöltés

  # 2. Keycloak (Supabase Auth helyett)
  keycloak:
    image: quay.io/keycloak/keycloak:24.0
    container_name: exit-test-auth
    command: start-dev
    environment:
      KEYCLOAK_ADMIN: admin
      KEYCLOAK_ADMIN_PASSWORD: adminpassword
    ports:
      - "8080:8080"
    depends_on:
      - postgres

  # 3. MinIO (Supabase Storage helyett - S3 kompatibilis API)
  minio:
    image: minio/minio
    container_name: exit-test-storage
    ports:
      - "9000:9000"
      - "9001:9001"
    environment:
      MINIO_ROOT_USER: minioadmin
      MINIO_ROOT_PASSWORD: minioadminpassword
    command: server /data --console-address ":9001"

  # 4. Hono Node.js API (Edge Function-ök helyett)
  api:
    build:
      context: ./api
      dockerfile: Dockerfile
    container_name: exit-test-api
    ports:
      - "3000:3000"
    environment:
      DATABASE_URL: postgres://postgres:localpassword@postgres:5432/visibill_local
      AUTH_PROVIDER_URL: http://keycloak:8080
      STORAGE_ENDPOINT: http://minio:9000
    depends_on:
      - postgres
      - keycloak
      - minio

  # 5. Python Worker (PGMQ / Redis eléréssel)
  worker:
    build:
      context: ./worker
      dockerfile: Dockerfile
    container_name: exit-test-worker
    environment:
      DATABASE_URL: postgres://postgres:localpassword@postgres:5432/visibill_local
    depends_on:
      - postgres

volumes:
  pgdata:
