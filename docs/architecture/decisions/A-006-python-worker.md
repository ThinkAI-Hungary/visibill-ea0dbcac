# A-006: Python Worker Architektúra

**Status:** Decided  
**Date:** 2025-09

## Context

A dokumentumfeldolgozás (OCR, LLM, matching) CPU-intenzív és Python-specifikus könyvtárakat igényel. Az Edge Functions (Deno) nem alkalmas erre.

## Decision

**Python 3.12 asyncio worker**, Docker container-ben, DigitalOcean Droplet-en:

- **Runtime:** asyncio event loop — párhuzamos I/O (LLM API hívások)
- **DB:** supabase-py (Python Supabase SDK)
- **LLM:** LiteLLM — provider-független wrapper (OpenAI, Anthropic, stb.)
- **OCR:** MarkItDown (dokumentum → markdown) + Vision OCR (képfeldolgozás)
- **Queue:** PGMQ poll loop — 5 queue figyelése párhuzamosan
- **Deployment:** Docker Compose, DigitalOcean Droplet

**Workspace:** `d:\ThinkAI\Visibill\worker\` (külön repo)

## Consequences

**Pozitív:**
- Teljes Python ML/AI ökoszisztéma elérhető
- asyncio — hatékony I/O várakozás (LLM API: ~2-10s per request)
- Docker — reprodukálható, izolált környezet
- Service role key → RLS bypass → hatékony batch feldolgozás

**Negatív:**
- Külön deployment pipeline (nem Supabase-en belül)
- Monitoring igényes (healthcheck, log aggregálás)
- Cold start nincs (always-on container) → fix költség

## Kapcsolódó
- **BRD:** [034-worker-pipeline.md](../../business/decisions/034-worker-pipeline.md) — üzleti scope
- **BRD:** [008-document-pipeline.md](../../business/decisions/008-document-pipeline.md) — pipeline típusok
- **ADR:** [A-025-cross-company-routing.md](./A-025-cross-company-routing.md) — multi-company invoice routing
- **Worker docs:** [ARCHITECTURE.md](../../../worker/docs/ARCHITECTURE.md) — részletes technikai doc (1100+ sor)

## Verification & Testing

A Python Worker kódjának helyességét egy **56 tesztből álló automatizált teszt pipeline** biztosítja, ami a `worker/test/unit_test/` könyvtárban található.

A tesztek futtatása a worker gyökeréből indítható a `run_tests.py` script segítségével:
- **Gyors tesztek (Fast tests):** `python run_tests.py` (API hívások nélkül, ~10mp). Főleg karakterfelismerést, vágást és pozíciópárosítást tesztel.
- **Teljes csővezeték tesztek (Full pipeline):** `python run_tests.py --full` (GPT-4o Vision és AI extraction, ~3p).

A tesztelési részleteket és szabályokat a [Worker unit_test README.md](../../../worker/test/unit_test/README.md) dokumentálja. A gyors tesztek lefutása kötelező minden push előtt.

