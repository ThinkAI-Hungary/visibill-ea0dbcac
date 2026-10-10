# Fejlesztői Környezet Architektúra (DEV Architecture)

Ez a dokumentum a VisiBill fejlesztői rendszerének infrastrukturális felépítését és komponenseit részletezi.

---

## 🏛️ Rendszerarchitektúra Áttekintés

```text
       [ Fejlesztő / Felhasználó ]
                    │
                    ▼
     https://dev.visibill.hu (HTTPS / 443)
                    │
                    ▼
┌─────────────────────────────────────────────────────────┐
│        DigitalOcean Droplet (64.226.83.137)            │
│                                                         │
│  [ Caddy Reverse Proxy ]                                │
│         │                                               │
│         ▼                                               │
│  /home/jani/dev-visibill/dist/ (Statikus SPA állományok)│
│                                                         │
│  [ Napi Szinkron Cron Job (06:00 Europe/Budapest) ]     │
│  /home/jani/dev-cron/run_sync.sh                        │
└───────────────────────┬─────────────────────────────────┘
                        │
                        │ Supabase JS Kliens & REST / RPC
                        ▼
┌─────────────────────────────────────────────────────────┐
│        Supabase Dev Projekt (qhvcdqkqpgpdxogqqvyr)       │
│        Régió: AWS eu-west-1 (Frankfurt)                 │
│                                                         │
│  • PostgreSQL 15 (227 tábla, 301 RPC, 750 RLS)          │
│  • 71 Edge Function                                     │
│  • 15 Storage Vödör                                     │
│  • Supabase Auth (Menedzsment + Kliens Userek)          │
└─────────────────────────────────────────────────────────┘
```

---

## 🌐 1. Webszerver és Domain

* **Domain név:** `dev.visibill.hu`
* **DNS beállítás:** A rekord mutat a DigitalOcean dropletünkre: `64.226.83.137`
* **Webkiszolgáló:** Caddy Web Server (automatikus Let's Encrypt SSL/TLS tanúsítványkezeléssel).
* **Caddyfile konfiguráció:**
  ```caddyfile
  dev.visibill.hu {
      root * /home/jani/dev-visibill/dist
      file_server
      try_files {path} /index.html
      encode zstd gzip
  }
  ```
* **Telepítési könyvtár:** `/home/jani/dev-visibill/dist` (tulajdonos: `jani:jani`, jogok: `775`).

---

## 🗄️ 2. Dev Adatbázis (Supabase)

* **Projekt Hivatkozás (Ref):** `qhvcdqkqpgpdxogqqvyr`
* **Projekt URL:** `https://qhvcdqkqpgpdxogqqvyr.supabase.co`
* **Régió:** `eu-west-1` (Frankfurt)
* **Közvetlen PostgreSQL Csatlakozás (Session Pooler / IPv4):**
  * **Host:** `aws-0-eu-west-1.pooler.supabase.com`
  * **Port:** `5432` *(vagy tranzakciós mód: `6543`)*
  * **Felhasználó:** `postgres.qhvcdqkqpgpdxogqqvyr`
  * **Adatbázis:** `postgres`
  * *Megjegyzés:* A Supabase direkt `db.<ref>.supabase.co` címe kizárólag IPv6 címet ad vissza. Olyan környezetekben, ahol nincs IPv6 útválasztás (pl. DigitalOcean droplet vagy Docker híd), mindig az AWS IPv4 Supabase Poolert kell használni.

---

## ⚡ 3. Edge Functions

A Dev Supabase projektre az éles rendszer mind a **71 aktív Edge Function**-je telepítve lett:
* Számlafeldolgozás és OCR triggerek (`trigger-invoice-processing`, `trigger-bank-statement-processing`)
* NAV integrációs végpontok (`nav-token`, `nav-sync`, `nav-query-outbound-invoices`, `nav-fetch-details`)
* Rendszer- és menedzsment API-k (`management-stats`, `tickets-api`, `customer-api`, `accounty-generate-deadlines`)
* Értesítési végpontok (`send-email`, `send-welcome-email`, `send-invoice-notification`)

---

## 🔒 4. Hitelesítés és Jogosultságok a Dev Környezetben

A Dev környezet saját `auth.users` nyilvántartással rendelkezik. A következő felhasználók aktívak:

### Menedzsment Felhasználók (Platform Adminisztrátorok)
* `role: thinkai` attribútummal ellátva a `user_roles` táblában.
* Teljes hozzáférés a Management Dashboardhoz (`/management`) és az összes funkcióhoz.
* Felhasználók:
  1. `management@thinkai.hu`
  2. `aron@thinkai.hu`
  3. `notbyalongway@thinkai.hu`
  4. `ati@thinkai.hu`
  5. `balage@thinkai.hu`

### Kliens Felhasználó
* `notbyalongway@gmail.com`
* Hozzáférése van mindhárom átemelt céghez (`owner` tagsággal):
  * **Think Ai Kft**
  * **Teszt Kft**
  * **Taxology Kft.**
