---
name: visibill-ticket-support
description: Use when handling user support tickets, customer inquiries, support questions, or troubleshooting client issues in Visibill/eaisybill. Triggers on "/visibill-ticket-support", "/ticket-support", "/vsiibill-ticket-support", "ticket", "support", "ügyfél kérdés", "ügyfélszolgálat", "hibajegy", "ügyfél probléma", "válaszolj az ügyfélnek", "válaszlevél", "miért történt nála", "ticket áttekintés", "hibajegy összefoglaló". Supports two invocation modes: (1) Overview Mode: when invoked without arguments (e.g. "/visibill-ticket-support"), it automatically queries live DB for ticket metrics and renders a structured dashboard showing resolved, open, and tickets assigned to Schwarczinger János waiting for staff response. (2) Targeted Triage Mode: when invoked with a ticket number or ID (e.g. "/visibill-ticket-support <ticketszám>", "/visibill-ticket-support #1024", or "/ticket-support 1024"), it directly fetches the ticket record and its comment thread from the live DB, then follows the established 7-step read-only diagnosis, fix proposal, and customer response workflow without accounting lecturing.
---

# Visibill Ticket Support — Ügyfélkérések & Hibafeltárás Workflow

Ez a skill a **Visibill / eaisybill / eaisyBooks** ügyféltámogatási (support) jegyek, ügyfélkérdések és hibabejelentések professzionális, adatalapú kivizsgálását és válaszadását strukturálja.

Két működési móddal rendelkezik a meghívás módjától függően:
1. **📊 0. LÉPÉS: Áttekintő Dashboard Üzemmód (Overview Mode — paraméter nélkül):**
   - Ha a parancs konkrét jegy nélkül fut (pl. `/visibill-ticket-support`, `/ticket-support`, `/vsiibill-ticket-support`):
   - Azonnal lekérdezi az adatbázisból a megoldott, nyitott és a **Schwarczinger Jánosra váró (needs_staff_response = true)** jegyeket, és egy strukturált vezetői dashboardot jelenít meg teendőlistával.
2. **🔬 1–7. LÉPÉS: Célzott Jegy Kivizsgálás & Hibaelhárítás (Targeted Triage Mode — jegyszámmal):**
   - Ha a parancs konkrét jegyszámmal hívódik meg (pl. `/visibill-ticket-support <ticketszám>`, `/ticket-support #1024`, vagy egy cég/ügyfél megnevezésével):
   - **Közvetlenül az 1. LÉPÉS-be lép:** azonnal lekéri a megadott hibajegyet és a hozzá tartozó teljes beszélgetésfolyamot (`ticket_comments`) az adatbázisból, majd szigorúan végigviszi a 7 lépéses protokollt (read-only diagnózis $\rightarrow$ technikai javaslat $\rightarrow$ jóváhagyás $\rightarrow$ kód/DB javítás $\rightarrow$ ügyfélválasz tervezet $\rightarrow$ lezárás).

---

## 📌 Alapelvek: Tényalapú Kivizsgálás & Szigorú Időrendiség (Fix First, Response Last)

1. **Szigorúan csak olvasás a kivizsgálás során (Read-Only Investigation):**
   * A support kérés feltárásakor az agent **KIZÁRÓLAG olvasási műveleteket** végezhet (`SELECT` lekérdezések `execute_sql`-lel, naplók, forráskód és specifikációk áttekintése).
   * ⛔ **SZIGORÚAN TILOS** a kivizsgálási fázisban önhatalmúlag adatbázist módosítani (`UPDATE`, `INSERT`, `DELETE`, RPC futtatás) vagy forráskódot átírni a felhasználó kifejezett, előzetes jóváhagyása nélkül!
2. **Javaslattétel és jóváhagyás (Proposal & Approval First):**
   * A hibafeltárás után az agent köteles **pontos belső módosítási javaslatot** (SQL szkriptet, konfigurációs változtatást, kód fix tervet) kidolgozni és bemutatni a fejlesztőnek / felhasználónak.
   * Az adatbázis- vagy kódmódosításokat **CSAK AZUTÁN** szabad lefuttatni, ha a felhasználó azt explicit jóváhagyta (pl. *„Rendben, futtasd az SQL-t”* vagy *„Implementáld a javítást”*).
