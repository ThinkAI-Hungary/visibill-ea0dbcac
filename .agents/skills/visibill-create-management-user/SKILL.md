---
name: visibill-create-management-user
description: Use this skill when creating a new management / ThinkAI dashboard user on Eaisybill-prod who should only have access to the Management Dashboard (/management). Matches "/visibill-create-management-user", "management user létrehozása", "új management felhasználó", "management dashboard user", or any request providing full name, email, and password for management access.
---

# Visibill Create Management User Skill

Használd ezt a skillt, amikor a felhasználó új platform-szintű **Management Dashboard** felhasználót kíván létrehozni az `eaisybill-prod` környezetben.

A létrehozott felhasználó jogosultságai pontosan megegyeznek a `management@thinkai.hu` fiókéval:
- A bejelentkezést követően a rendszer azonnal a `/management` útvonalra irányítja.
- Nem lát sem normál eaisyBill céges számlázást, sem eaisyBooks könyvelői felületet (nincs `company_members` tagsága).
- Jogosult a `management-stats` Edge Function hívására (`overview`, `companies`, `users`, `errors`, `tickets`).

---

## 📥 Elvárt Bemenetek (Inputs)

A skill végrehajtásához három adat szükséges:
1. **Teljes név (`fullName`)**: pl. `"Fekecs Attila"`
2. **Email cím (`email`)**: pl. `"ati@thinkai.hu"`
3. **Jelszó (`password`)**: pl. `"Mindmegette113?/"`

> 💡 **Megjegyzés:** Ha a felhasználó kérése bármelyik paramétert nem tartalmazza, kérd be azt mielőtt továbbhaladnál.

---

## 🚀 Végrehajtási Folyamat (Workflow)

A folyamat 4 jól definiált lépésből áll:

```
[1. Pre-Check] ──> [2. Auth SignUp] ──> [3. DB Elevate & Confirm] ──> [4. Smoke Test & Report]
```

### 1. Előzetes ellenőrzés (Pre-Check)

Ellenőrizd a `supabase-visibill` MCP `execute_sql` eszközzel, hogy az email létezik-e már:

```sql
SELECT au.id, au.email, p.role, p.is_support_admin
FROM auth.users au
LEFT JOIN public.profiles p ON p.user_id = au.id
WHERE au.email = '<EMAIL>';
```

- **Ha a felhasználó már létezik:** Tájékoztasd a felhasználót, és kérdezd meg, hogy meglévő fiók szerepkörét kívánja-e átállítani `thinkai`-ra.
- **Ha nem létezik:** Folytasd a 2. lépéssel.

---

### 2. Felhasználó Regisztrációja (Auth SignUp)

A jelszó biztonságos bcrypt hasheléséhez és az `auth.identities` / trigger lánc helyes lefutásához futtasd a skill beépített segédscriptjét:

```bash
node .agents/skills/visibill-create-management-user/scripts/management_user_helper.cjs signup "<FULL_NAME>" "<EMAIL>" "<PASSWORD>"
```

**Mi történik a háttérben?**
1. A Supabase GoTrue Auth API-n keresztül létrejön a rekord az `auth.users` és `auth.identities` táblákban.
2. Lezajlik a DB `on_auth_user_created` trigger, ami legenerálja a `public.profiles` rekordot a megadott névvel.
3. Lezajlanak a `profiles` triggerek (`initialize_email_preferences`, `initialize_user_subscription`).

---

### 3. Jogosultságok és Email Megerősítés Beállítása (DB Elevate)

Futtasd az alábbi SQL parancsokat a `supabase-visibill` MCP `execute_sql` eszközével:

```sql
-- 1. Email cím azonnali megerősítése auth szinten
UPDATE auth.users
SET email_confirmed_at = now(),
    raw_user_meta_data = raw_user_meta_data || '{"email_verified": true}'::jsonb
WHERE email = '<EMAIL>';

-- 2. Profil szerepkör felruházása 'thinkai' role-lal és support admin joggal
UPDATE public.profiles
SET role = 'thinkai',
    is_support_admin = true,
    email_verified = true,
    has_completed_tour = true,
    eaisybill_access = true,
    eaisybooks_access = false
WHERE user_id = (SELECT id FROM auth.users WHERE email = '<EMAIL>');

-- 3. Teszt előfizetés limit beállítása
UPDATE public.user_subscriptions
SET tier = 'teszt',
    invoice_limit = 999999
WHERE user_id = (SELECT id FROM auth.users WHERE email = '<EMAIL>');
```

> ⚠️ **Kritikus szabály:** A felhasználót **TILOS** hozzáadni bármilyen céghez a `company_members` táblában! Ez garantálja a kizárólagos `/management` hozzáférést.

---

### 4. Hitelesítés és Végponti Ellenőrzés (Smoke Test)

Futtasd a segédscript ellenőrző módját, amely böngészős fejlécekkel (`A-101` bot védelem kompatibilis) teszteli a belépést és a `management-stats` Edge Function elérését:

```bash
node .agents/skills/visibill-create-management-user/scripts/management_user_helper.cjs verify "<EMAIL>" "<PASSWORD>"
```

A script elvégzi:
- `signInWithPassword` hitelesítés.
- Profil szerepkör ellenőrzése (`role === 'thinkai'`).
- `management-stats?action=overview` lekérdezése (elvárás: `HTTP 200 OK`).
- Tiszta kijelentkezés (`signOut`).

---

## 📊 Összegző Jelentés Formátum

A sikeres lefutást követően adj át egy áttekinthető összegzést a felhasználónak:

```markdown
### 👤 Management Felhasználó Sikeresen Létrehozva
- **Név:** <FULL_NAME>
- **Email:** `<EMAIL>`
- **User ID:** `<USER_ID>`
- **Szerepkör:** `thinkai` (`profiles.role`)
- **Support Admin:** `true`
- **Elérési kör:** Kizárólag a Management Dashboard (`/management`)
- **Státusz:** Aktív, hitelesített, azonnal bejelentkezhet.
```
