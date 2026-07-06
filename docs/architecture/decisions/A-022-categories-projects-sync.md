# A-022: Kategóriák és Projektek Dual-Table Szinkronizációs Stratégia

**Status:** Decided  
**Date:** 2026-06-26  
**Utolsó frissítés:** 2026-06-26

## Context

Az eaisybill/Visibill rendszerben a bejövő és kimenő számlák két külön táblában tárolódnak a Supabase adatbázisban:
1. `invoices` — A felhasználók által manuálisan vagy emailen beküldött és feldolgozott számlaképek (számlafájlok).
2. `nav_invoices` — A NAV Online Számla rendszeréből automatikusan szinkronizált elektronikus számlaadatok.

Amikor a felhasználó egy számlát egy **Kategóriához** (GL kategória) vagy egy **Projekthez** rendel, az üzleti elvárás az, hogy a hozzárendelés egységes és szinkronizált legyen. Ha egy NAV számlának létezik beküldött fizikai párja (és ezek össze vannak kapcsolva/párosítva a rendszerben), a felületen a kettő egyetlen entitásként jelenik meg a keresésekben, és a hozzárendelésüknek (kategória, projekt) mindkét rekordban tükröződnie kell.

## Decision

A **szinkronizált dual-table (C opció)** megközelítés mellett döntöttünk:
- Mind a `invoices`, mind a `nav_invoices` táblában megmarad a `category_id` és a `project_id` oszlop.
- Bármelyik felületen (Onboarding / Kategóriák hozzárendelési keresője, vagy az InvoicesPage fő számlalistájának sor-szintű legördülő menüi) történik meg a hozzárendelés, a rendszer **mindkét táblát** frissíti a számlaszám (`invoice_number` / `bizonylatsorszam`) alapján.
- A frontend lekérdezéseknél (`useInvoiceData.ts` és `InvoicesPage.tsx`) fallback logikát alkalmazunk: ha a NAV rekordban még nincs kitöltve a kategória vagy projekt, de a hozzárendelt beküldött számlán igen, akkor a felület automatikusan a beküldött számla értékeit jeleníti meg a NAV sorban is.

### Részletes implementációs döntések:

#### 1. Keresőbar deduplikáció és mentés (Onboarding.tsx)
- A keresési találatokban a beküldött és NAV számlák megegyező számlaszám esetén összevonásra kerülnek (a beküldött számla verziója élvez prioritást).
- Mentéskor a `handleBulkAddInvoices` funkció nem csak a keresési találat forrástábláját frissíti, hanem egy `Promise.all` segítségével **mindkét táblába** elmenti a kategóriát:
  ```typescript
  supabase.from('invoices').update({ category_id }).eq('bizonylatsorszam', invoice_number)
  supabase.from('nav_invoices').update({ category_id }).eq('invoice_number', invoice_number)
  ```

#### 2. Kategória és Projekt frissítés a Számlalistában (InvoicesPage.tsx)
- A NAV számlák sorában a kategória és projekt kiválasztó fallback logikát használ:
  ```typescript
  effectiveCategoryId = nav_invoice.category_id || matchedSubmittedInvoice?.category_id || null;
  ```
- Amikor a felhasználó a NAV sor dropdownjából módosítja az értéket, a `handleCategoryChange` és `handleProjectChange` függvények szintén mindkét táblát frissítik.

#### 3. React Query Cache Invalidáció
- A kategóriák és projektek szerkesztésekor a React Query cache-t invalidálni kell, hogy a számlalista azonnal frissüljön.
- A korábbi hibát javítva a kategória szerkesztése után a `['categories', companyId]` kulcsot, a projekt szerkesztése után pedig mind a `['projects', companyId]`, mind a számlák által használt `['projectsList', companyId]` cache kulcsot invalidáljuk.

## Consequences

**Pozitív:**
- Egységes és konzisztens adatállapot: a háttérben mindkét rekord tárolja a besorolást, így a riportok elkészítésekor nem függünk a párosítások meglététől vagy hiányától.
- Zökkenőmentes UX: a felhasználó bárhol módosítja a kategóriát vagy projektet, az a számla minden nézetében (NAV és beküldött listákban is) azonnal frissül.

**Negatív / Kockázatok:**
- Redundáns adattárolás (mindkét táblában tároljuk ugyanazt az információt).
- A szinkronizáció fenntartása a frontend kódban történik (multi-table update-ek), nem pedig adatbázis-szintű triggerrel (bár a bizonylatszám alapú update megbízható).
