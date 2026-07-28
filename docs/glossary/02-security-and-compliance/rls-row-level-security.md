# 🛡️ RLS — Row Level Security (Sor-szintű Adatizoláció)

> **Utoljára frissítve:** 2026-07-25  
> **Kapcsolódó doksi:** [A-003: Multi-Tenancy RLS](../../architecture/decisions/A-003-multi-tenancy-rls.md) | [GLOSSARY Index](../index.md)

---

## 📖 Fogalom Meghatározása

A **Row Level Security (RLS)** a PostgreSQL adatbázismotor beépített biztonsági funkciója, amely lehatárolja, hogy az éppen bejelentkezett felhasználó (vagy role) **mely adatbázis-sorokat láthatja, módosíthatja vagy törölheti**.

A Visibillben az RLS képezi a **Multi-Tenancy (többbérlős) architektúra alapját**, szavatolva, hogy az A cég felhasználója véletlenül se férhessen hozzá a B cég számláihoz vagy bankadataihoz.

---

## 🔒 Hogyan működik a Visibillben?

Minden céghez tartozó adatbázis-tábla (`invoices`, `transactions`, `company_members` stb.) tartalmaz egy `company_id` oszlopot. Az RLS policy-k a bejelentkezett user ID-ja (`auth.uid()`) alapján ellenőrzik a hozzáférést:

```sql
-- Példa RLS Policy az invoices táblán:
CREATE POLICY "Users can view invoices of their companies"
ON public.invoices FOR SELECT
USING (
  company_id IN (
    SELECT company_id 
    FROM public.company_members 
    WHERE user_id = auth.uid()
  )
);
```

---

## 🔑 A `service_role` Bypass (És mikor szabad használni)

Az RLS szabályok automatikusan érvényesülnek a normál felhasználói klienseken (`anon` és `authenticated` kulcsok). 

Bizonyos esetekben azonban a rendszernek **cross-tenant (cégfüggetlen) hozzáférésre** van szüksége:

| Hozzáférési Típus | Használt Kulcs | RLS Érvényesülés | Használati Hely |
|---|---|---|---|
| **Kliens / UI** | `anon` / `authenticated` | ✅ **Kötelező RLS** | React Frontend Supabase Kliens |
| **Edge Function (Cross-Tenant)** | `service_role` | ❌ **RLS Bypass** | `management-stats` Edge Function |
| **Python Worker** | `service_role` | ❌ **RLS Bypass** | Háttér feldolgozó worker konténerek |

---

## ⚠️ Biztonsági Aranyszabályok

1. **SOHA ne add ki a `service_role` kulcsot a frontendnek!** A frontend böngészőből futó Supabase kliens kizárólag `anon` vagy a bejelentkezés után kapott JWT-t használhatja.
2. **Új tábla létrehozásakor kötelező:** `ALTER TABLE table_name ENABLE ROW LEVEL SECURITY;`
3. **Audit naplózás:** Az RLS bypass hívásokat az `audit_logs` tábla rögzíti, kiszűrve a service role belső háttérműveleteit ([A-033]).