3. **Szigorú Időrendiség — Ügyfélválasz CSAK a sikeres javítás és validáció UTÁN:**
   * ⛔ **SZIGORÚAN TILOS ügyfélválasz-tervezetet írni a kivizsgálás, javítási javaslat vagy kódimplementáció előtt!**
   * Nem ígérünk és nem magyarázunk semmit az ügyfélnek látatlanban. Az ügyfélszolgálati válasz CSAK AKKOR készül el, amikor a javítás fizikailag elkészült, tesztelve van, és az adatbázisban vagy a felületen igazoltan működik (Evidence Before Assertions).
4. **Empirikus bizonyítékok (Evidence Gate):** SOHA ne találgass a hiba okáról! Először mindig derítsd fel az adatbázisban (`SELECT`), a naplókban (`nav_sync_logs`, `audit_logs`) és a specifikációkban az érintett ügyfél valós adatait.
5. **A Szakmai Célközönség Tisztelete (ZÉRÓ Szakmai Kioktatás / Könyvelői Kiselőadás Mentesség):**
   * Felhasználóink felkészült, gyakorló könyvelők, bérszámfejtők és gazdasági szakemberek. A Számviteli törvényt (Sztv.), az áfa- és társasági adószabályokat, a kettős könyvelés logikáját vagy az időbeli elhatárolások elméletét nálunk jobban ismerik!
   * ⛔ **SZIGORÚAN TILOS elméleti számviteli kiselőadást tartani** (pl. *„a számviteli törvény összemérés elve alapján az elhatárolás célja az, hogy...”*). Ez lekezelő, redundáns és feleslegesen növeli az olvasási terhet.
   * 👉 **KIZÁRÓLAG a szoftver működésére és az automatizmusra fókuszálunk:** Hol található a gomb/menüpont, mit számol vagy ajánl fel automatikusan a rendszer, és hogyan tudja az ügyfél 1 kattintással végrehajtani, a Naplófőkönyvben ellenőrizni, vagy szükség esetén stornózni.
6. **Develop-First Hibaelhárítás & Tesztelés (Környezet és Ág Izoláció):**
   * Ha a support kérés kódjavítást (frontend, router, Edge Function), sémamódosítást vagy tárolt eljárás (RPC) javítást igényel:
   * **KÖTELEZŐ átváltani a `develop` ágra (`git checkout develop`), és a Dev Supabase adatbázist (`qhvcdqkqpgpdxogqqvyr`, MCP: `supabase-visibill-dev`) használni a fejlesztéshez és teszteléshez!**
   * Szigorúan tilos a `main` ágon vagy az éles adatbázison kísérletezni. Csak a `develop` ágon sikeresen verifikált és a felhasználó által jóváhagyott javítás kerülhet promótálásra a termelési rendszerbe (`main`).

---

## 🔄 A Két Munkafolyamat

### A) Ha a parancs konkrét jegy nélkül hívódik meg:
```
[/visibill-ticket-support] ──► 0. LÉPÉS: Élő DB lekérdezés ──► Strukturált Dashboard & Teendők ──► Jegy kiválasztása
```

### B) Ha konkrét hibajegyet / ügyfelet vizsgálunk:
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
4. BELSŐ TECHNIKAI ELEMZÉS & MÓDOSÍTÁSI TERV (Jóváhagyásra vár — Ügyfélválasz még nincs!)
   │
   ▼
5. JÓVÁHAGYÁS, KIVITELEZÉS & VALIDÁCIÓ (SQL futtatás / Kódfejlesztés + Tesztek + Evidence)
   │
   ▼
6. VÉGLEGES ÜGYFÉLVÁLASZ MEGFOGALMAZÁSA (Kizárólag a már bizonyított megoldás alapján!)
   │
   ▼
