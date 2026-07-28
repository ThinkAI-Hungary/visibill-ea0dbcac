# 🛡️ SQL Injection & Sanitization (Injekció Elleni Védelem)

> **Utoljára frissítve:** 2026-07-25  
> **Kapcsolódó doksi:** [RPC Glossary](./rpc-remote-procedure-call.md) | [GLOSSARY Index](../index.md)

---

## 📖 Fogalom Meghatározása

A **SQL Injection (SQL Injekció)** a webes és adatbázis-támadások egyik legveszélyesebb formája (OWASP Top 10), amely során a támadó kártékony SQL utasításokat szúr be egy alkalmazás beviteli mezőjébe vagy kérés-paraméterébe. Ha a szerver a felhasználói bemenetet közvetlenül összefűzi a SQL lekérdezéssel, a támadó jogosulatlanul adatokat olvashat ki, módosíthat vagy törölhet az adatbázisból.

A **Sanitization (Bemenet-tisztítás / Szűrés)** és a **Paraméterezett Lekérdezések (Prepared Statements)** a védekezés elsődleges eszközei.

---

## 🚨 Veszélyes vs Biztonságos Kódminta

### ❌ ROSSZ — Dinamikus SQL Sztring Összefűzés (Sérülékeny):
```python
# Helytelen: a search közvetlenül bekerül a SQL-be!
# Ha search = "' OR '1'='1" -> az összes cég adata kiszivárog!
query = f"SELECT * FROM invoices WHERE company_name = '{search}'"
cursor.execute(query)
```

### ✅ JÓ — Paraméterezett Lekérdezés (Prepared Statement):
```python
# Helyes: az adatbázis motor külön kezeli az SQL szintaxist és az adatot
query = "SELECT * FROM invoices WHERE company_name = %s"
cursor.execute(query, (search,))
```

---

## 💡 Hogyan Védi a Visibill az Adatbázist?

1. **PostgREST & Supabase Client Natív Védelem:**  
   A frontend Supabase hívásai (`supabase.from('invoices').select().eq('company_id', companyId)`) natívan paraméterezett HTTP kéréseket generálnak a PostgREST réteg felé, teljesen megszüntetve a kliens-oldali SQL injekció lehetőségét.

2. **Edge Function-ök & RPC-k:**  
   Az Edge Function-ökben futó Supabase-js hívások és a szerver-oldali SQL RPC-k paramétereiket szigorúan típusosan kapják meg (`p_year INT`, `since_date TIMESTAMPTZ`), így nem összefűzött sztringként futnak le.

3. **Python Worker Query-k:**  
   A Python worker a `postgrest-py` SDK-t használja, amely automatikusan URL-encoded paramétereket ad át az Supabase REST API-nak.
