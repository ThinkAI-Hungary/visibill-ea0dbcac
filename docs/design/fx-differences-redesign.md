# Design Spec — Árfolyam-különbözetek Szekció Újratervezése (FX Differences Redesign)

> **Cél:** Az [FxDifferencesSection.tsx](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/dashboard/FxDifferencesSection.tsx) komponens újratervezése a Dashboard többi elemének (különösen a [VatSection.tsx](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/dashboard/VatSection.tsx) és a 3-as operatív rács: [RecentInvoices.tsx](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/dashboard/RecentInvoices.tsx), [ProjectBreakdown.tsx](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/dashboard/ProjectBreakdown.tsx), [CategoryBreakdown.tsx](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/dashboard/CategoryBreakdown.tsx)) prémium vizuális és funkcionális mintájára.
> 
> **Interaktív HTML Mockup:** [fx-differences-redesign-options.html](file:///d:/ThinkAI/Visibill/eaisybill-prod/docs/design/mockups/fx-differences-redesign-options.html)

---

## 1. Meglévő Felület Elemzése (As-Is State & Fájdalompontok)

A jelenlegi `FxDifferencesSection.tsx` működőképes adatlogikával rendelkezik (a `get_fx_differences` Supabase RPC hívásból számol), de felépítése eltér a frissített Dashboard dizájnrendszerétől:

1. **Vertikális Túlnyúlás (Vertical Bloat):**
   * Ha a felhasználó kinyitja a kártyát, 5 különálló szint renderelődik egymás alá függőlegesen:
     1. 4 db KPI csempe
     2. Főkönyvi besorolási blokk (`FxGlMappingBlock`)
     3. 220px-es havi oszlopdiagram (`Recharts BarChart`)
     4. Egy terjedelmes HTML táblázat lenyitható hónapokkal és bizonylatokkal (sok devizás tételnél akár 800–1500px-re nyújtva a lapot)
     5. Alsó devizánkénti kártyák
   * Ez megtöri az oldal görgetési ritmusát, míg a Dashboard többi szekciója fegyelmezett, kompakt blokkokat használ.

2. **Főkönyvi Beállítás (GL Mapping) Elhelyezése:**
   * A KPI csempék és a grafikon között teljes szélességű sávként szerepel, vizuálisan megszakítva az analitikai adatfolyamot. Jobb helye van a fejlécben, beágyazott mini modulként, vagy önálló beállító nézetben.

3. **Görgetési Kontroll (ScrollArea) Hiánya a Részletezőben:**
   * A kibontott hónapok számlái közvetlenül a dokumentumfa magasságát növelik, szemben a `RecentInvoices` és `CategoryBreakdown` elegáns Radix `ScrollArea` megoldásával.

---

## 2. A 3 Kidolgozott Design Koncepció

Az interaktív, kattintható HTML mockup megtekinthető:  
👉 [`docs/design/mockups/fx-differences-redesign-options.html`](file:///d:/ThinkAI/Visibill/eaisybill-prod/docs/design/mockups/fx-differences-redesign-options.html)

---

### 🌟 1. Opció (Kiemelten Ajánlott): „Fintech Dense Split” (VatSection és RecentInvoices Analógia)
* **Koncepció:** Kétoszlopos, szinkronizált ~520px-es belső elrendezés (pontosan úgy, mint az ÁFA kimutatás és a 3-as operatív rács):
  * **Fejléc:**
    * 32×32px borostyán ikon doboz (`CandlestickChart`, `bg-amber-500/10 text-amber-500 border border-amber-500/25`).
    * Cím és leírás: *„Árfolyam-különbözetek — Devizás számlák teljesítés vs. pénzügyi rendezés közötti árfolyamváltozása”*.
    * Jobb oldalon: deviza badge-ek (`[EUR: 14] [USD: 5]`), kiemelt éves konszolidált nettó egyenleg (`+1 248 500 Ft` zöldben vagy pirosban), és finom Collapse Chevron.
  * **Bal oszlop (40% / 5 hasáb):**
    * **Felső 2×2 KPI rács:**
      1. *Nettó különbözet:* `+1 248 500 Ft` (éves realizált eredmény)
      2. *Realizált nyereség:* `+2 890 100 Ft` (zöld)
      3. *Realizált veszteség:* `-1 641 600 Ft` (piros)
      4. *TAO hatás (9%):* `+112 365 Ft` (tájékoztató jellegű kalkuláció)
    * **Középen: Havi nettó hatás kompakt oszlopdiagram** (Recharts BarChart finom lekerekített oszlopokkal, zöld/piros színezéssel a 0-tengely körül).
    * **Alul: Beágyazott Főkönyvi Besorolás Mini Kártya** (`976 Nyereség` | `876 Veszteség`) inline szerkesztéssel és gyors mentéssel.
  * **Jobb oszlop (60% / 7 hasáb):**
    * **Fejléc vezérlősáv:** Devizaszűrő tabok (`[Összes] [EUR] [USD]`) és keresőmező.
    * **Havi és bizonylatszintű hierarchikus lista `ScrollArea`-ban:**
      - Minden hónap egy tiszta, halvány elválasztású fejléc sor (Hónap neve, nyereség, veszteség, nettó egyenleg, tételek száma, nyitó nyíl).
      - Kattintásra kibomlanak az adott havi számlák: bizonylatszám, partnernév, devizaösszeg, teljesítés dátuma & árfolyama vs. kifizetés dátuma & árfolyama, árfolyamkülönbözet összege és GL besorolás badge.
      - **Magasság:** Szigorúan 520px-re zárt, belső zökkenőmentes görgetéssel, nem tolja el a Dashboardot!

---

### ⚡ 2. Opció: „Executive Tabbed Cockpit” (Füles Vezérlőpult)
* **Koncepció:** Maximális funkcionalitás és adatmélység görgetési teher nélkül, tab-alapú szétválasztással.
  * **Felső KPI sáv:** 4 letisztult kártya az éves összesítőkkel.
  * **Szegmentált fülsor (`Tabs`):**
    1. 📊 **Trend & Grafikon:** Részletesebb havi és negyedéves vizualizáció (bruttó nyereség vs. veszteség + kumulált vonal).
    2. 📅 **Havi Összesítő:** Számviteli havi aggregált táblázat (TAO hatással és átlagos marzzsal).
    3. 📑 **Tételes Bizonylatok:** Minden devizás számla kereshető, szűrhető listája belső lapozóval és számlakép előnézettel.
    4. ⚙️ **Főkönyvi Szabályok (GL Mapping):** Elkülönített, kényelmes beállító felület a könyvelési kódokhoz és szabályokhoz.
* **Előnye:** Zéró felületi zaj, minden nézet 100%-ban az adott célra optimalizált.

---

### 🏛️ 3. Opció: „Financial Ledger & Cash-Flow Impact” (Likviditási & Audit Fókusz)
* **Koncepció:** Pénzügyi vezetőknek és könyvelőknek készült nézet, amely a devizás kitettségre és likviditási hatásokra fókuszál.
  * Felső sávban az **Operatív Eredmény-hányad:** a devizás számlaforgalom mekkora része realizálódott árfolyamnyereségként/veszteségként.
  * Bal oldalon: Strukturált devizapár-analitika (EUR/HUF kitettség vs. USD/HUF kitettség nyereség/veszteség aránya).
  * Jobb oldalon: Audit-kész táblázat Excel/CSV export gombbal és közvetlen főkönyvi feladási státusszal.

---

## 3. Alkalmazott Eaisybill Design Tokenek

| Szerepkör | Világos Mód (Light) | Sötét Mód (Dark) | Tailwind Token |
|---|---|---|---|
| Kártya háttér | `hsl(0 0% 100%)` | `hsl(223 23% 13%)` | `bg-card` |
| Külső szegély | `hsl(222 10% 89%)` | `hsl(222 18% 22%)` | `border-border/80 shadow-card` |
| Fejléc elválasztó | `hsl(222 10% 89% / 0.4)` | `hsl(222 18% 22% / 0.4)` | `border-b border-border/40` |
| Szekció Ikon doboz | `hsl(38 92% 50% / 0.1)` | `hsl(38 92% 50% / 0.15)` | `bg-amber-500/10 text-amber-500` |
| Nyereség / Pozitív | `hsl(142 71% 45%)` | `hsl(142 71% 50%)` | `text-emerald-500`, `text-success` |
| Veszteség / Negatív | `hsl(0 84% 60%)` | `hsl(0 84% 63%)` | `text-destructive` |
| Belső görgetősáv | Radix UI | Radix UI | `ScrollArea` |

---

## 4. Javasolt Következő Lépés

1. A felhasználó megtekinti az interaktív HTML mockupot:  
   [`docs/design/mockups/fx-differences-redesign-options.html`](file:///d:/ThinkAI/Visibill/eaisybill-prod/docs/design/mockups/fx-differences-redesign-options.html)
2. Kiválasztja a preferált opciót (ajánlott: **1. Opció — Fintech Dense Split**).
3. Implementáció az [FxDifferencesSection.tsx](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/dashboard/FxDifferencesSection.tsx) fájlban, build ellenőrzés (`npm run build`), és frissítés a dokumentációban.
