# 🚀 CI/CD — Continuous Integration & Continuous Deployment

> **Utoljára frissítve:** 2026-07-25  
> **Kapcsolódó doksi:** [Docker & Konténerizáció](./docker-containers.md) | [GLOSSARY Index](../index.md)

---

## 📖 Fogalom Meghatározása

A **CI/CD** a szoftverfejlesztésben az **automatizált építési, tesztelési és telepítési folyamatokat** foglalja magában:

- **CI (Continuous Integration — Folyamatos Integráció):** A kódváltoztatások automatikus fordítása, típusellenőrzése és tesztelése minden egyes git push / Pull Request esetén.
- **CD (Continuous Deployment — Folyamatos Kiadás):** A sikeresen tesztelt kód automatikus csomagolása (Docker Image build) és telepítése (Deploy) a staging vagy production szerverre emberi beavatkozás nélkül.

---

## 🏗️ A Visibill CI/CD Pipeline Láncolata

```
 [ Git Push (main branch) ]
            │
            ▼
 ┌─────────────────────────────────────────────────────────────┐
 │ 1. GitHub Actions Workflow (.github/workflows/deploy.yml)   │
 └──────────────────────────┬──────────────────────────────────┘
                            │
                            ▼
 ┌─────────────────────────────────────────────────────────────┐
 │ 2. Automated Build & Typecheck (pytest, tsc)                │
 └──────────────────────────┬──────────────────────────────────┘
                            │ (Ha a tesztek sikeresek)
                            ▼
 ┌─────────────────────────────────────────────────────────────┐
 │ 3. Multi-Stage Docker Image Build -> Push to GHCR            │
 │    (ghcr.io/thinkai/visibill-worker:latest)                 │
 └──────────────────────────┬──────────────────────────────────┘
                            │
                            ▼
 ┌─────────────────────────────────────────────────────────────┐
 │ 4. SSH Remote Deploy to DigitalOcean Droplet                │
 │    (docker compose pull && docker compose up -d)            │
 └─────────────────────────────────────────────────────────────┘
```

---

## 💡 Előnyök a Visibill Számára

1. **Nulla Kézi Telepítési Hiba:** Nem kézzel kell a szerverre másolni a kódot és SSH-zni, a GitHub Actions automatizáltan végzi el a konténerek frissítését.
2. **Gyors Visszajelzés:** Ha egy módosítás elrontja a worker unit teszteket, a CI folyamat azonnal leállítja a buildet és értesítést küld.
3. **Könnyű Rollback:** Ha egy új kiadás hibás, a korábbi sikeres Docker Image tag egyetlen paranccsal visszaállítható.
