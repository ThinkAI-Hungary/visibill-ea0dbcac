# P-087: Aggreg8 Bankcsatlakozás, SyncUI Felugró Ablak és Élő Szinkronizáció UX

**Status:** Decided  
**Date:** 2026-09-17  
**Utoljára frissítve:** 2026-09-17  

**Category:** Beállítások & Bankkapcsolatok UX  

**Question:** Hogyan kezelje a Visibill a bankszámlák PSD2 alapú összekapcsolását, az Aggreg8 felugró ablakos folyamatát, a 180 napos hozzájárulási élettartamot és az élő szinkronizáció visszajelzéseit?

**Decision:**
A **Beállítások $\rightarrow$ Bankszámlák** aloldal felső kiemelt szekciójaként létrehoztunk egy dedikált **Aggreg8BankConnections** komponenst, amely a hagyományos kézi számlaszám-felvitel fölött biztosítja az automatikus bankkapcsolatok kezelését.

### 1. Négy Kötelező UI Állapot
- **Betöltés (Loading):** Csontváz (Skeleton) animáció a meglévő kapcsolatok kártyáinak helyén.
- **Üres állapot (Empty State):** Informatív illusztráció, amely részletesen elmagyarázza a bankcsatlakozás működését (OTP, Erste, MBH stb. egy kattintással), a PSD2 biztonsági garanciát („A Visibill soha nem fér hozzá a netbanki jelszavadhoz”), valamint egy kiemelt zöld „Új bank csatlakoztatása” akciógombot.
- **Hibaállapot (Error State):** Alert sáv és újrapróbálkozás gomb (`refetch`).
- **Aktív állapot (Connected State):** Csatlakoztatott bankkártya stílusú dobozok:
  - Bank neve és azonosítója (pl. OTP, Erste).
  - Csatolt alszámlák listája számlaszámmal és IBAN-nal.
  - 180 napos PSD2 hozzájárulási lejárati számláló és figyelmeztető badge:
    - Zöld badge: > 30 nap van hátra.
    - Sárga/Borostyán badge: < 30 nap van hátra.
    - Piros badge: Lejárt hozzájárulás.
  - Akciógombok:
    - **„Szinkronizálás most” (On-Demand sync):** Azonnali tranzakciófrissítés indítása.
    - **„Megújítás” (Extend consent):** 180 napos felhatalmazás meghosszabbítása a banknál.
    - **„Törlés” (Revoke):** Hozzáférés visszavonása és kapcsolat inaktiválása.

### 2. SyncUI Felugró Ablak (Popup) Kezelés
- Méretezett ablak (`500x750 px`), amely közvetlenül az Aggreg8 biztonságos felületét tölti be egyedi egyszer használatos tokennel (`userFlowToken`).
- Képernyő közepére igazított megjelenés, görgetősáv és átméretezési engedélyekkel.
- A popup bezárásakor a rendszer nem hagyja magára a felhasználót: Toast értesítést küld a folyamat lezárultáról.

### 3. Versenyhelyzet- és Villogásvédelem (Anti-Flicker & Race Condition Safeguard)
- Ha a felhasználó a netbankos belépés után azonnal bezárja az ablakot, a banki webhook 1-2 másodperces késése miatt az oldal nem villan fel üresen:
  - **Supabase Realtime feliratkozás:** `postgres_changes` csatorna az `aggreg8_consents` és `aggreg8_accounts` táblákra automatikusan frissíti a React Query gyorsítótárat.
  - **Lépcsőzetes megerősítő lekérdezések:** Popup zárásakor azonnali invalidáció, majd +2.5 másodperc és +6.0 másodperc múlva automatikus csendes újra-lekérdezés.
  - **Élő állapotjelző badge:** A címsorban pulzáló kék/zöld ikon és szöveg: *„Szinkronizálás folyamatban...”*.

### 4. Beszédes Hibaüzenetek és Naplózás
- Bármilyen konfigurációs hiányosság (pl. ha a szerveren még nincs beállítva az `A8_AIS_API_KEY` titok) vagy hálózati fennakadás esetén a rendszer nem rejtélyes 500-as hibakódot vagy technikai angol szakkifejezést dob, hanem pontos, barátságos magyar nyelvű Toast értesítésben magyarázza el a teendőt.

## Rationale
A bankkapcsolat beállítása bizalmi funkció. A felhasználónak minden pillanatban éreznie kell, hogy az adatai biztonságban vannak, tisztán látnia kell a PSD2 180 napos engedély állapotát, és azonnali, élő vizuális visszajelzést kell kapnia a háttérben zajló adatszinkronizációról.

## Kapcsolódó
- [A-119: Aggreg8 PSD2 Open Banking Integráció](../../architecture/decisions/A-119-aggreg8-psd2-open-banking-integration.md)
- [026-banking-integration.md (BRD)](../../business/decisions/026-banking-integration.md)
- [BankAccountsTab.tsx Komponens](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/settings/BankAccountsTab.tsx)
- [Aggreg8BankConnections.tsx Komponens](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/banking/Aggreg8BankConnections.tsx)
- [useAggreg8.ts Hook](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/hooks/useAggreg8.ts)