7. TICKET VÁLASZ RÖGZÍTÉSE (`ticket_comments`) & LEZÁRÁS
```

---

## 0. LÉPÉS: Strukturált Hibajegy Áttekintés & Dashboard (Overview Mode)

Ha a felhasználó nem adott meg konkrét jegy azonosítót vagy ügyféladatot (pl. beírja, hogy `/visibill-ticket-support`, `/ticket-support`, vagy *"mi a helyzet a hibajegyekkel"*):

### 0.1 Kötelező Élő Adatbázis Lekérdezések (`supabase-visibill`)

Futtasd le azonnal az alábbi lekérdezéseket az `execute_sql` eszközzel:

1. **Összesített KPI Mutatók:**
```sql
SELECT 
  COUNT(*) as total_tickets,
  COUNT(*) FILTER (WHERE status = 'resolved') as resolved_tickets,
  COUNT(*) FILTER (WHERE status != 'resolved') as open_tickets,
  COUNT(*) FILTER (WHERE status != 'resolved' AND assigned_to = '415bf1b6-8ce5-4425-915c-e656a2972ab7' AND needs_staff_response = true) as jani_pending_response,
  COUNT(*) FILTER (WHERE status != 'resolved' AND assigned_to = '415bf1b6-8ce5-4425-915c-e656a2972ab7' AND (needs_staff_response = false OR needs_staff_response IS NULL)) as jani_waiting_on_user,
  COUNT(*) FILTER (WHERE status != 'resolved' AND assigned_to IS NULL) as unassigned_open
FROM feedback;
```

2. **Schwarczinger Jánosra Váró Jegyek (Azonnali Teendők):**
```sql
SELECT 
  f.id,
  f.ticket_number,
  f.status,
  f.priority,
  f.type,
  f.company_name,
  f.user_name,
  f.user_email,
  LEFT(f.message, 120) as summary,
  f.created_at,
  f.updated_at
FROM feedback f
WHERE f.status != 'resolved' 
  AND f.assigned_to = '415bf1b6-8ce5-4425-915c-e656a2972ab7'
  AND f.needs_staff_response = true
ORDER BY 
  CASE f.priority 
    WHEN 'critical' THEN 1 
    WHEN 'high' THEN 2 
    WHEN 'medium' THEN 3 
    ELSE 4 
  END,
  f.updated_at DESC;
```

3. **Gazdátlan / Kiosztatlan nyitott jegyek (ha van):**
```sql
SELECT 
  f.id,
  f.ticket_number,
  f.priority,
  f.company_name,
  f.user_name,
  LEFT(f.message, 100) as summary,
  f.created_at
FROM feedback f
WHERE f.status != 'resolved' AND f.assigned_to IS NULL
ORDER BY f.created_at DESC;
```

### 0.2 Megjelenítendő Dashboard Formátum

Jelenítsd meg az áttekintést az alábbi struktúrában:

```markdown
# 🎫 VisiBill Support Dashboard & Hibajegy Áttekintés

### 📊 Főbb Mutatók (KPI)
| Kategória | Darabszám | Státusz |
| :--- | :--- | :--- |
| **✅ Megoldott jegyek:** | `... db` | Lezárt hibajegyek |
| **📂 Összes nyitott jegy:** | `... db` | Folyamatban lévő / új ügyek |
| **🚨 Azonnali teendő (Schwarczinger János):** | `... db` | **A felhasználó a mi válaszunkra vár!** |
| **⏳ Janinál folyamatban (userre vár):** | `... db` | Ügyfél válaszára vagy tesztelésre vár |
| **⚠️ Kiosztatlan (gazdátlan) nyitott jegy:** | `... db` | Még nincs felelőse |

---

### 🚨 Azonnali Teendők — Schwarczinger János (Válaszra váró jegyek)
| # / Jegy | Prioritás | Típus | Cég / Felhasználó | Probléma kivonat | Utolsó aktivitás |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **#1024** | 🔴 Critical | Bug | Példa Kft. (info@...) | Nem tölt be a NAV számlaszinkron... | 2 órája |

---

*(Ha van gazdátlan jegy:)*
### ⚠️ Kiosztatlan Jegyek (Gazdátlan)
| # / Jegy | Prioritás | Cég / Felhasználó | Probléma kivonat | Beérkezett |
| :--- | :--- | :--- | :--- | :--- |

---

