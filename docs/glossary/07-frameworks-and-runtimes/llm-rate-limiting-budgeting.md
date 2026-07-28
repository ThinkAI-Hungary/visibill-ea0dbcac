# 🧠 LLM Rate Limiting, Token Budgeting & Cost Tracking

> **Utoljára frissítve:** 2026-07-25  
> **Kapcsolódó doksi:** [A-007: LLM Strategy](../../architecture/decisions/A-007-llm-strategy.md) | [A-046: LLM Cost Aggregation](../../architecture/decisions/A-046-llm-cost-aggregation-server-side-rpc.md) | [GLOSSARY Index](../index.md)

---

## 📖 Fogalom Meghatározása

Az **LLM Rate Limiting & Token Budgeting** az AI modellek (OpenAI, DeepSeek, Anthropic) használatának korlátozására, költségkontrolljára és hibatűrésére szolgáló infrastruktúra réteg.

Az LLM API-k két fő korláttal működnek:
- **RPM (Requests Per Minute):** Percenként indítható maximális kérések száma.
- **TPM (Tokens Per Minute):** Percenként elküldhető/fogadható maximális token számláló.

---

## 🏗️ Az LLM Kontroll Réteg a Visibillben

```
 [ Worker Pipeline ] ──► [ LLMCostTracker (llm_tracker.py) ]
                                   │
                                   ├── LiteLLM Multi-Provider Proxy
                                   │   ├── Primary: DeepSeek v4 Flash (Olcsó & Gyors)
                                   │   ├── Secondary: GPT-4o (Vision & Komplex)
                                   │   └── Fallback: DeepSeek Chat (HTTP 429 / 500 esetén)
                                   │
                                   ▼
                       [ llm_koltsegek DB Table ]
```

---

## 🔑 Főbb Fogalmak & Funkciók

| Kifejezés | Definíció & Működés a Visibillben |
|---|---|
| **Token Budgeting** | Input (prompt) és Output (completion) tokenek pontos számlálása minden hívásnál. Az árazási modellek alapján a rendszer kiszámolja a dollár-alapú költséget (`estimated_cost_usd`). |
| **Model Fallback (LiteLLM)** | Ha a fő modell `RateLimitError` (HTTP 429) vagy szerver hibát dob, a LiteLLM automatikusan átirányítja a kérést a másodlagos szolgáltatóhoz a worker megállása nélkül. |
| **Per-Model Splitting** | Ha egy számla feldolgozása több modellt is használ (pl. DeepSeek klasszifikáció + GPT-4o Vision), a tracker külön sorokként rögzíti őket az `llm_koltsegek` táblában modell nevenként. |
| **Management Dashboard Integration** | A Management Dashboard server-side RPC-kkel (`A-046`) jeleníti meg a napi/havi költség trendeket és a modellek százalékos megoszlását. |

---

## ⚙️ Tenacity Retry Policy (Exponential Backoff)

A worker az LLM kéréseket `tenacity` retry decorator-ral védi:

```python
@retry(
    stop=stop_after_attempt(3),
    wait=wait_random_exponential(min=1, max=10),
    retry=retry_if_exception_type((RateLimitError, APIConnectionError))
)
async def call_llm_with_retry(...):
    # LiteLLM hívás...
```
