# P-085: eaisyBooks Portfólió Oldalsáv 4-Kategóriás Munkafolyamat-Alapú Csoportosítása (Teendők, Portfólió, Segítség, Beállítások) UX

**Status:** ✅ Decided  
**Date:** 2026-09-14  
**Category:** Navigation / UX  
**Source:** [PortfolioNav.tsx](../../src/components/accounty/layout/PortfolioNav.tsx) · [AccountyShellContext.tsx](../../src/pages/Accounty/AccountyShellContext.tsx) · [AccountySidebar.tsx](../../src/components/accounty/layout/AccountySidebar.tsx)  
**Kapcsolódó:** [P-006 Sidebar Structure](./P-006-sidebar-structure.md) · [P-031 eaisyBooks Layout](./P-031-accounty-layout.md) · [P-076 Dual-Mode Navigation](./P-076-eaisybooks-dual-mode-navigation-and-company-switcher-ux.md) · [05 Layout & Navigáció](../../design/05-layout-navigation.md)

---

## Context

Az eaisyBooks portfólió nézetének oldalsávja korábban az `ÁTTEKINTÉS & MŰVELETEK`, `SZAKMAI FOLYAMATOK` és `ADMINISZTRÁCIÓ` csoportokba szerveződött. A könyvelői visszajelzések és a mindennapos használati tapasztalatok alapján a struktúra több ponton súrlódást okozott:
1. **Fogalmi átfedés:** A *Műveletek* és *Folyamatok* fogalmilag nem váltak el tisztán egymástól (a *Hiányzó számlák* fent volt, míg a *Jóváhagyási sor* és a *Riasztások* lent, pedig mind operatív feladat).
2. **Szétszórt figyelem:** A sürgős elmaradásokat jelző badge-ek (pl. a 491 hiányzó számla) és a riasztások távol voltak egymástól; hiányzott a reggeli munkakezdéshez szükséges fókuszált *Action Center / Inbox Zero* felület.
3. **Elrejtett AI Asszisztens:** Az AI Asszisztens és a Hibajegyek az `Adminisztráció` ➔ `Támogatás & AI` 2. szintű lenyílója alá volt rejtve, holott az AI a platform egyik legfontosabb megkülönböztető ereje.
4. **Túl mély fastruktúra:** 3 szintű kinyitási láncolat nehezítette a 256px széles oldalsáv átláthatóságát.

---

## UX Kérdés & Döntési Folyamat

Milyen menü-csoportosítás szolgálja a legjobban a könyvelőirodai napi rutint és ergonómiát, miközben azonnal kézre állnak a napi teendők és kiemelést kap a mesterséges intelligencia?

A felkínált koncepciók közül az **1. Opció: Action-Driven / Napi Munkafolyamat** modell került kiválasztásra 4 egyértelmű kategóriával.

---

## Döntés (Decision)

A portfólió oldalsáv (`PortfolioNav.tsx`) 4 logikai blokkba szerveződik:

### 1. ⚡ Teendők (Action Center / Sürgős feladatok)
Minden azonnali vagy időszakos beavatkozást igénylő elem egy helyen összpontosul:
* ⚠️ **Hiányzó számlák** (`/eaisybooks/missing-invoices`) — Kiemelt, sürgősséget jelző piros badge-dzsel (`491`), ha hiány van.
* 📥 **Jóváhagyási sor** (`/eaisybooks/approval-queue`) — Operatív jóváhagyásra váró számlák és dokumentumok.
* 🔔 **Riasztások** (`/eaisybooks/alerts`) — Rendszer- és ügyfélriasztások, anomáliák.
* 📅 **Adónaptár & Határidők** (`/eaisybooks/tax-calendar`) — NAV és helyi adó határidők.

### 2. 💼 Portfólió (Ügyfélmunka & Szolgáltatások)
Az irodai szintű ügyfélkezelés és szakmai modulok felülete:
* 🏢 **Portfólió** (`/eaisybooks`) — Főoldali ügyféllista, állapotok és KPI kártyák.
* 🧮 **Bérszámfejtés Ciklusok** (`/eaisybooks?tab=payroll`) — Bérszámfejtési folyamatok havi zárási nézete.
* 📊 **Irodai Riportok** (`/eaisybooks/reports`) — Irodai szintű kimutatások.
* 🚀 **Onboarding** (`/eaisybooks/onboarding`) — Új ügyfelek felvétele.
* 📖 **Szakmai Törzsadatok** (lenyíló közvetlen almenü) — A könyvelő napi munkájához tartozó szakmai referenciák (Sablonok, Jogviszonykódok, Adómértékek, Jogszabály-frissítések), melyek a Beállítások alól közvetlenül ide kerültek át.

### 3. ✨ Segítség (Intelligencia & Támogatás)
Első osztályú állampolgárként kiemelt segítségnyújtás:
* 🤖 **AI Asszisztens** (`/eaisybooks/ai-assistant`) — Közvetlen, 1-kattintásos elérés, modern pulzáló vizuális AI ponttal ellátva.
* 🎫 **Hibajegyek** (`/eaisybooks/tickets`) — Dedikált olvasatlan jegy számlálóval (`unreadTicketCount`).
* ❓ **Segítség** (`/eaisybooks/help`) — Súgó, útmutatók és tudásbázis.

### 4. ⚙️ Beállítások (Rendszer & Biztonság)
Letisztult, egyetlen szinttel laposított accordion rendszerkonfigurációkhoz:
* 🏢 **Iroda & Beállítások** (Profilbeállítások, Jogosultságkezelő, Könyvelők kezelése)
* 🛡️ **Biztonság & GDPR** (Audit napló, GDPR)
* *(A korábbi „Támogatás & AI” felszámolásra került, a „Szakmai Törzsadatok” pedig a Portfólió alá költözött a napi szakmai elérés megkönnyítésére).*

---

## Összecsukott (Collapsed) Mód Szinkronizációja

Amikor az oldalsáv 12-es szélességű ikon-sávvá csukódik össze, az elemek vizuális szeparátor vonalakkal (`divider`) csoportosulnak a 4 kategória szerint: a Portfólió blokkban megjelenik a Szakmai Törzsadatok ikonja (`BookOpen`), a badge-ek a helyükön maradnak (9+ formátumban), és a jobb oldali tooltipek pontos megnevezést adnak.

---

## Verifikáció és Tesztek

* **Dedikált tesztcsomag:** `src/test/accounty/portfolioNavGrouping.test.tsx` (9/9 sikeres teszt).
* Kategóriák megjelenése, badge renderelés, accordion működés, Szakmai Törzsadatok lenyíló és összecsukott mód viselkedése teljesen lefedve.
