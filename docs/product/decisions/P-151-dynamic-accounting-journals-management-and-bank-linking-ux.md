# P-151: Dinamikus Könyvelési Naplók Létrehozása és Bankszámla-összerendelés UX

**Status:** Decided  
**Date:** 2026-10-01  
**Category:** Accounting / Settings / eaisyBooks / Banks  
**Ticket Reference:** EB-0182  

---

## 1. Question

Hogyan tud a felhasználó és a könyvelő új könyvelési naplót (különösen banknaplót, pl. OTP HUF, OTP EUR, VÚB EUR, Revolut stb.) létrehozni és bankszámlához rendelni a felületen akkor, ha a cég nem csupán a két alapértelmezett K&H bankot használja, és hogyan kezelhetők a megszűnt/érvénytelen bankszámlák a felületen?

---

## 2. Decision

### 2.1. Gyors Naplórögzítés a Bankszámlák Beállításainál (`BankAccountsTab.tsx`)
1. **„+ Új banknapló” gomb:**
   - A *Beállítások -> Bankszámlák* fülön mind az új számla felvételekor, mind a meglévő szerkesztésekor a *Könyvelési napló* legördülő mező közvetlen szomszédságában egy kattintással elérhető a **„+ Új banknapló”** gyorsgomb.
2. **Automatikus Kijelölés:**
   - Amikor a felhasználó létrehozza az új naplót a felugró ablakban, a rendszer azonnal elmenti az adatbázisba, automatikusan frissíti a lenyíló listát, és azonnal ki is választja az újonnan létrehozott naplót.

### 2.2. Automatikus Kódgenerálás és Napló-űrlap (`CreateJournalModal.tsx`)
- A modális ablak a választott típus (Bank, Pénztár, Vegyes stb.) alapján intelligensen megvizsgálja a cég már meglévő naplóit és automatikusan kitölti a következő szabad kódot (pl. `B1`, `B2` után közvetlenül `B3`-at ajánl).
- A felhasználó megadhatja:
  - **Napló kódja** (pl. `B3`, szerkeszthető)
  - **Napló megnevezése** (pl. `OTP bank HUF`)
  - **Devizanem** (pl. HUF, EUR, USD)
  - **Kapcsolódó főkönyvi számla** (szűrt kereső a 384*, 385*, 386* analitikus számlákból)

### 2.3. Átfogó Naplókezelő Központ (`ManageJournalsModal.tsx` & `JournalsPage.tsx`)
- A *Könyvelés -> Könyvelési Naplók* menüpontban a jobb felső sarokban elhelyeztünk egy **„Naplók kezelése”** funkciógombot.
- Erre kattintva a könyvelő:
  - Táblázatos formában látja a cég valamennyi naplóját típus, deviza és rendelt főkönyvi szám szerint.
  - A sorvégi ceruza ikonnal közvetlenül módosíthatja a napló nevét és a hozzárendelt főkönyvi számot.
  - Szükség esetén inaktiválhatja a feleslegessé vált naplókat.
  - Közvetlenül innen is kezdeményezheti tetszőleges típusú új napló rögzítését.

### 2.4. Bankszámla Érvénytelenítés és Státuszjelzés
- A *Bankszámla szerkesztése* dialógusban beépítettünk egy **„Aktív bankszámla”** kapcsolót.
- A kikapcsolt (inaktív) bankszámlák:
  - Megőrződnek a rendszerben és az audit trailben.
  - A kártyájukon halványabb (50%-os átlátszóság) stílussal és diszkrét narancs/piros **„Érvénytelen / Megszűnt”** címkével jelennek meg.

### 2.5. Inaktív Naplók Megjelenítése a Bankszámla Szerkesztőben (`filterBankJournalsForEdit`)
- Ha egy bankszámlához rendelt naplót utólag inaktiválnak, a bankszámla szerkesztési ablakában a lenyíló lista nem dobja el a kapcsolatot, hanem a lista végén megjeleníti a hozzárendelt naplót egyértelmű **`— (Inaktív)`** jelöléssel és tompított stílussal.
- Ezzel a könyvelő anélkül szerkesztheti a bankszámla egyéb adatait, hogy a rendszer véletlenül lecsatolná a korábbi naplót. Új számla felvételekor ugyanakkor az inaktív naplók nem választhatók ki.

---

## 3. Current Implementation

- **Új Napló Létrehozása Modál:** [`src/components/journals/CreateJournalModal.tsx`](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/journals/CreateJournalModal.tsx)
- **Naplók Kezelése és Szerkesztése Modál:** [`src/components/journals/ManageJournalsModal.tsx`](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/journals/ManageJournalsModal.tsx)
- **Bankszámla Kezelő Felület:** [`src/components/settings/BankAccountsTab.tsx`](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/settings/BankAccountsTab.tsx)
- **Könyvelési Naplók Főoldal:** [`src/pages/JournalsPage.tsx`](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/pages/JournalsPage.tsx)
- **Adatbázis Migráció:** [`supabase/migrations/20261001041000_add_is_active_to_company_bank_accounts.sql`](file:///d:/ThinkAI/Visibill/eaisybill-prod/supabase/migrations/20261001041000_add_is_active_to_company_bank_accounts.sql)
- **Tesztek:**
  - [`src/components/journals/__tests__/CreateJournalModal.test.tsx`](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/journals/__tests__/CreateJournalModal.test.tsx)
  - [`src/components/journals/__tests__/ManageJournalsModal.test.tsx`](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/journals/__tests__/ManageJournalsModal.test.tsx)

---

## 4. Rationale

- Az `EB-0182` hibajegyben Lendvai Ádám kiemelte, hogy a cégének (Kolos Transport Kft.) négy különböző bankja van, és nem talált lehetőséget új naplók felvételére a meglévő kettő K&H mellett.
- A fejlesztés révén a könyvelő közvetlenül a bankszámlák konfigurálásakor vagy a könyvelési naplók oldalán azonnal létrehozhatja a hiányzó naplókat.
- A Kolos Transport Kft. részére az OTP HUF (`B3`), OTP EUR (`B4`) és VÚB EUR (`B5`) naplókat azonnal be is állítottuk az adatbázisban, és összerendeltük a megfelelő bankszámlákkal.
