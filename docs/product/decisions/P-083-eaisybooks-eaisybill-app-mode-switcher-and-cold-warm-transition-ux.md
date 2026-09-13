# Product Decision Record (PRD)

# P-083: eaisyBooks ↔ eaisyBill Alkalmazásváltó (AppModeSwitcher) és Hideg/Meleg (Cold/Warm) Átmenet UX

**Státusz:** ✅ Decided  
**Dátum:** 2026-09-13  
**Kategória:** UI / Navigáció & Felhasználói Élmény  
**Kapcsolódó döntések:** [P-006](./P-006-sidebar-structure.md), [P-031](./P-031-accounty-layout.md), [P-076](./P-076-eaisybooks-dual-mode-navigation-and-company-switcher-ux.md), [A-114](../../architecture/decisions/A-114-collapse-dual-mode-navigation-shell.md), [A-115](../../architecture/decisions/A-115-eaisybooks-eaisybill-cold-warm-hybrid-transition-and-route-resolution.md)

---

## 1. Kérdés és Felhasználói Probléma

Amikor a felhasználó az `eaisyBill` (számlázó/pénzügyi modul) és az `eaisyBooks` (könyvelői iroda modul) között vált:
1. **Hogyan jelenjen meg a választó komponens a felületen?** (Összecsukott és kinyitott oldalsáv esetén)
2. **Milyen visszajelzést adjon a rendszer betöltés közben?** Szükséges-e minden egyes váltásnál teljes képernyős spinner, vagy elegendőek a kártya-szintű skeletonok?
3. **Hogyan védhető ki a villódzás és a "blank field" (üres mező) hatás?** Amikor a felhasználó átkattint, az aszinkron lekérések előtt a fejléc ne mutasson üres választómezőt, és ne ugorjon átmenetileg hibás portfólió nézetbe.

---

## 2. A Döntés

### 2.1. "Cold vs Warm" (Hidegindítás vs Meleg Váltás) Hibrid Navigációs Modell

A felhasználói élmény optimalizálására hibrid modellt alkalmazunk:

| Esemény | Vizuális Állapot | Cél & Indoklás |
|---------|------------------|----------------|
| **Hidegindítás (Cold Start)**<br>*(F5 újratöltés vagy első belépés az adott appba)* | Teljes képernyős `LoadingSpinner`<br>(*"eaisyBill betöltése..."* vagy *"eaisyBooks betöltése..."*) | **Layout stabilitás:** Megakadályozza a félkész layoutok, üres szűrőmezők és jogosultsági feliratok felvillanását, amíg a React lazy chunkok és céglisták inicializálódnak (400ms grace period). |
| **Meleg Váltás (Warm Switch)**<br>*(További kattintások az appok között a session alatt)* | **Azonnali SPA megjelenítés (0ms)**<br>+ Belső lokális skeletonok a kártyákon és táblázatokon | **Prémium sebességérzet:** Ha az alkalmazás alapjai már a memóriában vannak, tilos a felhasználót mesterséges teljes képernyős spinnerrel lassítani. A tartalom azonnal beúszik. |

### 2.2. Alkalmazásváltó Komponens (`AppModeSwitcher`) Kialakítása

1. **Kinyitott oldalsáv (Expanded Mode):**
   - Lekerekített kapszula (`rounded-full min-h-[46px]`), finom fényhatással és világos/sötét téma optimalizációval (`bg-muted/65 dark:bg-[#0d0e10]/60 border-border/50`).
   - Két választható opció: **eaisyBill** és **eaisyBooks**.
   - Az aktív fület alul finom türkiz neon indikátor csík emeli ki (`bg-primary shadow-[0_0_8px_#14D4B8]`), amely vizuális horgonyt ad.
   - Hover állapotban a háttér és a szövegszín finom átmenettel reagál.
2. **Összecsukott oldalsáv (Collapsed Mode):**
   - Függőleges miniatűr kapszula (`w-9 rounded-full`), **eB** és **eK** (vagy eB) jelölésekkel, az aktív módot jelző alsó fényponttal.

### 2.3. Cégválasztó Folytonosság és "Zero Blank Frame"

- A `CompanySelector` az útvonalból származtatott `effectiveCompany` értékkel azonnal kirajzolja a célcég nevét.
- A felhasználó egyetlen pillanatra sem lát üres lenyíló mezőt vagy placeholder szöveget az átnavigálás során.
- Az `AppModeSwitcher` a könyvelő modulban kijelölt cég azonosítóját közvetlenül beemeli a számlázó cél-URL-jébe (`/:companyId/:dateRange/`).

---

## 3. Következmények és Eredmények

1. **Selymes, villódzásmentes átmenet:** Megszűnt a navigációs sáv frame-szintű ugrása és az üres mező.
2. **Maximális reszponzivitás:** A már betöltött alkalmazások közötti váltás pillanatszerű és természetes SPA élményt nyújt.
3. **Tiszta kód:** Nincsenek elavult `localStorage` switch-jelzők, a lifecycle tisztán a komponensek életciklusához kötött.
