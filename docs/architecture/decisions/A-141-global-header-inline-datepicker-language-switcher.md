# A-141: Globális Fejléc Dátumválasztó Mellé Helyezett Nyelvválasztó (Inline DatePicker Companion Pattern) és Oldalsáv Tehermentesítés

**Státusz:** Elfogadva (Decided)  
**Dátum:** 2026-09-23  
**Kapcsolódó PRD:** [P-107: Globális Nyelvválasztó Elhelyezés és Lucide Globe Ikon Felületi Élmény](../../product/decisions/P-107-global-header-inline-language-switcher-ux.md), [P-081: Eaisybill Horvát Lokalizáció](../../product/decisions/P-081-eaisybill-croatia-localization-and-demo-ux.md)  
**Kapcsolódó ADR:** [A-109: Horvát Lokalizáció és Route Architektúra](./A-109-eaisybill-i18n-croatia-localization-and-route-architecture.md), [A-060: App Shell és Moduláris Routing](./A-060-modular-routes-decomposition.md), [A-114: eaisyBooks Kettős Működési Módú Héj](./A-114-accounty-dual-mode-shell-and-state-machine.md)  
**Érintett komponensek:** `GlobalDatePicker.tsx`, `LanguageSwitcher.tsx`, `AppLayout.tsx`, `AccountyHeader.tsx`, `AppSidebar.tsx`

---

## 1. Kontextus és Problémafelvetés

A horvát lokalizáció (`/hr` prefix és `accounty` szótárak) bevezetésekor a nyelvválasztó kezdetben a bal oldalsáv alsó felhasználói kártyájában (`AppSidebar.tsx`) kapott helyet egy kompakt `[HU]` badge formájában. Ez a megoldás a gyakorlatban több problémát okozott:

1. **Oldalsáv zsúfoltság és névcsonkolás:** A felhasználói kártyán a név, az e-mail cím, az avatar és a téma-kapcsoló (Nap/Hold) mellett a nyelvválasztó elvette a helyet a szövegtől, aminek következtében még a közepesen hosszú nevek is drasztikusan csonkolódtak (pl. `Schwarzcin...`). Összecsukott oldalsávban pedig plusz ikonsort generált az avatar és a beállítások közé.
2. **Különálló jobb oldali elhelyezés korlátja:** Amikor a nyelvválasztó a felső fejléc jobb szélére került (`AccountyHeader.tsx` jobb oldali műveletsor, `AppLayout.tsx` TopBar jobb margó), ultrawide és széles monitorokon túlságosan messze került a felhasználó primer vizuális fókuszától, miközben a bal oldalon lévő dátumválasztó mellett bőséges üres hely állt rendelkezésre.
3. **Kettős héj (Bill vs Books) szinkronizáció:** A számlázó (`eaisyBill` - `AppLayout.tsx`) és a könyvelőirodai (`eaisyBooks` - `AccountyHeader.tsx`) héjak eltérő jobb oldali gombcsoporttal rendelkeznek (a Books-ban Segítség és Értesítési harang is van), így a jobb szélre helyezett kapcsoló aszimmetrikus kódismétlést igényelt.

---

## 2. Architekturális Döntés

### 2.1 Inline DatePicker Companion Minta (`GlobalDatePicker.tsx`)
A nyelvválasztót beágyaztuk a `GlobalDatePicker` komponens belsejébe mint közvetlen társ-elemet (`Inline Companion`):
- A preset gombok (`Ez a hónap`, `Előző hónap`, `Ez az év`) és a két egyedi naptár-választó után egy elválasztó függőleges vonal (`|`) vezeti be a `<LanguageSwitcher buttonVariant="outline" />` gombot.
- Mivel mind a számlázó nézet (`AppLayout.tsx` TopBar), mind a könyvelői nézet (`AccountyHeader.tsx`) a `GlobalDatePicker`-t rendereli a fejlécében, a nyelvválasztó automatikusan, egységesen és duplikált elrendezés nélkül elérhető mindkét környezetben.

### 2.2 Méret- és Dizájn-Egységesítés (`LanguageSwitcher.tsx`)
- A gomb magasságát és stílusát (`h-7 text-xs px-2.5`, `buttonVariant="outline"`) pixelpontosan igazítottuk a `GlobalDatePicker` naptár gombjaihoz.
- Lucide `Globe` ikont (`w-3.5 h-3.5`) és nagybetűs nyelvkódot (`HU` / `HR`) használ.
- A lenyíló menü (`DropdownMenuContent`) a gomb alá balra igazítva nyílik (`align="start"`), tartalmazva a zászlókat és az aktív állapotot jelző pipát (`Check`).
- A nyelvváltás megtartja az aktuális URL lekérdezési paramétereket (`location.search`).

### 2.3 Oldalsáv Lábléc Kitisztítása (`AppSidebar.tsx`)
- Az `AppSidebar.tsx` kinyitott és összecsukott láblécéből teljes mértékben eltávolítottuk a `LanguageSwitcher` komponenst.
- Ezzel a felhasználónév és e-mail cím maximális szélességet kapott a téma-kapcsoló mellett, megszüntetve a vizuális csonkolódást.

### 2.4 Fejléc Akciók Letisztítása (`AccountyHeader.tsx` & `AppLayout.tsx`)
- Az `AccountyHeader.tsx` jobb oldali műveleti sávjából kikerült a nyelvválasztó, ott tisztán csak a Súgó (`HelpCircle`) és az Értesítések (`Bell`) maradtak.
- Az `AppLayout.tsx` `TopBar` fejlécéből eltávolítottuk a `justify-between` kényszert; a dátumválasztó és a benne lévő nyelvválasztó egységes, balra zárt blokkot alkot. Amennyiben egy korlátozott alkalmazott (`isEmployee`) lép be, aki nem látja a dátumválasztót, a nyelvválasztó számára önálló konténer jelenik meg.

---

## 3. Következmények és Előnyök

**Pozitív:**
- **Zero Duplication:** Nem kell külön figyelni a Bill és Books fejlécek jobb oldali elrendezésére, a dátumválasztó jelenléte automatikusan magával hozza a nyelvválasztót.
- **Tökéletes vizuális egyensúly:** Ultrawide kijelzőn sem vándorol a nyelvválasztó a monitor jobb szélére; a szűrési kontextus (dátum + nyelv) egy helyen van.
- **Tisztább felhasználói profil:** Az oldalsáv lábléc szellős és olvasható.

**Negatív / Kötöttségek:**
- Olyan ritka felületeken, ahol a `GlobalDatePicker` szándékosan rejtve van (pl. bizonyos standalone alkalmazotti nézetek), a `TopBar` fallback ágának kell gondoskodnia a `LanguageSwitcher` megjelenítéséről.

---

## 4. Kapcsolódó Dokumentumok
- [P-107: Globális Nyelvválasztó Elhelyezés és Lucide Globe Ikon Felületi Élmény](../../product/decisions/P-107-global-header-inline-language-switcher-ux.md)
- [A-109: Horvát Lokalizáció és Route Architektúra](./A-109-eaisybill-i18n-croatia-localization-and-route-architecture.md)
- [A-060: App Shell és Moduláris Routing](./A-060-modular-routes-decomposition.md)
