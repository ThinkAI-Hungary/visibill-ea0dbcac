# VisiBill Fejlesztői Környezet (DEV Environment)

Dokumentációs központ a VisiBill dedikált fejlesztői és tesztelési környezetéhez (`dev.visibill.hu`).

---

## 📌 Gyors Áttekintés

* **Webes elérhetőség:** [https://dev.visibill.hu](https://dev.visibill.hu)
* **Webkiszolgáló:** Caddy reverse proxy Let's Encrypt TLS-szel (DigitalOcean Droplet: `64.226.83.137`)
* **Webroot útvonal a szerveren:** `/home/jani/dev-visibill/dist/`
* **Dev Adatbázis (Supabase):** `qhvcdqkqpgpdxogqqvyr` (AWS eu-west-1)
* **Dev Supabase URL:** `https://qhvcdqkqpgpdxogqqvyr.supabase.co`
* **Aktív Git ág:** `develop`
* **Automatikus CI/CD:** [.github/workflows/deploy-dev.yml](file:///d:/ThinkAI/Visibill/eaisybill-prod/.github/workflows/deploy-dev.yml)

---

## 📚 Dokumentációs Térkép

| Dokumentum | Leírás |
| :--- | :--- |
| [ARCHITECTURE.md](file:///d:/ThinkAI/Visibill/eaisybill-prod/docs/DEV/ARCHITECTURE.md) | A fejlesztői infrastruktúra, Caddy webszerver, Supabase Dev DB, Edge Functions és hálózati kapcsolatok. |
| [DATA_MIGRATION_AND_SYNC.md](file:///d:/ThinkAI/Visibill/eaisybill-prod/docs/DEV/DATA_MIGRATION_AND_SYNC.md) | A 3 szinkronizált cég adatai, migrációs audit, napi 06:00-s cron job és az A8/NAV háttérműveletek kikapcsolása. |
| [DEVELOPMENT_WORKFLOW.md](file:///d:/ThinkAI/Visibill/eaisybill-prod/docs/DEV/DEVELOPMENT_WORKFLOW.md) | Fejlesztői útmutató a `develop` ághoz, helyi `.env.local`, Supabase CLI, CI/CD deploy és migrációs szabályok. |

---

## 🎯 Főbb Eredmények és Invariánsok

1. **Teljes Séma-paritás a Prod és Dev között:**
   * Mind a **227 tábla**, **301 tárolt eljárás (RPC)**, **490 egyedi típus**, **209 trigger** és **750 RLS házirend** 100%-ban megegyezik a termelési rendszerrel.
   * Mind a **71 aktív Edge Function** telepítve van a Dev Supabase-re.
   * Az összes **567 migráció** metaadatai szinkronizálva vannak a Studio felületével.
2. **Különválasztott Adatbázis:**
   * A fejlesztői felület és a helyi tesztelés soha nem nyúl az éles (`vxxgvdlqvvchtlmqnrqf`) adatbázishoz.
3. **Automatikus Frontend CI/CD:**
   * Minden `develop` ágra küldött commit automatikusan lefut (Oxlint, TypeScript ellenőrzés, Vite build), és Rsync-kel frissíti a `https://dev.visibill.hu` oldalt ~1,5 perc alatt.
4. **Napi Hajnali Szinkronizáció:**
   * A dropleten futó ütemezett job minden reggel 06:00-kor szinkronizálja a `Think Ai Kft` és `Taxology Kft.` friss számláit és tranzakcióit az élesről a dev adatbázisba.
