# 📚 Visibill Glossary & Technológiai Lexikon

> **Utoljára frissítve:** 2026-07-25  
> Ez a moduláris, 9 kategóriára bontott lexikon gyűjti össze a platform üzleti, domain-specifikus, architektúra, frontend és rendszertervezési fogalmait.

---

## 🗂️ Kategóriák és Modulok

### 1. Üzlet, Márkák & Magyar Adózás
* 📄 **[Brands & Naming](./01-business-and-domain/brands-and-naming.md)** — eaisyBill, eaisyBooks (korábban Accounty), Visibill platform névkonvenciók és AI agent szabályok.
* 📄 **[EV Adózási Domain](./01-business-and-domain/ev-taxation-domain.md)** — Átalányadó, VSZJA, KATA, Szocho, Minimumjárulék, Pénztárkönyv és könyvelési kifejezések.

### 2. Biztonság, Autentikáció & Megfelelőség
* 📄 **[RBAC — Role-Based Access Control](./02-security-and-compliance/rbac-role-based-access-control.md)** — A Visibill 7-szintű szerepkör-alapú jogosultságkezelési mátrixa.
* 📄 **[Data Encryption](./02-security-and-compliance/data-encryption-aes256.md)** — Adattitkosítás nyugalmi (AES-256-GCM / Vault) és átviteli (TLS 1.3) állapotban.
* 📄 **[Web Security](./02-security-and-compliance/web-security-xss-csrf-cors.md)** — XSS, CSRF, CORS és CSP böngészőbiztonság, multi-tab munkamenet izoláció (A-040).
* 📄 **[Security Definer](./02-security-and-compliance/security-definer.md)** — PostgreSQL `SECURITY DEFINER` vs `SECURITY INVOKER`, RLS bypass szabályok és `search_path` védelem.
* 📄 **[JWT — JSON Web Token](./02-security-and-compliance/jwt-json-web-token.md)** — Munkamenet hitelesítés, Supabase Auth session, JWT claims és `sessionStorage` izoláció.
* 📄 **[RLS — Row Level Security](./02-security-and-compliance/rls-row-level-security.md)** — PostgreSQL sor-szintű biztonság, multi-tenancy cégizoláció és kontrollált `service_role` bypass.

### 3. Adatbázis & Szervermentes Logika
* 📄 **[PostgreSQL Adatbázismotor](./03-database-and-backend/postgresql-database-engine.md)** — 🐘 RDBMS, ACID garanciák, MVCC párhuzamosság, WAL naplózás, JSONB NoSQL mezők és bővítmények (`pgmq`, `pgvector`).
* 📄 **[RPC — Remote Procedure Call](./03-database-and-backend/rpc-remote-procedure-call.md)** — Szerver-oldali PostgreSQL függvények, `VOLATILE` vs `STABLE` tranzakciós garanciák és PostgREST integráció.
* 📄 **[Connection Pooling](./03-database-and-backend/connection-pooling.md)** — Adatbázis kapcsolati pool (Supavisor / PgBouncer), Transaction vs Session módok serverless környezetben.
* 📄 **[SQL Injection & Sanitization](./03-database-and-backend/sql-injection-sanitization.md)** — Injekciós sérülékenységek elleni védelem és paraméterezett lekérdezések.

### 4. Aszinkron Kommunikáció & Valós Idejű Hálózat
* 📄 **[WebSocket & Realtime](./04-communication-and-messaging/websocket-and-realtime.md)** — Full-duplex WebSocket kommunikáció, Supabase Realtime `postgres_changes`, chat és élő értesítések.
* 📄 **[PGMQ — Message Queues](./04-communication-and-messaging/pgmq-message-queues.md)** — Adatbázis-natív üzenetsorok, Python worker láncolat, Visibility Timeout (VT) és idempotencia.
* 📄 **[Event-Driven Architecture (EDA)](./04-communication-and-messaging/event-driven-architecture.md)** — Eseményvezérelt architektúra (DB Triggers → PGMQ → Worker → Realtime UI).

