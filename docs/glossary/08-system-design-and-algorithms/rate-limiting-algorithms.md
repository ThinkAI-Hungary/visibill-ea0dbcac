# ⏱️ Rate Limiting Algoritmusok (Túlterhelés Elleni Védelem)

> **Utoljára frissítve:** 2026-07-25  
> **Kapcsolódó doksi:** [LLM Rate Limiting](../07-frameworks-and-runtimes/llm-rate-limiting-budgeting.md) | [GLOSSARY Index](../index.md)

---

## 📖 Fogalom Meghatározása

A **Rate Limiting (Kéréskorlátozás)** egy olyan hálózati és alkalmazás-szintű biztonsági eljárás, amely szabályozza, hogy egy adott kliens (IP cím, API kulcs, felhasználó) **hány kérést küldhet a szerver felé egy megadott időablakon belül**.

Célja a webszerverek védelme a túlterheléstől (DDoS támadások, bot scraping), a fair-use kapacitáselosztás és a külső API (pl. OpenAI / NAV) költségeinek kontrollálása.

---

## 📊 A 4 Fő Rate Limiting Algoritmus

| Algoritmus | Működési Elv | Előnyök & Hátrányok | Használata |
|---|---|---|---|
| **1. Token Bucket** | Egy "vödörbe" fix sebességgel érkeznek a zsetonok. Minden HTTP kérés kivesz 1 zsetont. Ha a vödör üres, a kérés elutasításra kerül (HTTP 429). | **Megengedi a rövid kiugró forgalmat (Bursting).** Egyszerű és memóriahatékony. | **LiteLLM / OpenAI API** kérések kezelése a Visibill workerben. |
| **2. Leaky Bucket** | A kérések belefolynak a vödörbe, de a szerver csak fix, egyenletes sebességgel engedi ki azokat feldolgozásra. | Garantálja a sima, egyenletes szerver-terhelést. Kicsit késleltetheti a kéréseket. | Queue feldolgozás és NAV API szinkronizáció. |
| **3. Fixed Window Counter** | Fix időablakokat (pl. 12:00:00 - 12:01:00) használ. Az ablak elején a számláló 0-ról indul. | Rendkívül egyszerű. **Veszélye a "Boundary Burst":** ha az ablak végén és az új ablak elején küldik a kéréseket, dupla terhelés éri a szervert. | Egyszerűbb API végpontok. |
| **4. Sliding Window Log / Counter** | Gördülő időablakot számol az aktuális időponthoz képest (az elmúlt 60 másodperc). | **100%-ig pontos, nincs ablakhatár-trükközés.** Kicsit több memóriát igényel. | DDoS védelem és Auth bejelentkezési kísérletek korlátozása (Brute-force védelem). |

---

## 💡 Válaszkódok & HTTP Fejlécek

Amikor egy kérés túllépi a megengedett rate limitet, a szerver **`HTTP 429 Too Many Requests`** hibakóddal válaszol:

```http
HTTP/1.1 429 Too Many Requests
Retry-After: 60
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1757970110
```

- **`Retry-After`:** Hány másodperc múlva próbálkozhat újra a kliens.
- **Tenacity Retry (Worker):** A Python worker a HTTP 429 válasz esetén automatikusan elhalasztja a következő próbálkozást (exponential backoff).
