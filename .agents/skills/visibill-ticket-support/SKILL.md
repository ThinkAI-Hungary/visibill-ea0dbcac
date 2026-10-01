---
name: visibill-ticket-support
description: Use when handling user support tickets, customer inquiries, support questions, or troubleshooting client issues in Visibill/eaisybill. Triggers on "ticket", "support", "ügyfél kérdés", "ügyfélszolgálat", "hibajegy", "ügyfél probléma", "válaszolj az ügyfélnek", "válaszlevél", "miért történt nála", "visibill-ticket-support". Enforces strict hierarchy: (1) read-only diagnosis, (2) root cause & technical fix proposal, (3) implementation & verification, and ONLY THEN (4) formulating the customer-ready response without accounting lecturing.
---

# Visibill Ticket Support — Ügyfélkérések & Hibafeltárás Workflow

Ez a skill a **Visibill / eaisybill / eaisyBooks** ügyféltámogatási (support) jegyek, ügyfélkérdések és hibabejelentések professzionális, adatalapú kivizsgálását és válaszadását strukturálja.

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

---

## 🔄 A Kivizsgálási & Support Munkamenet (7 Lépés)

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
2. **Kivitelezés:**
   * **Ha adatbázis javítás:** A jóváhagyott SQL futtatása `execute_sql`-lel (`supabase-visibill`).
   * **Ha kódjavítás / új funkció:** A `visibill-dev` szabályok szerint a kód módosítása, komponens javítás, új tesztek írása (`vitest`), valamint `npm run build` / `npx tsc --noEmit` lefuttatása.
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
