# Fejlesztési Munkafolyamat és CI/CD (Development Workflow)

Ez a dokumentum a VisiBill fejlesztői munkafolyamatát, a lokális futtatást, a Supabase konfigurációt és a CI/CD élesítési szabályait írja le.

---

## 🌿 1. Git Ág-stratégia (Branching Model)

* **`main` ág:** Termelési (Production) kód. 
  * Élesítés: Vercel / Éles szerver.
  * Adatbázis: Éles Supabase (`vxxgvdlqvvchtlmqnrqf`).
  * Közvetlen push tilos; kizárólag tesztelt `develop` ágról érkező Pull Request útján módosítható!
* **`develop` ág:** Fejlesztői (DEV) kód.
  * Élesítés: Droplet weboldal (**[https://dev.visibill.hu](https://dev.visibill.hu)**).
  * Adatbázis: Dev Supabase (`qhvcdqkqpgpdxogqqvyr`).
  * Automatikus CI/CD: Minden `develop` ágra pusholt commit automatikusan lefordul és frissíti a dev weboldalt.

---

## 💻 2. Lokális Fejlesztés a Saját Gépeden

### Környezeti Változók ([`.env.local`](file:///d:/ThinkAI/Visibill/eaisybill-prod/.env.local))
A helyi gép konfigurációja a Dev Supabase projektre mutat:

```env
VITE_SUPABASE_PROJECT_ID="qhvcdqkqpgpdxogqqvyr"
VITE_SUPABASE_PUBLISHABLE_KEY="sb_publishable_-q9BrS7Z50wqPzlEJnLosg_uk8KJ6-R"
VITE_SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
VITE_SUPABASE_URL="https://qhvcdqkqpgpdxogqqvyr.supabase.co"
```

* **Futtatás helyben:**
  ```powershell
  npm run dev
  ```
* **Helyi webcím:** `http://localhost:8080`
* **Biztonság:** A helyi fejlesztés közben elvégzett műveletek, új számlák, partnerek vagy tesztadatok **kizárólag a Dev Supabase adatbázisban jönnek létre**, az éles környezet teljesen védett.

---

## ⚙️ 3. Supabase CLI és Adatbázis Migrációk

### Konfiguráció ([`supabase/config.toml`](file:///d:/ThinkAI/Visibill/eaisybill-prod/supabase/config.toml))
* A `develop` ágon a `project_id` értéke:
  ```toml
  project_id = "qhvcdqkqpgpdxogqqvyr"
  ```
* A fájl verziókövetett, tartalmazza az összes Edge Function JWT ellenőrzési szabályát.
* A helyi CLI állapotkönyvtár (`supabase/.temp/`) a `.gitignore` fájlba került, így nem okoz felesleges git diffet.

### Hogyan történik egy új adatbázis migráció?
1. **Fejlesztés a Dev környezetben:**
   * Új SQL szkript létrehozása a `supabase/migrations/` mappában.
   * A migráció Dev adatbázisra futtatása:
     * **AI asszisztenssel:** A `supabase-visibill-dev` MCP eszköz közvetlenül a dev adatbázison hajtja végre.
     * **CLI-vel:** `npx supabase db push` (a beállított `qhvcdqkqpgpdxogqqvyr` projektre küldi).
2. **Átvezetés a Termelési (Prod) Környezetbe:**
   * Amikor a funkció tesztelt és működik a `dev.visibill.hu` oldalon, a `develop` ágról PR készül a `main` ágra.
   * A `main` ágra merge-elés után a Supabase hivatalos GitHub integrációja automatikusan alkalmazza az új migrációt az éles adatbázison.

---

## 🤖 4. Automatikus GitHub Actions CI/CD ([`.github/workflows/deploy-dev.yml`](file:///d:/ThinkAI/Visibill/eaisybill-prod/.github/workflows/deploy-dev.yml))

Minden `develop` ágra történő `git push` esetén lefut a következő munkafolyamat:

1. **Kód letöltése és Node.js környezet:** Ubuntu-latest runneren Node.js 20 beállítása npm gyorsítótárral.
2. **Függőségek telepítése:** `npm ci || npm install`.
3. **Kódminőség ellenőrzés (Oxlint):** `npx oxlint src/`.
4. **TypeScript Típusellenőrzés:** `npx tsc --noEmit`.
5. **Frontend Fordítás (Vite):** A Dev Supabase környezeti változóival lefordul az éles SPA bundle (`dist/`).
6. **Élesítés a Dropletre (Rsync + SSH):**
   * A GitHub Repository Secret-ben (`DROPLET_SSH_KEY`) tárolt Ed25519 privát kulccsal hitelesít.
   * Automatikus kulcstisztítás (szóközök, behúzások és CRLF eltávolítása).
   * Rsync szinkronizáció a droplet `/home/jani/dev-visibill/dist/` mappájába.
   * A teljes lefutási idő kb. **1,5 perc**.

---

## 🛡️ 5. Fejlesztői Minőségbiztosítási Lépések (Pre-Commit)

Mielőtt commitot készítesz a `develop` ágon, kötelezően ellenőrizd:

```powershell
# 1. Gyors oxlint vizsgálat:
npm run lint:fast

# 2. TypeScript típusellenőrzés:
npx tsc --noEmit
```
