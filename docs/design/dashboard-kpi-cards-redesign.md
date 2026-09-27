# Dashboard KPI Kártyák Újratervezése (Design Mockup & Specifikáció)

> **Probléma:** Többdevizás összegeknél a string alapú pipe (`|`) összefűzés, a változó számú devizasor (1–3 sor) és a kártyák `flex justify-center` elrendezése miatt a szomszédos kártyák fejlécei és ikonjai függőlegesen és vízszintesen elcsúsznak.
> 
> **Interaktív HTML Mockup:** [dashboard-kpi-card-redesign-options.html](file:///d:/ThinkAI/Visibill/eaisybill-prod/docs/design/mockups/dashboard-kpi-card-redesign-options.html)

---

## 1. Hibaok Elemzés (Root Cause Diagnosis)

A képernyőképen látható anomáliák forrása a `MetricCard.tsx` és `DashboardMetrics.tsx` három egymást erősítő tervezési sajátossága:

1. **Szövegtördelési Káosz (Multi-currency Pipe Soup):**
   * A `formatMultiCurrency` segédfüggvény az aktív devizákat egyszerűen összefűzi:
     ```ts
     activeEntries.map(([currency, amount]) => formatCurrency(amount, currency)).join(' | ')
     ```
   * Ha egy kártya 1 devizát tartalmaz (pl. *ÁFA*: `23 961 286 Ft`), az elfér 1 sorban.
   * Ha 2 devizát tartalmaz (pl. *Bevétel*: `60 331,30 EUR | 105 054 326 Ft`), a `text-2xl font-semibold` méret miatt 2 sorba törik.
   * Ha 3 devizát tartalmaz (pl. *Kiadás*: `71 459,42 EUR | 61 075,48 USD | 67 811 812 Ft`), 3 külön sorba törik, megnövelve a doboz magasságát.

2. **Fejlécek Függőleges Elcsúszása (Header Misalignment):**
   * A `MetricCard.tsx`-ben a kártya törzse `flex flex-col justify-center` stílust használ.
   * Ha a tartalom alacsony (1 sor), a fejléc lejjebb csúszik a kártya közepéhez közeledve.
   * Ha a tartalom magas (3 sor), a fejléc feljebb tolódik.
   * Ezen felül a hosszú címek (pl. *„Kifizetetlen bejövő számlák (Nettó)”*) 2 sorba törnek, míg a szomszédos *„ÁFA”* csak 1 soros. Ennek következtében a vízszintes fejléc-vezérvonal teljesen megtörik.

3. **Rács-aszimmetria (Grid Imbalance):**
   * A 4 oszlopos rácsban 7 kártya van elhelyezve, így a 2. sor 4. helyén üres lyuk tátong.

---

## 2. Megoldási Opciók & Mockup Design

Az interaktív mockup fájlban ([dashboard-kpi-card-redesign-options.html](file:///d:/ThinkAI/Visibill/eaisybill-prod/docs/design/mockups/dashboard-kpi-card-redesign-options.html)) kidolgozott 3 opció:

### 💎 1. Opció (Ajánlott): „Fintech Executive” — Fő Konszolidált Érték + Deviza Címkék (Pills)
* **Koncepció:**
  * Minden kártya a cég választott devizájában (`selectedCurrency`, pl. `Ft`) mutatja a **fő aggregált egyenleget** kiemelten (`text-2xl font-bold tabular-nums`).
  * A fejléc szigorúan rögzített magasságú (`min-h-[36px]` vagy `h-9 flex items-start justify-between`), a fejléc-vonalak pixelre pontosan egybeesnek.
  * Az alsó szekcióban letisztult deviza-címkék (Pill Badges) sorakoznak:
    pl. `[ EUR 60,3k ]` `[ HUF 105,0M ]` vagy hoverre teljes formátummal.
  * **Kártya magasság:** Szigorúan fix `h-[168px]` mindenhol.
  * **8. kártya:** Hozzáadásra kerül az *„Operatív Eredmény (Nettó)”* (Bevétel - Kiadás = Cash Flow), így a 4x2 rács tökéletesen zárttá és arányossá válik.

### 📊 2. Opció: „Structured Currency Matrix” — Strukturált Deviza-Sorok
* **Koncepció:**
  * Számviteli fókuszú megjelenítés, ahol minden deviza külön dedikált sorban látható.
  * A kártya tetején egy leválasztott `44px`-es fejléc sáv fut, alatta pedig 3 soros mikro-táblázat:
    * Bal oldalon halvány ISO kód (`EUR`, `USD`, `HUF`).
    * Jobb oldalon jobbra zárt, azonos szélességű `tabular-nums` összegek.
  * **Kártya magasság:** Szigorúan fix `h-[184px]`.

### ⚡ 3. Opció: „Interactive Segmented” — Kártyaszintű Devizaváltó
* **Koncepció:**
  * A kártyán **mindig pontosan 1 nagy összeg** szerepel (`text-26px font-bold`).
  * A többdevizás kártyák fejlécében egy miniatűr szegmensváltó gombsor található: `[HUF]` `[EUR]` `[USD]`.
  * Kattintásra az összeg azonnal átvált az adott devizára layout shift nélkül.
  * **Kártya magasság:** Szigorúan fix `h-[162px]`.

---

## 3. Alkalmazott Eaisybill Design Tokenek

A mockup és az implementáció 100%-ban a platform hivatalos HSL design tokenjeit alkalmazza (`src/index.css`):

| Szerepkör | Világos Mód (Light) | Sötét Mód (Dark) | Tailwind Token |
|---|---|---|---|
| Kártya háttér | `hsl(0 0% 100%)` | `hsl(210 7% 5%)` | `bg-card` |
| Keret (Hairline) | `hsl(222 10% 89%)` | `hsl(225 9% 15%)` | `border-border` |
| Elsődleges szöveg | `hsl(210 14% 4%)` | `hsl(210 7% 97%)` | `text-foreground` |
| Másodlagos címke | `hsl(220 5% 42%)` | `hsl(220 5% 55%)` | `text-muted-foreground` |
| Siker (Bevétel) | `hsl(142 71% 45%)` | `hsl(142 71% 50%)` | `text-success`, `bg-success/5` |
| Figyelmeztetés/Kintlévőség | `hsl(217 91% 60%)` | `hsl(217 91% 62%)` | `text-info`, `bg-info/5` |
| Hiba/Kiadás/Tartozás | `hsl(0 84% 60%)` | `hsl(0 84% 63%)` | `text-destructive`, `bg-destructive/5` |
| Brand Accent | `hsl(174 83% 32%)` | `hsl(170 82% 45%)` | `text-primary`, `bg-primary/10` |

---

## 4. Javasolt Refaktorálási Lépések a Kódbázisban

Amennyiben az 1. Opció (Fintech Executive) elfogadásra kerül:

1. **`MetricCard.tsx` szerkezeti átalakítása:**
   * A `justify-center` eltávolítása, helyette:
     `h-[168px] flex flex-col justify-between p-4`
   * A fejléc rögzítése:
     `<div className="h-9 flex items-start justify-between gap-2">`
   * A címsor `line-clamp-2` és `text-xs uppercase font-bold tracking-wider text-muted-foreground`.
   * Alsó zóna bevezetése a devizás részleteknek (`border-t border-border/40 pt-2 flex items-center justify-between`).

2. **`DashboardMetrics.tsx` adatgazdagítása:**
   * A `selectedCurrency` alapú konverzió kiterjesztése a bevételre, kiadásra, kintlévőségre és szállítói kötelezettségre.
   * Az eredeti devizák megtartása a másodlagos pill-ekhez.
   * A 8. kártya beillesztése: *Operatív Egyenleg (Cash Flow)* (`revenue - expenses`).
