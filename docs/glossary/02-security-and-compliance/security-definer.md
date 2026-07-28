# 🛡️ Security Definer (PostgreSQL Jogkör Kiterjesztés)

> **Utoljára frissítve:** 2026-07-25  
> **Kapcsolódó doksi:** [RPC Glossary](../03-database-and-backend/rpc-remote-procedure-call.md) | [RLS Glossary](./rls-row-level-security.md) | [GLOSSARY Index](../index.md)

---

## 📖 Fogalom Meghatározása

A **`SECURITY DEFINER`** a PostgreSQL tárolt eljárások (RPC-k és funkciók) olyan tulajdonsága, amely meghatározza, hogy a függvény milyen jogosultsági kontextusban fut le. 

- **`SECURITY INVOKER` (alapértelmezett):** A függvény a meghívó felhasználó (pl. a bejelentkezett RLS-korlátozott user) jogosultságaival fut le.
- **`SECURITY DEFINER`:** A függvény a **függvényt létrehozó adatbázis-tulajdonos (Owner / superuser / postgres)** korlátlan jogosultságaival fut le, **figyelmen kívül hagyva a bejelentkezett user RLS korlátozásait**.

---

## 💡 Miért és Hol Használjuk a Visibillben?

1. **Biztonságos RLS Bypass Aggregációkra:**  
   Amikor a felhasználónak csak a saját cége adataira van RLS joga, de szigorúan ellenőrzött módon aggregált statisztikát kell kiszámolni (pl. platform szintű LLM költség aggregáció vagy céges meghívási statisztika), az RPC `SECURITY DEFINER`-ként fut, és csak az aggregált végeredményt adja vissza.

2. **Privilegizált Műveletek Végrehajtása:**  
   Pl. felhasználói profil inicializálás regisztrációkor (`on_auth_user_created` trigger), ahol a bejelentkező user még nem rendelkezik írási joggal a `profiles` vagy `company_members` táblára.

---

## ⚠️ Biztonsági Kockázatok & "Search Path Hijack" Elleni Védelem

A `SECURITY DEFINER` függvények szuperfelhasználói joggal futnak, így sérülékenyek lehetnek úgynevezett **Search Path Hijack** támadásokkal szemben, ha a támadó saját sémát regisztrál.

### Kötelező Szabály a Visibillben
Minden `SECURITY DEFINER` függvényben **KÖTELEZŐ** explicit módon rögzíteni a séma keresési útvonalat (`SET search_path TO 'public'`):

```sql
-- ✅ HELYES ÉS BIZTONSÁGOS PATTERN:
CREATE OR REPLACE FUNCTION public.get_llm_cost_full_agg(since_date TIMESTAMPTZ DEFAULT NULL)
RETURNS JSONB
LANGUAGE sql
SECURITY DEFINER
VOLATILE
SET search_path TO 'public' -- ← KÖTELEZŐ BIZTONSÁGI VÉDELEM!
AS $$
  SELECT jsonb_build_object(
    'total_cost', COALESCE(SUM(estimated_cost_usd), 0),
    'total_jobs', COUNT(*)
  )
  FROM public.llm_koltsegek
  WHERE (since_date IS NULL OR created_at >= since_date);
$$;
```
