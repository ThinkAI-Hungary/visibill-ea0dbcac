# P-114: NAV ÜPO M2M Integráció, Felhasználói Hitelesítés és Napi Szinkronizáció UX

**Status:** Decided  
**Date:** 2026-09-24  
**Utoljára frissítve:** 2026-09-25  
**Kategória:** UI / Integrációk & NAV  
**Érintett modulok:** `src/components/integrations/NavUpoM2mCard.tsx`, `src/pages/Integrations.tsx`  
**Kapcsolódó ADR:** [A-154](../../architecture/decisions/A-154-nav-upo-m2m-integration-and-credential-security.md)  

---

## 1. Kérdés és Felhasználói Kontextus
Hogyan biztosítható a könyvelők számára a NAV Ügyfélportál (ÜPO) gép-gép (M2M) kapcsolatának gyors, hibabiztos és érthető beállítása, figyelembe véve, hogy a NAV felületén generált kulcs lehet egybefüggő 40 karakteres sztring vagy 4 különálló mező (felhasználónév, jelszó, kulcsrészlet, nonce)?

---

## 2. Termékdöntés és Megoldás

### 1. Kettős Adatbeviteli Mód (40 Karakteres Auto-Split vs. 4 Mező)
A beállítási dialógusban a könyvelő választhat:
- **Gyorsbevitel (Ajánlott):** Egyetlen szöveges mezőbe beilleszthető a NAV felületéről másolt egybefüggő 40 karakteres kulcssorozat. A rendszer azonnal és automatikusan 10-10-10-10 karakteres szeletekre bontja (Felhasználónév, Jelszó, Aláírókulcs 1. rész, Nonce).
- **Részletes mezők:** A könyvelő manuálisan kitöltheti a 4 különálló beviteli mezőt, ha nem egybefüggő adatként kapta meg az ügyféltől.
- **Környezet választó:** Lehetőség van a Fejlesztői (Sandbox) és Éles (Production) környezet közötti váltásra.

### 2. Vizuális Státuszkártya és Maszkolás (`NavUpoM2mCard`)
- Az **Integrációk (`/integrations`)** oldalon egy dedikált mester-kártya fogadja a felhasználót.
- Aktív kapcsolat esetén zöld státuszjelvény és az utolsó sikeres szinkronizáció időpontja látható.
- A tárolt felhasználónév biztonsági maszkolással jelenik meg (pl. `usr••••12`), megelőzve az érzékeny adatok illetéktelen leolvasását.

### 3. Valós Idejű Kapcsolatteszt és KOMA Ellenőrzés
- A kártyán egy kattintással elérhető a **"Kapcsolat tesztelése"** funkció.
- A rendszer azonnali KOMA (Köztartozásmentes Adózói Adatbázis) ellenőrzést hajt végre a NAV-nál, és megerősíti, hogy a kapcsolat mindkét irányban hibátlanul üzemel.

### 4. Automatizált Napi Szinkronizáció és Manuális Gombok
- **Kapcsolók (Toggles):**
  - *Automatikus EFO szinkronizáció:* Napi hajnali lekérdezés az egyszerűsített foglalkoztatottak felhasznált napjairól.
  - *Automatikus munkavállaló szinkronizáció:* Napi hajnali lekérdezés a biztosítotti jogviszonyokról.
- **Azonnali szinkronizációs gombok:** Bármikor indítható ad-hoc szinkron, amely azonnal visszajelzi a frissített személyek számát és a folyamat állapotát.

### 5. Biztonságos Kapcsolatbontás (Revocation Flow)
- A kapcsolat bontása kétlépcsős megerősítő párbeszédablakkal történik ("Biztosan bontani szeretnéd a NAV M2M kapcsolatot?").
- Jóváhagyáskor a rendszer véglegesen törli a titkokat az adatbázisból és hivatalos audit bejegyzést hoz létre a műveletről.

### 6. Könyvelői Kulcs Gyors Átvétel és Portfólió-szintű Kiterjesztés (200 Céges Támogatás)
- **Kontextus:** Ha egy könyvelő több tíz vagy akár 200 céget kezel, nem reális sem a NAV felületén 200 technikai felhasználót regisztrálni, sem kézzel 200-szor konfigurálni a felületet.
- **Megoldás:**
  - Amikor a könyvelő egy olyan céghez lép be, ahol még nincs aktív NAV kapcsolat, de a felhasználói fiókjához tartozó másik cégnél már létezik működő M2M kulcs, a felület kiemelt sávban jelzi: *"Elérhető aktív könyvelői NAV M2M kapcsolat (pl. dyc••••xr)"*.
  - **Gyorsműveletek:**
    1. *„Kulcs átvétele ehhez a céghez”:* Egyetlen kattintással összekapcsolja az adott céget az aktív könyvelői kulccsal.
    2. *„Kiterjesztés az összes cégemre”:* Megerősítő párbeszédablak után egyetlen művelettel a könyvelő összes meglévő cégére aktiválja a kapcsolatot.
  - Ha a cég már kapcsolódva van, a kártyán látható a portfólió lefedettségi állapota, és lehetőség van a kulcs azonnali újraszinkronizálására a többi cégre is.

---

## 3. Kapcsolódó
- [A-154: NAV ÜPO M2M Integráció és Hitelesítési Biztonsági Architektúra](../../architecture/decisions/A-154-nav-upo-m2m-integration-and-credential-security.md)
- [P-049: NAV Szinkronizálás Modal UX](./P-049-nav-sync-dialog-ux.md)
- [P-033: Bérszámfejtési Ciklus UX](./P-033-payroll-cycle.md)
