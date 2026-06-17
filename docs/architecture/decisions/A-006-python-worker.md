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
- **Worker docs:** [ARCHITECTURE.md](../../../worker/docs/ARCHITECTURE.md) — részletes technikai doc (821 sor)

