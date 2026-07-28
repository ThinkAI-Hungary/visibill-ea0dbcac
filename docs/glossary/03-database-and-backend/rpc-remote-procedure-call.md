# ⚡ RPC — Remote Procedure Call (Adatbázis Tárolt Eljárások)

> **Utoljára frissítve:** 2026-07-25  
> **Kapcsolódó doksi:** [A-016: PostgreSQL Query Strategy](../../architecture/decisions/A-016-postgresql-query-strategy.md) | [A-046: LLM Cost Aggregation Server-Side RPC](../../architecture/decisions/A-046-llm-cost-aggregation-server-side-rpc.md) | [GLOSSARY Index](../index.md)

---

## 📖 Fogalom Meghatározása

Az **RPC (Remote Procedure Call)** az adatbázisban tárolt olyan **PostgreSQL függvény (PL/pgSQL vagy SQL)**, amelyet a Supabase kliens vagy az Edge Function közvetlenül meg tud hívni HTTP REST API-n keresztül:

```typescript
const { data, error } = await supabase.rpc('get_llm_cost_full_agg', { since_date: '2026-07-01' });
```

---

## 💡 Miért használunk RPC-ket a Visibillben?

1. **Komplex Adataggregáció:** Amikor sok ezer sort kell kliens oldali letöltés nélkül összesíteni (pl. LLM költség KPI-k, havi bontások, partner statisztikák).
2. **Sor-korlátok (PostgREST limits) Kikerülése:** A sima PostgREST `.select()` lekérdezések a konfigurált sor-limittel csonkolják a válaszokat. Az RPC-n belüli `SUM()` / `COUNT()` / `jsonb_object_agg()` adatbázison belül fut le, és csak 1 db aggregált JSON objektumot ad vissza.
3. **Tranzakciós Műveletek:** Több táblát érintő módosítások végrehajtása egyetlen atomi műveletben.

---

## ⚙️ Tranzakciós tulajdonságok: `VOLATILE` vs `STABLE` [A-046]

PostgreSQL RPC-k írásakor kulcsfontosságú a függvény tranzakciós jellegének helyes megadása:

| Tulajdonság | Jelentés & PostgREST Viselkedés | Mikor használd? | Visibill Tanulság |
|---|---|---|---|
| **`STABLE`** | Ugyanazon tranzakción belül mindig ugyanazt az eredményt adja. PostgREST néha **read-only tranzakcióban** futtatja. | Egyszerű olvasó lekérdezésekre. | **Figyelem!** Bizonyos Supabase projekteken (pl. VSWEB) a PostgREST `POST` hívása `ERROR 25006: cannot execute INSERT in a read-only transaction` hibát dobott a `STABLE` RPC-re! |
| **`VOLATILE`** | A függvény kimenetele megváltozhat, módosíthat adatokat. PostgREST **read-write tranzakcióban** futtatja. | Módosító és kritikus aggregációs RPC-knél. | **Kötelező az aggregációs RPC-knél** (`get_llm_cost_full_agg`, `get_monthly_llm_by_company`), mert garantálja a read-write kontextust minden Supabase projekten. |
| **`IMMUTABLE`** | Adott bemenetre mindig 100%-ban ugyanaz a kimenet, nincs DB olvasás sem. | Tiszta matematikai / string transzformációkra. | Ritkán használt. |

---

## 🛡️ `SECURITY DEFINER` és Biztonság

A Visibillben a legtöbb aggregációs RPC `SECURITY DEFINER` tulajdonsággal jön létre.

- **Mit jelent?** A függvény a létrehozó (owner / postgres) jogkörével fut, megkerülve az RLS szabályokat.
- **Biztonsági szabály:** Minden `SECURITY DEFINER` RPC-ben kötelező beállítani a `SET search_path TO 'public'` opciót a search_path hijack támadások elkerülésére.

```sql
CREATE OR REPLACE FUNCTION public.get_llm_cost_full_agg(since_date TIMESTAMPTZ DEFAULT NULL)
RETURNS JSONB
LANGUAGE sql
SECURITY DEFINER
VOLATILE
SET search_path TO 'public'
AS $$
  -- SQL aggregáció...
$$;
```
