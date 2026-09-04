# P-070: Management Dashboard Hibajegy Létrehozás Felhasználó Nevében UX (Impersonated Ticket Creation)

> **Státusz:** ✅ Decided  
> **Kategória:** UI / Workflow / Customer Support  
> **Dátum:** 2026-09-04  
> **Érintett komponensek:** `src/features/management/components/tickets/ManagementCreateTicketDialog.tsx`, `src/pages/TicketsPage.tsx`, `src/features/management/ManagementDashboard.tsx`  
> **Kapcsolódó ADR:** [A-089](../../architecture/decisions/A-089-management-ticket-creation-on-behalf-of-user.md)  
> **Kapcsolódó PRD-k:** [P-035](./P-035-ticket-system.md), [P-036](./P-036-management-dashboard.md)

---

## 1. Kérdés / Problémafelvetés

Hogyan tehetjük lehetővé az operátorok és support adminisztrátorok számára a Management Dashboard `Hibajegyek` aloldalán, hogy egy külső csatornán (pl. telefon, közvetlen email, chat) beérkező ügyfélhibát közvetlenül egy konkrét regisztrált felhasználó fiókjához rendelve hozzanak létre, úgy, hogy a felhasználó a saját felületén azonnal lássa a jegyet, a megfelelő céghez kapcsolódjon, és a kezelőfelület gyors, intuitív és hibabiztos legyen?

---

## 2. Döntés (Decision)

### A. Indítógomb Elhelyezése a `TicketsPage`-en
- A Management Dashboard Hibajegyek nézetének felső navigációs vezérlősávjában (a sub-tabs mellett jobbra) elhelyeztünk egy jól látható, kiemelt gombot:
  - **Felirat:** `+ Új hibajegy nyitása`
  - **Stílus:** Elsődleges (Primary) gomb, `Plus` ikonnal.
  - **Interakció:** Kattintásra megnyitja a `ManagementCreateTicketDialog` modális ablakot.

### B. Dialógus Felépítés és Mezők (`ManagementCreateTicketDialog`)
A modál a következő komponensekből és beviteli lépésekből áll:

1. **Célfelhasználó Kiválasztása (Searchable User Combobox):**
   - Popover alapú, kereshető legördülő lista (Radix UI / Shadcn Command).
   - Keresési feltételek: Felhasználó neve, email címe és cégneve.
   - Vizuális megjelenítés: Felhasználó neve félkövéren, alatta email cím és cégének neve másodlagos színnel.
   - Kötelező mező: Felhasználó kiválasztása nélkül az űrlap nem küldhető be.
2. **Dinamikus Cégválasztó (Company Selector):**
   - A kiválasztott felhasználóhoz kapcsolódó cégek dinamikus feloldása a `managementUsers` és `overview.companies` listából.
   - **Auto-fill viselkedés:** Amennyiben a felhasználónak pontosan 1 cége van, a rendszer automatikusan kitölti és rögzíti ezt a céget.
   - Amennyiben több cége van, legördülő választó jelenik meg a megfelelő cég kiválasztásához.
3. **Szolgáltatás és Alapadatok:**
   - **Szolgáltatás:** `eaisybill` vagy `accounty` (eaisyBooks) választó gombok/select.
   - **Típus:** Hiba (`bug`), Visszajelzés (`feedback`), vagy Kérdés (`question`).
   - **Prioritás:** Alacsony (`low`), Normál (`medium`), Magas (`high`), vagy Kritikus (`critical`) vizuális színkódolással.
   - **Kezdő Felelős (Assignee):** Opcionálisan azonnal hozzárendelhető a céges support csapat tagjaihoz.
4. **Tárgy és Leírás (RichTextEditor):**
   - **Tárgy (Title):** Kötelező egysoros beviteli mező.
   - **Leírás (Description):** Támogatja a formázott szöveget (félkövér, dőlt, listák, idézetek, kódblokkok).
   - **Gyorsbillentyű:** `Ctrl + Enter` (vagy `Cmd + Enter`) azonnali beküldés támogatása.
5. **Csatolmányok (Attachments Dropzone):**
   - Húzással (drag-and-drop) vagy fájlböngészővel tallózható fájlok.
   - Támogatott formátumok: Képek (PNG, JPG, WebP), PDF, ZIP archívumok.
   - Korlátozás: Max. 5 fájl, egyenként legfeljebb 10 MB.
   - Csatolmányonkénti törlési lehetőség a feladás előtt.

### C. Sikeres Beküldés Utáni UX
- **Async Loading Állapot:** A feladás gomb töltési animációt (`Loader2`) és inaktív állapotot mutat.
- **Siker Visszajelzés:** Zöld toast értesítés a sikeres jegynyitásról, megjelölve a generált jegyszámot (pl. `#T-1042`).
- **Azonnali Lista Frissítés és Megnyitás:**
  - A dialógus bezáródik.
  - A TanStack Query invalidálja a jegylistát (`['tickets']`) és az olvasatlan számlálókat.
  - A felület automatikusan kijelöli az újonnan létrehozott hibajegyet (`selectedTicketId = newTicket.id`), így a részletes nézet azonnal megjelenik a jobb oldali panelen.

---

## 3. Rationale

- **Csökkentett hibalehetőség:** Az operátornak nem kell fejből ismernie a felhasználók UUID azonosítóit vagy pontos email címeit; a valós idejű szűrővel név vagy cégnév alapján másodpercek alatt megtalálható a kívánt ügyfél.
- **1 cég auto-fill kényelem:** A Visibill felhasználók döntő többsége egyetlen céghez tartozik. Az automatikus hozzárendelés megkíméli a supportost a redundáns kattintásoktól.
- **Transzparencia a végfelhasználónak:** A jegy a célfelhasználó nevében és fiókjában jön létre, így az ügyfél nem marad ki a tájékoztatásból, láthatja az előzményeket és értesítéseket kap a válaszokról.

---

## 4. Kapcsolódó Dokumentumok
- [A-089: Management Dashboard Hibajegy Létrehozás Felhasználó Nevében](../../architecture/decisions/A-089-management-ticket-creation-on-behalf-of-user.md)
- [P-035: Hibajegy UI és workflow](./P-035-ticket-system.md)
- [P-036: Management Dashboard UI és navigáció](./P-036-management-dashboard.md)