### 5. Szoftverminták, Algoritmusok & Megbízhatóság
* 📄 **[Big O Notation](./05-architecture-and-standards/big-o-notation.md)** — Algoritmus-komplexitás, $O(1)$ in-memory hash indexing (A-039), $O(N^2)$ buktatók.
* 📄 **[Idempotency & Dedup](./05-architecture-and-standards/idempotency-and-dedup.md)** — Idempotencia elve és a Visibill 3-rétegű upload dedup architektúrája (A-041).
* 📄 **[Circuit Breaker Pattern](./05-architecture-and-standards/circuit-breaker-pattern.md)** — Áramköri megszakító minta a hibatűréshez (LiteLLM & NAV API fallback).
* 📄 **[Load Balancer](./05-architecture-and-standards/load-balancer.md)** — Terheléselosztó algoritmusok (Round Robin, Least Connections), SSL termináció és worker health-checkek.
* 📄 **[SPOF — Single Point of Failure](./05-architecture-and-standards/single-point-of-failure-spof.md)** — Egyetlen hibapontok elemzése, kockázatértékelés és magas rendelkezésre állás (HA).
* 📄 **[SOLID Principles & Clean Code](./05-architecture-and-standards/solid-principles-clean-code.md)** — A tiszta szoftvertervezési alapelvek, DRY, KISS és YAGNI szabályok.

### 6. Felhő, Konténerek & CI/CD DevOps
* 📄 **[Supabase Platform](./06-infrastructure-and-devops/supabase-platform.md)** — Backend-as-a-Service (BaaS) platform, Auth, Storage, PostgREST, CLI és multi-project architektúra.
* 📄 **[Docker & Konténerizáció](./06-infrastructure-and-devops/docker-containers.md)** — Dockerfile, Image-ek, konténerek és multi-project worker deployment (`docker-compose`).
* 📄 **[Kubernetes (K8s)](./06-infrastructure-and-devops/kubernetes-k8s.md)** — Konténer-orkesztráció, Pod-ok, Deployments, HPA autoscaling és skálázási modell.
* 📄 **[AWS — Amazon Web Services](./06-infrastructure-and-devops/aws-amazon-web-services.md)** — Felhős számítástechnikai platform (EC2, S3, EKS, Lambda) és összehasonlítás.
* 📄 **[AWS S3 — Object Storage](./06-infrastructure-and-devops/aws-s3-object-storage.md)** — Objektumtárolás, Buckets, Pre-signed letöltési URL-ek (A-044) és S3 API kompatibilitás.
* 📄 **[CI/CD Pipeline Automation](./06-infrastructure-and-devops/ci-cd-automation.md)** — Folyamatos integráció és automatizált felhős kódkiadás (GitHub Actions → GHCR → SSH deploy).

### 7. Futtatókörnyezetek, Keretrendszerek & AI Pipeline
* 📄 **[Deno Runtime](./07-frameworks-and-runtimes/deno-runtime.md)** — TypeScript/JavaScript futtatókörnyezet, URL importok, ultragyors cold start és Supabase Edge Functions.
* 📄 **[Next.js Framework](./07-frameworks-and-runtimes/nextjs-framework.md)** — Fullstack React keretrendszer, SSR/SSG/ISR, App Router és összehasonlítás a Vite SPA-val.
* 📄 **[Node.js Runtime](./07-frameworks-and-runtimes/nodejs-runtime.md)** — JavaScript futtatókörnyezet, Event Loop, npm/npx tooling, Vite és Deno összehasonlítás.
* 📄 **[EF — Edge Functions](./07-frameworks-and-runtimes/ef-edge-functions.md)** — Supabase Deno-alapú szervermentes backend funkciók.
* 📄 **[OCR & Vision Pipeline](./07-frameworks-and-runtimes/ocr-vision-pipeline.md)** — Képalapú számlafeldolgozás (MarkItDown + GPT-4o Vision fallback, PDF Splitter).
* 📄 **[LLM Rate Limiting & Budgeting](./07-frameworks-and-runtimes/llm-rate-limiting-budgeting.md)** — Token számlálás, LiteLLM költségbecslés, költségplafon és rate limit kezelés.

