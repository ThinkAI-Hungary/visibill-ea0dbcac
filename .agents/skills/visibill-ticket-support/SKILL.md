---
name: visibill-ticket-support
description: Use when handling user support tickets, customer inquiries, support questions, or troubleshooting client issues in Visibill/eaisybill. Triggers on "ticket", "support", "ügyfél kérdés", "ügyfélszolgálat", "hibajegy", "ügyfél probléma", "válaszolj az ügyfélnek", "válaszlevél", "miért történt nála", "visibill-ticket-support". Guides root-cause analysis using visibill-spec-lookup and read-only SQL queries, and generates both a clean, customer-ready Hungarian response and a detailed internal technical report with proposed SQL/code modifications for user approval.
---

# Visibill Ticket Support — Ügyfélkérések & Hibafeltárás Workflow

Ez a skill a **Visibill / eaisybill / eaisyBooks** ügyféltámogatási (support) jegyek, ügyfélkérdések és hibabejelentések professzionális, adatalapú kivizsgálását és válaszadását strukturálja.

---

## 📌 Alapelvek: Tényalapú Kivizsgálás & Javaslattételi Kötelezettség (Proposal-First)

1. **Szigorúan csak olvasás a kivizsgálás során (Read-Only Investigation):**
   * A support kérés feltárásakor az agent **KIZÁRÓLAG olvasási műveleteket** végezhet (`SELECT` lekérdezések `execute_sql`-lel, naplók, forráskód és specifikációk áttekintése).
   * ⛔ **SZIGORÚAN TILOS** a kivizsgálási fázisban önhatalmúlag adatbázist módosítani (`UPDATE`, `INSERT`, `DELETE`, RPC futtatás) vagy forráskódot átírni a felhasználó kifejezett, előzetes jóváhagyása nélkül!
2. **Javaslattétel és jóváhagyás (Proposal & Approval First):**
   * A hibafeltárás után az agent köteles **pontos módosítási javaslatot** (SQL szkriptet, konfigurációs változtatást, kód fix tervet) kidolgozni és bemutatni a felhasználónak.
   * Az adatbázis- vagy kódmódosításokat **CSAK AZUTÁN** szabad lefuttatni, ha a felhasználó azt explicit jóváhagyta (pl. *„Rendben, futtasd az SQL-t”*).
3. **Empirikus bizonyítékok:** SOHA ne találgass a hiba okáról! Először mindig derítsd fel az adatbázisban (`SELECT`), a naplókban (`nav_sync_logs`, `audit_logs`) és a specifikációkban az érintett ügyfél valós adatait.
4. **Kétkomponensű kimenet:**
   - **Ügyfélnek küldhető válasz:** Barátságos, ügyfélközpontú, érthető magyar nyelven (NULLA technikai zsargon, kódnév vagy SQL).
   - **Belső technikai elemzés & Módosítási javaslat:** Részletes kódszintű és adatbázis-szintű magyarázat a fejlesztői/support csapatnak, kész SQL scriptekkel és kockázatelemzéssel.

---

## 🔄 A Kivizsgálási Munkamenet (5 Lépés)

```
1. FOGADÁS & HIPOTÉZIS 
   │
   ▼
2. READ-ONLY FELTÁRÁS (Adatbázis SELECT, Naplók, Kód, Specifikáció)
   │
   ▼
3. GYÖKÉROK ELEMZÉS (Root Cause Classification)
   │
   ▼
4. KÉTKOMPONENSŰ JELENTÉS & MÓDOSÍTÁSI JAVASLAT (Választervezet + Jóváhagyandó SQL/Fix)
   │
   ▼
5. JÓVÁHAGYÁS & VÉGREHAJTÁS (Csak a user explicit jóváhagyása után!)
```

---

## 1. LÉPÉS: Kérés fogadása & Hipotézis

Rögzítsd a beérkező support jegy vagy ügyfélkérdés lényegét:

```markdown
## 📥 Support Jegy Adatok
* **Ügyfél / Felhasználó:** [Név / Email ha megadott]
* **Cég / Adószám:** [Cégnév / Adószám ha megadott]
* **Kérdés / Probléma:** [Ügyfél által leírt jelenség 1-2 mondatban]
* **Kezdeti hipotézis:** [Mi lehet a hiba oka?]
```

---

## 2. LÉPÉS: Kontextus keresés & Read-Only Adatbázis ellenőrzés (KÖTELEZŐ)

> ⚠️ **Fontos szabály:** Ebben a lépésben KIZÁRÓLAG olvasás engedélyezett! Semmilyen módosító SQL vagy fájlírás nem futhat le!

### 2.1 Specifikációk beolvasása (`visibill-spec-lookup`)
Töltsd be és olvasd el a `visibill-spec-lookup` skill-t az érintett terület specifikációinak azonosításához:
```
view_file C:\Users\Morfi\.gemini\config\skills\visibill-spec-lookup\SKILL.md
```
* Identifikáld a releváns PRD (P-xxx), ADR (A-xxx) és Design dokumentumokat.

### 2.2 Adatbázis lekérdezés (`execute_sql` via `supabase-visibill` — CSAK SELECT)
Kutasd fel az érintett ügyfél és cég valós rekordjait a Supabase adatbázisban:
* **Felhasználó & Cég azonosítása:**
  ```sql
  SELECT u.id as user_id, u.email, cm.company_id, c.name as company_name, c.tax_number
  FROM auth.users u
  JOIN company_members cm ON cm.user_id = u.id
  JOIN companies c ON c.id = cm.company_id
  WHERE u.email ILIKE '%ügyfél_email%' OR c.name ILIKE '%cégnév%';
  ```
