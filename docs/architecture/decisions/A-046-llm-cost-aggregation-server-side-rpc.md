# A-046: LLM Cost Aggregation via Server-Side SECURITY DEFINER RPCs

**Status:** Decided  
**Date:** 2026-07-25  
**Utoljára frissítve:** 2026-07-25  

## Context

A Management Dashboard-on az LLM költségek aggregálása (mind a havi, mind az összesített nézetben) elengedhetetlen a platform cross-project (PROD, VSWEB, THINKERMAN) pénzügyi áttekintéséhez. 

PostgREST kliens hívások használatakor a következő problémák merültek fel:
1. **PostgREST `max_rows` limit (alapértelmezetten 1000 sor):** Amikor a `llm_koltsegek` tábla rekordjainak száma meghaladta az 1000 sort, a sima `.select('estimated_cost_usd, ...')` csonkolt adatokat adott vissza, ami pontatlan aggregált összegekhez vezetett.
2. **Kliens oldali memóriaterhelés:** 50,000+ rekord közvetlen lekérése kliens oldali service role kulccsal lassította az Edge Function válaszidejét és memóriafogyasztását.
3. **`STABLE` vs `VOLATILE` tranzakciós korlát (VSWEB PostgREST Error 25006):** Bizonyos Supabase/PostgREST környezetekben (pl. VSWEB) a `STABLE` jelöléssel ellátott RPC-k read-only tranzakcióban futnak, ami PostgREST `POST` kéréseknél `ERROR 25006: cannot execute INSERT in a read-only transaction` hibával leállt, lebuktatva az aggregációt direct query fallback-re (ami a 1000 soros korlátba ütközött).

## Decision

1. **Szerver-oldali PostgreSQL Aggregációs RPC-k:**
   PostgreSQL oldalon `SECURITY DEFINER` tárolt eljárásokat hozunk létre mindhárom adatbázisban:
   - `get_llm_cost_full_agg(since_date TIMESTAMPTZ DEFAULT NULL)`: visszaadja az Összesített/Periodikus LLM aggregált mutatókat (total_cost, total_jobs, total_input_tokens, total_output_tokens, by_pipeline, by_model, top_companies, daily_trend).
   - `get_monthly_llm_by_company(p_year INT DEFAULT NULL, p_month INT DEFAULT NULL)`: visszaadja a havi cégenkénti és platform-szintű aggregált költségeket.

2. **`VOLATILE` Tranzakciós Minősítés:**
   A PostgREST read-only tranzakcióból fakadó 25006-os hibájának elkerülésére az aggregációs RPC-ket explicit módon `VOLATILE` tulajdonsággal hozzuk létre mindhárom Supabase projekten (`PROD`, `VSWEB`, `THINKERMAN`).

3. **Array-Unwrap & Defensív Handling az Edge Function-ben (`management-stats`):**
   A `management-stats` Edge Function `buildLLMCosts` és `fetchMultiProjectMonthlyLlm` metódusai közvetlenül ezeket az RPC-ket hívják. Az RPC visszatérési értékénél felkészülünk mind JSONB objektum, mind tömb formátumú válaszokra (`Array.isArray(rpcRaw) ? rpcRaw[0] : rpcRaw`).

## Consequences

**Pozitív:**
- **Nincs sor-korlát (No 1000-row limit):** Az aggregáció a PostgreSQL adatbázismotoron belül fut le `SUM()`, `COUNT()` és `jsonb_object_agg()` használatával, függetlenül a sorok számától.
- **Konzisztens és Gyors:** Dramatikusan csökkent hálózati forgalom az EF és a DB között.
- **Stabil Cross-Project Hívások:** A `VOLATILE` jelölés garantálja, hogy VSWEB és egyéb külső Supabase projekteken sem akad el az RPC a PostgREST tranzakciós megszorításain.

**Negatív:**
- Mivel az RPC-k `SECURITY DEFINER` jogkörrel futnak, az adatbázisban explicit `VOLATILE SET search_path TO 'public'` beállítás kötelező a biztonsági kockázatok elkerülésére.

## Kapcsolódó
- [A-019: Management Dashboard Architektúra](./A-019-management-dashboard.md)
