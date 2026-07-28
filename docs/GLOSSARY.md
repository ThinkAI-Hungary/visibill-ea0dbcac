# 📚 Visibill Glossary & Technológiai Lexikon

> **Utoljára frissítve:** 2026-07-25  
> **Átszervezve:** A glosszárium a **[docs/glossary/](./glossary/index.md)** mappában érhető el 9 strukturált kategóriára bontva.

---

## 🗂️ Gyors Hivatkozások a Glossary Modulokhoz

- 📄 **[Gyors Index & Kereső Mátrix](./glossary/index.md)**

### 1. Üzlet, Márkák & Magyar Adózás
- 🏷️ **[Brands & Naming](./glossary/01-business-and-domain/brands-and-naming.md)** — eaisyBill, eaisyBooks (Accounty) elnevezések és AI agent szabályok.
- 🧾 **[EV Adózási Domain](./glossary/01-business-and-domain/ev-taxation-domain.md)** — Átalányadó, VSZJA, KATA, Szocho, Pénztárkönyv.

### 2. Biztonság, Autentikáció & Megfelelőség
- 👑 **[RBAC — Access Control](./glossary/02-security-and-compliance/rbac-role-based-access-control.md)** — A Visibill 7-szintű szerepkör-alapú jogosultsági mátrixa.
- 🔐 **[Data Encryption](./glossary/02-security-and-compliance/data-encryption-aes256.md)** — AES-256-GCM Vault és TLS 1.3 titkosítás.
- 🌐 **[Web Security](./glossary/02-security-and-compliance/web-security-xss-csrf-cors.md)** — XSS, CSRF, CORS & CSP böngészőbiztonság.
- 🛡️ **[Security Definer](./glossary/02-security-and-compliance/security-definer.md)** — PostgreSQL `SECURITY DEFINER` vs `SECURITY INVOKER` és `search_path` védelem.
- 🔑 **[JWT — JSON Web Token](./glossary/02-security-and-compliance/jwt-json-web-token.md)** — Munkamenet hitelesítés és `sessionStorage` multi-tab izoláció (A-040).
- 🛡️ **[RLS — Row Level Security](./glossary/02-security-and-compliance/rls-row-level-security.md)** — Sor-szintű adatizoláció és multi-tenancy.

### 3. Adatbázis & Szervermentes Logika
- 🐘 **[PostgreSQL Adatbázismotor](./glossary/03-database-and-backend/postgresql-database-engine.md)** — RDBMS, ACID garanciák, MVCC, WAL naplózás, JSONB NoSQL és bővítmények (`pgmq`).
- ⚡ **[RPC — Remote Procedure Call](./glossary/03-database-and-backend/rpc-remote-procedure-call.md)** — PostgreSQL tárolt eljárások és `VOLATILE` tranzakciós garanciák.
- 🏊 **[Connection Pooling](./glossary/03-database-and-backend/connection-pooling.md)** — Adatbázis kapcsolati pool (Supavisor / PgBouncer) serverless környezetben.
- 🛡️ **[SQL Injection & Sanitization](./glossary/03-database-and-backend/sql-injection-sanitization.md)** — Paraméterezett lekérdezések és bemenet-szűrés.

### 4. Aszinkron Kommunikáció & Valós Idejű Hálózat
- 🌐 **[WebSocket & Realtime](./glossary/04-communication-and-messaging/websocket-and-realtime.md)** — Full-duplex WebSocket kommunikáció és Supabase Realtime `postgres_changes`.
- 📬 **[PGMQ — Message Queues](./glossary/04-communication-and-messaging/pgmq-message-queues.md)** — Adatbázis-natív üzenetsorok és Python worker láncolat.
- ⚡ **[Event-Driven Architecture](./glossary/04-communication-and-messaging/event-driven-architecture.md)** — Eseményvezérelt adatáramlás (DB Triggers → PGMQ → Worker → Realtime UI).

### 5. Szoftverminták, Algoritmusok & Megbízhatóság
- 📐 **[Big O Notation](./glossary/05-architecture-and-standards/big-o-notation.md)** — Algoritmus-komplexitás és $O(1)$ in-memory hash indexing (A-039).
- 🔄 **[Idempotency & Dedup](./glossary/05-architecture-and-standards/idempotency-and-dedup.md)** — Idempotencia elve és a 3-rétegű upload dedup architektúra (A-041).
- ⚡ **[Circuit Breaker Pattern](./glossary/05-architecture-and-standards/circuit-breaker-pattern.md)** — Áramköri megszakító minta a hibatűréshez (LiteLLM & NAV API fallback).
- ⚖️ **[Load Balancer](./glossary/05-architecture-and-standards/load-balancer.md)** — Terheléselosztó algoritmusok és worker health-checkek.
- 💥 **[SPOF — Single Point of Failure](./glossary/05-architecture-and-standards/single-point-of-failure-spof.md)** — Egyetlen hibapontok elemzése és magas rendelkezésre állás.
- 🧼 **[SOLID Principles & Clean Code](./glossary/05-architecture-and-standards/solid-principles-clean-code.md)** — Tiszta szoftvertervezési alapelvek (SRP, OCP, DRY, KISS, YAGNI).

