# A-188: Dinamikus Könyvelési Naplók Létrehozása, Kezelése és Bankszámla-összerendelés

**Status:** Decided  
**Date:** 2026-10-01  
**Utoljára frissítve:** 2026-10-01  
**Category:** Accounting Engine / Database / Frontend / Banks & Journals  
**Ticket Reference:** EB-0182  

---

## 1. Context

Az `EB-0182` hibajegyben Lendvai Ádám (Ván Iroda Kft. / Kolos Transport Kft.) jelezte, hogy a cégének 4 féle bankja/számlája van (OTP HUF, OTP EUR, VÚB EUR stb.), azonban a rendszer csak két alapértelmezett K&H banknaplót (`B1`, `B2`) kínált fel, és a felhasználói felületen nem volt lehetőség új főkönyvi banknaplókat felvenni vagy a meglévőket módosítani.

A technikai audit a következő hiányosságokat tárta fel:
1. **Hardkódolt Kezdőmag:** Az `acc_seed_default_journals` adatbázis-függvény cégalapításkor kizárólag a `B1` ("K&H bank HUF", 3841) és `B2` ("K&H bank EUR", 3861) naplókat hozza létre.
2. **Hiányzó UI Kezelőfelület:** Bár a háttérben az `acc_journals` tábla dinamikusan képes tetszőleges számú naplót tárolni (`company_id`, `code`, `name`, `journal_type`, `currency`, `gl_account_id`), sem a Beállítások -> Bankszámlák felületen, sem a Könyvelés -> Könyvelési Naplók oldalon nem létezett modális ablak vagy gomb új naplók rögzítésére, átnevezésére vagy főkönyvi számlához rendelésére.
3. **Bankszámla Érvénytelenítés Hiánya:** A `company_bank_accounts` táblában nem volt `is_active` mező, így a megszűnt számlákat a felhasználók nem tudták inaktiválni a történeti tranzakciók integritásának megőrzése mellett.

---

## 2. Decision

### 2.1. Adatbázis Séma Bővítés (`is_active` mező a bankszámláknak)
- Létrehoztuk a `20261001041000_add_is_active_to_company_bank_accounts.sql` migrációt:
  ```sql
  ALTER TABLE public.company_bank_accounts 
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

  CREATE INDEX IF NOT EXISTS idx_company_bank_accounts_company_active 
  ON public.company_bank_accounts(company_id, is_active);
  ```
- Ezzel a megszűnt vagy lecserélt bankszámlák soft-deaktiválhatók anélkül, hogy a korábban lekönyvelt banki tételek vagy párosítások integritása sérülne.

### 2.2. Automatikus Kódgenerálás és Új Napló Modál (`CreateJournalModal.tsx`)
- Létrehoztuk a `src/components/journals/CreateJournalModal.tsx` komponenst:
  - **Intelligens kódjavaslat (`suggestNextJournalCode`):** A típusnak megfelelő prefixet vizsgálva (`B` -> bank, `P` -> pénztár, `V` -> vegyes) automatikusan megkeresi a legkisebb szabad sorszámot (pl. `B1`, `B2` létezése esetén automatikusan `B3`-at ajánl fel).
  - **Deviza és Főkönyvi Számlaválasztó:** A cég aktív számlatükréből (`gl_accounts`) csak a típushoz illeszkedő számlákat (pl. banknál 384*, 385*, 386*) szűri és jeleníti meg deviza-összhangban.
  - **In-flight szinkronizáció:** A sikeres mentést követően a frissen generált napló azonosítóját (`id`) azonnal visszajuttatja a hívó komponensnek (`onCreated`), így az azonnal kiválasztásra kerül.

### 2.3. Bankszámla Kezelő Integráció (`BankAccountsTab.tsx`)
- A Beállítások -> Bankszámlák felületen:
  - Mind az új bankszámla hozzáadása űrlapon, mind a meglévő bankszámla szerkesztése dialógusban elhelyeztünk egy **„+ Új banknapló”** gyorsgombot a naplóválasztó mellé.
  - A szerkesztési modálban beépítettük az **„Aktív bankszámla”** kapcsolót (`Switch`).
  - Az inaktív számlákat halványabb megjelenéssel és piros/szürke **„Érvénytelen / Megszűnt”** státuszbadge-dzsel különböztetjük meg.
  - **Inaktív naplók megőrzése (`filterBankJournalsForEdit`):** Ha egy korábban hozzárendelt naplót inaktiválnak, a bankszámla szerkesztésekor a lenyíló lista továbbra is megjeleníti a már összekötött naplót a lista végén egyértelmű **„— (Inaktív)”** címkével, megelőzve a véletlen naplóvesztést vagy lecsatlakozást.

### 2.4. Globális Naplókezelő Modál (`ManageJournalsModal.tsx` & `JournalsPage.tsx`)
- A Könyvelési Naplók oldal felső gombsorában elhelyeztük a **„Naplók kezelése”** gombot.
- A megnyíló dialógusban a könyvelő:
  - Áttekintheti az összes főkönyvi naplót kód, megnevezés, típus, deviza és rendelt főkönyvi szám szerint.
  - Bármikor létrehozhat új naplót (bank, pénztár, vegyes).
  - Szerkesztheti a meglévő naplók nevét és a hozzájuk kapcsolt alapértelmezett főkönyvi számot.
  - Inaktiválhatja a feleslegessé vált naplókat.

---

## 3. Consequences

### Pozitív:
- **Többbankos Működés:** A felhasználók és könyvelők korlátlan számú bankhoz (OTP, Erste, Revolut, VÚB, Wise stb.) és devizanemhez rögzíthetnek dedikált könyvelési naplót.
- **Nulla Kódmódosítási Igény:** Új bankszámla nyitásakor vagy felvételekor nem szükséges fejlesztői beavatkozás az adatbázisban; a könyvelő a felületről 3 másodperc alatt felveheti az új naplót.
- **Történeti Integritás:** A megszűnt bankszámlák és inaktív naplók nem tűnnek el a korábbi évek könyveléséből, de az aktív választókban és importoknál nem zavarják a munkát.
- **Tesztelt és Verifikált:** 12 önálló Vitest teszt védi a modálok logikáját és kódgenerálását, a TypeScript build (`npx tsc --noEmit`) hibátlan.

### Kockázatok és Kezelésük:
- *Egyedi számlatükör függőség:* Ha a cégnek még nincsenek felvéve analitikus banki számlaszámai (pl. 3842 OTP HUF), a napló rögzítéskor a rendszer felhívja a figyelmet a főkönyvi szám kiválasztására, de megengedi a napló létrehozását, amely utólag a Naplók kezelése felületen bármikor összekapcsolható a kívánt számlaszámmal.

---

## 4. Kapcsolódó Dokumentáció

- **PRD:** [P-151 Dinamikus Könyvelési Naplók Létrehozása és Bankszámla-összerendelés UX](../product/decisions/P-151-dynamic-accounting-journals-management-and-bank-linking-ux.md)
- **Komponensek:**
  - `src/components/journals/CreateJournalModal.tsx`
  - `src/components/journals/ManageJournalsModal.tsx`
  - `src/components/settings/BankAccountsTab.tsx`
  - `src/pages/JournalsPage.tsx`
- **Tesztek:**
  - `src/components/journals/__tests__/CreateJournalModal.test.tsx` (9 teszt)
  - `src/components/journals/__tests__/ManageJournalsModal.test.tsx` (3 teszt)