### 💡 Következő Lépés:
*Melyik jegy kivizsgálásával kezdjünk? Írd be a jegyszámot (pl. `#1024`) vagy a cégnevet, és azonnal elindítom a részletes, read-only kivizsgálást (1–7. lépés)!*
```

---

## 1. LÉPÉS: Kérés fogadása & Hipotézis (Konkrét Jegy Esetén)

### 1.1 Automatikus Jegy & Beszélgetésfolyam Betöltése (ha jegyszámot kaptál)
Ha a parancs konkrét jegyszámmal vagy azonosítóval hívódott meg (pl. `/visibill-ticket-support #1024` vagy `fb-xxx`):
Azonnal futtasd le az alábbi lekérdezést az `execute_sql` eszközzel (`supabase-visibill`):

```sql
-- 1. Hibajegy fő adatainak lekérése:
SELECT 
  f.id,
  f.ticket_number,
  f.type,
  f.category,
  f.status,
  f.priority,
  f.company_name,
  f.company_id,
  f.user_name,
  f.user_email,
  f.user_id,
  f.message,
  f.needs_staff_response,
  f.page_url,
  f.attachments,
  f.created_at,
  f.updated_at,
  p_assigned.name as assigned_name,
  p_creator.name as creator_name
FROM feedback f
LEFT JOIN profiles p_assigned ON p_assigned.user_id = f.assigned_to
LEFT JOIN profiles p_creator ON p_creator.user_id = f.created_by
WHERE f.ticket_number = '<ticketszám>' 
   OR f.ticket_number = REPLACE('<ticketszám>', '#', '')
   OR f.id::text ILIKE '<ticketszám>%'
LIMIT 1;

-- 2. Kapcsolódó üzenetváltások és válaszok lekérése:
SELECT 
  id,
  user_name,
  user_email,
  is_admin,
  message,
  attachments,
  created_at
FROM ticket_comments
WHERE feedback_id = '<fenti_feedback_id>'
ORDER BY created_at ASC;
```

Ezután rögzítsd a beérkező support jegy vagy ügyfélkérdés lényegét:

```markdown
## 📥 Support Jegy Adatok
* **Hibajegy szám / ID:** [#1024 / UUID]
* **Ügyfél / Felhasználó:** [Név / Email]
* **Cég / Adószám:** [Cégnév / Adószám]
* **Státusz / Prioritás:** [pl. in_progress / high]
* **Kérdés / Probléma összefoglalása:** [Ügyfél által leírt jelenség és a kommentváltások lényege 1-2 mondatban]
* **Kezdeti hipotézis:** [Mi lehet a hiba technikai oka az előzmények alapján?]
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
| **D) Valódi kód- vagy logikai bug** | Edge Function hiba, kerekítési eltérés, hiányzó UI funkció | Bug fix / funkció javaslat és fejlesztési terv előterjesztése |

---

## 4. LÉPÉS: Belső Technikai Elemzés & Módosítási Terv (Proposal-First)

> 🛑 **SZIGORÚ SZABÁLY:** Ebben a lépésben **KIZÁRÓLAG a belső technikai jelentés és a jóváhagyandó módosítási terv** készül el!
> **TILOS még ügyfélválaszt generálni**, amíg a javítás nincs jóváhagyva, lefejlesztve és leellenőrizve!

Generáld le a belső technikai jelentést az alábbi formában:

```markdown
# 🛠️ Belső Technikai Elemzés & Módosítási Javaslat (Fejlesztői összefoglaló)

### 📊 Adatbázis & Rendszer állapot (Read-Only eredmények):
- **User ID / Company ID:** `...`
- **Valós adatszámok a DB-ben:** `...`
- **Talált hibakód / napló bejegyzés / konfigurációs eltérés:** `...`

### 🔍 Gyökérok (Technical Root Cause):
- [Részletes kódszintű / adatbázisszintű magyarázat a felmerült hibáról vagy hiányzó funkcióról]

### 📋 Javasolt Módosítások (Jóváhagyásra vár):

#### 1. Adatbázis módosítási javaslat (SQL ha releváns):
```sql
-- Pontos SQL szkript a javításhoz:
UPDATE ... / DELETE ...;
```
* **Kockázat és hatás:** [Alacsony/Közepes/Magas — mi változik a rekordban, befolyásol-e más cégeket/felhasználókat]
* **Visszaállíthatóság:** [Hogyan vonható vissza szükség esetén]

#### 2. Kódbeli fejlesztési / javítási terv (ha releváns):
- [ ] Szükséges kódmódosítások leírása (érintett komponensek, szolgáltatások, Edge Function-ök)
- [ ] Tervezett unit/integrációs tesztek listája

