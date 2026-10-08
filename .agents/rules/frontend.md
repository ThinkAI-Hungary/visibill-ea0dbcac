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
* **Zéró Fantom Mező (PGRST204 Megelőzés):**
  * `.from('...').insert(payload)` vagy `.update(payload)` hívások összeállításakor győződj meg róla, hogy a payload **minden egyes kulcsa** létező adatbázis oszlop a migrálások szerint.
  * Tilos olyan feltételezett kapcsolat-kulcsokat beszúrni (pl. `nav_invoice_id`, `invoice_id`), amelyek nem részei a cél tábla sémájának.
* **Aggregáló / Banner Lekérdezések Rezilienciája (PGRST205 Védelem):**
  * Új vagy kiegészítő modulok adatainak lekérésekor (pl. fejléc számlálók, dashboard widgetek) mindig alkalmazz hibavédelmet és `staleTime`-ot a TanStack Query-ben, hogy egy még le nem futott migráció vagy schema cache frissülés ne rántsa magával a teljes oldal betöltését.

## 5. Gyors Kódminőség és Hook Ellenőrzés (Oxlint)
* **Aktív és kötelező használat frontend módosítások után:**
  * Komponensek és hookok írásakor vagy refaktorálásakor kötelező azonnal lefuttatni az érintett fájlra az oxlintet:
    ```powershell
    npx oxlint src/components/.../MyComponent.tsx
    ```
  * Kiemelt figyelemmel vizsgáld az alábbi hibamintákat:
    * `react(purity)`: Ne hívj meg impure funkciót (pl. `new Date()`) renderelés közben közvetlenül.
    * `react(set-state-in-effect)`: Kerüld a szinkron `setState`-et a `useEffect`-ben (cascading re-render kivédése).
    * `preserve-manual-memoization`: A `useMemo`/`useCallback` dependency tömbjének pontosnak kell lennie.

## 6. Infinite Scroll és PostgREST Lapozási Architektúra (PGRST103 & Loop Védelem)
* **PostgREST 416 (PGRST103 Range Not Satisfiable) Trap:**
  * A Supabase `.range(from, to)` metódus PostgREST alatt azonnal HTTP 416 hibát dob, ha `from >= total_rows`.
  * A lapozó lekérdezésekben a `PGRST103` hibát kötelező csendesen lekezelni, és kivétel dobása helyett üres listával `{ items: [], totalCount }` visszatérni, jelezve hogy elértük az adathalmaz végét.
* **Kezdeti Lapozási Invariáns (First-Page Invariant):**
  * Ha a legelső lekérdezés (`from === 0` vagy `page === 1`) kevesebb elemet adott vissza mint a `PAGE_SIZE` (pl. 22 < 50), akkor az adatbázisban **fizikailag nincs több sor**.
  * Ilyenkor a `hasMore` állapotnak **azonnal és garantáltan `false`-nak kell lennie** (`(initialData?.items?.length ?? 0) >= PAGE_SIZE`), függetlenül attól, hogy a `totalCount` mező mit tartalmaz!
* **SQL-szintű szűrés a PostgREST Count Torzulás Ellen:**
  * Ha a felületen kizárunk bizonyos rekordokat (pl. 0 Ft-os adminisztratív tételek: `invoice_gross_amount != 0`), azt **mindig az SQL lekérdezés szintjén kell megtenni** (`.neq('invoice_gross_amount', 0)`).
  * Ha a szűrés csak kliensoldalon történik, a PostgREST `count` értéke mesterségesen magasabb lesz mint a valós elemek száma, ami hamis `items.length < totalCount` állapotot és túlcsorduló, 416-os hibát kiváltó lapozást generál.
* **Végtelen Ciklus Megszakítása Hibánál (Break-on-Error):**
  * `IntersectionObserver` alapú görgetésnél ha a `handleLoadMore` hívás bármilyen hibára fut (`catch (err)`), **kötelező lekapcsolni a lapozást (`setHasMore(false)`)**! Ellenkező esetben a képernyőn maradó sentinel másodpercenként többször újratriggereli a hibát, lefagyasztva a böngészőt.

## 7. i18next Dinamikus Objektum és Tömb Lekérések (Tömb-Fallback Invariáns)
* **A naiv `t(...) || DEFAULT_ARRAY` csapda (`TypeError: b.map is not a function`):**
  * Amikor a `useTranslation` hook `returnObjects: true` opcióját használjuk (pl. hónapnevek, legördülő opciók lekérésére), hiányzó kulcs vagy hibás fordítási fájl esetén az i18next nem tömböt ad vissza, hanem **a keresőkulcs nevét mint stringet** (pl. `"hr:calendar.months"`).
  * Mivel JavaScriptben a nem-üres string *truthy*, a `(t(...) as string[]) || DEFAULT_ARRAY` kifejezés a stringre értékelődik ki! Emiatt a `.map()` hívás futásidőben azonnali összeomlást okoz (`TypeError: b.map is not a function`).