### 6. Felhő, Konténerek & CI/CD DevOps
- ⚡ **[Supabase Platform](./glossary/06-infrastructure-and-devops/supabase-platform.md)** — BaaS platform (Auth, Storage, PostgREST, CLI, Multi-Project).
- 🐳 **[Docker & Konténerizáció](./glossary/06-infrastructure-and-devops/docker-containers.md)** — Dockerfile, Image-ek és `docker-compose` worker deployment.
- ☸️ **[Kubernetes (K8s)](./glossary/06-infrastructure-and-devops/kubernetes-k8s.md)** — Konténer-orkesztráció, Pod-ok és HPA autoscaling.
- ☁️ **[AWS Cloud Platform](./glossary/06-infrastructure-and-devops/aws-amazon-web-services.md)** — EC2, S3, EKS, Lambda és felhős migrációs útvonal.
- 📦 **[AWS S3 — Object Storage](./glossary/06-infrastructure-and-devops/aws-s3-object-storage.md)** — Objektumtárolás, Buckets és Pre-signed letöltési URL-ek (A-044).
- 🚀 **[CI/CD Pipeline Automation](./glossary/06-infrastructure-and-devops/ci-cd-automation.md)** — GitHub Actions → GHCR → SSH deploy automatizáció.

### 7. Futtatókörnyezetek, Keretrendszerek & AI Pipeline
- 🦕 **[Deno Runtime](./glossary/07-frameworks-and-runtimes/deno-runtime.md)** — TypeScript/JavaScript futtatókörnyezet és Supabase Edge Functions.
- ⚛️ **[Next.js Framework](./glossary/07-frameworks-and-runtimes/nextjs-framework.md)** — Fullstack React keretrendszer (SSR, SSG, App Router).
- 🟢 **[Node.js Runtime](./glossary/07-frameworks-and-runtimes/nodejs-runtime.md)** — JavaScript futtatókörnyezet, npm tooling és Vite.
- ⚡ **[EF — Edge Functions](./glossary/07-frameworks-and-runtimes/ef-edge-functions.md)** — Supabase Deno-alapú szervermentes backend funkciók.
- 👁️ **[OCR & Vision Pipeline](./glossary/07-frameworks-and-runtimes/ocr-vision-pipeline.md)** — MarkItDown + GPT-4o Vision fallback és PDF Splitter.
- 🧠 **[LLM Rate Limiting & Budgeting](./glossary/07-frameworks-and-runtimes/llm-rate-limiting-budgeting.md)** — Token számlálás, LiteLLM fallback & rate-limit kezelés.

### 8. System Design Minták & Algoritmusok
- ⚡ **[Caching Stratégiák & Eviction](./glossary/08-system-design-and-algorithms/caching-strategies-and-eviction.md)** — Cache-Aside, Write-Through, LRU/LFU és Cache Stampede.
- ⏱️ **[Rate Limiting Algoritmusok](./glossary/08-system-design-and-algorithms/rate-limiting-algorithms.md)** — Token Bucket, Leaky Bucket, Sliding Window Log/Counter.
- 🗄️ **[Database Sharding & Replication](./glossary/08-system-design-and-algorithms/database-sharding-and-replication.md)** — Read Replicas, Horizontal Sharding, Consistent Hashing.
- 🏗️ **[Aszinkron System Minták](./glossary/08-system-design-and-algorithms/asynchronous-system-patterns.md)** — Dead Letter Queue (DLQ), Transactional Outbox Pattern, BFF, Bulkhead.
- 🗝️ **[Hash Tables & Indexing](./glossary/08-system-design-and-algorithms/hash-tables-and-in-memory-indexing.md)** — Hash függvénnyek, ütközéskezelés, $O(1)$ in-memory transaction matching (A-039).
- 🔍 **[Keresés, Rendezés & B-Tree](./glossary/08-system-design-and-algorithms/sorting-searching-btree.md)** — Bináris keresés ($O(\log N)$) és PostgreSQL B-Tree / B+ Tree indexek.
- 🌐 **[Gráfalgoritmusok & TopoSort](./glossary/08-system-design-and-algorithms/graph-algorithms-topological-sort.md)** — BFS, DFS bejárások, függőségi fák és topológiai rendezés (Graphify).
- 🪟 **[Sliding Window & Two Pointers](./glossary/08-system-design-and-algorithms/sliding-window-and-two-pointers.md)** — Gördülő ablak idősoros adatokhoz és két mutatós tömb összefésülési minták.

### 9. React & Frontend Architektúra
- ⚛️ **[React Alapfogalmak & VDOM](./glossary/09-react-and-frontend/react-fundamentals-and-jsx.md)** — DOM, Virtual DOM, JSX, Props vs State egyirányú adatáramlás.
- 🪝 **[React Hooks Core](./glossary/09-react-and-frontend/react-hooks-core.md)** — `useState`, `useEffect`, `useRef`, `useContext` és Custom Hook-ok.
- 🚀 **[React Teljesítmény & Memoizáció](./glossary/09-react-and-frontend/react-performance-and-memoization.md)** — `useMemo`, `useCallback`, `React.memo` (HOC) és State Debouncing.
- 🔄 **[React Query & Szerver Állapot](./glossary/09-react-and-frontend/react-query-and-async-state.md)** — Server State vs Client State, `useQuery`, `useMutation`, Optimista Frissítés.