---

### ❓ Jóváhagyási Kérdés a Fejlesztőnek / Felhasználónak:
> *„Kérlek hagyd jóvá a fenti SQL módosítás(ok) futtatását vagy a javítási kódfejlesztés megkezdését! Amint jóváhagyod, elvégzem a módosítást, leellenőrzöm az eredményt, és azt követően fogalmazzuk meg a kész ügyfélválaszt.”*
```

---

## 5. LÉPÉS: Végrehajtás, Fejlesztés & Validáció (Jóváhagyás Után)

1. **Jóváhagyás megvárása:** Az agent NEM nyúlhat az éles adatokhoz vagy a kódbázishoz, amíg a felhasználó nem hagyta jóvá a tervet a chatben.
2. **Kivitelezés és Környezet (Develop-First Protokoll):**
   * **Kódjavítás / Edge Function / Új funkció / Migráció esetén (KÖTELEZŐ Develop-First):**
     * Válts át a `develop` ágra: `git checkout develop`.
     * A kódmódosítást a `develop` ágon végezd el a `visibill-dev` és `rules/frontend.md` szabályok szerint.
     * Minden adatbázis tesztet és migrációt **KIZÁRÓLAG a Dev Supabase adatbázison (`qhvcdqkqpgpdxogqqvyr`, MCP: `supabase-visibill-dev`)** és helyi dev szerveren (`http://localhost:8080`) tesztelj le.
     * Futtasd le a verifikációt: `npm run lint:fast`, `npm run build` vagy `npx tsc --noEmit`, valamint az érintett Vitest teszteket.
     * Csak a sikeres dev tesztek után kérj engedélyt a felhasználótól a `main` merge-re és az éles promócióra.
   * **Adatjavítás (ha az éles ügyfél egyedi rekordját kell javítani a Prod DB-ben):**
     * A korábban jóváhagyott, célzott SQL futtatása `execute_sql`-lel a termelési adatbázison (`supabase-visibill`).
3. **Evidence Gate (Kötelező bizonyítás):**
   * Adatbázis esetén: Azonnal ellenőrző `SELECT` lekérdezéssel bizonyítani, hogy a rekord megváltozott és hibátlan.
   * Kód esetén: A tesztek (`vitest`) és a build parancs sikeres lefutásának bemutatása.
4. **Záró megerősítés:** Rövid visszajelzés a chatben, hogy a javítás fizikailag sikeres és bizonyítottan működik.

---

## 6. LÉPÉS: Végleges Ügyfélválasz Megfogalmazása & Jóváhagyatása

> 💡 **Ez a lépés KIZÁRÓLAG az 5. lépés (sikeres végrehajtás és validáció) UTÁN futhat le!**
> Most, hogy a rendszerben fizikailag és bizonyítottan működik a megoldás, pontos, hiteles és gyakorlati útmutatót adunk az ügyfélnek.

### ✉️ Ügyfélszolgálati Választervezet Sablon:

```markdown
# ✉️ Választervezet az Ügyfélnek (Ügyfélszolgálati válasz)

> **Tárgy:** Re: [Probléma / Kérdés rövid megnevezése]
>
> Kedves [Ügyfél Keresztneve / Tamás]!
>
> [1. Barátságos felvezetés & a felvetett igény/kérdés közvetlen megerősítése elméleti körmondatok nélkül]
>
> [2. Szoftveres útmutatás és automatizmus bemutatása — lépésről lépésre]:
> 1. **Elérési út a felületen:** [pl. *A számla tételének sorában található 'Időbeli elhatárolás' ikonra kattintva érhető el a funkció.*]
> 2. **Automatizmus működése:** [pl. *A felugró ablakban a rendszer az időszak alapján automatikusan kiszámítja az időarányos összeget, nem kell fejben vagy táblázatban számolni.*]
> 3. **Egykattintásos rögzítés:** [pl. *A 'Mentés' gombra kattintva a rendszer azonnal legenerálja a vegyes könyvelési bizonylatot (VE naplóba).*]
> 4. **Kontroll & Visszaállíthatóság:** [pl. *A tétel közvetlenül megjelenik a Naplófőkönyvben / Vegyes bizonylatok között, és szükség esetén bármikor ellenőrizhető vagy egy kattintással stornózható.*]
>
> [3. Mi történt a háttérben / Mit állítottunk be — közérthetően, fejlesztői zsargon NÉLKÜL ha adatbázis vagy konfiguráció javítás történt]
>
> [4. Mit tud tenni az ügyfél azonnal (pl. azonnali újraszinkronizálás indítása vagy nézetváltás)]
>
> Bármilyen további kérdésben vagy észrevételben örömmel állunk rendelkezésetekre!
>
> Üdvözlettel,  
> [Support Csapat / Schwarczinger János / VisiBill Support]
```