* **Kötelező Minta:**
  Mindig szigorú típus- és tömbellenőrzést kell alkalmazni:
  ```typescript
  // ❌ HIBÁS:
  const months = (t('hr:calendar.months', { returnObjects: true }) as string[]) || DEFAULT_MONTHS;
  months.map(...); // TypeError: months.map is not a function!

  // ✅ HELYES:
  const rawMonths = t('hr:calendar.months', { returnObjects: true });
  const months = Array.isArray(rawMonths) ? (rawMonths as string[]) : DEFAULT_MONTHS;
  ```

## 8. Pénzügyi Előjelek & Keresztmoduláris Cache Érvénytelenítés
* **Jóváíró / Helyesbítő Számlák Abszolútérték-Szabálya (`Math.abs`):**
  * Pénzügyi kintlévőség, részfizetés vagy teljes kifizetettség vizsgálatakor tilos a bruttó összeget közvetlenül relációs operátorral összevetni a kifizetett összeggel, mert negatív előjelű (jóváíró / helyesbítő / stornó) számláknál a reláció megfordul (pl. `5000 >= -10000.5` hamisan teljesül).
  * Mindig `Math.abs` használatával hasonlítsd össze a bizonylatösszeget a kifizetett tranzakciók összegével:
    ```typescript
    const absGross = Math.abs(invoiceGross);
    const isPaid = totalTxAmount > 0 && totalTxAmount >= (absGross - 0.5);
    const isPartial = totalTxAmount > 0 && !isPaid && (absGross > 0 ? totalTxAmount < absGross : false);
    ```
* **Keresztmoduláris TanStack Query Cache Érvénytelenítés:**
  * Számla vagy pénzügyi bizonylat rögzítésekor/módosításakor nem elég a saját domént (`['invoices']`) érvényteleníteni.
  * Ha a bizonylat könyvelési vagy főkönyvi hatással bír, a kapcsolódó aggregált lekérdezéseket is kötelező érvényteleníteni:
    ```typescript
    queryClient.invalidateQueries({ queryKey: ['general_ledger'] });
    queryClient.invalidateQueries({ queryKey: ['glBalances'] });
    ```

## 9. Böngésző Párhuzamosság & Burst Lekérdezés Védelem (TCP Socket & 504 Timeout)
* **A naiv `Promise.all(batches.map(...))` csapda:**
  * Az asztali és mobil böngészők domain-enként mindössze 6 egyidejű TCP kapcsolatot tartanak fenn.
  * Ha a kliens kontrollálatlanul több tucat vagy több száz PostgREST / RPC kérést indít egyszerre (pl. számlatömbök egyenkénti feloldása), a böngésző hálózati sora eldugul (`net::ERR_INSUFFICIENT_RESOURCES`), a kérések feltorlódnak, és a Supabase/Cloudflare reverse proxy 504 Gateway Timeout hibát dob.
* **Kötelező Invariáns (Concurrency Throttling):**
  * Kötegelt lekérdezéseknél vagy N+1 jellegű relációs feloldásoknál **szigorúan kötelező egy aszinkron párhuzamosság-korlátozó (concurrency limiter / worker pool)** használata.
  * A megengedett maximális egyidejű szálak száma: `CONCURRENCY_LIMIT = 4`.
  ```typescript
  // ✅ HELYES MINTA:
  const CONCURRENCY_LIMIT = 4;
  for (let i = 0; i < batches.length; i += CONCURRENCY_LIMIT) {
    const chunk = batches.slice(i, i + CONCURRENCY_LIMIT);
    await Promise.all(chunk.map(batch => fetchBatch(batch)));
  }
  ```

## 10. Pénzügyi Korosítás Dátum-Invariánsa (Történeti Cutoff vs. Mai Nap)
* **A `new Date()` korosítási torzulás:**
  * Számla és partner korosítási analitikáknál (0–30, 31–60, 61–90, 90+ napos kintlévőségek) szigorúan tilos a bizonylatok lejárati idejét (`due_date`) az aktuális mai naphoz (`new Date()`) viszonyítani!
  * Ha a felhasználó egy korábbi időszakot vizsgál (pl. 2024. december 31-i állapot vagy korábbi havi zárás), a mai naphoz hasonlítás miatt minden akkori nyitott számla hamisan 90+ napos lejártként jelenne meg.
* **Kötelező Invariáns:**
  * A késedelmi napok számát mindig a felhasználó által kiválasztott szűrési záródátumhoz (`dateTo`), ennek hiányában a bizonylat teljesítési/fordulónapjához képest kell számítani:
  ```typescript
  const cutoff = dateTo ? new Date(dateTo) : new Date();
  const diffDays = Math.floor((cutoff.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
  ```
