---
trigger: model_decision
description: Apply when working on React components, UI styling, frontend state, hooks, or pages in eaisybill-prod.
---

# React & Frontend Guidelines (Visibill / eaisybill-prod)

## 1. Komponens Architektúra és Kompozíció
* **Kerüld a Boolean Prop robbanást (Anti-Boolean Prop Explosion):**
  * Ha egy komponens viselkedése vagy megjelenése 3+ független boolean prop (`isOpen`, `isCompact`, `showFooter`, `withBorder`, stb.) vezérlése alá kerül, bontsd szét **compound komponensekre** (pl. `<Card.Header>`, `<Card.Body>`) vagy hozz létre különálló, specifikus komponenseket.
* **Tiszta Provider Architektúra:**
  * Context Providereket csak valós, globális vagy moduláris állapotmegosztásra használj.
  * Ne tegyél feleslegesen gyakran változó adatot magas szintű Contextbe, mert az felesleges teljes alkalmazás szintű újrarajzolást (re-render) okoz.

## 2. Teljesítmény és Renderelés (Vercel Best Practices)
* **Re-render minimalizálás:**
  * Ne hozz létre inline függvényeket vagy objektum-literálokat render közben olyan gyermekkomponenseknek átadva, amelyek `React.memo`-val vannak ellátva. Használj `useCallback`-et és `useMemo`-t indokolt esetben.
  * Származtatott állapotok (derived state): Ne szinkronizálj lokális `useState`-et `useEffect`-ből egy prop változásra! Számold ki a render során közvetlenül (`const fullName = firstName + ' ' + lastName;`).
* **Lusta betöltés (Code Splitting):**
  * Nagy méretű modulokat, ritkán látogatott dashboardokat és nehéz külső könyvtárakat (pl. chartok, komplex táblázatok) `React.lazy()` és `<Suspense>` segítségével tölts be.

## 3. Stílus és UI Konvenciók
* **Design Rendszer & Tailwind:**
  * Használd a meglévő projekt design tokenjeit és színpalettáját (`src/index.css`, Tailwind konfig).
  * Kerüld a hardkódolt, ad-hoc hexadecimális és inline stílusokat (`style={{ ... }}`).
* **Reszponzivitás és UX:**
  * Minden felületnek reszponzívnak kell lennie (mobil/tablet/desktop töréspontok).
  * Minden aszinkron művelethez (betöltés, mentés) jeleníts meg egyértelmű visszajelzést (skeleton loader, disabled állapot, spinner, toast).

## 4. TypeScript és Típusbiztonság
* **Szigorú típusok:**
  * Szigorúan kerüld az `any` típus használatát!
  * Minden komponens propjaihoz definiálj explicit `interface` vagy `type` leírást.
  * Az adatbázisból érkező adatokhoz mindig a generált Supabase típusokat használd (`src/integrations/supabase/types.ts`).
