# P-086: Programozói Hozzáférés & API Kulcsok Kezelése (ApiKeysCard) UX

**Status:** Decided  
**Date:** 2026-09-16  
**Category:** Beállítások & Profil / Biztonság / Integrációk  
**Érintett komponensek:** `ApiKeysCard.tsx`, `SecuritySection.tsx`, `Settings.tsx`  
**Kapcsolódó döntések:** [A-117: Hivatalos Ügyfél REST API és Többcéges Kulcsok](../../architecture/decisions/A-117-customer-rest-api-and-multi-company-keys.md), [BRD 030: API Hozzáférés](../../business/decisions/030-api-access.md), [P-025: Settings Oldal Struktúra](./P-025-settings-structure.md), [A-101: Szkript-Automatizációk Védelme](../../architecture/decisions/A-101-direct-script-automation-restriction.md)

---

## Question

Hogyan tegyük lehetővé a vállalkozók, cégvezetők és külső integrátorok számára az API kulcsok önkiszolgáló, biztonságos és átlátható kezelését a felületen, miközben megelőzzük a kulcsok véletlen szivárgását és a félrekonfigurált jogosultságokat?

---

## Decision

A `Beállítások` (`/settings`) felület `Biztonság` szekciójában elhelyeztük az önálló **Programozói Hozzáférés & API Kulcsok (`ApiKeysCard`)** kártyát, amely az alábbi UX pillérekre épül:

### 1. Kulcslista és Státusz Áttekintés
- **Prefix Maszkolás:** A nyers kulcs az adatbázisban csak SHA-256 hash formájában létezik, ezért a listában kizárólag a prefix látható mono betűtípussal (pl. `vb_ee51911a...`).
- **Jogosultsági Szint (Scope) Badge:**
  - `Írás / Olvasás` (`read_write`): Elsődleges (default) badge cégadatok és beállítások módosításához.
  - `Csak Olvasás` (`read`): Másodlagos (secondary) badge tiszta analitikai vagy könyvelési lekérdezésekhez.
- **Többcéges Hatáskör Indikátor:** Egyértelműen kiírja, hogy a kulcs a felhasználó összes cégére globálisan érvényes-e (`Összes saját cégem`), vagy egy dedikált cégre korlátozott.
- **Státusz & Életciklus:**
  - `Aktív` badge zöld pajzs ikonnal (`ShieldCheck`).
  - `Visszavonva` badge piros színnel.
  - Létrehozás dátuma és legutóbbi sikeres API használat időbélyege (`Clock` ikonnal).

### 2. Új API Kulcs Generálása Varázsló (Kétfázisú Modál)
- **Fázis 1: Konfiguráció:**
  - Kulcs megnevezése (Input, placeholder: *pl. Belső ERP integráció vagy Külső automatizáció*).
  - Scope kiválasztó (`Select`: Írás/Olvasás vs Csak Olvasás magyarázó szöveggel).
  - Cég hatáskör választó (`Select`: *Összes saját cégem (Globális felhasználói kulcs)* vagy konkrét cég kiválasztása).
- **Fázis 2: Kriptográfiai Kulcs Megjelenítés (Single-View Guard):**
  - A generálás pillanatában a szerver visszaküldi a nyers kulcsot (`vb_<40 hex karakternév>`).
  - Figyelmeztető sárga kártya (`AlertTriangle`): *„Ez a kulcs CSAK MOST látható! Az adatbázis kizárólag a titkosított lenyomatot tárolja.”*
  - Monospace kijelző azonnali egykattintásos vágólapra másolás gombbal (`Copy` / `Check` vizuális visszajelzéssel).
  - A modál bezárásakor a nyers kulcs véglegesen eltűnik a kliens memóriájából.

### 3. Interaktív cURL API Dokumentáció
- A kártya fejlécében elhelyezett `API Dokumentáció` / `Dokumentáció elrejtése` gomb egy kattintással lenyit egy kódblokkot.
- Pontos végpont URL: `https://<project-ref>.supabase.co/functions/v1/customer-api`
- Példa cURL parancsok cégek lekérdezésére és adatmódosításra (név, cím, leírás, TEÁOR, adószám).

### 4. Megerősített Kulcsvisszavonás (`AlertDialog`)
- Aktív kulcsok mellett `Visszavonás` gomb (`Trash2` ikon).
- Megerősítő dialógus figyelmezteti a felhasználót, hogy a visszavonás végleges és az érintett külső szkriptek azonnal leállnak.

---

## Rationale

- **Zéró szivárgás:** A nyers kulcsot soha nem tároljuk és a felhasználó később sem kérheti le újra, minimalizálva a böngészős adathalászat és session-lopás kockázatát.
- **Többcéges ergonómia:** Mauroni Marco és a hasonló cégcsoport-tulajdonosok egyetlen kulccsal tudják automatizálni az összes cégüket, anélkül, hogy 7 külön kulcsot kellene fejben tartaniuk és konfigurálniuk.
- **Önkiszolgáló API onboarding:** A beépített cURL példák és a `?action=help` végpont révén a külső fejlesztők rendszergazdai segítség nélkül képesek bekötni az integrációt.
