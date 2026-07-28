# ⚡ Circuit Breaker Pattern (Áramköri Megszakító Minta)

> **Utoljára frissítve:** 2026-07-25  
> **Kapcsolódó doksi:** [A-035: Three-Way Fallback Pipeline](../../architecture/decisions/A-035-three-way-fallback-redirection.md) | [GLOSSARY Index](../index.md)

---

## 📖 Fogalom Meghatározása

A **Circuit Breaker (Áramköri Megszakító)** egy szoftvertervezési minta (Design Pattern), amely a szoftverrendszerek **hibatűrését (fault tolerance)** biztosítja külső függőségek (pl. harmadik fél API-k, adatbázisok, mikroszolgáltatások) meghibásodása esetén.

Ahogy az otthoni elektromos biztosíték lekapcsol túlterhelésnél, a szoftveres Circuit Breaker is **ideiglenesen megszakítja a hívásokat a meghibásodott külső API felé**, megelőzve az erőforrás-pazarlást, a kérések feltorlódását és az egész alkalmazás összeomlását.

---

## 🔄 A Circuit Breaker 3 Állapota

```
      [ Normal Működés ]
         CLOSED (Zárt)
            │
            │  (Többszöri hiba / Timeout elérte a küszöböt)
            ▼
        OPEN (Nyitott)  ───►  [ Azonnali Hiba / Fallback küldése ]
            │                 (Nincs várakozás a rossz API-ra)
            │
            │  (Próbaidő lejárta után, pl. 60mp)
            ▼
    HALF-OPEN (Félig Nyitott)
      ┌─────┴─────┐
      │           │
(Teszt kérés    (Teszt kérés
 sikeres)        sikertelen)
      │           │
      ▼           ▼
   CLOSED       OPEN
```

1. **CLOSED (Zárt — Normál):** A kérések átmennek a külső API felé. Ha a hibák száma eléri a megadott küszöbértéket, áttér `OPEN` állapotba.
2. **OPEN (Nyitott — Megszakítva):** A kérések **azonnal megbuknak (fail-fast)** anélkül, hogy megpróbálnák felhívni a külső szolgáltatást. Az alkalmazás azonnal a tartalék (fallback) logikát futtatja.
3. **HALF-OPEN (Félig nyitott — Tesztelés):** Egy rövid idő elteltével a rendszer átenged 1-2 teszt kérést. Ha azok sikeresek, visszaáll `CLOSED` állapotba; ha hibáznak, visszaugrik `OPEN`-re.

---

## 💡 Használat a Visibill Architektúrában

1. **LLM Provider Fallback (LiteLLM):**  
   Ha az OpenAI API elakad vagy rate-limitet ad (HTTP 429 / 500), az LLM kérések automatikusan átirányítódnak a másodlagos modellre (pl. DeepSeek v4 Flash).

2. **Háromirányú Pipeline Fallback (`A-035`):**  
   Ha egy K&H tranzakciós parser hibára fut, a feldolgozás nem áll le, hanem a rendszer átsorolja a számla pipeline-ba (`invoice_jobs`).

3. **NAV Online Számla API Védelme:**  
   Ha a NAV szervere karbantartás alatt áll (HTTP 503), a `nav-sync` nem próbálja meg percenként felhívni, hanem késlelteti az ad-hoc lekérdezéseket.
