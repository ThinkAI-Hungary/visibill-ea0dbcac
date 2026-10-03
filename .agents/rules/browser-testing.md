---
trigger: model_decision
description: Apply when running browser tests, launching browser_subagent, authenticating in the Visibill web app, or testing UI flows.
---

# Browser Testing & Subagent Authentication Rules

## 🛑 1. Szigorúan Tilos Jelszó Módosítás / Reset
* **Soha semmilyen körülmények között nem módosítható vagy resetelhető a felhasználó jelszava** a Supabase Admin API-n, SQL-en, vagy bármilyen egyéb módon!
* Tilos ideiglenes jelszó generálása vagy az `auth.users` rekordok jelszóhasheinek felülírása tesztelés céljából.

## 🔑 2. Hivatalos Hitelesítő Adatok & Admin Felhasználók

### 👑 Elsődleges Rendszergazda / Fejlesztő (Morfi / Jani):
* **Név:** Schwarczinger János (Jani, Morfi)
* **Email:** `notbyalongway@thinkai.hu`
* **Jelszó:** `Morfiapro1.`
* **Supabase User ID:** `415bf1b6-8ce5-4425-915c-e656a2972ab7`
* **Ticket válaszok & Support kommentek:** Alapértelmezetten **MINDIG** ezzel a fiókkal küldünk ki support választ, ticket kommentet és végzünk adminisztratív műveleteket!

### 🧪 Másodlagos Teszt Felhasználó (Áron):
* **Email:** `notbyalongway@gmail.com`
* **Jelszó:** `Morfiapro1.`

## 🌐 3. Bejelentkezési Protokoll Böngészős Teszteléskor
Ha a `browser_subagent` vagy böngészős teszt futtatásakor az alkalmazás átirányít az `/auth` oldalra:
1. Töltsd ki a bejelentkezési űrlapot a fenti hitelesítő adatokkal:
   - Email mező (`#signin-email` vagy `input[type="email"]`): `notbyalongway@gmail.com`
   - Jelszó mező (`#signin-password` vagy `input[type="password"]`): `Morfiapro1.`
2. Kattints a "Bejelentkezés" gombra.
3. Várd meg, amíg a munkamenet létrejön és az alkalmazás átirányít a kért belső felületre.