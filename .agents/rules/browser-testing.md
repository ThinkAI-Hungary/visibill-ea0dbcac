---
trigger: always_on
description: Browser testing, subagent authentication, and test credentials rules.
---

# Browser Testing & Subagent Authentication Rules

## 🛑 1. Szigorúan Tilos Jelszó Módosítás / Reset
* **Soha semmilyen körülmények között nem módosítható vagy resetelhető a felhasználó jelszava** a Supabase Admin API-n, SQL-en, vagy bármilyen egyéb módon!
* Tilos ideiglenes jelszó generálása vagy az `auth.users` rekordok jelszóhasheinek felülírása tesztelés céljából.

## 🔑 2. Hivatalos Teszt és Fejlesztői Hitelesítő Adatok
Böngészős teszteléshez (`browser_subagent`) vagy bejelentkezést igénylő feladatokhoz **kizárólag** a következő hivatalos teszt-felhasználót kell használni:

* **Email:** `aron@thinkai.hu`
* **Jelszó:** `A237kkil815!`

## 🌐 3. Bejelentkezési Protokoll Böngészős Teszteléskor
Ha a `browser_subagent` vagy böngészős teszt futtatásakor az alkalmazás átirányít az `/auth` oldalra:
1. Töltsd ki a bejelentkezési űrlapot a fenti hitelesítő adatokkal:
   - Email mező (`#signin-email` vagy `input[type="email"]`): `aron@thinkai.hu`
   - Jelszó mező (`#signin-password` vagy `input[type="password"]`): `A237kkil815!`
2. Kattints a "Bejelentkezés" gombra.
3. Várd meg, amíg a munkamenet létrejön és az alkalmazás átirányít a kért belső felületre.