### 8. System Design Minták & Algoritmusok
* 📄 **[Caching Stratégiák & Eviction](./08-system-design-and-algorithms/caching-strategies-and-eviction.md)** — Cache-Aside, Write-Through, LRU/LFU és Cache Stampede védekezés.
* 📄 **[Rate Limiting Algoritmusok](./08-system-design-and-algorithms/rate-limiting-algorithms.md)** — Token Bucket, Leaky Bucket, Sliding Window Log/Counter túlterhelés elleni védelem.
* 📄 **[Database Sharding & Replication](./08-system-design-and-algorithms/database-sharding-and-replication.md)** — Read Replicas, Horizontal Sharding és Consistent Hashing adatbázis skálázás.
* 📄 **[Aszinkron System Minták](./08-system-design-and-algorithms/asynchronous-system-patterns.md)** — Dead Letter Queue (DLQ), Transactional Outbox Pattern, BFF és Bulkhead izoláció.
* 📄 **[Hash Tables & In-Memory Indexing](./08-system-design-and-algorithms/hash-tables-and-in-memory-indexing.md)** — Hash függvények, ütközéskezelés és $O(1)$ transaction matching (A-039).
* 📄 **[Keresés, Rendezés & B-Tree](./08-system-design-and-algorithms/sorting-searching-btree.md)** — Bináris keresés ($O(\log N)$) és PostgreSQL B-Tree / B+ Tree indexek működése.
* 📄 **[Gráfalgoritmusok & TopoSort](./08-system-design-and-algorithms/graph-algorithms-topological-sort.md)** — BFS, DFS bejárások, függőségi fák és topológiai rendezés (Graphify).
* 📄 **[Sliding Window & Two Pointers](./08-system-design-and-algorithms/sliding-window-and-two-pointers.md)** — Gördülő ablak idősoros adatokhoz és két mutatós tömb összefésülési minták.

### 9. React & Frontend Architektúra
* 📄 **[React Alapfogalmak & VDOM](./09-react-and-frontend/react-fundamentals-and-jsx.md)** — DOM (Document Object Model), Virtual DOM, JSX szintaxis, Props vs State egyirányú adatáramlás.
* 📄 **[React Hooks Core](./09-react-and-frontend/react-hooks-core.md)** — `useState`, `useEffect`, `useRef`, `useContext` és Custom Hook-ok (`useCompanyPermissions`).
* 📄 **[React Teljesítmény & Memoizáció](./09-react-and-frontend/react-performance-and-memoization.md)** — `useMemo`, `useCallback`, `React.memo` (HOC) és State Debouncing a felületgyorsításhoz.
* 📄 **[React Query & Szerver Állapot](./09-react-and-frontend/react-query-and-async-state.md)** — Server State vs Client State, `useQuery`, `useMutation`, Optimista Frissítés & Cache Invalidation.

---

## 🔍 Gyors Terminológia Kereső (Quick Mapping)

| Kifejezés | Típus | Összefoglalás | Részletes Doc |
|---|---|---|---|
| **ACID** | Adatbázis | Tranzakciók megbízhatóságát garantáló 4 pillér (Atomicity, Consistency, Isolation, Durability) | [postgresql-database-engine.md](./03-database-and-backend/postgresql-database-engine.md) |
| **JSONB** | Adatbázis | Bináris, indexelhető NoSQL adatformátum a PostgreSQL-ben | [postgresql-database-engine.md](./03-database-and-backend/postgresql-database-engine.md) |
| **MVCC** | Adatbázis | Multi-Version Concurrency Control — zárásmentes párhuzamos adatbázis olvasás/írás | [postgresql-database-engine.md](./03-database-and-backend/postgresql-database-engine.md) |
| **PostgreSQL** | Adatbázis | Nyílt forráskódú relációs adatbázismotor (Supabase BaaS magja) | [postgresql-database-engine.md](./03-database-and-backend/postgresql-database-engine.md) |
| **RDBMS** | Adatbázis | Relational Database Management System (Relációs Adatbázis-kezelő) | [postgresql-database-engine.md](./03-database-and-backend/postgresql-database-engine.md) |
| **WAL** | Adatbázis | Write-Ahead Logging — előreírt naplózás adatvesztés és felhős Realtime streaming ellen | [postgresql-database-engine.md](./03-database-and-backend/postgresql-database-engine.md) |
