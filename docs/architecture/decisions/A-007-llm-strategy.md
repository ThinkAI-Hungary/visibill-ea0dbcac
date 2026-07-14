# A-007: LLM Stratégia (LiteLLM, Multi-Provider)

**Status:** Decided  
**Date:** 2025-Q3 (implementálva) → Folyamatosan frissítve  
**Forrás:** [Worker ARCHITECTURE.md](../../../worker/docs/ARCHITECTURE.md) §5, [Worker DECISIONS.md](../../../worker/docs/DECISIONS.md) ADR-002, ADR-014

## Context

A rendszer LLM-et használ számlakivonásra, kategorizálásra, tranzakció párosításra, GL besorolásra. Kezdetben közvetlenül DeepSeek API-t használtunk. Amikor modellt akartunk váltani (GPT-4o, Claude), minden hívást át kellett volna írni.

## Decision

**LiteLLM** — egységes, modell-agnosztikus API wrapper. Modell váltás = 1 env var módosítás (`MODEL_NAME`).

---

### Modell Váltási Történet

| # | Modell | LiteLLM ID | Időszak | Miért váltottunk |
|---|--------|-----------|---------|-----------------|
| 1 | DeepSeek-V3 | `deepseek/deepseek-chat` | 2025 Q3 | Eredeti modell, olcsó |
| 2 | DeepSeek-V4-Flash | `deepseek/deepseek-v4-flash` | 2025 Q4 | Gyorsabb, olcsóbb |
| 3 | GPT-4o | `openai/gpt-4o` | 2026 Q1 | Drága, de pontosabb |
| 4 | **Claude Sonnet 4** | `anthropic/claude-sonnet-4-20250514` | 2026 Q2 → **jelenleg** | Legjobb ár/minőség |

> A váltás mindig 1 env var módosítás volt, köszönhetően a LiteLLM absztrakciónak — **zero kód módosítás**.

---

### Prompt Rendszer

Minden prompt `.md` fájl a `worker/prompts/` mappában. A `prompts.py` modul betölti és `functools.lru_cache`-eli.

| Prompt fájl | Pipeline | Cél |
|---|---|---|
| `klaszter.md` | Invoice | Számla típus klasszifikáció (router) — ~64 token output |
| `sima_szamla.md` | Invoice | Standard számla extrakció |
| `vegszamla.md` | Invoice | Végszámla (előleg elszámolás) |
| `dijbekero_proforma.md` | Invoice | Díjbekérő/proforma |
| `egyszerusitett_szamla.md` | Invoice | Egyszerűsített számla |
| `berjarulek_klaszter.md` | Payroll | Bér/járulék típus klasszifikáció |
| `berjegyzek.md` | Payroll | Bérjegyzék extrakció |
| `utalas_lista.md` | Payroll | Átutalási lista |
| `jarulek.md` | Payroll | Járulék/adó extrakció |
| `tipus_kateg.md` | Transaction | Tranzakció kategorizálás (15 kategória) |
| `tranzakcio_parositas.md` | Transaction | Tranzakció-számla AI matching |
| `tranzakcio_tetelesites.md` | Transaction | PDF OCR cleanup (AI fallback) |
| `ledger.md` | GL | Főkönyvi besorolás (batch, account_index) |

**Two-stage AI pipeline (classify → extract):**
1. **Classification (Router)**: `klaszter.md` → melyik típusú a dokumentum?
2. **Extraction**: típus-specifikus prompt → struktúrált adat (Pydantic model)

Kisebb, fókuszáltabb promptok = jobb pontosság. Új típus hozzáadása = 1 új prompt + 1 Pydantic model.

---

### Retry Stratégia (Tenacity)

```python
retry(
    stop=stop_after_attempt(5),
    wait=wait_exponential(min=1, max=60),
    retry=retry_if_exception_type((
        RateLimitError, APIConnectionError, 
        ServiceUnavailableError, ConnectionError, TimeoutError
    ))
)
```