### ❓ Jóváhagyási Kérdés az Ügyfélválaszhoz:
> *„A fenti választ javaslom elküldeni az ügyfélnek. Elfogadod, és rögzítsem a ticket kommentek közé a jegy lezárásával együtt, vagy kézzel szeretnéd kiküldeni?”*

---

## 7. LÉPÉS: Ticket Válasz Rögzítése (`ticket_comments`) & Lezárás

Ha a felhasználó jóváhagyja az ügyfélválasz kiküldését és a ticket lezárását:
A választ **MINDIG** a rendszergazda / fejlesztő (Morfi / Jani) fiókjával rögzítjük:
* **user_id:** `'415bf1b6-8ce5-4425-915c-e656a2972ab7'`
* **user_name:** `'Schwarczinger János'`
* **user_email:** `'notbyalongway@thinkai.hu'`
* **is_admin:** `true`

```sql
INSERT INTO ticket_comments (
  feedback_id, user_id, user_name, user_email, is_admin, message
) VALUES (
  '<feedback_id>',
  '415bf1b6-8ce5-4425-915c-e656a2972ab7',
  'Schwarczinger János',
  'notbyalongway@thinkai.hu',
  true,
  '<jóváhagyott_válasz_szövege>'
);

UPDATE feedback
SET status = 'resolved',
    needs_staff_response = false,
    updated_at = now()
WHERE id = '<feedback_id>';
```

---

## 🎨 Ügyfél-Kommunikációs Hangnem Szabályai

1. **Empatikus & Segítőkész:** Kezdd mindig barátságos megszólítással (pl. *Kedves Tamás!*), és kollégiális, partneri hangnemben kommunikálj.
2. **Közérthető (Fejlesztői Zsargon Mentesség):** Kerüld a belső fejlesztői és adatbázis kifejezéseket!
   * ❌ *„Az Edge Function-ben a validation_status = 'pending' volt az SQL szűrő miatt.”*
   * ✅ *„A háttérben az automatikus szinkronizációs beállítás még várakozó állapotban volt.”*
3. **Szakmai Célközönség Tisztelete (ZÉRÓ Szakmai Kioktatás / Könyvelői Kiselőadás Mentesség):**
   * A felhasználók profi könyvelők és pénzügyesek, nem tanulók! Nem szorulnak számviteli, adózási vagy kettős könyvelési felvilágosításra.
   * ❌ **TILOS a könyvelési elmélet magyarázata:**
     - *„Az időbeli elhatárolás lényege az összemérés elve alapján az, hogy...”*
     - *„A kettős könyvelés szabályai szerint a 391-es számlára kell könyvelni...”*
     *(Ez kioktató, redundáns és rontja az ügyfélélményt).*
   * ✅ **Helyette 100%-ban szoftveres és automatizációs fókusz:**
     - **Hol van a funkció?** Pontos képernyő, menüpont, gomb vagy ikon neve a felületen.
     - **Mit csinál a gép?** Mit ismer fel, milyen kalkulációt végez el automatikusan a felhasználó helyett.
     - **Hogyan könyvel?** Milyen bizonylatszámot kap (pl. VE bizonylat) és hova kerül be a rendszerben.
     - **Hogyan ellenőrizhető és vonható vissza?** Hol látható a végeredmény (pl. Naplófőkönyv), és hogyan stornózható egy kattintással hiba esetén.
4. **Cselekvő & Megnyugtató:** Egyértelműen közöld, hogy a szükséges lépéseket elvégeztük / hol tudja azonnal kipróbálni, és mi a garancia a biztonságos használatra.