* **Beállítások & Státuszok:** (pl. `user_nav_credentials`, `companies`, `company_members`, `accounty_assignments`, `accounty_ev_client_settings`)
* **Számlák & Tranzakciók száma:** (pl. `COUNT(*)` a `nav_invoices` vagy `invoices` táblákban)
* **Lefutási naplók:** (`nav_sync_logs`, `audit_logs`, `worker_logs`)

### 2.3 Kódbázis ellenőrzés
Grep vagy `view_file` segítségével vizsgáld meg a releváns Edge Function-öket (`supabase/functions/`), felületi komponenseket (`src/`), vagy a Worker kódot (`worker/`).

---

## 3. LÉPÉS: Gyökérok Elemzés (Root Cause)

Sorold be a talált problémát az alábbi kategóriák egyikébe:

| Kategória | Jellemző példák | Megoldási irány |
|---|---|---|
| **A) Felületi tévedés / Szűrés** | UI lapozó (50 db/oldal), dátumszűrő (pl. 30 napos ablak), fülváltás, szűrés | Tájékoztatás a felület használatáról (lapozás, nézetváltás) |
| **B) Beragadt beállítás / Státusz** | `validation_status = 'pending'`, téves `is_main_accountant`, félrement EV profil | Módosítási SQL szkript előkészítése jóváhagyásra + folyamat tisztázása |
| **C) Rendszer/API korlát** | NAV API 35 napos lekérdezési limit, rate limit, hálózati timeout | Éjszakai auto-sync vagy darabolt szinkronizáció bemutatása |
| **D) Valódi kód- vagy logikai bug** | Edge Function hiba, kerekítési eltérés, hiányzó UI visszaállítási gomb | Bug fix javaslat és javítási terv előterjesztése |

---

## 4. LÉPÉS: Kétkomponensű Jelentés & Módosítási Javaslat Generálása

MINDIG generáld le mindkét szekciót az alábbi struktúrában, **módosítás végrehajtása NÉLKÜL**:

```markdown
# ✉️ Választervezet az Ügyfélnek (Ügyfélszolgálati válasz)

> **Tárgy:** Re: [Probléma / Kérdés rövid megnevezése]
>
> Kedves [Ügyfél Keresztneve / Tamás]!
>
> [1. Barátságos felvezetés & a probléma röviden megfogalmazott oka]
>
> [2. Mi történt a háttérben — közérthetően, technikai zsargon NÉLKÜL]
>
> [3. Mi a javasolt megoldás / Mit fogunk beállítani és mi a várható eredmény]
>
> [4. Mit tud tenni az ügyfél (pl. manuális indítás vagy lapozás)], ha azonnal szeretné látni az eredményt.
>
> Bármilyen további kérdésben örömmel állunk rendelkezésetekre!
>
> Üdvözlettel,  
> [Support Csapat / VisiBill Support]

---

# 🛠️ Belső Technikai Elemzés & Módosítási Javaslat (Fejlesztői összefoglaló)

### 📊 Adatbázis & Rendszer állapot (Read-Only eredmények):
- **User ID / Company ID:** `...`
- **Valós adatszámok a DB-ben:** `...`
- **Talált hibakód / napló bejegyzés / konfigurációs eltérés:** `...`

### 🔍 Gyökérok (Technical Root Cause):
- [Részletes kódszintű / adatbázisszintű magyarázat]

### 📋 Javasolt Módosítások (Jóváhagyásra vár):

#### 1. Adatbázis módosítási javaslat (SQL):
```sql
-- Pontos SQL szkript a javításhoz:
UPDATE ... / DELETE ...;
```
* **Kockázat és hatás:** [Alacsony/Közepes/Magas — mi változik a rekordban, befolyásol-e más cégeket/felhasználókat]
* **Visszaállíthatóság:** [Hogyan vonható vissza szükség esetén]

#### 2. Kódbeli javítási javaslat (ha releváns):
- [ ] Leírás a szükséges kódváltoztatásról (pl. UI gomb hozzáadása, edge case védelem)

---

### ❓ Jóváhagyási Kérdés a Fejlesztőnek / Felhasználónak:
> *„Kérlek hagyd jóvá a fenti SQL módosítás(ok) lefuttatását és a választervezetet! Ha jóváhagyod, végrehajtom a DB frissítést és leellenőrzöm az eredményt.”*
```

---

## 5. LÉPÉS: Végrehajtás & Validáció (KIZÁRÓLAG Jóváhagyás Után)

1. **Jóváhagyás megvárása:** Az agent NEM futtathat le módosító SQL-t, amíg a felhasználó jóvá nem hagyja azt a chatben.
2. **Végrehajtás:** A jóváhagyott SQL futtatása `execute_sql`-lel, vagy kód módosítása a `visibill-dev` szabályai szerint.
3. **Evidence Gate:** Azonnal ellenőrző `SELECT` lekérdezéssel bizonyítani, hogy a módosítás a várt eredményt hozta (pl. a rekord frissült, a téves beállítás törlődött).
4. **Záró megerősítés:** Rövid visszajelzés a felhasználónak, hogy a módosítás sikeresen lefutott, és az ügyfélválasz most már kiküldhető.

---

## 🎨 Ügyfél-Kommunikációs Hangnem Szabályai

1. **Empatikus & Segítőkész:** Kezdd mindig barátságos megszólítással és közvetlen hangnemben.
2. **Közérthető:** Kerüld a fejlesztői kifejezéseket!
   * ❌ *„Az Edge Function-ben a validation_status = 'pending' volt az SQL szűrő miatt.”*
   * ✅ *„A háttérben az automatikus szinkronizációs beállítás még várakozó állapotban volt.”*
3. **Cselekvő & Megnyugtató:** Egyértelműen közöld, hogy a szükséges lépéseket előkészítettük/elvégezzük, és mi lesz a pontos következmény.