- 5 próbálkozás, exponenciális backoff (1s → 2s → 4s → 8s → 16s, max 60s)
- Csak transziens hibáknál retry (rate limit, connection, timeout)
- Permanens hibáknál (invalid request, auth) azonnal fail

---

### Concurrency Control

| Kontextus | Limit | Miért |
|-----------|-------|-------|
| Invoice AI (multi-PDF) | `Semaphore(5)` | Max 5 párhuzamos LLM hívás nagy PDF feldolgozásnál |
| GL batch classification | `BATCH_SIZE=30` | 30 tétel/API hívás — A számlatükör egyszer elküldve. A limit optimalizált a válaszcsonkítás ellen, DeepSeek prompt caching (85%+) és okos caching deduplikáció támogatással. |
| Transaction categorization | `Semaphore(5)` | AI kategorizálás párhuzamosítás |
| GL classification safeguards | Caching, Circuit Breaker, JSON Repair | A főkönyvi besorolást védő és optimalizáló háromlépcsős biztonsági rendszer. |

---

### GL Besorolási Védelmi Rendszerek (Safeguards)

A főkönyvi besorolások megbízhatóságát és költséghatékonyságát az alábbi háromlépcsős beépített védelmi rendszer garantálja:

1. **Okos Caching / Deduplikáció (Exact Match Cache):**
   A bejövő tételeket a `(direction, partner_name, description)` hármas alapján egyedi csoportokba rendezzük a futás előtt. Az API-nak csak az egyedi tételeket küldjük el, majd a visszakapott besorolásokat átmásoljuk a duplikátumokra (arányosan elosztva a tokenköltséget). A Supabase-be való mentési callbackeket viszont minden tételnél külön-külön lefuttatjuk, így az adatbázisban minden sor megfelelően rögzül. Ez ismétlődő adatoknál **akár 90% feletti token- és költségmegtakarítást** eredményez.

2. **Áramkör-megszakító (Circuit Breaker):**
   A `CircuitBreakerTracker` nyomon követi a teljesített batch-ek hibáit. Ha egy feladat futása során **3 batch teljesen meghiúsul** (azaz a batch hívás és az egyedi fallback hívások is hibát dobnak), az áramkör leold. Minden futó és függőben lévő hívás azonnal leáll, megvédve a rendszert a végtelen hiba-ciklusoktól és a felesleges API költségektől.

3. **JSON-repair (Automatikus válasz-javítás):**
   Ha a DeepSeek válasza hálózati okok vagy határértékek miatt megsérül vagy csonkolódik (pl. hiányzó zárójelek/idézőjelek a JSON végén), a rendszer másodlagos mentőövként a `json_repair` csomag segítségével megpróbálja helyreállítani a struktúrát. Ha a javítás sikeres, a batch feldolgozása folytatódik, elkerülve az egyesével futó drága fallback hívásokat.

---

### LLM Cost Tracking

**Minden AI hívás költsége rögzítve** a `llm_koltsegek` DB táblába.

```python
# llm_tracker.py
tracker = LLMCostTracker(file_name="szamla.pdf", pipeline="invoice")
tracker.add(response)          # Minden litellm hívás után
tracker.drain_vision_costs()   # Vision OCR költségek begyűjtése (2026-06-28)
await tracker.save(upload_id=..., company_id=...)  # Pipeline végén → DB
```

**Rögzített adatok:**
- Input/output token count (text LLM + Vision OCR összesítve)
- Modell neve (per-model tracking: DeepSeek + gpt-4o külön)
- Becsült költség (USD) — per-model árazással kalkulálva
- Feldolgozási idő (ms)
- Pipeline típus (invoice/transaction/gl/payroll)

**Vision OCR Cost Tracking** (hozzáadva: 2026-06-28):

A gpt-4o Vision hívások (`_send_to_vision_api`, `_vision_ocr_page`) module-level
`VisionCostAccumulator`-ban gyűlnek, amit a worker pipeline `drain_vision_costs()`-szal
olvas ki a `tracker.save()` előtt. Így a Vision és text LLM költségek egyetlen
`llm_koltsegek` rekordban jelennek meg, per-model bontásban.

