# 🐳 Docker & Konténerizáció

> **Utoljára frissítve:** 2026-07-25  
> **Kapcsolódó doksi:** [A-006: Python Worker Architecture](../../architecture/decisions/A-006-python-worker.md) | [GLOSSARY Index](../index.md)

---

## 📖 Fogalom Meghatározása

A **Docker** egy nyílt forráskódú konténerizációs platform, amely lehetővé teszi alkalmazások és azok összes függőségének (könyvtárak, runtime, konfigurációk) egyetlen hordozható **konténerbe (Container)** történő csomagolását.

A konténerizáció garantálja a *"nálam működik, a szerveren nem"* hiba elkerülését, mivel a fejlesztői környezet és az éles szerverkörnyezet 100%-ban megegyezik.

---

## 🔑 Főbb Fogalmak & Termek

| Kifejezés | Definíció | Szerepe a Visibillben |
|---|---|---|
| **Dockerfile** | Szöveges leírófájl, amely lépésről lépésre meghatározza a konténer-kép (Image) felépítését. | `worker/Dockerfile` — Python 3.12, system dependency-k (poppler, tesseract, ffmpeg), uv dependency manager. |
| **Docker Image** | Statikus, módosíthatatlan sablon (blueprint), amiből a konténerek elindulnak. | GitHub Container Registry-ben (GHCR) tárolt buildelt image. |
| **Docker Container** | A futó Image példány (izolált processz saját fájlrendszerrel és hálózattal). | Szerveren futó worker konténerek (`visibill-worker-prod`, `visibill-worker-vsweb`, `visibill-worker-thinkerman`). |
| **Docker Compose** | Több konténerből álló alkalmazások elindítására és hálózati összekötésére szolgáló YAML leíró. | `docker-compose.yml` — a 3 projekt worker konténerének és környezeti változóinak leírója. |

---

## 💡 Használat a Visibill Architektúrában

A Visibill háttér-feldolgozója egy **autonóm Python worker service**, amely Docker konténerekben fut egy DigitalOcean szerveren.

### "Egy Image — Három Konténer" Minta
A CI/CD pipeline egyetlen Docker image-et buildel a `worker/` forráskódból. Ezt az image-et a szerveren 3 különböző konténerként indítjuk el eltérő `.env` paraméterekkel:

```yaml
# docker-compose.yml szemléltetés
services:
  worker-prod:
    image: ghcr.io/thinkai/visibill-worker:latest
    environment:
      - SUPABASE_URL=${PROD_SUPABASE_URL}
      - SUPABASE_SERVICE_ROLE_KEY=${PROD_SERVICE_KEY}

  worker-vsweb:
    image: ghcr.io/thinkai/visibill-worker:latest
    environment:
      - SUPABASE_URL=${VSWEB_SUPABASE_URL}
      - SUPABASE_SERVICE_ROLE_KEY=${VSWEB_SERVICE_KEY}

  worker-thinkerman:
    image: ghcr.io/thinkai/visibill-worker:latest
    environment:
      - SUPABASE_URL=${THINKERMAN_SUPABASE_URL}
      - SUPABASE_SERVICE_ROLE_KEY=${THINKERMAN_SERVICE_KEY}
```

---

## ⚙️ Hasznos Docker Parancsok (Worker Ops)

```bash
# Konténerek állapotának és CPU/RAM használatának ellenőrzése:
docker ps
docker stats

# Worker logok valós idejű követése:
docker logs -f visibill-worker-prod --tail 100

# Újabb verzió letöltése és újraindítás leállás nélkül:
docker compose pull && docker compose up -d
```