```
ocr_markitdown.py / pdf_splitter.py    →    VisionCostAccumulator (module-level)
                                                    ↓
worker.py: tracker.drain_vision_costs()  →  LLMCostTracker._model_usage
                                                    ↓
                                            tracker.save() → llm_koltsegek DB
```

**Modell árazás (hardcoded a kódban, per 1M token, USD):**

| Modell | Input | Output |
|--------|-------|--------|
| DeepSeek V4 Flash | $0.14 | $0.28 |
| Claude Sonnet 4 | $3.00 | $15.00 |
| GPT-4o (Vision OCR) | $2.50 | $10.00 |
| GPT-4o-mini | $0.15 | $0.60 |

---

### Konfiguráció

```env
MODEL_NAME=anthropic/claude-sonnet-4-20250514  # LiteLLM model ID
AI_TEMPERATURE=0.0                            # Determinisztikus output
AI_MAX_TOKENS=4096                            # Max output tokenek
OCR_VISION_MODEL=gpt-4o                       # Vision OCR modell (külön)
```

- `AI_TEMPERATURE=0.0` — determinisztikus output (konzisztens extrakció)
- A Vision OCR modellje **külön konfigurálható** (`ocr_vision_model`) — mindig GPT-4o, mert a Vision API Anthropic-nál eltérően működik

---

### Feladatonkénti Modell Használat

| Feladat | LLM | Vision? | Miért |
|---------|-----|---------|-------|
| Számla klasszifikáció | Claude Sonnet 4 | Nem | Gyors router, ~64 token output |
| Adatkinyerés (extraction) | Claude Sonnet 4 | Nem | Strukturált JSON, magas pontosság |
| GL kategorizálás | Claude Sonnet 4 | Nem | Batch mode (10 item/call) |
| Tranzakció kategorizálás | Claude Sonnet 4 | Nem | 15 kategória közül választ |
| Tranzakció párosítás | Claude Sonnet 4 | Nem | Reasoning + few-shot |
| Scanned PDF OCR | **GPT-4o Vision** | **Igen** | Képfeldolgozás, barcode skip |
| PDF OCR cleanup | Claude Sonnet 4 | Nem | Fallback tranzakciós PDF-ekhez |

## Consequences

**Pozitív:**
- Provider switch = 1 env var → zero kód módosítás (4× bizonyított)
- Költség optimalizálás — feladatonként más modell (Vision vs text)
- Teljes költség transzparencia a `llm_koltsegek` táblából
- Two-stage pipeline → kisebb, pontosabb promptok
- Determinisztikus output (temperature=0.0) → konzisztens extraction

**Negatív:**
- LiteLLM dependency — ha a library változik, frissíteni kell
- Prompt-ok implicitven Claude-ra optimalizáltak lehetnek (JSON mode, tool calling eltérések)
- A modell árazás hardcoded → manuálisan frissítendő árváltozáskor
- A Vision OCR részben LiteLLM-en (ocr_markitdown.py), részben közvetlen OpenAI SDK-n (pdf_splitter.py) megy — nem teljesen provider-agnosztikus
- A Vision cost tracking module-level accumulator-ra épül — nem a legelegánsabb, de minimális coupling

## Kapcsolódó ADR-ek (Worker)
- [Worker ADR-002: LiteLLM mint AI wrapper](../../../worker/docs/DECISIONS.md#adr-002-litellm-mint-ai-wrapper)
- [Worker ADR-004: Two-stage AI pipeline](../../../worker/docs/DECISIONS.md#adr-004-two-stage-ai-pipeline-classify--extract)
- [Worker ADR-014: Model váltási történet](../../../worker/docs/DECISIONS.md#adr-014-model-váltási-történet)
- [Worker ADR-016: AI Confidence cap](../../../worker/docs/DECISIONS.md#adr-016-ai-confidence-cap-és-post-ai-verificáció)
